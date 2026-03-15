# AI 功能架构设计：基于 PydanticAI 的 Tool-Calling 循环

> 状态：专家建议草案（待审核）
> 日期：2026-03-13
> 关联文档：`docs/architecture/phase-4-ai-design.md`、`docs/architecture/overview.md`

---

## 1. 背景与问题

当前 `backend/app/ai/orchestrator.py` 中的 `ChatOrchestrator.handle_message` 使用**规则驱动路由**决定调用哪个工具：

```python
# 当前实现（orchestrator.py L86-L102）
if focus_member_id and "提醒" in content:
    tool_result = create_scheduled_task_tool(...)
if tool_result is None:
    tool_result = draft_health_record(message=content)     # regex 匹配
if tool_result is None and focus_member_id is not None:
    tool_result = read_member_summary(...)
```

核心局限：

- 工具选择靠 `"提醒" in content` 字符串匹配和正则，无法理解自然语言意图
- 每次请求最多调用一个工具，无法组合读+写多步操作
- LLM 只在最后生成文字，不参与工具选择决策
- 无法处理隐式意图（如"下午想跑步"→ 创建提醒）
- 无法区分"帮我分析"与"帮我提取"两种不同用户意图

本文档定义将 orchestrator 升级为 **LLM 驱动的 Tool-Calling 循环**的完整方案，采用 **PydanticAI** 框架实现。

---

## 2. 框架选型：PydanticAI

### 选择理由

| 维度 | PydanticAI | 原生 OpenAI SDK | LangChain/LangGraph |
|------|-----------|----------------|---------------------|
| 与现有架构兼容性 | FastAPI + Pydantic 风格，天然匹配 | 完美但手写 schema 繁琐 | 需要适配层 |
| 工具定义方式 | Python 类型注解 + 装饰器 | 手写 JSON Schema | 多种方式 |
| 依赖注入 | `RunContext[DepsType]` 原生支持 | 无，需自行封装 | 有但侵入性强 |
| 流式输出 | `agent.iter()` + node streaming | 自己处理 delta chunks | 内置 |
| 人工确认（草稿审批） | `requires_approval` + `DeferredToolRequests` 原生支持 | 自行实现 | LangGraph 支持 |
| 模型兼容性 | `OpenAIChatModel` + `OpenAIProvider(base_url=...)` 支持所有 OAI-compatible 端点 | 最灵活 | 好 |
| 引入复杂度 | 轻量，一个 pip 包 | 极低 | 100+ 依赖 |

### 版本要求

- `pydantic-ai >= 1.0.5`（使用 `agent.iter()`、`DeferredToolRequests`、`requires_approval` 等新 API）
- 添加到 `backend/requirements.txt`

---

## 3. 核心架构：LLM Tool-Calling 循环

### 3.1 整体流程

```
用户消息（文字 / 语音转文字 / 附件）
  ↓
后端鉴权，加载会话上下文
  ↓
组装 system_prompt（最小上下文）+ 注册工具列表
  ↓
PydanticAI agent.iter() 开始循环
  ↓
  ┌─────────────────────────────────────────────────────┐
  │  LLM 决策：                                         │
  │  ├── 需要信息 → 调用读取工具 → 结果追加 → 继续循环    │
  │  ├── 用户要求行动 → 调用写入工具                      │
  │  │   ├── 低风险写入 → 直接执行 → SSE tool.result      │
  │  │   └── 高风险写入 → DeferredToolRequests → 暂停     │
  │  │       → SSE tool.draft → 等待前端确认               │
  │  ├── 分析完发现可录入数据 → suggest_record_update      │
  │  │   → SSE tool.suggest → 继续生成文字                 │
  │  └── 直接生成文字 → 流式输出 → 循环结束                │
  └─────────────────────────────────────────────────────┘
  ↓
消息与工具事件持久化到 ChatMessage
  ↓
SSE 流完成
```

### 3.2 最大循环轮数

设定 `max_rounds=8`，防止无限循环。每轮包含一次 LLM 调用 + 0..N 次工具调用。

---

## 4. 依赖注入设计

### 4.1 依赖类型定义

