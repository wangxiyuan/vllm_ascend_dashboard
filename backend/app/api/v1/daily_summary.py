"""
每日总结 API 路由
"""
import logging
from datetime import datetime, timedelta, date as DateType, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_active_super_admin_user, get_db
from app.models import User
from app.models.daily_summary import DailySummary
from app.schemas.daily_summary import (
    GenerateSummaryRequest, FetchDataRequest,
    DailySummaryResponse, DailySummaryListResponse, DailySummaryListItem,
    FetchDataResponse, GenerateSummaryResponse,
)
from app.services.daily_summary import DailySummaryService

logger = logging.getLogger(__name__)


def format_datetime_utc(dt: datetime | None) -> str | None:
    """
    格式化 datetime 为 ISO 格式，确保带 UTC 时区标识
    
    如果 datetime 不带时区信息，假设为 UTC 时间并添加 +00:00 标识
    """
    if dt is None:
        return None
    
    # 如果 datetime 不带时区信息，假设为 UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    
    return dt.isoformat()

router = APIRouter(prefix="/daily-summary", tags=["每日总结"])


@router.post("/generate", response_model=GenerateSummaryResponse)
async def generate_daily_summary(
    request_data: GenerateSummaryRequest,
    current_user: Annotated[User, Depends(get_current_active_super_admin_user)],
    db: AsyncSession = Depends(get_db)
):
    """
    手动触发生成每日总结

    需要超级管理员权限（super_admin）
    """
    try:
        # 解析日期
        if request_data.date:
            summary_date = DateType.fromisoformat(request_data.date)
        else:
            # 默认为昨天
            summary_date = DateType.today() - timedelta(days=1)

        # 验证日期不能是未来
        if summary_date > DateType.today():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="日期不能是未来时间"
            )

        service = DailySummaryService(db)
        result = await service.generate_summary(
            project=request_data.project,
            summary_date=summary_date,
            llm_provider=request_data.llm_provider,
            force_regenerate=request_data.force_regenerate,
        )

        return {
            "success": True,
            "message": "总结生成成功",
            "data": {
                "project": result.project,
                "date": result.date.isoformat(),
                "pr_count": result.pr_count,
                "issue_count": result.issue_count,
                "commit_count": result.commit_count,
                "generation_time_seconds": result.generation_time_seconds,
            }
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to generate daily summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成总结失败：{str(e)}"
        )


@router.post("/fetch-data", response_model=FetchDataResponse)
async def fetch_daily_data(
    request_data: FetchDataRequest,
    current_user: Annotated[User, Depends(get_current_active_super_admin_user)],
    db: AsyncSession = Depends(get_db)
):
    """
    手动触发采集每日数据

    需要超级管理员权限（super_admin）
    """
    try:
        fetch_date = DateType.fromisoformat(request_data.date)

        # 验证日期不能是未来
        if fetch_date > DateType.today():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="日期不能是未来时间"
            )

        service = DailySummaryService(db)
        result = await service.fetch_daily_data(
            project=request_data.project,
            fetch_date=fetch_date,
            force_refresh=request_data.force_refresh,
        )

        return {
            "success": True,
            "message": "数据采集成功" if not request_data.force_refresh else "数据已重新采集",
            "data": {
                "pr_count": len(result.prs),
                "issue_count": len(result.issues),
                "commit_count": len(result.commits),
            }
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to fetch daily data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"数据采集失败：{str(e)}"
        )


@router.post("/refresh-status", response_model=FetchDataResponse)
async def refresh_daily_status(
    request_data: FetchDataRequest,
    current_user: Annotated[User, Depends(get_current_active_super_admin_user)],
    db: AsyncSession = Depends(get_db)
):
    """
    刷新指定日期已采集数据的 PR 和 Issue 状态

    需要超级管理员权限（super_admin）

    仅更新已有 PR 和 Issue 的状态（如 open/closed/merged），不采集新数据
    """
    try:
        fetch_date = DateType.fromisoformat(request_data.date)

        # 验证日期不能是未来
        if fetch_date > DateType.today():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="日期不能是未来时间"
            )

        service = DailySummaryService(db)
        pr_count, issue_count = await service.refresh_pr_issue_status(
            project=request_data.project,
            fetch_date=fetch_date,
        )

        return {
            "success": True,
            "message": f"已刷新 {pr_count} 个 PR 和 {issue_count} 个 Issue 的状态",
            "data": {
                "pr_count": pr_count,
                "issue_count": issue_count,
                "commit_count": 0,
            }
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to refresh status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"刷新状态失败：{str(e)}"
        )


