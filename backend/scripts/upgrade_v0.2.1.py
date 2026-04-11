"""
vLLM Ascend Dashboard Database Upgrade Script
Version: v0.2.1
Description: Add official documentation link field

Changes:
- Add official_doc_url to model_configs
"""
import sys

from sqlalchemy import text

DESCRIPTION = "Add official documentation link field (official_doc_url)"


async def upgrade():
    """Execute v0.2.1 upgrade"""
    import importlib

    from app.db.base import SessionLocal

    # 动态导入 upgrade_db 模块（兼容直接运行和模块导入）
    if 'upgrade_db' in sys.modules:
        upgrade_db = sys.modules['upgrade_db']
    else:
        upgrade_db = importlib.import_module('upgrade_db')

    check_table_exists = upgrade_db.check_table_exists
    check_column_exists = upgrade_db.check_column_exists

    print("  Running v0.2.1 upgrade...\n")

    async with SessionLocal() as db:
        try:
            # === Upgrade model_configs table ===
            print("  Upgrading model_configs table...")

            if await check_table_exists("model_configs"):
                try:
                    if not await check_column_exists("model_configs", "official_doc_url"):
                        print("    Adding column: official_doc_url")
                        # MySQL 和 SQLite 都支持 VARCHAR(500)
                        await db.execute(
                            text("ALTER TABLE model_configs ADD COLUMN official_doc_url VARCHAR(500)")
                        )
                        print("      ✅ Added official_doc_url column")
                    else:
                        print("    ✓ official_doc_url already exists")
                except Exception as e:
                    print(f"    ⚠️  Error adding official_doc_url: {e}")
            else:
                print("    ⚠️  model_configs table not found, skipping")

            # 一次性提交所有更改
            await db.commit()
            print("\n  ✅ v0.2.1 upgrade completed")

        except Exception as e:
            await db.rollback()
            print(f"\n  ❌ v0.2.1 upgrade failed: {e}")
            print("  Changes have been rolled back")
            raise
        finally:
            await db.close()
