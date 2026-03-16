# Phase 4 AI 技术设计

> 本文档定义当前开发主线的 AI 架构。旧的规则驱动 orchestrator、独立 provider 主抽象和文档上传主链路已不再是当前默认路线；当前基线以 [ADR-0010](../adr/0010-pydantic-ai-tool-calling.md) 与 [ADR-0011](../adr/0011-three-level-member-permissions.md) 为准。

## 目标

- 在应用内提供流式 AI 对话
- 支持文字、语音、附件上下文进入统一对话入口
- 从对话内容生成结构化健康档案草稿与建议
- 对高风险写入保持“先草稿、后确认”
- 生成 flexible `HealthSummary` 与多条 richer `CarePlan`
- 为会话历史提供自动标题 / 摘要能力

## 非目标

- 不把 MCP 作为当前 Web 对话第一跳
- 不恢复 `DocumentReference` 独立文档资源与旧上传处理链路
- 不让 AI 直接访问数据库表
- 不重新引入关键字匹配驱动的旧 orchestrator

## 核心决策

### 1. 对话编排采用 PydanticAI Tool-Calling

对话编排由 PydanticAI 驱动，使用 `agent.iter()` 运行多轮 tool-calling 循环。一次请求可以经历“读取数据 -> 推理 -> 建议或草稿 -> 继续生成文字”的多步过程。每日摘要与提醒同样复用这套运行时，但采用结构化输出而不是聊天式输出。

### 2. 所有数据访问都走服务层与三级权限校验

AI 工具只能调用现有业务服务或 repository 边界。成员级权限校验仍由后端服务层负责：

- 读取成员数据至少需要 `read`
- 修改健康档案至少需要 `write`
- 查看 / 授予 / 撤销授权至少需要 `manage`

AI 不能绕过这些边界。

### 3. Prompt 只注入最小必要上下文

System prompt 只提供以下内容：

- 当前用户身份与角色
- 当前会话 ID、页面上下文、焦点成员
- 已授权成员范围
- 当前任务说明

详细健康数据一律通过工具按需读取。

### 4. 建议与写回统一为 `HealthRecordAction`

建议卡片和草稿确认共用同构结构：

```text
HealthRecordAction
  - action: create | update | delete
  - resource: 目标档案资源类型
  - target_member_id: 目标成员
  - record_id: update/delete 时必填
  - payload: create/update 时的结构化字段
```

约束：

- 建议必须携带 `target_member_id`
- 建议只能指向已存在的档案栏目
- 高风险档案写入统一走草稿确认，不允许 AI 直接落库

### 5. 工具按风险分级

| 类别 | 说明 | 典型工具 |
|---|---|---|
| 读取类工具 | 无副作用，可随时调用 | `get_member_summary`、`get_recent_observations`、`get_conditions`、`get_medications`、`get_sleep_records`、`get_workout_records`、`get_encounters`、`get_care_plans` |
| 低风险写入 | 可直接执行 | `create_care_plan`、`create_scheduled_task`、`mark_care_plan_done` |
| 高风险写入 | 必须审批 | `draft_observations`、`draft_conditions`、`draft_medications`、`draft_encounter` |
| 主动建议 | 只给建议，不直接写库 | `suggest_record_update` |

### 6. 语音输入不分叉数据流

语音输入链路为：

```text
Web Audio API 采集
  → 上传音频到后端
  → transcription.py 调用真实 STT provider
  → 返回文本
  → 填回统一输入框
  → 继续走同一聊天 / SSE / 草稿确认链路
```

STT provider 是实现细节，必须封装在 `backend/app/ai/transcription.py` 后面。

### 7. 会话标题与摘要是应用能力

`ChatSession` 需要持久化 `title` 与 `summary`。摘要在首个有效用户回合后自动生成，当前优先简单规则；后续可以替换为模型生成，但不改变 API 与存储边界。

## 运行时模块边界

当前 AI 代码应围绕以下职责组织：

- `backend/app/ai/deps.py`：`AIDeps` 与运行时依赖注入
- `backend/app/ai/agent.py`：agent 工厂、system prompt、工具注册
- `backend/app/ai/daily_generation.py`：结构化日更输出 agent
- `backend/app/ai/tools/`：读取类、低风险写入类、审批写入类、建议类工具
- `backend/app/ai/orchestrator.py`：`agent.iter()` 循环、SSE 事件映射、审批恢复
- `backend/app/ai/transcription.py`：真实 STT provider 适配
- `backend/app/ai/extraction.py`：从对话和附件上下文生成结构化草稿
- `backend/app/ai/scheduler.py`：每日摘要与提醒生成任务

## 对话链路

```text
用户输入（文字 / 语音 / 附件上下文）
  → FastAPI 路由鉴权
  → 组装 AIDeps 与最小上下文
  → PydanticAI agent.iter()
      → 读取工具 / 低风险写入 / 审批写入 / 建议
  → 自定义 SSE 事件输出
  → 前端展示消息、工具结果、建议卡片、草稿卡片
  → 用户确认高风险草稿
  → 服务层正式写入
```

## SSE 协议约束

当前应用维持自定义 SSE 协议，而不是直接采用官方 AI UI 协议层。前后端需要围绕以下事件保持一致：

- `message.delta`
- `message.completed`
- `tool.started`
- `tool.result`
- `tool.draft`
- `tool.suggest`
- `tool.error`

高风险草稿确认接口以 `POST /api/chat/{session_id}/confirm-draft` 为主。

## 日更生成约束

每日任务至少包含两类输出：

- `refresh_health_summaries`
- `refresh_daily_care_plans`

生成约束：

- `HealthSummary` 条数不固定，`category` 可由 AI 自定义
- `HealthSummary.status` 只允许 `good / warning / alert`
- `CarePlan` 支持多条输出，并包含 `time_slot`、`icon_key`、`assignee_member_id`、`notes`
- 首页读取聚合后的全家 CarePlan，成员概览只读取该成员相关项
- AI 输出非法或单个成员生成失败时，保留已有数据，不回退到旧模板

## PydanticAI API 约束

当前实现与后续修改应遵守以下结论：

- 以当前稳定版 PydanticAI 官方文档为准，升级前先重新核对
- 只要存在 `requires_approval=True` 的工具，agent `output_type` 必须包含 `DeferredToolRequests`
- `RunContext[AIDeps]` 是工具和 prompt 读取运行时上下文的标准方式
- `agent.override(...)` 应作为上下文管理器使用
- FastAPI 继续使用 `StreamingResponse` + 自定义 async generator

## 当前明确废弃的旧设计

- 关键字和正则驱动的单步工具选择
- 围绕 `providers/` 构建的主编排框架
- 以 `DocumentReference` 为中心的独立文档抽取链路
- 把“分析建议”和“结构化录入”混成同一种无审批写入
