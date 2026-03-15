from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from fastapi import HTTPException, status

from app.core.database import Database
from app.core.dependencies import CurrentUser
from app.services import health_repository, repository, scheduled_tasks
from app.services.health_records import ensure_member_access


class HomeVitalScheduler:
    def __init__(self, database: Database, *, timezone: str) -> None:
        self.database = database
        self._timezone = ZoneInfo(timezone)
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

    def refresh_health_summaries(self) -> dict[str, Any]:
        refreshed_member_ids: list[str] = []
        generated_at = _now_in_timezone(self._timezone).isoformat()

        with self.database.connection() as connection:
            for member in _list_all_members(connection):
                _replace_health_summaries(connection, member_id=member["id"], generated_at=generated_at)
                refreshed_member_ids.append(member["id"])

        return {"member_ids": refreshed_member_ids}

    def refresh_daily_care_plans(self) -> dict[str, Any]:
        refreshed_member_ids: list[str] = []
        now = _now_in_timezone(self._timezone)

        with self.database.connection() as connection:
            for member in _list_all_members(connection):
                if _refresh_member_daily_care_plans(connection, member_id=member["id"], now=now):
                    refreshed_member_ids.append(member["id"])

        return {"member_ids": refreshed_member_ids}


def _title_for_task(task: dict[str, Any]) -> str:
    if task["schedule_type"] == "daily":
        return "每天健康提醒"
    if task["schedule_type"] == "weekly":
        return "每周健康提醒"
    return "定时健康提醒"


def _list_all_members(connection: Any) -> list[dict[str, Any]]:
    family_space_rows = connection.execute(
        "SELECT id FROM family_space ORDER BY created_at ASC"
    ).fetchall()
    members: list[dict[str, Any]] = []
    for row in family_space_rows:
        members.extend(repository.list_members_by_family_space(connection, str(row["id"])))
    return members


def _now_in_timezone(timezone: ZoneInfo) -> datetime:
    return datetime.now(UTC).astimezone(timezone)


def _replace_health_summaries(connection: Any, *, member_id: str, generated_at: str) -> None:
    existing = health_repository.list_resources_for_member(connection, "health-summaries", member_id=member_id)
    for item in existing:
        health_repository.delete_resource(connection, "health-summaries", item["id"])

    for payload in _build_health_summaries(connection, member_id=member_id, generated_at=generated_at):
        health_repository.create_resource(connection, "health-summaries", member_id=member_id, values=payload)


def _build_health_summaries(connection: Any, *, member_id: str, generated_at: str) -> list[dict[str, Any]]:
    observations = health_repository.list_resources_for_member(connection, "observations", member_id=member_id)
    sleep_records = health_repository.list_resources_for_member(connection, "sleep-records", member_id=member_id)
    workout_records = health_repository.list_resources_for_member(connection, "workout-records", member_id=member_id)
    conditions = health_repository.list_resources_for_member(connection, "conditions", member_id=member_id)

    chronic_observation = next((item for item in observations if item["category"] == "chronic-vitals"), None)
    body_observation = next((item for item in observations if item["category"] == "body-vitals"), None)
    active_condition = next((item for item in conditions if item["clinical_status"] == "active"), None)
    latest_sleep = sleep_records[0] if sleep_records else None
    latest_workout = workout_records[0] if workout_records else None
    latest_observation = observations[0] if observations else None

    return [
        {
            "category": "chronic-vitals",
            "label": "慢病管理",
            "value": _chronic_summary_text(chronic_observation, active_condition),
            "status": _chronic_summary_status(chronic_observation, active_condition),
            "generated_at": generated_at,
        },
        {
            "category": "lifestyle",
            "label": "生活习惯",
            "value": _lifestyle_summary_text(latest_sleep, latest_workout),
            "status": _lifestyle_summary_status(latest_sleep, latest_workout),
            "generated_at": generated_at,
        },
        {
            "category": "body-vitals",
            "label": "生理指标",
            "value": _body_summary_text(body_observation, latest_observation),
            "status": _body_summary_status(body_observation),
            "generated_at": generated_at,
        },
    ]


def _chronic_summary_text(observation: dict[str, Any] | None, condition: dict[str, Any] | None) -> str:
    if observation is not None:
        return f"最新{observation['display_name']}{_format_measurement(observation)}。"
    if condition is not None:
        return f"当前重点关注 {condition['display_name']}。"
    return "暂无慢病相关更新。"


def _chronic_summary_status(
    observation: dict[str, Any] | None,
    condition: dict[str, Any] | None,
) -> str:
    if observation is not None and observation["value"] is not None:
        if observation["code"] == "bp-systolic" and float(observation["value"]) >= 140:
            return "warning"
        if observation["code"] == "blood-glucose" and float(observation["value"]) >= 7:
            return "warning"
    if condition is not None:
        return "warning"
    return "neutral"


