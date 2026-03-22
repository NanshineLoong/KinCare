from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, Field, field_validator
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.core.config import Settings
from app.schemas.health import (
    CarePlanCategory,
    CarePlanIconKey,
    CarePlanTimeSlot,
    HealthSummaryStatus,
)


class DailyHealthSnapshot(BaseModel):
    member: dict[str, Any]
    observations: list[dict[str, Any]] = Field(default_factory=list)
    conditions: list[dict[str, Any]] = Field(default_factory=list)
    medications: list[dict[str, Any]] = Field(default_factory=list)
    encounters: list[dict[str, Any]] = Field(default_factory=list)
    sleep_records: list[dict[str, Any]] = Field(default_factory=list)
    workout_records: list[dict[str, Any]] = Field(default_factory=list)
    today_manual_care_plans: list[dict[str, Any]] = Field(default_factory=list)
    timezone: str
    generated_for_date: str


class DailyHealthSummaryItem(BaseModel):
    category: str
    label: str
    value: str
    status: HealthSummaryStatus

    @field_validator("category", "label", "value")
    @classmethod
    def validate_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field is required.")
        return cleaned


class DailyHealthSummaryBundle(BaseModel):
    summaries: list[DailyHealthSummaryItem]


class DailyCarePlanDraft(BaseModel):
    category: CarePlanCategory
    icon_key: CarePlanIconKey | None = None
    time_slot: CarePlanTimeSlot
    assignee_member_id: str | None = None
    title: str
    description: str
    notes: str | None = None

    @field_validator("title", "description", "assignee_member_id", "notes")
    @classmethod
    def validate_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field is required.")
        return cleaned


class DailyCarePlanDecision(BaseModel):
    care_plans: list[DailyCarePlanDraft] = Field(default_factory=list)


class DailyGenerationResult(BaseModel):
    summaries: DailyHealthSummaryBundle | None = None
    care_plans: list[DailyCarePlanDraft] = Field(default_factory=list)


class DailyGenerationService:
    def __init__(self, settings: Settings) -> None:
        model = _build_model(settings)
        self.summary_agent: Agent[None, DailyHealthSummaryBundle] | None = None
        self.care_plan_agent: Agent[None, DailyCarePlanDecision] | None = None

        if model is not None:
            self.summary_agent = Agent(
                model,
                output_type=DailyHealthSummaryBundle,
                instructions=SUMMARY_AGENT_INSTRUCTIONS,
            )
            self.care_plan_agent = Agent(
                model,
                output_type=DailyCarePlanDecision,
                instructions=CARE_PLAN_AGENT_INSTRUCTIONS,
            )

    async def generate_health_summaries(
        self,
        snapshot: DailyHealthSnapshot,
        *,
        output_language: str = "en",
    ) -> DailyHealthSummaryBundle:
        if self.summary_agent is None:
            raise RuntimeError("AI daily generation is not configured.")
        validated_snapshot = _validated_snapshot(snapshot)
        result = await self.summary_agent.run(
            _snapshot_prompt(
                validated_snapshot,
                output_language=output_language,
                task="health_summary",
            )
        )
        return _normalized_summary_bundle(result.output)

    async def generate_care_plan(
        self,
        snapshot: DailyHealthSnapshot,
        *,
        output_language: str = "en",
    ) -> DailyCarePlanDecision:
        if self.care_plan_agent is None:
            raise RuntimeError("AI daily generation is not configured.")
        validated_snapshot = _validated_snapshot(snapshot)
        result = await self.care_plan_agent.run(
            _snapshot_prompt(
                validated_snapshot,
                output_language=output_language,
                task="care_plan",
            )
        )
        return result.output


def _snapshot_prompt(
    snapshot: DailyHealthSnapshot,
    *,
    output_language: str,
    task: str,
) -> str:
    normalized_language = "en" if output_language == "en" else "zh"
    output_language_label = (
        "Return all user-facing text in English."
        if normalized_language == "en"
        else "Return all user-facing text in Simplified Chinese."
    )
    task_rules = [
        "For health summaries, category, label, and value must follow the requested output language."
    ]
    if task == "care_plan":
        task_rules = [
            "For care plans, title, description, and notes must follow the requested output language.",
            "time_slot must use one of: 清晨, 上午, 午后, 晚间, 睡前.",
        ]
    return "\n".join(
        [
            "Use English for all internal instructions.",
            output_language_label,
            *task_rules,
            "Generate structured results strictly from the following family member health snapshot. Do not invent missing facts.",
            json.dumps(snapshot.model_dump(mode="json"), ensure_ascii=False, indent=2),
        ]
    )


SUMMARY_AGENT_INSTRUCTIONS = "\n".join(
    [
        "You generate daily health summaries for the KinCare home dashboard.",
        "Use only facts from the provided snapshot. Do not add unsupported data.",
        "Return 0-4 structured summaries ordered from most important to least important.",
        "If there is nothing valuable to highlight, return summaries = [].",
        "status must be one of: good, warning, alert.",
        "Do not output Markdown, bullet lists, or free-form explanations.",
    ]
)


CARE_PLAN_AGENT_INSTRUCTIONS = "\n".join(
    [
        "You generate 0-3 AI care-plan reminders for the current day.",
        "Use only facts from the provided snapshot. Do not add unsupported data.",
        "If there is no clear and valuable reminder for today, return care_plans = [].",
        "Each reminder must include category, title, description, and time_slot. icon_key, assignee_member_id, and notes are optional.",
        "category must use an existing CarePlan enum value.",
        "icon_key must be one of: medication, exercise, checkup, meal, rest, social, general.",
        "Do not output Markdown, bullet lists, or free-form explanations.",
    ]
)


def _build_model(settings: Settings) -> OpenAIChatModel | None:
    if not settings.ai_base_url or not settings.ai_api_key:
        return None
    return OpenAIChatModel(
        settings.ai_model,
        provider=OpenAIProvider(
            base_url=settings.ai_base_url,
            api_key=settings.ai_api_key,
        ),
    )


def _validated_snapshot(snapshot: DailyHealthSnapshot | dict[str, Any]) -> DailyHealthSnapshot:
    if isinstance(snapshot, DailyHealthSnapshot):
        return snapshot
    return DailyHealthSnapshot.model_validate(snapshot)


def _normalized_summary_bundle(bundle: DailyHealthSummaryBundle) -> DailyHealthSummaryBundle:
    return DailyHealthSummaryBundle(summaries=bundle.summaries[:4])
