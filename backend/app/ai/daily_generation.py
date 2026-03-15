from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.core.config import Settings
from app.schemas.health import CarePlanCategory, HealthSummaryStatus, ObservationCategory


TimeSlot = Literal["morning", "afternoon", "evening"]


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
    category: ObservationCategory
    label: str
    value: str
    status: HealthSummaryStatus

    @field_validator("label", "value")
    @classmethod
    def validate_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field is required.")
        return cleaned


class DailyHealthSummaryBundle(BaseModel):
    summaries: list[DailyHealthSummaryItem]

    @model_validator(mode="after")
    def validate_summary_categories(self) -> DailyHealthSummaryBundle:
        categories = {item.category for item in self.summaries}
        expected = {"chronic-vitals", "lifestyle", "body-vitals"}
        if categories != expected or len(self.summaries) != 3:
            raise ValueError("Daily health summaries must include exactly one item for each homepage category.")
        return self


class DailyCarePlanDraft(BaseModel):
    category: CarePlanCategory
    title: str
    description: str
    time_slot: TimeSlot

    @field_validator("title", "description")
    @classmethod
    def validate_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field is required.")
        return cleaned


class DailyCarePlanDecision(BaseModel):
    care_plan: DailyCarePlanDraft | None = None


class DailyGenerationResult(BaseModel):
    summaries: DailyHealthSummaryBundle | None = None
    care_plan: DailyCarePlanDraft | None = None


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

    async def generate_health_summaries(self, snapshot: DailyHealthSnapshot) -> DailyHealthSummaryBundle:
        if self.summary_agent is None:
            raise RuntimeError("AI daily generation is not configured.")
        validated_snapshot = _validated_snapshot(snapshot)
        result = await self.summary_agent.run(_snapshot_prompt(validated_snapshot))
        return result.output

    async def generate_care_plan(self, snapshot: DailyHealthSnapshot) -> DailyCarePlanDecision:
        if self.care_plan_agent is None:
            raise RuntimeError("AI daily generation is not configured.")
        validated_snapshot = _validated_snapshot(snapshot)
        result = await self.care_plan_agent.run(_snapshot_prompt(validated_snapshot))
        return result.output


def _snapshot_prompt(snapshot: DailyHealthSnapshot) -> str:
    return "\n".join(
        [
            "请严格基于以下家庭成员健康快照生成结构化结果，不要编造不存在的数据。",
            json.dumps(snapshot.model_dump(mode="json"), ensure_ascii=False, indent=2),
        ]
    )


SUMMARY_AGENT_INSTRUCTIONS = "\n".join(
    [
        "你负责为 HomeVital 首页生成每日健康摘要。",
        "只能使用输入快照中的事实，不要补充未提供的数据。",
        "输出必须包含且只包含 3 条摘要，类别固定为 chronic-vitals、lifestyle、body-vitals。",
        "label 使用中文短标题，value 用一句简短中文说明，status 只能是 good、warning、neutral。",
        "不要输出 Markdown、列表或自由文本解释。",
    ]
)


CARE_PLAN_AGENT_INSTRUCTIONS = "\n".join(
    [
        "你负责为 HomeVital 生成当天最多 1 条 AI 提醒。",
        "只能使用输入快照中的事实，不要编造不存在的数据。",
        "如果今天没有明确且有价值的提醒，就返回 care_plan = null。",
        "如果返回提醒，category 只能使用现有 CarePlan 枚举，title 与 description 用中文简洁表达。",
        "time_slot 只能是 morning、afternoon、evening，分别表示 09:00、14:00、20:00。",
        "不要输出 Markdown、列表或自由文本解释。",
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
