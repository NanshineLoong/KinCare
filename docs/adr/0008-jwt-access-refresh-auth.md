# ADR-0008: Use JWT Access Token + Refresh Token For Authentication

- **Status:** Accepted
- **Date:** 2026-03-11

## Context And Problem

KinCare uses a separated frontend-backend architecture and needs to support user registration, login, authentication, and session renewal. The product is a single-instance private deployment and does not depend on third-party identity platforms.

Problem: what authentication approach should the MVP v1 use to balance implementation cost, security, and frontend-backend collaboration?

## Considered Options

### Option A: JWT access token + refresh token (selected)

- Pros: fits frontend-backend separation; access tokens keep API authentication lightweight; refresh tokens support renewal; no external identity service is required
- Cons: token expiry, refresh, and revocation strategies must be handled, and improper storage introduces security risk

### Option B: Server-side session + cookie

- Pros: session state can be centrally controlled by the server
- Cons: less direct for APIs and future MCP or external invocation scenarios; more complex to manage across clients and in stateless deployments

### Option C: Third-party OAuth / OIDC

- Pros: mature security capabilities and ecosystem
- Cons: does not fully match the goals of private single-instance deployment, and introduces too much external dependency for the MVP

## Decision

Adopt **Option A: JWT access token + refresh token**.

In the MVP stage, the backend is responsible for issuing and validating JWTs. Access tokens are used for API access, and refresh tokens are used for renewal. If stronger session management is needed later, token storage, rotation, and revocation strategies can be added through a new ADR.

## Consequences

- **Positive:** Fits the SPA + API architecture and keeps frontend-backend boundaries clear
- **Positive:** Aligns well with future MCP server or other API-client integrations
- **Positive:** Does not depend on external identity providers and matches private deployment goals
- **Negative:** Token lifetime and client-side storage must be designed carefully
- **Negative:** If more complex login methods are added later, the authentication layer will need additional expansion
