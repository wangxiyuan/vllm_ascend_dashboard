"""
vLLM Ascend Dashboard Database Upgrade Script
Version: v0.2.3
Description: Add GitHub activity cache table

Changes:
- Add github_cache table for caching GitHub API responses
- Cache reduces GitHub API calls and improves response time
"""
import sys

from sqlalchemy import text

DESCRIPTION = "Add GitHub activity cache table"


async def upgrade():
    """Execute v0.2.3 upgrade"""
    import importlib

    from app.db.base import SessionLocal

    # 动态导入 upgrade_db 模块
    if 'upgrade_db' in sys.modules:
        upgrade_db = sys.modules['upgrade_db']
    else:
        upgrade_db = importlib.import_module('upgrade_db')

    check_table_exists = upgrade_db.check_table_exists

    print("  Running v0.2.3 upgrade...\n")

    async with SessionLocal() as db:
        try:
            # === Create github_cache table ===
            print("  Creating github_cache table...")

            if not await check_table_exists("github_cache"):
                print("    Creating table: github_cache")

                # SQLite 建表语句
                create_table_sql = """
                    CREATE TABLE github_cache (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        owner VARCHAR(100) NOT NULL,
                        repo VARCHAR(100) NOT NULL,
                        data_type VARCHAR(50) NOT NULL,
                        days INTEGER DEFAULT 1,
                        cache_data JSON NOT NULL,
                        cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP NOT NULL,
                        UNIQUE(owner, repo, data_type, days)
                    )
                """

                await db.execute(text(create_table_sql))
                print("      ✓ Created table 'github_cache'")

                # 创建索引
                print("    Creating indexes...")

                indexes = [
                    ("idx_github_cache_owner", "owner"),
                    ("idx_github_cache_repo", "repo"),
                    ("idx_github_cache_data_type", "data_type"),
                    ("idx_github_cache_cached_at", "cached_at"),
                    ("idx_github_cache_expires_at", "expires_at"),
                ]

                for index_name, column in indexes:
                    try:
                        await db.execute(
                            text(f"CREATE INDEX {index_name} ON github_cache({column})")
                        )
                        print(f"      ✓ Created index '{index_name}'")
                    except Exception as e:
                        # 索引可能已存在
                        print(f"      ⚠️  Index '{index_name}' may already exist: {e}")

                print("  ✓ github_cache table created successfully\n")
            else:
                print("  ✓ github_cache table already exists\n")

        except Exception as e:
            print(f"  ❌ Error during upgrade: {e}")
            raise

    print("  ✅ v0.2.3 upgrade completed successfully\n")
