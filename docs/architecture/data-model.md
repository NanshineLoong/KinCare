# KinCare Health Data Model

> This document defines KinCare's current health data model. The overall resource-oriented direction inherits from ADR-0001, while the current fields, permissions, and session semantics follow [ADR-0009](../adr/0009-simplified-health-fact-layer.md) and [ADR-0011](../adr/0011-three-level-member-permissions.md).

## Design Goals

1. Make the family dashboard, member profiles, and AI tools work around one shared set of resources
2. Clearly separate static profiles, health facts, AI-generated outputs, permission grants, and session history
3. Let the home aggregation view and member overview reuse the same summary and reminder semantics
4. Use an explicit member-level permission model to constrain reads, writes, and authorization management
5. Do not maintain parallel page-specific tables or restore old resource paths

## Resource Overview

```text
FamilyMember
  ├── Observation
  ├── SleepRecord
  ├── WorkoutRecord
  ├── Condition
  ├── Medication
  ├── Encounter
  ├── HealthSummary
  └── CarePlan

Support Models
  ├── FamilySpace
  ├── UserAccount
  ├── MemberAccessGrant
  ├── ChatSession
  ├── ChatMessage
  └── ScheduledTask
```

## Core Resources

### FamilyMember

Static member profile data, keeping only basic information.

| Field | Type | Description |
|---|---|---|
| id | TEXT | Primary key |
| family_space_id | TEXT | Owning family space |
| user_account_id | TEXT? | Optional bound account |
| name | TEXT | Name |
| gender | TEXT | `male / female / other / unknown` |
| birth_date | TEXT? | Birth date |
| height_cm | REAL? | Height |
| blood_type | TEXT? | Blood type |
| avatar_url | TEXT? | Avatar |
| created_at | TEXT | Created time |
| updated_at | TEXT | Updated time |

`allergies` and `medical_history` no longer belong to `FamilyMember`; they are carried uniformly by `Condition`.

### Observation

Time-series records for quantified health metrics.

| Field | Type | Description |
|---|---|---|
| id | TEXT | Primary key |
| member_id | TEXT | FK → `FamilyMember` |
| category | TEXT | `chronic-vitals / lifestyle / body-vitals` |
| code | TEXT | Metric code |
| display_name | TEXT | Metric display name |
| value | REAL? | Numeric result |
| value_string | TEXT? | Text result |
| unit | TEXT? | Unit |
| context | TEXT? | Measurement context, such as fasting or post-meal |
| effective_at | TEXT | Measurement time |
| source | TEXT | `device / manual` |
| device_name | TEXT? | Source device name |
| notes | TEXT? | Notes |
| created_at | TEXT | Created time |
| updated_at | TEXT | Updated time |

### SleepRecord

Sleep is event-shaped data and is no longer forced into `Observation`.

| Field | Type | Description |
|---|---|---|
| id | TEXT | Primary key |
| member_id | TEXT | FK → `FamilyMember` |
| start_at | TEXT | Sleep start time |
| end_at | TEXT | Wake-up time |
| total_minutes | INTEGER | Total sleep duration |
| deep_minutes | INTEGER? | Deep sleep duration |
| rem_minutes | INTEGER? | REM duration |
| light_minutes | INTEGER? | Light sleep duration |
| awake_minutes | INTEGER? | Awake duration |
| efficiency_score | REAL? | Sleep efficiency |
| is_nap | INTEGER | Whether it is a nap |
| source | TEXT | `device / manual` |
| device_name | TEXT? | Device name |
| created_at | TEXT | Created time |

### WorkoutRecord

Workout is an independent event-shaped resource.

| Field | Type | Description |
|---|---|---|
| id | TEXT | Primary key |
| member_id | TEXT | FK → `FamilyMember` |
| type | TEXT | Workout type |
| start_at | TEXT | Start time |
| end_at | TEXT | End time |
| duration_minutes | INTEGER | Workout duration |
| energy_burned | REAL? | Calories burned |
| distance_meters | REAL? | Distance |
| avg_heart_rate | INTEGER? | Average heart rate |
| source | TEXT | `device / manual` |
| device_name | TEXT? | Device name |
| notes | TEXT? | Notes |
| created_at | TEXT | Created time |

### Condition

Uniformly represents current conditions, medical history, family history, and allergies.

| Field | Type | Description |
|---|---|---|
| id | TEXT | Primary key |
| member_id | TEXT | FK → `FamilyMember` |
| category | TEXT | `chronic / diagnosis / allergy / family-history` |
| display_name | TEXT | Condition name |
| clinical_status | TEXT | `active / inactive / resolved` |
| onset_date | TEXT? | Onset or diagnosis date |
| notes | TEXT? | Detailed description |
| source | TEXT | `manual / ai-extract` |
| created_at | TEXT | Created time |
| updated_at | TEXT | Updated time |

### Medication

The current medication management resource, replacing the old `MedicationStatement`.

| Field | Type | Description |
|---|---|---|
| id | TEXT | Primary key |
| member_id | TEXT | FK → `FamilyMember` |
| name | TEXT | Medication name |
| indication | TEXT? | Purpose or indication |
| dosage_description | TEXT? | Dosage instructions |
| status | TEXT | `active / stopped` |
| start_date | TEXT? | Start date |
| end_date | TEXT? | End date |
| source | TEXT | `manual / ai-extract` |
| created_at | TEXT | Created time |
| updated_at | TEXT | Updated time |

