# ADR-0001: Adopt A FHIR-Style Data Model

- **Status:** Accepted
- **Date:** 2026-03-11

## Context And Problem

KinCare needs a unified data model to store health information from multiple sources, including manual entry, document extraction, and wearable devices. This data must support dashboard display, AI chat, MCP queries, reminder generation, and other scenarios.

Problem: what kind of data model should be adopted to standardize family health information?

## Considered Options

### Option A: Full FHIR R4 compliance

- Pros: fully compatible with healthcare industry standards and directly interoperable with FHIR servers
- Cons: FHIR resource structures are complex, with nested JSON, coding systems, and extension mechanisms; this is over-designed for a family scenario and costly to implement and maintain

### Option B: A simplified FHIR-style model (selected)

- Pros: borrows FHIR-style resource categories such as Patient, Observation, and Condition for semantic clarity, but uses simplified flat relational tables; can be mapped to standard FHIR later
- Cons: cannot interoperate directly with existing FHIR ecosystem tools

### Option C: An unconstrained custom model

- Pros: completely flexible and fast for early development
- Cons: lacks semantic constraints, so the data structure can become chaotic; it is also harder for AI chat to build a consistent understanding of the data

## Decision

Adopt **Option B: a simplified FHIR-style model**.

Resource types borrow from FHIR R4, including FamilyMember, Observation, Condition, MedicationStatement, Encounter, DocumentReference, and CarePlan, but field structures are simplified into flat relational tables. In the MVP stage, metric codes use custom codes while preserving the ability to map later to LOINC and SNOMED CT.

## Consequences

- **Positive:** Data semantics are clear, and different data sources can map into one unified model; AI chat has an explicit structure to reference
- **Positive:** There is a clear future mapping path if FHIR ecosystem integration is needed
- **Negative:** Custom coding tables must be maintained
- **Negative:** Existing FHIR tooling cannot be used directly
