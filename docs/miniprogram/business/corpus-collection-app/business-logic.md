# 语料采集小程序业务逻辑

## 一、项目背景

荔湾研究院希望借助微信小程序开展岭南文化用语征集与粤语相关内容采集活动，收集岭南文化精神用语、荔湾地名故事、粤语诗歌、歇后语、标语等语料，增强研究院文化服务能力，并通过社会性活动提升公众参与度与文化传播力。

本项目包含两端：

| 端 | 说明 |
|----|------|
| 小程序用户端 | 普通用户投稿、浏览活动、查看精选内容、点赞评论、查看个人投稿记录 |
| Web 管理后台 | 运营配置活动、管理分类、审核投稿、发起 AI 审核、设置精选内容、查看数据统计 |

AI agent 已提供投稿安全检查、批量 AI 审核和活动封面生成能力。平台后端负责封装小程序 API、保存业务数据、接收 webhook、提供后台管理接口。

---

## 二、产品目标

| 目标 | 说明 |
|------|------|
| 便捷性 | 用户可通过小程序快速提交用语、故事、音频、图片、视频等内容 |
| 互动性 | 通过点赞、评论、分享、活动排行提升用户参与感 |
| 可管理性 | 后台支持内容审核、分类管理、活动管理和数据分析 |
| 可展示性 | 精选内容可在首页、活动页和后续文化知识库中展示 |

---

## 三、用户角色

| 角色 | 说明 | 权限范围 |
|------|------|----------|
| 普通用户 | 参与投稿、浏览内容、互动 | 小程序投稿、浏览、点赞、评论、查看个人记录 |
| 内容审核员 | 审核投稿内容，管理展示区 | Web 后台审核投稿、查看 AI 审核结果、设置展示状态 |
| 活动运营 | 配置活动、查看数据、管理奖励 | Web 后台活动配置、分类标签、作品管理、数据统计、Banner 生成 |
| 超级管理员 | 系统设置、权限分配、数据管理 | 全部后台权限 |

小程序用户端使用 `requireMiniprogramAuth`，只要登录即可使用投稿与互动功能。

Web 管理后台建议复用现有 `/admin` 权限体系，第一阶段可以先要求 `isSystemAdmin = true`，后续再扩展更细粒度的运营/审核员权限。

---

## 四、系统边界

### 4.1 小程序端边界

小程序端只负责用户体验：

- 首页活动 Banner、快捷入口、最新投稿
- 投稿表单与多媒体上传
- 活动列表、活动详情、活动投稿
- 精选内容浏览
- 作品点赞、评论、分享
- 个人投稿、我的活动、消息通知

小程序不直接调用 AI agent，统一调用平台 `/api/miniprogram/corpus_collection/*`。

### 4.2 平台后端边界

平台后端负责：

- 用户认证与鉴权
- 保存活动、投稿、媒体、互动、评论、审核状态
- 调用 agent 投稿前安全检查
- 发起 agent 批量 AI 审核
- 接收 agent webhook 并更新审核结果
- 调用 agent 生成活动或精选内容 Banner
- 给 Web 后台提供管理接口

### 4.3 AI agent 边界

AI agent 已完成：

| 能力 | agent 路径 | 说明 |
|------|------------|------|
| 投稿前安全检查 | `POST /precheck/submissions` | 同步检查标题、介绍、图片 |
| 投稿 AI 审核 | `POST /reviews/batches` + Webhook | 异步批量审核投稿，最多 100 条 |
| 活动封面图生成 | `POST /covers/generations` | 根据 prompt 返回 4 张临时封面候选 |

agent API 详细定义见：`docs/archive/submission-service-api.md`。

---

## 五、核心业务流程

### 5.1 首页流程

```text
用户进入首页
  -> 获取首页数据
  -> 展示当前活动 Banner
  -> 展示快捷入口
  -> 展示最新审核通过投稿
  -> 展示精选内容
```

首页聚合数据建议包含：

- 当前进行中活动
- Banner 图片
- 最新审核通过投稿
- 精选投稿
- 快捷入口配置

### 5.2 用户投稿流程

```text
用户点击我要投稿
  -> 选择投稿类型
  -> 填写标题、介绍内容、分类标签
  -> 上传图片、音频、可选视频
  -> 平台调用投稿前安全检查
  -> 检查通过则写入投稿表，状态 pending_review
  -> 检查拒绝则返回违规提示，不保存为正式投稿
```

投稿要求：

| 字段 | 要求 |
|------|------|
| 投稿类型 | 必填，用语/诗歌/故事/标语/地名解说/歇后语 |
| 标题 | 必填 |
| 介绍内容 | 必填 |
| 分类标签 | 必填，由运营后台配置 |
| 图片 | 必填，最少 1 张，最多 9 张 |
| 语音 | 必填，时长不超过 1 分钟 |
| 视频 | 可选，时长不超过 30 秒 |

