# 架构决策记录 (ADR)

本目录记录 HomeVital 项目的架构决策，采用 [MADR](https://adr.github.io/madr/) 格式。

## 规则

- 新增 ADR 使用递增编号：`NNNN-<kebab-case-title>.md`
- 已 Accepted 的 ADR **不可修改内容**，只能通过新 ADR Supersede
- 每个 ADR 聚焦一个决策

## 索引

| ADR | 标题 | 状态 | 日期 |
|-----|------|------|------|
| [0001](./0001-fhir-style-data-model.md) | 采用 FHIR 风格数据模型 | Accepted | 2026-03-11 |
| [0002](./0002-single-instance-family-space.md) | 单实例 = 一个家庭空间 | Accepted | 2026-03-11 |
| [0003](./0003-mcp-server-for-health-data.md) | MCP Server 暴露健康数据能力 | Accepted | 2026-03-11 |
| [0004](./0004-docker-first-deployment.md) | Docker Compose 优先的部署策略 | Accepted | 2026-03-11 |
| [0005](./0005-frontend-stack-react-vite-tailwind.md) | 前端采用 React + Vite + TypeScript + Tailwind CSS | Accepted | 2026-03-11 |
| [0006](./0006-backend-stack-fastapi.md) | 后端采用 Python + FastAPI | Accepted | 2026-03-11 |
| [0007](./0007-postgresql-as-primary-database.md) | 主数据库采用 PostgreSQL | Accepted | 2026-03-11 |
| [0008](./0008-jwt-access-refresh-auth.md) | 认证采用 JWT Access Token + Refresh Token | Accepted | 2026-03-11 |