```python
from dataclasses import dataclass
from typing import Any

from app.core.database import Database
from app.core.dependencies import CurrentUser
from app.ai.scheduler import HomeVitalScheduler


@dataclass
class AIDeps:
    """注入到所有 AI 工具中的运行时依赖"""
    database: Database
    current_user: CurrentUser
    family_space_id: str
    focus_member_id: str | None
    scheduler: HomeVitalScheduler
    session_id: str
    page_context: str | None
    document_ids: list[str]
```

所有工具函数通过 `RunContext[AIDeps]` 访问依赖，不直接导入全局状态。

### 4.2 Agent 初始化

```python
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

def create_agent(settings: Settings) -> Agent[AIDeps, str]:
    model = OpenAIChatModel(
        settings.ai_model,
        provider=OpenAIProvider(
            base_url=settings.ai_base_url,
            api_key=settings.ai_api_key,
        ),
    )
    agent = Agent(
        model,
        deps_type=AIDeps,
        output_type=str,
        instructions=build_system_prompt,  # 动态 system prompt 函数
    )
    # 注册所有工具（见第 5 节）
    register_tools(agent)
    return agent
```

---

## 5. 工具集设计

### 5.1 分类与风险分级

工具分为四类，风险等级决定是否需要用户确认：

#### 读取类工具（无副作用，LLM 可随时调用）

| 工具函数名 | 描述（传给 LLM 的 docstring） | 返回内容 |
|---|---|---|
| `get_member_summary` | 获取成员基础信息、年龄、身高、血型、紧急联系人 | 成员档案摘要 |
| `get_recent_observations` | 获取成员最近的健康观测记录，可按 category 或 code 筛选 | 观测记录列表 |
| `get_conditions` | 获取成员当前活跃的慢病、诊断、过敏状况 | Condition 列表 |
| `get_medications` | 获取成员当前用药方案和今日服药状态 | Medication + MedicationLog |
| `get_care_plans` | 获取成员当前的提醒和健康计划 | CarePlan 列表 |
| `get_sleep_records` | 获取成员最近的睡眠记录 | SleepRecord 列表 |
| `get_encounters` | 获取成员的就诊历史 | Encounter 列表 |
| `read_document_content` | 读取已上传文档的抽取内容或原始文本 | 文档内容 |

#### 低风险写入工具（LLM 自主执行，直接写入）

| 工具函数名 | 描述 | 触发场景 |
|---|---|---|
| `create_care_plan` | 新增一条提醒或健康计划 | "下午跑步"、"提醒喝水" 等意图 |
| `create_scheduled_task` | 创建定时任务 | "每天 8 点提醒吃药" 等调度意图 |
| `mark_care_plan_done` | 标记某条提醒为已完成 | "已经吃药了"、"跑步完了" |
| `log_medication_taken` | 记录一次服药打卡 | "药吃了" |

#### 高风险写入工具（需用户确认，使用 `requires_approval=True`）

| 工具函数名 | 描述 | 触发场景 |
|---|---|---|
| `draft_observations` | 创建观测记录草稿（血压、血糖、体温等） | 用户明确要求"提取"/"录入"/"保存" |
| `draft_conditions` | 创建健康状况草稿（诊断、过敏） | 用户明确要求从文档提取病史 |
| `draft_medications` | 创建用药记录草稿 | 用户明确要求提取处方信息 |
| `draft_encounter` | 创建就诊记录草稿 | 用户明确要求录入就诊记录 |

#### 主动建议工具（分析完成后附带建议，不直接写入）

| 工具函数名 | 描述 | 触发场景 |
|---|---|---|
| `suggest_record_update` | 分析文档/对话后发现可录入数据，向用户建议更新档案 | 用户说"帮我分析"而非"帮我提取"时 |

### 5.2 工具实现示例

#### 读取工具

