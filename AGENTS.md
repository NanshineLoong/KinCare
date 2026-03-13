# AGENTS.md — HomeVital Agent 工作约束

本文件定义 AI 编码 Agent 在本项目中的行为规范。所有自动化编码、审查、提交操作必须遵守以下约束。

---

## 项目背景

HomeVital 是私有部署的家庭健康管理助手。核心文档：

- 产品需求：`docs/prd/mvp-v1.md`
- 架构总览：`docs/architecture/overview.md`
- 数据模型：`docs/architecture/data-model.md`
- Phase 4 AI 设计：`docs/architecture/phase-4-ai-design.md`
- 架构决策：`docs/adr/`

修改代码前，先阅读相关文档确认设计意图。

---

## 构建与运行

```bash
# 当前推荐的本地开发方式
# 后端
cd backend
UV_CACHE_DIR=/tmp/homevital-uv-cache uv venv .venv
UV_CACHE_DIR=/tmp/homevital-uv-cache uv pip install --python .venv/bin/python -r requirements.txt
HOMEVITAL_DB_PATH=./data/homevital.db HOMEVITAL_JWT_SECRET=dev-secret .venv/bin/uvicorn app.main:app --reload

# 前端（另一个终端）
cd frontend
npm ci
VITE_API_BASE_URL=http://localhost:8000 npm run dev -- --host 0.0.0.0 --port 5173
```

```bash
# Docker Compose 骨架
docker compose up --build
docker compose logs -f
```

> 说明：当前 Phase 1-4 实现继续使用本地 SQLite 文件（`HOMEVITAL_DB_PATH`）与本地上传目录。后端已覆盖认证、成员管理、健康事实层资源 CRUD、趋势查询、Dashboard 聚合，以及应用内 AI 对话/SSE、语音转写入口、文档抽取确认和定时任务提醒落库；前端已接入首页看板、成员档案页与真实 AI 对话浮层。`docker-compose.yml` 仍保留 PostgreSQL 与 MCP 的目标编排骨架，后续阶段会与实际实现对齐。

## 测试

```bash
# 后端测试
cd backend && .venv/bin/pytest

# 前端测试
cd frontend && npm test
```

> 当前仓库尚未提供 E2E 测试。所有 PR 必须至少通过后端和前端测试。

---

## 代码风格

- 使用项目根目录的格式化/lint 配置（待建立）
- 提交前运行 lint 和 format
- 函数/类命名使用英文，注释可用中文或英文
- 不要在代码注释中复述代码行为，只注释非显而易见的意图、约束或权衡

## AI 实现约束

- 修改 AI 对话、抽取、转写、调度等相关实现前，先阅读 `docs/architecture/phase-4-ai-design.md`
- AI 读取或修改健康数据时，必须复用现有业务服务层与成员级权限校验；不要让 AI 直接访问数据库
- 不要把全量或未授权的健康数据直接拼进 Prompt；优先使用最小上下文 + 受控工具调用
- 优先沿用 `backend/app/ai/` 下现有的 `providers/`、`orchestrator/`、`tools/`、`transcription/`、`extraction/`、`scheduler/` 职责边界，不要把 AI 逻辑散落到路由层或直接写库
- 对 AI SDK、模型服务、ASR、文档解析、MCP 等外部系统的实现，以各自官方文档和当前版本说明为准；仓库文档只定义架构方向和边界，不替代上游接口文档

---

## 目录规则

```
HomeVital/
├── docs/                      # 所有文档（PRD、架构、ADR）
│   ├── prd/                   # 产品需求文档
│   ├── architecture/          # 架构文档与数据模型
│   └── adr/                   # 架构决策记录（MADR 格式）
├── stitch-screens/            # UI 设计原型（只读参考，不要修改）
├── backend/                   # FastAPI 后端
├── frontend/                  # React + Vite 前端
├── mcp-server/                # MCP Server 占位骨架
└── docker-compose.yml         # 本地编排入口
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
9. **不要**让 AI 绕过现有权限模型直接读取或写入家庭健康数据

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
- API 响应中不泄漏超出权限模型的数据；健康数据默认按成员级权限控制，家庭成员目录仅返回当前阶段允许公开的基础信息
