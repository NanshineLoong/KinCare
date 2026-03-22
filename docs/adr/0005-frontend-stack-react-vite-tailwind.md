# ADR-0005: Use React + Vite + TypeScript + Tailwind CSS For The Frontend

- **Status:** Accepted
- **Date:** 2026-03-11

## Context And Problem

KinCare needs a web frontend that can iterate quickly to support core interfaces such as the family dashboard, member profiles, and AI chat. Existing UI prototypes already show a clear Tailwind style.

Problem: what frontend stack should the MVP v1 use so it can preserve development efficiency while aligning well with the existing design prototypes?

## Considered Options

### Option A: React 18 + Vite + TypeScript + Tailwind CSS + React Router (selected)

- Pros: the React ecosystem is mature and well-suited for state-driven interfaces across multiple pages; Vite is fast for startup and builds; TypeScript improves maintainability for API and state modeling; Tailwind CSS maps efficiently to the current prototype styles; React Router fits SPA routing scenarios
- Cons: component structure and state boundaries must be managed explicitly; compared with a full-stack framework, deployment integration requires more manual handling

### Option B: Next.js

- Pros: full framework capabilities with mature routing and build solutions
- Cons: the MVP does not currently need SSR or SSG, and introducing a full-stack framework increases deployment and directory complexity

### Option C: Vue 3 + Vite

- Pros: also offers a good developer experience
- Cons: less aligned with the team's current assumptions and future ecosystem materials; weaker reuse of existing React ecosystem components and experience

## Decision

Adopt **Option A: React 18 + Vite + TypeScript + Tailwind CSS + React Router**.

The frontend is implemented as an SPA, with priority given to clear page and component boundaries. The styling layer uses Tailwind CSS, and design tokens aligned with the prototypes can be extracted in later stages.

## Consequences

- **Positive:** MVP interfaces can be built and iterated quickly while staying close to the current prototype style
- **Positive:** TypeScript helps with frontend-backend API integration and long-term maintenance
- **Positive:** Vite fits both local development and containerized builds
- **Negative:** State management, API client structure, and directory boundaries must be organized explicitly
- **Negative:** Testing, build, and deployment conventions still need to be completed in the early stage
