# ADR-0004: Docker Compose First Deployment Strategy

- **Status:** Accepted
- **Date:** 2026-03-11

## Context And Problem

KinCare targets private deployment for technical users. We need to decide on the deployment approach.

Problem: how can users deploy KinCare locally as simply as possible?

## Considered Options

### Option A: One-command Docker Compose deployment (selected)

- Pros: users only need Docker installed, and one command can start all services; development and deployment environments stay aligned
- Cons: users must understand basic Docker operations

### Option B: Native installation scripts

- Pros: does not depend on Docker
- Cons: must support multiple operating systems, dependency management becomes complex, and development and deployment environments diverge

### Option C: Kubernetes / Helm

- Pros: suitable for large-scale deployment
- Cons: far too complex for home users

## Decision

Adopt **Option A: one-command Docker Compose deployment**.

All services, including frontend, backend, database, and MCP server, are orchestrated through `docker-compose.yml`. Data is persisted to the host machine through Docker volumes.

Target deployment workflow:

```bash
git clone <repo>
cd KinCare
docker compose up -d
# Visit http://localhost:<port>
```

## Consequences

- **Positive:** Deployment is very simple and matches the product goal of "one-command deployment"
- **Positive:** Developers can use the same compose file for local development
- **Positive:** Inter-service networking and dependencies are managed by Docker Compose
- **Negative:** Users must install Docker, and on macOS or Windows that means Docker Desktop
- **Consideration:** A future `docker-compose.dev.yml` can be provided to support hot reload and other development experience improvements
