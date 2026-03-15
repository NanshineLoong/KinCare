# PydanticAI API 调研记录（2026-03-15）

## 目的

本记录对应 [HomeVital 新开发计划](../../.cursor/plans/homevital_新开发计划_a2e4e028.plan.md) 的 Step 2，用于核对 PydanticAI 最新公开 API 是否与 [AI 功能架构设计：基于 PydanticAI 的 Tool-Calling 循环](../proposals/ai-architecture-pydantic-ai.md) 中的实现设想一致，并记录需要修正的示例代码。

## 调研方式

- 官方文档核对：`ai.pydantic.dev`
- 本地最小验证：2026-03-15 使用 `uv run --with pydantic-ai` 拉取最新包并执行最小样例

## 本地验证基线

- 2026-03-15 本地临时安装解析到的 `pydantic-ai` 版本：`1.68.0`
- 说明：该版本号来自当日 `uv` 对 PyPI 的实时解析结果；后续实现前若版本继续演进，应重新核对本文涉及的 API

## 结论摘要

| 项目 | 结论 | 对 HomeVital 的影响 |
|------|------|---------------------|
| `agent.iter()` + node streaming | **确认可用**。本地验证的节点序列包含 `UserPromptNode`、`ModelRequestNode`、`CallToolsNode`、`End`；`Agent.is_model_request_node()` 与 `Agent.is_call_tools_node()` 方法存在 | Step 4 可以继续按提案使用节点级编排 |
| `PartDeltaEvent` / `FinalResultEvent` / `FunctionToolCallEvent` / `FunctionToolResultEvent` | **确认可用**。`CallToolsNode.stream(...)` 会产生 `FunctionToolCallEvent` / `FunctionToolResultEvent`；`run_stream_events()` 会顺序输出文本与工具事件 | Step 4 的 SSE 映射可以基于 `agent.iter()`，也可以评估是否直接用 `run_stream_events()` 简化路由层 |
| `requires_approval=True` + `DeferredToolRequests` / `DeferredToolResults` | **确认可用，但有一个硬约束**：只要 agent 注册了 `requires_approval=True` 的工具，`output_type` 必须包含 `DeferredToolRequests`，否则会抛出 `UserError` | 提案中的 `create_agent()` 示例必须修正 |
| `OpenAIChatModel` + `OpenAIProvider(base_url=...)` | **确认可用**。本地可直接实例化 `OpenAIProvider(base_url=..., api_key=...)` 并传给 `OpenAIChatModel` | 现有 OpenAI-compatible 供应商路线成立 |
| `RunContext[DepsType]` 依赖注入 | **确认可用**。官方文档明确支持在 system prompt、tool、validator 中读取 `ctx.deps` | `AIDeps` 设计方向成立 |
| `TestModel` / `FunctionModel` | **确认可用，但导入路径与提案示例不同**：`TestModel` 位于 `pydantic_ai.models.test`；`FunctionModel` 位于 `pydantic_ai.models.function` | 测试章节的 import 需要修正 |
| `agent.override()` | **提案示例不准确**。本地 introspection 显示 `Agent.override(...) -> Iterator[None]`，应作为上下文管理器使用，而不是返回一个新 agent | 测试章节的 override 示例必须修正 |
| FastAPI 集成 | **确认兼容**。官方 UI 文档提供 `UIAdapter.from_request(...).streaming_response(...)` 入口；本地包中 `UIAdapter.streaming_response()` 存在 | HomeVital 可继续使用 FastAPI 异步路由；若保留自定义 SSE 协议，不必采用官方 AI UI 层 |

## 逐项记录

### 1. `agent.iter()` 与节点级编排

本地最小样例验证：

```text
node_types= ['UserPromptNode', 'ModelRequestNode', 'CallToolsNode', 'ModelRequestNode', 'CallToolsNode', 'End']
```

说明：

- `agent.iter()` 的节点级循环与提案一致
- 一次 run 里可能出现多轮 `ModelRequestNode → CallToolsNode`
- `Agent.is_model_request_node()` 和 `Agent.is_call_tools_node()` 均存在

结论：提案中“用 `agent.iter()` 驱动 orchestrator”的核心方向成立。

### 2. 流式事件类型

本地最小样例验证：

```text
tool_event_types= ['FunctionToolCallEvent', 'FunctionToolResultEvent']
run_stream_events= ['PartStartEvent', 'PartEndEvent', 'FunctionToolCallEvent', 'FunctionToolResultEvent', 'PartStartEvent', 'FinalResultEvent', 'PartDeltaEvent', 'PartDeltaEvent', 'PartEndEvent', 'AgentRunResultEvent']
```

