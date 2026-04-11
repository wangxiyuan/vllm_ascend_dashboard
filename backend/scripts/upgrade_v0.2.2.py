"""
vLLM Ascend Dashboard Database Upgrade Script
Version: v0.2.2
Description: Add workflow sync tracking fields

Changes:
- Add last_sync_at to workflow_configs for tracking sync status
- Optimize CI sync to use GitHub API created parameter for incremental sync
"""
import sys

from sqlalchemy import text

DESCRIPTION = "Add workflow sync tracking field (last_sync_at)"


async def upgrade():
    """Execute v0.2.2 upgrade"""
    import importlib

    from app.db.base import SessionLocal

    # 动态导入 upgrade_db 模块（兼容直接运行和模块导入）
    if 'upgrade_db' in sys.modules:
        upgrade_db = sys.modules['upgrade_db']
    else:
        upgrade_db = importlib.import_module('upgrade_db')

    check_table_exists = upgrade_db.check_table_exists
    check_column_exists = upgrade_db.check_column_exists

    print("  Running v0.2.2 upgrade...\n")

    async with SessionLocal() as db:
        try:
            # === Upgrade workflow_configs table ===
            print("  Upgrading workflow_configs table...")

            if await check_table_exists("workflow_configs"):
                try:
                    if not await check_column_exists("workflow_configs", "last_sync_at"):
                        print("    Adding column: last_sync_at")
                        # MySQL 和 SQLite 都支持 TIMESTAMP
                        await db.execute(
                            text("ALTER TABLE workflow_configs ADD COLUMN last_sync_at TIMESTAMP")
                        )
                        print("      ✅ Added last_sync_at column")
                    else:
                        print("    ✓ last_sync_at already exists")
                except Exception as e:
                    print(f"    ⚠️  Error adding last_sync_at: {e}")
            else:
                print("    ⚠️  workflow_configs table not found, skipping")

            # 一次性提交所有更改
            await db.commit()
            print("\n  ✅ v0.2.2 upgrade completed")

        except Exception as e:
            await db.rollback()
            print(f"\n  ❌ v0.2.2 upgrade failed: {e}")
            print("  Changes have been rolled back")
            raise
        finally:
            await db.close()
