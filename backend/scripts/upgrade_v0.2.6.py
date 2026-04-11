"""
vLLM Ascend Dashboard Database Upgrade Script
Version: v0.2.6
Description: Consolidated upgrade script for multiple schema changes

Changes:
- model_sync_configs:
  - Add branch column (default: 'main')
  - Drop runs_limit column (use global MODEL_SYNC_RUNS_LIMIT config instead)
  - Drop sync_interval_minutes column (use global config instead)
- model_reports:
  - Add dtype, features, serve_cmd, environment, tasks columns
  - Drop known_issues, github_artifact_url columns
"""
import sys

from sqlalchemy import text

DESCRIPTION = "Consolidated upgrade v0.2.6"


async def upgrade():
    """Execute v0.2.6 upgrade"""
    import importlib

    from app.db.base import SessionLocal

    # 动态导入 upgrade_db 模块
    if 'upgrade_db' in sys.modules:
        upgrade_db = sys.modules['upgrade_db']
    else:
        upgrade_db = importlib.import_module('upgrade_db')

    check_table_exists = upgrade_db.check_table_exists
    check_column_exists = upgrade_db.check_column_exists

    print("  Running v0.2.6 upgrade...\n")

    async with SessionLocal() as db:
        try:
            is_mysql = "mysql" in str(db.bind.url)

            # =====================
            # model_sync_configs changes
            # =====================
            if await check_table_exists("model_sync_configs"):
                # Add branch column (v0.2.7)
                if not await check_column_exists("model_sync_configs", "branch"):
                    print("  Adding branch column to model_sync_configs...")
                    if is_mysql:
                        alter_sql = """
                            ALTER TABLE model_sync_configs
                            ADD COLUMN branch VARCHAR(100) DEFAULT 'main'
                            COMMENT '分支名称过滤（如 "main", "zxy_fix_ci"）'
                        """
                    else:
                        alter_sql = """
                            ALTER TABLE model_sync_configs
                            ADD COLUMN branch VARCHAR(100) DEFAULT 'main'
                        """
                    await db.execute(text(alter_sql))
                    print("    ✓ Column 'branch' added successfully")
                else:
                    print("  Column 'branch' already exists, skipping...")

                # Drop runs_limit column (use global config)
                if await check_column_exists("model_sync_configs", "runs_limit"):
                    print("  Dropping runs_limit column (use global config instead)...")
                    alter_sql = "ALTER TABLE model_sync_configs DROP COLUMN runs_limit"
                    await db.execute(text(alter_sql))
                    print("    ✓ Column 'runs_limit' dropped successfully")
                else:
                    print("  Column 'runs_limit' does not exist, skipping...")

                # Drop sync_interval_minutes column (v0.2.10)
                if await check_column_exists("model_sync_configs", "sync_interval_minutes"):
                    print("  Dropping sync_interval_minutes column...")
                    alter_sql = "ALTER TABLE model_sync_configs DROP COLUMN sync_interval_minutes"
                    await db.execute(text(alter_sql))
                    print("    ✓ Column 'sync_interval_minutes' dropped successfully")
                else:
                    print("  Column 'sync_interval_minutes' does not exist, skipping...")
            else:
                print("  Skipping: model_sync_configs table does not exist\n")

            # =====================
            # model_reports changes
            # =====================
            if await check_table_exists("model_reports"):
                # Add new columns (v0.2.8)
                columns_to_add = [
                    ("dtype", "VARCHAR(50)"),
                    ("features", "JSON"),
                    ("serve_cmd", "JSON"),
                    ("environment", "JSON"),
                    ("tasks", "JSON"),
                ]

                for column_name, column_type in columns_to_add:
                    if await check_column_exists("model_reports", column_name):
                        print(f"  Column '{column_name}' already exists, skipping...")
                    else:
                        print(f"  Adding {column_name} column...")
                        if is_mysql:
                            alter_sql = f"ALTER TABLE model_reports ADD COLUMN {column_name} {column_type}"
                        else:
                            alter_sql = f"ALTER TABLE model_reports ADD COLUMN {column_name}"
                        await db.execute(text(alter_sql))
                        print(f"    ✓ Column '{column_name}' added successfully")

                # Drop deprecated columns (v0.2.9)
                columns_to_drop = ["known_issues", "github_artifact_url"]
                for column_name in columns_to_drop:
                    if await check_column_exists("model_reports", column_name):
                        print(f"  Dropping '{column_name}' column...")
                        alter_sql = f"ALTER TABLE model_reports DROP COLUMN {column_name}"
                        await db.execute(text(alter_sql))
                        print(f"    ✓ Column '{column_name}' dropped successfully")
                    else:
                        print(f"  Column '{column_name}' does not exist, skipping...")
            else:
                print("  Skipping: model_reports table does not exist\n")

            await db.commit()
            print("\n  ✅ v0.2.6 upgrade completed successfully\n")

        except Exception as e:
            print(f"  ❌ Error during upgrade: {e}")
            await db.rollback()
            raise
