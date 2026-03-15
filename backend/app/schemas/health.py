from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


ObservationCategory = Literal["chronic-vitals", "lifestyle", "body-vitals"]
ObservationSource = Literal["manual", "device", "ai-extract"]
ClinicalRecordSource = Literal["manual", "ai-extract"]
ConditionCategory = Literal["diagnosis", "chronic", "allergy", "family-history"]
ConditionStatus = Literal["active", "inactive", "resolved"]
MedicationStatus = Literal["active", "stopped"]
EncounterType = Literal["outpatient", "inpatient", "checkup", "emergency"]
CarePlanCategory = Literal[
    "medication-reminder",
    "activity-reminder",
    "checkup-reminder",
    "health-advice",
    "daily-tip",
]
CarePlanStatus = Literal["active", "completed", "cancelled"]
CarePlanGeneratedBy = Literal["ai", "manual"]
HealthSummaryStatus = Literal["good", "warning", "neutral"]


class ObservationBase(BaseModel):
    category: ObservationCategory
    code: str
    display_name: str
    value: float | None = None
    value_string: str | None = None
    unit: str | None = None
    context: str | None = None
    effective_at: str
    source: ObservationSource
    device_name: str | None = None
    notes: str | None = None

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
    context: str | None = None
    effective_at: str | None = None
    source: ObservationSource | None = None
    device_name: str | None = None
    notes: str | None = None

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
    display_name: str
    clinical_status: ConditionStatus
    onset_date: str | None = None
    source: ClinicalRecordSource
    notes: str | None = None

    @field_validator("display_name")
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
    display_name: str | None = None
    clinical_status: ConditionStatus | None = None
    onset_date: str | None = None
    source: ClinicalRecordSource | None = None
    notes: str | None = None

    @field_validator("display_name")
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
    name: str
    indication: str | None = None
    dosage_description: str | None = None
    status: MedicationStatus
    start_date: str | None = None
    end_date: str | None = None
    source: ClinicalRecordSource

    @field_validator("name")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Medication name is required.")
        return cleaned


class MedicationCreate(MedicationBase):
    pass


class MedicationUpdate(BaseModel):
    name: str | None = None
    indication: str | None = None
    dosage_description: str | None = None
    status: MedicationStatus | None = None
    start_date: str | None = None
    end_date: str | None = None
    source: ClinicalRecordSource | None = None

    @field_validator("name")
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
    attending_physician: str | None = None
    date: str
    summary: str | None = None
    source: ClinicalRecordSource


class EncounterCreate(EncounterBase):
    pass


class EncounterUpdate(BaseModel):
    type: EncounterType | None = None
    facility: str | None = None
    department: str | None = None
    attending_physician: str | None = None
    date: str | None = None
    summary: str | None = None
    source: ClinicalRecordSource | None = None


class EncounterRead(EncounterBase):
    id: str
    member_id: str
    created_at: str
    updated_at: str


class SleepRecordBase(BaseModel):
    start_at: str
    end_at: str
    total_minutes: int
    deep_minutes: int | None = None
    rem_minutes: int | None = None
    light_minutes: int | None = None
    awake_minutes: int | None = None
    efficiency_score: float | None = None
    is_nap: bool = False
    source: ObservationSource
    device_name: str | None = None


class SleepRecordCreate(SleepRecordBase):
    pass


class SleepRecordUpdate(BaseModel):
    start_at: str | None = None
    end_at: str | None = None
    total_minutes: int | None = None
    deep_minutes: int | None = None
    rem_minutes: int | None = None
    light_minutes: int | None = None
    awake_minutes: int | None = None
    efficiency_score: float | None = None
    is_nap: bool | None = None
    source: ObservationSource | None = None
    device_name: str | None = None


class SleepRecordRead(SleepRecordBase):
    id: str
    member_id: str
    created_at: str


class WorkoutRecordBase(BaseModel):
    type: str
    start_at: str
    end_at: str
    duration_minutes: int
    energy_burned: float | None = None
    distance_meters: float | None = None
    avg_heart_rate: int | None = None
    source: ObservationSource
    device_name: str | None = None
    notes: str | None = None

    @field_validator("type")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Workout type is required.")
        return cleaned


class WorkoutRecordCreate(WorkoutRecordBase):
    pass


class WorkoutRecordUpdate(BaseModel):
    type: str | None = None
    start_at: str | None = None
    end_at: str | None = None
    duration_minutes: int | None = None
    energy_burned: float | None = None
    distance_meters: float | None = None
    avg_heart_rate: int | None = None
    source: ObservationSource | None = None
    device_name: str | None = None
    notes: str | None = None

    @field_validator("type")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Workout type is required.")
        return cleaned


class WorkoutRecordRead(WorkoutRecordBase):
    id: str
    member_id: str
    created_at: str


class HealthSummaryBase(BaseModel):
    category: ObservationCategory
    label: str
    value: str
    status: HealthSummaryStatus
    generated_at: str

    @field_validator("label", "value")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field is required.")
        return cleaned


class HealthSummaryCreate(HealthSummaryBase):
    pass


class HealthSummaryUpdate(BaseModel):
    category: ObservationCategory | None = None
    label: str | None = None
    value: str | None = None
    status: HealthSummaryStatus | None = None
    generated_at: str | None = None

    @field_validator("label", "value")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field is required.")
        return cleaned


class HealthSummaryRead(HealthSummaryBase):
    id: str
    member_id: str
    created_at: str


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


class DashboardMemberSummary(BaseModel):
    member: DashboardMember
    health_summaries: list[HealthSummaryRead] = Field(default_factory=list)


class DashboardReminder(CarePlanRead):
    member_name: str


class DashboardRead(BaseModel):
    members: list[DashboardMemberSummary]
    today_reminders: list[DashboardReminder]
