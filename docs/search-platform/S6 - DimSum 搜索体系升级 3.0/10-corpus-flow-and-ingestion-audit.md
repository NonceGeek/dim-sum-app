# 10 · 小程序、接口与后台语料流转及确认入库审计

状态：已按当前代码与 Production 数据完成核对
核对日期：2026-08-27
负责人：Fynn

## 一、最重要结论

当前系统不存在一条从“语料采集小程序投稿”自动或人工确认后进入 `cantonese_corpus_all` 的完整链路。

现在实际存在三套相互独立的流程：

1. **语料采集小程序**：投稿、AI 辅助审核、人工审核、公开展示；最终停留在 `corpus_collection_submissions`。
2. **Review App 标注小程序**：代理 Agent 任务的查看和提交；任务结果保存在 Agent 服务，当前仓库没有正式语料回写。
3. **旧语料新增/编辑审批**：通过外部 backend 的 `/dev/*` 接口写入 `cantonese_corpus_update_history`，管理员审批后才写入或更新 `cantonese_corpus_all`。

因此，当前后台显示“审核通过”只代表该投稿允许在语料征集小程序公开展示，不代表它已经成为 Search 可以检索的正式词条。

## 二、系统边界图

```text
语料采集小程序
  -> precheck
  -> corpus_collection_submissions
  -> AI 批次 / 人工审核
  -> approved + public
  -> 小程序公开作品流
  -X-> 当前没有正式入库步骤
  -X-> cantonese_corpus_all

Review App
  -> DimSum 代理 API
  -> Agent /tasks
  -> 标注员完成任务
  -> Agent 保存结果
  -X-> 当前仓库没有正式分类/正文回写

旧语料新增或编辑
  -> backend /dev/insert_corpus_item 或 /dev/update_corpus_item
  -> cantonese_corpus_update_history(PENDING)
  -> backend /dev/approve_corpus_item
  -> cantonese_corpus_all 新增/更新
  -> history APPROVED
```

## 三、流程 A：语料采集小程序

### 3.1 进入投稿

活动启用问卷门禁时，用户需要先完成问卷旅程。无活动的普通投稿在当前服务代码中也要求有效问卷旅程。

涉及表：

- `corpus_collection_questionnaire_profiles`
- `corpus_collection_questionnaire_journeys`
- `corpus_collection_questionnaire_events`

问卷完成只证明用户具备进入投稿流程的条件，不代表内容审核或语料入库。

### 3.2 投稿前检查

小程序调用：

```text
POST /api/miniprogram/corpus_collection/submissions/precheck
```

平台转调 Agent：

```text
POST {AGENT_API_BASE_URL}/precheck/submissions
```

检查范围：

- 标题；
- 介绍；
- 图片；
- 不检查音频和视频。

当前风险：正式投稿 API 只保存前端传来的 `precheckResult`，并不在服务端验证它确实由 Agent 生成且结果为 `pass`。客户端可以绕过 precheck 直接投稿。

### 3.3 正式投稿

小程序调用：

```text
POST /api/miniprogram/corpus_collection/submissions
```

服务端事务写入：

```text
corpus_collection_submissions
corpus_collection_submission_media
questionnaire journey/event（适用时）
```

初始状态固定为：

```text
review_status = pending_review
visibility = private
```

投稿表没有以下任何字段：

```text
corpus_id
entry_id
corpus_unique_id
ingestion_status
ingested_at
```

所以数据库层也没有办法追踪某条投稿后来是否进入正式语料。

### 3.4 AI 批量审核

后台在投稿列表选择最多 100 条：

```text
POST /api/admin/corpus-collection/review-batches
```

只允许以下状态进入 AI 批次：

```text
pending_review
review_needed
```

流程：

```text
读取投稿及媒体
  -> 调用 Agent POST /reviews/batches
  -> 创建 corpus_collection_review_batches
  -> 创建 corpus_collection_review_batch_items
  -> 投稿状态改为 ai_reviewing
  -> Agent webhook 回调
  -> 保存 corpus_collection_review_events
  -> 保存 ai_review_result
```

当前实现有意把 Agent 的所有 verdict 都映射为：

```text
review_needed
```

即：

```text
pass          -> review_needed
reject        -> review_needed
review_needed -> review_needed
```

因此 Agent 只能提供辅助判断，不能直接批准或拒绝投稿，最终决定必须由管理员完成。

### 3.5 人工审核

后台页面：

```text
/{locale}/admin/corpus-collection/submissions
```

操作接口：

| 动作 | 接口 | 数据结果 |
|---|---|---|
| 通过 | `POST .../{id}/approve` | `approved + public` |
| 驳回 | `POST .../{id}/reject` | `rejected + private` |
| 要求复核 | `POST .../{id}/mark-review-needed` | `review_needed` |
| 精选/首页/可见性 | `PATCH .../{id}/display` | 修改展示字段 |

