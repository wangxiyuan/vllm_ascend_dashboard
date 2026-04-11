"""
vLLM Ascend Dashboard Database Upgrade Script
Version: v0.2.0
Description: Add model board management features

Changes:
- Add key_metrics_config, pass_threshold, startup_commands to model_configs
- Add report_markdown, auto_pass_fail, manual_override, vllm_version, hardware to model_reports
- Create model_sync_configs table
"""
import sys

from sqlalchemy import text

DESCRIPTION = "Add model board management features (model_configs, model_reports, model_sync_configs)"


async def upgrade():
    """Execute v0.2.0 upgrade"""
    import importlib

    from app.db.base import SessionLocal, engine

    # 动态导入 upgrade_db 模块（兼容直接运行和模块导入）
    if 'upgrade_db' in sys.modules:
        upgrade_db = sys.modules['upgrade_db']
    else:
        upgrade_db = importlib.import_module('upgrade_db')

    check_table_exists = upgrade_db.check_table_exists
    check_column_exists = upgrade_db.check_column_exists

    # 检测数据库类型
    is_mysql = "mysql" in str(engine.url)

    print("  Running v0.2.0 upgrade...\n")

    async with SessionLocal() as db:
        try:
            # === Upgrade model_configs table ===
            print("  Upgrading model_configs table...")

            if await check_table_exists("model_configs"):
                columns_to_add = [
                    ("key_metrics_config", "TEXT"),
                    ("pass_threshold", "TEXT"),
                    ("startup_commands", "TEXT"),
                ]

                for col_name, col_type in columns_to_add:
                    try:
                        if not await check_column_exists("model_configs", col_name):
                            print(f"    Adding column: {col_name}")
                            await db.execute(
                                text(f"ALTER TABLE model_configs ADD COLUMN {col_name} {col_type}")
                            )
                            print("      ✅ Added")
                        else:
                            print(f"    ✓ {col_name} already exists")
                    except Exception as e:
                        print(f"    ⚠️  Error adding {col_name}: {e}")
            else:
                print("    ⚠️  model_configs table not found, skipping")

            # === Upgrade model_reports table ===
            print("\n  Upgrading model_reports table...")

            if await check_table_exists("model_reports"):
                # MySQL 使用 TINYINT(1)，SQLite 使用 INTEGER
                manual_override_type = "TINYINT(1) DEFAULT 0" if is_mysql else "INTEGER DEFAULT 0"

                columns_to_add = [
                    ("report_markdown", "TEXT"),
                    ("auto_pass_fail", "VARCHAR(10)"),
                    ("manual_override", manual_override_type),
                    ("vllm_version", "VARCHAR(50)"),
                    ("hardware", "VARCHAR(20)"),
                ]

                for col_name, col_type in columns_to_add:
                    try:
                        if not await check_column_exists("model_reports", col_name):
                            print(f"    Adding column: {col_name}")
                            await db.execute(
                                text(f"ALTER TABLE model_reports ADD COLUMN {col_name} {col_type}")
                            )
                            print("      ✅ Added")
                        else:
                            print(f"    ✓ {col_name} already exists")
                    except Exception as e:
                        print(f"    ⚠️  Error adding {col_name}: {e}")
            else:
                print("    ⚠️  model_reports table not found, skipping")

            # === Create model_sync_configs table ===
            print("\n  Creating model_sync_configs table...")

            if not await check_table_exists("model_sync_configs"):
                if is_mysql:
                    # MySQL: 使用 DATETIME，在表定义内创建索引
                    create_sql = """
                    CREATE TABLE model_sync_configs (
                        id INT PRIMARY KEY AUTO_INCREMENT,
                        workflow_name VARCHAR(100) NOT NULL,
                        workflow_file VARCHAR(100) NOT NULL UNIQUE,
                        artifacts_pattern VARCHAR(200),
                        file_patterns TEXT,
                        enabled TINYINT(1) DEFAULT 1,
                        sync_interval_minutes INTEGER DEFAULT 10,
                        last_sync_at DATETIME DEFAULT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_workflow_name (workflow_name)
                    )
                    """
                else:
                    # SQLite: 使用 TIMESTAMP，索引单独创建
                    create_sql = """
                    CREATE TABLE model_sync_configs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        workflow_name VARCHAR(100) NOT NULL,
                        workflow_file VARCHAR(100) NOT NULL UNIQUE,
                        artifacts_pattern VARCHAR(200),
                        file_patterns TEXT,
                        enabled TINYINT(1) DEFAULT 1,
                        sync_interval_minutes INTEGER DEFAULT 10,
                        last_sync_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                    """

                await db.execute(text(create_sql))

                # 单独创建索引（MySQL 和 SQLite 都支持）
                # 注意：MySQL 可能不支持 IF NOT EXISTS，忽略已存在索引的错误
                create_index_sql = """
                CREATE INDEX IF NOT EXISTS idx_model_sync_configs_workflow_name
                ON model_sync_configs(workflow_name)
                """
                try:
                    await db.execute(text(create_index_sql))
                except Exception as index_error:
                    # 忽略已存在索引的错误
                    if "Duplicate key" not in str(index_error) and "1061" not in str(index_error):
                        raise

                print("    ✅ Created model_sync_configs table")
            else:
                print("    ✓ model_sync_configs table already exists")

            # 一次性提交所有更改
            await db.commit()
            print("\n  ✅ v0.2.0 upgrade completed")

        except Exception as e:
            await db.rollback()
            print(f"\n  ❌ v0.2.0 upgrade failed: {e}")
            print("  Changes have been rolled back")
            raise
        finally:
            await db.close()