### Encounter

Clinical visit and checkup events.

| Field | Type | Description |
|---|---|---|
| id | TEXT | Primary key |
| member_id | TEXT | FK → `FamilyMember` |
| type | TEXT | `outpatient / inpatient / checkup / emergency` |
| facility | TEXT? | Medical facility |
| department | TEXT? | Department |
| attending_physician | TEXT? | Attending physician |
| date | TEXT | Visit date |
| summary | TEXT? | Diagnostic or result summary |
| source | TEXT | `manual / ai-extract` |
| created_at | TEXT | Created time |
| updated_at | TEXT | Updated time |

### HealthSummary

AI summary resource for the family dashboard and member overview area. Each member can generate 0-N records per day and is no longer fixed to three categories.

| Field | Type | Description |
|---|---|---|
| id | TEXT | Primary key |
| member_id | TEXT | FK → `FamilyMember` |
| category | TEXT | AI-defined topic, such as sleep, blood pressure, mood, or adherence |
| label | TEXT | Summary title |
| value | TEXT | Short evaluation or hint |
| status | TEXT | `good / warning / alert` |
| generated_at | TEXT | AI generation time |
| created_at | TEXT | Created time |

`status` is the single source of truth for frontend color semantics: `good` = green, `warning` = yellow, `alert` = red.

### CarePlan

Actionable reminders and health plans that can be aggregated on the home page by time slot.

| Field | Type | Description |
|---|---|---|
| id | TEXT | Primary key |
| member_id | TEXT | FK → `FamilyMember`, the owning member context |
| assignee_member_id | TEXT? | Actual assignee member; defaults to `member_id` when empty |
| category | TEXT | Plan category, such as medication, exercise, checkup, or diet |
| icon_key | TEXT? | Predefined icon key |
| time_slot | TEXT? | Time slot, such as `清晨 / 上午 / 午后 / 晚间 / 睡前` |
| title | TEXT | Title |
| description | TEXT | Short description |
| notes | TEXT? | Notes or supplemental reminders |
| status | TEXT | `active / completed / cancelled` |
| scheduled_at | TEXT? | Scheduled time |
| completed_at | TEXT? | Completion time |
| generated_by | TEXT | `ai / manual` |
| created_at | TEXT | Created time |
| updated_at | TEXT | Updated time |

#### Predefined `icon_key` values

- `medication`
- `exercise`
- `checkup`
- `meal`
- `rest`
- `social`
- `general`

#### Predefined `time_slot` values

- `清晨`
- `上午`
- `午后`
- `晚间`
- `睡前`

## Supporting Models

### UserAccount / FamilySpace

- `FamilySpace`: the top-level family organizational unit
- `UserAccount`: system login account, with role `admin / member`

Current `UserAccount` field semantics:

| Field | Type | Description |
|---|---|---|
| id | TEXT | Primary key |
| family_space_id | TEXT | Owning family space |
| username | TEXT | Required, unique, used for login, and also the default source of the initial display name |
| email | TEXT? | Optional contact field; unique when non-empty |
| password_hash | TEXT | Password hash |
| role | TEXT | `admin / member` |
| created_at | TEXT | Created time |

Notes:

- The authentication layer no longer maintains a separate `name`
- Registration automatically creates a bound `FamilyMember` and initializes `family_member.name = username`
- `username` supports Chinese; the current constraint is 3-24 characters, allowing only Chinese characters, English letters, digits, `_`, and `-`

### MemberAccessGrant

The member-level authorization model, defining explicit capabilities of normal users over other members' data.

| Field | Type | Description |
|---|---|---|
| id | TEXT | Primary key |
| user_account_id | TEXT | User granted the permission |
| member_id | TEXT? | Target member; empty when `target_scope = 'all'` |
| permission_level | TEXT | `read / write / manage` |
| target_scope | TEXT | `specific / all` |
| created_at | TEXT | Created time |
| updated_at | TEXT | Updated time |

Rules:

- `manage > write > read`
- `write` implicitly includes `read`
- `manage` implicitly includes both `write` and `read`
- `specific` applies only to one member
- `all` applies to all members in the current family space

### ChatSession / ChatMessage

Session history is an independent application-level model.

#### ChatSession

| Field | Type | Description |
|---|---|---|
| id | TEXT | Primary key |
| user_account_id | TEXT | Owning user of the session |
| family_space_id | TEXT | Owning family space |
| focus_member_id | TEXT? | Current focus member |
| title | TEXT? | Human-readable title |
| summary | TEXT? | Summary shown in the history list |
| page_context | TEXT? | Triggering page context |
| created_at | TEXT | Created time |
| updated_at | TEXT | Updated time |

`summary` is used for the home-page history entry and session restoration, and does not replace the full message history.

#### ChatMessage

- Stores user messages, assistant replies, tool events, and draft confirmation history
- Used to restore session context and is not treated as a health fact resource

### ScheduledTask

Persists AI scheduled task definitions, such as daily summary refreshes or user-created reminder jobs.

## Old Resources And Terms Explicitly Not Included

- `DocumentReference` is no longer used
- `MedicationStatement` is no longer used
- `FamilyMember.allergies` and `FamilyMember.medical_history` are no longer used
- The old `Observation.category = vital-signs / laboratory / activity / sleep / other` is no longer used
- Standalone document-upload resources are no longer modeled as part of the current health fact layer
