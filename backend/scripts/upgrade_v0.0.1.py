"""
Database upgrade script v0.0.1

Changes:
1. Merge JobVisibility table into JobOwner table (add is_hidden field to JobOwner)
2. Remove LLMProviderConfig.config_json column

DESCRIPTION: Merge JobVisibility and cleanup unused config_json column
"""
import asyncio
import logging
from datetime import datetime

from sqlalchemy import text, select, inspect

from app.db.base import SessionLocal, engine

logger = logging.getLogger(__name__)

DESCRIPTION = "Merge JobVisibility into JobOwner and remove unused config_json column"


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
    Execute database upgrade to v0.0.1
    
    Changes:
    1. Add is_hidden column to job_owners table (if not exists)
    2. Migrate JobVisibility data to JobOwner
    3. Drop job_visibility table
    4. Drop config_json column from llm_provider_configs
    
    Compatibility:
    - Works with databases from v0.2.0 to v0.2.7
    - For new databases (v0.0.0), tables are already created with latest schema
    """
    print("\n" + "="*60)
    print("  Starting upgrade to v0.0.1")
    print("="*60 + "\n")
    
    is_mysql = "mysql" in str(engine.url)
    
    async with SessionLocal() as db:
        try:
            # ============================================
            # Step 1: Add is_hidden column to job_owners
            # ============================================
            print("Step 1: Checking/Adding is_hidden column to job_owners table...")
            
            if not await check_column_exists("job_owners", "is_hidden"):
                if is_mysql:
                    await db.execute(text(
                        "ALTER TABLE job_owners ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE"
                    ))
                else:
                    await db.execute(text(
                        "ALTER TABLE job_owners ADD COLUMN is_hidden BOOLEAN DEFAULT 0"
                    ))
                print("  ✅ Added is_hidden column to job_owners")
            else:
                print("  ✓ is_hidden column already exists in job_owners")
            
            await db.commit()
            
            # ============================================
            # Step 2: Migrate JobVisibility data to JobOwner
            # ============================================
            print("\nStep 2: Migrating JobVisibility data to JobOwner...")
            
            if await check_table_exists("job_visibility"):
                # Get all hidden jobs from job_visibility
                result = await db.execute(text(
                    "SELECT workflow_name, job_name FROM job_visibility WHERE is_hidden = TRUE"
                ))
                hidden_jobs = result.fetchall()
                
                migrated_count = 0
                for workflow_name, job_name in hidden_jobs:
                    # Check if job already has an owner
                    owner_result = await db.execute(text(
                        "SELECT id FROM job_owners WHERE workflow_name = :wf AND job_name = :jn"
                    ), {"wf": workflow_name, "jn": job_name})
                    existing_owner = owner_result.fetchone()
                    
                    if not existing_owner:
                        # Create new JobOwner entry with is_hidden=TRUE
                        await db.execute(text(
                            """INSERT INTO job_owners 
                               (workflow_name, job_name, owner, is_hidden, created_at, updated_at) 
                               VALUES (:wf, :jn, '_system_hidden', 1, :created, :updated)"""
                        ), {
                            "wf": workflow_name,
                            "jn": job_name,
                            "created": datetime.now(),
                            "updated": datetime.now()
                        })
                        migrated_count += 1
                    else:
                        # Update existing JobOwner to set is_hidden=TRUE
                        await db.execute(text(
                            "UPDATE job_owners SET is_hidden = 1 WHERE workflow_name = :wf AND job_name = :jn"
                        ), {"wf": workflow_name, "jn": job_name})
                        migrated_count += 1
                
                print(f"  ✅ Migrated {migrated_count} JobVisibility records to JobOwner")
            else:
                print("  ✓ job_visibility table does not exist, skipping migration")
            
            await db.commit()
            
            # ============================================
            # Step 3: Drop job_visibility table
            # ============================================
            print("\nStep 3: Dropping job_visibility table...")
            
            if await check_table_exists("job_visibility"):
                await db.execute(text("DROP TABLE job_visibility"))
                print("  ✅ Dropped job_visibility table")
            else:
                print("  ✓ job_visibility table does not exist")
            
            await db.commit()
            
            # ============================================
            # Step 4: Drop config_json column from llm_provider_configs
            # ============================================
            print("\nStep 4: Checking/Dropping config_json column from llm_provider_configs...")
            
            if await check_column_exists("llm_provider_configs", "config_json"):
                if is_mysql:
                    await db.execute(text(
                        "ALTER TABLE llm_provider_configs DROP COLUMN config_json"
                    ))
                else:
                    await db.execute(text(
                        "ALTER TABLE llm_provider_configs DROP COLUMN config_json"
                    ))
                print("  ✅ Dropped config_json column from llm_provider_configs")
            else:
                print("  ✓ config_json column does not exist in llm_provider_configs")
            
            await db.commit()

            # ============================================
            # Step 5: Record version in database_versions
            # ============================================
            print("Step 5: Recording version in database_versions...")
            
            # Check if v0.0.1 already exists
            result = await db.execute(text(
                "SELECT COUNT(*) FROM database_versions WHERE version = '0.0.1'"
            ))
            count = result.scalar()
            
            if count == 0:
                await db.execute(text(
                    """INSERT INTO database_versions (version, description, applied_at) 
                       VALUES ('0.0.1', :description, :applied_at)"""
                ), {
                    "description": "Merge JobVisibility into JobOwner and remove unused config_json column",
                    "applied_at": datetime.now()
                })
                await db.commit()
                print("  ✅ Version v0.0.1 recorded in database_versions")
            else:
                print("  ✓ Version v0.0.1 already exists in database_versions")

            print("\n" + "="*60)
            print("  ✅ Upgrade to v0.0.1 completed successfully!")
            print("="*60 + "\n")
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Upgrade failed: {e}", exc_info=True)
            print(f"\n  ❌ Upgrade failed: {e}")
            print("  Please check the logs for details")
            raise


if __name__ == "__main__":
    asyncio.run(upgrade())
