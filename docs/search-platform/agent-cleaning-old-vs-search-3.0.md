# 新旧搜索需求中的 Agent 数据处理与表变更

记录日期：2026-09-11。本地代码基准：`700834986101bb6db851e1caa843e269e5294b44`。

本记录依据 `docs/search-platform` 的需求、交接和历史生产实施记录，不重新连接生产数据库。下文的数量均为文档注明的 2026-08-27/28 快照，不是今天的实时数量。

后续开发范围见 [Search 3.0 剩余开发与验收](./s6-dimsum-search-system-upgrade-3.0/12-remaining-development-and-acceptance.md)。

语料变更后的维护见 [embedding 与离线近邻更新职责](./entry-identity-search/semantic-search-optimization/embedding-and-neighbor-maintenance.md)：数据侧先更新语料向量，再运行近邻任务；生成向量不要求分类 Agent 推理，目前未确认外部自动触发链路。

## 1. 先区分“谁负责”和“是否已完成”

旧需求把 @RAiN 的职责描述为“词条身份信息数据底座”，后续正式文档称为“后端/数据侧”。因此可以确认后端交付了清洗后的数据结构和数据，但不能据此断言每条记录都由某个 AI Agent 推理生成。

新需求中的 Agent 则有更明确的输入、候选输出、原文依据、路由建议和人工确认流程。需求中的“需要 Agent 提供”，也不能直接写成“Agent 已处理完成”。

| 对比 | 旧语料身份搜索 | Search 3.0 |
| --- | --- | --- |
| 核心目标 | 把历史异构语料整理成可供搜索消费的数据底座 | 在已有数据底座上增加属性过滤、媒体识别及可追溯分类复核 |
| 主要对象 | 旧正文/JSON、粤拼释义、标签、分类、字段向量 | 内容属性未分类条目、媒体资源、缺二级分类的可回溯词条 |
| Agent/数据侧任务 | 结构化、标签去重标准化、初始化分类、维护向量 | 最小 Agent 能力是提出一个二级分类候选及依据；平台决定路由与正式写回 |
| 表变化 | 分类 2 张、标签 3 张、字段向量 1 张构成新增数据底座；主表复用 | 当前已实施仅主表 2 个字段；没有新增 Agent 专用表 |
| 完成证据 | 正式表、结构化内容、分类、标签与向量均有数据记录 | 两字段、媒体派生及来源属性回填已有实施记录；分类闭环仍是待对接需求 |

## 2. 旧需求：到底整理了哪些数据

### 2.1 旧内容 JSON → 统一结构化内容

来源是 `cantonese_corpus_all.data/note`，特别是各来源格式不同的 `note.context`：读音、粤拼、释义、例句、介绍、音频和图片/视频等。

正式目标结构是同一主表的：

```text
structured_note.data[]
  ├─ jyutping
  └─ blocks[]
       ├─ definition / phrase / sentence / introduction / other
       └─ audio / image / video 等
```

`data[]` 允许一个多音字保留多组读音及内容块。这是结构统一，不应理解为 AI 随意改写或替换原文；旧 `note` 继续保留并被搜索作为兼容读取来源。

早期归档草稿的 `structured_note.identity` 不是最终结构。正式方案采用 `structured_note.data[].blocks`。

### 2.2 历史标签 → 正式标签体系

正式对接文档指定从旧 `cantonese_corpus_all.tags` 清洗导入；标签口径文档也明确旧 `note` 中的历史标签是清洗原材料。

处理结果是：

- 去重、标准化后形成 `tags` 词表，保存名称、slug、facet、状态等。
- `corpus_tags` 保存词条与标签的多对多关系。
- 给标签维护 `gloss` 释义，用释义而非短标签字面生成 `tags.embedding`。
- 从语料标签关系计算共现，从标签释义向量计算语义近邻，保存到 `tag_related`。

`cooc` 是统计计算，`semantic` 是向量相似，`manual` 是人工维护入口，三者不能统一归为“Agent 清洗”。文档没有逐条清洗日志，不能进一步声称已完成全部同义词合并、事实纠错等未记录操作。

旧需求里的 precise/related/recommended 角色和 strong/medium/weak 强度没有完整落库；`tag_role`、`relevance_level` 被暂缓。当前已有词条标签统一输出为 related，推荐标签经 `tag_related` 扩展。

