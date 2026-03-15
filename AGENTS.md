# AGENTS.md — HomeVital Agent 工作约束

本文件定义 AI 编码 Agent 在本项目中的行为规范。所有自动化编码、审查、提交操作必须遵守以下约束。

---

## 项目背景

HomeVital 当前按最新开发主线推进。修改代码前，先阅读以下文档并确认是否与本次任务直接相关：

- 当前开发计划：`.cursor/plans/homevital_新开发计划_a2e4e028.plan.md`
- 架构总览：`docs/architecture/overview.md`
- 数据模型：`docs/architecture/data-model.md`
- AI 架构：`docs/architecture/phase-4-ai-design.md`
- 架构决策：`docs/adr/README.md`

与旧实现或旧文档冲突时，优先级如下：

1. 当前任务的直接用户指令
2. 当前开发计划
3. ADR-0009 / ADR-0010
4. 当前架构文档
5. 旧代码和旧设计痕迹

> `docs/proposals/` 中的文件仅为 Accepted ADR 保留稳定引用，不再作为活跃开发的主真相源。

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
# 目标部署骨架（不是当前主开发路径）
docker compose up --build
docker compose logs -f
```

> 当前开发基线继续使用本地 SQLite（`HOMEVITAL_DB_PATH`）和本机分别启动的 FastAPI/Vite。`docker-compose.yml` 与 `mcp-server/` 仍保留为后续阶段的目标骨架。

## 测试

```bash
# 后端测试
cd backend && .venv/bin/pytest

# 前端测试
cd frontend && npm test
```

> 当前仓库尚未提供 E2E 测试。涉及实现变更的 PR，至少要运行与改动相关的后端和前端测试；若测试仍缺失，需在结果说明中明确指出。

---

## 代码风格

- 使用项目根目录的格式化/lint 配置
- 提交前运行相关 lint / format / test
- 函数、类、字段命名使用英文
- 注释只解释非显而易见的意图、约束或权衡

## AI 实现约束

- 修改 AI 对话、抽取、转写、调度前，先阅读 `docs/architecture/phase-4-ai-design.md`
- AI 读取或修改健康数据时，必须复用现有业务服务层与成员级权限校验；不要让 AI 直接访问数据库
- 不要把全量或未授权的健康数据直接拼进 prompt；优先使用最小上下文 + 受控工具调用
- 优先沿用 `backend/app/ai/` 下的 `deps.py`、`agent.py`、`orchestrator.py`、`tools/`、`transcription.py`、`extraction.py`、`scheduler.py` 职责边界
- 不要重新把旧的关键字路由 orchestrator、`providers/` 主抽象、`DocumentReference` 独立文档资源链路当作当前方案
- 健康档案类高风险写入必须保持“生成草稿 -> 用户确认 -> 服务层写入”
- 对 PydanticAI、模型服务、ASR、文档解析、MCP 等外部系统的实现，以各自官方文档和当前版本说明为准；仓库文档只定义边界和当前默认路线

---

## 目录规则

```text
HomeVital/
├── .cursor/plans/             # 当前开发计划
├── docs/                      # 活跃文档与 ADR
│   ├── prd/
│   ├── architecture/
│   ├── adr/
│   └── proposals/             # 仅作 ADR 附件保留，不作主真相源
├── stitch-screens/            # 旧 UI 参考（只读，不再是当前设计基线）
├── backend/
├── frontend/
├── mcp-server/                # 占位骨架
└── docker-compose.yml         # 目标部署骨架
```

- `stitch-screens/` **禁止修改**
- `docs/adr/` 中的 Accepted ADR **禁止修改内容**，只能通过新 ADR Supersede
- 新增 ADR 使用递增编号：`docs/adr/NNNN-<kebab-case-title>.md`

---

## 禁止事项

1. **不要**在代码中硬编码密钥、密码或个人健康数据
2. **不要**修改 `stitch-screens/` 下的文件
3. **不要**在没有对应验证的情况下提交功能代码
4. **不要**引入未在依赖管理文件中声明的依赖
5. **不要**在 PR 中混合不相关的变更
6. **不要**修改已 Accepted 的 ADR 内容
7. **不要**在代码中存储未脱敏的真实健康数据作为测试数据
8. **不要**绕过服务层和权限模型直接操作健康数据
9. **不要**把已被 supersede 的旧设计重新写回 README、架构文档或实现中

---

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```text
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

**scope 示例：** `auth`, `member`, `health-record`, `ai`, `ui`, `docs`

---

## PR 流程

1. 从主分支创建功能分支：`feat/<scope>-<description>` 或 `fix/<scope>-<description>`
2. 实现单一关注点变更
3. 运行与改动相关的验证命令
4. 提交符合 Conventional Commits 规范的 commit
5. 创建 PR，包含变更摘要、关联计划/ADR、测试计划与风险说明

---

## 数据安全提醒

HomeVital 处理敏感的个人健康信息。开发时：

- 测试数据必须使用虚构数据
- 日志中不输出健康数据明文
- API 响应不能泄漏超出权限模型的数据
- 健康数据默认按成员级权限控制；家庭成员目录只返回当前阶段允许公开的基础信息
