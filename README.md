# HomeVital

**Self-hosted AI family health assistant — 私有化家庭健康管理助手**

HomeVital 是一个开源的、可私有部署的家庭健康管理系统。它聚合家庭成员的多种健康信息，提供统一的健康看板，并通过 AI 提供对话式健康咨询、文档结构化抽取和主动健康提醒。

## 核心能力

- **家庭成员管理** — 一个实例即一个家庭空间，支持多成员档案与权限管理
- **健康档案聚合** — 聚合手动录入、文档上传（体检报告/检验单/处方单）、可穿戴设备等多种数据来源
- **标准化健康事实层** — 基于 FHIR 风格资源模型，统一存储和查询家庭健康数据
- **AI 对话与洞察** — 基于家庭健康数据进行自然语言对话，AI 生成健康建议与每日提醒
- **MCP 服务接口** — 将健康信息服务封装为 MCP Server，支持外部 AI 系统（如 OpenClaw）调用

## 面向用户

- 关注家庭健康管理的个人用户
- 偏好数据私有化、不信任云端健康服务的技术用户
- 需要帮助老人/家人管理健康信息的家庭管理员

## 当前状态

当前已完成 MVP v1 的 Phase 1-4 核心能力：

- 注册、登录、JWT 刷新
- 全体已登录成员可查看家庭成员目录
- 管理员可添加/删除成员，并可注销整个家庭空间后回到首次注册状态
- 已落地健康事实层 6 类资源的后端 CRUD 接口
- 已支持观测指标趋势查询与首页 Dashboard 聚合接口
- 前端已落地首页看板、分时提醒流、底部 AI 输入栏与成员档案页
- 健康数据访问默认按成员级权限控制；管理员拥有全量访问权限
- 已落地应用内 AI 会话、SSE 流式回复、语音转写入口、文档上传/抽取确认与 APScheduler 驱动的提醒落库
- `mcp-server/` 仍保留为 Phase 5 占位骨架；`docker-compose.yml` 仍是面向目标 PostgreSQL/MCP 架构的编排草案

## 当前 AI 实现边界

- `backend/app/ai` 已落地应用内 orchestrator、provider abstraction、transcription、extraction 与 scheduler 模块
- AI 读写继续复用现有服务层与成员级权限；高风险健康档案写入保持“先生成草稿，再由用户确认”
- 当前默认提供 OpenAI-compatible provider 抽象；未配置 `HOMEVITAL_AI_*` 时仍可使用内置 fallback 完成本地联调与测试
- `mcp-server/` 继续作为 Phase 5 的对外接口层；更重的本地文档/VLM/ASR 运行时仍按部署条件逐步替换

## 快速启动

```bash
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

默认访问地址：

- 前端：`http://localhost:5173`
- 后端健康检查：`http://localhost:8000/health`

> 可选：如需接入外部或本地 OpenAI-compatible 模型服务，可配置 `HOMEVITAL_AI_PROVIDER`、`HOMEVITAL_AI_BASE_URL`、`HOMEVITAL_AI_API_KEY`、`HOMEVITAL_AI_MODEL`；未配置时仍可本地运行并使用内置 fallback 回复。

> 当前 Phase 1-4 已验证的运行路径是本机分别启动前后端。`docker-compose.yml` 仍保留面向 PostgreSQL / MCP 的部署骨架，但尚未与当前 SQLite 落地完全对齐。

## 项目结构

```
HomeVital/
├── AGENTS.md                  # Agent 工作约束
├── README.md                  # 项目概览（本文件）
├── docs/
│   ├── prd/
│   │   └── mvp-v1.md          # MVP v1 产品需求
│   ├── architecture/
│   │   ├── overview.md         # 架构总览 + C4 Container 图
│   │   └── data-model.md       # 健康事实层数据模型
│   └── adr/
│       ├── README.md           # ADR 索引
│       └── nnnn-*.md           # 架构决策记录
├── stitch-screens/            # UI 设计原型（Stitch 导出）
├── backend/                   # FastAPI 后端
├── frontend/                  # React + Vite 前端
├── mcp-server/                # MCP Server 占位骨架
└── docker-compose.yml         # 本地编排入口
```

## 相关文档

| 文档 | 说明 |
|------|------|
| [AGENTS.md](./AGENTS.md) | 构建、测试、代码风格、提交约束 |
| [MVP v1 需求](./docs/prd/mvp-v1.md) | 产品范围与功能定义 |
| [架构总览](./docs/architecture/overview.md) | 系统架构 + C4 Container |
| [数据模型](./docs/architecture/data-model.md) | 健康事实层 FHIR 风格模型 |
| [Phase 4 AI 技术设计](./docs/architecture/phase-4-ai-design.md) | AI 对话、语音、文档/图片抽取、定时任务与权限边界 |
| [ADR 索引](./docs/adr/README.md) | 架构决策记录集合 |

## License

TBD
