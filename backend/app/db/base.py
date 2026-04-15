"""
数据库基类和会话管理
"""
import logging
from collections.abc import AsyncGenerator

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

logger = logging.getLogger(__name__)


# 检测数据库类型
_is_sqlite = "sqlite" in settings.DATABASE_URL

# 创建异步数据库引擎
# 增加连接池大小以避免连接耗尽
engine_kwargs = {
    "echo": False,  # 关闭 SQL 查询日志
}

if _is_sqlite:
    # SQLite 特定配置（不支持连接池）
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    logger.info("Using SQLite database - connection pooling disabled")
else:
    # MySQL/PostgreSQL 连接池配置
    engine_kwargs["connect_args"] = {}
    engine_kwargs["pool_size"] = 20  # 连接池大小
    engine_kwargs["max_overflow"] = 20  # 最大溢出连接数
    engine_kwargs["pool_timeout"] = 60  # 连接超时时间
    engine_kwargs["pool_recycle"] = 3600  # 1 小时后回收连接
    engine_kwargs["pool_pre_ping"] = True  # MySQL 连接探活
    logger.info("Using MySQL/PostgreSQL database - connection pooling enabled (pool_size=20, max_overflow=20)")

# 创建异步数据库引擎
engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

# MySQL 特定配置：在连接创建时设置 sort_buffer_size
if not _is_sqlite:
    @event.listens_for(engine.sync_engine, "connect")
    def set_mysql_sort_buffer_size(dbapi_connection, connection_record):
        """Set sort_buffer_size for MySQL connections to avoid 'Out of sort memory' error"""
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("SET SESSION sort_buffer_size = 4 * 1024 * 1024")  # 4MB
            cursor.close()
            logger.debug("MySQL sort_buffer_size set to 4MB")
        except Exception as e:
            logger.warning(f"Failed to set sort_buffer_size: {e}")

    logger.info("MySQL session sort_buffer_size will be set to 4MB on each connection")

# 创建异步会话工厂
# 注意：autocommit=False 确保需要显式调用 commit()
# autoflush=False 避免自动刷新，手动控制事务
SessionLocal = async_sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """获取数据库会话的依赖注入函数"""
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database error: {e}")
        await db.rollback()
        raise
    finally:
        await db.close()
