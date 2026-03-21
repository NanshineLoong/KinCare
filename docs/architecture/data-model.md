# KinCare 健康数据模型

> 本文档定义当前开发主线的健康数据模型。总体资源化方向继承自 ADR-0001，当前字段、权限和会话语义以 [ADR-0009](../adr/0009-simplified-health-fact-layer.md) 与 [ADR-0011](../adr/0011-three-level-member-permissions.md) 为准。

## 设计目标

1. 让家庭仪表盘、成员档案和 AI 工具围绕同一组资源工作
2. 明确区分静态档案、健康事实、AI 生成结果、权限授权和会话历史
3. 首页聚合视图与成员概览复用同一套摘要语义和提醒语义
4. 用显式的成员级权限模型约束读写与授权管理
5. 不为页面维护并行专用表，不恢复旧资源链路

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

Support Models
  ├── FamilySpace
  ├── UserAccount
  ├── MemberAccessGrant
  ├── ChatSession
  ├── ChatMessage
  └── ScheduledTask
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

`allergies` 与 `medical_history` 不再属于 `FamilyMember`，统一由 `Condition` 承载。

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

运动是独立事件型资源。

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

家庭仪表盘和成员概览区的 AI 摘要资源。每位成员每天可生成 0-N 条记录，不再固定为三类。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT | 主键 |
| member_id | TEXT | FK → `FamilyMember` |
| category | TEXT | AI 自定义主题，如睡眠、血压、情绪、依从性 |
| label | TEXT | 摘要标题 |
| value | TEXT | 简短评价或提示 |
| status | TEXT | `good / warning / alert` |
| generated_at | TEXT | AI 生成时间 |
| created_at | TEXT | 创建时间 |

`status` 是前端颜色语义的唯一真相源：`good` = 绿色、`warning` = 黄色、`alert` = 红色。

### CarePlan

可操作的提醒和健康计划，可被首页按时间段聚合展示。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT | 主键 |
| member_id | TEXT | FK → `FamilyMember`，所属成员上下文 |
| assignee_member_id | TEXT? | 实际执行成员；为空时默认等于 `member_id` |
| category | TEXT | 计划类别，如用药、运动、复查、饮食 |
| icon_key | TEXT? | 预定义图标键 |
| time_slot | TEXT? | 时间段，如 `清晨 / 上午 / 午后 / 晚间 / 睡前` |
| title | TEXT | 标题 |
| description | TEXT | 简要说明 |
| notes | TEXT? | 备注或补充提醒 |
| status | TEXT | `active / completed / cancelled` |
| scheduled_at | TEXT? | 计划时间 |
| completed_at | TEXT? | 完成时间 |
| generated_by | TEXT | `ai / manual` |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

#### `icon_key` 预定义值

- `medication`
- `exercise`
- `checkup`
- `meal`
- `rest`
- `social`
- `general`

#### `time_slot` 预定义值

- `清晨`
- `上午`
- `午后`
- `晚间`
- `睡前`

## 支撑模型

### UserAccount / FamilySpace

- `FamilySpace`：家庭顶层组织单元
- `UserAccount`：系统登录账号，角色为 `admin / member`

### MemberAccessGrant

成员级授权模型，定义普通用户对其他成员数据的显式能力。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT | 主键 |
| user_account_id | TEXT | 被授予权限的用户 |
| member_id | TEXT? | 目标成员；`target_scope = 'all'` 时为空 |
| permission_level | TEXT | `read / write / manage` |
| target_scope | TEXT | `specific / all` |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

规则：

- `manage > write > read`
- `write` 天然包含 `read`
- `manage` 天然包含 `write` 和 `read`
- `specific` 只作用于单成员
- `all` 作用于当前家庭空间内的全部成员

### ChatSession / ChatMessage

会话历史是独立的应用级模型。

#### ChatSession

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT | 主键 |
| user_account_id | TEXT | 会话归属用户 |
| family_space_id | TEXT | 所属家庭空间 |
| focus_member_id | TEXT? | 当前聚焦成员 |
| title | TEXT? | 可读标题 |
| summary | TEXT? | 历史列表摘要 |
| page_context | TEXT? | 触发页面上下文 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

`summary` 用于首页历史入口和会话恢复，不替代完整消息历史。

#### ChatMessage

- 保存用户消息、助手回复、工具事件和草稿确认历史
- 用于恢复会话上下文，不作为健康事实资源

### ScheduledTask

持久化 AI 定时任务定义，例如每日摘要刷新或用户创建的提醒任务。

## 当前明确不包含的旧资源和旧术语

- 不再使用 `DocumentReference`
- 不再使用 `MedicationStatement`
- 不再使用 `FamilyMember.allergies` / `FamilyMember.medical_history`
- 不再使用旧的 `Observation.category = vital-signs / laboratory / activity / sleep / other`
- 不再把独立文档上传资源建模为当前健康事实层的一部分