@router.get("/{project}/list", response_model=DailySummaryListResponse)
async def list_daily_summaries(
    project: str,
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """
    获取每日总结列表

    所有登录用户可访问
    """
    try:
        # 获取总数
        count_stmt = select(func.count(DailySummary.id)).where(
            DailySummary.project == project
        )
        total_result = await db.execute(count_stmt)
        total = total_result.scalar() or 0

        # 获取数据
        stmt = select(DailySummary).where(
            DailySummary.project == project
        ).order_by(DailySummary.data_date.desc()).offset(offset).limit(limit)

        result = await db.execute(stmt)
        summaries = result.scalars().all()

        return {
            "total": total,
            "data": [
                DailySummaryListItem(
                    date=s.data_date.isoformat(),
                    project=s.project,
                    pr_count=s.pr_count,
                    issue_count=s.issue_count,
                    commit_count=s.commit_count,
                    has_data=s.has_data,
                    generated_at=format_datetime_utc(s.generated_at),
                )
                for s in summaries
            ],
        }
    except Exception as e:
        logger.error(f"Failed to list daily summaries: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取列表失败：{str(e)}"
        )


@router.post("/{project}/{date}/regenerate", response_model=GenerateSummaryResponse)
async def regenerate_daily_summary(
    project: str,
    date: str,
    current_user: Annotated[User, Depends(get_current_active_super_admin_user)],
    llm_provider: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    重新生成指定日期的每日总结

    需要超级管理员权限（super_admin）
    """
    try:
        summary_date = DateType.fromisoformat(date)

        service = DailySummaryService(db)
        result = await service.generate_summary(
            project=project,
            summary_date=summary_date,
            llm_provider=llm_provider,
            force_regenerate=True,
        )

        return {
            "success": True,
            "message": "总结重新生成成功",
            "data": {
                "project": result.project,
                "date": result.date.isoformat(),
                "pr_count": result.pr_count,
                "issue_count": result.issue_count,
                "commit_count": result.commit_count,
                "generation_time_seconds": result.generation_time_seconds,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to regenerate daily summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"重新生成总结失败：{str(e)}"
        )


# ============ 每日数据获取 API ============

@router.get("/{project}/{date}/data")
async def get_daily_data(
    project: str,
    date: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定日期的每日数据（PR、Issue、Commit）

    所有登录用户可访问

    返回数据库中存储的指定日期的项目动态数据
    """
    from app.models.daily_summary import DailyPR, DailyIssue, DailyCommit

    try:
        data_date = DateType.fromisoformat(date)

        # 获取 PRs - 使用索引提示避免 MySQL filesort
        pr_stmt = select(DailyPR).with_hint(
            DailyPR, 
            "USE INDEX (idx_daily_prs_project_date_created)"
        ).where(
            DailyPR.project == project,
            DailyPR.data_date == data_date
        ).order_by(DailyPR.created_at.desc())
        pr_result = await db.execute(pr_stmt)
        prs = pr_result.scalars().all()

        # 获取 Issues - 使用索引提示避免 MySQL filesort
        issue_stmt = select(DailyIssue).with_hint(
            DailyIssue, 
            "USE INDEX (idx_daily_issues_project_date_created)"
        ).where(
            DailyIssue.project == project,
            DailyIssue.data_date == data_date
        ).order_by(DailyIssue.created_at.desc())
        issue_result = await db.execute(issue_stmt)
        issues = issue_result.scalars().all()

        # 获取 Commits - 使用索引提示避免 MySQL filesort
        commit_stmt = select(DailyCommit).with_hint(
            DailyCommit, 
            "USE INDEX (idx_daily_commits_project_date_created)"
        ).where(
            DailyCommit.project == project,
            DailyCommit.data_date == data_date
        ).order_by(DailyCommit.committed_at.desc())
        commit_result = await db.execute(commit_stmt)
        commits = commit_result.scalars().all()

        # 格式化返回数据
        return {
            "project": project,
            "date": date,
            "pull_requests": [
                {
                    "number": pr.pr_number,
                    "title": pr.title,
                    "state": pr.state,
                    "user": pr.author,
                    "html_url": pr.html_url,
                    "created_at": format_datetime_utc(pr.created_at),
                    "merged_at": format_datetime_utc(pr.merged_at),
                    "labels": pr.labels or [],
                    "body": pr.body,
                }
                for pr in prs
            ],
            "issues": [
                {
                    "number": issue.issue_number,
                    "title": issue.title,
                    "state": issue.state,
                    "user": issue.author,
                    "html_url": issue.html_url,
                    "created_at": format_datetime_utc(issue.created_at),
                    "closed_at": format_datetime_utc(issue.closed_at),
                    "labels": issue.labels or [],
                    "body": issue.body,
                    "comments": issue.comments_count,
                }
                for issue in issues
            ],
            "commits": [
                {
                    "sha": commit.short_sha,
                    "message": commit.message,
                    "author": commit.author,
                    "html_url": commit.html_url,
                    "committed_at": format_datetime_utc(commit.committed_at),
                    "pr_number": commit.pr_number,
                    "pr_title": commit.pr_title,
                    "additions": commit.additions,
                    "deletions": commit.deletions,
                }
                for commit in commits
            ],
            "releases": {
                "latest": None,  # 版本信息从其他 API 获取
                "prerelease": None,
            },
            "counts": {
                "prs": len(prs),
                "issues": len(issues),
                "commits": len(commits),
            },
            "has_data": len(prs) > 0 or len(issues) > 0 or len(commits) > 0,
            "fetched_at": format_datetime_utc(prs[0].fetched_at) if prs else None,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"日期格式错误：{str(e)}"
        )
    except Exception as e:
        logger.error(f"Failed to get daily data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取每日数据失败：{str(e)}"
        )


@router.get("/{project}/available-dates")
async def get_available_dates(
    project: str,
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    获取项目可用日期列表

    返回数据库中有数据的日期列表
    """
    from sqlalchemy import distinct
    from app.models.daily_summary import DailyPR

    try:
        # 查询有数据的日期
        stmt = select(distinct(DailyPR.data_date)).where(
            DailyPR.project == project
        ).order_by(DailyPR.data_date.desc()).limit(limit)

        result = await db.execute(stmt)
        dates = result.scalars().all()

        return {
            "project": project,
            "dates": [d.isoformat() for d in dates if d],
            "total": len(dates),
        }
    except Exception as e:
        logger.error(f"Failed to get available dates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取可用日期失败：{str(e)}"
        )


@router.get("/{project}/{date}", response_model=DailySummaryResponse)
async def get_daily_summary(
    project: str,
    date: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定日期的每日总结

    所有登录用户可访问

    如果总结尚未生成，返回空状态而不是 404
    """
    try:
        summary_date = DateType.fromisoformat(date)

        stmt = select(DailySummary).where(
            DailySummary.project == project,
            DailySummary.data_date == summary_date,
        )
        result = await db.execute(stmt)
        summary = result.scalar_one_or_none()

        # 如果总结尚未生成，返回空状态响应
        if not summary:
            return {
                "project": project,
                "date": date,
                "summary_markdown": "",
                "has_data": False,
                "pr_count": 0,
                "issue_count": 0,
                "commit_count": 0,
                "generated_at": None,
                "status": "not_generated",
            }

        return {
            "project": summary.project,
            "date": summary.data_date.isoformat(),
            "summary_markdown": summary.summary_markdown,
            "has_data": summary.has_data,
            "pr_count": summary.pr_count,
            "issue_count": summary.issue_count,
            "commit_count": summary.commit_count,
            "generated_at": format_datetime_utc(summary.generated_at),
            "status": summary.status,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"日期格式错误：{str(e)}"
        )
    except Exception as e:
        logger.error(f"Failed to get daily summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取总结失败：{str(e)}"
        )