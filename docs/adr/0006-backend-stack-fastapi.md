# ADR-0006: Use Python + FastAPI For The Backend

- **Status:** Accepted
- **Date:** 2026-03-11

## Context And Problem

The KinCare backend must handle authentication, permissions, health-data management, AI service orchestration, and future MCP integration. The project also emphasizes AI extensibility and private local deployment.

Problem: what backend stack should the MVP v1 use so it can support conventional APIs while also integrating smoothly with LLM and MCP-related capabilities?

## Considered Options

### Option A: Python + FastAPI (selected)

- Pros: Python is the most mature ecosystem for AI and LLM work, making it easier to integrate libraries such as the OpenAI SDK and LangChain; FastAPI provides type-driven request validation and OpenAPI docs out of the box; async support fits future SSE, file-processing, and AI-call scenarios
- Cons: project layering still needs to be enforced explicitly; raw performance is not the main strength of this kind of framework

### Option B: Node.js + NestJS

- Pros: uses the same language as the frontend and has mature engineering patterns
- Cons: the AI and MCP ecosystem and example resources are not as rich as Python, and the team would need to build more abstractions for health-data modeling and AI orchestration

### Option C: Go + Gin/Fiber

- Pros: better performance and smaller deployment footprint
- Cons: weaker AI ecosystem and slower iteration speed, making it a poor fit for fast experimentation in the MVP stage

## Decision

Adopt **Option A: Python + FastAPI**.

The backend is organized by layered directories: API, schemas, models, services, core, and ai. In the MVP stage, the AI service is implemented as an internal module inside the API server to reduce system complexity.

## Consequences

- **Positive:** AI capabilities and MCP functionality can directly reuse the Python ecosystem
- **Positive:** FastAPI's type system and documentation support improve frontend-backend collaboration
- **Positive:** It is easier to implement future streaming responses, async tasks, and health checks
- **Negative:** The project structure must be kept clear proactively so business logic does not spread into route handlers
- **Negative:** If high-concurrency requirements emerge in the future, additional performance optimization may be needed
