<div align="center">

<img src="assets/KinCare.svg" alt="KinCare logo" width="70%" valign="middle">

<h3 align="center">自托管、由 AI 驱动的家庭健康空间</h3>

<img src="assets/screenshot.png" alt="KinCare 截图" width="90%">

<p>中文 | <a href="./README.md">English</a></p>

</div>

<p align="center"><strong>Connection · Insight · Care</strong></p>

- **Connection** — 把家人与健康放进同一个共享空间。
- **Insight** — 让 AI 发现你容易忽略的信息。
- **Care** — 把理解转化为及时、有意义的行动。

## KinCare 是什么？

KinCare 是一个部署在你自己的电脑或服务器上的私有家庭健康空间。  
它把家庭成员、健康档案与 AI 助手集中在一处，让家人保持同步，同时不交出对敏感数据的掌控。

## 核心能力

- 面向整个家庭的健康仪表盘
- 为每位家庭成员提供跨多种记录类型的统一健康档案
- 具备聊天、语音输入与健康档案草稿操作的 AI Agent
- AI 驱动的每日洞察与提醒
- 带成员级权限的家庭空间
- 自托管、隐私优先的部署方式

## 快速开始

```bash
cp .env.example .env
# 若用于真实部署，在对外暴露应用前请修改 KINCARE_JWT_SECRET。

docker compose up -d --build
```

然后打开：

- Web 应用：`http://localhost:8080`

应用启动后：

1. 使用用户名、可选邮箱和密码注册第一个用户。
2. 打开头像菜单，进入 `设置 -> 管理员配置`。
3. 如需使用 AI 功能，请配置 AI 提供商、语音转写与每日刷新时间。

> [!NOTE]
> - 一次部署对应一个家庭空间。
> - 第一个注册用户会自动成为家庭管理员。
> - 后续注册用户会自动加入同一个家庭空间。
> - 管理员可以在不创建用户账号的情况下添加成员档案，成员访问遵循 `read / write / manage` 级别与范围授权。


## 本地开发

先复制本地环境文件：

```bash
cp .env.example .env
```

启动后端：

```bash
cd backend
uv venv .venv
uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

在另一个终端启动前端：

```bash
cd frontend
npm ci
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

## 待办

- [ ] 接入 OpenWearables 仓库，将穿戴设备数据引入 KinCare
- [ ] 提供本地 MCP 服务，使外部 AI Agent 能够安全访问家庭健康上下文

## 致谢

- [PydanticAI](https://ai.pydantic.dev/) — Agent 框架
- [Docling](https://github.com/docling-project/docling) — 文档处理
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — 语音转写

## License
根据 [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html) 授权。完整文本见 [`LICENSE.txt`](./LICENSE.txt)。