### 2.3 初始化内容分类

后端维护两级分类树，并给词条挂一个二级分类；一级由该二级分类的 parent 推导。正式落点是 `content_categories + corpus_category`，不是归档草稿中的主表 `identity_category_l1/l2` 字段。

需求支持 AI 初始化和人工复核，但生产快照显示 31,291 条分类归属的 `source` 全部为 `rule`。这证明存在规则归属结果，不能证明它们全部由 AI 完成，更不能证明已人工审核。

### 2.4 建立字段级向量

后端维护 `corpus_field_embeddings`，按 `doc/definition/sentence/headword` 等字段保存模型输入 `content_ref` 和 1024 维向量，供相似检索使用。

这是建立语义索引，和文本清洗有依赖关系，但并非同一件事。模型支持 image/video、DDL 允许相应 field_type，不表示这些跨模态数据当时都已生成；旧实施记录明确已有数据主要是 text 字段向量。

### 2.5 已有数据的历史覆盖

依据 2026-08-27 生产分析：

| 项目 | 文档记录 |
| --- | ---: |
| 主表总量 | 50,994 条 |
| 有 structured_note | 31,162 条 |
| 分类树 | 一级 6 个、二级 59 个 |
| 有正式分类关系 | 31,291 条 |
| 标签词表 | 117 个 |
| 词条标签关系 | 43,998 条关系，不等于 43,998 个词条 |
| 字段向量 | 78,889 条向量，覆盖 23,405 个词条 |

这些集合有重叠，不能相加成“清洗总条数”。也不能认为 50,994 条全部完成了结构化、分类和向量化。早期进度文档的“约 3 万条、覆盖绝大部分”是另一阶段口径，不宜覆盖后来的生产快照。

## 3. 新需求：已经执行的数据处理

### 3.1 内容属性：按确认来源规则回填

在主表新增 `content_attribute`，区分 `oral`、`cultural_knowledge`，无法判定保留 `unclassified`。

2026-08-28 的来源画像、正文样本和分类复核覆盖 29 个来源，然后以 `s6-content-attribute-source-v1` 映射回填：

| 结果 | 数量 | 主要数据 |
| --- | ---: | --- |
| oral | 41,038 | 藤县方言录音/转写、粤语万句生活场景、粤语影视对白、歌曲、童谣等 |
| cultural_knowledge | 9,703 | 广州话正音字典、唐诗、寻味佛山、岭南建筑图像、十三行资料等 |
| unclassified | 253 | 岭南文脉 195、佛山饮食 38、多宝路街区 20 |

最后三类在同一个 Entry 中混合书面文化原文和粤语口语改写，所以没有自动二选一。需要产品决定条目的主体属性，或另行设计原文/派生版拆分。

这次实际是确定性来源映射，不是 Agent 对 50,741 条逐条做推理清洗；也不是仅凭“有音频”就认定 oral。脚本只更新 unclassified，避免覆盖已确认结果。

### 3.2 媒体：从资源 JSON 派生索引字段

新增主表 `media_types`，从 `data/note/structured_note` 中已有内容和有效媒体资源识别 text/audio/video/image/model3d，保留多媒体共存。

实施记录显示更新了 41,011 条派生不一致的记录，剩余不一致为 0。最终分布：

| 媒体组合 | 数量 |
| --- | ---: |
| text + audio | 40,995 |
| text | 9,983 |
| text + image | 10 |
| text + video | 5 |
| text + audio + model3d | 1 |

这是数据库函数、trigger 和批量脚本完成的媒体识别/回填，不是 Agent 新生成音视频，不涉及本期批量切片、OCR 或重建媒体文件。

## 4. 新需求：Agent 还需要提供什么

主 PRD 对 Agent 的职责描述较广，包含内容解析、属性判断、分类/标签建议和适用时的派生内容建议。更具体的 `05-agent-integration-reference.md` 将当前最小对接能力收敛为：**对缺少二级分类的词条，给出最多一个分类候选、可定位原文依据和处理建议。**

输入包含词条 UUID、原文、来源与位置、已确认内容属性、一级分类、现有标签、媒体及本次可选分类树。