审核通过事务只执行：

1. 更新 `corpus_collection_submissions`；
2. 写入一条用户通知 `corpus_collection_messages`。

它不会执行：

- 创建 `cantonese_corpus_all`；
- 创建 `cantonese_corpus_update_history`；
- 生成正式 `unique_id`；
- 写入内容属性、正式分类、权利状态或训练权限；
- 建立标签、向量或邻居数据。

### 3.6 公开展示

小程序公开作品统一使用：

```text
review_status = approved
visibility = public
```

这套公开范围只服务 `corpus_collection_submissions`，与 Search 的 `cantonese_corpus_all` 是两个业务域。

## 四、Production 投稿审核现状

### 4.1 投稿数据

| review_status | visibility | 数量 |
|---|---|---:|
| approved | public | 8 |
| pending_review | private | 84 |
| rejected | private | 1 |
| review_needed | private | 1 |
| review_needed | public | 1 |

合计：95 条。

其中：

- 14 条有 `reviewed_at`；
- 8 条人工审核通过并公开；
- 0 条有 `ai_review_result`；
- AI review batch 和 webhook event 当前均为 0。

### 4.2 已发现的数据一致性问题

Production 存在 1 条：

```text
review_status = review_needed
visibility = public
```

代码原因是 `mark-review-needed` 只更新审核状态，没有同步把 `visibility` 改回 `private`。从已批准投稿重新标记复核时，会继续公开。

此外：

- `display` 接口允许独立修改 `visibility/is_featured/show_on_home`，没有校验必须先 `approved`；
- approve/reject 接口没有校验允许的前置状态，也没有乐观锁；
- 人工审核没有独立的 append-only 审核事件表，只有当前状态、审核人和时间；
- 投稿与正式语料之间没有关联字段。

## 五、流程 B：Review App 标注小程序

### 5.1 当前职责

Review App 使用：

```text
/api/miniprogram/task/*
```

Web 标注页面还存在一套相似代理：

```text
/api/data-annotation/tasks/*
```

两套接口最终都调用 `main/lib/services/agent.ts`，代理到：

```text
GET  /tasks
GET  /tasks/{id}
POST /tasks/{id}/view
POST /tasks/{id}/complete
POST /tasks/{id}/skip-and-reassign
GET  /tasks/stats
```

### 5.2 数据归属

平台负责：

- 登录和角色权限；
- 补充 `actorRef`；
- 参数校验；
- 转发 Agent 请求；
- 错误转换。

Agent 服务负责：

- 创建任务；
- 分配任务；
- 维护任务状态；
- 保存完成结果；
- 任务统计。

当前 `complete` 接口只把标注员选择提交给 Agent，没有本地事务，也没有更新：

- `corpus_category`；
- `cantonese_corpus_all`；
- `cantonese_corpus_update_history`；
- 本地审核事件表。

因此 Review App 当前是任务 UI 和代理层，不是正式入库确认服务。Agent 是否在其服务内部直接改库不属于当前仓库可验证范围，不应把这种外部行为作为 S6 的隐含前提。

## 六、流程 C：旧语料新增与编辑审批

### 6.1 外部 backend 的标准流程

现有公开 API 文档定义：

```text
POST /dev/insert_corpus_item
  -> cantonese_corpus_update_history(CREATE, PENDING)

POST /dev/update_corpus_item
  -> cantonese_corpus_update_history(UPDATE, PENDING)

POST /dev/approve_corpus_item
  -> CREATE 时插入 cantonese_corpus_all
  -> UPDATE 时更新 cantonese_corpus_all
  -> history.status = APPROVED
```

这是目前唯一有明确文档证明“审批后进入正式主表”的流程，但审批实现位于 `backend.aidimsum.com` 对应的外部服务，不在当前 Next 仓库。

### 6.2 当前 Next 中的编辑入口

`/api/marker/corpus/update`：

```text
校验用户和来源写权限
  -> 携带服务端 API Key
  -> backend /dev/insert_corpus_item
```

尽管路由名叫 update，当前实际调用路径是 `/dev/insert_corpus_item`，而且请求只传 `uuid/note/api_key`。这与外部 API 文档要求的新增字段不一致，需要单独复核外部 backend 的真实兼容行为。

### 6.3 当前 Next 的本地新增入口

`/api/data-annotation/create` 和 `/batch-create` 会直接创建：

```text
cantonese_corpus_update_history
status = PENDING
operation_type = CREATE
```

但当前代码没有把已解析的 `data` 和 `category` 写入 history 记录。Production 证据：

| operation_type | status | 数量 | 有 data | 有 category |
|---|---|---:|---:|---:|
| CREATE | APPROVED | 1 | 1 | 1 |
| CREATE | PENDING | 7 | 2 | 2 |
| UPDATE | APPROVED | 6,270 | 4,098 | 1 |
| UPDATE | PENDING | 439 | 379 | 0 |

