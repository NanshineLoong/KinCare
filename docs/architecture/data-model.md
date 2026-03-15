# HomeVital 健康数据模型

> 本文档定义当前开发主线的健康数据模型。ADR-0001 保留了“FHIR 风格资源化建模”的总体方向，但其 MVP 级字段、资源集合和枚举已被 [ADR-0009](../adr/0009-simplified-health-fact-layer.md) supersede。

## 设计目标

1. 让首页、成员档案和 AI 工具直接围绕同一组资源工作
2. 只保留当前 MVP 真正需要的资源和字段
3. 把时序指标、事件型记录、静态档案和 AI 摘要分开建模
4. 避免 `FamilyMember` 与健康事实层双写同一信息
5. 明确哪些旧资源和旧字段已经不再属于当前模型

## 资源总览

```text
FamilyMember
  ├── Observation
  ├── SleepRecord
  ├── WorkoutRecord
  ├── Condition
  ├── Medication
  ├── Encounter
  ├── HealthSummary
  └── CarePlan
```

## 核心资源

### FamilyMember

成员静态档案，只保留基础信息。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT | 主键 |
| family_space_id | TEXT | 所属家庭空间 |
| user_account_id | TEXT? | 可选绑定账号 |
| name | TEXT | 姓名 |
| gender | TEXT | `male / female / other / unknown` |
| birth_date | TEXT? | 出生日期 |
| height_cm | REAL? | 身高 |
| blood_type | TEXT? | 血型 |
| avatar_url | TEXT? | 头像 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

当前模型中，`allergies` 和 `medical_history` 不再属于 `FamilyMember`，统一由 `Condition` 承载。

### Observation

量化健康指标的时序记录。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT | 主键 |
| member_id | TEXT | FK → `FamilyMember` |
| category | TEXT | `chronic-vitals / lifestyle / body-vitals` |
| code | TEXT | 指标编码 |
| display_name | TEXT | 指标显示名 |
| value | REAL? | 数值型结果 |
| value_string | TEXT? | 文字型结果 |
| unit | TEXT? | 单位 |
| context | TEXT? | 测量语境，如空腹、餐后 |
| effective_at | TEXT | 测量时间 |
| source | TEXT | `device / manual` |
| device_name | TEXT? | 来源设备名称 |
| notes | TEXT? | 备注 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

#### Observation 分类

| category | 用途 |
|---|---|
| `chronic-vitals` | 慢病相关指标，如血压、血糖 |
| `lifestyle` | 生活习惯指标，如步数、活动消耗 |
| `body-vitals` | 生理指标，如心率、血氧、体重、压力 |

#### 常用指标编码

| code | display_name | unit | category |
|---|---|---|---|
| `bp-systolic` | 收缩压 | mmHg | `chronic-vitals` |
| `bp-diastolic` | 舒张压 | mmHg | `chronic-vitals` |
| `blood-glucose` | 血糖 | mmol/L | `chronic-vitals` |
| `step-count` | 步数 | steps | `lifestyle` |
| `energy-active` | 活动消耗 | kcal | `lifestyle` |
| `heart-rate` | 心率 | bpm | `body-vitals` |
| `blood-oxygen` | 血氧饱和度 | % | `body-vitals` |
| `body-weight` | 体重 | kg | `body-vitals` |
| `stress-level` | 压力 | score | `body-vitals` |

### SleepRecord

睡眠是事件型数据，不再塞进 `Observation`。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT | 主键 |
| member_id | TEXT | FK → `FamilyMember` |
| start_at | TEXT | 入睡时间 |
| end_at | TEXT | 起床时间 |
| total_minutes | INTEGER | 总睡眠时长 |
| deep_minutes | INTEGER? | 深睡时长 |
| rem_minutes | INTEGER? | REM 时长 |
| light_minutes | INTEGER? | 浅睡时长 |
| awake_minutes | INTEGER? | 醒着时长 |
| efficiency_score | REAL? | 睡眠效率 |
| is_nap | INTEGER | 是否午睡 |
| source | TEXT | `device / manual` |
| device_name | TEXT? | 设备名称 |
| created_at | TEXT | 创建时间 |

