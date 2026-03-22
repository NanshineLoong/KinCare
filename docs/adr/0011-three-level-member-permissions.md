# ADR-0011: Adopt Three-Level Member Permissions With Scoped Grants

- **Status:** Accepted
- **Date:** 2026-03-16
- **Supersedes:** The current boolean authorization model based on `member_access_grant.can_write`

## Context And Problem

KinCare already treats member-level permissions as the core boundary for health-data access, but the current authorization model has only a single `can_write` boolean, and its semantics are no longer sufficient:

- It cannot distinguish between "readable but not writable" and "able to manage permission relationships"
- It cannot express authorization that applies to all members
- The frontend permission UI, AI read permissions, and service-layer write permissions lack one unified decision rule
- It would cause later features such as suggestion write-back, manual editing, and session recovery to continue diverging in permission handling

Problem: what authorization model should KinCare adopt so it can support member profile access, record writing, AI tool usage, and the authorization management UI at the same time?

## Considered Options

### Option A: Continue using the `can_write` boolean authorization

- Pros: simplest implementation with the lowest migration cost
- Cons: insufficient expressive power, and the boundaries between read, write, and manage remain mixed together

### Option B: Add multiple boolean fields to each grant

- Pros: more flexible than a single boolean
- Cons: field combinations become hard to control, and inclusion relationships plus UI presentation become unintuitive

### Option C: Three permission levels plus scoped grants (selected)

- Pros: capability boundaries are clear and map directly to the frontend UI, service-layer checks, and AI tool access
- Cons: requires coordinated changes to the schema, service layer, APIs, and existing permission logic

## Decision

Adopt a **three-level permission model with scoped grants**.

### 1. Permission levels

`member_access_grant.permission_level` uses the following enums:

- `read`: can read member health data, open member profiles, and allow AI to read within the authorized scope
- `write`: can modify member health data and implicitly includes `read`
- `manage`: can manage authorization relationships and implicitly includes both `write` and `read`

The inclusion relationship is:

```text
manage > write > read
```

### 2. Grant scope

`member_access_grant.target_scope` uses the following enums:

- `specific`: the grant applies only to one member
- `all`: the grant applies to all members in the current family space

When `target_scope = 'specific'`, `member_id` must point to the target member.  
When `target_scope = 'all'`, `member_id` is empty and the family-space scope implicitly covers all members.

### 3. Permission decision rules

- `admin` still has full capabilities
- AI reads of member data require at least `read`
- Manual editing, draft confirmation, and suggestion write-back require at least `write`
- Viewing, granting, and revoking authorizations require at least `manage`
- `all`-scope grants participate in evaluation before `specific` single-member grants

### 4. Requirements for frontend-backend boundaries

- The service layer is the only source of truth for permissions
- APIs and AI tools must not bypass the service layer for their own permission decisions or direct database access
- The frontend is responsible only for capability presentation and disabled states; UI results must not replace backend validation

## Consequences

- **Positive:** Permission semantics directly cover the home page, member profiles, AI chat, authorization management, and suggestion write-back
- **Positive:** `specific / all` removes the need for duplicated grant records in common family authorization scenarios
- **Positive:** `manage` clearly separates "can edit records" from "can manage others' permissions"
- **Negative:** A one-time migration of database fields and existing permission logic is required
- **Negative:** Frontend presentation and test fixtures both need coordinated updates
- **Risk:** If the service layer does not handle inclusion relationships and scope precedence uniformly, frontend and AI tool decisions can diverge
