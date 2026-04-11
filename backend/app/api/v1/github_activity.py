"""
GitHub Activity API - 获取 vLLM Ascend 和 vLLM 项目的动态数据
"""
import asyncio
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.base import get_db
from app.services.github_cache_service import GitHubCacheService
from app.services.github_client import GitHubClient

logger = logging.getLogger(__name__)

router = APIRouter()

# 缓存配置（使用 settings 中的配置）
CACHE_TTL_MINUTES = getattr(settings, 'GITHUB_CACHE_TTL_MINUTES', 10)  # 默认 10 分钟


class GitHubActivityService:
    """GitHub 动态数据服务"""

    def __init__(self, token: str, owner: str, repo: str):
        self.client = GitHubClient(token=token, owner=owner, repo=repo)

    async def get_activity_summary(self, db: AsyncSession, days: int = 1) -> dict[str, Any]:
        """
        获取项目动态摘要（带缓存）

        Args:
            db: 数据库会话
            days: 获取最近 N 天的数据

        Returns:
            动态摘要数据
        """
        # 尝试从缓存获取
        cache_service = GitHubCacheService(db, CACHE_TTL_MINUTES)
        try:
            cached_data = await cache_service.get(
                self.client.owner,
                self.client.repo,
                "activity",
                days
            )
        except Exception as e:
            # 缓存读取失败（可能是并发问题），记录日志并继续
            logger.warning(f"Failed to read cache, will fetch from GitHub: {e}")
            cached_data = None

        if cached_data:
            logger.info(f"Using cached data for {self.client.owner}/{self.client.repo}")
            return cached_data

        logger.info(f"Cache miss, fetching from GitHub for {self.client.owner}/{self.client.repo}")

        # 缓存未命中，从 GitHub 获取（注意：这里不使用 db，只调用 GitHub API）
        async with self.client:
            # 获取 PR、Issue、Commits、Releases
            prs, issues, commits, releases = await asyncio.gather(
                self.client.get_recent_pull_requests(days),
                self.client.get_recent_issues(days),
                self.client.get_recent_commits(days),
                self.client.get_latest_release(),
                return_exceptions=True
            )

            # 处理异常
            if isinstance(prs, Exception):
                logger.error(f"Failed to fetch PRs: {prs}")
                prs = []
            if isinstance(issues, Exception):
                logger.error(f"Failed to fetch issues: {issues}")
                issues = []
            if isinstance(commits, Exception):
                logger.error(f"Failed to fetch commits: {commits}")
                commits = []
            if isinstance(releases, Exception):
                logger.error(f"Failed to fetch releases: {releases}")
                releases = {"latest": None, "prerelease": None}

            result = {
                "owner": self.client.owner,
                "repo": self.client.repo,
                "days": days,
                "pull_requests_count": len(prs),
                "issues_count": len(issues),
                "commits_count": len(commits),
                "releases": {
                    "latest": {
                        "tag_name": releases["latest"]["tag_name"],
                        "name": releases["latest"]["name"],
                        "published_at": releases["latest"]["published_at"],
                        "html_url": releases["latest"]["html_url"],
                        "prerelease": False,
                    } if releases and releases.get("latest") else None,
                    "prerelease": {
                        "tag_name": releases["prerelease"]["tag_name"],
                        "name": releases["prerelease"]["name"],
                        "published_at": releases["prerelease"]["published_at"],
                        "html_url": releases["prerelease"]["html_url"],
                        "prerelease": True,
                    } if releases and releases.get("prerelease") else None,
                },
                "pull_requests": [
                    {
                        "number": pr["number"],
                        "title": pr["title"],
                        "state": pr["state"],
                        "user": pr["user"]["login"],
                        "created_at": pr["created_at"],
                        "html_url": pr["html_url"],
                    }
                    for pr in prs
                ],
                "issues": [
                    {
                        "number": issue["number"],
                        "title": issue["title"],
                        "state": issue["state"],
                        "user": issue["user"]["login"],
                        "created_at": issue["created_at"],
                        "html_url": issue["html_url"],
                        "labels": [
                            {
                                "name": label["name"],
                                "color": label["color"],
                                "description": label.get("description", ""),
                            }
                            for label in issue.get("labels", [])
                        ],
                    }
                    for issue in issues
                ],
                "commits": [
                    {
                        "sha": commit["sha"][:7],
                        "message": commit["commit"]["message"].split("\n")[0],
                        "author": commit["commit"]["author"]["name"],
                        "committed_at": commit["commit"]["committer"]["date"],
                        "html_url": commit["html_url"],
                    }
                    for commit in commits
                ],
            }

            # 保存到缓存
            await cache_service.set(
                self.client.owner,
                self.client.repo,
                "activity",
                result,
                days
            )

            return result


