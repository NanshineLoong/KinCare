# ADR-0005: 前端采用 React + Vite + TypeScript + Tailwind CSS

- **状态：** Accepted
- **日期：** 2026-03-11

## 背景与问题

HomeVital 需要一个可快速迭代的 Web 前端，用于实现家庭看板、成员档案和 AI 对话等核心界面。现有 UI 原型已呈现出明显的 Tailwind 风格。

问题：MVP v1 前端应采用什么技术栈，才能在保持开发效率的同时，较好承接现有设计原型？

## 考虑的方案

### 方案 A：React 18 + Vite + TypeScript + Tailwind CSS + React Router（选定）

- 优点：React 生态成熟，适合构建多页面状态驱动界面；Vite 启动和构建速度快；TypeScript 提升接口与状态建模的可维护性；Tailwind CSS 能高效贴近现有原型样式；React Router 适合 SPA 路由场景
- 缺点：需要自行约束组件结构和状态边界；相较于全栈框架，需要额外处理部署集成

### 方案 B：Next.js

- 优点：框架能力完整，路由和构建方案成熟
- 缺点：MVP 当前不需要 SSR/SSG；引入全栈框架会增加部署和目录复杂度

### 方案 C：Vue 3 + Vite

- 优点：同样具备较好开发体验
- 缺点：与当前团队预设方案和后续生态资料不完全一致；对 React 生态中的现成组件和经验复用较弱

## 决策

采用**方案 A：React 18 + Vite + TypeScript + Tailwind CSS + React Router**。

前端以 SPA 形式实现，优先构建清晰的页面与组件边界。样式层使用 Tailwind CSS，并在后续阶段提取与原型一致的设计 token。

## 后果

- **正面：** 能快速搭建和迭代 MVP 界面，贴合现有原型风格
- **正面：** TypeScript 有助于前后端接口联调和长期维护
- **正面：** Vite 适合本地开发和容器化构建
- **负面：** 需要自行组织状态管理、API 客户端与目录边界
- **负面：** 首阶段仍需额外补齐测试、构建和部署规范
