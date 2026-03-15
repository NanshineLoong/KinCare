# 健康事实层简化设计：MVP-v1 精简版

> 状态：专家建议草案（待审核）
> 日期：2026-03-13
> 关联文档：`docs/architecture/data-model.md`（当前实现）、`docs/proposals/ai-architecture-pydantic-ai.md`

---

## 1. 背景与目标

在 `docs/architecture/data-model.md` 定义的当前健康事实层之上，基于以下输入形成 MVP-v1 的精简方案：

1. **产品需求精简** — 聚焦家庭成员日常健康管理，主要数据来源为穿戴设备和用户手动录入的就医/用药记录
2. **与 UI 设计稿对齐** — 成员档案页和首页看板需要的四个模块（现简化为三个健康状态模块 + 首页健康摘要）
3. **与 OpenWearables API 兼容** — 穿戴设备数据通过 [OpenWearables](https://docs.openwearables.io/) 统一 API 接入，需确保数据模型能正确映射其输出
4. **移除不必要的复杂性** — 去掉 MVP 用不到的资源（DocumentReference、MedicationLog）和指标（HRV、呼吸频率、体温、饮水量等）

---

## 2. 设计原则

1. **三模块对齐 UI** — Observation.category 三枚举直接对应首页健康状态模块，前端不做二次映射
2. **事件型数据独立建模** — 睡眠和运动是带起止时间的事件，用独立资源而非 Observation 时间点
3. **静态档案与动态数据分离** — FamilyMember 只存基础不变信息，时序数据走各自资源
4. **过敏和病史单一真源** — 全部通过 Condition 管理，移除 FamilyMember 上的冗余字段
5. **AI 每日生成首页摘要** — 新增 HealthSummary 资源，由 AI 基于全量健康数据每日刷新

---

## 3. 资源总览

```
FamilyMember（成员档案）
  │
  ├── Observation（健康指标时序数据）  ← 设备同步 / 手动录入
  │     category: chronic-vitals / lifestyle / body-vitals
  │
  ├── SleepRecord（睡眠记录）         ← 设备同步 / 手动录入      【新增资源】
  │
  ├── WorkoutRecord（运动记录）       ← 设备同步 / 手动录入      【新增资源】
  │
  ├── Condition（健康档案）           ← 手动录入 / AI 对话抽取
  │     category: chronic / diagnosis / allergy / family-history
  │
  ├── Medication（药品管理）          ← 手动录入 / AI 对话抽取
  │
  ├── Encounter（就诊记录）           ← 手动录入 / AI 对话抽取
  │
  ├── HealthSummary（健康摘要）       ← AI 每日生成             【新增资源】
  │
  └── CarePlan（提醒 & 健康计划）     ← AI 每日生成 / 用户创建
```

**与当前实现相比移除的资源：**
- `DocumentReference`（文档引用）— MVP 不需要独立的文档上传管理，用户通过 AI 对话直接提供信息

---

## 4. 资源详细定义

### 4.1 FamilyMember（成员档案）

| 字段 | 类型 | 说明 | vs 当前实现 |
|------|------|------|------------|
| id | TEXT PK | 主键 | 不变 |
| family_space_id | TEXT FK | 所属家庭空间 | 不变 |
| user_account_id | TEXT? FK | 关联账号（老人/儿童可为空） | 不变 |
| name | TEXT | 姓名 | 不变 |
| gender | TEXT | `male / female / other / unknown` | 不变 |
| birth_date | TEXT? | 出生日期（前端计算年龄） | 不变 |
| height_cm | REAL? | 身高 cm | **新增** |
| blood_type | TEXT? | 血型 | 不变 |
| avatar_url | TEXT? | 头像 URL | 不变 |
| created_at | TEXT | 创建时间 | 不变 |
| updated_at | TEXT | 更新时间 | 不变 |

**移除字段：**
- `allergies TEXT DEFAULT '[]'` — 过敏统一通过 `Condition(category='allergy')` 管理
- `medical_history TEXT DEFAULT '[]'` — 病史统一通过 `Condition(category='chronic'|'diagnosis')` 管理

**移除理由：** 当前 `allergies` 只是简单字符串数组，无法存储过敏反应详情。UI 需要展示详细描述（如"曾经出现严重的皮疹"），只有 Condition 的 `notes` 能承载。两处存储导致数据不同步风险。

---

### 4.2 Observation（健康指标时序数据）

| 字段 | 类型 | 说明 | vs 当前实现 |
|------|------|------|------------|
| id | TEXT PK | 主键 | 不变 |
| member_id | TEXT FK | FK → FamilyMember | 不变 |
| category | TEXT | `chronic-vitals / lifestyle / body-vitals` | **枚举值重新定义** |
| code | TEXT | 指标编码（见 4.2.2） | 不变 |
| display_name | TEXT | 指标显示名 | 不变 |
| value | REAL? | 数值型结果 | 不变 |
| value_string | TEXT? | 文字型结果 | 不变 |
| unit | TEXT? | 单位 | 不变 |
| context | TEXT? | 测量语境（如 `fasting / postmeal-2h / random`） | **新增** |
| effective_at | TEXT | 测量时间 | 不变 |
| source | TEXT | `device / manual` | **简化**（移除 `document-extract`） |
| device_name | TEXT? | 来源设备名称（如"Apple Watch"） | **新增** |
| notes | TEXT? | 备注 | 不变 |
| created_at | TEXT | 创建时间 | 不变 |
| updated_at | TEXT | 更新时间 | 不变 |

**移除字段：**
- `source_ref` — 不再需要关联 DocumentReference
- `encounter_id` — 简化实现，不做跨资源关联

#### 4.2.1 Category 三分类与 UI 模块对应

| category 值 | UI 模块名 | 语义范围 |
|---|---|---|
| `chronic-vitals` | 慢病管理 | 与慢病监测直接相关的核心指标：血压、血糖 |
| `lifestyle` | 生活习惯 | 日常行为和活动量：步数、活动消耗 |
| `body-vitals` | 生理指标 | 基础生命体征，设备连续监测：心率、血氧、体重、压力 |

> **与当前实现的差异：** 当前 category 为 `vital-signs / laboratory / activity / sleep / other`，按数据性质分类。新设计按用户视角分类，前端查询某个模块时直接 `WHERE category = 'chronic-vitals'` 即可。`sleep` 从 Observation 移出为独立的 SleepRecord 资源。

#### 4.2.2 指标编码表（MVP-v1）

| code | display_name | unit | category | 典型来源 | OW 对应 type |
|------|-------------|------|----------|---------|-------------|
| `bp-systolic` | 收缩压 | mmHg | chronic-vitals | 设备/手动 | `blood_pressure_systolic` |
| `bp-diastolic` | 舒张压 | mmHg | chronic-vitals | 设备/手动 | `blood_pressure_diastolic` |
| `blood-glucose` | 血糖 | mmol/L | chronic-vitals | 设备/手动 | `blood_glucose`（需 mg/dL→mmol/L 换算） |
| `step-count` | 步数 | steps | lifestyle | 设备 | `steps` |
| `energy-active` | 活动消耗 | kcal | lifestyle | 设备 | `energy` |
| `heart-rate` | 心率 | bpm | body-vitals | 设备/手动 | `heart_rate` |
| `blood-oxygen` | 血氧饱和度 | % | body-vitals | 设备 | `oxygen_saturation` |
| `body-weight` | 体重 | kg | body-vitals | 设备/手动 | `weight` |
| `stress-level` | 压力 | score(1-100) | body-vitals | 设备 | `garmin_stress_level` |

> **关于 `blood-glucose` 的 `context` 字段：** 穿戴设备（CGM）同步的血糖数据只有时间点读数，`context` 为空；手动录入时用户可标注 `fasting`（空腹）、`postmeal-2h`（餐后2小时）、`random`（随机）。
>
> **关于 `stress-level` 的设备覆盖：** 目前仅 Garmin 设备原生支持压力评分。Apple Watch 不直接输出此指标。前端对设备未覆盖导致的空数据做"暂无数据"友好展示即可。
>
> **移除的指标：** `body-temperature`（体温）、`respiratory-rate`（呼吸频率）、`heart-rate-variability`（HRV）、`heart-rate-resting`（静息心率）、`water-intake`（饮水量）、`hba1c`（糖化血红蛋白）、`mood-score`（情绪评分）、`mood-note`（心境记录）— 均不在 MVP 产品需求中。

---

### 4.3 SleepRecord（睡眠记录）【新增资源】

一次睡眠是一个带起止时间的事件，包含多维度属性，不适合拆成多条 Observation。此结构与 OpenWearables 的 `EventRecord(type=sleep) + SleepDetails` 直接对应。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 主键 |
| member_id | TEXT FK | FK → FamilyMember |
| start_at | TEXT | 入睡时间 |
| end_at | TEXT | 起床时间 |
| total_minutes | INTEGER | 总睡眠时长（分钟） |
| deep_minutes | INTEGER? | 深度睡眠（分钟） |
| rem_minutes | INTEGER? | REM 睡眠（分钟） |
| light_minutes | INTEGER? | 浅睡（分钟） |
| awake_minutes | INTEGER? | 睡中觉醒（分钟） |
| efficiency_score | REAL? | 睡眠效率（%） |
| is_nap | INTEGER | 是否午睡（0/1），默认 0 |
| source | TEXT | `device / manual` |
| device_name | TEXT? | 设备名称 |
| created_at | TEXT | |

#### OpenWearables 映射

```
OW EventRecord(type=sleep) + SleepDetails → SleepRecord：
  EventRecord.start_datetime            → start_at
  EventRecord.end_datetime              → end_at
  SleepDetails.sleep_total_duration_minutes → total_minutes
  SleepDetails.sleep_deep_minutes       → deep_minutes
  SleepDetails.sleep_rem_minutes        → rem_minutes
  SleepDetails.sleep_light_minutes      → light_minutes
  SleepDetails.sleep_awake_minutes      → awake_minutes
  SleepDetails.sleep_efficiency_score   → efficiency_score
  SleepDetails.is_nap                   → is_nap
```

---

### 4.4 WorkoutRecord（运动记录）【新增资源】

与 SleepRecord 类似，运动也是带起止时间的事件。与 OpenWearables 的 `EventRecord(type=workout) + WorkoutDetails` 对应。MVP 只保留核心聚合字段。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 主键 |
| member_id | TEXT FK | FK → FamilyMember |
| type | TEXT | 运动类型：`running / walking / cycling / swimming / yoga / strength_training / hiking / other` |
| start_at | TEXT | 开始时间 |
| end_at | TEXT | 结束时间 |
| duration_minutes | INTEGER | 时长（分钟） |
| energy_burned | REAL? | 消耗热量（kcal） |
| distance_meters | REAL? | 距离（米） |
| avg_heart_rate | INTEGER? | 平均心率（bpm） |
| source | TEXT | `device / manual` |
| device_name | TEXT? | 设备名称 |
| notes | TEXT? | 备注 |
| created_at | TEXT | |

#### OpenWearables 映射

```
OW EventRecord(type=workout) + WorkoutDetails → WorkoutRecord：
  EventRecord.type                      → type（需做 type 标准化映射）
  EventRecord.start_datetime            → start_at
  EventRecord.end_datetime              → end_at
  EventRecord.duration_seconds / 60     → duration_minutes
  WorkoutDetails.energy_burned          → energy_burned
  WorkoutDetails.distance               → distance_meters
  WorkoutDetails.heart_rate_avg         → avg_heart_rate
```

OW 支持的运动类型（80+种）远多于 MVP 所需，接入层做标准化映射，不在列表中的统一归为 `other`。

---

### 4.5 Condition（健康档案）

统一管理现病、既往病史、家族病史和过敏禁忌，不再在 FamilyMember 上冗余存储。

| 字段 | 类型 | 说明 | vs 当前实现 |
|------|------|------|------------|
| id | TEXT PK | 主键 | 不变 |
| member_id | TEXT FK | FK → FamilyMember | 不变 |
| category | TEXT | `chronic / diagnosis / allergy / family-history` | **新增 `family-history`，移除 `symptom`** |
| display_name | TEXT | 状况名称（如"原发性高血压 II 期"、"青霉素类抗生素过敏"） | 不变 |
| clinical_status | TEXT | `active / inactive / resolved` | **简化**（移除 `recurrence`） |
| onset_date | TEXT? | 发病/确诊日期 | 不变 |
| notes | TEXT? | 详细描述（过敏时填反应描述；家族病史时填说明，如"父亲有高血压"） | 不变 |
| source | TEXT | `manual / ai-extract` | **修改**（`document-extract`→`ai-extract`，`device` 移除） |
| created_at | TEXT | | 不变 |
| updated_at | TEXT | | 不变 |

**移除字段：**
- `code` — MVP 按 `display_name` 管理，后续可映射 ICD-10
- `severity` — 可在 `notes` 中描述
- `abatement_date` — 用 `clinical_status='resolved'` 代替
- `source_ref` — 不再关联 DocumentReference
- `encounter_id` — 简化实现

**category 语义说明：**

| category | 含义 | 在 UI 中的位置 | 查询方式 |
|---|---|---|---|
| `chronic` | 现病（当前活跃的慢性病） | 健康档案 → 现病 | `category='chronic' AND clinical_status='active'` |
| `diagnosis` | 既往病史（已缓解/治愈的历史诊断） | 健康档案 → 既往病史 | `category='diagnosis'` 或 `clinical_status IN ('inactive','resolved')` |
| `allergy` | 过敏与禁忌 | 健康档案 → 过敏与禁忌 | `category='allergy'` |
| `family-history` | 家族病史 | 健康档案 → 家族病史 | `category='family-history'` |

> **关于"现病"vs"既往病史"的区分：** 实际场景中，一个 `chronic` 类条目如果 `clinical_status` 变为 `resolved`，它就从"现病"列表移动到"既往病史"列表。category 表示最初的性质，clinical_status 表示当前状态。前端用两个查询维度组合展示。

---

### 4.6 Medication（药品管理）

从当前的 `MedicationStatement` 简化重命名。

| 字段 | 类型 | 说明 | vs 当前实现 |
|------|------|------|------------|
| id | TEXT PK | 主键 | 不变 |
| member_id | TEXT FK | FK → FamilyMember | 不变 |
| name | TEXT | 药品名称（含规格，如"厄贝沙坦片 0.15g"） | 重命名 `medication_name` → `name` |
| indication | TEXT? | 功能/适应症（如"降压"） | 重命名 `reason` → `indication` |
| dosage_description | TEXT? | 服用频率和用法（如"每日1次，早餐后服用"） | 重命名 `dosage` → `dosage_description` |
| status | TEXT | `active / stopped` | **简化**（移除 `completed`） |
| start_date | TEXT? | 开始服用日期 | 不变 |
| end_date | TEXT? | 停止日期 | 不变 |
| source | TEXT | `manual / ai-extract` | **修改** |
| created_at | TEXT | | 不变 |
| updated_at | TEXT | | 不变 |

**移除字段：**
- `prescribed_by` — MVP 不需要
- `source_ref` — 不再关联 DocumentReference
- `encounter_id` — 简化实现
- `notes` — MVP 简化，必要信息可放 `dosage_description`

**UI 展示逻辑：**
- "正在服用的药品" → `WHERE status = 'active'`
- "未服用的药品" → `WHERE status = 'stopped'`

---

### 4.7 Encounter（就诊记录）

| 字段 | 类型 | 说明 | vs 当前实现 |
|------|------|------|------------|
| id | TEXT PK | 主键 | 不变 |
| member_id | TEXT FK | FK → FamilyMember | 不变 |
| type | TEXT | `outpatient / inpatient / checkup / emergency` | 不变 |
| facility | TEXT? | 医疗机构名称 | 不变 |
| department | TEXT? | 科室 | 不变 |
| attending_physician | TEXT? | 接诊医生（如"李建国 副主任医师"） | **新增** |
| date | TEXT | 就诊日期 | 不变 |
| summary | TEXT? | 诊断记录或结果 | 不变 |
| source | TEXT | `manual / ai-extract` | **修改** |
| created_at | TEXT | | 不变 |
| updated_at | TEXT | | 不变 |

**移除字段：**
- `source_ref` — 不再关联 DocumentReference
- `encounter_id` 在其他表中的关联 — 简化实现

---

### 4.8 HealthSummary（健康摘要）【新增资源】

首页侧边栏每位成员下方展示的概要状态卡片。每位成员最多 4 条摘要，由 AI 每日基于该成员全量健康数据刷新。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 主键 |
| member_id | TEXT FK | FK → FamilyMember |
| category | TEXT | 对应 UI 模块：`chronic-vitals / lifestyle / body-vitals`（与 Observation.category 一致）|
| label | TEXT | 简短主题（如"运动习惯"、"慢病管理"、"血压控制"） |
| value | TEXT | 简短标签式评价（如"跑步变少"、"稳步好转"、"指标正常"） |
| status | TEXT | 状态颜色提示：`good / warning / neutral` |
| generated_at | TEXT | AI 生成时间 |
| created_at | TEXT | |

**UI 展示：** 首页侧边栏成员卡片中的 grid 格子。最多 4 条（3 个健康状态模块各一条 + 可选第 4 条由 AI 自由选择主题）。

```
┌─────────────────┬─────────────────┐
│ 慢病管理         │ 生活习惯         │
│ 稳步好转 (good)  │ 运动偏少 (warn)  │
├─────────────────┼─────────────────┤
│ 生理指标         │ 血压控制         │
│ 期待新记录       │ 接近目标 (good)  │
└─────────────────┴─────────────────┘
```

**AI 刷新机制：** 每日由定时任务触发（复用 ScheduledTask + APScheduler），AI 读取成员的 Observation、SleepRecord、WorkoutRecord、Condition、Medication 等数据，生成或更新该成员的 HealthSummary 记录。每次刷新覆盖该成员的全部 HealthSummary 条目（DELETE + INSERT）。

---

### 4.9 CarePlan（提醒 & 健康计划）

| 字段 | 类型 | 说明 | vs 当前实现 |
|------|------|------|------------|
| id | TEXT PK | 主键 | 不变 |
| member_id | TEXT FK | FK → FamilyMember | 不变 |
| category | TEXT | `medication-reminder / activity-reminder / checkup-reminder / health-advice / daily-tip` | **新增 `activity-reminder`、`checkup-reminder`** |
| title | TEXT | 标题 | 不变 |
| description | TEXT | 详情 | 不变 |
| status | TEXT | `active / completed / cancelled` | 不变 |
| scheduled_at | TEXT? | 计划时间 | 不变 |
| completed_at | TEXT? | 完成时间 | 不变 |
| generated_by | TEXT | `ai / manual` | 不变 |
| created_at | TEXT | | 不变 |
| updated_at | TEXT | | 不变 |

**AI 每日刷新机制：** 与 HealthSummary 类似，AI 每日基于成员健康数据和用药方案自动生成当日提醒项。与 HealthSummary 的区别：CarePlan 是可操作的待办（可完成/取消），HealthSummary 是纯展示的状态描述。

---

## 5. 不再包含的资源

### 5.1 移除 DocumentReference

当前实现有 `document_reference` 表和完整的文档上传→抽取→确认流程。MVP 简化版不再需要此资源，用户通过 AI 对话直接描述或通过图片在对话中传递信息，AI 从对话内容中抽取结构化数据。

**受影响代码：**
- `backend/app/services/health_repository.py` — `RESOURCE_CONFIGS` 中的 `"documents"` 条目可移除
- `backend/app/ai/extraction.py` — 功能需要改造为从对话内容抽取，而非从文件抽取
- `backend/app/core/database.py` — `document_reference` 建表语句可移除
- 其他资源表上的 `source_ref` 字段 — 不再需要

### 5.2 不新增 MedicationLog

上一版提案中的服药打卡记录不在 MVP 范围内。药品管理仅区分"正在服用"和"未服用"两种状态。

---

## 6. OpenWearables 接入映射

### 6.1 时序数据映射表

| OpenWearables 数据 | HomeVital 目标 | 转换逻辑 |
|---|---|---|
| `DataPointSeries(type=heart_rate)` | `Observation(code='heart-rate', category='body-vitals')` | 直接映射 |
| `DataPointSeries(type=oxygen_saturation)` | `Observation(code='blood-oxygen', category='body-vitals')` | 直接映射 |
| `DataPointSeries(type=weight)` | `Observation(code='body-weight', category='body-vitals')` | 直接映射 |
| `DataPointSeries(type=garmin_stress_level)` | `Observation(code='stress-level', category='body-vitals')` | 直接映射，仅 Garmin 设备 |
| `DataPointSeries(type=blood_pressure_systolic)` | `Observation(code='bp-systolic', category='chronic-vitals')` | 直接映射 |
| `DataPointSeries(type=blood_pressure_diastolic)` | `Observation(code='bp-diastolic', category='chronic-vitals')` | 直接映射 |
| `DataPointSeries(type=blood_glucose)` | `Observation(code='blood-glucose', category='chronic-vitals')` | **单位转换：mg/dL ÷ 18.0182 → mmol/L** |
| `DataPointSeries(type=steps)` | `Observation(code='step-count', category='lifestyle')` | 直接映射 |
| `DataPointSeries(type=energy)` | `Observation(code='energy-active', category='lifestyle')` | 直接映射 |
| `EventRecord(type=sleep) + SleepDetails` | `SleepRecord` | 见 4.3 映射表 |
| `EventRecord(type=workout) + WorkoutDetails` | `WorkoutRecord` | 见 4.4 映射表 |
| `ExternalDeviceMapping.provider_name` | `*.device_name` | 拼接为可读名称 |

### 6.2 血糖单位转换

OpenWearables 的 `blood_glucose` 单位为 **mg/dL**（国际设备标准），HomeVital 内部统一使用 **mmol/L**（中国临床标准）。

转换公式：`value_mmol = value_mg_dL / 18.0182`

转换在接入层一次性完成，存入 Observation 后 `unit` 恒为 `mmol/L`。

### 6.3 接入层位置

建议在 `backend/app/services/` 下新增 `openwearables_sync.py`，负责：

1. 调用 OW API 获取最新数据
2. 按映射表转换为 HomeVital 资源
3. 去重（按 `member_id + code + effective_at` 或 `member_id + start_at` 判断已存在）
4. 写入数据库

---

## 7. ER 关系概览（修订后）

```
FamilySpace
  └── 1:N → UserAccount
  └── 1:N → FamilyMember
  └── 1:N → ScheduledTask

FamilyMember
  ├── 1:N → Observation
  ├── 1:N → SleepRecord              【新增】
  ├── 1:N → WorkoutRecord            【新增】
  ├── 1:N → Condition
  ├── 1:N → Medication                【重命名自 MedicationStatement】
  ├── 1:N → Encounter
  ├── 1:N → HealthSummary            【新增】
  └── 1:N → CarePlan

UserAccount ─── 0..1:1 → FamilyMember（可选绑定）
UserAccount ─── N:N → FamilyMember（通过 MemberAccessGrant）
UserAccount ─── 1:N → ChatSession ─── 1:N → ChatMessage
UserAccount ─── 1:N → ScheduledTask
```

**保持不变的支撑模型：** FamilySpace、UserAccount、MemberAccessGrant、ChatSession、ChatMessage、ScheduledTask — 这些模型在本次修订中不做变更。

---

## 8. 与当前实现的完整变更对照

### 8.1 表结构变更汇总

| 操作 | 表名 | 具体变更 |
|------|------|---------|
| **ALTER** | `family_member` | 新增 `height_cm REAL`；移除 `allergies`、`medical_history` |
| **ALTER** | `observation` | 新增 `context TEXT`、`device_name TEXT`；修改 `category` CHECK 约束为 `('chronic-vitals','lifestyle','body-vitals')`；修改 `source` CHECK 约束为 `('device','manual')`；移除 `source_ref`、`encounter_id` |
| **CREATE** | `sleep_record` | 新建表（见 4.3） |
| **CREATE** | `workout_record` | 新建表（见 4.4） |
| **ALTER** | `condition` | 修改 `category` CHECK 为 `('chronic','diagnosis','allergy','family-history')`；修改 `clinical_status` CHECK 为 `('active','inactive','resolved')`；修改 `source` CHECK 为 `('manual','ai-extract')`；移除 `code`、`severity`、`abatement_date`、`source_ref`、`encounter_id` |
| **RENAME+ALTER** | `medication_statement` → `medication` | 重命名表；`medication_name` → `name`；`reason` → `indication`；`dosage` → `dosage_description`；修改 `status` CHECK 为 `('active','stopped')`；修改 `source` CHECK 为 `('manual','ai-extract')`；移除 `prescribed_by`、`source_ref`、`encounter_id`、`notes` |
| **ALTER** | `encounter` | 新增 `attending_physician TEXT`；修改 `source` CHECK 为 `('manual','ai-extract')`；移除 `source_ref` |
| **DROP** | `document_reference` | 删除表及索引 |
| **CREATE** | `health_summary` | 新建表（见 4.8） |
| **ALTER** | `care_plan` | 修改 `category` CHECK 为 `('medication-reminder','activity-reminder','checkup-reminder','health-advice','daily-tip')` |

### 8.2 新建表完整 DDL

```sql
CREATE TABLE IF NOT EXISTS sleep_record (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    total_minutes INTEGER NOT NULL,
    deep_minutes INTEGER,
    rem_minutes INTEGER,
    light_minutes INTEGER,
    awake_minutes INTEGER,
    efficiency_score REAL,
    is_nap INTEGER NOT NULL DEFAULT 0 CHECK (is_nap IN (0, 1)),
    source TEXT NOT NULL CHECK (source IN ('device', 'manual')),
    device_name TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sleep_record_member_id_start_at
ON sleep_record(member_id, start_at DESC);

CREATE TABLE IF NOT EXISTS workout_record (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    energy_burned REAL,
    distance_meters REAL,
    avg_heart_rate INTEGER,
    source TEXT NOT NULL CHECK (source IN ('device', 'manual')),
    device_name TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workout_record_member_id_start_at
ON workout_record(member_id, start_at DESC);

CREATE TABLE IF NOT EXISTS health_summary (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('good', 'warning', 'neutral')),
    generated_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_health_summary_member_id
ON health_summary(member_id);
```

### 8.3 数据迁移

| 操作 | 说明 |
|------|------|
| `family_member.allergies` → `condition` | 解析 JSON 数组，逐条插入 `Condition(category='allergy', display_name=<item>, clinical_status='active', source='manual')` |
| `family_member.medical_history` → `condition` | 解析 JSON 数组，逐条插入 `Condition(category='chronic', display_name=<item>, clinical_status='active', source='manual')` |
| `observation.category` 值映射 | `'vital-signs'` → 按 code 分配到 `'chronic-vitals'`（bp-*, blood-glucose）或 `'body-vitals'`（heart-rate, blood-oxygen, body-weight）；`'laboratory'` → `'chronic-vitals'`；`'activity'` → `'lifestyle'`；`'sleep'` → 删除或迁移到 SleepRecord；`'other'` → `'body-vitals'` |
| `observation(code='sleep-duration')` | 迁移到 `SleepRecord(total_minutes=value*60)`，其余字段按默认填充 |
| `medication_statement` | 整表重命名为 `medication`，字段重命名同步执行 |
| `document_reference` | 备份后删除表 |

---

## 9. 受影响的后端代码清单

### 9.1 `backend/app/core/database.py`

`SCHEMA_SQL` 需要完整重写，对应本文档中所有表结构变更。这是最核心的改动入口。

### 9.2 `backend/app/services/health_repository.py`

`RESOURCE_CONFIGS` 字典需要同步更新：

```python
# 当前
RESOURCE_CONFIGS = {
    "observations": ResourceConfig(table="observation", order_field="effective_at"),
    "conditions": ResourceConfig(table="condition", order_field="created_at"),
    "medications": ResourceConfig(table="medication_statement", order_field="created_at"),
    "encounters": ResourceConfig(table="encounter", order_field="date"),
    "documents": ResourceConfig(table="document_reference", order_field="created_at", json_fields=("raw_extraction",)),
    "care-plans": ResourceConfig(table="care_plan", order_field="scheduled_at"),
}

# 修改为
RESOURCE_CONFIGS = {
    "observations": ResourceConfig(table="observation", order_field="effective_at"),
    "conditions": ResourceConfig(table="condition", order_field="created_at"),
    "medications": ResourceConfig(table="medication", order_field="created_at"),         # 表名变更
    "encounters": ResourceConfig(table="encounter", order_field="date"),
    "care-plans": ResourceConfig(table="care_plan", order_field="scheduled_at"),
    "sleep-records": ResourceConfig(table="sleep_record", order_field="start_at"),       # 新增
    "workout-records": ResourceConfig(table="workout_record", order_field="start_at"),   # 新增
    "health-summaries": ResourceConfig(table="health_summary", order_field="generated_at"),  # 新增
}
# 移除 "documents" 条目
```

### 9.3 `backend/app/ai/tools/__init__.py`

所有工具函数中引用的资源类型和字段名需要同步更新。详见 `docs/proposals/ai-architecture-pydantic-ai.md` 中工具集设计。新增资源需要对应新的 AI 工具：

- `get_sleep_records` — 读取睡眠记录
- `get_workout_records` — 读取运动记录
- `get_health_summaries` — 读取成员健康摘要
- `refresh_health_summaries` — 触发 AI 重新生成摘要（定时任务使用）

### 9.4 `backend/app/ai/extraction.py`

`apply_draft_to_member` 中引用的 `"medications"` 资源键、字段名需要更新。`DocumentExtractionDraft` schema 中与 DocumentReference 相关的引用需要清理。

### 9.5 `backend/app/services/health_records.py`

路由层面涉及文档上传、抽取确认等端点需要清理或改造。

### 9.6 前端影响

- 成员档案页的数据获取需要适配新 API（resource key 和字段名变更）
- 首页侧边栏成员卡片从查询 Observation 改为查询 HealthSummary
- 新增睡眠和运动数据的展示组件

---

## 10. AI 工具集与数据模型的对应关系

本节列出 `docs/proposals/ai-architecture-pydantic-ai.md` 中定义的 AI 工具需要如何适配简化后的数据模型。

### 10.1 读取工具更新

| 工具 | 查询的资源 | 变更说明 |
|------|-----------|---------|
| `get_member_summary` | FamilyMember | 移除 allergies/medical_history 返回，改为提示调用 get_conditions |
| `get_recent_observations` | Observation | category 筛选值改为新三枚举 |
| `get_conditions` | Condition | category 新增 `family-history`，移除 `symptom` |
| `get_medications` | Medication | 表名和字段名更新 |
| `get_care_plans` | CarePlan | category 新增 `activity-reminder`、`checkup-reminder` |
| `get_sleep_records` | SleepRecord | **新增工具** |
| `get_workout_records` | WorkoutRecord | **新增工具** |
| `get_health_summaries` | HealthSummary | **新增工具** |
| `read_document_content` | — | **移除**（不再有 DocumentReference） |

### 10.2 写入工具更新

| 工具 | 操作的资源 | 变更说明 |
|------|-----------|---------|
| `create_care_plan` | CarePlan | category 新增值 |
| `draft_observations` | Observation | source 改为 `'ai-extract'`（从对话抽取）；移除 source_ref 参数 |
| `draft_conditions` | Condition | category 支持 `family-history`；移除 code、severity 参数 |
| `draft_medications` | Medication | 字段名更新（name、indication、dosage_description） |
| `draft_encounter` | Encounter | 新增 attending_physician 参数 |
| `log_medication_taken` | — | **移除**（不再有 MedicationLog） |

---

## 11. 不在本次范围内

- OpenWearables 设备绑定与 OAuth 授权流程（后续阶段）
- 高频时序数据的存储优化（当前 SQLite 阶段无需考虑）
- LOINC / ICD-10 / SNOMED CT 编码映射
- 文档上传与独立的文件管理功能
- 每日服药打卡（MedicationLog）
- 心理情绪模块（mood category）
- 设备管理和 ExternalDeviceMapping 的本地镜像
