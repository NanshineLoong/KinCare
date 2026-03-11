from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


ObservationCategory = Literal["vital-signs", "laboratory", "activity", "sleep", "other"]
ObservationSource = Literal["manual", "document-extract", "device"]
ConditionCategory = Literal["diagnosis", "chronic", "allergy", "symptom"]
ConditionStatus = Literal["active", "recurrence", "inactive", "resolved"]
ConditionSeverity = Literal["mild", "moderate", "severe"]
MedicationStatus = Literal["active", "completed", "stopped"]
EncounterType = Literal["outpatient", "inpatient", "checkup", "emergency"]
DocumentType = Literal["checkup-report", "lab-result", "prescription", "discharge-summary", "other"]
ExtractionStatus = Literal["pending", "processing", "completed", "failed"]
CarePlanCategory = Literal[
    "medication-reminder",
    "followup-reminder",
    "health-advice",
    "daily-tip",
]
CarePlanStatus = Literal["active", "completed", "cancelled"]
CarePlanGeneratedBy = Literal["ai", "manual"]


class ObservationBase(BaseModel):
    category: ObservationCategory
    code: str
    display_name: str
    value: float | None = None
    value_string: str | None = None
    unit: str | None = None
    effective_at: str
    source: ObservationSource
    source_ref: str | None = None
    notes: str | None = None
    encounter_id: str | None = None

    @field_validator("code", "display_name")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field is required.")
        return cleaned


class ObservationCreate(ObservationBase):
    pass


class ObservationUpdate(BaseModel):
    category: ObservationCategory | None = None
    code: str | None = None
    display_name: str | None = None
    value: float | None = None
    value_string: str | None = None
    unit: str | None = None
    effective_at: str | None = None
    source: ObservationSource | None = None
    source_ref: str | None = None
    notes: str | None = None
    encounter_id: str | None = None

    @field_validator("code", "display_name")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field is required.")
        return cleaned


class ObservationRead(ObservationBase):
    id: str
    member_id: str
    created_at: str
    updated_at: str


class ConditionBase(BaseModel):
    category: ConditionCategory
    code: str
    display_name: str
    clinical_status: ConditionStatus
    onset_date: str | None = None
    abatement_date: str | None = None
    severity: ConditionSeverity | None = None
    source: ObservationSource
    source_ref: str | None = None
    notes: str | None = None
    encounter_id: str | None = None

    @field_validator("code", "display_name")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field is required.")
        return cleaned


class ConditionCreate(ConditionBase):
    pass


class ConditionUpdate(BaseModel):
    category: ConditionCategory | None = None
    code: str | None = None
    display_name: str | None = None
    clinical_status: ConditionStatus | None = None
    onset_date: str | None = None
    abatement_date: str | None = None
    severity: ConditionSeverity | None = None
    source: ObservationSource | None = None
    source_ref: str | None = None
    notes: str | None = None
    encounter_id: str | None = None

    @field_validator("code", "display_name")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field is required.")
        return cleaned


class ConditionRead(ConditionBase):
    id: str
    member_id: str
    created_at: str
    updated_at: str


class MedicationBase(BaseModel):
    medication_name: str
    dosage: str | None = None
    status: MedicationStatus
    start_date: str | None = None
    end_date: str | None = None
    reason: str | None = None
    prescribed_by: str | None = None
    source: ObservationSource
    source_ref: str | None = None
    notes: str | None = None
    encounter_id: str | None = None

    @field_validator("medication_name")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Medication name is required.")
        return cleaned


class MedicationCreate(MedicationBase):
    pass


class MedicationUpdate(BaseModel):
    medication_name: str | None = None
    dosage: str | None = None
    status: MedicationStatus | None = None
    start_date: str | None = None
    end_date: str | None = None
    reason: str | None = None
    prescribed_by: str | None = None
    source: ObservationSource | None = None
    source_ref: str | None = None
    notes: str | None = None
    encounter_id: str | None = None

    @field_validator("medication_name")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Medication name is required.")
        return cleaned


class MedicationRead(MedicationBase):
    id: str
    member_id: str
    created_at: str
    updated_at: str


class EncounterBase(BaseModel):
    type: EncounterType
    facility: str | None = None
    department: str | None = None
    date: str
    summary: str | None = None
    source: ObservationSource
    source_ref: str | None = None


class EncounterCreate(EncounterBase):
    pass


class EncounterUpdate(BaseModel):
    type: EncounterType | None = None
    facility: str | None = None
    department: str | None = None
    date: str | None = None
    summary: str | None = None
    source: ObservationSource | None = None
    source_ref: str | None = None


class EncounterRead(EncounterBase):
    id: str
    member_id: str
    created_at: str
    updated_at: str


class DocumentReferenceBase(BaseModel):
    doc_type: DocumentType
    file_path: str
    file_name: str
    mime_type: str
    extraction_status: ExtractionStatus = "pending"
    extracted_at: str | None = None
    raw_extraction: dict[str, Any] | None = None

    @field_validator("file_path", "file_name", "mime_type")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field is required.")
        return cleaned


class DocumentReferenceCreate(DocumentReferenceBase):
    pass


class DocumentReferenceUpdate(BaseModel):
    doc_type: DocumentType | None = None
    file_path: str | None = None
    file_name: str | None = None
    mime_type: str | None = None
    extraction_status: ExtractionStatus | None = None
    extracted_at: str | None = None
    raw_extraction: dict[str, Any] | None = None

    @field_validator("file_path", "file_name", "mime_type")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field is required.")
        return cleaned


class DocumentReferenceRead(DocumentReferenceBase):
    id: str
    member_id: str
    uploaded_by: str
    created_at: str
    updated_at: str


class CarePlanBase(BaseModel):
    category: CarePlanCategory
    title: str
    description: str
    status: CarePlanStatus
    scheduled_at: str | None = None
    completed_at: str | None = None
    generated_by: CarePlanGeneratedBy

    @field_validator("title", "description")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field is required.")
        return cleaned


class CarePlanCreate(CarePlanBase):
    pass


class CarePlanUpdate(BaseModel):
    category: CarePlanCategory | None = None
    title: str | None = None
    description: str | None = None
    status: CarePlanStatus | None = None
    scheduled_at: str | None = None
    completed_at: str | None = None
    generated_by: CarePlanGeneratedBy | None = None

    @field_validator("title", "description")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field is required.")
        return cleaned


class CarePlanRead(CarePlanBase):
    id: str
    member_id: str
    created_at: str
    updated_at: str


class ObservationTrendPoint(BaseModel):
    id: str
    effective_at: str
    value: float | None = None
    value_string: str | None = None
    unit: str | None = None
    notes: str | None = None


class ObservationTrendRead(BaseModel):
    member_id: str
    code: str
    display_name: str | None = None
    points: list[ObservationTrendPoint]


class DashboardMember(BaseModel):
    id: str
    name: str
    gender: str
    avatar_url: str | None = None
    blood_type: str | None = None


class ObservationSnapshot(BaseModel):
    code: str
    display_name: str
    value: float | None = None
    value_string: str | None = None
    unit: str | None = None
    effective_at: str


class DashboardMemberSummary(BaseModel):
    member: DashboardMember
    latest_observations: dict[str, ObservationSnapshot] = Field(default_factory=dict)
    active_conditions: list[str] = Field(default_factory=list)
    active_medications_count: int = 0
    latest_encounter: EncounterRead | None = None


class DashboardReminder(CarePlanRead):
    member_name: str


class DashboardRead(BaseModel):
    members: list[DashboardMemberSummary]
    today_reminders: list[DashboardReminder]
