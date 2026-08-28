# 02 · S6 精简数据模型与迁移方案

状态：Production schema、媒体回填、内容属性标记和现有 Search API 兼容实现均已上线并验证
范围依据：[00a-requirement-implementation-traceability.md](00a-requirement-implementation-traceability.md)

## 一、设计结论

S6 本期不建立新的 Entry 主表，不建立第二套来源、任务、审核、媒体或分享系统。

当前可立即评审的数据库变化只有：

```text
cantonese_corpus_all.content_attribute
cantonese_corpus_all.media_types
```

Agent 二级分类本期仍需实现，但其本地状态表必须等 Agent 接口和数据归属确认后单独设计，不提前写入 migration。

## 二、现有能力直接复用

| S6 概念 | 当前实现 |
|---|---|
| Entry 主键 | `cantonese_corpus_all.id` |
| 对外 Entry ID | `cantonese_corpus_all.unique_id` |
| 展示名称/正文 | `data` |
| 粤拼、释义、媒体 | `structured_note`，兼容 `note` |
| 来源语料集 | `category -> cantonese_categories.name` |
| 来源展示名 | `cantonese_categories.nickname` |
| 来源公开性 | `cantonese_categories.is_public` |
| 数据加工状态 | `lifecycle_stage` |
| 一级/二级分类 | `content_categories + corpus_category` |
| 标签 | `tags + corpus_tags + tag_related` |
| 贡献者 | `cantonese_corpus_update_history + User` |
| 分享身份 | `unique_id` 和现有 card/SEO 链路 |
| Agent/标注任务 | 外部 Agent `/tasks` + DimSum 代理 API |

## 三、本期新增字段

### 3.1 `content_attribute`

```text
unclassified          存量迁移态
oral                  口语语料
cultural_knowledge    文化知识
```

用途只有一个：支持现有 Search API 在请求明确传属性时统一限制三段结果。

规则：

- 默认请求不按该字段过滤；
- 显式属性过滤不允许 `unclassified` 或另一属性补位；
- 新内容可以在草稿/加工期暂为 `unclassified`；
- 正式整理完成前必须成为 oral/cultural_knowledge；
- 存量无法判断内容先导出，不自动猜测。

### 3.2 `media_types`

```text
text / audio / video / image / model3d
```

这是从 `data/structured_note/note` 派生的可索引多值缓存，用于方案 B 的二级相关结果筛选。Production 已存在 `{text,audio,model3d}` 的帆船语料，证明多媒体必须共存。完整统计见 [00b-production-media-data-analysis-and-design.md](00b-production-media-data-analysis-and-design.md)。

不能用现有 `tags.facet=media` 替代：Production 有 21,186 条语料包含 audio block，但只有 5,627 条挂载 `media-audio` 标签；其他 media 标签还包含“动画、电视剧、txt”等不等同于资源形态的语义。

规则：

- 至少包含一个值；
- 普通正文默认包含 `text`；
- 有音频、视频、图片或 3D 模型的有效资源时增加对应值；
- 资源详情继续从现有 JSON 读取；
- 本期不新建 `corpus_media_assets`；
- 由数据库统一派生函数和 trigger 在 `data/note/structured_note` 变化时刷新，应用入口不得手工维护；
- 只有非空 URL/link 才计入对应媒体，空 `video_clips` 或空 link 不计入；
- `mediaType=text` 表示纯文本，即数组只有 `text`，其他类型使用数组包含判断；
- 存储、DTO 和前端筛选均支持 `model3d`；搜索结果与词条详情提供模型资源入口，内嵌 3D Viewer 留待独立交互评审。

## 四、现有状态字段观察与本期口径

本期不新增 `review_status/publication_status/rights_status`。

Production 已有 `lifecycle_stage` 和来源 `is_public`，但当前 Search 没有统一使用二者过滤，PRD 也没有确认二者组合就是公开范围。本期只记录这一观察，不把它变成新的 Search 门槛。

S6 默认请求沿用改造前 Search 的检索范围；只有请求明确提供 `contentAttribute` 时，才在三段召回中额外增加属性条件。

若后续需要条目级权利限制，必须先定义权利确认人、写入入口、状态变化和数据消费方，再单独增加治理字段。

