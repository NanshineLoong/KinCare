# AGENTS.md — HomeVital Agent 工作约束

本文件定义 AI 编码 Agent 在本项目中的行为规范。所有自动化编码、审查、提交操作必须遵守以下约束。

---

## 项目背景

HomeVital 是私有部署的家庭健康管理助手。核心文档：

- 产品需求：`docs/prd/mvp-v1.md`
- 架构总览：`docs/architecture/overview.md`
- 数据模型：`docs/architecture/data-model.md`
- 架构决策：`docs/adr/`

修改代码前，先阅读相关文档确认设计意图。

---

## 构建与运行

```bash
# 开发环境启动（待定具体命令，占位）
docker compose up -d

# 查看日志
docker compose logs -f
```

## 测试

```bash
# 运行全部测试（待定具体命令，占位）
# 后端测试
# 前端测试
# E2E 测试
```

> 测试命令将随技术栈确定后补充。所有 PR 必须通过全部测试。

---

## 代码风格

- 使用项目根目录的格式化/lint 配置（待建立）
- 提交前运行 lint 和 format
- 函数/类命名使用英文，注释可用中文或英文
- 不要在代码注释中复述代码行为，只注释非显而易见的意图、约束或权衡

---

## 目录规则

```
HomeVital/
├── docs/                      # 所有文档（PRD、架构、ADR）
│   ├── prd/                   # 产品需求文档
│   ├── architecture/          # 架构文档与数据模型
│   └── adr/                   # 架构决策记录（MADR 格式）
├── stitch-screens/            # UI 设计原型（只读参考，不要修改）
└── <src>/                     # 源码（目录结构随技术栈确定后建立）
```

- `stitch-screens/` 是设计参考，**禁止修改**，仅用于对照实现
- `docs/adr/` 中的 ADR 一旦 Accepted 则**禁止修改内容**，只能通过新 ADR 来 Supersede
- 新增 ADR 使用递增编号：`docs/adr/NNNN-<kebab-case-title>.md`

---

## 禁止事项

1. **不要**在代码中硬编码密钥、密码或个人健康数据
2. **不要**修改 `stitch-screens/` 下的文件
3. **不要**在没有对应测试的情况下提交功能代码
4. **不要**引入未在依赖管理文件中声明的依赖
5. **不要**在 PR 中混合不相关的变更（一个 PR 一个关注点）
6. **不要**修改已 Accepted 的 ADR 内容
7. **不要**在代码中存储未脱敏的真实健康数据作为测试数据
8. **不要**跳过数据模型层直接操作数据库

---

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**type 取值：**

| type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档变更 |
| `refactor` | 重构（不影响功能） |
| `test` | 测试相关 |
| `chore` | 构建/工具/依赖变更 |

**scope 示例：** `auth`, `member`, `health-record`, `ai`, `mcp`, `ui`

**示例：**

```
feat(member): add family member creation API
fix(health-record): correct FHIR Observation date parsing
docs(adr): add ADR-0005 for AI provider abstraction
```

---

## PR 流程

1. 从主分支创建功能分支：`feat/<scope>-<description>` 或 `fix/<scope>-<description>`
2. 实现变更，确保测试通过
3. 提交符合 Conventional Commits 规范的 commit
4. 创建 PR，包含：
   - 变更摘要（关联的需求/ADR）
   - 测试计划
5. 通过 CI 检查和代码审查后合并

---

## 数据安全提醒

HomeVital 处理敏感的个人健康信息。开发时：

- 测试数据使用虚构数据，不使用真实个人信息
- 日志中不输出健康数据明文
- API 响应中不泄漏其他成员的信息（遵循权限模型）
