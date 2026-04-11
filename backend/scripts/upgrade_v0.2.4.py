"""
vLLM Ascend Dashboard Database Upgrade Script
Version: v0.2.4
Description: Add missing columns to ci_results table

Changes:
- Add run_number column to ci_results table (workflow run 编号)
- Add event column to ci_results table (workflow event type)
- Add branch column to ci_results table (branch name)
- Add head_sha column to ci_results table (commit sha)
"""
import sys

from sqlalchemy import text

DESCRIPTION = "Add missing columns to ci_results table"


async def upgrade():
    """Execute v0.2.4 upgrade"""
    import importlib

    from app.db.base import SessionLocal

    # 动态导入 upgrade_db 模块
    if 'upgrade_db' in sys.modules:
        upgrade_db = sys.modules['upgrade_db']
    else:
        upgrade_db = importlib.import_module('upgrade_db')

    check_column_exists = upgrade_db.check_column_exists

    print("  Running v0.2.4 upgrade...\n")

    async with SessionLocal() as db:
        try:
            # === Add run_number column ===
            print("  Adding run_number column to ci_results...")
            if not await check_column_exists("ci_results", "run_number"):
                await db.execute(text("ALTER TABLE ci_results ADD COLUMN run_number INTEGER"))
                print("    ✓ Added run_number column")
            else:
                print("    ✓ run_number column already exists")

            # === Add event column ===
            print("  Adding event column to ci_results...")
            if not await check_column_exists("ci_results", "event"):
                await db.execute(text("ALTER TABLE ci_results ADD COLUMN event VARCHAR(50)"))
                print("    ✓ Added event column")
            else:
                print("    ✓ event column already exists")

            # === Add branch column ===
            print("  Adding branch column to ci_results...")
            if not await check_column_exists("ci_results", "branch"):
                await db.execute(text("ALTER TABLE ci_results ADD COLUMN branch VARCHAR(100)"))
                print("    ✓ Added branch column")
            else:
                print("    ✓ branch column already exists")

            # === Add head_sha column ===
            print("  Adding head_sha column to ci_results...")
            if not await check_column_exists("ci_results", "head_sha"):
                await db.execute(text("ALTER TABLE ci_results ADD COLUMN head_sha VARCHAR(100)"))
                print("    ✓ Added head_sha column")
            else:
                print("    ✓ head_sha column already exists")

            print("\n  ✅ v0.2.4 upgrade completed successfully\n")

        except Exception as e:
            print(f"  ❌ Error during upgrade: {e}")
            raise
