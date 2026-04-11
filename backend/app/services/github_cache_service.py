"""
GitHub 数据缓存服务
提供 GitHub 数据的缓存功能，减少对 GitHub API 的频繁调用
"""
import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from functools import wraps
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GitHubCache

logger = logging.getLogger(__name__)

# 默认缓存过期时间（分钟）
DEFAULT_CACHE_TTL_MINUTES = 10  # 10 分钟


class GitHubCacheService:
    """GitHub 数据缓存服务"""

    def __init__(self, db: AsyncSession, ttl_minutes: int = DEFAULT_CACHE_TTL_MINUTES):
        """
        初始化缓存服务
        
        Args:
            db: 数据库会话
            ttl_minutes: 缓存过期时间（分钟）
        """
        self.db = db
        self.ttl_minutes = ttl_minutes

    async def get(self, owner: str, repo: str, data_type: str, days: int = 1) -> dict[str, Any] | None:
        """
        获取缓存数据

        Args:
            owner: GitHub 组织名
            repo: 仓库名
            data_type: 数据类型
            days: 数据范围（天数）

        Returns:
            缓存的数据，如果不存在或已过期则返回 None
        """
        try:
            stmt = select(GitHubCache).where(
                GitHubCache.owner == owner,
                GitHubCache.repo == repo,
                GitHubCache.data_type == data_type,
                GitHubCache.days == days,
                GitHubCache.expires_at > datetime.now(UTC)
            )
            result = await self.db.execute(stmt)
            cache = result.scalar_one_or_none()

            if cache:
                logger.debug(f"Cache hit for {owner}/{repo}/{data_type} (days={days})")
                return cache.cache_data

            logger.debug(f"Cache miss or expired for {owner}/{repo}/{data_type} (days={days})")
            return None

        except Exception as e:
            # 检查是否是并发错误（SQLite 异步会话不支持并发操作）
            error_msg = str(e)
            if "concurrent operations are not permitted" in error_msg or "isce" in error_msg:
                logger.warning(f"Concurrent operation detected, skipping cache read: {e}")
            else:
                logger.error(f"Error getting cache: {e}")
            return None

    async def set(self, owner: str, repo: str, data_type: str, data: dict[str, Any], days: int = 1) -> bool:
        """
        设置缓存数据
        
        Args:
            owner: GitHub 组织名
            repo: 仓库名
            data_type: 数据类型
            data: 要缓存的数据
            days: 数据范围（天数）
            
        Returns:
            是否设置成功
        """
        try:
            now = datetime.now(UTC)
            expires_at = now + timedelta(minutes=self.ttl_minutes)

            # 检查是否已存在
            stmt = select(GitHubCache).where(
                GitHubCache.owner == owner,
                GitHubCache.repo == repo,
                GitHubCache.data_type == data_type,
                GitHubCache.days == days
            )
            result = await self.db.execute(stmt)
            cache = result.scalar_one_or_none()

            if cache:
                # 更新现有缓存
                cache.cache_data = data
                cache.cached_at = now
                cache.expires_at = expires_at
                logger.debug(f"Cache updated for {owner}/{repo}/{data_type} (days={days})")
            else:
                # 创建新缓存
                cache = GitHubCache(
                    owner=owner,
                    repo=repo,
                    data_type=data_type,
                    days=days,
                    cache_data=data,
                    cached_at=now,
                    expires_at=expires_at,
                )
                self.db.add(cache)
                logger.debug(f"Cache created for {owner}/{repo}/{data_type} (days={days})")

            await self.db.commit()
            return True

        except Exception as e:
            logger.error(f"Error setting cache: {e}")
            await self.db.rollback()
            return False

    async def invalidate(self, owner: str, repo: str, data_type: str | None = None) -> bool:
        """
        使缓存失效
        
        Args:
            owner: GitHub 组织名
            repo: 仓库名
            data_type: 数据类型（可选，不传则删除该 repo 的所有缓存）
            
        Returns:
            是否删除成功
        """
        try:
            if data_type:
                stmt = select(GitHubCache).where(
                    GitHubCache.owner == owner,
                    GitHubCache.repo == repo,
                    GitHubCache.data_type == data_type
                )
            else:
                stmt = select(GitHubCache).where(
                    GitHubCache.owner == owner,
                    GitHubCache.repo == repo
                )

            result = await self.db.execute(stmt)
            caches = result.scalars().all()

            for cache in caches:
                await self.db.delete(cache)

            await self.db.commit()
            logger.debug(f"Cache invalidated for {owner}/{repo}" + (f"/{data_type}" if data_type else ""))
            return True

        except Exception as e:
            logger.error(f"Error invalidating cache: {e}")
            await self.db.rollback()
            return False

    async def clear_expired(self) -> int:
        """
        清理所有过期的缓存
        
        Returns:
            删除的缓存数量
        """
        try:
            stmt = select(GitHubCache).where(
                GitHubCache.expires_at <= datetime.now(UTC)
            )
            result = await self.db.execute(stmt)
            expired_caches = result.scalars().all()

            count = len(expired_caches)
            for cache in expired_caches:
                await self.db.delete(cache)

            await self.db.commit()
            logger.info(f"Cleared {count} expired cache entries")
            return count

        except Exception as e:
            logger.error(f"Error clearing expired cache: {e}")
            await self.db.rollback()
            return 0


def cache_github_data(data_type: str, ttl_minutes: int = DEFAULT_CACHE_TTL_MINUTES):
    """
    装饰器：自动处理 GitHub 数据的缓存
    
    Usage:
        @cache_github_data(data_type="activity", ttl_minutes=30)
        async def get_activity(owner, repo, days):
            # 实际获取数据的逻辑
            return data
    """
    def decorator(func: Callable[..., Awaitable[dict[str, Any]]]):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 从参数中提取 db, owner, repo, days
            # 假设第一个参数是 db，或者从 kwargs 中获取
            db = kwargs.get('db') or (args[0] if len(args) > 0 else None)
            owner = kwargs.get('owner') or (args[1] if len(args) > 1 else None)
            repo = kwargs.get('repo') or (args[2] if len(args) > 2 else None)
            days = kwargs.get('days', 1)

            if not db or not owner or not repo:
                logger.warning("Missing required parameters for cache decorator")
                return await func(*args, **kwargs)

            # 尝试从缓存获取
            cache_service = GitHubCacheService(db, ttl_minutes)
            cached_data = await cache_service.get(owner, repo, data_type, days)

            if cached_data:
                return cached_data

            # 缓存未命中，调用实际函数
            result = await func(*args, **kwargs)

            # 保存到缓存
            if result:
                await cache_service.set(owner, repo, data_type, result, days)

            return result

        return wrapper
    return decorator
