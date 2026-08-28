# 00 · Production 数据库现状分析

状态：已完成只读核对
核对日期：2026-08-27
负责人：Fynn
用途：记录 S6 设计前的真实数据库基线，避免仅依据历史文档或 Prisma 草案判断。

> 范围说明：本文保留 Production 证据；字段和表的最终本期裁决以随后完成的 [00a-requirement-implementation-traceability.md](00a-requirement-implementation-traceability.md) 和精简后的 02/02a 为准。

## 一、结论

当前 Production 已具备 Search P0 的主要数据基础：统一语料主表、来源语料集、两级内容分类、标签、字段向量和离线邻居表均已落地。S6 应继续扩展 `cantonese_corpus_all` 业务域，不应重建独立 Entry 主表。

当前 S6 DDL 仍不能直接执行，主要原因是：

1. `source_corpus_profiles` 与现有 `cantonese_categories` 重复。
2. `review_status` 与现有 `lifecycle_stage` 的职责尚未正确拆分。
3. 来源、贡献者、派生关系和溯源信息被过多堆入主表。
4. Agent、标注和分享相关表仍依赖外部接口最终设计。
5. 语料征集投稿与正式搜索语料之间没有入库关联或状态链。

## 二、核对范围与方法

本次使用以下证据交叉核对：

- Production PostgreSQL 只读结构 introspection；
- Production 表数量、状态和覆盖率只读统计；
- `main/prisma/schema.prisma`；
- 已执行的 Search P0 与邻居表 migrations；
- `docs/search-platform/entry-identity-search` 的历史设计和实施记录；
- 当前 Search API、语料征集 API、Review App API 和 Admin 页面代码。

本次没有执行写入、迁移或数据导出，也没有读取或落盘存量正文。

## 三、核心数据基线

### 3.1 正式语料与结构化数据

| 指标 | Production 数量 |
|---|---:|
| `cantonese_corpus_all` 总数 | 50,994 |
| 有 `structured_note` | 31,162 |
| 实际使用的来源 `category` | 29 |
| `lifecycle_stage=normalized` | 31,172 |
| `lifecycle_stage=draft` | 19,822 |

`structured_note` 当前统一顶层键为 `data`，其值为数组；数组元素主要包含：

```text
structured_note.data[]
  ├─ blocks
  └─ jyutping
```

媒体 block、新旧 `note` 重叠和多媒体组合的专项只读统计见 [00b-production-media-data-analysis-and-design.md](00b-production-media-data-analysis-and-design.md)。

旧 `note` 的主要键为：

| 键 | 包含该键的语料数 |
|---|---:|
| `context` | 50,993 |
| `contributor` | 50,741 |

因此原文、贡献者和媒体不能在未定义迁移优先级前直接从旧 JSON 删除。

### 3.2 内容分类与标签

| 指标 | Production 数量 |
|---|---:|
| 一级内容分类 | 6 |
| 二级内容分类 | 59 |
| 已建立 `corpus_category` 的语料 | 31,291 |
| 正式分类覆盖率 | 约 61.4% |
| 标签 | 117 |
| `corpus_tags` 关系 | 43,998 |

当前 `corpus_category.source` 全部为 `rule`：

```text
rule = 31,291
manual = 0
import = 0
```

这意味着数据库已有正式分类结果，但没有足够数据证明这些结果经过人工确认。S6 不能把当前 `source=rule` 自动解释成 `reviewer_confirmed`。

### 3.3 向量与 Production 邻居表

| 指标 | Production 数量/状态 |
|---|---:|
| `corpus_field_embeddings` | 78,889 |
| 有向量的语料 | 23,405 |
| active neighbor field | `doc` |
| active build source | 23,405 |
| active 邻居关系 | 748,960 |
| active build 状态 | `active` |

数据库 active build 已正常激活。历史文档中“Production 邻居开关待开启”的描述已过时；应用仍保留 `SEARCH_OFFLINE_NEIGHBORS_ENABLED` feature flag，Production 是否读取邻居还同时依赖部署环境配置。产品已确认该开关已启用。

## 四、现有核心表的真实职责

| 表 | 当前真实职责 | S6 处理原则 |
|---|---|---|
| `cantonese_corpus_all` | 正式、可被搜索消费的语料主表 | 继续作为 Entry 主实体 |
| `cantonese_categories` | 来源语料集配置，`name` 被主表 `category` 引用 | 直接扩展来源治理字段 |
| `content_categories` | 一级/二级内容分类字典 | 继续复用 |
| `corpus_category` | 一条语料一个当前正式分类 | 只保存已确认正式结果 |
| `tags` / `corpus_tags` / `tag_related` | 标签字典、挂载关系和标签关联 | 继续复用 |
| `corpus_field_embeddings` | 字段级向量 | 继续复用 |
| `corpus_embedding_neighbor_*` | 离线邻居 build、关系和 active 状态 | 继续复用 |
| `cantonese_corpus_update_history` | 旧语料新增/修改审批历史和贡献来源 | 保留；需与新入库服务统一边界 |
| `corpus_collection_submissions` | 小程序投稿及其公开展示状态 | 不是正式搜索语料主表 |

## 五、状态字段分析

### 5.1 `lifecycle_stage` 不能直接等同发布状态

