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

    async def generate_health_summaries(self, snapshot: DailyHealthSnapshot) -> DailyHealthSummaryBundle:
        if self.summary_agent is None:
            raise RuntimeError("AI daily generation is not configured.")
        validated_snapshot = _validated_snapshot(snapshot)
        result = await self.summary_agent.run(_snapshot_prompt(validated_snapshot))
        return _normalized_summary_bundle(result.output)

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
        "按重要程度从高到低输出 0-4 条结构化摘要；如果没有值得提示的状态，返回 summaries = []。",
        "category 与 label 使用中文动态主题，不要复用固定分类，也不要为了凑数补标题。",
        "label 使用中文短标题，value 用一句简短中文说明，status 只能是 good、warning、alert。",
        "不要输出 Markdown、列表或自由文本解释。",
    ]
)


CARE_PLAN_AGENT_INSTRUCTIONS = "\n".join(
    [
        "你负责为 HomeVital 生成当天 0-3 条 AI 提醒。",
        "只能使用输入快照中的事实，不要编造不存在的数据。",
        "如果今天没有明确且有价值的提醒，就返回 care_plans = []。",
        "每条提醒都必须包含 category、title、description、time_slot；可选返回 icon_key、assignee_member_id、notes。",
        "category 只能使用现有 CarePlan 枚举。",
        "icon_key 只能使用 medication、exercise、checkup、meal、rest、social、general。",
        "time_slot 只能使用 清晨、上午、午后、晚间、睡前。",
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


def _normalized_summary_bundle(bundle: DailyHealthSummaryBundle) -> DailyHealthSummaryBundle:
    return DailyHealthSummaryBundle(summaries=bundle.summaries[:4])
