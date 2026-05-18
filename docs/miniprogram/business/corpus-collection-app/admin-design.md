# 语料采集 Web 管理后台设计

## 一、后台位置建议

语料采集后台建议放在现有管理后台中：

```text
app/[locale]/admin/corpus-collection
```

后台 API 建议放在：

```text
app/api/admin/corpus-collection
```

原因：

- 现有项目已有 `/admin` layout、导航、系统管理员鉴权和用户管理
- 语料采集后台与活动管理、内容审核、用户管理、数据统计强相关
- 避免新建独立后台导致权限、导航、组件和 API 风格重复

公开展示页可在后续另建，例如 `/library/liwan` 或 `/corpus-collection`，但运营后台不建议脱离 `/admin`。

---

## 二、后台导航结构

建议在 `/admin` 导航中新增一级入口：

```text
语料采集
```

子页面：

```text
/admin/corpus-collection
/admin/corpus-collection/submissions
/admin/corpus-collection/activities
/admin/corpus-collection/categories
/admin/corpus-collection/review-batches
/admin/corpus-collection/analytics
```

### 2.1 页面说明

| 页面 | 说明 | 优先级 |
|------|------|--------|
| 总览 | 投稿、活动、审核、互动核心指标 | P1 |
| 投稿管理 | 投稿列表、审核、精选、首页展示 | P1 |
| 活动管理 | 创建、编辑、上线、下线活动 | P0 |
| 分类标签 | 管理投稿类型和标签 | P1 |
| AI 审核批次 | 查看批量 AI 审核进度和结果 | P1 |
| 数据看板 | 趋势、分类、用户活跃度 | P1/P2 |

---

## 三、权限设计

第一阶段建议复用系统管理员权限：

```text
isSystemAdmin = true
```

后续可扩展为细粒度权限：

| 角色 | 权限 |
|------|------|
| 内容审核员 | 投稿审核、查看 AI 审核结果、设置精选 |
| 活动运营 | 活动配置、分类管理、Banner 生成、数据统计 |
| 超级管理员 | 全部权限、权限分配、系统设置 |

可选实现方式：

- 扩展 `Role`
- 新增后台权限表
- 复用现有 `user_corpus_permissions` 的权限思想，新增业务域权限

---

## 四、后台页面设计

### 4.1 总览页

路径：

```text
/admin/corpus-collection
```

展示内容：

- 今日投稿数
- 待审核投稿数
- AI 审核中投稿数
- 已通过投稿数
- 当前进行中活动数
- 互动总量：点赞、评论、分享
- 近 7/30 天投稿趋势

### 4.2 投稿管理

路径：

```text
/admin/corpus-collection/submissions
```

列表筛选：

- 活动
- 投稿类型
- 分类标签
- 审核状态
- 是否精选
- 是否首页展示
- 投稿用户
- 时间范围
- 关键词

列表字段：

| 字段 | 说明 |
|------|------|
| 标题 | 投稿标题 |
| 类型 | 用语/诗歌/故事等 |
| 活动 | 关联活动 |
| 用户 | 投稿人 |
| 媒体 | 图片/音频/视频标记 |
| 审核状态 | pending/ai_reviewing/approved/rejected 等 |
| AI 结论 | pass/reject/review_needed |
| 互动 | 点赞、评论、分享 |
| 展示 | 精选、首页展示 |
| 时间 | 投稿时间 |

操作：

- 查看详情
- 人工通过
- 人工驳回，必须填写原因
- 标记复核
- 设为精选
- 设置首页展示
- 批量发起 AI 审核

### 4.3 投稿详情

展示：

- 标题、介绍、标签、活动
- 图片、音频、视频
- 投稿用户信息
- 投稿前安全检查结果
- AI 审核结果
- 音频转写、视频描述、图片 OCR/理解
- 审核日志
- 互动数据

审核操作：

- 通过
- 驳回
- 复核
- 精选
- 首页展示

### 4.4 活动管理

路径：

```text
/admin/corpus-collection/activities
```

功能：

- 创建活动
- 编辑活动
- 上线/下线
- 配置活动时间
- 配置规则说明
- 配置奖励机制
- 配置允许作品类型
- 生成活动 Banner
- 查看活动作品
- 评选优秀作品

活动表单字段：

| 字段 | 说明 |
|------|------|
| 活动标题 | 必填 |
| 活动介绍 | 必填 |
| 活动规则 | 必填 |
| 奖励配置 | 可选 |
| 开始/结束时间 | 必填 |
| 允许媒体类型 | 图片/音频/视频配置 |
| Banner | 可上传或 AI 生成 |
| 状态 | draft/published/offline/archived |

### 4.5 分类标签管理

路径：

```text
/admin/corpus-collection/categories
```

功能：

- 新增分类标签
- 编辑分类标签
- 启用/停用
- 排序

分类建议：

- 用语
- 诗歌
- 故事
- 标语
- 地名解说
- 歇后语
- 荔湾地名
- 童谣
- 饮食
- 非遗