## 五、搜索过滤口径

### 5.1 默认搜索

```text
现有 Search 检索范围
+ 现有精准/相关/推荐排序
+ 不增加 content_attribute 条件
```

### 5.2 显式内容属性过滤

```text
现有 Search 检索范围
+ content_attribute = oral 或 cultural_knowledge
+ 精准、相关、推荐三段统一应用
```

### 5.3 媒体筛选方案 B

```text
只对二级相关结果增加媒体条件：
text -> media_types = {text}
audio/video/image/model3d -> media_types 包含请求值
```

一级精准结果和三级推荐结果不受媒体筛选影响。

## 六、Agent 二级分类

继续复用正式分类表：

```text
corpus_category = 已确认、允许公开使用的当前分类
```

Agent 待抽检或待审核建议不得提前写入 `corpus_category`。

当前已有外部 Agent task 服务，因此本期不创建平行的：

- `corpus_agent_runs`；
- `corpus_review_tasks`；
- `corpus_review_events`；
- `s6_outbox_events`。

Agent 契约确认后，如 DimSum 必须保存本地可信建议状态，单独评审一张 `corpus_category_review_state`。表中只保存当前业务状态和最终回写所需字段，调用日志和任务分配继续由 Agent 服务负责。

## 七、不进入本期 migration 的字段与表

### 字段

```text
original_text
source_corpus_id
source_location
rights_status
train_permission
review_status
parent_entry_id
derived_content_type
generation_method
contributor_display_name
contributor_public
published_at
```

### 表

```text
source_corpus_profiles
corpus_classification_workflows
corpus_agent_runs
corpus_media_assets
corpus_review_tasks
corpus_review_events
corpus_share_events
s6_outbox_events
```

这些项目如在后续治理、派生内容、批量视频入库或跨系统可靠消息中出现真实消费方，再按独立需求评审。

## 八、迁移步骤

### Phase 1：Expand

1. 连接目标环境执行 `prisma db pull`，以线上真实结构更新 `schema.prisma`。
2. 审查 pull diff，确认没有覆盖未知线上字段或关系。
3. 在最新 schema 上添加两个字段并审查 push 将产生的结构变化。
4. 执行 `prisma db push`；禁止跳过 pull 直接 push。
5. Prisma 无法表达的检查约束、派生函数和 trigger 使用独立 SQL 补充执行；约束先 `NOT VALID`。
6. 建立内容属性普通索引和媒体 GIN 索引。
7. 不改变旧 Search API 行为，不为此次向后兼容更新增加功能开关。

### Phase 2：Backfill

1. `media_types` 根据现有 `structured_note/note` 确定性回填。
2. `content_attribute` 先使用经确认的来源级规则。
3. 混合来源使用确定性条目规则。
4. 剩余 `unclassified` 导出供确认。

### Phase 3：Production 验证

1. 现有 Search API 接收可选属性参数。
2. 直接在 Production 使用固定测试请求验证默认、显式属性和媒体过滤结果。
3. 验证显式属性请求三段一致率 100%。
4. 验证媒体筛选只影响二级相关结果。
5. 默认未传新参数的请求继续保持旧搜索行为。

### Phase 4：Enable

1. 完成线上验证后由调用方正式使用现有 Search API 的 S6 增量能力，无需切换功能开关。
2. 本期前端不展示属性选择器。
3. 记录过滤命中、空结果和降级指标。

## 九、验收条件

```text
默认请求未增加内容属性过滤
显式 oral 请求三段只返回 oral
显式 cultural_knowledge 请求三段只返回 cultural_knowledge
显式属性请求不返回 unclassified
媒体筛选只改变二级相关结果
默认未过滤请求与改造前 Search 的结果范围保持兼容
media_types 与结构化媒体的一致率达到 100%
现有 unique_id、分类、标签、详情和分享链路不被破坏
```

## 十、独立于本期 Search 的入库问题

语料征集投稿审核通过后尚未进入正式语料，详见：

[10-corpus-flow-and-ingestion-audit.md](10-corpus-flow-and-ingestion-audit.md)

该问题需要独立的 ingestion 业务确认，不能因为搜索原型出现投稿或审核页面，就自动纳入 S6 数据库 migration。
