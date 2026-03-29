from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from app.core.database import Database
from app.core.security import hash_password
from app.services import chat_sessions, health_repository, repository


DEMO_FAMILY_NAME = "Carter Family"
DEMO_PASSWORD = "KinCareDemo123!"
DEMO_TODAY = "2026-03-22"
RESET_TABLES: Sequence[str] = (
    "chat_message",
    "chat_session",
    "care_plan",
    "health_summary",
    "workout_record",
    "sleep_record",
    "encounter",
    "medication",
    "condition",
    "observation",
    "scheduled_task",
    "member_access_grant",
    "family_member",
    "user_account",
    "system_config",
    "family_space",
)


@dataclass(frozen=True)
class DemoAccountSpec:
    username: str
    email: str
    role: str
    member_profile: dict[str, Any]


def _observation(
    *,
    category: str,
    code: str,
    display_name: str,
    effective_at: str,
    value: float | None = None,
    value_string: str | None = None,
    unit: str | None = None,
    context: str | None = None,
    source: str = "manual",
    device_name: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    return {
        "category": category,
        "code": code,
        "display_name": display_name,
        "value": value,
        "value_string": value_string,
        "unit": unit,
        "context": context,
        "effective_at": effective_at,
        "source": source,
        "device_name": device_name,
        "notes": notes,
    }


def _condition(
    *,
    category: str,
    display_name: str,
    clinical_status: str,
    onset_date: str | None,
    notes: str,
) -> dict[str, Any]:
    return {
        "category": category,
        "display_name": display_name,
        "clinical_status": clinical_status,
        "onset_date": onset_date,
        "source": "manual",
        "notes": notes,
    }


def _medication(
    *,
    name: str,
    dosage_description: str,
    status: str,
    indication: str,
    start_date: str | None,
    end_date: str | None = None,
) -> dict[str, Any]:
    return {
        "name": name,
        "indication": indication,
        "dosage_description": dosage_description,
        "status": status,
        "start_date": start_date,
        "end_date": end_date,
        "source": "manual",
    }


def _encounter(
    *,
    encounter_type: str,
    facility: str,
    department: str,
    attending_physician: str,
    date: str,
    summary: str,
) -> dict[str, Any]:
    return {
        "type": encounter_type,
        "facility": facility,
        "department": department,
        "attending_physician": attending_physician,
        "date": date,
        "summary": summary,
        "source": "manual",
    }


def _sleep_record(
    *,
    start_at: str,
    end_at: str,
    total_minutes: int,
    deep_minutes: int | None,
    rem_minutes: int | None,
    light_minutes: int | None,
    awake_minutes: int | None,
    efficiency_score: float | None,
    is_nap: bool,
    source: str,
    device_name: str | None,
) -> dict[str, Any]:
    return {
        "start_at": start_at,
        "end_at": end_at,
        "total_minutes": total_minutes,
        "deep_minutes": deep_minutes,
        "rem_minutes": rem_minutes,
        "light_minutes": light_minutes,
        "awake_minutes": awake_minutes,
        "efficiency_score": efficiency_score,
        "is_nap": is_nap,
        "source": source,
        "device_name": device_name,
    }


def _workout_record(
    *,
    workout_type: str,
    start_at: str,
    end_at: str,
    duration_minutes: int,
    energy_burned: float | None,
    distance_meters: float | None,
    avg_heart_rate: int | None,
    source: str,
    device_name: str | None,
    notes: str,
) -> dict[str, Any]:
    return {
        "type": workout_type,
        "start_at": start_at,
        "end_at": end_at,
        "duration_minutes": duration_minutes,
        "energy_burned": energy_burned,
        "distance_meters": distance_meters,
        "avg_heart_rate": avg_heart_rate,
        "source": source,
        "device_name": device_name,
        "notes": notes,
    }


def _health_summary(
    *,
    category: str,
    label: str,
    value: str,
    status: str,
    generated_at: str,
) -> dict[str, Any]:
    return {
        "category": category,
        "label": label,
        "value": value,
        "status": status,
        "generated_at": generated_at,
    }


def _care_plan(
    *,
    category: str,
    title: str,
    description: str,
    status: str,
    scheduled_at: str | None,
    generated_by: str,
    assignee_member_id: str | None = None,
    icon_key: str | None = None,
    time_slot: str | None = None,
    notes: str | None = None,
    completed_at: str | None = None,
) -> dict[str, Any]:
    return {
        "assignee_member_id": assignee_member_id,
        "category": category,
        "icon_key": icon_key,
        "time_slot": time_slot,
        "title": title,
        "description": description,
        "notes": notes,
        "status": status,
        "scheduled_at": scheduled_at,
        "completed_at": completed_at,
        "generated_by": generated_by,
    }


def _demo_accounts() -> list[DemoAccountSpec]:
    return [
        DemoAccountSpec(
            username="daniel_demo",
            email="daniel.carter@example.com",
            role="admin",
            member_profile={
                "name": "Daniel Carter",
                "gender": "male",
                "birth_date": "1983-07-18",
                "height_cm": 182.0,
                "blood_type": "O+",
            },
        ),
        DemoAccountSpec(
            username="emily_demo",
            email="emily.carter@example.com",
            role="member",
            member_profile={
                "name": "Emily Carter",
                "gender": "female",
                "birth_date": "1986-02-03",
                "height_cm": 168.0,
                "blood_type": "A+",
            },
        ),
        DemoAccountSpec(
            username="evelyn_demo",
            email="evelyn.carter@example.com",
            role="member",
            member_profile={
                "name": "Evelyn Carter",
                "gender": "female",
                "birth_date": "1954-11-22",
                "height_cm": 160.0,
                "blood_type": "B+",
            },
        ),
        DemoAccountSpec(
            username="noah_demo",
            email="noah.carter@example.com",
            role="member",
            member_profile={
                "name": "Noah Carter",
                "gender": "male",
                "birth_date": "2010-09-14",
                "height_cm": 165.0,
                "blood_type": "O-",
            },
        ),
    ]


def _member_resources(member_ids: dict[str, str]) -> dict[str, dict[str, list[dict[str, Any]]]]:
    daniel_id = member_ids["Daniel Carter"]
    emily_id = member_ids["Emily Carter"]
    evelyn_id = member_ids["Evelyn Carter"]
    noah_id = member_ids["Noah Carter"]
    chloe_id = member_ids["Chloe Carter"]
    return {
        "Daniel Carter": {
            "observations": [
                _observation(
                    category="body-vitals",
                    code="heart-rate",
                    display_name="Resting heart rate",
                    effective_at="2026-03-22T06:45:00+08:00",
                    value=62,
                    unit="bpm",
                    source="device",
                    device_name="Apple Watch",
                ),
                _observation(
                    category="body-vitals",
                    code="body-weight",
                    display_name="Body weight",
                    effective_at="2026-03-22T06:50:00+08:00",
                    value=79.4,
                    unit="kg",
                    source="device",
                    device_name="Withings Scale",
                ),
                _observation(
                    category="lifestyle",
                    code="step-count",
                    display_name="Steps",
                    effective_at="2026-03-22T20:45:00+08:00",
                    value=8420,
                    unit="steps",
                    source="device",
                    device_name="Apple Watch",
                ),
                _observation(
                    category="lifestyle",
                    code="active-calories",
                    display_name="Active calories",
                    effective_at="2026-03-22T20:45:00+08:00",
                    value=612,
                    unit="kcal",
                    source="device",
                    device_name="Apple Watch",
                ),
                _observation(
                    category="lifestyle",
                    code="sleep-duration",
                    display_name="Sleep duration",
                    effective_at="2026-03-22T07:00:00+08:00",
                    value=446,
                    unit="min",
                    source="device",
                    device_name="Apple Watch",
                ),
            ],
            "conditions": [
                _condition(
                    category="chronic",
                    display_name="Borderline hyperlipidemia",
                    clinical_status="active",
                    onset_date="2024-05-01",
                    notes="Annual labs showed mildly elevated LDL. Maintaining exercise and lower saturated fat intake.",
                )
            ],
            "medications": [
                _medication(
                    name="Vitamin D3",
                    dosage_description="1 capsule every morning",
                    status="active",
                    indication="Daily supplementation",
                    start_date="2025-10-01",
                )
            ],
            "encounters": [
                _encounter(
                    encounter_type="checkup",
                    facility="Riverside Family Clinic",
                    department="Primary Care",
                    attending_physician="Dr. Megan Walsh",
                    date="2026-02-28",
                    summary="Annual physical with normal ECG and a recommendation to keep up aerobic exercise.",
                )
            ],
            "sleep-records": [
                _sleep_record(
                    start_at="2026-03-21T23:34:00+08:00",
                    end_at="2026-03-22T07:00:00+08:00",
                    total_minutes=446,
                    deep_minutes=92,
                    rem_minutes=104,
                    light_minutes=214,
                    awake_minutes=36,
                    efficiency_score=91.0,
                    is_nap=False,
                    source="device",
                    device_name="Apple Watch",
                )
            ],
            "workout-records": [
                _workout_record(
                    workout_type="strength training",
                    start_at="2026-03-21T18:40:00+08:00",
                    end_at="2026-03-21T19:25:00+08:00",
                    duration_minutes=45,
                    energy_burned=364,
                    distance_meters=None,
                    avg_heart_rate=118,
                    source="device",
                    device_name="Apple Watch",
                    notes="Upper-body and core circuit.",
                ),
                _workout_record(
                    workout_type="cycling",
                    start_at="2026-03-19T06:50:00+08:00",
                    end_at="2026-03-19T07:28:00+08:00",
                    duration_minutes=38,
                    energy_burned=298,
                    distance_meters=11800,
                    avg_heart_rate=126,
                    source="device",
                    device_name="Apple Watch",
                    notes="Moderate city ride before work.",
                ),
            ],
            "health-summaries": [
                _health_summary(
                    category="activity",
                    label="Training load",
                    value="This week looks balanced. Strength work and steps are both on target.",
                    status="good",
                    generated_at="2026-03-22T08:10:00+08:00",
                ),
                _health_summary(
                    category="recovery",
                    label="Sleep recovery",
                    value="Sleep dipped below 7.5 hours twice this week. Aim for an earlier bedtime after heavy workouts.",
                    status="warning",
                    generated_at="2026-03-22T08:10:00+08:00",
                ),
            ],
            "care-plans": [
                _care_plan(
                    assignee_member_id=daniel_id,
                    category="activity-reminder",
                    icon_key="exercise",
                    time_slot="晚间",
                    title="30-minute mobility session",
                    description="Do a lighter recovery block after dinner to offset desk time.",
                    notes="Foam roll calves and hips for at least 10 minutes.",
                    status="active",
                    scheduled_at="2026-03-22T19:30:00+08:00",
                    generated_by="ai",
                ),
                _care_plan(
                    assignee_member_id=daniel_id,
                    category="daily-tip",
                    icon_key="general",
                    time_slot="午后",
                    title="Pack tomorrow's lunch",
                    description="Prep a higher-protein lunch to avoid a late afternoon energy dip.",
                    status="completed",
                    scheduled_at="2026-03-21T17:30:00+08:00",
                    completed_at="2026-03-21T17:48:00+08:00",
                    generated_by="manual",
                ),
            ],
        },
        "Emily Carter": {
            "observations": [
                _observation(
                    category="body-vitals",
                    code="heart-rate",
                    display_name="Resting heart rate",
                    effective_at="2026-03-22T07:05:00+08:00",
                    value=68,
                    unit="bpm",
                    source="device",
                    device_name="Apple Watch",
                ),
                _observation(
                    category="body-vitals",
                    code="body-weight",
                    display_name="Body weight",
                    effective_at="2026-03-22T07:06:00+08:00",
                    value=61.8,
                    unit="kg",
                    source="device",
                    device_name="Withings Scale",
                ),
                _observation(
                    category="body-vitals",
                    code="body-temperature",
                    display_name="Body temperature",
                    effective_at="2026-03-22T07:12:00+08:00",
                    value=36.6,
                    unit="C",
                    source="device",
                    device_name="Braun ThermoScan",
                ),
                _observation(
                    category="lifestyle",
                    code="step-count",
                    display_name="Steps",
                    effective_at="2026-03-22T21:10:00+08:00",
                    value=7340,
                    unit="steps",
                    source="device",
                    device_name="Apple Watch",
                ),
                _observation(
                    category="lifestyle",
                    code="active-calories",
                    display_name="Active calories",
                    effective_at="2026-03-22T21:10:00+08:00",
                    value=438,
                    unit="kcal",
                    source="device",
                    device_name="Apple Watch",
                ),
            ],
            "conditions": [
                _condition(
                    category="diagnosis",
                    display_name="Migraine without aura",
                    clinical_status="active",
                    onset_date="2021-08-01",
                    notes="Usually triggered by dehydration and missed meals during busy work days.",
                ),
                _condition(
                    category="chronic",
                    display_name="Iron deficiency",
                    clinical_status="active",
                    onset_date="2025-11-10",
                    notes="Following up with repeat labs every 6 months.",
                ),
            ],
            "medications": [
                _medication(
                    name="Ferrous sulfate",
                    dosage_description="1 tablet after breakfast on weekdays",
                    status="active",
                    indication="Iron deficiency",
                    start_date="2025-11-15",
                )
            ],
            "encounters": [
                _encounter(
                    encounter_type="checkup",
                    facility="Riverside Family Clinic",
                    department="Primary Care",
                    attending_physician="Dr. Megan Walsh",
                    date="2026-01-30",
                    summary="Routine visit with repeat ferritin testing and migraine trigger review.",
                )
            ],
            "sleep-records": [
                _sleep_record(
                    start_at="2026-03-21T23:05:00+08:00",
                    end_at="2026-03-22T06:42:00+08:00",
                    total_minutes=457,
                    deep_minutes=81,
                    rem_minutes=97,
                    light_minutes=245,
                    awake_minutes=34,
                    efficiency_score=89.0,
                    is_nap=False,
                    source="device",
                    device_name="Apple Watch",
                )
            ],
            "workout-records": [
                _workout_record(
                    workout_type="yoga",
                    start_at="2026-03-20T20:10:00+08:00",
                    end_at="2026-03-20T20:48:00+08:00",
                    duration_minutes=38,
                    energy_burned=144,
                    distance_meters=None,
                    avg_heart_rate=92,
                    source="manual",
                    device_name=None,
                    notes="Evening mobility flow focused on shoulders and low back.",
                )
            ],
            "health-summaries": [
                _health_summary(
                    category="stress",
                    label="Stress load",
                    value="Headache triggers look better controlled this week, but hydration is still inconsistent on work days.",
                    status="warning",
                    generated_at="2026-03-22T08:12:00+08:00",
                ),
                _health_summary(
                    category="activity",
                    label="Movement pattern",
                    value="Daily steps are steady and evening yoga is helping recovery.",
                    status="good",
                    generated_at="2026-03-22T08:12:00+08:00",
                ),
            ],
            "care-plans": [
                _care_plan(
                    assignee_member_id=emily_id,
                    category="daily-tip",
                    icon_key="general",
                    time_slot="午后",
                    title="Hydration checkpoint",
                    description="Finish a second water bottle before 3 PM to reduce afternoon headache risk.",
                    notes="Pair this with a quick stretch break.",
                    status="active",
                    scheduled_at="2026-03-22T14:30:00+08:00",
                    generated_by="ai",
                ),
                _care_plan(
                    assignee_member_id=emily_id,
                    category="medication-reminder",
                    icon_key="medication",
                    time_slot="清晨",
                    title="Iron supplement reminder",
                    description="Take ferrous sulfate after breakfast on weekdays.",
                    status="completed",
                    scheduled_at="2026-03-21T08:20:00+08:00",
                    completed_at="2026-03-21T08:35:00+08:00",
                    generated_by="manual",
                ),
            ],
        },
        "Evelyn Carter": {
            "observations": [
                _observation(
                    category="chronic-vitals",
                    code="bp-systolic",
                    display_name="Systolic blood pressure",
                    effective_at="2026-03-18T07:40:00+08:00",
                    value=136,
                    unit="mmHg",
                    context="before breakfast",
                    notes="Home cuff reading.",
                ),
                _observation(
                    category="chronic-vitals",
                    code="bp-systolic",
                    display_name="Systolic blood pressure",
                    effective_at="2026-03-20T07:42:00+08:00",
                    value=132,
                    unit="mmHg",
                    context="before breakfast",
                    notes="Home cuff reading.",
                ),
                _observation(
                    category="chronic-vitals",
                    code="bp-systolic",
                    display_name="Systolic blood pressure",
                    effective_at="2026-03-22T07:38:00+08:00",
                    value=128,
                    unit="mmHg",
                    context="before breakfast",
                    notes="Steady improvement after consistent medication timing.",
                ),
                _observation(
                    category="chronic-vitals",
                    code="bp-diastolic",
                    display_name="Diastolic blood pressure",
                    effective_at="2026-03-18T07:40:00+08:00",
                    value=84,
                    unit="mmHg",
                    context="before breakfast",
                ),
                _observation(
                    category="chronic-vitals",
                    code="bp-diastolic",
                    display_name="Diastolic blood pressure",
                    effective_at="2026-03-20T07:42:00+08:00",
                    value=81,
                    unit="mmHg",
                    context="before breakfast",
                ),
                _observation(
                    category="chronic-vitals",
                    code="bp-diastolic",
                    display_name="Diastolic blood pressure",
                    effective_at="2026-03-22T07:38:00+08:00",
                    value=78,
                    unit="mmHg",
                    context="before breakfast",
                ),
                _observation(
                    category="chronic-vitals",
                    code="blood-glucose",
                    display_name="Fasting glucose",
                    effective_at="2026-03-18T07:05:00+08:00",
                    value=7.1,
                    unit="mmol/L",
                    context="fasting",
                ),
                _observation(
                    category="chronic-vitals",
                    code="blood-glucose",
                    display_name="Fasting glucose",
                    effective_at="2026-03-20T07:02:00+08:00",
                    value=6.8,
                    unit="mmol/L",
                    context="fasting",
                ),
                _observation(
                    category="chronic-vitals",
                    code="blood-glucose",
                    display_name="Fasting glucose",
                    effective_at="2026-03-22T07:01:00+08:00",
                    value=6.5,
                    unit="mmol/L",
                    context="fasting",
                    notes="Improved after lighter evening meals.",
                ),
            ],
            "conditions": [
                _condition(
                    category="chronic",
                    display_name="Hypertension",
                    clinical_status="active",
                    onset_date="2019-03-01",
                    notes="Managed with daily losartan and home blood pressure monitoring.",
                ),
                _condition(
                    category="chronic",
                    display_name="Type 2 diabetes",
                    clinical_status="active",
                    onset_date="2022-06-15",
                    notes="Diet, walking, and metformin are currently keeping fasting glucose in a moderate range.",
                ),
            ],
            "medications": [
                _medication(
                    name="Losartan",
                    dosage_description="50 mg every morning after breakfast",
                    status="active",
                    indication="Hypertension",
                    start_date="2024-01-10",
                ),
                _medication(
                    name="Metformin",
                    dosage_description="500 mg with breakfast and dinner",
                    status="active",
                    indication="Type 2 diabetes",
                    start_date="2022-06-20",
                ),
            ],
            "encounters": [
                _encounter(
                    encounter_type="outpatient",
                    facility="Northside Endocrinology Center",
                    department="Endocrinology",
                    attending_physician="Dr. Aisha Patel",
                    date="2026-03-12",
                    summary="Follow-up visit showed improving fasting glucose and no medication changes this month.",
                )
            ],
            "sleep-records": [
                _sleep_record(
                    start_at="2026-03-21T22:12:00+08:00",
                    end_at="2026-03-22T05:56:00+08:00",
                    total_minutes=464,
                    deep_minutes=76,
                    rem_minutes=88,
                    light_minutes=252,
                    awake_minutes=48,
                    efficiency_score=86.0,
                    is_nap=False,
                    source="device",
                    device_name="Xiaomi Band",
                ),
                _sleep_record(
                    start_at="2026-03-21T13:25:00+08:00",
                    end_at="2026-03-21T13:58:00+08:00",
                    total_minutes=33,
                    deep_minutes=None,
                    rem_minutes=None,
                    light_minutes=28,
                    awake_minutes=5,
                    efficiency_score=84.0,
                    is_nap=True,
                    source="manual",
                    device_name=None,
                ),
            ],
            "workout-records": [
                _workout_record(
                    workout_type="walking",
                    start_at="2026-03-22T09:10:00+08:00",
                    end_at="2026-03-22T09:46:00+08:00",
                    duration_minutes=36,
                    energy_burned=148,
                    distance_meters=2450,
                    avg_heart_rate=96,
                    source="manual",
                    device_name=None,
                    notes="Neighborhood walk with Emily.",
                )
            ],
            "health-summaries": [
                _health_summary(
                    category="blood pressure",
                    label="Blood pressure trend",
                    value="Home readings are moving down and are now close to the target range.",
                    status="good",
                    generated_at="2026-03-22T08:08:00+08:00",
                ),
                _health_summary(
                    category="glucose",
                    label="Fasting glucose",
                    value="Morning glucose is improving, but dinner portions still matter for the next-day result.",
                    status="warning",
                    generated_at="2026-03-22T08:08:00+08:00",
                ),
            ],
            "care-plans": [
                _care_plan(
                    assignee_member_id=evelyn_id,
                    category="medication-reminder",
                    icon_key="medication",
                    time_slot="清晨",
                    title="Breakfast medications",
                    description="Take losartan and the morning dose of metformin after breakfast.",
                    notes="Log blood pressure before taking medication.",
                    status="active",
                    scheduled_at="2026-03-22T08:10:00+08:00",
                    generated_by="manual",
                ),
                _care_plan(
                    assignee_member_id=evelyn_id,
                    category="checkup-reminder",
                    icon_key="checkup",
                    time_slot="上午",
                    title="Book eye screening",
                    description="Schedule a diabetic retinal screening before the end of April.",
                    status="active",
                    scheduled_at="2026-03-28T10:00:00+08:00",
                    generated_by="ai",
                ),
            ],
        },
        "Noah Carter": {
            "observations": [
                _observation(
                    category="body-vitals",
                    code="heart-rate",
                    display_name="Resting heart rate",
                    effective_at="2026-03-22T07:18:00+08:00",
                    value=58,
                    unit="bpm",
                    source="device",
                    device_name="Garmin Forerunner",
                ),
                _observation(
                    category="body-vitals",
                    code="blood-oxygen",
                    display_name="Blood oxygen",
                    effective_at="2026-03-22T07:18:00+08:00",
                    value=98,
                    unit="%",
                    source="device",
                    device_name="Garmin Forerunner",
                ),
                _observation(
                    category="body-vitals",
                    code="body-temperature",
                    display_name="Body temperature",
                    effective_at="2026-03-22T07:20:00+08:00",
                    value=36.7,
                    unit="C",
                    source="manual",
                ),
                _observation(
                    category="lifestyle",
                    code="step-count",
                    display_name="Steps",
                    effective_at="2026-03-22T20:30:00+08:00",
                    value=11240,
                    unit="steps",
                    source="device",
                    device_name="Garmin Forerunner",
                ),
                _observation(
                    category="lifestyle",
                    code="active-calories",
                    display_name="Active calories",
                    effective_at="2026-03-22T20:30:00+08:00",
                    value=724,
                    unit="kcal",
                    source="device",
                    device_name="Garmin Forerunner",
                ),
            ],
            "conditions": [
                _condition(
                    category="chronic",
                    display_name="Exercise-induced asthma",
                    clinical_status="active",
                    onset_date="2020-09-01",
                    notes="Usually controlled with a rescue inhaler before intense soccer sessions.",
                ),
                _condition(
                    category="allergy",
                    display_name="Peanut allergy",
                    clinical_status="active",
                    onset_date="2012-04-01",
                    notes="Carries emergency medication during school and sports activities.",
                ),
            ],
            "medications": [
                _medication(
                    name="Albuterol inhaler",
                    dosage_description="2 puffs 15 minutes before intense exercise as needed",
                    status="active",
                    indication="Exercise-induced asthma",
                    start_date="2020-09-01",
                )
            ],
            "encounters": [
                _encounter(
                    encounter_type="checkup",
                    facility="Riverside Pediatrics",
                    department="Sports Medicine",
                    attending_physician="Dr. Kevin Huang",
                    date="2026-02-18",
                    summary="Sports clearance visit with stable lung exam and updated inhaler technique review.",
                )
            ],
            "sleep-records": [
                _sleep_record(
                    start_at="2026-03-21T22:48:00+08:00",
                    end_at="2026-03-22T06:36:00+08:00",
                    total_minutes=468,
                    deep_minutes=98,
                    rem_minutes=103,
                    light_minutes=226,
                    awake_minutes=41,
                    efficiency_score=90.0,
                    is_nap=False,
                    source="device",
                    device_name="Garmin Forerunner",
                )
            ],
            "workout-records": [
                _workout_record(
                    workout_type="soccer practice",
                    start_at="2026-03-21T16:35:00+08:00",
                    end_at="2026-03-21T17:52:00+08:00",
                    duration_minutes=77,
                    energy_burned=612,
                    distance_meters=6240,
                    avg_heart_rate=144,
                    source="device",
                    device_name="Garmin Forerunner",
                    notes="High-intensity team drill with sprints.",
                )
            ],
            "health-summaries": [
                _health_summary(
                    category="sports",
                    label="Training readiness",
                    value="Cardio load is high but recovery markers still look strong heading into the weekend match.",
                    status="good",
                    generated_at="2026-03-22T08:15:00+08:00",
                ),
                _health_summary(
                    category="respiratory",
                    label="Asthma control",
                    value="No recent flare, but pre-exercise inhaler timing should stay consistent on colder days.",
                    status="warning",
                    generated_at="2026-03-22T08:15:00+08:00",
                ),
            ],
            "care-plans": [
                _care_plan(
                    assignee_member_id=noah_id,
                    category="activity-reminder",
                    icon_key="exercise",
                    time_slot="午后",
                    title="Easy recovery jog",
                    description="Keep today's movement light after yesterday's intense practice.",
                    notes="Stop if chest tightness shows up.",
                    status="active",
                    scheduled_at="2026-03-22T16:30:00+08:00",
                    generated_by="ai",
                ),
                _care_plan(
                    assignee_member_id=noah_id,
                    category="health-advice",
                    icon_key="general",
                    time_slot="晚间",
                    title="Pack inhaler for tomorrow",
                    description="Put the rescue inhaler and water bottle in the soccer bag before bed.",
                    status="active",
                    scheduled_at="2026-03-22T21:00:00+08:00",
                    generated_by="ai",
                ),
            ],
        },
        "Chloe Carter": {
            "observations": [
                _observation(
                    category="body-vitals",
                    code="body-temperature",
                    display_name="Body temperature",
                    effective_at="2026-03-22T07:32:00+08:00",
                    value=36.5,
                    unit="C",
                    source="manual",
                ),
                _observation(
                    category="lifestyle",
                    code="step-count",
                    display_name="Steps",
                    effective_at="2026-03-22T18:20:00+08:00",
                    value=6890,
                    unit="steps",
                    source="manual",
                    notes="Estimated school and playground activity.",
                ),
                _observation(
                    category="lifestyle",
                    code="sleep-duration",
                    display_name="Sleep duration",
                    effective_at="2026-03-22T07:10:00+08:00",
                    value=585,
                    unit="min",
                    source="manual",
                ),
            ],
            "conditions": [
                _condition(
                    category="allergy",
                    display_name="Seasonal allergic rhinitis",
                    clinical_status="active",
                    onset_date="2024-03-01",
                    notes="Symptoms are worse on high-pollen days during spring.",
                )
            ],
            "medications": [
                _medication(
                    name="Cetirizine",
                    dosage_description="5 mg in the evening as needed during allergy season",
                    status="active",
                    indication="Seasonal allergies",
                    start_date="2026-03-01",
                )
            ],
            "encounters": [
                _encounter(
                    encounter_type="checkup",
                    facility="Riverside Pediatrics",
                    department="Pediatrics",
                    attending_physician="Dr. Laura Kim",
                    date="2026-02-08",
                    summary="Well-child visit with normal growth, hearing, and vision screening.",
                )
            ],
            "sleep-records": [
                _sleep_record(
                    start_at="2026-03-21T21:22:00+08:00",
                    end_at="2026-03-22T07:07:00+08:00",
                    total_minutes=585,
                    deep_minutes=None,
                    rem_minutes=None,
                    light_minutes=542,
                    awake_minutes=43,
                    efficiency_score=93.0,
                    is_nap=False,
                    source="manual",
                    device_name=None,
                )
            ],
            "workout-records": [
                _workout_record(
                    workout_type="playground time",
                    start_at="2026-03-22T16:10:00+08:00",
                    end_at="2026-03-22T16:42:00+08:00",
                    duration_minutes=32,
                    energy_burned=110,
                    distance_meters=980,
                    avg_heart_rate=None,
                    source="manual",
                    device_name=None,
                    notes="Outdoor play after school.",
                )
            ],
            "health-summaries": [
                _health_summary(
                    category="allergy",
                    label="Pollen exposure",
                    value="Symptoms are mild this week, but evening congestion still appears after outdoor play.",
                    status="warning",
                    generated_at="2026-03-22T08:18:00+08:00",
                ),
                _health_summary(
                    category="sleep",
                    label="Sleep rhythm",
                    value="Bedtime is consistent and sleep duration remains age-appropriate.",
                    status="good",
                    generated_at="2026-03-22T08:18:00+08:00",
                ),
            ],
            "care-plans": [
                _care_plan(
                    assignee_member_id=chloe_id,
                    category="health-advice",
                    icon_key="rest",
                    time_slot="晚间",
                    title="Shower after outdoor play",
                    description="Rinse pollen from hair and change clothes before bedtime.",
                    status="active",
                    scheduled_at="2026-03-22T20:15:00+08:00",
                    generated_by="manual",
                )
            ],
        },
    }


def _reset_family_data(connection: Any) -> None:
    for table_name in RESET_TABLES:
        connection.execute(f"DELETE FROM {table_name}")


def _create_account(connection: Any, *, family_space_id: str, spec: DemoAccountSpec) -> tuple[dict[str, Any], dict[str, Any]]:
    user = repository.create_user(
        connection,
        family_space_id=family_space_id,
        username=spec.username,
        email=spec.email,
        password_hash=hash_password(DEMO_PASSWORD),
        role=spec.role,
    )
    member = repository.create_member(
        connection,
        family_space_id=family_space_id,
        user_account_id=user["id"],
        name=str(spec.member_profile["name"]),
        gender=str(spec.member_profile["gender"]),
        birth_date=str(spec.member_profile["birth_date"]),
        height_cm=float(spec.member_profile["height_cm"]),
        blood_type=str(spec.member_profile["blood_type"]),
    )
    return user, member


def _seed_member_resources(connection: Any, *, member_id: str, resources: dict[str, list[dict[str, Any]]]) -> None:
    for resource_name, items in resources.items():
        for item in items:
            health_repository.create_resource(
                connection,
                resource_name,
                member_id=member_id,
                values=item,
            )


def _seed_chat_sessions(
    connection: Any,
    *,
    users: dict[str, dict[str, Any]],
    members: dict[str, dict[str, Any]],
    family_space_id: str,
) -> None:
    session_specs = [
        {
            "owner": "Daniel Carter",
            "focus": "Evelyn Carter",
            "title": "Grandma's blood pressure this week",
            "page_context": "member-profile",
            "messages": [
                ("user", "Please summarize Grandma's blood pressure trend this week."),
                (
                    "assistant",
                    "Evelyn's home readings are improving. Her latest blood pressure is 128/78 mmHg, down from 136/84 earlier this week.",
                ),
                ("user", "What should we keep doing over the next few days?"),
                (
                    "assistant",
                    "Keep the breakfast medication routine steady, continue daily walks, and keep dinner portions moderate to support both blood pressure and glucose.",
                ),
            ],
        },
        {
            "owner": "Daniel Carter",
            "focus": "Noah Carter",
            "title": "Soccer recovery plan for Noah",
            "page_context": "dashboard",
            "messages": [
                ("user", "How is Noah doing after soccer practice yesterday?"),
                (
                    "assistant",
                    "His activity load was high, but recovery looks solid. Today's plan should stay light and include hydration plus inhaler prep for the next practice.",
                ),
                ("user", "Can you keep the advice simple for a teen?"),
                (
                    "assistant",
                    "Yes. Easy jog only, drink water during the afternoon, and pack the inhaler before bed so tomorrow starts smoothly.",
                ),
            ],
        },
        {
            "owner": "Emily Carter",
            "focus": None,
            "title": "Weekly family check-in",
            "page_context": "dashboard",
            "messages": [
                ("user", "Give me a quick family health check-in for this week."),
                (
                    "assistant",
                    "Evelyn is trending in the right direction with blood pressure, Noah is active with stable asthma control, Chloe's allergies are mild, and both adults should watch recovery and hydration.",
                ),
                ("user", "Which reminders matter most today?"),
                (
                    "assistant",
                    "Prioritize Evelyn's breakfast medications, Emily's hydration check, Noah's recovery pacing, and Chloe's evening rinse after outdoor play.",
                ),
            ],
        },
    ]
    for spec in session_specs:
        owner = users[spec["owner"]]
        focus_member = members[spec["focus"]]["id"] if spec["focus"] is not None else None
        session = chat_sessions.create_session(
            connection,
            user_id=owner["id"],
            family_space_id=family_space_id,
            member_id=focus_member,
            page_context=spec["page_context"],
            title=spec["title"],
        )
        for role, content in spec["messages"]:
            chat_sessions.create_message(
                connection,
                session_id=session["id"],
                role=role,
                content=content,
            )
        chat_sessions.update_session_summary(
            connection,
            session["id"],
            summary=spec["messages"][1][1],
            title=spec["title"],
        )


def seed_demo_family(database: Database) -> dict[str, Any]:
    database.initialize()
    with database.connection() as connection:
        _reset_family_data(connection)
        family_space = repository.create_family_space(connection, name=DEMO_FAMILY_NAME)

        users_by_member_name: dict[str, dict[str, Any]] = {}
        members_by_name: dict[str, dict[str, Any]] = {}
        account_summaries: list[dict[str, str]] = []
        for spec in _demo_accounts():
            user, member = _create_account(connection, family_space_id=family_space["id"], spec=spec)
            member_name = str(member["name"])
            users_by_member_name[member_name] = user
            members_by_name[member_name] = member
            account_summaries.append(
                {
                    "username": spec.username,
                    "role": spec.role,
                    "member_name": member_name,
                }
            )

        chloe = repository.create_member(
            connection,
            family_space_id=family_space["id"],
            name="Chloe Carter",
            gender="female",
            birth_date="2017-05-06",
            height_cm=128.0,
            blood_type="A+",
        )
        members_by_name[chloe["name"]] = chloe

        health_repository.upsert_member_access_grant(
            connection,
            member_id=None,
            user_account_id=users_by_member_name["Emily Carter"]["id"],
            permission_level="manage",
            target_scope="all",
        )
        health_repository.upsert_member_access_grant(
            connection,
            member_id=None,
            user_account_id=users_by_member_name["Evelyn Carter"]["id"],
            permission_level="read",
            target_scope="all",
        )
        health_repository.upsert_member_access_grant(
            connection,
            member_id=members_by_name["Evelyn Carter"]["id"],
            user_account_id=users_by_member_name["Noah Carter"]["id"],
            permission_level="read",
            target_scope="specific",
        )

        resources_by_member = _member_resources({name: member["id"] for name, member in members_by_name.items()})
        for member_name, resources in resources_by_member.items():
            _seed_member_resources(connection, member_id=members_by_name[member_name]["id"], resources=resources)

        _seed_chat_sessions(
            connection,
            users=users_by_member_name,
            members=members_by_name,
            family_space_id=family_space["id"],
        )

    return {
        "family_space": family_space,
        "password": DEMO_PASSWORD,
        "accounts": account_summaries,
    }