### 4.6 AI 审核批次

路径：

```text
/admin/corpus-collection/review-batches
```

功能：

- 查看批次列表
- 查看批次状态
- 查看 queued / processing / completed / failed / partial 数量
- 查看批次内投稿明细
- 重试失败项，P2

批次状态：

| 状态 | 说明 |
|------|------|
| `queued` | 已排队 |
| `running` | 运行中 |
| `completed` | 已完成 |
| `failed` | 失败 |
| `cancelled` | 已取消 |

### 4.7 数据看板

路径：

```text
/admin/corpus-collection/analytics
```

P1 指标：

- 投稿趋势，按日/周/月
- 分类统计
- 活动投稿数量
- 审核状态分布
- 精选内容数量
- 互动数据

P2 指标：

- DAU/MAU
- 投稿用户占比
- 用户贡献排行
- 奖励兑换情况

---

## 五、后台 API 设计

### 5.1 活动管理

```text
GET    /api/admin/corpus-collection/activities
POST   /api/admin/corpus-collection/activities
GET    /api/admin/corpus-collection/activities/{id}
PATCH  /api/admin/corpus-collection/activities/{id}
POST   /api/admin/corpus-collection/activities/{id}/publish
POST   /api/admin/corpus-collection/activities/{id}/offline
```

### 5.2 投稿管理

```text
GET    /api/admin/corpus-collection/submissions
GET    /api/admin/corpus-collection/submissions/{id}
POST   /api/admin/corpus-collection/submissions/{id}/approve
POST   /api/admin/corpus-collection/submissions/{id}/reject
POST   /api/admin/corpus-collection/submissions/{id}/mark-review-needed
PATCH  /api/admin/corpus-collection/submissions/{id}/display
PATCH  /api/admin/corpus-collection/submissions/{id}/award
```

审核通过和驳回会同步写入用户端消息表，供小程序 `/api/miniprogram/corpus_collection/message` 读取。

### 5.2.1 评论审核

```text
GET    /api/admin/corpus-collection/comments
POST   /api/admin/corpus-collection/comments/{id}/approve
POST   /api/admin/corpus-collection/comments/{id}/reject
```

评论通过或驳回后会重新计算作品 `comment_count`。

### 5.3 批量 AI 审核

```text
POST   /api/admin/corpus-collection/review-batches
GET    /api/admin/corpus-collection/review-batches
GET    /api/admin/corpus-collection/review-batches/{id}
GET    /api/admin/corpus-collection/review-batches/{id}/submissions
POST   /api/admin/corpus-collection/webhooks/reviews
```

`webhooks/reviews` 用于接收 agent webhook，鉴权使用独立 `WEBHOOK_TOKEN`。

### 5.4 分类标签

```text
GET    /api/admin/corpus-collection/categories
POST   /api/admin/corpus-collection/categories
PATCH  /api/admin/corpus-collection/categories/{id}
DELETE /api/admin/corpus-collection/categories/{id}
```

### 5.5 Banner 生成

```text
POST   /api/admin/corpus-collection/covers/generate
POST   /api/admin/corpus-collection/covers/select
```

说明：

- `generate` 调用 agent 返回临时候选图
- `select` 将选中的临时图转存到项目 OSS，并绑定到活动或精选内容

### 5.6 数据统计

```text
GET /api/admin/corpus-collection/analytics/summary
GET /api/admin/corpus-collection/analytics/submission-trends
GET /api/admin/corpus-collection/analytics/category-breakdown
GET /api/admin/corpus-collection/analytics/activity/{id}
```

---

## 六、与 agent 的集成

### 6.1 投稿前安全检查

后台接口：

```text
POST /api/miniprogram/corpus_collection/submissions/precheck
```

转调 agent：

```text
POST /precheck/submissions
```

### 6.2 批量 AI 审核

后台接口：

```text
POST /api/admin/corpus-collection/review-batches
```

转调 agent：

```text
POST /reviews/batches
```

平台传给 agent 的 `callbackUrl`：

```text
https://search.aidimsum.com/api/admin/corpus-collection/webhooks/reviews
```

### 6.3 活动封面生成

后台接口：

```text
POST /api/admin/corpus-collection/covers/generate
```

转调 agent：

```text
POST /covers/generations
```

---

## 七、实现优先级建议

### P0

- 活动管理：创建、编辑、上线、下线
- 小程序活动列表和详情
- 小程序投稿创建
- 投稿前安全检查
- 我的投稿
- 后台投稿列表和人工审核

### P1

- 批量 AI 审核
- webhook 接收
- 分类标签管理
- 精选内容
- 首页展示
- 活动作品展示区
- 点赞、评论
- 数据统计基础版
- AI 生成 Banner

### P2

- 草稿箱
- 排行榜
- 奖励积分
- 消息通知已读、批量推送与模板订阅
- 用户管理细粒度权限
- Web 端荔湾文化知识库和搜索
