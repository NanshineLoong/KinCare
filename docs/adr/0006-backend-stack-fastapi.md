# ADR-0006: 后端采用 Python + FastAPI

- **状态：** Accepted
- **日期：** 2026-03-11

## 背景与问题

HomeVital 后端需要承担认证、权限、健康数据管理、AI 服务编排以及后续 MCP 集成。项目同时强调 AI 能力扩展和本地私有部署。

问题：MVP v1 后端应采用什么技术栈，既能支撑传统 API，又能顺畅接入 LLM 和 MCP 相关能力？

## 考虑的方案

### 方案 A：Python + FastAPI（选定）

- 优点：Python 在 AI/LLM 生态中最成熟，便于接入 OpenAI SDK、LangChain 等库；FastAPI 自带类型驱动的请求校验和 OpenAPI 文档；异步支持适合后续 SSE、文件处理和 AI 调用场景
- 缺点：需要自行约束项目分层；性能不是该类框架的主要优势

### 方案 B：Node.js + NestJS

- 优点：与前端同语言，工程化能力成熟
- 缺点：AI/MCP 相关生态和示例资源不如 Python 丰富；团队需要在健康数据建模和 AI 编排上投入更多封装工作

### 方案 C：Go + Gin/Fiber

- 优点：性能和部署体积更优
- 缺点：AI 生态较弱，开发速度和迭代效率不占优，不适合 MVP 初期快速试错

## 决策

采用**方案 A：Python + FastAPI**。

后端按分层目录组织：API、schemas、models、services、core、ai。AI Service 在 MVP 阶段作为 API Server 内部模块实现，以降低系统复杂度。

## 后果

- **正面：** AI 功能和 MCP 能力可直接复用 Python 生态
- **正面：** FastAPI 的类型系统和文档能力有助于前后端协作
- **正面：** 容易实现后续的流式响应、异步任务和健康检查
- **负面：** 项目结构需要主动保持清晰，避免业务逻辑散落在路由层
- **负面：** 若未来出现高并发需求，可能需要额外性能优化
