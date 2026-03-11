# ADR-0003: MCP Server 暴露健康数据能力

- **状态：** Accepted
- **日期：** 2026-03-11

## 背景与问题

HomeVital 的设计目标之一是允许外部 AI 系统（如 OpenClaw）查询和操作家庭健康数据。需要决定对外暴露数据能力的方式。

问题：如何让外部 AI 系统访问 HomeVital 的健康数据？

## 考虑的方案

### 方案 A：仅提供 REST API

- 优点：通用性强，任何 HTTP 客户端可调用
- 缺点：AI Agent 需要额外适配层才能调用；无法利用 MCP 生态的工具发现和调用机制

### 方案 B：MCP Server + REST API 并存（选定）

- 优点：MCP Server 让 AI Agent（Cursor、OpenClaw 等）可以原生发现和调用健康数据能力；REST API 供前端和其他场景使用
- 缺点：需要维护两套接口（但 MCP Server 可以内部调用 API Server 的逻辑，避免重复）

### 方案 C：仅 MCP Server

- 优点：统一接口
- 缺点：前端 Web App 不方便直接使用 MCP 协议

## 决策

采用**方案 B：MCP Server + REST API 并存**。

MCP Server 暴露以下能力：

- **Tools：** 查询成员列表、查询健康记录（按成员/类型/时间范围）、查询指标趋势、新增观测记录、更新提醒状态
- **Resources：** 成员档案摘要、最近健康事件摘要

MCP Server 内部调用 API Server 的业务逻辑层，不重复实现。同时支持封装为 OpenClaw Skill。

## 后果

- **正面：** 外部 AI 系统可以原生调用健康数据，支持 OpenClaw 主动推送场景
- **正面：** MCP 协议是 AI 工具生态的事实标准，接入成本低
- **负面：** 需要关注 MCP 接口的认证和权限控制，防止未授权访问
- **待定：** MCP Server 部署方式（独立进程 vs 内嵌于 API Server）在技术栈确定后决定