```python
from pydantic_ai import Agent, RunContext

@agent.tool
async def get_recent_observations(
    ctx: RunContext[AIDeps],
    category: str | None = None,
    code: str | None = None,
    limit: int = 10,
) -> str:
    """获取成员最近的健康观测记录。
    
    可按 category (chronic-vitals/lifestyle/body-vitals/mood) 
    或 code (bp-systolic/blood-glucose/heart-rate 等) 筛选。
    """
    if ctx.deps.focus_member_id is None:
        return "请先选择要查询的家庭成员。"
    ensure_member_access(
        ctx.deps.database, ctx.deps.current_user,
        ctx.deps.focus_member_id, require_write=False,
    )
    with ctx.deps.database.connection() as conn:
        records = health_repository.list_observations(
            conn,
            member_id=ctx.deps.focus_member_id,
            category=category,
            code=code,
            limit=limit,
        )
    if not records:
        return "暂无相关观测记录。"
    lines = []
    for r in records:
        val = r["value"] if r["value"] is not None else r["value_string"]
        lines.append(f"{r['display_name']}: {val}{r['unit'] or ''} ({r['effective_at']})")
    return "\n".join(lines)
```

#### 低风险写入工具

```python
@agent.tool
async def create_care_plan(
    ctx: RunContext[AIDeps],
    title: str,
    description: str = "",
    category: str = "activity-reminder",
    scheduled_at: str | None = None,
) -> str:
    """为成员添加一条提醒或健康计划。
    
    当用户表达活动意图（如"想跑步"、"要喝水"）或明确要求设置提醒时使用。
    category 可选: medication-reminder / activity-reminder / checkup-reminder / health-advice / daily-tip
    scheduled_at 格式: ISO 8601 时间戳，可为空。
    """
    if ctx.deps.focus_member_id is None:
        return "请先选择家庭成员。"
    ensure_member_access(
        ctx.deps.database, ctx.deps.current_user,
        ctx.deps.focus_member_id, require_write=True,
    )
    with ctx.deps.database.connection() as conn:
        record = health_repository.create_resource(
            conn, "care-plans",
            member_id=ctx.deps.focus_member_id,
            values={
                "title": title,
                "description": description,
                "category": category,
                "status": "active",
                "scheduled_at": scheduled_at,
                "generated_by": "ai",
            },
        )
    return f"已添加提醒：{title}"
```

#### 高风险写入工具（需确认）

```python
@agent.tool(requires_approval=True)
async def draft_observations(
    ctx: RunContext[AIDeps],
    observations: list[dict],
) -> str:
    """创建观测记录草稿并等待用户确认后写入正式档案。
    
    仅在用户明确要求"提取"、"录入"、"保存"数据时使用。
    每条 observation 包含: category, code, display_name, value, unit, effective_at。
    """
    ensure_member_access(
        ctx.deps.database, ctx.deps.current_user,
        ctx.deps.focus_member_id, require_write=True,
    )
    # 用户已确认（ctx.tool_call_approved == True），执行写入
    with ctx.deps.database.connection() as conn:
        for obs in observations:
            health_repository.create_resource(
                conn, "observations",
                member_id=ctx.deps.focus_member_id,
                values={**obs, "source": "document-extract"},
            )
    return f"已写入 {len(observations)} 条观测记录。"
```

#### 主动建议工具

```python
@agent.tool_plain
def suggest_record_update(
    suggestion_summary: str,
    extractable_data: list[dict],
) -> str:
    """分析完文档或对话后，发现了可以录入健康档案的结构化数据。
    
    仅在用户要求"分析"而非"提取"时使用。
    此工具不会写入任何数据，只向用户展示建议。
    用户可以选择保存或忽略。
    """
    count = len(extractable_data)
    return f"分析完成。另外发现了 {count} 条可录入档案的数据：{suggestion_summary}。需要保存吗？"
```

### 5.3 LLM 行为引导

工具的 docstring 是 LLM 判断何时调用的关键依据。以下是 system prompt 中的关键规则段：

```
行为规则：
1. 用户要求"提取/录入/保存"数据 → 使用 draft_* 系列工具（需用户确认）
2. 用户要求"分析/总结/理解" → 先完成分析，若发现可录入数据则调用 suggest_record_update
3. 用户表达活动/计划意图（"想跑步"、"要喝水"） → 使用 create_care_plan 直接创建
4. 用户设置定时提醒 → 使用 create_scheduled_task
5. 回答健康问题前，先调用读取工具获取相关数据，不要凭空编造健康信息
6. 绝不从分析请求中推断出提取意图
```

---

## 6. System Prompt 策略

### 6.1 动态 System Prompt

使用 PydanticAI 的 `instructions` 参数传入动态函数：

