# 健康事实层简化设计：MVP-v1 精简版

> 状态：已接受（见 [ADR-0009](../adr/0009-simplified-health-fact-layer.md)）
> 说明：本文已不再作为活跃开发的主真相源，保留它仅是为了给 Accepted ADR 提供稳定引用。当前开发请优先阅读 `docs/architecture/data-model.md`、`docs/architecture/overview.md` 和当前计划文件。

## Accepted Summary

- 当前 MVP 健康事实层围绕 `FamilyMember`、`Observation`、`SleepRecord`、`WorkoutRecord`、`Condition`、`Medication`、`Encounter`、`HealthSummary`、`CarePlan`
- `Observation.category` 采用 `chronic-vitals / lifestyle / body-vitals`
- `SleepRecord` 和 `WorkoutRecord` 作为事件型资源独立建模
- `FamilyMember` 不再保存 `allergies` 和 `medical_history`
- `MedicationStatement` 收敛为 `Medication`
- `DocumentReference` 不再属于当前 MVP 健康事实层

## Current Source of Truth

- [当前开发计划](../../.cursor/plans/kincare_v2_开发计划_a24f52a8.plan.md)
- [架构总览](../architecture/overview.md)
- [数据模型](../architecture/data-model.md)
- [ADR-0009](../adr/0009-simplified-health-fact-layer.md)