### WorkoutRecord

运动也是事件型数据。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT | 主键 |
| member_id | TEXT | FK → `FamilyMember` |
| type | TEXT | 运动类型 |
| start_at | TEXT | 开始时间 |
| end_at | TEXT | 结束时间 |
| duration_minutes | INTEGER | 运动时长 |
| energy_burned | REAL? | 消耗热量 |
| distance_meters | REAL? | 距离 |
| avg_heart_rate | INTEGER? | 平均心率 |
| source | TEXT | `device / manual` |
| device_name | TEXT? | 设备名称 |
| notes | TEXT? | 备注 |
| created_at | TEXT | 创建时间 |

### Condition

统一表达现病、既往病史、家族病史和过敏。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT | 主键 |
| member_id | TEXT | FK → `FamilyMember` |
| category | TEXT | `chronic / diagnosis / allergy / family-history` |
| display_name | TEXT | 状况名称 |
| clinical_status | TEXT | `active / inactive / resolved` |
| onset_date | TEXT? | 发病或确诊日期 |
| notes | TEXT? | 详情描述 |
| source | TEXT | `manual / ai-extract` |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### Medication

当前药品管理资源，取代旧的 `MedicationStatement`。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT | 主键 |
| member_id | TEXT | FK → `FamilyMember` |
| name | TEXT | 药品名称 |
| indication | TEXT? | 用途或适应症 |
| dosage_description | TEXT? | 用法用量 |
| status | TEXT | `active / stopped` |
| start_date | TEXT? | 开始日期 |
| end_date | TEXT? | 停止日期 |
| source | TEXT | `manual / ai-extract` |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### Encounter

就诊与体检事件。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT | 主键 |
| member_id | TEXT | FK → `FamilyMember` |
| type | TEXT | `outpatient / inpatient / checkup / emergency` |
| facility | TEXT? | 医疗机构 |
| department | TEXT? | 科室 |
| attending_physician | TEXT? | 接诊医生 |
| date | TEXT | 就诊日期 |
| summary | TEXT? | 诊断或结果摘要 |
| source | TEXT | `manual / ai-extract` |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### HealthSummary

首页成员卡片和概览区的 AI 摘要资源。每位成员通常保留 3 到 4 条记录。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT | 主键 |
| member_id | TEXT | FK → `FamilyMember` |
| category | TEXT | `chronic-vitals / lifestyle / body-vitals` 或 AI 自定义主题 |
| label | TEXT | 摘要主题 |
| value | TEXT | 简短评价 |
| status | TEXT | `good / warning / neutral` |
| generated_at | TEXT | AI 生成时间 |
| created_at | TEXT | 创建时间 |

### CarePlan

可操作的提醒和健康计划。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT | 主键 |
| member_id | TEXT | FK → `FamilyMember` |
| category | TEXT | `medication-reminder / activity-reminder / checkup-reminder / health-advice / daily-tip` |
| title | TEXT | 标题 |
| description | TEXT | 详细内容 |
| status | TEXT | `active / completed / cancelled` |
| scheduled_at | TEXT? | 计划时间 |
| completed_at | TEXT? | 完成时间 |
| generated_by | TEXT | `ai / manual` |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

## 支撑模型

### UserAccount / FamilySpace

- `FamilySpace`：家庭顶层组织单元
- `UserAccount`：系统登录账号，角色为 `admin / member`

### MemberAccessGrant

记录普通用户对其他成员健康数据的显式授权，维持成员级权限模型。

### ChatSession / ChatMessage

- `ChatSession`：会话级上下文、当前焦点成员、页面场景
- `ChatMessage`：用户消息、AI 回复、工具事件和草稿确认历史

### ScheduledTask

持久化 AI 定时任务定义，例如每日摘要刷新或用户创建的提醒任务。

## 当前明确不包含的旧资源和旧术语

- 不再使用 `DocumentReference`
- 不再使用 `MedicationStatement`
- 不再使用 `FamilyMember.allergies` / `FamilyMember.medical_history`
- 不再使用旧的 `Observation.category = vital-signs / laboratory / activity / sleep / other`
- 不再把独立文档上传资源建模为当前健康事实层的一部分
