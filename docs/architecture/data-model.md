# 健康事实层数据模型

> 注：本文档描述的是初始 FHIR 风格数据模型。MVP-v1 简化版决策见 [ADR-0009](../adr/0009-simplified-health-fact-layer.md) 与 [健康事实层简化设计：MVP-v1 精简版](../proposals/health-fact-layer-simplified.md)。

## 设计思路

HomeVital 的核心数据抽象是**健康事实层**：所有原始健康信息（手动录入、文档抽取、设备同步）在进入系统后，统一转换为标准化的"健康事实"存储。上层功能（看板展示、AI 对话、MCP 查询、提醒生成）全部基于此层工作。

数据模型采用 **FHIR 风格**——借鉴 FHIR R4 的资源类型和关系设计，但**不要求完全符合 FHIR 规范**。目标是获得 FHIR 的语义清晰度，同时保持实现简洁。

> 相关决策：[ADR-0001 采用 FHIR 风格数据模型](../adr/0001-fhir-style-data-model.md)

---

## 资源类型总览

```
FamilyMember (家庭成员)
  │
  ├── Observation (观测记录)      — 血压、血糖、体温、心率、体重...
  ├── Condition (健康状况)        — 诊断、慢病、过敏...
  ├── MedicationStatement (用药)  — 正在服用的药物
  ├── Encounter (就诊记录)        — 门诊、住院、体检
  ├── DocumentReference (文档)    — 上传的 PDF/图片及其抽取状态
  └── CarePlan (健康计划)         — AI 生成的提醒、建议、随访计划
```

---

## 资源定义

### FamilyMember（家庭成员）

家庭成员档案，对应 FHIR Patient。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| family_space_id | UUID | 所属家庭空间 |
| user_account_id | UUID? | 关联的用户账号（可空，无账号成员） |
| name | string | 姓名 |
| gender | enum | male / female / other / unknown |
| birth_date | date | 出生日期 |
| blood_type | string? | 血型 |
| allergies | string[]? | 过敏史 |
| medical_history | string[]? | 既往病史摘要 |
| avatar_url | string? | 头像 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

---

### Observation（观测记录）

对应 FHIR Observation。记录各类可量化的健康指标。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| member_id | UUID | FK → FamilyMember |
| category | enum | vital-signs / laboratory / activity / sleep / ... |
| code | string | 指标编码（如 `bp-systolic`, `blood-glucose`, `heart-rate`） |
| display_name | string | 指标显示名 |
| value | decimal? | 数值 |
| value_string | string? | 非数值型结果 |
| unit | string? | 单位（mmHg, mg/dL, bpm, ...） |
| effective_at | timestamp | 测量时间 |
| source | enum | manual / document-extract / device / ... |
| source_ref | UUID? | 来源文档的 DocumentReference.id |
| notes | string? | 备注 |
| created_at | timestamp | 创建时间 |

**常用指标编码（code）：**

| code | display_name | unit | category |
|------|-------------|------|----------|
| `bp-systolic` | 收缩压 | mmHg | vital-signs |
| `bp-diastolic` | 舒张压 | mmHg | vital-signs |
| `heart-rate` | 心率 | bpm | vital-signs |
| `body-temperature` | 体温 | °C | vital-signs |
| `body-weight` | 体重 | kg | vital-signs |
| `blood-glucose` | 血糖 | mmol/L | laboratory |
| `blood-oxygen` | 血氧 | % | vital-signs |
| `step-count` | 步数 | steps | activity |
| `sleep-duration` | 睡眠时长 | hours | sleep |

> 编码表可扩展。MVP 阶段使用自定义编码，后续可映射到 LOINC。

---

### Condition（健康状况）

对应 FHIR Condition。记录诊断、慢病、过敏等持续性健康状态。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| member_id | UUID | FK → FamilyMember |
| category | enum | diagnosis / chronic / allergy / symptom |
| code | string | 状况编码 |
| display_name | string | 状况名称（如 "高血压", "2型糖尿病"） |
| clinical_status | enum | active / recurrence / inactive / resolved |
| onset_date | date? | 发病/诊断日期 |
| abatement_date | date? | 缓解/治愈日期 |
| severity | enum? | mild / moderate / severe |
| source | enum | manual / document-extract |
| source_ref | UUID? | 来源文档 |
| notes | string? | 备注 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

---

### MedicationStatement（用药记录）

对应 FHIR MedicationStatement。记录正在或曾经使用的药物。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| member_id | UUID | FK → FamilyMember |
| medication_name | string | 药品名称 |
| dosage | string? | 用量描述（如 "每日一次，每次 1 片"） |
| status | enum | active / completed / stopped |
| start_date | date? | 开始日期 |
| end_date | date? | 结束日期 |
| reason | string? | 用药原因 |
| prescribed_by | string? | 处方来源 |
| source | enum | manual / document-extract |
| source_ref | UUID? | 来源文档 |
| notes | string? | 备注 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

---

### Encounter（就诊记录）

对应 FHIR Encounter。记录每次就诊、体检事件。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| member_id | UUID | FK → FamilyMember |
| type | enum | outpatient / inpatient / checkup / emergency |
| facility | string? | 医疗机构名称 |
| department | string? | 科室 |
| date | date | 就诊日期 |
| summary | string? | 就诊摘要 |
| source | enum | manual / document-extract |
| source_ref | UUID? | 来源文档 |
| created_at | timestamp | 创建时间 |

