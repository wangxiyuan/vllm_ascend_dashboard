"""
Database upgrade script v0.0.3

Changes:
1. Add composite index on daily_issues (project, data_date, created_at DESC)
2. Add composite index on daily_commits (project, data_date, committed_at DESC)
3. Remove old single-column indexes

DESCRIPTION: Fix MySQL "Out of sort memory" error for issues and commits queries
"""
import asyncio
import logging

from sqlalchemy import text, inspect

from app.db.base import SessionLocal, engine

logger = logging.getLogger(__name__)

DESCRIPTION = "Add composite indexes on daily_issues and daily_commits for optimized sorting"


def is_mysql() -> bool:
    """Check if database is MySQL"""
    dialect_name = engine.dialect.name.lower()
    return 'mysql' in dialect_name


async def check_index_exists(index_name: str, table_name: str) -> bool:
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
        logger.warning(f"Error checking index {index_name} on {table_name}: {e}")
        return False


async def create_composite_index(table_name: str, index_name: str, date_column: str = "data_date", sort_column: str = "created_at"):
    """Create composite index on a table"""
    async with SessionLocal() as db:
        try:
            # Check if composite index already exists
            if await check_index_exists(index_name, table_name):
                print(f"   ✅ {index_name} already exists")
                return True
            
            # MySQL-specific operations
            if is_mysql():
                # Drop old single-column indexes if they exist
                old_project_index = f"ix_{table_name}_project"
                old_date_index = f"ix_{table_name}_data_date"
                
                if await check_index_exists(old_project_index, table_name):
                    print(f"   🗑️  Dropping old index: {old_project_index}")
                    await db.execute(text(f"DROP INDEX `{old_project_index}` ON {table_name}"))
                
                if await check_index_exists(old_date_index, table_name):
                    print(f"   🗑️  Dropping old index: {old_date_index}")
                    await db.execute(text(f"DROP INDEX `{old_date_index}` ON {table_name}"))
                
                # Create composite index
                print(f"   📈 Creating composite index: {index_name}")
                print(f"      Columns: (project, {date_column}, {sort_column} DESC)")
                await db.execute(text(f"""
                    CREATE INDEX `{index_name}` 
                    ON {table_name} (project, {date_column}, {sort_column} DESC)
                """))
            else:
                # SQLite
                print(f"   📈 Creating composite index: {index_name}")
                print(f"      Columns: (project, {date_column}, {sort_column} DESC)")
                await db.execute(text(f"""
                    CREATE INDEX IF NOT EXISTS {index_name}
                    ON {table_name} (project, {date_column}, {sort_column} DESC)
                """))
            
            await db.commit()
            
            # Verify
            if await check_index_exists(index_name, table_name):
                print(f"   ✅ Index created successfully")
                return True
            else:
                logger.error(f"Failed to verify index creation: {index_name}")
                return False
                
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create index {index_name}: {e}", exc_info=True)
            print(f"   ❌ Failed: {e}")
            return False


async def upgrade():
    """Run the upgrade"""
    logger.info("Starting upgrade v0.0.3...")
    print("🚀 Running upgrade v0.0.3")
    print("📝 Adding composite indexes on daily_issues and daily_commits tables\n")
    
    success = True
    
    # Create index for daily_issues
    print("1️⃣  daily_issues table:")
    if not await create_composite_index(
        "daily_issues", 
        "idx_daily_issues_project_date_created",
        "data_date", 
        "created_at"
    ):
        success = False
    print()
    
    # Create index for daily_commits
    print("2️⃣  daily_commits table:")
    if not await create_composite_index(
        "daily_commits", 
        "idx_daily_commits_project_date_created",
        "data_date", 
        "committed_at"
    ):
        success = False
    print()
    
    if success:
        print("="*60)
        print("✅ Upgrade v0.0.3 completed successfully!")
        print("="*60)
    else:
        print("="*60)
        print("⚠️  Upgrade v0.0.3 completed with warnings")
        print("="*60)
    
    return success


async def rollback():
    """Rollback the upgrade"""
    logger.info("Rolling back upgrade v0.0.3...")
    print("🔙 Rolling back upgrade v0.0.3\n")
    
    async with SessionLocal() as db:
        try:
            # Drop composite indexes
            if is_mysql():
                print("1️⃣  Dropping idx_daily_issues_project_date_created...")
                await db.execute(text("""
                    DROP INDEX IF EXISTS `idx_daily_issues_project_date_created` 
                    ON daily_issues
                """))
                
                print("2️⃣  Dropping idx_daily_commits_project_date_created...")
                await db.execute(text("""
                    DROP INDEX IF EXISTS `idx_daily_commits_project_date_created` 
                    ON daily_commits
                """))
            else:
                print("1️⃣  Dropping idx_daily_issues_project_date_created...")
                await db.execute(text("DROP INDEX IF EXISTS idx_daily_issues_project_date_created"))
                
                print("2️⃣  Dropping idx_daily_commits_project_date_created...")
                await db.execute(text("DROP INDEX IF EXISTS idx_daily_commits_project_date_created"))
            
            await db.commit()
            
            print("\n✅ Rollback v0.0.3 completed successfully!")
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
Upgrade Script v0.0.3 - Add composite indexes on daily_issues and daily_commits

Usage:
    python scripts/upgrade_v0.0.3.py        # Run upgrade
    python scripts/upgrade_v0.0.3.py rollback  # Rollback upgrade
    python scripts/upgrade_v0.0.3.py help      # Show help

Description:
    Fix MySQL "Out of sort memory" error by adding composite indexes
    on daily_issues and daily_commits tables for optimized sorting.
    
    Indexes created:
    - daily_issues: (project, data_date, created_at DESC)
    - daily_commits: (project, data_date, committed_at DESC)
""")
        else:
            print(f"Unknown command: {sys.argv[1]}")
            print("Use 'python scripts/upgrade_v0.0.3.py help' for usage")
            sys.exit(1)
    else:
        success = asyncio.run(upgrade())
        sys.exit(0 if success else 1)
