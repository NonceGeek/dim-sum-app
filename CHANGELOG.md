# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- 初始化 Next.js 项目
- 配置 TypeScript
- 集成 TailwindCSS
- 添加 ESLint 配置
- 集成 React Query
  - 安装 @tanstack/react-query
  - 安装 @tanstack/react-query-devtools
  - 配置 QueryProvider
  - 设置默认查询选项
    - staleTime: 1分钟
    - gcTime: 5分钟
    - retry: 1次
    - 禁用窗口聚焦时重新获取
- 集成 Zustand
  - 安装 zustand
  - 创建基础 store 结构
  - 配置持久化存储
  - 添加开发工具支持
  - 实现主题状态管理
- 集成 Shadcn UI
  - 安装 shadcn CLI
  - 初始化项目配置
  - 配置基础组件
    - Button
    - Card
    - Dialog
    - Dropdown Menu
  - 配置主题和样式
- 搭建 DimSum AI Labs 平台
  - 创建基础布局结构
  - 实现侧边栏导航
  - 添加主题切换功能
  - 创建页面路由
    - Home 页面
    - Discover 页面
    - Loft 页面
    - Profile 页面
  - 实现响应式设计
  - 添加科幻风格 UI

### Changed
- 更新 package.json 依赖
- 优化项目结构
- 更新全局样式配置
- 更新应用标题和描述

### Technical Debt
- 待完善项目文档

## Project Overview

### Tech Stack
- Next.js 15.2.5
- React 19.1.0
- TypeScript
- TailwindCSS
- React Query
- Zustand
- Shadcn UI
- pnpm

### Project Structure
```
dimsum-app/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── discover/
│   │   └── page.tsx
│   ├── loft/
│   │   └── page.tsx
│   ├── profile/
│   │   └── page.tsx
│   ├── providers.tsx
│   └── globals.css
├── components/
│   ├── layout/
│   │   ├── main-layout.tsx
│   │   └── sidebar.tsx
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── dropdown-menu.tsx
│   └── theme-toggle/
│       └── theme-toggle.tsx
├── lib/
│   └── utils.ts
├── providers/
│   └── query-provider.tsx
├── stores/
│   └── use-app-store.ts
├── public/
├── .cursor/
│   └── rules.json
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
└── CHANGELOG.md
```

### Development Guidelines
1. 使用 pnpm 作为包管理器
2. 使用 React Query 进行数据获取
3. 使用 Zustand 进行状态管理
4. 使用 Shadcn UI 组件库
5. 使用 TailwindCSS 进行样式管理
6. 使用 lucide-react 作为默认图标库

### Current Status
- 项目处于初始阶段
- 基础框架搭建完成
- 核心依赖已安装
- 开发规范已定义
- DimSum AI Labs 平台基础结构已搭建 