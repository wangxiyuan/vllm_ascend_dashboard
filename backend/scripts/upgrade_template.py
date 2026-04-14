"""
Database upgrade script template vX.Y.Z

Copy this file and rename to upgrade_vX.Y.Z.py (e.g., upgrade_v0.0.2.py)
Then implement your upgrade logic in the upgrade() function.

DESCRIPTION: Brief description of what this upgrade does
"""
import asyncio
import logging
from datetime import datetime

from sqlalchemy import text, select, inspect

from app.db.base import SessionLocal, engine

logger = logging.getLogger(__name__)

# Required: Description of what this upgrade does
DESCRIPTION = "Description of upgrade changes"


async def check_table_exists(table_name: str) -> bool:
    """Check if table exists"""
    try:
        def _get_table_names(conn):
            inspector = inspect(conn)
            return inspector.get_table_names()

        async with engine.begin() as conn:
            table_names = await conn.run_sync(_get_table_names)
            return table_name in table_names
    except Exception:
        return False


async def check_column_exists(table_name: str, column_name: str) -> bool:
    """Check if column exists"""
    try:
        def _get_columns(conn):
            inspector = inspect(conn)
            return [col['name'] for col in inspector.get_columns(table_name)]

        async with engine.begin() as conn:
            columns = await conn.run_sync(_get_columns)
            return column_name in columns
    except Exception:
        return False


async def upgrade():
    """
    Execute database upgrade to vX.Y.Z
    
    Changes:
    1. Describe change 1
    2. Describe change 2
    3. etc.
    
    Compatibility:
    - Works with databases from previous versions
    - Idempotent: safe to run multiple times
    """
    print("\n" + "="*60)
    print(f"  Starting upgrade to vX.Y.Z")
    print("="*60 + "\n")
    
    is_mysql = "mysql" in str(engine.url)
    
    async with SessionLocal() as db:
        try:
            # ============================================
            # Step 1: Your upgrade logic here
            # ============================================
            print("Step 1: Doing upgrade step 1...")
            
            # Example: Add a column
            # if not await check_column_exists("table_name", "column_name"):
            #     if is_mysql:
            #         await db.execute(text(
            #             "ALTER TABLE table_name ADD COLUMN column_name TYPE DEFAULT value"
            #         ))
            #     else:
            #         await db.execute(text(
            #             "ALTER TABLE table_name ADD COLUMN column_name TYPE DEFAULT value"
            #         ))
            #     print("  ✅ Added column")
            # else:
            #     print("  ✓ Column already exists")
            
            await db.commit()
            
            # ============================================
            # Step 2: More upgrade logic
            # ============================================
            print("Step 2: Doing upgrade step 2...")
            
            # Example: Drop a table
            # if await check_table_exists("old_table"):
            #     await db.execute(text("DROP TABLE old_table"))
            #     print("  ✅ Dropped old_table")
            # else:
            #     print("  ✓ old_table does not exist")
            
            await db.commit()
            
            # ============================================
            # Step 3: Record version in database_versions
            # ============================================
            print("Step 3: Recording version in database_versions...")
            
            # Check if version already exists
            result = await db.execute(text(
                "SELECT COUNT(*) FROM database_versions WHERE version = 'X.Y.Z'"
            ))
            count = result.scalar()
            
            if count == 0:
                await db.execute(text(
                    """INSERT INTO database_versions (version, description, applied_at) 
                       VALUES ('X.Y.Z', :description, :applied_at)"""
                ), {
                    "description": DESCRIPTION,
                    "applied_at": datetime.now()
                })
                await db.commit()
                print(f"  ✅ Version vX.Y.Z recorded in database_versions")
            else:
                print(f"  ✓ Version vX.Y.Z already exists in database_versions")

            print("\n" + "="*60)
            print(f"  ✅ Upgrade to vX.Y.Z completed successfully!")
            print("="*60 + "\n")
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Upgrade failed: {e}", exc_info=True)
            print(f"\n  ❌ Upgrade failed: {e}")
            print("  Please check the logs for details")
            raise


if __name__ == "__main__":
    asyncio.run(upgrade())
