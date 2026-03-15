# Phase 4 AI 技术设计

> 本文档定义当前开发主线的 AI 架构。旧的规则驱动 orchestrator、独立 provider 主抽象和文档上传主链路已不再是当前默认路线；当前基线以 [ADR-0010](../adr/0010-pydantic-ai-tool-calling.md) 为准。

## 目标

- 在应用内提供流式 AI 对话
- 支持语音转写进入统一对话入口
- 从对话内容或附件上下文生成结构化健康档案草稿
- 对高风险写入保持“先草稿、后确认”
- 为 Step 7 的每日 `HealthSummary` 和 `CarePlan` 生成提供统一运行时

## 非目标

- 不把 MCP 作为当前 Web 对话第一跳
- 不恢复 `DocumentReference` 独立文档资源与旧上传处理链路
- 不让 AI 直接访问数据库表
- 不重新引入关键字匹配驱动的旧 orchestrator

## 核心决策

### 1. 对话编排采用 PydanticAI Tool-Calling

对话编排由 PydanticAI 驱动，使用 `agent.iter()` 运行多轮 tool-calling 循环。一次请求可以经历“读取数据 -> 推理 -> 写入/建议 -> 继续生成文字”的多步过程。Step 7 的日更能力同样基于 PydanticAI，但采用结构化输出而不是聊天式 tool-calling。

### 2. 所有数据访问都走服务层

AI 工具只调用现有业务服务或 repository 边界。成员级权限校验仍由后端现有服务层负责，AI 不能绕过这些边界。

### 3. Prompt 只注入最小必要上下文

System prompt 只提供以下内容：

- 当前用户身份与角色
- 当前会话 ID、页面上下文、焦点成员
- 已授权成员范围
- 当前任务说明

详细健康数据一律通过工具按需读取。

### 4. 工具按风险分级

| 类别 | 说明 | 典型工具 |
|---|---|---|
| 读取类工具 | 无副作用，可随时调用 | `get_member_summary`、`get_recent_observations`、`get_conditions`、`get_medications`、`get_sleep_records`、`get_workout_records`、`get_encounters`、`get_care_plans` |
| 低风险写入 | 可直接执行 | `create_care_plan`、`create_scheduled_task`、`mark_care_plan_done` |
| 高风险写入 | 必须审批 | `draft_observations`、`draft_conditions`、`draft_medications`、`draft_encounter` |
| 主动建议 | 只给建议，不直接写库 | `suggest_record_update` |

### 5. 审批流是核心交互，不是补丁能力

核心健康档案写入统一通过 `DeferredToolRequests` 和确认接口恢复执行，前端展示结构化草稿卡片，而不是依赖自由文本确认。

## 运行时模块边界

当前 AI 代码应围绕以下职责组织：

- `backend/app/ai/deps.py`：`AIDeps` 与运行时依赖注入
- `backend/app/ai/agent.py`：agent 工厂、system prompt、工具注册
- `backend/app/ai/daily_generation.py`：Step 7 日更生成的结构化输出 agent
- `backend/app/ai/tools/`：读取类、低风险写入类、审批写入类、建议类工具
- `backend/app/ai/orchestrator.py`：`agent.iter()` 循环、SSE 事件映射、审批恢复
- `backend/app/ai/transcription.py`：语音转写
- `backend/app/ai/extraction.py`：从对话和附件上下文生成结构化草稿，不再承担独立文档资源写入流程
- `backend/app/ai/scheduler.py`：每日摘要与提醒生成任务

## 对话链路

```text
用户输入（文字 / 语音 / 附件上下文）
  → FastAPI 路由鉴权
  → 组装 AIDeps 与最小上下文
  → PydanticAI agent.iter()
      → 读取工具 / 低风险写入 / 审批写入 / 建议
  → 自定义 SSE 事件输出
  → 前端展示消息、工具结果、草稿卡片
  → 用户确认高风险草稿
  → 服务层正式写入
```

## SSE 协议约束

当前应用维持自定义 SSE 协议，而不是直接采用官方 AI UI 协议层。前端和后端需要围绕以下事件保持一致：

- `message.delta`
- `message.completed`
- `tool.started`
- `tool.result`
- `tool.draft`
- `tool.suggest`
- `tool.error`

高风险草稿确认接口应以 `POST /api/chat/{session_id}/confirm-draft` 为主，不再沿用旧的全局确认端点。

## Step 7 调度能力

Step 7 需要在同一套 AI 运行时上补齐两类定时任务：

- `refresh_health_summaries`
- `refresh_daily_care_plans`

这两类任务通过服务层读取成员最小健康快照，再由结构化输出 agent 生成结果并写回 `HealthSummary` / `CarePlan`。

当前实现约束：

- scheduler 启动时注册内建 daily jobs，而不是依赖用户创建的 `ScheduledTask`
- 默认执行时间为本地时区 05:00（摘要）与 06:00（提醒），可通过环境变量调整
- `HealthSummary` 固定输出 3 条：`chronic-vitals / lifestyle / body-vitals`
- `CarePlan` 每位成员每天最多保留 1 条 AI 生成提醒，手动提醒不受刷新影响
- AI 未配置、模型输出非法或单个成员生成失败时，保留该成员当天已有数据，不回退到规则模板

## PydanticAI API 约束（已吸收自 Step 2 调研）

当前实现与后续修改应遵守以下已验证结论：

- 基线版本按 `pydantic-ai >= 1.68.0` 设计；升级前先重新核对官方文档
- 只要存在 `requires_approval=True` 的工具，agent `output_type` 必须包含 `DeferredToolRequests`
- `RunContext[AIDeps]` 是工具和 prompt 读取运行时上下文的标准方式
- `TestModel` 与 `FunctionModel` 可用于测试，但导入路径不同
- `agent.override(...)` 应作为上下文管理器使用
- FastAPI 继续使用 `StreamingResponse` + 自定义 async generator，不必切到官方 UI Adapter 协议

## 当前明确废弃的旧设计

- 关键字和正则驱动的单步工具选择
- 围绕 `providers/` 构建的主编排框架
- 以 `DocumentReference` 为中心的独立文档抽取链路
- 把“分析建议”和“结构化录入”混成同一种无审批写入

## 当前状态

- 文档已经切换到最新 AI 主线，为接下来的 Step 6-8 提供统一指导
- Step 4 被视为当前开发基线的一部分
- Step 7 的定时生成能力已经落地，当前描述同时包含实现边界与默认调度策略
