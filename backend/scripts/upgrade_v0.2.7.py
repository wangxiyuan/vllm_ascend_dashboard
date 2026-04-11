"""
vLLM Ascend Dashboard Database Upgrade Script
Version: v0.2.7
Description: Add daily summary feature tables and LLM provider configuration

Changes:
- Create daily_prs table (每日 PR 数据)
- Create daily_issues table (每日 Issue 数据)
- Create daily_commits table (每日 Commit 数据)
- Create daily_summaries table (每日 AI 总结)
- Create llm_provider_configs table (LLM 提供商配置)
  - Includes api_key column for database-stored API keys
  - Includes is_active column for selecting active provider
- Initialize default LLM provider configs
"""
import sys

from sqlalchemy import text

DESCRIPTION = "Add daily summary tables and LLM provider configuration"


async def upgrade():
    """Execute v0.2.7 upgrade"""
    import asyncio
    import importlib

    from app.db.base import SessionLocal

    # 动态导入 upgrade_db 模块
    if 'upgrade_db' in sys.modules:
        upgrade_db = sys.modules['upgrade_db']
    else:
        upgrade_db = importlib.import_module('upgrade_db')

    check_table_exists = upgrade_db.check_table_exists
    check_column_exists = upgrade_db.check_column_exists

    print("  Running v0.2.7 upgrade...\n")

    async with SessionLocal() as db:
        try:
            is_mysql = "mysql" in str(db.bind.url)

            # =====================
            # daily_prs table
            # =====================
            if not await check_table_exists("daily_prs"):
                print("  Creating daily_prs table...")
                if is_mysql:
                    create_sql = """
                        CREATE TABLE daily_prs (
                            id INT PRIMARY KEY AUTO_INCREMENT,
                            project VARCHAR(100) NOT NULL,
                            pr_number INT NOT NULL,
                            title VARCHAR(500) NOT NULL,
                            state VARCHAR(20) NOT NULL,
                            author VARCHAR(100) NOT NULL,
                            created_at DATETIME NOT NULL,
                            merged_at DATETIME,
                            html_url VARCHAR(500) NOT NULL,
                            labels JSON,
                            body TEXT,
                            commits JSON NOT NULL,
                            data_date DATE NOT NULL,
                            fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE KEY uq_daily_pr_project_number_date (project, pr_number, data_date),
                            INDEX idx_daily_prs_project (project),
                            INDEX idx_daily_prs_date (data_date)
                        )
                    """
                    await db.execute(text(create_sql))
                else:
                    create_sql = """
                        CREATE TABLE daily_prs (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            project VARCHAR(100) NOT NULL,
                            pr_number INTEGER NOT NULL,
                            title VARCHAR(500) NOT NULL,
                            state VARCHAR(20) NOT NULL,
                            author VARCHAR(100) NOT NULL,
                            created_at TIMESTAMP NOT NULL,
                            merged_at TIMESTAMP,
                            html_url VARCHAR(500) NOT NULL,
                            labels JSON,
                            body TEXT,
                            commits JSON NOT NULL,
                            data_date DATE NOT NULL,
                            fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            CONSTRAINT uq_daily_pr_project_number_date UNIQUE (project, pr_number, data_date)
                        )
                    """
                    await db.execute(text(create_sql))
                    await db.execute(text("CREATE INDEX idx_daily_prs_project ON daily_prs(project)"))
                    await db.execute(text("CREATE INDEX idx_daily_prs_date ON daily_prs(data_date)"))
                print("    ✓ Table 'daily_prs' created successfully")
            else:
                print("  Table 'daily_prs' already exists, skipping...")

            # =====================
            # daily_issues table
            # =====================
            if not await check_table_exists("daily_issues"):
                print("  Creating daily_issues table...")
                if is_mysql:
                    create_sql = """
                        CREATE TABLE daily_issues (
                            id INT PRIMARY KEY AUTO_INCREMENT,
                            project VARCHAR(100) NOT NULL,
                            issue_number INT NOT NULL,
                            title VARCHAR(500) NOT NULL,
                            state VARCHAR(20) NOT NULL,
                            author VARCHAR(100) NOT NULL,
                            created_at DATETIME NOT NULL,
                            closed_at DATETIME,
                            html_url VARCHAR(500) NOT NULL,
                            labels JSON,
                            body TEXT,
                            comments_count INT DEFAULT 0,
                            data_date DATE NOT NULL,
                            fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE KEY uq_daily_issue_project_number_date (project, issue_number, data_date),
                            INDEX idx_daily_issues_project (project),
                            INDEX idx_daily_issues_date (data_date)
                        )
                    """
                    await db.execute(text(create_sql))
                else:
                    create_sql = """
                        CREATE TABLE daily_issues (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            project VARCHAR(100) NOT NULL,
                            issue_number INTEGER NOT NULL,
                            title VARCHAR(500) NOT NULL,
                            state VARCHAR(20) NOT NULL,
                            author VARCHAR(100) NOT NULL,
                            created_at TIMESTAMP NOT NULL,
                            closed_at TIMESTAMP,
                            html_url VARCHAR(500) NOT NULL,
                            labels JSON,
                            body TEXT,
                            comments_count INTEGER DEFAULT 0,
                            data_date DATE NOT NULL,
                            fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            CONSTRAINT uq_daily_issue_project_number_date UNIQUE (project, issue_number, data_date)
                        )
                    """
                    await db.execute(text(create_sql))
                    await db.execute(text("CREATE INDEX idx_daily_issues_project ON daily_issues(project)"))
                    await db.execute(text("CREATE INDEX idx_daily_issues_date ON daily_issues(data_date)"))
                print("    ✓ Table 'daily_issues' created successfully")
            else:
                print("  Table 'daily_issues' already exists, skipping...")

            # =====================
            # daily_commits table
            # =====================
            if not await check_table_exists("daily_commits"):
                print("  Creating daily_commits table...")
                if is_mysql:
                    create_sql = """
                        CREATE TABLE daily_commits (
                            id INT PRIMARY KEY AUTO_INCREMENT,
                            project VARCHAR(100) NOT NULL,
                            sha VARCHAR(40) NOT NULL,
                            short_sha VARCHAR(7) NOT NULL,
                            message VARCHAR(1000) NOT NULL,
                            full_message TEXT,
                            author VARCHAR(100) NOT NULL,
                            author_email VARCHAR(200),
                            committed_at DATETIME NOT NULL,
                            html_url VARCHAR(500) NOT NULL,
                            pr_number INT,
                            pr_title VARCHAR(500),
                            pr_description TEXT,
                            files_changed JSON,
                            additions INT DEFAULT 0,
                            deletions INT DEFAULT 0,
                            data_date DATE NOT NULL,
                            fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE KEY uq_daily_commit_project_sha_date (project, sha, data_date),
                            INDEX idx_daily_commits_project (project),
                            INDEX idx_daily_commits_date (data_date),
                            INDEX idx_daily_commits_pr (pr_number)
                        )
                    """
                    await db.execute(text(create_sql))
                else:
                    create_sql = """
                        CREATE TABLE daily_commits (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            project VARCHAR(100) NOT NULL,
                            sha VARCHAR(40) NOT NULL,
                            short_sha VARCHAR(7) NOT NULL,
                            message VARCHAR(1000) NOT NULL,
                            full_message TEXT,
                            author VARCHAR(100) NOT NULL,
                            author_email VARCHAR(200),
                            committed_at TIMESTAMP NOT NULL,
                            html_url VARCHAR(500) NOT NULL,
                            pr_number INTEGER,
                            pr_title VARCHAR(500),
                            pr_description TEXT,
                            files_changed JSON,
                            additions INTEGER DEFAULT 0,
                            deletions INTEGER DEFAULT 0,
                            data_date DATE NOT NULL,
                            fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            CONSTRAINT uq_daily_commit_project_sha_date UNIQUE (project, sha, data_date)
                        )
                    """
                    await db.execute(text(create_sql))
                    await db.execute(text("CREATE INDEX idx_daily_commits_project ON daily_commits(project)"))
                    await db.execute(text("CREATE INDEX idx_daily_commits_date ON daily_commits(data_date)"))
                    await db.execute(text("CREATE INDEX idx_daily_commits_pr ON daily_commits(pr_number)"))
                print("    ✓ Table 'daily_commits' created successfully")
            else:
                print("  Table 'daily_commits' already exists, skipping...")

            # =====================
            # daily_summaries table
            # =====================
            if not await check_table_exists("daily_summaries"):
                print("  Creating daily_summaries table...")
                if is_mysql:
                    create_sql = """
                        CREATE TABLE daily_summaries (
                            id INT PRIMARY KEY AUTO_INCREMENT,
                            project VARCHAR(100) NOT NULL,
                            data_date DATE NOT NULL,
                            summary_markdown TEXT NOT NULL,
                            has_data BOOLEAN DEFAULT TRUE,
                            pr_count INT DEFAULT 0,
                            issue_count INT DEFAULT 0,
                            commit_count INT DEFAULT 0,
                            llm_provider VARCHAR(50),
                            llm_model VARCHAR(100),
                            prompt_tokens INT,
                            completion_tokens INT,
                            generation_time_seconds INT,
                            status VARCHAR(20) DEFAULT 'success',
                            error_message TEXT,
                            generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            regenerated_at DATETIME,
                            UNIQUE KEY uq_daily_summary_project_date (project, data_date),
                            INDEX idx_daily_summaries_project (project),
                            INDEX idx_daily_summaries_date (data_date)
                        )
                    """
                    await db.execute(text(create_sql))
                else:
                    create_sql = """
                        CREATE TABLE daily_summaries (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            project VARCHAR(100) NOT NULL,
                            data_date DATE NOT NULL,
                            summary_markdown TEXT NOT NULL,
                            has_data BOOLEAN DEFAULT 1,
                            pr_count INTEGER DEFAULT 0,
                            issue_count INTEGER DEFAULT 0,
                            commit_count INTEGER DEFAULT 0,
                            llm_provider VARCHAR(50),
                            llm_model VARCHAR(100),
                            prompt_tokens INTEGER,
                            completion_tokens INTEGER,
                            generation_time_seconds INTEGER,
                            status VARCHAR(20) DEFAULT 'success',
                            error_message TEXT,
                            generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            regenerated_at TIMESTAMP,
                            CONSTRAINT uq_daily_summary_project_date UNIQUE (project, data_date)
                        )
                    """
                    await db.execute(text(create_sql))
                    await db.execute(text("CREATE INDEX idx_daily_summaries_project ON daily_summaries(project)"))
                    await db.execute(text("CREATE INDEX idx_daily_summaries_date ON daily_summaries(data_date)"))
                print("    ✓ Table 'daily_summaries' created successfully")
            else:
                print("  Table 'daily_summaries' already exists, skipping...")

            # =====================
            # llm_provider_configs table
            # =====================
            if not await check_table_exists("llm_provider_configs"):
                print("  Creating llm_provider_configs table...")
                if is_mysql:
                    create_sql = """
                        CREATE TABLE llm_provider_configs (
                            id INT PRIMARY KEY AUTO_INCREMENT,
                            provider VARCHAR(50) NOT NULL UNIQUE,
                            display_name VARCHAR(100) NOT NULL,
                            api_key VARCHAR(500),
                            api_base_url VARCHAR(500),
                            default_model VARCHAR(100) NOT NULL,
                            enabled BOOLEAN DEFAULT TRUE,
                            is_active BOOLEAN DEFAULT FALSE,
                            display_order INT DEFAULT 0,
                            config_json JSON,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                        )
                    """
                    await db.execute(text(create_sql))
                    print("    ✓ Table 'llm_provider_configs' created successfully")

                    # 初始化默认配置
                    print("  Initializing default LLM provider configs...")
                    insert_sql = """
                        INSERT INTO llm_provider_configs
                        (provider, display_name, api_base_url, default_model, enabled, is_active, display_order)
                        VALUES
                        ('openai', 'OpenAI GPT-4', 'https://api.openai.com/v1', 'gpt-4o', 1, 0, 1),
                        ('anthropic', 'Anthropic Claude', 'https://api.anthropic.com', 'claude-sonnet-4-20250514', 1, 0, 2),
                        ('qwen', '通义千问', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'qwen-plus', 1, 0, 3)
                    """
                    await db.execute(text(insert_sql))
                    print("    ✓ Default LLM providers initialized")
                else:
                    create_sql = """
                        CREATE TABLE llm_provider_configs (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            provider VARCHAR(50) NOT NULL UNIQUE,
                            display_name VARCHAR(100) NOT NULL,
                            api_key VARCHAR(500),
                            api_base_url VARCHAR(500),
                            default_model VARCHAR(100) NOT NULL,
                            enabled BOOLEAN DEFAULT 1,
                            is_active BOOLEAN DEFAULT 0,
                            display_order INTEGER DEFAULT 0,
                            config_json JSON,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """
                    await db.execute(text(create_sql))
                    print("    ✓ Table 'llm_provider_configs' created successfully")

                    # 初始化默认配置
                    print("  Initializing default LLM provider configs...")
                    insert_sql = """
                        INSERT INTO llm_provider_configs
                        (provider, display_name, api_base_url, default_model, enabled, is_active, display_order)
                        VALUES
                        ('openai', 'OpenAI GPT-4', 'https://api.openai.com/v1', 'gpt-4o', 1, 0, 1),
                        ('anthropic', 'Anthropic Claude', 'https://api.anthropic.com', 'claude-sonnet-4-20250514', 1, 0, 2),
                        ('qwen', '通义千问', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'qwen-plus', 1, 0, 3)
                    """
                    await db.execute(text(insert_sql))
                    print("    ✓ Default LLM providers initialized")
            else:
                print("  Table 'llm_provider_configs' already exists, skipping...")
                
                # 检查是否需要添加 api_key 和 is_active 列（从旧版本升级）
                if not await check_column_exists("llm_provider_configs", "api_key"):
                    print("  Adding api_key column...")
                    if is_mysql:
                        await db.execute(text("ALTER TABLE llm_provider_configs ADD COLUMN api_key VARCHAR(500)"))
                    else:
                        await db.execute(text("ALTER TABLE llm_provider_configs ADD COLUMN api_key VARCHAR(500)"))
                    print("    ✓ Column 'api_key' added successfully")

                if not await check_column_exists("llm_provider_configs", "is_active"):
                    print("  Adding is_active column...")
                    if is_mysql:
                        await db.execute(text("ALTER TABLE llm_provider_configs ADD COLUMN is_active BOOLEAN DEFAULT FALSE"))
                    else:
                        await db.execute(text("ALTER TABLE llm_provider_configs ADD COLUMN is_active BOOLEAN DEFAULT 0"))
                    print("    ✓ Column 'is_active' added successfully")

                # 设置第一个启用的提供商为激活状态（如果还没有激活的）
                result = await db.execute(text("SELECT provider FROM llm_provider_configs WHERE is_active = 1 LIMIT 1"))
                active_provider = result.fetchone()
                if not active_provider:
                    result = await db.execute(text("SELECT provider FROM llm_provider_configs WHERE enabled = 1 ORDER BY display_order LIMIT 1"))
                    first_provider = result.fetchone()
                    if first_provider:
                        await db.execute(text(f"UPDATE llm_provider_configs SET is_active = 1 WHERE provider = '{first_provider[0]}'"))
                        print(f"    ✓ Set '{first_provider[0]}' as the active LLM provider")

            await db.commit()
            print("\n  ✅ v0.2.7 upgrade completed successfully\n")

        except Exception as e:
            print(f"  ❌ Error during upgrade: {e}")
            await db.rollback()
            raise


async def downgrade():
    """Execute v0.2.7 downgrade"""
    from app.db.base import SessionLocal

    print("  Running v0.2.7 downgrade...\n")

    async with SessionLocal() as db:
        try:
            is_mysql = "mysql" in str(db.bind.url)

            # Drop tables in reverse order
            tables_to_drop = ["llm_provider_configs", "daily_summaries", "daily_commits", "daily_issues", "daily_prs"]
            
            for table_name in tables_to_drop:
                print(f"  Dropping {table_name} table...")
                if is_mysql:
                    await db.execute(text(f"DROP TABLE IF EXISTS {table_name}"))
                else:
                    await db.execute(text(f"DROP TABLE IF EXISTS {table_name}"))
                print(f"    ✓ Table '{table_name}' dropped")

            await db.commit()
            print("\n  ✅ v0.2.7 downgrade completed successfully\n")

        except Exception as e:
            print(f"  ❌ Error during downgrade: {e}")
            await db.rollback()
            raise
