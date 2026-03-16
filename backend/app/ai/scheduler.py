from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from fastapi import HTTPException, status

from app.ai.daily_generation import DailyGenerationService
from app.core.config import Settings
from app.core.database import Database
from app.core.dependencies import CurrentUser
from app.services import health_repository, scheduled_tasks
from app.services.health_records import (
    build_member_daily_generation_snapshot,
    ensure_member_access,
    list_all_members_for_scheduler,
    replace_generated_daily_care_plans,
    replace_generated_health_summaries,
)


BUILTIN_HEALTH_SUMMARY_JOB_ID = "builtin.refresh_health_summaries"
BUILTIN_CARE_PLAN_JOB_ID = "builtin.refresh_daily_care_plans"
CARE_PLAN_SLOT_HOURS = {
    "清晨": 6,
    "上午": 9,
    "午后": 14,
    "晚间": 20,
    "睡前": 22,
}
CARE_PLAN_ICON_BY_CATEGORY = {
    "medication-reminder": "medication",
    "activity-reminder": "exercise",
    "checkup-reminder": "checkup",
    "health-advice": "general",
    "daily-tip": "general",
}

logger = logging.getLogger(__name__)


class HomeVitalScheduler:
    def __init__(self, database: Database, *, settings: Settings) -> None:
        self.database = database
        self._timezone = ZoneInfo(settings.scheduler_timezone)
        self._scheduler = BackgroundScheduler(timezone=settings.scheduler_timezone)
        self._daily_generator = DailyGenerationService(settings)
        self._health_summary_refresh_hour = settings.health_summary_refresh_hour
        self._health_summary_refresh_minute = settings.health_summary_refresh_minute
        self._care_plan_refresh_hour = settings.care_plan_refresh_hour
        self._care_plan_refresh_minute = settings.care_plan_refresh_minute
        self._started = False

    def start(self) -> None:
        if self._started:
            return
        self._scheduler.start()
        self._started = True
        self._register_builtin_jobs()
        self.load_jobs()

    def shutdown(self) -> None:
        if not self._started:
            return
        self._scheduler.shutdown(wait=False)
        self._started = False

    def get_job(self, task_id: str) -> Any:
        return self._scheduler.get_job(task_id)

    def load_jobs(self) -> None:
        with self.database.connection() as connection:
            tasks = scheduled_tasks.list_enabled_tasks(connection)
        for task in tasks:
            self.sync_task(task)

    def sync_task(self, task: dict[str, Any]) -> None:
        if not task["enabled"]:
            self.remove_job(task["id"])
            return

        schedule_type = task["schedule_type"]
        config = task["schedule_config"]
        if schedule_type == "once":
            run_at = config.get("run_at") or task["next_run_at"]
            if run_at is None:
                return
            trigger = DateTrigger(run_date=datetime.fromisoformat(str(run_at)))
        elif schedule_type == "daily":
            trigger = CronTrigger(hour=int(config.get("hour", 0)), minute=int(config.get("minute", 0)))
        else:
            weekday = str(config.get("weekday", "monday")).lower()[:3]
            trigger = CronTrigger(day_of_week=weekday, hour=int(config.get("hour", 0)), minute=int(config.get("minute", 0)))

        self._scheduler.add_job(
            self.execute_task,
            trigger=trigger,
            args=[task["id"]],
            id=task["id"],
            replace_existing=True,
        )

    def remove_job(self, task_id: str) -> None:
        job = self._scheduler.get_job(task_id)
        if job is not None:
            self._scheduler.remove_job(task_id)

    def execute_task(self, task_id: str) -> dict[str, Any]:
        with self.database.connection() as connection:
            task = scheduled_tasks.get_task_by_id(connection, task_id)
            if task is None:
                raise KeyError(task_id)
            if task["member_id"] is None:
                raise ValueError("Scheduled task requires member_id for Phase 4.")

            care_plan = health_repository.create_resource(
                connection,
                "care-plans",
                member_id=task["member_id"],
                values={
                    "assignee_member_id": task["member_id"],
                    "category": "daily-tip",
                    "icon_key": "general",
                    "time_slot": _label_for_scheduled_at(task["next_run_at"]),
                    "title": _title_for_task(task),
                    "description": task["prompt"],
                    "notes": None,
                    "status": "active",
                    "scheduled_at": task["next_run_at"],
                    "generated_by": "ai",
                },
            )
            updated_task = scheduled_tasks.mark_task_run(connection, task_id)

        if updated_task["enabled"]:
            self.sync_task(updated_task)
        else:
            self.remove_job(task_id)
        return {
            "task": updated_task,
            "care_plan": care_plan,
        }

    def run_task_now(self, task_id: str) -> dict[str, Any]:
        return self.execute_task(task_id)

    def refresh_health_summaries(self) -> dict[str, Any]:
        refreshed_member_ids: list[str] = []
        failed_member_ids: list[str] = []
        errors: dict[str, str] = {}
        now = _now_in_timezone(self._timezone)
        generated_at = now.isoformat()

        with self.database.connection() as connection:
            for member in list_all_members_for_scheduler(connection):
                try:
                    snapshot = build_member_daily_generation_snapshot(
                        connection,
                        member_id=member["id"],
                        now=now,
                        timezone=str(self._timezone),
                    )
                    bundle = asyncio.run(self._daily_generator.generate_health_summaries(snapshot))
                    summaries = bundle.model_dump()["summaries"] if hasattr(bundle, "model_dump") else bundle["summaries"]
                    replace_generated_health_summaries(
                        connection,
                        member_id=member["id"],
                        generated_at=generated_at,
                        summaries=summaries,
                    )
                    refreshed_member_ids.append(member["id"])
                except Exception as error:
                    failed_member_ids.append(member["id"])
                    errors[member["id"]] = str(error)
                    logger.warning("Skipping daily health summary refresh for member %s: %s", member["id"], error)

        return {
            "member_ids": refreshed_member_ids,
            "failed_member_ids": failed_member_ids,
            "errors": errors,
        }

    def refresh_daily_care_plans(self) -> dict[str, Any]:
        refreshed_member_ids: list[str] = []
        failed_member_ids: list[str] = []
        errors: dict[str, str] = {}
        now = _now_in_timezone(self._timezone)

        with self.database.connection() as connection:
            for member in list_all_members_for_scheduler(connection):
                try:
                    snapshot = build_member_daily_generation_snapshot(
                        connection,
                        member_id=member["id"],
                        now=now,
                        timezone=str(self._timezone),
                    )
                    decision = asyncio.run(self._daily_generator.generate_care_plan(snapshot))
                    decision_payload = decision.model_dump() if hasattr(decision, "model_dump") else decision
                    care_plans: list[dict[str, Any]] = []
                    for draft in decision_payload.get("care_plans", []):
                        care_plans.append(
                            {
                                "assignee_member_id": draft.get("assignee_member_id") or member["id"],
                                "category": draft["category"],
                                "icon_key": draft.get("icon_key") or CARE_PLAN_ICON_BY_CATEGORY.get(
                                    draft["category"],
                                    "general",
                                ),
                                "time_slot": draft["time_slot"],
                                "title": draft["title"],
                                "description": draft["description"],
                                "notes": draft.get("notes"),
                                "scheduled_at": _scheduled_at_for_slot(now, draft["time_slot"]),
                            }
                        )
                    replace_generated_daily_care_plans(
                        connection,
                        member_id=member["id"],
                        now=now,
                        care_plans=care_plans,
                    )
                    refreshed_member_ids.append(member["id"])
                except Exception as error:
                    failed_member_ids.append(member["id"])
                    errors[member["id"]] = str(error)
                    logger.warning("Skipping daily care plan refresh for member %s: %s", member["id"], error)

        return {
            "member_ids": refreshed_member_ids,
            "failed_member_ids": failed_member_ids,
            "errors": errors,
        }

    def _register_builtin_jobs(self) -> None:
        self._scheduler.add_job(
            self.refresh_health_summaries,
            trigger=CronTrigger(
                hour=self._health_summary_refresh_hour,
                minute=self._health_summary_refresh_minute,
            ),
            id=BUILTIN_HEALTH_SUMMARY_JOB_ID,
            replace_existing=True,
        )
        self._scheduler.add_job(
            self.refresh_daily_care_plans,
            trigger=CronTrigger(
                hour=self._care_plan_refresh_hour,
                minute=self._care_plan_refresh_minute,
            ),
            id=BUILTIN_CARE_PLAN_JOB_ID,
            replace_existing=True,
        )


