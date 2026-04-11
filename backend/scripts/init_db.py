"""
数据库初始化脚本
- 创建数据库表
- 执行版本化升级
- 创建默认管理员账号

使用方法:
    python scripts/init_db.py              # 初始化 + 升级到最新版本
    python scripts/init_db.py --no-upgrade  # 只创建表，不升级
"""
import argparse
import asyncio
import logging
import sys
from pathlib import Path

# 添加父目录到路径以便导入
sys.path.insert(0, str(Path(__file__).parent.parent))

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.core.security import hash_password
from app.db.base import SessionLocal, engine
from app.models import Base, User


async def init_tables():
    """创建所有数据库表"""
    print("Step 1: Creating database tables...")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully")
        print("  ✅ Tables created\n")
    except SQLAlchemyError as e:
        logger.error(f"Failed to create database tables: {e}", exc_info=True)
        print(f"  ❌ Failed to create tables: {e}\n")
        raise
    except Exception as e:
        logger.error(f"Unexpected error creating tables: {e}", exc_info=True)
        print(f"  ❌ Unexpected error: {e}\n")
        raise


async def create_default_users():
    """创建默认用户账号"""
    print("Step 3: Creating default users...")

    async with SessionLocal() as db:
        try:
            # 检查是否已存在超级管理员
            stmt = select(User).where(User.role == "super_admin")
            result = await db.execute(stmt)
            super_admin = result.scalar_one_or_none()

            if not super_admin:
                # 创建超级管理员
                super_admin = User(
                    username="admin",
                    email="admin@vllm-ascend.local",
                    password_hash=hash_password("admin123"),
                    role="super_admin",
                    is_active=True,
                )
                db.add(super_admin)

                # 创建普通管理员
                admin = User(
                    username="manager",
                    email="manager@vllm-ascend.local",
                    password_hash=hash_password("manager123"),
                    role="admin",
                    is_active=True,
                )
                db.add(admin)

                # 创建普通用户
                user = User(
                    username="user",
                    email="user@vllm-ascend.local",
                    password_hash=hash_password("user123"),
                    role="user",
                    is_active=True,
                )
                db.add(user)

                await db.commit()
                logger.info("Default users created successfully")

                print("\n  ✅ Default users created:")
                print("    Super Admin: admin / admin123")
                print("    Admin:       manager / manager123")
                print("    User:        user / user123")
                print("\n  ⚠️  Please change default passwords in production!\n")
            else:
                print("\n  ℹ️  Users already exist, skipping creation\n")

        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Database error creating users: {e}", exc_info=True)
            print(f"\n  ❌ Database error creating users: {e}\n")
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating users: {e}", exc_info=True)
            print(f"\n  ❌ Error creating users: {e}\n")
            raise
        finally:
            await db.close()


async def run_upgrades():
    """执行数据库升级"""
    print("Step 2: Running database upgrades...")

    # 导入升级模块（使用相对路径，兼容 Docker 环境）
    import importlib
    try:
        # 尝试作为包导入
        upgrade_db = importlib.import_module('scripts.upgrade_db')
    except ImportError:
        # 回退到直接导入
        upgrade_db = importlib.import_module('upgrade_db')

    await upgrade_db.upgrade_database()


async def main():
    parser = argparse.ArgumentParser(description="Database initialization tool")
    parser.add_argument(
        "--no-upgrade",
        action="store_true",
        help="Skip running upgrades (only create tables)"
    )
    parser.add_argument(
        "--no-users",
        action="store_true",
        help="Skip creating default users"
    )

    args = parser.parse_args()

    print("\n" + "="*60)
    print("  vLLM Ascend Dashboard - Database Initialization")
    print("="*60 + "\n")

    try:
        # 1. 创建表
        await init_tables()

        # 2. 执行升级（除非跳过）
        if not args.no_upgrade:
            await run_upgrades()
        else:
            print("  ⏭️  Skipped upgrades (--no-upgrade)\n")

        # 3. 创建用户（除非跳过）
        if not args.no_users:
            await create_default_users()
        else:
            print("  ⏭️  Skipped user creation (--no-users)\n")

        print("="*60)
        print("  ✅ Database initialization completed!")
        print("="*60 + "\n")

    except SQLAlchemyError as e:
        logger.error(f"Database error during initialization: {e}", exc_info=True)
        print("\n" + "="*60)
        print(f"  ❌ Database initialization failed: {e}")
        print("="*60 + "\n")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Initialization failed: {e}", exc_info=True)
        print("\n" + "="*60)
        print(f"  ❌ Initialization failed: {e}")
        print("="*60 + "\n")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
