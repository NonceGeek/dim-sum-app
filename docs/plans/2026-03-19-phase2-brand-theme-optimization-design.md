# Phase 2 — 品牌色精修 + Token 化 + 主题切换 + 页面优化

> **日期:** 2026-03-19
> **分支:** new-UI
> **前置:** Phase 1 完成（10 commits, cee84c8）

---

## 目标

1. 精修品牌色（violet → indigo）
2. 全站组件/页面 token 化，消除所有硬编码颜色
3. 解锁主题切换（light/dark/system）+ Pill Toggle 新组件
4. 页面体验优化（Home、Account、Admin）

---

## 1. 品牌色精修

**方向:** 靛蓝 Indigo，hue 260 → 250

**改动文件:** `main/styles/tokens/primitives.css`

**调整策略:**
- Brand 色系 hue 从 260 调至 250（更偏蓝靛，减少紫感）
- 中间色阶（400-600）微增 chroma，让主色更鲜明
- 深色端（800-950）微降 chroma，暗色模式下更沉稳
- Neutral 色系 hue 跟随 250，保持整体色温一致

**不改:** 功能色（Red、Green、Amber、Blue）保持不变。

---

## 2. 组件 Token 化

### 2.1 UI 组件修复（2 处）

| 文件 | 问题 | 修复 |
|------|------|------|
| `button.tsx` | `dark:hover:bg-gray-800/50`, `border-gray-300 dark:border-gray-500` | → `hover:bg-accent`, `border-border` |
| `input.tsx` | `dark:file:text-gray-300` | → `dark:file:text-muted-foreground` |

### 2.2 全局样式修复（1 处）

| 文件 | 问题 | 修复 |
|------|------|------|
| `globals.css` | `.gray_text_sm` 用 `text-gray-600 dark:text-gray-400` | → `text-muted-foreground` |

### 2.3 页面级硬编码颜色清理（200+ 处）

**Home 页面 (~15 处)**
- 示例卡片: `text-gray-900 dark:text-gray-100` → `text-foreground`
- 搜索图标: `text-gray-400` → `text-muted-foreground`
- 卡片 hover: `hover:bg-gray-50 dark:hover:bg-gray-800` → `hover:bg-accent`
- 分页文字: `text-gray-500` → `text-muted-foreground`

**Account 页面 (~30 处)**
- My Record: `bg-gray-800` 输入框/分类标签 → `bg-secondary`/`bg-muted`
- Data Annotation: 按钮/边框大量 `gray-*` → 语义 token
- 音频播放器: `text-gray-300`/`text-gray-400` → `text-muted-foreground`

**Admin 页面 (~160 处) — 最大改动区域**
- Layout: `bg-gray-800`/`bg-gray-900` → `bg-card`/`bg-background`
- 导航: `text-gray-300 hover:bg-gray-700` → `text-sidebar-foreground hover:bg-sidebar-accent`
- 用户头像: `bg-purple-600` → `bg-primary`
- 所有表格: `text-gray-300`/`border-gray-700` → `text-muted-foreground`/`border-border`
- 搜索输入: `bg-gray-700 border-gray-600 text-white` → `bg-input border-border text-foreground`
- 状态 Badge: `bg-blue-500`/`bg-green-500`/`bg-yellow-500` → `bg-info`/`bg-success`/`bg-warning`
- 分页按钮: `bg-gray-700 border-gray-600` → `bg-secondary border-border`

**替换规则:**

| 硬编码 | 语义 Token |
|--------|-----------|
| `bg-gray-900` | `bg-background` |
| `bg-gray-800` | `bg-card` |
| `bg-gray-700` | `bg-secondary` 或 `bg-muted` |
| `text-gray-300`/`text-gray-400` | `text-muted-foreground` |
| `text-gray-500`/`text-gray-600` | `text-muted-foreground` |
| `text-gray-900` | `text-foreground` |
| `text-white` | `text-foreground` |
| `border-gray-600`/`border-gray-700` | `border-border` |
| `hover:bg-gray-700`/`hover:bg-gray-800` | `hover:bg-accent` |
| `bg-purple-600`/`bg-purple-400` | `bg-primary` |
| `text-purple-400` | `text-primary` |
| `bg-blue-500` | `bg-info` |
| `bg-green-500`/`text-green-400` | `bg-success`/`text-success` |
| `bg-yellow-500`/`text-yellow-400` | `bg-warning`/`text-warning` |
| `bg-red-500`/`text-red-400` | `bg-error`/`text-error` |

