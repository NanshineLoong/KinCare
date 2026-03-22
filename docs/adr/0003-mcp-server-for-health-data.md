# ADR-0003: Expose Health-Data Capabilities Through An MCP Server

- **Status:** Accepted
- **Date:** 2026-03-11

## Context And Problem

One of KinCare's design goals is to allow external AI systems, such as OpenClaw, to query and operate on family health data. We need to decide how to expose these data capabilities externally.

Problem: how should external AI systems access KinCare health data?

## Considered Options

### Option A: Provide only a REST API

- Pros: broadly compatible and callable by any HTTP client
- Cons: AI agents need an additional adaptation layer, and this cannot use MCP ecosystem tool discovery and invocation mechanisms

### Option B: MCP server plus REST API in parallel (selected)

- Pros: the MCP server allows AI agents such as Cursor and OpenClaw to discover and call health-data capabilities natively; the REST API serves the frontend and other scenarios
- Cons: two interfaces must be maintained, although the MCP server can call the API server's business logic internally to avoid duplication

### Option C: MCP server only

- Pros: one unified interface
- Cons: the frontend web app cannot conveniently use the MCP protocol directly

## Decision

Adopt **Option B: MCP server plus REST API in parallel**.

The MCP server exposes the following capabilities:

- **Tools:** list members, query health records by member, type, and time range, query metric trends, create observation records, and update reminder status
- **Resources:** member profile summaries and recent health-event summaries

The MCP server calls the API server's business logic layer internally rather than reimplementing it. It should also support packaging as an OpenClaw skill.

## Consequences

- **Positive:** External AI systems can call health-data capabilities natively, including proactive OpenClaw push scenarios
- **Positive:** MCP is the de facto standard in the AI tools ecosystem, so integration cost is relatively low
- **Negative:** Authentication and permission control for the MCP interface must be handled carefully to prevent unauthorized access
- **Open question:** The MCP server deployment shape, standalone process versus embedded in the API server, will be decided after the technical stack is finalized
