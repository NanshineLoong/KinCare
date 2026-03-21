# AI 功能架构设计：基于 PydanticAI 的 Tool-Calling 循环

> 状态：已接受（见 [ADR-0010](../adr/0010-pydantic-ai-tool-calling.md)）
> 说明：本文已不再作为活跃开发的主真相源，保留它仅是为了给 Accepted ADR 提供稳定引用。当前开发请优先阅读 `docs/architecture/phase-4-ai-design.md`、`docs/architecture/overview.md` 和当前计划文件。

## Accepted Summary

- 应用内 AI 编排采用 PydanticAI tool-calling 循环
- 所有工具通过 `RunContext[AIDeps]` 获取运行时依赖
- 工具分为读取、低风险写入、高风险审批、主动建议四类
- 高风险健康档案写入必须通过 `DeferredToolRequests` 草稿确认
- 自定义 SSE 事件协议继续保留
- AI 仍然只能通过服务层和成员级权限模型读写数据

## Current Source of Truth

- [当前开发计划](../../.cursor/plans/kincare_v2_开发计划_a24f52a8.plan.md)
- [架构总览](../architecture/overview.md)
- [Phase 4 AI 技术设计](../architecture/phase-4-ai-design.md)
- [ADR-0010](../adr/0010-pydantic-ai-tool-calling.md)
