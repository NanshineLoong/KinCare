from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

from app.ai import scheduler as scheduler_service
from app.core.database import Database
from app.core.dependencies import CurrentUser
from app.schemas.chat import DocumentExtractionDraft
from app.services import health_repository
from app.services.health_records import ensure_member_access


OBSERVATION_PATTERNS = [
    (
        re.compile(r"血压\s*([0-9]{2,3})"),
        {
            "category": "chronic-vitals",
            "code": "bp-systolic",
            "display_name": "收缩压",
            "unit": "mmHg",
        },
    ),
    (
        re.compile(r"心率\s*([0-9]{2,3})"),
        {
            "category": "body-vitals",
            "code": "heart-rate",
            "display_name": "心率",
            "unit": "bpm",
        },
    ),
]

WEEKDAY_LABELS = {
    "一": "monday",
    "二": "tuesday",
    "三": "wednesday",
    "四": "thursday",
    "五": "friday",
    "六": "saturday",
    "日": "sunday",
    "天": "sunday",
}


def read_member_summary(*, database: Database, current_user: CurrentUser, member_id: str) -> dict[str, Any]:
    member = ensure_member_access(database, current_user, member_id, require_write=False)
    with database.connection() as connection:
        observations = health_repository.list_resources_for_member(connection, "observations", member_id=member_id)
        care_plans = health_repository.list_resources_for_member(connection, "care-plans", member_id=member_id)

    snippets: list[str] = []
    if observations:
        latest_observation = observations[0]
        value = latest_observation["value"] if latest_observation["value"] is not None else latest_observation["value_string"]
        snippets.append(
            f"最新指标：{latest_observation['display_name']} {value}{latest_observation['unit'] or ''}"
        )
    if care_plans:
        snippets.append(f"当前提醒：{care_plans[0]['title']}")
    if not snippets:
        snippets.append("当前还没有结构化健康记录")

    content = f"{member['name']}：" + "；".join(snippets)
    return {
        "tool_name": "read_member_summary",
        "content": content,
        "requires_confirmation": False,
        "meta": {
            "member_id": member_id,
            "member_name": member["name"],
        },
    }


def draft_health_record(*, message: str) -> dict[str, Any] | None:
    for pattern, details in OBSERVATION_PATTERNS:
        match = pattern.search(message)
        if match is None:
            continue
        draft = DocumentExtractionDraft(
            summary="对话中识别到新的健康记录，请确认后再写入正式档案。",
            observations=[
                {
                    **details,
                    "value": float(match.group(1)),
                    "effective_at": datetime.now(UTC).isoformat(),
                }
            ],
        )
        return {
            "tool_name": "draft_health_record",
            "content": f"已识别到 {details['display_name']} 记录，等待确认后入库。",
            "requires_confirmation": True,
            "draft": draft.model_dump(),
            "meta": {
                "record_type": "observation",
            },
        }
    return None


def parse_schedule_request(message: str) -> dict[str, Any] | None:
    daily_match = re.search(r"每天\s*(\d{1,2})[:：](\d{2}).*提醒", message)
    if daily_match:
        return {
            "task_type": "daily-check",
            "prompt": message.strip(),
            "schedule_type": "daily",
            "schedule_config": {
                "hour": int(daily_match.group(1)),
                "minute": int(daily_match.group(2)),
            },
        }

    weekly_match = re.search(r"每周([一二三四五六日天])\s*(\d{1,2})[:：](\d{2}).*提醒", message)
    if weekly_match:
        return {
            "task_type": "weekly-check",
            "prompt": message.strip(),
            "schedule_type": "weekly",
            "schedule_config": {
                "weekday": WEEKDAY_LABELS[weekly_match.group(1)],
                "hour": int(weekly_match.group(2)),
                "minute": int(weekly_match.group(3)),
            },
        }

    once_match = re.search(r"明天\s*(\d{1,2})[:：](\d{2}).*提醒", message)
    if once_match:
        tomorrow = datetime.now(UTC).date()
        run_at = datetime(
            year=tomorrow.year,
            month=tomorrow.month,
            day=tomorrow.day,
            hour=int(once_match.group(1)),
            minute=int(once_match.group(2)),
            tzinfo=UTC,
        )
        return {
            "task_type": "one-time-check",
            "prompt": message.strip(),
            "schedule_type": "once",
            "schedule_config": {
                "run_at": run_at.isoformat(),
            },
        }
    return None


def create_scheduled_task_tool(
    *,
    database: Database,
    current_user: CurrentUser,
    member_id: str,
    scheduler: scheduler_service.HomeVitalScheduler,
    message: str,
) -> dict[str, Any] | None:
    payload = parse_schedule_request(message)
    if payload is None:
        return None

    task = scheduler_service.create_scheduled_task(
        database=database,
        current_user=current_user,
        member_id=member_id,
        payload=payload,
        scheduler=scheduler,
    )
    schedule_text = task["next_run_at"] or "待计算"
    return {
        "tool_name": "create_scheduled_task",
        "content": f"已创建 {task['schedule_type']} 任务，下次执行时间：{schedule_text}",
        "requires_confirmation": False,
        "meta": {
            "task_id": task["id"],
            "schedule_type": task["schedule_type"],
        },
    }
