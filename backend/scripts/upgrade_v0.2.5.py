"""
vLLM Ascend Dashboard Database Upgrade Script
Version: v0.2.5
Description: Fix workflow_name case mismatch in ci_results and ci_jobs tables

Changes:
- Update ci_results.workflow_name to match workflow_configs.workflow_name
- Update ci_jobs.workflow_name to match workflow_configs.workflow_name
- This fixes the case sensitivity issue where GitHub API returns different casing
"""
import sys

from sqlalchemy import text

DESCRIPTION = "Fix workflow_name case mismatch"


async def upgrade():
    """Execute v0.2.5 upgrade"""
    import importlib

    from app.db.base import SessionLocal

    # 动态导入 upgrade_db 模块
    if 'upgrade_db' in sys.modules:
        upgrade_db = sys.modules['upgrade_db']
    else:
        upgrade_db = importlib.import_module('upgrade_db')

    check_table_exists = upgrade_db.check_table_exists

    print("  Running v0.2.5 upgrade...\n")

    async with SessionLocal() as db:
        try:
            # 检查表是否存在
            if not await check_table_exists("ci_results"):
                print("  Skipping: ci_results table does not exist\n")
                return

            if not await check_table_exists("workflow_configs"):
                print("  Skipping: workflow_configs table does not exist\n")
                return

            # 更新 ci_results 中的 workflow_name
            print("  Updating ci_results.workflow_name to match workflow_configs...")
            update_sql = """
                UPDATE ci_results 
                SET workflow_name = (
                    SELECT workflow_name FROM workflow_configs 
                    WHERE workflow_configs.workflow_file = ci_results.workflow_name
                )
                WHERE workflow_name IN (SELECT workflow_file FROM workflow_configs)
            """
            result = await db.execute(text(update_sql))
            print(f"    Updated {result.rowcount} rows in ci_results")

            # 更新 ci_jobs 中的 workflow_name
            print("  Updating ci_jobs.workflow_name to match workflow_configs...")
            update_sql = """
                UPDATE ci_jobs 
                SET workflow_name = (
                    SELECT workflow_name FROM workflow_configs 
                    WHERE workflow_configs.workflow_file = ci_jobs.workflow_name
                )
                WHERE workflow_name IN (SELECT workflow_file FROM workflow_configs)
            """
            result = await db.execute(text(update_sql))
            print(f"    Updated {result.rowcount} rows in ci_jobs")

            await db.commit()
            print("\n  ✅ v0.2.5 upgrade completed successfully\n")

        except Exception as e:
            print(f"  ❌ Error during upgrade: {e}")
            await db.rollback()
            raise
