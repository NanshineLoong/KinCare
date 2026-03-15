# HomeVital 架构总览

> 本文档定义当前开发主线的目标架构。若旧实现、旧 Phase 文档或旧术语与本文冲突，以当前开发计划和 ADR-0009 / ADR-0010 为准。

## 当前主线

- 单实例 = 一个家庭空间
- 前端为 React + Vite SPA，后端为 FastAPI
- AI 在应用内运行，采用 PydanticAI tool-calling
- 健康数据采用简化版健康事实层
- 当前开发运行时继续使用 SQLite；`docker-compose.yml` 和 `mcp-server/` 仍是后续阶段骨架

## 设计原则

1. **隐私优先**：默认本地部署、本地存储、最小化外部依赖
2. **单一真相源**：家庭健康数据统一落在简化健康事实层，不为页面维护并行数据结构
3. **AI 受控读写**：AI 只能通过服务层和成员级权限模型访问健康数据
4. **最小上下文**：prompt 只注入身份、会话、页面焦点等最小信息，详细数据靠工具按需读取
5. **当前应用优先**：先把应用内体验跑通，MCP 作为后续对外暴露层，而不是当前对话主通路
6. **文档服务开发**：活跃文档描述的是当前开发目标，不再保留旧 Phase 叙事作为主框架

## 系统上下文

| 参与者 | 说明 |
|---|---|
| 家庭成员 | 通过浏览器使用首页、成员档案和 AI 对话 |
| 外部 LLM API | 提供 PydanticAI 运行时所需的模型能力 |
| 外部 AI / MCP Client | 后续阶段可通过 MCP 接入 HomeVital |

## 容器视图

```text
┌────────────────────────────────────────────────────────────┐
│                         HomeVital                          │
│                                                            │
│  ┌──────────────┐      ┌──────────────────────────────┐    │
│  │   Web App    │─────▶│           API Server         │    │
│  │  React SPA   │      │  REST API / SSE / Scheduler  │    │
│  │              │      │  Health Services / AI Runtime│    │
│  └──────────────┘      └──────────────┬───────────────┘    │
│                                       │                    │
│                                 ┌─────▼─────┐              │
│                                 │ Database  │              │
│                                 │ SQLite    │              │
│                                 └───────────┘              │
└───────────────────────────────────────┬────────────────────┘
                                        │
                          ┌─────────────▼─────────────┐
                          │ External LLM API          │
                          │ OpenAI-compatible service │
                          └───────────────────────────┘

Optional future edge:
Web/App/API/MCP Client ──▶ MCP Server ──▶ API Server
```

## 容器职责

### Web App

- 登录、家庭成员管理、首页看板
- 成员档案模态框与各子页
- AI 对话浮层、SSE 消息渲染、草稿确认交互

### API Server

- 认证、成员级权限、健康数据 CRUD
- Dashboard 聚合与成员详情查询
- AI 会话入口、SSE 流式输出、草稿确认接口
- 定时任务触发与健康摘要/提醒写入

### AI Runtime（API Server 内部模块）

- `agent.py`：PydanticAI agent 工厂与 system prompt 组装
- `daily_generation.py`：离线结构化日更生成，供 scheduler 调用
- `deps.py`：运行时依赖注入
- `tools/`：读取、低风险写入、审批写入、建议工具
- `orchestrator.py`：`agent.iter()` 循环和 SSE 事件映射
- `transcription.py`：音频转写入口
- `extraction.py`：从对话或附件上下文生成结构化草稿
- `scheduler.py`：每日摘要与提醒任务

### Database

- 当前开发基线为本地 SQLite 文件
- 存储用户、成员、健康事实、对话会话、调度定义
- 目标部署 ADR 仍保留 PostgreSQL 方向，但不再作为当前开发文档的默认运行前提

### MCP Server（后续阶段）

- 后续对外复用 API / service 层能力
- 不是当前 Web 对话路径的一部分
- 保持 skeleton 状态，待应用内能力稳定后再推进

## 核心数据流

### 1. 首页与成员档案

```text
Web App
  → API Server
  → Health services / repository
  → Database
  → 返回成员信息、HealthSummary、CarePlan、健康资源数据
```

### 2. AI 对话与草稿确认

```text
用户消息 / 语音 / 附件上下文
  → Web App
  → API Server 鉴权与会话加载
  → AI Runtime 组装最小上下文
  → PydanticAI agent.iter()
      → 按需调用读取工具 / 写入工具 / 审批工具
  → SSE 返回 message/tool 事件
  → 用户确认高风险草稿
  → API Server 复用服务层写入数据库
```

### 3. 每日 AI 生成任务

```text
Scheduler 触发
  → 服务层读取成员最小健康快照
  → AI Runtime 离线生成结构化 HealthSummary / CarePlan
  → 写回 Database
  → 首页和成员档案读取最新结果
```

### 4. 未来 MCP 调用

```text
外部 MCP Client
  → MCP Server
  → API Server / service 层
  → Database
```

## 当前明确不再采用的旧路线

- 不再把 `DocumentReference` 和独立文档上传流程当作健康事实层主路径
- 不再把关键字路由的自定义 orchestrator 当作默认 AI 编排
- 不再把独立 `File Storage` 容器写成当前主架构的一部分
- 不再把 `providers/` 抽象写成当前 AI 设计的中心

## 当前状态

- 文档已经提前切换到最新主线，以避免后续开发继续被旧设计污染
- Step 6 前端页面重构、Step 7 AI 驱动功能、Step 8 测试更新已经落到当前基线
- 每日摘要与提醒由 scheduler 注册的内建日更任务驱动，默认使用本地时区的 05:00 / 06:00 执行，可通过环境变量调整
- 因此本文是“当前目标架构 + 开发基线”，不是对所有现有代码状态的逐行复述