```python
@agent.instructions
async def build_system_prompt(ctx: RunContext[AIDeps]) -> str:
    parts = [
        "你是 HomeVital 家庭健康助手，帮助用户管理家庭成员的健康档案。",
        "",
        f"当前用户：{ctx.deps.current_user.email}",
        f"用户角色：{ctx.deps.current_user.role}",
        f"家庭空间：{ctx.deps.family_space_id}",
        f"今天：{date.today().isoformat()}",
    ]
    if ctx.deps.focus_member_id:
        parts.append(f"当前关注成员 ID：{ctx.deps.focus_member_id}")
    if ctx.deps.page_context:
        parts.append(f"当前页面上下文：{ctx.deps.page_context}")
    parts.extend([
        "",
        "重要规则：",
        "- 不要在回答中编造健康数据，需要时调用工具查询",
        "- 健康数据写入操作必须复用工具，不要在文字中声称已修改但实际未调用工具",
        "- 用中文回答",
        "- 回答简洁，不超过 200 字，除非用户要求详细分析",
    ])
    return "\n".join(parts)
```

### 6.2 最小上下文原则

System prompt 中**不预加载**任何健康数据。以下信息通过工具按需读取：

- 成员详细档案 → `get_member_summary`
- 观测数据/趋势 → `get_recent_observations`
- 慢病和过敏 → `get_conditions`
- 用药情况 → `get_medications`
- 提醒列表 → `get_care_plans`
- 睡眠记录 → `get_sleep_records`
- 就诊历史 → `get_encounters`
- 文档内容 → `read_document_content`

---

## 7. SSE 事件协议

### 7.1 事件类型定义

| 事件名 | 触发时机 | payload 结构 | 前端行为 |
|--------|---------|-------------|---------|
| `session.started` | 会话开始 | `{ session_id, member_id }` | 初始化会话状态 |
| `tool.started` | 工具开始执行 | `{ tool_name }` | 显示"正在查询…"状态条 |
| `tool.result` | 低风险写入完成 | `{ tool_name, content, meta }` | 刷新对应资源列表（如首页提醒） |
| `tool.draft` | 高风险写入等待确认 | `{ draft, resource_types[], requires_confirmation: true }` | 渲染草稿确认卡片 |
| `tool.suggest` | AI 分析后主动建议 | `{ suggestion_summary, extractable_data[], member_id }` | 渲染建议气泡 |
| `tool.write_ok` | 用户确认写入完成 | `{ resource_type, count }` | 刷新对应档案页 |
| `tool.error` | 工具执行失败 | `{ tool_name, error }` | 显示友好错误提示 |
| `message.delta` | 文字流式片段 | `{ content }` | 追加到消息气泡 |
| `message.completed` | 回复完成 | `{ content }` | 标记消息完成 |

### 7.2 与 PydanticAI iter() 的映射

```python
async def stream_chat(agent, deps, user_message, session_id):
    """将 PydanticAI 的 agent.iter() 事件映射为 SSE 事件流"""
    yield sse_event("session.started", {"session_id": session_id, "member_id": deps.focus_member_id})

    async with agent.iter(user_message, deps=deps) as run:
        async for node in run:
            if Agent.is_model_request_node(node):
                async with node.stream(run.ctx) as request_stream:
                    async for event in request_stream:
                        if isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                            yield sse_event("message.delta", {"content": event.delta.content_delta})
                        elif isinstance(event, FinalResultEvent):
                            break

            elif Agent.is_call_tools_node(node):
                async with node.stream(run.ctx) as handle_stream:
                    async for event in handle_stream:
                        if isinstance(event, FunctionToolCallEvent):
                            yield sse_event("tool.started", {"tool_name": event.part.tool_name})
                        elif isinstance(event, FunctionToolResultEvent):
                            yield sse_event("tool.result", {
                                "tool_name": event.tool_name,
                                "content": event.result.content,
                            })

    # 如果返回了 DeferredToolRequests（高风险工具等待确认）
    if isinstance(run.result.output, DeferredToolRequests):
        yield sse_event("tool.draft", {
            "draft": serialize_deferred_requests(run.result.output),
            "requires_confirmation": True,
        })
    else:
        yield sse_event("message.completed", {"content": run.result.output})
```