def _title_for_task(task: dict[str, Any]) -> str:
    if task["schedule_type"] == "daily":
        return "每天健康提醒"
    if task["schedule_type"] == "weekly":
        return "每周健康提醒"
    return "定时健康提醒"


def _now_in_timezone(timezone: ZoneInfo) -> datetime:
    return datetime.now(UTC).astimezone(timezone)


def _scheduled_at_for_slot(now: datetime, time_slot: str) -> str:
    hour = CARE_PLAN_SLOT_HOURS[time_slot]
    return now.replace(hour=hour, minute=0, second=0, microsecond=0).isoformat()


def _label_for_scheduled_at(scheduled_at: str | None) -> str | None:
    if scheduled_at is None:
        return None
    parsed = datetime.fromisoformat(scheduled_at)
    hour = parsed.hour
    if hour < 9:
        return "清晨"
    if hour < 12:
        return "上午"
    if hour < 18:
        return "午后"
    if hour < 22:
        return "晚间"
    return "睡前"


def create_scheduled_task(
    *,
    database: Database,
    current_user: CurrentUser,
    member_id: str | None,
    payload: dict[str, Any],
    scheduler: HomeVitalScheduler | None = None,
) -> dict[str, Any]:
    if scheduler is None:
        app = getattr(database, "app", None)
        scheduler = getattr(getattr(app, "state", None), "scheduler", None)
    if member_id is not None:
        ensure_member_access(database, current_user, member_id, required_permission="write")

    with database.connection() as connection:
        task = scheduled_tasks.create_task(
            connection,
            family_space_id=current_user.family_space_id,
            member_id=member_id,
            created_by=current_user.id,
            task_type=payload["task_type"],
            prompt=payload["prompt"],
            schedule_type=payload["schedule_type"],
            schedule_config=payload["schedule_config"],
        )

    if scheduler is not None:
        scheduler.sync_task(task)
    return task


def disable_scheduled_task(
    *,
    database: Database,
    current_user: CurrentUser,
    task_id: str,
    scheduler: HomeVitalScheduler | None = None,
) -> dict[str, Any]:
    if scheduler is None:
        app = getattr(database, "app", None)
        scheduler = getattr(getattr(app, "state", None), "scheduler", None)
    with database.connection() as connection:
        task = scheduled_tasks.get_task_by_id(connection, task_id)
        if task is None or task["family_space_id"] != current_user.family_space_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled task not found.")
        if task["member_id"] is not None:
            ensure_member_access(
                database,
                current_user,
                task["member_id"],
                required_permission="write",
            )
        updated_task = scheduled_tasks.update_task(
            connection,
            task_id,
            {
                "enabled": False,
                "next_run_at": None,
            },
        )

    if scheduler is not None:
        scheduler.remove_job(task_id)
    return updated_task


def run_scheduled_task_now(scheduler: HomeVitalScheduler, task_id: str) -> dict[str, Any]:
    return scheduler.run_task_now(task_id)
