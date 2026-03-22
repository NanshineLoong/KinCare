# ADR-0007: Use PostgreSQL As The Primary Database

- **Status:** Accepted
- **Date:** 2026-03-11

## Context And Problem

KinCare needs to persist family members, user accounts, FHIR-style health facts, chat history, and reminder data. The data has strong relational structure but also includes some flexible fields, such as document extraction results and extension attributes.

Problem: which database should the MVP v1 use to balance reliability, modeling clarity, and future extensibility?

## Considered Options

### Option A: PostgreSQL (selected)

- Pros: mature relational modeling that fits relationships among users, members, and health resources; reliable transactions; JSONB can hold semi-structured data such as extraction results; the Docker ecosystem is mature and suitable for local deployment
- Cons: database migrations must be maintained; less flexible than NoSQL for purely document-oriented scenarios

### Option B: SQLite

- Pros: simpler deployment and can run from a single file
- Cons: limited concurrency and migration capability; weaker support for containerization and future expansion; not ideal for somewhat complex relationships and evolution

### Option C: MongoDB

- Pros: more flexible for semi-structured data
- Cons: relationship constraints among family members, permissions, and the health fact layer become weaker, and query plus consistency control becomes more complex

## Decision

Adopt **Option A: PostgreSQL** as the primary database.

Structured health facts and user-permission relationships are modeled with relational tables. Fields that require flexible storage should use JSONB rather than abandoning the overall relational model.

## Consequences

- **Positive:** It can reliably support FHIR-style resource models and their relationships
- **Positive:** JSONB preserves flexibility for scenarios such as raw AI extraction results
- **Positive:** Integration with Docker Compose is mature and works well for local persistent deployment
- **Negative:** Migration tooling and basic database operations knowledge are required
- **Negative:** It is less direct than a document database for highly free-form document structures