**关联关系：** 一次 Encounter 可关联多条 Observation、Condition、MedicationStatement（通过 `encounter_id` 可选字段关联）。

---

### DocumentReference（文档引用）

对应 FHIR DocumentReference。管理上传的原始文件及其抽取状态。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| member_id | UUID | FK → FamilyMember |
| uploaded_by | UUID | 上传者的用户账号 ID |
| doc_type | enum | checkup-report / lab-result / prescription / discharge-summary / other |
| file_path | string | 文件存储路径 |
| file_name | string | 原始文件名 |
| mime_type | string | 文件 MIME 类型 |
| extraction_status | enum | pending / processing / completed / failed |
| extracted_at | timestamp? | 抽取完成时间 |
| raw_extraction | JSON? | AI 抽取的原始结果（用于审核） |
| created_at | timestamp | 上传时间 |

**抽取流程：** 上传 → pending → AI 处理 → completed/failed → 用户确认 → 写入各资源表。

---

### CarePlan（健康计划）

对应 FHIR CarePlan。存储 AI 生成的提醒和建议。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| member_id | UUID | FK → FamilyMember |
| category | enum | medication-reminder / followup-reminder / health-advice / daily-tip |
| title | string | 标题 |
| description | string | 详细内容 |
| status | enum | active / completed / cancelled |
| scheduled_at | timestamp? | 计划执行时间 |
| completed_at | timestamp? | 完成时间 |
| generated_by | enum | ai / manual |
| created_at | timestamp | 创建时间 |

---

## 补充模型

### UserAccount（用户账号）

系统登录账号，与 FamilyMember 解耦。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| family_space_id | UUID | 所属家庭空间 |
| email | string | 登录邮箱 |
| password_hash | string | 密码哈希 |
| role | enum | admin / member |
| created_at | timestamp | 注册时间 |

### FamilySpace（家庭空间）

每个部署实例的顶层组织单元。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | string | 家庭名称 |
| created_at | timestamp | 创建时间 |

> 单实例部署下通常只有一条 FamilySpace 记录，但模型上不做硬性限制。

### ChatSession / ChatMessage（对话记录）

| 模型 | 核心字段 | 说明 |
|------|----------|------|
| ChatSession | id, user_id, family_space_id, member_id?, title?, page_context?, created_at, updated_at | 对话会话，按用户持久化，可绑定当前焦点成员和页面上下文 |
| ChatMessage | id, session_id, role(user/assistant/tool), content, event_type?, metadata?, created_at | 单条消息或工具事件，支撑 SSE 回复审计与后续会话扩展 |

### ScheduledTask（调度定义）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| family_space_id | UUID | 所属家庭空间 |
| member_id | UUID? | 作用目标成员，可空 |
| created_by | UUID | 创建任务的用户账号 |
| task_type | string | 任务类型 |
| prompt | string | 执行提示词/描述 |
| schedule_type | enum | once / daily / weekly |
| schedule_config | JSON | 调度参数（如时间、星期） |
| enabled | boolean | 是否启用 |
| next_run_at | timestamp? | 下次执行时间 |
| last_run_at | timestamp? | 最近执行时间 |
| last_error | string? | 最近一次执行错误 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

### MemberAccessGrant（成员级授权）

用于表达普通用户对其他家庭成员健康数据的显式访问授权。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| member_id | UUID | 被访问成员，FK → FamilyMember |
| user_account_id | UUID | 获权用户，FK → UserAccount |
| can_write | boolean | 是否允许写入；`false` 表示仅可读 |
| created_at | timestamp | 授权创建时间 |

> 当前实现中：管理员天然拥有所有成员的读写权限；普通用户默认仅可访问与自己绑定的成员档案，访问其他成员健康数据需要显式授权。

---

## ER 关系概览

```
FamilySpace
  └── 1:N → UserAccount
  └── 1:N → FamilyMember
  └── 1:N → ScheduledTask
                ├── 1:N → Observation
                ├── 1:N → Condition
                ├── 1:N → MedicationStatement
                ├── 1:N → Encounter
                ├── 1:N → DocumentReference
                └── 1:N → CarePlan

UserAccount ──── 0..1:1 → FamilyMember （可选绑定）
UserAccount ──── N:N → FamilyMember （通过 MemberAccessGrant 表达成员级授权）
UserAccount ──── 1:N → ChatSession ──── 1:N → ChatMessage
UserAccount ──── 1:N → ScheduledTask （created_by）
FamilyMember ──── 0..N → ScheduledTask
```

---

## 设计要点

1. **UserAccount 与 FamilyMember 解耦** — 允许存在无账号的成员（老人、儿童等被管理对象）
2. **所有健康资源都有 source 字段** — 标记数据来源（手动/文档抽取/设备），便于溯源和审计
3. **source_ref 关联 DocumentReference** — 从文档抽取的数据可追溯到原始文件
4. **code 字段使用自定义编码** — MVP 阶段足够，后续可映射到 LOINC/SNOMED CT
5. **extraction_status 管理抽取流程** — 支持异步处理和用户确认
6. **CarePlan 统一管理提醒** — 不区分提醒来源，统一作为"健康计划项"管理
7. **ChatSession / ChatMessage 记录对话与工具事件** — 支撑 AI 审计、回放与后续会话扩展
8. **ScheduledTask 独立于 CarePlan** — 调度定义与执行输出分离，`CarePlan` 继续承载提醒结果