def _lifestyle_summary_text(
    sleep_record: dict[str, Any] | None,
    workout_record: dict[str, Any] | None,
) -> str:
    parts: list[str] = []
    if sleep_record is not None:
        parts.append(f"最近一次睡眠 {sleep_record['total_minutes']} 分钟")
    if workout_record is not None:
        parts.append(f"最近一次运动 {workout_record['duration_minutes']} 分钟")
    if not parts:
        return "暂无睡眠与运动记录。"
    return "，".join(parts) + "。"


def _lifestyle_summary_status(
    sleep_record: dict[str, Any] | None,
    workout_record: dict[str, Any] | None,
) -> str:
    if sleep_record is not None and sleep_record["total_minutes"] < 360:
        return "warning"
    if workout_record is not None and workout_record["duration_minutes"] >= 30:
        return "good"
    if sleep_record is not None and sleep_record["total_minutes"] >= 420:
        return "good"
    return "neutral"


def _body_summary_text(
    body_observation: dict[str, Any] | None,
    fallback_observation: dict[str, Any] | None,
) -> str:
    target = body_observation or fallback_observation
    if target is not None:
        return f"最近一次指标是 {target['display_name']}{_format_measurement(target)}。"
    return "暂无生理指标记录。"


def _body_summary_status(observation: dict[str, Any] | None) -> str:
    if observation is None:
        return "neutral"
    if observation["code"] == "heart-rate" and observation["value"] is not None:
        value = float(observation["value"])
        if value < 50 or value > 110:
            return "warning"
    return "neutral"


def _format_measurement(item: dict[str, Any]) -> str:
    value = item.get("value")
    if value is None:
        value = item.get("value_string") or ""
    unit = item.get("unit") or ""
    return f" {value}{unit}".rstrip()


def _refresh_member_daily_care_plans(connection: Any, *, member_id: str, now: datetime) -> bool:
    care_plans = health_repository.list_resources_for_member(connection, "care-plans", member_id=member_id)
    today = now.date()

    for item in care_plans:
        scheduled_at = _parse_datetime(item.get("scheduled_at"))
        if (
            item["generated_by"] == "ai"
            and item["status"] == "active"
            and scheduled_at is not None
            and scheduled_at.astimezone(now.tzinfo).date() == today
        ):
            health_repository.delete_resource(connection, "care-plans", item["id"])

    active_today = [
        item
        for item in care_plans
        if item["status"] == "active"
        and (_parse_datetime(item.get("scheduled_at")) or now).astimezone(now.tzinfo).date() == today
        and item["generated_by"] == "manual"
    ]
    sleep_records = health_repository.list_resources_for_member(connection, "sleep-records", member_id=member_id)
    workout_records = health_repository.list_resources_for_member(connection, "workout-records", member_id=member_id)
    observations = health_repository.list_resources_for_member(connection, "observations", member_id=member_id)

    payload = _build_daily_care_plan_payload(
        active_today=active_today,
        sleep_record=sleep_records[0] if sleep_records else None,
        workout_record=workout_records[0] if workout_records else None,
        observation=observations[0] if observations else None,
        scheduled_at=now.isoformat(),
    )
    if payload is None:
        return False

    health_repository.create_resource(connection, "care-plans", member_id=member_id, values=payload)
    return True


def _build_daily_care_plan_payload(
    *,
    active_today: list[dict[str, Any]],
    sleep_record: dict[str, Any] | None,
    workout_record: dict[str, Any] | None,
    observation: dict[str, Any] | None,
    scheduled_at: str,
) -> dict[str, Any] | None:
    if active_today:
        first_plan = active_today[0]
        return {
            "category": "daily-tip",
            "title": "跟进今日提醒",
            "description": f"今天已有“{first_plan['title']}”，请按计划完成并记录结果。",
            "status": "active",
            "scheduled_at": scheduled_at,
            "generated_by": "ai",
        }

    if sleep_record is not None and sleep_record["total_minutes"] < 420:
        return {
            "category": "health-advice",
            "title": "今晚尽量提前休息",
            "description": f"最近一次睡眠仅 {sleep_record['total_minutes']} 分钟，今晚优先保证休息。",
            "status": "active",
            "scheduled_at": scheduled_at,
            "generated_by": "ai",
        }

    if workout_record is not None and workout_record["duration_minutes"] < 30:
        return {
            "category": "activity-reminder",
            "title": "安排一次轻量活动",
            "description": "今天可补一段 20 到 30 分钟的轻量步行或拉伸。",
            "status": "active",
            "scheduled_at": scheduled_at,
            "generated_by": "ai",
        }

    if observation is not None:
        return {
            "category": "daily-tip",
            "title": "复盘今日指标",
            "description": f"关注最近一次 {observation['display_name']} 记录，并按需补充新的测量。",
            "status": "active",
            "scheduled_at": scheduled_at,
            "generated_by": "ai",
        }

    return None


def _parse_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value)


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