@router.get("/activity")
async def get_github_activity(
    db: AsyncSession = Depends(get_db),
    days: int = 1,
    project: str = "ascend",  # "ascend" or "vllm"
):
    """
    获取 GitHub 项目动态
    
    Args:
        days: 获取最近 N 天的数据（默认 1 天）
        project: 项目选择，"ascend" 表示 vLLM Ascend，"vllm" 表示 vLLM 主项目
    """
    if not settings.GITHUB_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub Token 未配置"
        )

    # 根据项目参数设置 owner 和 repo
    if project == "vllm":
        owner = "vllm-project"
        repo = "vllm"
    else:  # ascend
        owner = settings.GITHUB_OWNER
        repo = settings.GITHUB_REPO

    try:
        service = GitHubActivityService(
            token=settings.GITHUB_TOKEN,
            owner=owner,
            repo=repo
        )
        return await service.get_activity_summary(db, days)
    except Exception as e:
        logger.error(f"Failed to fetch GitHub activity: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取 GitHub 动态失败：{str(e)}"
        )


@router.get("/activity/combined")
async def get_combined_github_activity(
    db: AsyncSession = Depends(get_db),
    days: int = 1,
):
    """
    同时获取 vLLM Ascend 和 vLLM 项目的动态

    Args:
        days: 获取最近 N 天的数据（默认 1 天）
    """
    if not settings.GITHUB_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub Token 未配置"
        )

    try:
        # 创建两个独立的服务实例
        ascend_service = GitHubActivityService(
            token=settings.GITHUB_TOKEN,
            owner=settings.GITHUB_OWNER,
            repo=settings.GITHUB_REPO
        )
        vllm_service = GitHubActivityService(
            token=settings.GITHUB_TOKEN,
            owner="vllm-project",
            repo="vllm"
        )

        # 注意：不使用 asyncio.gather 并发执行，因为共享 db 会话会导致并发问题
        # 改为顺序执行，避免 "concurrent operations are not permitted" 错误
        ascend_data = await ascend_service.get_activity_summary(db, days)
        vllm_data = await vllm_service.get_activity_summary(db, days)

        # 处理异常
        if isinstance(ascend_data, Exception):
            logger.error(f"Failed to fetch ascend activity: {ascend_data}")
            ascend_data = {
                "owner": settings.GITHUB_OWNER,
                "repo": settings.GITHUB_REPO,
                "days": days,
                "pull_requests_count": 0,
                "issues_count": 0,
                "commits_count": 0,
                "releases": {"latest": None, "prerelease": None},
                "pull_requests": [],
                "issues": [],
                "commits": [],
                "error": str(ascend_data),
            }

        if isinstance(vllm_data, Exception):
            logger.error(f"Failed to fetch vllm activity: {vllm_data}")
            vllm_data = {
                "owner": "vllm-project",
                "repo": "vllm",
                "days": days,
                "pull_requests_count": 0,
                "issues_count": 0,
                "commits_count": 0,
                "releases": {"latest": None, "prerelease": None},
                "pull_requests": [],
                "issues": [],
                "commits": [],
                "error": str(vllm_data),
            }

        return {
            "ascend": ascend_data,
            "vllm": vllm_data,
        }
    except Exception as e:
        logger.error(f"Failed to fetch combined GitHub activity: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取 GitHub 动态失败：{str(e)}"
        )


@router.post("/activity/refresh")
async def refresh_github_activity(
    db: AsyncSession = Depends(get_db),
    days: int = 1,
    project: str | None = None,  # "ascend", "vllm", or None for both
):
    """
    手动刷新 GitHub 动态数据（强制从 GitHub API 获取，跳过缓存）

    Args:
        days: 获取最近 N 天的数据（默认 1 天）
        project: 项目选择，"ascend" 表示 vLLM Ascend，"vllm" 表示 vLLM 主项目，None 表示两者都刷新
    """
    if not settings.GITHUB_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub Token 未配置"
        )

    try:
        refreshed = []

        # 刷新 vLLM Ascend
        if project is None or project == "ascend":
            ascend_service = GitHubActivityService(
                token=settings.GITHUB_TOKEN,
                owner=settings.GITHUB_OWNER,
                repo=settings.GITHUB_REPO
            )
            # 先清除缓存
            cache_service = GitHubCacheService(db, CACHE_TTL_MINUTES)
            await cache_service.invalidate(
                settings.GITHUB_OWNER,
                settings.GITHUB_REPO,
                "activity"
            )
            # 强制获取新数据
            ascend_data = await ascend_service.get_activity_summary(db, days)
            refreshed.append("vLLM Ascend")

        # 刷新 vLLM
        if project is None or project == "vllm":
            vllm_service = GitHubActivityService(
                token=settings.GITHUB_TOKEN,
                owner="vllm-project",
                repo="vllm"
            )
            # 先清除缓存
            cache_service = GitHubCacheService(db, CACHE_TTL_MINUTES)
            await cache_service.invalidate(
                "vllm-project",
                "vllm",
                "activity"
            )
            # 强制获取新数据
            vllm_data = await vllm_service.get_activity_summary(db, days)
            refreshed.append("vLLM")

        return {
            "success": True,
            "message": f"已刷新：{', '.join(refreshed)}",
            "refreshed_projects": refreshed,
        }
    except Exception as e:
        logger.error(f"Failed to refresh GitHub activity: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"刷新 GitHub 动态失败：{str(e)}"
        )