说明：

- 工具调用事件可在 `CallToolsNode.stream(...)` 中拿到
- `agent.run_stream_events()` 会把文本片段事件和工具事件按时间顺序统一吐出

结论：

- 提案里的 `agent.iter()` + `node.stream(...)` 方案没有 API 风险
- 如果 Step 4 最终发现只需要顺序事件流而不需要显式节点生命周期，`run_stream_events()` 会更轻

### 3. 审批流硬约束

本地最小样例验证：

- 当 `output_type=[str, DeferredToolRequests]` 时，`requires_approval=True` 工具会返回 `DeferredToolRequests`
- 当 `output_type=str` 时，注册同样的工具会直接抛出：

```text
UserError: To use tools that require approval, add `DeferredToolRequests` to the list of output types for this agent.
```

同时，本地验证到：

```text
DeferredToolRequests fields: dict_keys(['calls', 'approvals', 'metadata'])
DeferredToolResults fields: dict_keys(['calls', 'approvals', 'metadata'])
```

结论：审批流方案可行，但 agent 输出类型必须从纯 `str` 改为包含 `DeferredToolRequests` 的联合输出。

### 4. OpenAI-compatible provider

本地最小样例验证：

```text
OpenAIProvider
OpenAIChatModel
demo-model
```

结论：`OpenAIChatModel(..., provider=OpenAIProvider(base_url=..., api_key=...))` 用法成立，适合当前 HomeVital 的 provider 抽象迁移方向。

### 5. 测试模型与 override

本地最小样例验证：

```text
FunctionModel module: pydantic_ai.models.function
TestModel module: pydantic_ai.models.test
TestModel (*, call_tools: list[str] | Literal['all'] = 'all', ...)
FunctionModel (function=None, *, stream_function=None, ...)
```

以及：

```text
Agent.override(...) -> Iterator[None]
```

结论：

- `FunctionModel` 不应从 `pydantic_ai.models.test` 导入
- `agent.override()` 应按如下方式使用：

```python
with agent.override(model=TestModel()):
    result = await agent.run("hello", deps=deps)
```

### 6. FastAPI 集成判断

官方 UI 文档展示了 `UIAdapter.from_request(...).streaming_response(...)` 的 FastAPI/Starlette 集成方式；本地包也验证 `UIAdapter.streaming_response()` 方法存在。

对 HomeVital 的结论：

- Step 4 继续使用 FastAPI 异步路由没有问题
- 由于 HomeVital 已有自定义 SSE 协议（`tool.draft`、`tool.suggest` 等），不建议直接引入官方 AI UI 协议层
- 更合适的路线仍然是：FastAPI `StreamingResponse` + 自定义 async generator，底层使用 `agent.iter()` 或 `agent.run_stream_events()`

## 与提案的差异清单

1. `create_agent()` 的 `output_type=str` 不成立，需要改为包含 `DeferredToolRequests`
2. 测试示例中 `FunctionModel` 的导入路径错误
3. 测试示例中 `agent.override()` 的使用方式错误，应改为上下文管理器
4. 版本说明应更新到本次调研实际验证过的 `1.68.0`

## 结论

Step 2 没有发现阻塞 Step 4 的 API 级风险。PydanticAI 的以下能力都已被官方文档和本地最小样例共同确认：

- 节点级迭代与 tool-calling 循环
- 审批型 deferred tools
- 文本与工具混合流式事件
- `RunContext[DepsType]` 依赖注入
- OpenAI-compatible provider
- `TestModel` / `FunctionModel` 测试支持
- FastAPI 异步集成

需要同步修正的只是提案中的少量示例代码，而不是整体架构方向。

## 参考来源

- [PydanticAI Agent Docs](https://ai.pydantic.dev/agent)
- [PydanticAI Run API](https://ai.pydantic.dev/api/run)
- [PydanticAI Deferred Tools Docs](https://ai.pydantic.dev/deferred-tools)
- [PydanticAI Dependencies Docs](https://ai.pydantic.dev/dependencies)
- [PydanticAI OpenAI Models Docs](https://ai.pydantic.dev/models/openai)
- [PydanticAI FunctionModel Docs](https://ai.pydantic.dev/models/function)
- [PydanticAI AI UI Chat App / FastAPI Docs](https://ai.pydantic.dev/ui/chat-app/)
