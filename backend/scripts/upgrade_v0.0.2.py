"""
Database upgrade script v0.0.2

Changes:
1. Add composite index on daily_prs (project, data_date, created_at DESC)
2. Remove old single-column indexes (idx_daily_prs_project, idx_daily_prs_date)

DESCRIPTION: Fix MySQL "Out of sort memory" error by adding composite index
"""
import asyncio
import logging

from sqlalchemy import text, inspect

from app.db.base import SessionLocal, engine

logger = logging.getLogger(__name__)

DESCRIPTION = "Add composite index on daily_prs for optimized sorting"


def is_mysql() -> bool:
    """Check if database is MySQL"""
    dialect_name = engine.dialect.name.lower()
    return 'mysql' in dialect_name


async def check_index_exists(index_name: str, table_name: str = "daily_prs") -> bool:
    """Check if index exists (works with both MySQL and SQLite)"""
    try:
        async with engine.begin() as conn:
            def _get_indexes(connection):
                inspector = inspect(connection)
                return inspector.get_indexes(table_name)
            
            indexes = await conn.run_sync(_get_indexes)
            for idx in indexes:
                if idx['name'] == index_name:
                    return True
            return False
    except Exception as e:
        logger.warning(f"Error checking index {index_name}: {e}")
        return False


async def upgrade():
    """Run the upgrade"""
    logger.info("Starting upgrade v0.0.2...")
    print("🚀 Running upgrade v0.0.2")
    print("📝 Adding composite index on daily_prs table\n")
    
    async with SessionLocal() as db:
        try:
            # Check if composite index already exists
            if await check_index_exists("idx_daily_prs_project_date_created"):
                print("✅ Composite index already exists, skipping")
                return True
            
            # MySQL-specific operations
            if is_mysql():
                # Check and drop old single-column indexes
                if await check_index_exists("idx_daily_prs_project"):
                    print("🗑️  Dropping old index: idx_daily_prs_project")
                    await db.execute(text("DROP INDEX idx_daily_prs_project ON daily_prs"))
                
                if await check_index_exists("idx_daily_prs_date"):
                    print("🗑️  Dropping old index: idx_daily_prs_date")
                    await db.execute(text("DROP INDEX idx_daily_prs_date ON daily_prs"))
                
                # Create composite index
                print("📈 Creating composite index: idx_daily_prs_project_date_created")
                print("   Columns: (project, data_date, created_at DESC)")
                await db.execute(text("""
                    CREATE INDEX idx_daily_prs_project_date_created 
                    ON daily_prs (project, data_date, created_at DESC)
                """))
            else:
                # SQLite: indexes are created similarly but use different syntax
                print("📈 Creating composite index: idx_daily_prs_project_date_created")
                print("   Columns: (project, data_date, created_at DESC)")
                await db.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_daily_prs_project_date_created 
                    ON daily_prs (project, data_date, created_at DESC)
                """))
            
            await db.commit()
            
            # Verify
            if await check_index_exists("idx_daily_prs_project_date_created"):
                print("\n✅ Upgrade v0.0.2 completed successfully!")
                return True
            else:
                logger.error("Failed to verify index creation")
                print("\n❌ Failed to verify index creation")
                return False
                
        except Exception as e:
            await db.rollback()
            logger.error(f"Upgrade failed: {e}", exc_info=True)
            print(f"\n❌ Upgrade failed: {e}")
            import traceback
            traceback.print_exc()
            return False


async def rollback():
    """Rollback the upgrade"""
    logger.info("Rolling back upgrade v0.0.2...")
    print("🔙 Rolling back upgrade v0.0.2\n")
    
    async with SessionLocal() as db:
        try:
            # Drop composite index
            if await check_index_exists("idx_daily_prs_project_date_created"):
                print("🗑️  Dropping composite index: idx_daily_prs_project_date_created")
                if is_mysql():
                    await db.execute(text("""
                        DROP INDEX idx_daily_prs_project_date_created 
                        ON daily_prs
                    """))
                else:
                    await db.execute(text("""
                        DROP INDEX idx_daily_prs_project_date_created
                    """))
            
            # Restore old indexes (MySQL only)
            if is_mysql():
                if not await check_index_exists("idx_daily_prs_project"):
                    print("📈 Restoring index: idx_daily_prs_project")
                    await db.execute(text("CREATE INDEX idx_daily_prs_project ON daily_prs(project)"))
                
                if not await check_index_exists("idx_daily_prs_date"):
                    print("📈 Restoring index: idx_daily_prs_date")
                    await db.execute(text("CREATE INDEX idx_daily_prs_date ON daily_prs(data_date)"))
            
            await db.commit()
            
            print("\n✅ Rollback v0.0.2 completed successfully!")
            return True
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Rollback failed: {e}", exc_info=True)
            print(f"\n❌ Rollback failed: {e}")
            import traceback
            traceback.print_exc()
            return False


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "rollback":
            success = asyncio.run(rollback())
            sys.exit(0 if success else 1)
        elif sys.argv[1] == "help":
            print(f"""
Upgrade Script v0.0.2 - Add composite index on daily_prs

Usage:
    python scripts/upgrade_v0.0.2.py        # Run upgrade
    python scripts/upgrade_v0.0.2.py rollback  # Rollback upgrade
    python scripts/upgrade_v0.0.2.py help      # Show help

Description:
    Fix MySQL "Out of sort memory" error by adding composite index
    on daily_prs table for optimized sorting.
    
    Note: This upgrade is designed for MySQL but works with SQLite too.
""")
        else:
            print(f"Unknown command: {sys.argv[1]}")
            print("Use 'python scripts/upgrade_v0.0.2.py help' for usage")
            sys.exit(1)
    else:
        success = asyncio.run(upgrade())
        sys.exit(0 if success else 1)
