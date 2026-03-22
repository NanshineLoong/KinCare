# <img src="assets/KinCare.svg" alt="KinCare logo" width="44" valign="middle"> KinCare

**面向单个家庭空间的自托管 AI 家庭健康助手**

中文 | [English](./README.md)

<p>
  <img src="assets/screenshot.png" alt="KinCare 截图" width="100%">
</p>

## KinCare 是什么？

KinCare 是一个可以部署在你自己的电脑或服务器上的私有家庭健康空间。它把家庭成员、健康档案与 AI 助手放到同一个系统里，帮助家人协同了解健康状态，同时尽可能把敏感数据保留在自己手中。

**Connection · Insight · Care**

- **Connection**：把一个家庭空间、成员档案和各类健康记录连接到同一块家庭仪表盘中。
- **Insight**：通过 AI 对话、健康摘要和提醒，发现仅靠人工翻看记录不容易看出的规律与重点。
- **Care**：帮助家人彼此关注、提醒和协作，在权限控制下提供更及时的支持。

## 核心能力

- 面向整个家庭的健康仪表盘
- 将多种健康信息汇总为每个成员的统一健康档案
- 支持聊天、语音输入和健康档案草稿操作的 AI Agent
- AI 驱动的每日洞察与提醒
- 家庭空间与成员级权限管理
- 自托管、隐私优先

## 快速开始

KinCare 当前推荐使用 Docker Compose 安装。

```bash
cp .env.example .env
# 编辑 .env，至少设置 KINCARE_JWT_SECRET
# 如需聊天、语音转写和 AI 生成能力，再补充 AI / STT 配置

docker compose up -d --build
```

启动后访问：

- Web 应用：`http://localhost:8080`

说明：

- 默认启动栈为 `web + api`
- SQLite 是唯一必需的持久化数据存储
- 可选的 `mcp` 服务不在默认启动路径中

## 本地开发

先准备本地环境变量：

```bash
cp .env.example .env
```

启动后端：

```bash
cd backend
UV_CACHE_DIR=/tmp/kincare-uv-cache uv venv .venv
UV_CACHE_DIR=/tmp/kincare-uv-cache uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

在另一个终端启动前端：

```bash
cd frontend
npm ci
VITE_API_BASE_URL=http://localhost:8000 npm run dev -- --host 0.0.0.0 --port 5173
```

本地访问地址：

- 前端：`http://localhost:5173`
- 后端健康检查：`http://localhost:8000/health`

## 家庭空间与权限

- 一次部署对应一个家庭空间。
- 第一个注册用户会自动成为家庭管理员。
- 管理员可以添加成员并管理权限。
- 成员访问遵循 `read / write / manage` 三级权限，并支持按范围授权。

## 项目技术栈

- 前端：React + Vite
- 后端：FastAPI
- 数据库：SQLite
- AI 运行时：PydanticAI tool-calling 工作流
- 部署方式：Docker Compose

## Roadmap

- 接入 OpenWearables 仓库，将穿戴设备数据引入 KinCare
- 提供本地 MCP 服务，让 Claude Code 等外部 AI Agent 可以安全访问家庭健康上下文
- 通过 skills-based integrations 支持 OpenClaw

## 致谢

- [PydanticAI](https://ai.pydantic.dev/)：Agent Framework
- [Docling](https://github.com/docling-project/docling)：文档处理
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper)：语音转写

## 主真相文档

- [当前开发计划](./.cursor/plans/kincare_v2_开发计划_a24f52a8.plan.md)
- [架构总览](./docs/architecture/overview.md)
- [数据模型](./docs/architecture/data-model.md)
- [AI 架构](./docs/architecture/phase-4-ai-design.md)
- [ADR 索引](./docs/adr/README.md)

## License

TBD