Production 交叉分布：

| lifecycle_stage | 来源公开 | 数量 |
|---|---:|---:|
| draft | false | 19,691 |
| draft | true | 131 |
| normalized | false | 11 |
| normalized | true | 31,161 |

它与公开性高度相关，但并非严格等价。当前值也只有 `draft/normalized`，更接近数据加工阶段。

原分析曾考虑新增独立发布状态。经过需求追踪复核，本期没有独立发布状态的写入方和消费方，因此不新增 `review_status/publication_status`，也不废弃 `lifecycle_stage`。

### 5.2 可供后续决策的公开范围观察

`lifecycle_stage=normalized + 来源 is_public=true` 不是 PRD 的明确要求，而是根据现有字段提出的一种技术候选规则。当前 Search 并未统一应用该组合，因此本期不能直接把它写成硬过滤。

如果对全量 50,994 条数据机械应用该组合，只剩 31,161 条满足条件；19,822 条 draft 和 11 条 normalized/非公开会被排除。实际对用户查询结果的影响还必须通过影子查询测量，不能只凭全表数量决定。

这里还存在两个语义问题：

- `lifecycle_stage` 表示加工阶段的可能性更高，未证实等同于发布审批。
- `is_public` 位于来源表，只能表达整个来源的属性，不能处理单条语料例外。

后续可独立评估四种方案：保持现状、仅按来源过滤、按加工状态与来源共同过滤、增加条目级发布/权利策略。决策前需要产品确认、权限责任人和影子查询数据。

S6 当前结论是默认搜索维持既有范围，不新增上述门槛。只有请求明确传入属性时，三段召回统一增加：

只有请求明确传入属性时，三段召回统一增加：

```text
content_attribute = oral
或
content_attribute = cultural_knowledge
```

迁移态 `unclassified` 用于存量回填和待确认清单，不是第三种正式公开属性。

## 六、主表字段建议

### 6.1 建议保留在 `cantonese_corpus_all`

| 字段 | 原因 |
|---|---|
| `content_attribute` | 搜索显式硬过滤字段 |
| `media_types` | 用于媒体筛选和快速计数的派生缓存 |

### 6.2 不建议放入主表

| 原草案字段 | 调整建议 |
|---|---|
| `source_corpus_id` | 删除；复用现有 `category -> cantonese_categories.name` |
| `original_text` | 本期不加；需要独立溯源流程时再设计 |
| `source_location` | 本期不加；需要独立溯源流程时再设计 |
| `rights_status/train_permission` | 本期不加；等待治理流程和消费方 |
| `review_status/published_at` | 本期不加；尚无确认的写入方和消费规则，且不能把现有两字段直接等同于发布状态 |
| `parent_entry_id/derived_content_type/generation_method` | 本期不加；等待派生内容写入链路 |
| `contributor_display_name` | 建立贡献者关系或从历史记录聚合 |
| `contributor_public` | 放在贡献者授权关系中 |

## 七、S6 新表逐项结论

| 原草案表 | 结论 | 调整方向 |
|---|---|---|
| `source_corpus_profiles` | 删除 | 扩展 `cantonese_categories` |
| `corpus_classification_workflows` | 不按原结构实施 | 等 Agent 契约后最多评审一张轻量分类状态表 |
| `corpus_agent_runs` | 本期不建 | 复用 Agent run/task |
| `corpus_media_assets` | 延后 | 本期复用 `structured_note`，只增加 `media_types` |
| `corpus_review_tasks` | 本期不建 | 复用 Agent `/tasks` |
| `corpus_review_events` | 本期不建 | 不复制 Agent 任务事件 |
| `corpus_share_events` | 等 AW | 先确认埋点存储方案 |
| `s6_outbox_events` | 本期不建 | 当前没有已确认的可靠消息需求 |

本期不立即新增任何表。投稿到正式语料的 ingestion 属于独立业务确认，详见语料流转审计。

## 八、当前数据风险

1. Search 当前 SQL 没有统一应用 `lifecycle_stage` 和来源 `is_public`；是否应该应用属于待决策项，不作为 S6 阻塞条件。
2. 正式分类仅覆盖约 61.4%，且全部标记为规则生成。
3. 只有约 45.9% 的语料具有字段向量，语义召回不是全库覆盖。
4. 19,832 条语料没有 `structured_note`，迁移不能假设所有内容结构一致。
5. 语料征集投稿没有指向正式语料的外键、唯一 ID 或入库状态。
6. 当前 S6 草案所有拟新增表在 Production 均尚不存在。

## 九、实施条件判断

| 范围 | 判断 |
|---|---|
| 现有 Search API 的可选内容属性参数与三段统一过滤能力 | 已完成本地实现与只读验收，待部署 |
| Production 邻居表 | 已具备 |
| 内容属性存量导出与回填 | 需先完成来源规则表和 dry-run |
| 精简后的 `02a` DDL | 仅供评审，确认回填规则后方可拆分实施 |
| 投稿审核后自动进入正式语料 | 尚不具备 |
| Agent 分类候选与标注回写 | 等 Agent/AW 契约 |
| 分享事件表 | 等 AW 设计 |

当前数据模型已收缩为两个字段；下一步先确认回填规则和 Search 过滤，再决定是否单独启动投稿入库项目。
