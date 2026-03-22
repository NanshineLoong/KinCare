# ADR-0002: One Instance = One Family Space

- **Status:** Accepted
- **Date:** 2026-03-11

## Context And Problem

KinCare is a privately deployed system. We need to decide how one deployment instance should organize users and data.

Problem: how should the relationship between family spaces and users be organized?

## Considered Options

### Option A: A multi-tenant SaaS model

- Pros: one instance can serve multiple families and is suitable for commercialization
- Cons: multi-tenant data isolation is more complex and conflicts with the "private deployment" positioning

### Option B: One instance = one family space (selected)

- Pros: the architecture is simple and does not require multi-tenant isolation; it matches the private deployment model, where each family deploys its own instance
- Cons: one instance cannot serve multiple families

### Option C: A flexible multi-space model

- Pros: one instance can contain multiple spaces
- Cons: adds unnecessary complexity, and there is no need for it in the MVP stage

## Decision

Adopt **Option B: one instance = one family space**.

- After the system starts, the first registered user automatically becomes the family administrator
- Later registered users automatically join that family space
- Administrators can directly add account-less members, such as elderly people or children, and those members can bind an account later
- The permission model is implemented within the family space: administrators have full permissions, while normal members have restricted access

## Consequences

- **Positive:** The architecture is extremely simple and does not require tenant selection or switching logic
- **Positive:** Only one FamilySpace record is needed in the data model, which keeps the logic clear
- **Positive:** UserAccount is decoupled from FamilyMember, supporting account-less members
- **Negative:** If a user needs to manage multiple families, for example parents and parents-in-law, they must deploy multiple instances
- **Risk:** Open registration can allow non-family members to join; this can later be mitigated with administrator-approved registration