| 输入/判断 | Agent 与平台的目标处理 |
| --- | --- |
| 原始资料已有有效分类 | 不调用 Agent，复用原始分类 |
| 一个明确候选 | Agent 返回候选和依据；平台置待抽检，按策略抽查 |
| 存在歧义或冲突 | Agent 返回最可能候选及依据；平台路由到 AW 标注小程序审核 |
| 信息不足/不适用 | 留空或待补，不产生无意义审核任务 |
| 原文严重损坏、来源/属性/权利未确认、缺一级分类 | 前置阻塞，不强行补二级分类 |
| 人工确认/修改 | 由 Fynn 服务校验后回写正式 corpus_category |

目标要求还包括工作流版本、调用 ID、幂等、重复回调处理及证据校验。Agent 不直接改正式数据库、不决定公开状态；AW 完成人工操作，平台承担最终业务写回。

待抽检建议可以按规则服务普通相关/推荐，但不能直接作为公开二级分类或训练标签。参考流程要求候选先留在 Agent 任务或后续确认的轻量状态表，不能提前写入正式 `corpus_category`。

当前参考接口和建议状态并不等于已上线：本仓库已有任务代理，但现有审计没有确认完整的本地分类回写闭环。不能给出“新 Agent 已清洗多少条二级分类”的已完成数字。

## 5. 新增表到底有哪些

| 阶段 | 新建/复用的结构 | 数量与状态 |
| --- | --- | --- |
| 旧身份搜索数据底座 | content_categories、corpus_category | 2 张分类表，已存在且有数据 |
| 旧身份搜索数据底座 | tags、corpus_tags、tag_related | 3 张标签表，已存在且有数据 |
| 旧身份搜索数据底座 | corpus_field_embeddings | 1 张字段向量表，已存在且有数据 |
| 旧内容结构统一 | cantonese_corpus_all.structured_note | 主表字段，不能另算一张表 |
| 后续推荐性能优化 | corpus_embedding_neighbor_builds、corpus_embedding_neighbors、corpus_embedding_neighbor_sync_state | 3 张离线近邻相关表，属于搜索工程，不是 Agent 清洗表 |
| 3.0 已实施 | cantonese_corpus_all.content_attribute、media_types | 2 个字段、2 个索引及派生函数/trigger，0 张新表 |
| 3.0 分类建议状态 | corpus_category_review_state | 候选设计，需等契约确认；当前不算已新增表 |
| 3.0 任务系统 | 外部 Agent /tasks + 现有代理 | 复用，不复制一套本地任务表 |

旧阶段六张表是文档交付的数据底座结构，不能凭这些文档确定全部由某一次 Agent 执行创建。

最初草案中的以下八张表已明确不进入本期 migration：

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

不要混淆已存在的 `corpus_collection_review_events`（征集投稿审核）与上述未实施的 `corpus_review_events`。投稿审核通过也不等于已清洗入正式搜索主表。

## 6. 依据文件

- [旧 @RAiN 交接草稿，已归档](./entry-identity-search/archive/rain-handoff.md)：旧数据侧职责来源；字段方案应以正式文档覆盖。
- [旧正式语料身份需求](./entry-identity-search/语料身份需求.md)：结构化 JSON、分类、标签、字段向量 DDL。
- [前后端对接边界](./entry-identity-search/frontend-backend-contract.md)：数据侧清洗/维护与 Next 搜索职责。
- [标签与身份口径](./entry-identity-search/tag-and-identity-model.md)：旧标签是原材料、正式标签已清洗。
- [生产数据库快照](./s6-dimsum-search-system-upgrade-3.0/00-production-database-analysis.md)：2026-08-27 数据数量与分类来源。
- [内容属性来源映射](./s6-dimsum-search-system-upgrade-3.0/08-content-attribute-source-analysis.md)：具体来源、数量与未分类原因。
- [生产实施记录](./s6-dimsum-search-system-upgrade-3.0/migration/07-production-execution-record.md)：2026-08-28 已执行字段和回填证据。
- [新 Agent 参考契约](./s6-dimsum-search-system-upgrade-3.0/05-agent-integration-reference.md)：分类候选、证据、路由、权限和状态归属。
- [3.0 精简数据模型](./s6-dimsum-search-system-upgrade-3.0/02-data-model-and-migration.md)：两字段、候选状态表和不进入 migration 的八张表。