---

## 8. 三种交互模式详解

### 8.1 模式 A：问答（Q&A）

> 用户："爸爸最近血压怎么样？"

```
LLM → 调用 get_recent_observations(category="chronic-vitals", code="bp-systolic")
    → 获取数据
    → 生成分析文字
    → message.delta + message.completed
```

SSE 事件序列：`session.started → tool.started → tool.result → message.delta... → message.completed`

### 8.2 模式 B：隐式行动意图

> 用户："下午三点想跑个步"

```
LLM → 调用 create_care_plan(title="下午跑步", category="activity-reminder", scheduled_at="2026-03-13T15:00:00")
    → 直接写入
    → 生成确认文字
```

SSE 事件序列：`session.started → tool.started → tool.result → message.delta... → message.completed`

前端收到 `tool.result` 后刷新首页今日提醒列表。

### 8.3 模式 C1：明确要求提取

> 用户：上传就医记录 + "帮我把里面的信息提取到档案"

```
LLM → 调用 read_document_content(document_id=...)
    → 获取文档内容
    → 调用 draft_observations(...) / draft_conditions(...) / draft_medications(...)
    → requires_approval=True → DeferredToolRequests
    → SSE tool.draft 事件
    → 前端渲染草稿确认卡片
```

用户确认后，前端 POST `/api/chat/{session_id}/confirm-draft`，后端拿 `DeferredToolResults` 恢复 agent 执行。

### 8.4 模式 C2：分析后主动建议

> 用户：上传体检报告 + "帮我看看这个报告"

```
LLM → 调用 read_document_content(document_id=...)
    → 获取文档内容
    → 生成分析文字（流式输出）
    → 发现可结构化数据
    → 调用 suggest_record_update(summary="...", extractable_data=[...])
    → SSE tool.suggest 事件
    → 继续生成文字
    → message.completed
```

前端在对话中渲染"建议气泡"，用户可选择"保存到档案"或"忽略"。

---

## 9. 用户确认（草稿审批）流程

### 9.1 PydanticAI 的 DeferredToolRequests 机制

PydanticAI 原生支持工具级别的人工审批：

1. 工具标记 `requires_approval=True`
2. LLM 调用该工具时，agent 不会立即执行，而是返回 `DeferredToolRequests`
3. 应用层将草稿数据通过 SSE 发送给前端
4. 用户确认/修改后，前端提交 `DeferredToolResults`
5. 后端恢复 agent 执行（`agent.run(..., deferred_tool_results=results)`）

### 9.2 确认 API

```
POST /api/chat/{session_id}/confirm-draft
Body: {
    "approvals": {
        "<tool_call_id>": true | false | { "reason": "不需要" }
    },
    "edits": {
        "<tool_call_id>": { ... 修改后的草稿数据 ... }
    }
}
```

### 9.3 前端确认卡片

```
┌─────────────────────────────────────────────────┐
│ 从文档中识别到以下健康数据                         │
│                                                 │
│ ☑ 观测记录：血糖 6.2 mmol/L (2026-03-10)        │
│ ☑ 就诊记录：内分泌科，市中心医院                    │
│ ☐ 用药记录：二甲双胍缓释片 0.5g（已有该药物记录）   │
│                                                 │
│ [编辑详情]           [忽略]      [确认保存 →]     │
└─────────────────────────────────────────────────┘
```

---

## 10. 代码改造清单

### 10.1 需要修改的文件

