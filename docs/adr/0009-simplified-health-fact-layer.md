# ADR-0009: Adopt A Simplified Health Fact Layer For MVP v1

- **Status:** Accepted
- **Date:** 2026-03-15
- **Supersedes:** The specific MVP resource definitions, field sets, and category enums in ADR-0001

## Context And Problem

ADR-0001 established that KinCare would use a FHIR-style health fact layer, but the current MVP implementation still carries too much complexity from general medical record systems, including `DocumentReference`, `MedicationStatement`, redundant member history fields, and resource boundaries that do not map cleanly to the current UI and OpenWearables integration.

As the MVP v1 scope narrowed, the existing data model exposed the following problems:

- The home page and member pages need to query and present data directly by `chronic-vitals / lifestyle / body-vitals`, but the current `Observation.category` does not match
- Sleep and workout data are event-shaped by nature, with start and end times, and keeping them inside `Observation` makes querying and presentation more complex
- `FamilyMember.allergies` and `FamilyMember.medical_history` duplicate `Condition`, creating double-write and inconsistency risk
- `DocumentReference` and its `source_ref` chain are outside the MVP's current core path and add complexity to the schema, APIs, and AI orchestration
- Current resource naming and field design do not fit the UI language and everyday usage scenarios well enough

Problem: while keeping the overall FHIR-style direction, what health fact layer structure should the MVP v1 adopt so it can satisfy UI, AI, and device-integration needs while reducing implementation complexity?

## Considered Options

### Option A: Keep the current FHIR-style implementation and patch it locally

- Pros: minimal migration and more reuse of current code
- Cons: redundant fields, unclear resource semantics, and UI mapping complexity would remain, raising long-term cost

### Option B: Adopt a simplified health fact layer within FHIR-style boundaries (selected)

- Pros: preserves clear resource boundaries while compressing the resource set, fields, and enums to the scope the MVP actually needs; maps more directly to the UI and OpenWearables
- Cons: requires a one-time schema and service-layer migration, affecting current APIs and tests

### Option C: Abandon resource-oriented modeling and switch to fully page-specific tables

- Pros: faster short-term delivery for page-level work
- Cons: breaks the semantic boundaries established by ADR-0001 and is unfavorable for AI tool usage, future MCP support, and long-term evolution

## Decision

Adopt **Option B: a simplified health fact layer within FHIR-style boundaries**.

This decision keeps ADR-0001's overall direction of using FHIR-style resource boundaries, but adjusts the resource set, fields, and enum definitions for the MVP v1 scope:

- Change `Observation.category` to `chronic-vitals / lifestyle / body-vitals`
- Add `SleepRecord` and `WorkoutRecord` to carry event-style health data
- Add `HealthSummary` to carry AI-generated daily summaries for the home page
- Rename and simplify `MedicationStatement` into `Medication`
- Remove `allergies` and `medical_history` from `FamilyMember` and unify them under `Condition`
- Simplify the fields and enums of `Condition`, `Encounter`, `Medication`, and `CarePlan` for MVP goals
- Remove `DocumentReference` and all `source_ref` dependencies from resources, and stop treating standalone document management as part of the MVP health fact layer

## Decision Details

### 1. Keep resource-oriented modeling

KinCare continues to use `FamilyMember` as the core aggregate root, organizing resources such as Observation, Condition, Medication, Encounter, and CarePlan around it, instead of degenerating into page-specific tables.

### 2. Model event-shaped data independently

Sleep and workout data become separate resources instead of special cases of `Observation`. This better matches the nature of time-bounded event data and makes UI rendering, analytics, and AI access more direct.

### 3. Separate static member profiles from dynamic health facts

`FamilyMember` keeps only stable profile fields. Dynamic content such as allergies, chronic conditions, and medical history is unified under `Condition`, avoiding double-write across member profiles and the health fact layer.

### 4. Remove standalone document resources from the MVP

The MVP v1 does not treat standalone document-upload management as a core health fact resource. AI extraction and write-in flows should center on chat context and controlled tools, rather than on `DocumentReference` modeling.

### 5. Prioritize the current UI and AI when shaping the data model

Category choices, naming, and field selection should primarily satisfy:

- Direct query and rendering needs for the home page and member pages
- On-demand AI tool access to member health context
- One-pass mapping from OpenWearables into the resource layer

## Consequences

- **Positive:** The data model aligns better with current product pages and AI interaction paths, making frontend and backend queries significantly simpler
- **Positive:** Core scenarios such as sleep, workout, and home-page summaries get more appropriate resource boundaries
- **Positive:** Redundant fields and cross-resource references are reduced, lowering inconsistency risk
- **Positive:** The current stable resource set becomes `FamilyMember`, `Observation`, `SleepRecord`, `WorkoutRecord`, `Condition`, `Medication`, `Encounter`, `HealthSummary`, and `CarePlan`
- **Negative:** This is a breaking schema migration and requires synchronized changes to the service layer, APIs, tests, and existing sample data
- **Negative:** The MVP will no longer provide standalone document-resource management; if it is needed later, boundaries must be redefined through a new ADR
- **Risk:** Migration from old data into the new enums and table structures requires explicit mapping strategies, especially for `Observation.category`, member history fields, and document-related source fields

## Current Documentation Location

- See [`../architecture/overview.md`](../architecture/overview.md) for the architecture overview
- See [`../architecture/data-model.md`](../architecture/data-model.md) for current data model details
