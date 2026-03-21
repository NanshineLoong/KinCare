# ADR-0004: Docker Compose 优先的部署策略

- **状态：** Accepted
- **日期：** 2026-03-11

## 背景与问题

KinCare 面向技术用户的私有部署场景。需要决定部署方式。

问题：如何让用户尽可能简单地在本地部署 KinCare？

## 考虑的方案

### 方案 A：Docker Compose 一键部署（选定）

- 优点：用户只需安装 Docker，一条命令启动所有服务；开发和部署环境一致
- 缺点：用户需要了解基本的 Docker 操作

### 方案 B：原生安装脚本

- 优点：不依赖 Docker
- 缺点：需要适配多种操作系统；依赖管理复杂；开发环境和部署环境不一致

### 方案 C：Kubernetes / Helm

- 优点：适合大规模部署
- 缺点：对家庭用户来说过度复杂

## 决策

采用**方案 A：Docker Compose 一键部署**。

所有服务（前端、后端、数据库、MCP Server）通过 `docker-compose.yml` 统一编排。数据通过 Docker Volume 持久化到宿主机。

部署流程目标：

```bash
git clone <repo>
cd KinCare
docker compose up -d
# 访问 http://localhost:<port>
```

## 后果

- **正面：** 部署极其简单，符合"一键部署"的产品目标
- **正面：** 开发者可以用同一套 compose 文件进行本地开发
- **正面：** 服务间网络和依赖关系由 Docker Compose 管理
- **负面：** 用户需要安装 Docker（macOS/Windows 需要 Docker Desktop）
- **考虑：** 后续可提供开发用的 `docker-compose.dev.yml` 支持热重载等开发体验优化
