# ADR-0010: Use A PydanticAI Tool-Calling Loop For In-App AI Orchestration

- **Status:** Accepted
- **Date:** 2026-03-15
- **Supersedes:** The old default direction based on a lightweight custom orchestrator and provider abstraction

## Context And Problem

KinCare already has in-app AI chat capability, but its core orchestration is still largely rule-driven. Tool selection depends on keywords and regex checks, and each request can trigger only a limited set of fixed paths. This makes it difficult to support more natural multi-step reasoning, read-write combinations, and draft approval flows.

This creates several obvious problems:

- Tool selection depends on string matching and cannot reliably understand real user intent
- The orchestration loop is essentially "single decision + single tool + text reply", which is not suitable for multi-step read-write combinations
- High-risk writes already have a draft-confirmation concept, but there is no unified tool-level approval mechanism
- Streaming output, tool-call events, and test double models require a large amount of custom glue code

Problem: while keeping the principles of "in-app controlled tool calling" and "minimal context + service-layer authorization," what AI orchestration framework should KinCare adopt to replace the current rule-driven orchestrator?

## Considered Options

### Option A: Continue maintaining a custom orchestrator

- Pros: minimal dependencies and full customization for project needs
- Cons: infrastructure such as tool schemas, streaming events, approval recovery, and test models all have to be maintained manually, so complexity will keep growing

### Option B: Use native OpenAI SDK tool calling directly

- Pros: direct access to low-level capabilities and flexible compatibility with OpenAI-compatible services
- Cons: requires hand-written schemas, loop control, dependency injection, and approval mechanisms, so project-level integration cost remains high

### Option C: Adopt PydanticAI's tool-calling loop (selected)

- Pros: aligned with the FastAPI and Pydantic style; provides `RunContext` dependency injection, `agent.iter()` streaming loops, `requires_approval`, test models, and OpenAI-compatible provider support
- Cons: introduces a new framework dependency, requires tracking API changes, and requires validating current official documentation before integration

## Decision

Adopt **Option C: a PydanticAI tool-calling loop** as the default implementation for KinCare's in-app AI orchestration.

The specific principles are:

- Continue to keep orchestration inside the app and do not move the frontend chat's first hop to MCP
- All AI reads and writes must still go through the existing business service layer and member-level permission checks
- The system prompt should inject only the minimal necessary context, while detailed health data is fetched on demand through tools
- Tools should be designed by risk level, and core health-record writes must require user confirmation

## Decision Details

### 1. Replace the rule-driven main loop with `agent.iter()`

The chat flow becomes an LLM-driven tool-calling loop, allowing multiple rounds of "read information -> reason -> write or suggest -> continue generating" within a single request.

### 2. Use a unified dependency injection model

All tools obtain the database, current user, focus member, scheduler, and session context through `RunContext[AIDeps]`. Tools must not bypass the service layer to operate on the database directly.

### 3. Categorize tools by risk level

Tools are divided into four categories:

- Read tools: side-effect free and callable by the model at any time
- Low-risk writes: such as creating reminders or marking completion, executable directly
- High-risk writes: such as recording Observation, Condition, Medication, or Encounter, which must use `requires_approval=True`
- Proactive suggestion tools: provide suggestions only and do not write directly

### 4. Model approval as a framework capability

High-risk writes uniformly use the `DeferredToolRequests` and `DeferredToolResults` recovery flow, exposing a structured draft confirmation experience to the frontend instead of continuing to rely on a temporary custom protocol.

### 5. Preserve the current architecture boundaries; replace orchestration, not the permission model

This ADR replaces the AI orchestration framework and tool registration approach, but does not change the following boundaries:

- Member-level permission checks remain the responsibility of the existing business layer
- AI does not access database tables directly
- The responsibility boundaries under `backend/app/ai/` remain in place
- MCP remains a later external protocol layer rather than the main in-app chat path

## Consequences

- **Positive:** Tool selection and multi-step invocation are model-driven, enabling more natural handling of Q&A, implicit actions, explicit extraction, and analytical suggestions
- **Positive:** Streaming output, approval recovery, test double models, and OpenAI-compatible adaptation now have shared infrastructure
- **Positive:** AI capability ceilings can improve without sacrificing permission or service-layer boundaries
- **Positive:** The four tool categories, read tools, low-risk writes, high-risk approvals, and proactive suggestions, can be expressed consistently in one runtime
- **Negative:** A new framework dependency and learning cost are introduced, and future upgrades must track upstream API changes
- **Negative:** Existing orchestrator, provider, and test code require a one-time refactor
- **Risk:** If the latest PydanticAI API is not verified first, proposal examples may diverge from the real version, so official documentation must be checked before implementation

## Current Documentation Location

- See [`../architecture/overview.md`](../architecture/overview.md) for the architecture overview
- See [`../architecture/ai-design.md`](../architecture/ai-design.md) for AI runtime details
