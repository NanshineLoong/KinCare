# ADR-0009: MVP v1 采用简化版健康事实层

- **状态：** Accepted
- **日期：** 2026-03-15
- **关联提案：** [健康事实层简化设计：MVP-v1 精简版](../proposals/health-fact-layer-simplified.md)
- **Supersedes：** ADR-0001 中关于 MVP 资源定义、字段集合和分类枚举的具体实现

## 背景与问题

ADR-0001 确立了 KinCare 采用 FHIR 风格的健康事实层，但当前 MVP 实现仍保留了较多面向通用医疗档案的复杂度，例如 `DocumentReference`、`MedicationStatement`、冗余的成员病史字段，以及不直接贴合当前 UI 和 OpenWearables 接入的资源划分。

随着 MVP-v1 范围收敛，现有数据模型暴露出以下问题：

- 首页和成员页需要按 `慢病管理 / 生活习惯 / 生理指标` 直接查询和展示，当前 `Observation.category` 不匹配
- 睡眠和运动本质是带起止时间的事件，继续塞入 `Observation` 会导致查询和展示都变复杂
- `FamilyMember.allergies` 与 `FamilyMember.medical_history` 和 `Condition` 重复，存在双写与不一致风险
- `DocumentReference` 及其 `source_ref` 链路超出当前 MVP 核心路径，增加 schema、接口和 AI 编排复杂度
- 当前资源命名和字段设计与 UI 文案、日常使用场景不够贴合

问题：在保持 FHIR 风格总体方向不变的前提下，MVP-v1 应采用什么样的健康事实层结构，才能同时满足 UI、AI 与设备接入需求，并压缩实现复杂度？

## 考虑的方案

### 方案 A：保留现有 FHIR 风格实现，仅做局部打补丁

- 优点：迁移最小，当前代码可复用较多
- 缺点：会继续保留冗余字段、资源语义不清和 UI 映射复杂度，长期成本更高

### 方案 B：在 FHIR 风格边界内采用简化版健康事实层（选定）

- 优点：保留清晰资源边界，同时把资源集合、字段与枚举压缩到 MVP 真正需要的范围；与 UI 和 OpenWearables 映射更直接
- 缺点：需要一次性 schema 和服务层迁移；会影响现有 API 和测试

### 方案 C：放弃资源化建模，改为完全按页面定制的数据表

- 优点：短期贴页面快
- 缺点：破坏 ADR-0001 建立的语义边界，不利于 AI 工具调用、后续 MCP 与长期演进

## 决策

采用**方案 B：在 FHIR 风格边界内采用简化版健康事实层**。

本决策保留 ADR-0001 关于“使用 FHIR 风格资源划分”的总体方向，但以 MVP-v1 为范围，调整资源集合、字段和枚举定义：

- `Observation.category` 改为 `chronic-vitals / lifestyle / body-vitals`
- 新增 `SleepRecord` 与 `WorkoutRecord`，承载事件型健康数据
- 新增 `HealthSummary`，承载 AI 每日生成的首页成员摘要
- `MedicationStatement` 重命名并简化为 `Medication`
- `FamilyMember` 移除 `allergies`、`medical_history`，统一由 `Condition` 承载
- `Condition`、`Encounter`、`Medication`、`CarePlan` 的字段和枚举按 MVP 目标精简
- 移除 `DocumentReference` 及各资源上的 `source_ref` 依赖，不再把独立文档管理作为 MVP 健康事实层的一部分

## 决策细节

### 1. 继续保留资源化建模

KinCare 仍然按 `FamilyMember` 为核心聚合根，围绕其组织 Observation、Condition、Medication、Encounter、CarePlan 等资源，避免退化为页面专用表。

### 2. 事件型数据独立建模

睡眠和运动改为单独资源，而不是 `Observation` 的特例。这样更符合时段型数据本质，也让 UI、统计和 AI 读取更直接。

### 3. 成员静态档案与动态健康事实分离

`FamilyMember` 只保留稳定档案字段。过敏、慢病、既往病史等动态内容统一进入 `Condition`，避免一份信息在成员档案和健康事实层中双写。

### 4. MVP 移除独立文档资源

MVP-v1 不把独立的文档上传管理作为核心健康事实资源。AI 提取和录入链路以后续对话上下文和受控工具为主，而不是围绕 `DocumentReference` 建模。

### 5. 数据模型优先服务当前 UI 与 AI

分类、命名和字段选择优先满足：

- 首页与成员页的直接查询和展示
- AI 工具对成员健康上下文的按需读取
- OpenWearables 到资源层的一次性映射

## 后果

- **正面：** 数据模型与当前产品页面和 AI 交互路径更一致，前后端查询会明显简化
- **正面：** 睡眠、运动、首页摘要等核心场景拥有更贴切的资源边界
- **正面：** 减少冗余字段和跨资源引用，降低数据不一致风险
- **负面：** 这是一次破坏性 schema 迁移，需要同步调整服务层、API、测试和已有样例数据
- **负面：** MVP 将不再提供独立的文档资源管理能力，后续如需恢复，必须通过新 ADR 重新定义边界
- **风险：** 旧数据向新枚举和新表结构迁移时，需要明确映射策略，尤其是 `Observation.category`、成员病史字段和文档相关来源字段