| 文件 | 改动内容 |
|------|---------|
| `backend/requirements.txt` | 添加 `pydantic-ai>=1.0.5` |
| `backend/app/ai/orchestrator.py` | **重写**：用 PydanticAI Agent 替换当前三个 if 分支，实现 `stream_chat` 异步生成器 |
| `backend/app/ai/providers/base.py` | **移除或保留为兼容层**：PydanticAI 自带 provider 抽象 |
| `backend/app/ai/providers/openai_compatible.py` | **移除或保留为兼容层**：改用 `OpenAIChatModel` + `OpenAIProvider` |
| `backend/app/ai/providers/stub.py` | **改造**：改为 PydanticAI 的 `TestModel` 或 `FunctionModel` 用于测试 |
| `backend/app/ai/tools/__init__.py` | **重写**：将现有函数改为 `@agent.tool` / `@agent.tool(requires_approval=True)` 装饰器形式，补充新工具 |
| `backend/app/ai/extraction.py` | **保留**：文档预处理逻辑不变，但 `apply_draft_to_member` 改为由草稿审批流程调用 |
| `backend/app/ai/scheduler.py` | **保留**：调度逻辑不变，`create_scheduled_task` 改为 `@agent.tool` 形式 |
| `backend/app/routers/chat.py` | **修改 SSE 端点**：改用新的 `stream_chat` 异步生成器；新增 `confirm-draft` 端点 |
| `backend/app/schemas/chat.py` | **扩展**：新增确认请求/响应 schema |
| `backend/app/core/config.py` | 保留现有 `ai_*` 配置项，语义不变 |

### 10.2 需要新增的文件

| 文件 | 内容 |
|------|------|
| `backend/app/ai/deps.py` | `AIDeps` dataclass 定义 |
| `backend/app/ai/agent.py` | Agent 工厂函数 `create_agent()`、system prompt 构建、工具注册 |
| `backend/app/ai/tools/read_tools.py` | 所有读取类工具 |
| `backend/app/ai/tools/write_tools.py` | 低风险写入工具 |
| `backend/app/ai/tools/draft_tools.py` | 高风险写入工具（`requires_approval=True`） |
| `backend/app/ai/tools/suggest_tools.py` | 主动建议工具 |

### 10.3 前端改造

| 位置 | 改动内容 |
|------|---------|
| SSE 事件处理 | 新增 `tool.draft`、`tool.suggest`、`tool.write_ok`、`tool.error` 事件 handler |
| 对话组件 | 新增 `DraftConfirmationCard`（草稿确认卡片）组件 |
| 对话组件 | 新增 `SuggestionBubble`（主动建议气泡）组件 |
| 首页看板 | 收到 `tool.result` 且 tool_name 为 `create_care_plan` 时自动刷新今日提醒 |
| 网络层 | 新增 `POST /api/chat/{session_id}/confirm-draft` 调用 |

---

## 11. 测试策略

### 11.1 PydanticAI 测试支持

PydanticAI 提供 `TestModel` 和 `FunctionModel` 用于测试，无需真实 LLM 调用：

```python
from pydantic_ai.models.test import TestModel

# 使用 TestModel 时，模型会按确定性方式调用工具或返回文本
test_agent = agent.override(model=TestModel())
result = await test_agent.run("爸爸血压怎么样", deps=mock_deps)
```

### 11.2 需要覆盖的测试用例

| 场景 | 断言 |
|------|------|
| 问答模式：查询成员血压 | `get_recent_observations` 被调用，返回包含血压数据的文字 |
| 隐式行动：用户说"想跑步" | `create_care_plan` 被调用，CarePlan 表新增一条记录 |
| 明确提取：用户说"帮我提取" | `draft_observations` 返回 `DeferredToolRequests` |
| 分析建议：用户说"帮我分析" | `suggest_record_update` 被调用，不产生写入 |
| 权限校验：无权限成员 | 工具返回权限拒绝信息 |
| 循环上限：LLM 死循环 | max_rounds 后强制终止 |

---

## 12. 迁移策略

### 12.1 阶段一：并行运行

- 在现有路由之外新增 `/api/v2/chat/{session_id}/messages` 端点，使用 PydanticAI agent
- 旧端点保留不变，前端通过配置切换
- 新旧端点共享同一个 `ChatSession` / `ChatMessage` 表

### 12.2 阶段二：功能对齐

- 所有旧端点的功能在新端点中验证通过
- 测试覆盖率达标

### 12.3 阶段三：切换

- 前端默认指向 v2 端点
- 移除旧的规则路由代码
- 旧 `providers/base.py`、`providers/openai_compatible.py` 归档或删除

---

## 13. 不在本次范围内

- MCP 对外协议层（Phase 5）
- 本地 VLM/ASR 运行时集成（沿用现有 `transcription/` 和 `extraction/` 边界）
- PostgreSQL 迁移
- 多 Agent 编排（当前单 Agent + 多工具足以覆盖所有场景）
