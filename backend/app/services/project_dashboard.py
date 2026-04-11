"""
Project Dashboard Service
Provides data for the vllm-ascend project dashboard
"""
import logging
from datetime import UTC, datetime, timedelta
from typing import Any, Dict, List, Optional

from app.services.github_cache import get_github_cache, DOCKER_MIRRORS

logger = logging.getLogger(__name__)


class ProjectDashboardService:
    """项目看板服务"""

    def __init__(self):
        self.github_cache = get_github_cache()

    def get_releases(self, recommended_only: bool = False) -> List[Dict[str, Any]]:
        """获取 release 版本信息

        Args:
            recommended_only: 如果为 True，只返回推荐版本（最新 1 个 stable + 最新 1 个 pre-release）
        """
        return self.github_cache.get_releases(recommended_only=recommended_only)

    def get_all_tags(self) -> List[str]:
        """获取所有 tags 列表"""
        return self.github_cache.get_all_tags()

    def get_main_branch_versions(self) -> Optional[Dict[str, Any]]:
        """获取 main 分支的 vllm 版本信息"""
        versions = self.github_cache.get_conf_py_versions()
        if not versions:
            return None

        # Use available version fields from conf.py
        # main_vllm_tag/main_vllm_commit for main branch vLLM info
        # 空字符串 "" 表示无数据，直接返回（不回退到其他字段）
        vllm_version = versions.get("main_vllm_tag") or ""
        vllm_commit = versions.get("main_vllm_commit") or ""

        return {
            "vllm_version": vllm_version,
            "vllm_commit": vllm_commit,
            "updated_at": datetime.now(UTC).isoformat(),
        }

    def get_model_support_matrix(self) -> Optional[Dict[str, Any]]:
        """获取模型支持矩阵（从数据库配置）"""
        # 这个方法已废弃，模型支持矩阵现在完全由用户在后台配置
        # 不再从 GitHub markdown 文件解析
        return None

    def update_model_support_matrix(self, entries: List[Dict[str, Any]]) -> bool:
        """更新模型支持矩阵（保存到配置）"""
        # This will be saved to database via the config API
        return True

    def get_stale_issues(self, days: int = 7) -> List[Dict[str, Any]]:
        """获取超期未 review 的 issues"""
        # This requires GitHub API access, will be implemented later
        # For now, return empty list
        logger.warning("get_stale_issues not yet implemented - requires GitHub API")
        return []

    def get_biweekly_meeting(self, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """获取双周例会信息"""
        # Default config
        default_config = {
            "zoom_link": "https://us06web.zoom.us/j/86916644616?pwd=ceuPEOHE38Qv4jLoVQlmuVxrD5kmP9.1",
            "meeting_notes_link": "https://docs.google.com/document/d/1hCSzRTMZhIB8vRq1_qOOjx4c9uYxvdQvDsMV2JcSrw/edit?tab=t.0",
            "meeting_time": "15:00",  # Beijing time
            "base_date": "2025-03-25",  # Recent Wednesday as reference
            "holiday_delays": [],  # List of cancelled meeting dates
        }

        if config:
            default_config.update(config)

        # Calculate next meeting date (bi-weekly from base date)
        base_date = datetime.strptime(default_config["base_date"], "%Y-%m-%d").date()
        today = datetime.now(UTC).date()

        # Calculate weeks since base date
        days_since_base = (today - base_date).days
        weeks_since_base = days_since_base // 14  # Bi-weekly

        # Next meeting is base_date + 14 * (weeks_since_base + 1)
        next_meeting_date = base_date + timedelta(days=14 * (weeks_since_base + 1))

        # Check if next meeting is in the past (adjust if needed)
        if next_meeting_date <= today:
            next_meeting_date = base_date + timedelta(days=14 * (weeks_since_base + 2))

        # Get all cancelled dates as a set for quick lookup
        cancelled_dates = set(
            hd.get("date")
            for hd in default_config.get("holiday_delays", [])
            if hd.get("date")
        )

        # Calculate cumulative delay from all previous cancelled meetings
        # A meeting is "previous" if its scheduled date is <= next_meeting_date
        cumulative_delay = 0
        weeks_since_base_check = 0
        while True:
            scheduled_date = base_date + timedelta(days=14 * weeks_since_base_check)
            if scheduled_date > next_meeting_date:
                break
            if scheduled_date.isoformat() in cancelled_dates:
                cumulative_delay += 7
            weeks_since_base_check += 1

        # Add cumulative delay to the next meeting date
        next_meeting_date += timedelta(days=cumulative_delay)

        # Check if the next meeting itself is cancelled
        is_cancelled = next_meeting_date.isoformat() in cancelled_dates

        return {
            "next_meeting_date": next_meeting_date.isoformat(),
            "next_meeting_time": default_config["meeting_time"],
            "zoom_link": default_config["zoom_link"],
            "meeting_notes_link": default_config["meeting_notes_link"],
            "is_cancelled": is_cancelled,
        }

    def get_meeting_calendar(self, config: Optional[Dict[str, Any]] = None, months: int = 3) -> Dict[str, Any]:
        """获取未来几个月的会议日历

        Args:
            config: 会议配置
            months: 未来几个月，默认 3 个月
        """
        # Default config
        default_config = {
            "zoom_link": "https://us06web.zoom.us/j/86916644616?pwd=ceuPEOHE38Qv4jLoVQlmuVxrD5kmP9.1",
            "meeting_notes_link": "https://docs.google.com/document/d/1hCSzRTMZhIB8vRq1_qOOjx4c9uYxvdQvDsMV2JcSrw/edit?tab=t.0",
            "meeting_time": "15:00",  # Beijing time
            "base_date": "2025-03-25",
            "holiday_delays": [],
        }

        if config:
            default_config.update(config)

        base_date = datetime.strptime(default_config["base_date"], "%Y-%m-%d").date()
        today = datetime.now(UTC).date()
        end_date = today + timedelta(days=30 * months)

        # Get all cancelled dates as a set for quick lookup
        cancelled_dates = set(
            hd.get("date")
            for hd in default_config.get("holiday_delays", [])
            if hd.get("date")
        )

        # Generate all bi-weekly meetings with cumulative delay
        # When a meeting is cancelled:
        # 1. Keep the cancelled meeting in its original position (marked as cancelled)
        # 2. Add a new make-up meeting 7 days later
        # 3. All subsequent meetings are delayed by 7 days (but shown as normal)
        meetings = []
        weeks_since_base = 0
        cumulative_delay = 0  # Cumulative delay in days from all previous cancelled meetings

        while True:
            # Scheduled date based on original bi-weekly schedule
            scheduled_date = base_date + timedelta(days=14 * weeks_since_base)
            if scheduled_date > end_date:
                break

            if scheduled_date >= today:
                # Check if this meeting is cancelled
                is_cancelled = scheduled_date.isoformat() in cancelled_dates

                if is_cancelled:
                    # Add the cancelled meeting (stays at original position, marked as cancelled)
                    meetings.append({
                        "scheduled_date": scheduled_date.isoformat(),
                        "actual_date": scheduled_date.isoformat(),
                        "is_cancelled": True,
                        "meeting_time": default_config["meeting_time"],
                    })
                    
                    # Add a make-up meeting 7 days later (this is the actual meeting that happens)
                    make_up_date = scheduled_date + timedelta(days=7)
                    meetings.append({
                        "scheduled_date": make_up_date.isoformat(),
                        "actual_date": make_up_date.isoformat(),
                        "is_cancelled": False,
                        "meeting_time": default_config["meeting_time"],
                        "is_makeup": True,  # Mark as make-up meeting
                    })
                    
                    # All subsequent meetings will be delayed by 7 days
                    cumulative_delay += 7
                else:
                    # Normal meeting: apply cumulative delay from previous cancellations
                    actual_date = scheduled_date + timedelta(days=cumulative_delay)
                    
                    meetings.append({
                        "scheduled_date": scheduled_date.isoformat(),
                        "actual_date": actual_date.isoformat(),
                        "is_cancelled": False,
                        "is_makeup": False,
                        "meeting_time": default_config["meeting_time"],
                    })
            weeks_since_base += 1

        return {
            "meetings": meetings,
            "base_date": base_date.isoformat(),
            "meeting_time": default_config["meeting_time"],
        }

    def cancel_meeting(self, date: str, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """取消指定日期的会议
        
        Args:
            date: 要取消的会议日期（ISO format）
            config: 会议配置
            
        Returns:
            更新后的完整配置
        """
        # Default config
        default_config = {
            "zoom_link": "https://us06web.zoom.us/j/86916644616?pwd=ceuPEOHE38Qv4jLoVQlmuVxrD5kmP9.1",
            "meeting_notes_link": "https://docs.google.com/document/d/1hCSzRTMZhIB8vRq1_qOOjx4c9uYxvdQvDsMV2JcSrw/edit?tab=t.0",
            "meeting_time": "15:00",
            "base_date": "2025-03-25",
            "holiday_delays": [],
        }

        if config:
            default_config.update(config)
        
        # Ensure holiday_delays exists and is a list
        if not isinstance(default_config.get("holiday_delays"), list):
            default_config["holiday_delays"] = []

        # Add to cancelled dates
        cancelled_dates = default_config.get("holiday_delays", [])
        if not any(hd.get("date") == date for hd in cancelled_dates):
            cancelled_dates.append({"date": date, "reason": "手动取消"})
            default_config["holiday_delays"] = cancelled_dates

        # Return the updated config
        return default_config

    def restore_meeting(self, date: str, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """恢复已取消的会议
        
        Args:
            date: 要恢复的会议日期（ISO format）
            config: 会议配置
            
        Returns:
            更新后的完整配置
        """
        # Default config
        default_config = {
            "zoom_link": "https://us06web.zoom.us/j/86916644616?pwd=ceuPEOHE38Qv4jLoVQlmuVxrD5kmP9.1",
            "meeting_notes_link": "https://docs.google.com/document/d/1hCSzRTMZhIB8vRq1_qOOjx4c9uYxvdQvDsMV2JcSrw/edit?tab=t.0",
            "meeting_time": "15:00",
            "base_date": "2025-03-25",
            "holiday_delays": [],
        }

        if config:
            default_config.update(config)
        
        # Ensure holiday_delays exists and is a list
        if not isinstance(default_config.get("holiday_delays"), list):
            default_config["holiday_delays"] = []

        # Remove from cancelled dates
        cancelled_dates = default_config.get("holiday_delays", [])
        cancelled_dates = [hd for hd in cancelled_dates if hd.get("date") != date]
        default_config["holiday_delays"] = cancelled_dates

        # Return the updated config
        return default_config


# Singleton instance
_service_instance: Optional[ProjectDashboardService] = None


def get_project_dashboard_service() -> ProjectDashboardService:
    """获取项目看板服务单例"""
    global _service_instance
    if _service_instance is None:
        _service_instance = ProjectDashboardService()
    return _service_instance