投稿前安全检查只检查文本和图片。音频、视频在后续 AI 审核或人工审核阶段处理。

### 5.2.1 投稿编辑规则

小程序端允许作者在有限窗口内编辑投稿，但不开放删除投稿。

活动投稿编辑规则：

```text
当前用户必须是作者
活动未截止
投稿未中奖
投稿未被后台锁定
截止日期前可编辑
截止日期后不可编辑
不能删除
```

普通投稿编辑规则：

```text
当前用户必须是作者
创建后 24 小时内可编辑
超过 24 小时不可编辑
不能删除
```

编辑成功后投稿需重新进入审核，避免已公开内容被修改后绕过审核：

```text
review_status = pending_review
visibility = private
```

小程序接口返回 `canEdit` 和 `editableUntil`，由后端统一计算编辑能力，前端不自行推导。

### 5.3 活动投稿流程

```text
用户进入活动列表
  -> 选择活动
  -> 查看规则、奖励、参与方式
  -> 按活动配置上传作品
  -> 作品进入投稿流程
  -> 投稿与活动绑定
```

活动配置决定作品允许的媒体类型：

- 图文
- 音频
- 视频
- 图文 + 音频
- 图文 + 视频

活动可分享。分享次数建议作为互动统计字段保存。

### 5.4 内容展示流程

```text
运营审核通过投稿
  -> 可设置精选或首页展示
  -> 小程序精选内容页展示
  -> 活动作品展示区展示
  -> 未来可沉淀到 Web 端荔湾文化知识库
```

展示区只展示审核通过的内容：

```text
review_status = approved
visibility = public
```

精选展示还需满足：

```text
is_featured = true
```

### 5.5 点赞与评论流程

```text
用户浏览作品
  -> 点赞/取消点赞
  -> 评论
  -> 评论进入审核或直接展示
```

建议第一阶段评论先进入待审核状态，避免公开展示风险。

### 5.6 个人中心流程

```text
用户进入个人中心
  -> 查看我的投稿
  -> 查看审核状态
  -> 查看我的活动
  -> 查看消息通知
```

我的投稿状态：

| 状态 | 说明 |
|------|------|
| `draft` | 草稿，P2 |
| `pending_review` | 等待审核 |
| `ai_reviewing` | AI 审核中 |
| `review_needed` | 需要人工复核 |
| `approved` | 已通过 |
| `rejected` | 已驳回 |

`review_status` 只表示审核状态，不包含中奖状态。中奖或奖励信息通过独立字段表达：

```text
is_awarded
award_status
award_info
```

精选展示通过独立字段表达：

```text
is_featured
show_on_home
```

---

## 六、后台业务流程

### 6.1 活动管理

```text
运营创建活动
  -> 填写主题、时间、规则、奖励、投稿媒体类型
  -> 可调用 AI 生成 Banner 候选
  -> 选择并上传 Banner 到 OSS
  -> 活动上线
```

活动状态：

| 状态 | 说明 |
|------|------|
| `draft` | 草稿 |
| `published` | 已上线 |
| `offline` | 已下线 |
| `archived` | 已归档 |

### 6.2 内容管理

```text
运营进入投稿列表
  -> 筛选待审核内容
  -> 可人工审核单条
  -> 可批量选择最多 100 条发起 AI 审核
  -> 查看 AI 审核结果
  -> 最终通过、驳回或要求复核
  -> 可设置精选和首页展示
```

人工审核动作：

| 动作 | 状态变化 |
|------|----------|
| 通过 | `approved` |
| 驳回 | `rejected`，必须填写原因 |
| 标记复核 | `review_needed` |
| 设为精选 | `is_featured = true` |
| 首页展示 | `show_on_home = true` |

### 6.3 批量 AI 审核

```text
运营选择一批投稿
  -> 平台创建 review batch
  -> 调用 agent /reviews/batches
  -> 投稿状态改为 ai_reviewing
  -> agent 每审完一条 webhook 回调
  -> 平台更新投稿 AI 审核结果
  -> 整批结束 webhook 回调
  -> 平台更新批次状态
```

批量限制：

- 每批最多 100 条
- 只允许 `pending_review` / `review_needed` 的投稿进入批量 AI 审核
- 同一投稿不应重复进入正在运行的批次

### 6.4 Banner 生成

```text
运营输入活动主题或精选内容提示词
  -> 平台调用 agent /covers/generations
  -> 返回 4 张临时封面候选
  -> 运营选择一张
  -> 平台下载并上传到项目 OSS
  -> 保存为活动 Banner 或内容 Banner
```

注意：agent 返回的是临时 URL，不能直接长期保存为正式封面。

### 6.5 数据看板

后台数据看板建议分阶段实现：

