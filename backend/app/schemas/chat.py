from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.schemas.health import ConditionCategory, ConditionStatus, EncounterType, MedicationStatus, ObservationCategory


class ChatSessionCreate(BaseModel):
    member_id: str | None = None
    page_context: str | None = None


class ChatSessionRead(BaseModel):
    id: str
    user_id: str
    family_space_id: str
    member_id: str | None = None
    title: str | None = None
    summary: str | None = None
    page_context: str | None = None
    created_at: str
    updated_at: str


class ChatSessionListItem(BaseModel):
    id: str
    member_id: str | None = None
    title: str | None = None
    summary: str | None = None
    updated_at: str


class ChatMessageCreate(BaseModel):
    content: str
    member_id: str | None = None
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


class ChatMessageRead(BaseModel):
    id: str
    role: str
    content: str
    event_type: str | None = None
    metadata: dict[str, Any] | None = None
    created_at: str


class HealthRecordObservationDraft(BaseModel):
    category: ObservationCategory
    code: str
    display_name: str
    value: float | None = None
    value_string: str | None = None
    unit: str | None = None
    context: str | None = None
    effective_at: str
    notes: str | None = None


class HealthRecordConditionDraft(BaseModel):
    category: ConditionCategory
    display_name: str
    clinical_status: ConditionStatus
    onset_date: str | None = None
    notes: str | None = None


class HealthRecordMedicationDraft(BaseModel):
    name: str
    indication: str | None = None
    dosage_description: str | None = None
    status: MedicationStatus
    start_date: str | None = None
    end_date: str | None = None


class HealthRecordEncounterDraft(BaseModel):
    type: EncounterType
    facility: str | None = None
    department: str | None = None
    attending_physician: str | None = None
    date: str
    summary: str | None = None


class HealthRecordDraft(BaseModel):
    summary: str = ""
    observations: list[HealthRecordObservationDraft] = Field(default_factory=list)
    conditions: list[HealthRecordConditionDraft] = Field(default_factory=list)
    medications: list[HealthRecordMedicationDraft] = Field(default_factory=list)
    encounters: list[HealthRecordEncounterDraft] = Field(default_factory=list)


class ChatDraftConfirmRequest(BaseModel):
    approvals: dict[str, bool] = Field(default_factory=dict)
    edits: dict[str, HealthRecordDraft] = Field(default_factory=dict)


class ChatDraftConfirmResult(BaseModel):
    created_counts: dict[str, int]
    assistant_message: str


class ChatToolResult(BaseModel):
    tool_name: str
    content: str
    requires_confirmation: bool = False
    draft: HealthRecordDraft | None = None
    meta: dict[str, Any] = Field(default_factory=dict)