---

## 3. 主题切换

### 3.1 解锁

**文件:** `main/app/providers.tsx`

**改动:**
- 移除 `forcedTheme="dark"`
- 改 `defaultTheme="system"`
- 保留 `disableTransitionOnChange`

### 3.2 Pill Toggle 组件

**文件:** 重写 `main/components/theme-toggle/theme-toggle.tsx`

**设计:**
- 胶囊形状（pill shape），内含太阳/月亮图标
- 滑动圆点动画在 light ↔ dark 间切换
- 点击切换 light ↔ dark
- 长按 2 秒触发 system 模式（可选，如实现复杂度太高可省略）
- 使用 framer-motion（项目已安装）做滑动/图标 morph 动画
- 尺寸紧凑，适合放在导航栏

**Storybook:** 为 Pill Toggle 写 story，展示三种状态。

### 3.3 Light 模式适配

Token 化完成后（第 2 节），light 模式应自动工作。需要逐页视觉验证：
- 对比度是否足够
- 边框是否可见
- hover/focus 状态是否明显
- 渐变背景是否协调

---

## 4. 页面体验优化

### 4.1 Home 页面

**布局节奏:**
- 搜索区域和示例卡片间距优化
- 示例卡片网格响应式断点检查

**视觉层级:**
- Hero 区域渐变背景改用 token 色（当前是硬编码 purple-indigo-blue）
- 搜索框聚焦态增强
- 结果区域与搜索区域的过渡动画已有（AnimatePresence），保持

**首屏加载:**
- 为搜索结果卡片添加 skeleton loader（当前只有简单 spinner）

### 4.2 Account 页面

**表单体验:**
- Profile 页已有 skeleton — 保持
- My Record 页 skeleton 已有 — 检查 light 模式下效果

**状态反馈:**
- Data Annotation 页按钮需要 loading/disabled 状态（当前无反馈）
- 所有 mutation 操作添加 loading indicator

**流程引导:**
- Preferences 页当前是空壳 — 暂不填充内容，不在范围内

### 4.3 Admin 页面

**数据表格:**
- Token 化后表格颜色自动修复
- 表头样式统一用 `text-muted-foreground font-medium`
- 行 hover 统一用 `hover:bg-accent`

**筛选交互:**
- 搜索输入框统一样式
- 状态筛选改用 Badge 组件的语义变体

**信息密度:**
- 当前 Admin Users 表 8 列，信息密度合适，不需要改
- Audit Logs 页信息密度偏高 — 考虑折叠次要信息

**加载状态标准化:**
- Admin 页面目前大多只显示 "Loading..." 文字
- 统一改用 skeleton loader 模式（与 Account 页一致）

---

## 5. 不做的事

- **不做多主题**（青花瓷、古典等）— YAGNI
- **不做 component-level token 层** — 语义 token 已覆盖所有需求
- **不填充 Preferences 页内容** — 产品需求不明确
- **不改 Storybook 配置** — 已工作良好
- **不改路由结构** — 只优化视觉和交互

---

## 6. 风险与注意事项

| 风险 | 影响 | 缓解 |
|------|------|------|
| Admin 页面 160+ 处改动 | 可能遗漏或误改 | 逐文件替换 + Storybook/浏览器验证 |
| Light 模式首次启用 | 可能有意料外的视觉问题 | Token 化后逐页检查 |
| Home 渐变背景替换 | 改变首屏视觉印象 | 用 token 色重新调配，保持设计意图 |
| 长按触发 system 模式 | 移动端长按可能冲突 | 如实现复杂可改为第三次点击循环 |
