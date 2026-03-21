# KinCare 架构总览

> 本文档定义当前开发主线的目标架构。若旧实现、旧文档或旧术语与本文冲突，以 [KinCare v2 开发计划](../../.cursor/plans/kincare_v2_开发计划_a24f52a8.plan.md)、[ADR-0009](../adr/0009-simplified-health-fact-layer.md)、[ADR-0010](../adr/0010-pydantic-ai-tool-calling.md) 与 [ADR-0011](../adr/0011-three-level-member-permissions.md) 为准。

## 当前主线

- 单实例 = 一个家庭空间
- 前端为 React + Vite SPA，后端为 FastAPI
- 认证采用 username-first：`username` 为登录标识，`email` 为可选联系方式
- AI 在应用内运行，基于 PydanticAI
- 健康数据采用简化版健康事实层
- 成员授权采用 `read / write / manage` 三级权限，并支持 `specific / all` 范围
- 首页家庭仪表盘、成员概览、统一输入区、会话历史共享同一套数据语义
- 当前开发运行时继续使用 SQLite；官方终端用户安装路径为单机 Docker Compose，开发工作流仍以本地 FastAPI + Vite 为主

## 设计原则

1. **隐私优先**：默认本地部署、本地存储、最小化外部依赖
2. **单一真相源**：健康数据、AI 摘要、提醒、权限和会话历史都回到统一服务层与数据模型
3. **能力型权限**：成员访问能力以 `manage > write > read` 为真相源，前端只展示，后端负责最终判定
4. **最小上下文**：prompt 只注入身份、会话、页面焦点和授权范围，详细数据靠工具按需读取
5. **统一对话入口**：文字、语音、附件上下文进入同一对话与审批链路，不分叉数据流
6. **会话连续性**：会话标题、摘要和消息历史是一等能力，支持用户恢复上下文
7. **当前应用优先**：先把应用内体验跑通，MCP 作为后续对外暴露层，而不是当前 Web 对话主通路

## 系统上下文

| 参与者 | 说明 |
|---|---|
| 家庭成员 | 通过浏览器使用家庭仪表盘、成员档案、权限界面与 AI 对话 |
| 外部 LLM / STT 服务 | 提供 PydanticAI 推理与真实语音转写能力 |
| 外部 AI / MCP Client | 后续阶段可通过 MCP 接入 KinCare |

## 容器视图

```text
┌────────────────────────────────────────────────────────────┐
│                         KinCare                          │
│                                                            │
│  ┌──────────────┐      ┌──────────────────────────────┐    │
│  │   Web App    │─────▶│           API Server         │    │
│  │  React SPA   │      │ REST API / SSE / Scheduler   │    │
│  │              │      │ Health Services / AI Runtime │    │
│  └──────────────┘      └──────────────┬───────────────┘    │
│                                       │                    │
│                                 ┌─────▼─────┐              │
│                                 │ Database  │              │
│                                 │ SQLite    │              │
│                                 └───────────┘              │
└───────────────────────────────────────┬────────────────────┘
                                        │
                    ┌───────────────────▼───────────────────┐
                    │ External Model Services                │
                    │ OpenAI-compatible LLM / STT provider   │
                    └────────────────────────────────────────┘

Optional future edge:
Web/App/API/MCP Client ──▶ MCP Server ──▶ API Server
```

## 容器职责

### Web App

- 品牌化首页家庭仪表盘与成员概览入口
- 成员档案、手动编辑与权限管理面板
- 统一输入区、语音采集、SSE 消息流和草稿确认交互
- 会话历史列表与会话恢复
- 设置 Sheet 三 Tab：**偏好**（语言切换 zh/en + 每日刷新时间 + 外观深浅/系统，均 localStorage 持久化；时间配置 admin 专用）、**AI 配置**（管理员专用，语音转录与对话模型运行参数）
- Docker 部署时由前置静态 Web 容器提供 SPA 资源，并以同源 `/api` 反向代理到 API Server

### API Server

- 认证、成员级权限、健康数据 CRUD
- 用户认证以 `username` 为唯一登录标识；`email` 仅作为可选联系字段参与去重
- Dashboard 聚合、成员详情与会话历史查询
- AI 会话入口、附件解析接口、SSE 流式输出、草稿确认和音频转写接口
- 定时任务触发与健康摘要 / 提醒写入
- 管理员系统配置 API（`GET/PUT /api/admin/settings`）：读写 `system_config` 表，AI / STT 运行参数及每日刷新时间覆盖 `.env` 默认值

### AI Runtime（API Server 内部模块）

- `agent.py`：PydanticAI agent 工厂与 system prompt 组装
- `daily_generation.py`：离线结构化日更生成
- `deps.py`：运行时依赖注入
- `tools/`：读取、低风险写入、审批写入、建议工具
- `orchestrator.py`：`agent.iter()` 循环与 SSE 事件映射
- `transcription.py`：真实 STT provider 适配与转写入口
- `extraction.py`：从对话或附件上下文生成结构化草稿
- `scheduler.py`：每日摘要与提醒任务

### Attachments

- `backend/app/attachments/`：独立附件解析边界，负责文档 / 图片解析、`.doc` 本地回退，以及把受控摘录交给对话链路
- 音频附件继续走 `transcription.py`，不与 PDF / 图片 / 文档解析复用同一实现

### Database

- 当前开发基线为本地 SQLite 文件
- 存储用户、成员、健康事实、权限授权、对话会话、会话摘要与调度定义
- 目标部署 ADR 仍保留 PostgreSQL 方向，但不作为当前开发文档的默认运行前提

### MCP Server（后续阶段）

- 后续对外复用 API / service 层能力
- 不是当前 Web 对话路径的一部分
- 在 Compose 中保持可选 profile 状态，待应用内能力稳定后再推进

## 核心数据流

### 1. 家庭仪表盘与成员档案

```text
Web App
  → API Server
  → Health services / repository
  → Database
  → 返回成员信息、权限摘要、HealthSummary、CarePlan、健康资源数据
```

### 2. AI 对话、建议与草稿确认

```text
用户消息 / 语音 / 附件上下文
  → Web App
  → 附件先经过独立解析接口（音频例外仍走 STT）
  → API Server 鉴权与会话加载
  → AI Runtime 组装最小上下文与授权范围
  → PydanticAI agent.iter()
      → 按需调用读取工具 / 写入工具 / 审批工具 / 建议工具
  → SSE 返回 message/tool 事件
  → 用户确认高风险草稿
  → API Server 复用服务层写入数据库
```

### 3. 会话历史与恢复

```text
Web App 打开历史记录
  → API Server 查询 ChatSession 列表
  → 返回 title / summary / updated_at
  → 用户选择会话
  → API Server 返回消息历史
  → 前端恢复当前会话上下文
```

### 4. 每日 AI 生成任务

```text
Scheduler 触发
  → 服务层读取成员最小健康快照
  → AI Runtime 生成 flexible HealthSummary 与多条 CarePlan
  → 写回 Database
  → 首页和成员档案读取最新结果
```

### 5. 未来 MCP 调用

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
- 不再把 `providers/` 抽象写成当前 AI 设计中心

## 当前规划状态

- Step 1 已将文档与 ADR 基线切到 v2 主线
- Step 2A / 2B / 2C / 3C 是后续并行实现入口
- 因此本文描述的是当前目标架构，而不是对历史实现的兼容性说明
