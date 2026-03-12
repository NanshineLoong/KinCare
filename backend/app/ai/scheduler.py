from __future__ import annotations

from datetime import datetime
from typing import Any

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from fastapi import HTTPException, status

from app.core.database import Database
from app.core.dependencies import CurrentUser
from app.services import health_repository, scheduled_tasks
from app.services.health_records import ensure_member_access


class HomeVitalScheduler:
    def __init__(self, database: Database, *, timezone: str) -> None:
        self.database = database
        self._scheduler = BackgroundScheduler(timezone=timezone)
        self._started = False

    def start(self) -> None:
        if self._started:
            return
        self._scheduler.start()
        self._started = True
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
                    "category": "daily-tip",
                    "title": _title_for_task(task),
                    "description": task["prompt"],
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


def _title_for_task(task: dict[str, Any]) -> str:
    if task["schedule_type"] == "daily":
        return "每天健康提醒"
    if task["schedule_type"] == "weekly":
        return "每周健康提醒"
    return "定时健康提醒"


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
        ensure_member_access(database, current_user, member_id, require_write=True)

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
            ensure_member_access(database, current_user, task["member_id"], require_write=True)
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