7 条待审批 CREATE 中只有 2 条有完整 `data/category`。其余记录无法按标准 CREATE 审批入主表。这与本地新增 API 漏写字段的代码现状一致。

当前 `/admin/corpus` 页面只读取正式主表，没有 history 审批列表和批准按钮；Next 仓库中也没有 `/dev/approve_corpus_item` 的管理员代理页面。

## 七、“审核通过”和“正式入库”必须分开

建议明确三个概念：

| 概念 | 含义 | 当前落点 |
|---|---|---|
| 投稿审核通过 | 内容允许在征集小程序公开展示 | `corpus_collection_submissions.approved/public` |
| 入库候选确认 | 内容达到正式语料建模要求，允许生成词条 | 当前不存在 |
| 正式入库 | 已创建 `cantonese_corpus_all.unique_id`，可进入分类、标签、向量和搜索流程 | 旧 `/dev/approve_corpus_item` |

不建议把所有 `approved` 投稿自动入库。征集作品可能是一篇故事、一段视频或一组图片，而正式 Search Entry 可能需要拆成多个条目、转写、派生口语版或文化知识版。

## 八、建议的 S6 目标入库链路

```text
用户投稿
  -> 投稿前安全检查
  -> pending_review/private
  -> Agent 辅助审核
  -> 人工决定 approved/rejected
  -> approved/public（只表示征集作品可展示）
  -> 创建 ingestion candidate
  -> Fynn 入库服务完成结构化、来源和权利校验
  -> Agent 提供属性/分类/标签建议
  -> 必要时推送 AW 标注小程序确认
  -> Fynn 服务事务写入正式语料
  -> 生成 unique_id
  -> 写正式分类/标签/媒体/溯源关系
  -> 按未来确认的正式可检索规则完成发布/可检索确认
  -> 进入向量与邻居增量任务
  -> Search 可检索
```

### 8.1 建议新增入库关联表

建议使用独立的 `corpus_collection_ingestions`，而不是直接给投稿增加大量正式语料字段：

```text
id
submission_id                unique FK
status                       candidate / preparing / pending_confirmation /
                             ingested / rejected / failed
target_corpus_id             nullable FK -> cantonese_corpus_all.id
target_entry_id              nullable uuid -> cantonese_corpus_all.unique_id
mapping_snapshot             jsonb
validation_result            jsonb
idempotency_key              unique
created_by
confirmed_by
created_at
confirmed_at
ingested_at
failure_reason
```

如果一个投稿允许拆成多个正式词条，则不要约束 `submission_id` 唯一，改为：

```text
unique(submission_id, entry_sequence)
```

### 8.2 正式写入必须由 Fynn 服务完成

Agent 和 AW 都只提交建议或确认结果，不应直接写正式表。Fynn 入库事务负责：

1. 校验投稿仍为 `approved`；
2. 校验来源、内容属性、权利、训练权限和媒体；
3. 生成或复用 idempotency key；
4. 创建 `cantonese_corpus_all`；
5. 写入 provenance、derivation、media、分类和标签关系；
6. 回写 `target_corpus_id/target_entry_id`；
7. 写审核与入库事件；
8. 触发向量和邻居增量任务。

## 九、建议立即修复与后续设计

### P0：在 S6 入库开发前修复

1. `mark-review-needed` 同时设置 `visibility=private`。
2. `display` 禁止非 approved 投稿设置为 public/featured/home。
3. approve/reject 增加允许状态校验和幂等处理。
4. 修复 `/api/data-annotation/create` 和 `/batch-create` 漏写 `data/category/tags`。
5. 为人工投稿审核增加 append-only 事件或审计记录。

### P1：建立正式入库闭环

1. 新增投稿到正式语料的 ingestion 关联。
2. 后台增加“建立入库候选/确认入库/查看目标词条”。
3. 明确一投稿一词条还是一投稿多词条。
4. 将 Agent 建议和 AW 人工确认统一回到 Fynn 入库服务。
5. 入库成功后触发分类、标签、向量和邻居增量处理。

## 十、最终判断

当前系统已经具备：

- 投稿采集；
- 多媒体保存；
- Agent 前置检查接口；
- Agent 批量审核接口和 webhook 框架；
- 后台人工通过、驳回和公开展示；
- 旧语料审批入主表机制；
- 正式语料搜索基础设施。

当前系统尚不具备：

- 投稿审核到正式语料的转换服务；
- 投稿与正式 Entry 的可追踪关联；
- Review App 结果的本地可信回写；
- S6 内容属性、权利和发布状态校验；
- 一个可由 Fynn 控制、可审计、幂等的统一确认入库事务。

所以 S6 的正确起点不是直接让小程序 `approved` 后自动出现在搜索中，而是先补齐“入库候选 -> 人工/Agent 确认 -> Fynn 正式写入”的中间层。
