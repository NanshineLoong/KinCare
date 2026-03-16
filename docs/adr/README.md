# 架构决策记录 (ADR)

本目录记录 HomeVital 项目的架构决策，采用 [MADR](https://adr.github.io/madr/) 格式。

## 规则

- 新增 ADR 使用递增编号：`NNNN-<kebab-case-title>.md`
- 已 Accepted 的 ADR **不可修改内容**，只能通过新 ADR Supersede
- 每个 ADR 聚焦一个决策

## 索引

| ADR | 标题 | 状态 | 日期 | 当前作用 |
|---|---|---|---|---|
| [0001](./0001-fhir-style-data-model.md) | 采用 FHIR 风格数据模型 | Accepted | 2026-03-11 | 总体资源化方向保留；MVP 级字段与资源集合被 ADR-0009 部分 supersede |
| [0002](./0002-single-instance-family-space.md) | 单实例 = 一个家庭空间 | Accepted | 2026-03-11 | 当前仍然有效 |
| [0003](./0003-mcp-server-for-health-data.md) | MCP Server 暴露健康数据能力 | Accepted | 2026-03-11 | 仍为后续阶段方向，不是当前实现主线 |
| [0004](./0004-docker-first-deployment.md) | Docker Compose 优先的部署策略 | Accepted | 2026-03-11 | 保留为目标部署方向；当前开发运行时仍以本地 FastAPI + Vite + SQLite 为主 |
| [0005](./0005-frontend-stack-react-vite-tailwind.md) | 前端采用 React + Vite + TypeScript + Tailwind CSS | Accepted | 2026-03-11 | 当前仍然有效 |
| [0006](./0006-backend-stack-fastapi.md) | 后端采用 Python + FastAPI | Accepted | 2026-03-11 | 当前仍然有效 |
| [0007](./0007-postgresql-as-primary-database.md) | 主数据库采用 PostgreSQL | Accepted | 2026-03-11 | 保留为目标部署决策；当前开发基线仍使用 SQLite |
| [0008](./0008-jwt-access-refresh-auth.md) | 认证采用 JWT Access Token + Refresh Token | Accepted | 2026-03-11 | 当前仍然有效 |
| [0009](./0009-simplified-health-fact-layer.md) | MVP v1 采用简化版健康事实层 | Accepted | 2026-03-15 | 当前健康数据模型基线 |
| [0010](./0010-pydantic-ai-tool-calling.md) | 应用内 AI 编排采用 PydanticAI Tool-Calling 循环 | Accepted | 2026-03-15 | 当前 AI 架构基线 |
| [0011](./0011-three-level-member-permissions.md) | 成员授权采用三级权限与范围化授权 | Accepted | 2026-03-16 | 当前成员授权模型基线 |