| 阶段 | 指标 |
|------|------|
| P1 | 投稿趋势、活动投稿数、分类占比、审核状态分布 |
| P1 | 活动参与人数、投稿数量、互动数据、分享次数 |
| P2 | DAU/MAU、投稿用户占比、奖励兑换 |

---

## 七、建议数据库模型

### 7.1 活动表 `corpus_collection_activities`

| 字段 | 说明 |
|------|------|
| `id` | 主键 |
| `title` | 活动标题 |
| `slug` | 活动短标识 |
| `description` | 活动介绍 |
| `rules` | 规则说明 |
| `category` | 活动分类 |
| `tags` | 活动标签 JSON |
| `submission_types` | 活动允许的投稿类型 JSON |
| `reward_config` | 奖励配置 JSON |
| `media_requirements` | 允许媒体类型与限制 JSON |
| `banner_url` | 正式 Banner URL |
| `status` | `draft` / `published` / `offline` / `archived` |
| `starts_at` / `ends_at` | 活动时间 |
| `created_by` | 创建人 |
| `created_at` / `updated_at` | 时间戳 |

### 7.2 分类表 `corpus_collection_categories`

| 字段 | 说明 |
|------|------|
| `id` | 主键 |
| `name` | 分类名称 |
| `type` | 分类类型，如投稿类型、标签 |
| `status` | 是否启用 |
| `sort_order` | 排序 |

### 7.3 投稿表 `corpus_collection_submissions`

| 字段 | 说明 |
|------|------|
| `id` | 主键 |
| `user_id` | 投稿用户 |
| `activity_id` | 关联活动，可为空 |
| `submission_type` | 用语/诗歌/故事/标语/地名解说/歇后语 |
| `title` | 标题 |
| `intro` | 介绍内容 |
| `tags` | 标签 JSON |
| `review_status` | 审核状态 |
| `precheck_result` | 投稿前安全检查结果 |
| `ai_review_result` | AI 审核结果 |
| `review_reason` | 驳回或复核原因 |
| `is_featured` | 是否精选 |
| `show_on_home` | 是否首页展示 |
| `visibility` | `private` / `public` |
| `like_count` / `comment_count` / `share_count` / `view_count` | 互动计数 |
| `is_awarded` | 是否中奖 |
| `award_status` | 中奖状态，默认 `none` |
| `award_info` | 中奖信息 JSON |
| `is_locked` | 是否被后台锁定，锁定后小程序不可编辑 |
| `created_at` / `updated_at` | 时间戳 |

### 7.4 媒体表 `corpus_collection_submission_media`

| 字段 | 说明 |
|------|------|
| `id` | 主键 |
| `submission_id` | 投稿 ID |
| `media_type` | `image` / `audio` / `video` |
| `url` | OSS URL |
| `duration_seconds` | 音视频时长 |
| `sort_order` | 排序 |
| `metadata` | 额外信息 JSON |

### 7.5 互动表

建议拆分：

- `corpus_collection_likes`
- `corpus_collection_comments`

评论字段需包含审核状态。

### 7.6 消息表 `corpus_collection_messages`

| 字段 | 说明 |
|------|------|
| `id` | 主键 |
| `user_id` | 接收用户 |
| `submission_id` | 关联作品，可为空 |
| `title` | 消息标题 |
| `content` | 消息内容 |
| `type` | `系统提示` / `活动通知` / `中奖信息` / `审核信息` |
| `is_read` | 是否已读 |
| `created_at` | 创建时间 |

### 7.7 AI 审核批次表

建议拆分：

- `corpus_collection_review_batches`
- `corpus_collection_review_events`

用于保存 agent batch ID、batchExternalId、状态、进度、webhook 事件去重。

---

## 八、审核与展示规则

### 8.1 投稿前安全检查

调用时机：用户提交投稿前。

检查内容：

- `title`
- `intro`
- `images`

处置规则：

| verdict | 动作 |
|---------|------|
| `pass` | 写入投稿，进入运营审核队列 |
| `reject` | 返回违规提示，不进入公开展示 |

### 8.2 AI 审核结果处置

agent 返回 `SubmissionResult.verdict`：

| verdict | 平台建议状态 |
|---------|--------------|
| `pass` | 可进入人工确认或直接 `approved`，建议第一阶段仍人工确认 |
| `reject` | 可标记 `rejected`，保留原因 |
| `review_needed` | 标记 `review_needed` |
| `null` | 标记 `review_needed` 或 `ai_failed` |

第一阶段建议：AI 只做辅助审核，最终公开展示仍由运营确认。

### 8.3 展示规则

公开展示必须满足：

```text
review_status = approved
visibility = public
```

首页精选展示额外要求：

```text
is_featured = true
show_on_home = true
```

活动作品区展示：

```text
activity_id = 当前活动
review_status = approved
visibility = public
```

---

## 九、接口文档

小程序端接口请参见：

- [`./api.md`](./api.md)

Web 后台设计请参见：

- [`./admin-design.md`](./admin-design.md)
