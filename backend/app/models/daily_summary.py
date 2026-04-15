"""
每日总结数据模型
"""
from datetime import datetime, UTC
from sqlalchemy import Column, Integer, String, Text, Date, Boolean, TIMESTAMP, UniqueConstraint
from sqlalchemy.types import JSON

# 从 __init__.py 导入 Base，确保所有模型使用同一个 Base
from . import Base


class DailyPR(Base):
    """每日 PR 数据表"""
    __tablename__ = "daily_prs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project = Column(String(100), nullable=False)
    pr_number = Column(Integer, nullable=False)
    title = Column(String(500), nullable=False)
    state = Column(String(20), nullable=False)
    author = Column(String(100), nullable=False)
    created_at = Column(TIMESTAMP, nullable=False)
    merged_at = Column(TIMESTAMP)
    html_url = Column(String(500), nullable=False)
    labels = Column(JSON)
    body = Column(Text)
    commits = Column(JSON, nullable=False)
    data_date = Column(Date, nullable=False)
    fetched_at = Column(TIMESTAMP, default=lambda: datetime.now(UTC))

    __table_args__ = (
        UniqueConstraint('project', 'pr_number', 'data_date', name='uq_daily_pr_project_number_date'),
        # Composite index for queries filtering by project/data_date and sorting by created_at
        # Fixes MySQL "Out of sort memory" error
    )


class DailyIssue(Base):
    """每日 Issue 数据表"""
    __tablename__ = "daily_issues"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project = Column(String(100), nullable=False, index=True)
    issue_number = Column(Integer, nullable=False)
    title = Column(String(500), nullable=False)
    state = Column(String(20), nullable=False)
    author = Column(String(100), nullable=False)
    created_at = Column(TIMESTAMP, nullable=False)
    closed_at = Column(TIMESTAMP)
    html_url = Column(String(500), nullable=False)
    labels = Column(JSON)
    body = Column(Text)
    comments_count = Column(Integer, default=0)
    data_date = Column(Date, nullable=False, index=True)
    fetched_at = Column(TIMESTAMP, default=lambda: datetime.now(UTC))

    __table_args__ = (
        UniqueConstraint('project', 'issue_number', 'data_date', name='uq_daily_issue_project_number_date'),
    )


class DailyCommit(Base):
    """每日 Commit 数据表"""
    __tablename__ = "daily_commits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project = Column(String(100), nullable=False, index=True)
    sha = Column(String(40), nullable=False)
    short_sha = Column(String(7), nullable=False)
    message = Column(String(1000), nullable=False)
    full_message = Column(Text)
    author = Column(String(100), nullable=False)
    author_email = Column(String(200))
    committed_at = Column(TIMESTAMP, nullable=False)
    html_url = Column(String(500), nullable=False)
    pr_number = Column(Integer, index=True)
    pr_title = Column(String(500))
    pr_description = Column(Text)
    files_changed = Column(JSON)
    additions = Column(Integer, default=0)
    deletions = Column(Integer, default=0)
    data_date = Column(Date, nullable=False, index=True)
    fetched_at = Column(TIMESTAMP, default=lambda: datetime.now(UTC))

    __table_args__ = (
        UniqueConstraint('project', 'sha', 'data_date', name='uq_daily_commit_project_sha_date'),
    )


class DailySummary(Base):
    """每日 AI 总结表"""
    __tablename__ = "daily_summaries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project = Column(String(100), nullable=False, index=True)
    data_date = Column(Date, nullable=False, index=True)
    summary_markdown = Column(Text, nullable=False)
    has_data = Column(Boolean, default=True)
    pr_count = Column(Integer, default=0)
    issue_count = Column(Integer, default=0)
    commit_count = Column(Integer, default=0)
    llm_provider = Column(String(50))
    llm_model = Column(String(100))
    prompt_tokens = Column(Integer)
    completion_tokens = Column(Integer)
    generation_time_seconds = Column(Integer)
    status = Column(String(20), default='success')
    error_message = Column(Text)
    generated_at = Column(TIMESTAMP, default=lambda: datetime.now(UTC))
    regenerated_at = Column(TIMESTAMP)

    __table_args__ = (
        UniqueConstraint('project', 'data_date', name='uq_daily_summary_project_date'),
    )


class LLMProviderConfig(Base):
    """LLM 提供商配置表"""
    __tablename__ = "llm_provider_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    provider = Column(String(50), nullable=False, unique=True)
    display_name = Column(String(100), nullable=False)
    api_key = Column(String(500))  # API Key，直接存储（加密存储建议后续实现）
    api_base_url = Column(String(500))
    default_model = Column(String(100), nullable=False)
    enabled = Column(Boolean, default=True)
    is_active = Column(Boolean, default=False)  # 是否为当前激活的提供商（用于 AI 总结）
    display_order = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(UTC))
    updated_at = Column(TIMESTAMP, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
