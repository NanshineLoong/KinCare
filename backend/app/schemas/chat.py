from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.schemas.health import (
    CarePlanCategory,
    CarePlanGeneratedBy,
    CarePlanStatus,
    ConditionCategory,
    ConditionStatus,
    EncounterType,
    MedicationStatus,
    ObservationCategory,
)


class ChatSessionCreate(BaseModel):
    member_id: str | None = None
    page_context: str | None = None


class ChatSessionRead(BaseModel):
    id: str
    user_id: str
    family_space_id: str
    member_id: str | None = None
    title: str | None = None
    page_context: str | None = None
    created_at: str
    updated_at: str


class ChatMessageCreate(BaseModel):
    content: str
    member_id: str | None = None
    document_ids: list[str] = Field(default_factory=list)
    page_context: str | None = None

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Message content is required.")
        return cleaned


class ChatTranscriptionRead(BaseModel):
    text: str


class ExtractionObservationDraft(BaseModel):
    category: ObservationCategory
    code: str
    display_name: str
    value: float | None = None
    value_string: str | None = None
    unit: str | None = None
    context: str | None = None
    effective_at: str
    notes: str | None = None


class ExtractionConditionDraft(BaseModel):
    category: ConditionCategory
    display_name: str
    clinical_status: ConditionStatus
    onset_date: str | None = None
    notes: str | None = None


class ExtractionMedicationDraft(BaseModel):
    name: str
    indication: str | None = None
    dosage_description: str | None = None
    status: MedicationStatus
    start_date: str | None = None
    end_date: str | None = None


class ExtractionEncounterDraft(BaseModel):
    type: EncounterType
    facility: str | None = None
    department: str | None = None
    attending_physician: str | None = None
    date: str
    summary: str | None = None


class ExtractionCarePlanDraft(BaseModel):
    category: CarePlanCategory
    title: str
    description: str
    status: CarePlanStatus
    scheduled_at: str | None = None
    completed_at: str | None = None
    generated_by: CarePlanGeneratedBy = "ai"


class DocumentExtractionDraft(BaseModel):
    summary: str = ""
    observations: list[ExtractionObservationDraft] = Field(default_factory=list)
    conditions: list[ExtractionConditionDraft] = Field(default_factory=list)
    medications: list[ExtractionMedicationDraft] = Field(default_factory=list)
    encounters: list[ExtractionEncounterDraft] = Field(default_factory=list)
    care_plans: list[ExtractionCarePlanDraft] = Field(default_factory=list)


class ChatDraftConfirmRequest(BaseModel):
    member_id: str
    draft: DocumentExtractionDraft


class ChatDraftConfirmResult(BaseModel):
    created_counts: dict[str, int]


class ChatToolResult(BaseModel):
    tool_name: str
    content: str
    requires_confirmation: bool = False
    draft: DocumentExtractionDraft | None = None
    meta: dict[str, Any] = Field(default_factory=dict)
