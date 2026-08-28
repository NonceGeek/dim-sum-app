# 00a · S6 需求—现有实现—新增开发追踪矩阵

状态：已重新审计，作为 S6 技术范围收缩依据
核对日期：2026-08-27
负责人：Fynn

## 一、审计原则

S6 原型由产品 AI 辅助生成，只用于表达页面结构和交互方向。原型中的字段、按钮、任务状态、接口和页面不能直接推导数据库结构。

技术设计按以下优先级判断：

```text
主 PRD 明确业务结果
  > 产品后续确认
  > 当前真实代码和 Production 数据
  > 原型视觉表达
```

每项新增必须同时回答：

1. 它支撑哪一条本期验收标准？
2. 现有字段、JSON、关系表、Agent 服务或 AW 服务为什么不能复用？
3. 本期不增加会阻塞什么功能？
4. 谁负责写入、确认和维护？

无法回答以上问题的字段或表，不进入本期 migration。

## 二、结论

当前 S6 原数据模型明显偏重。若只实现本期已经确认、且由 Fynn 负责的 Search 能力，主表立即需要新增的字段只有：

```text
content_attribute
media_types
```

其余能力分为三类：

- **直接复用现有实现**：entry ID、正文、来源、分类、标签、贡献者、加工状态、分享链接、媒体详情。
- **等外部契约再定**：Agent 分类建议、标注任务、分享事件。
- **独立治理/入库项目**：权利、训练许可、来源位置、派生关系、征集投稿转正式语料。

## 三、业务能力追踪矩阵

| 本期业务能力 | 现有实现 | 本期最小新增 | 判断 |
|---|---|---|---|
| 默认搜索保持全属性最佳匹配 | `/api/search/entries` 已有精准排序 | 无 | 复用 |
| 可选 oral/cultural_knowledge 过滤 | 当前无结构化属性 | `content_attribute` + API 参数 + 三段统一过滤 | 必做 |
| 二级相关结果媒体筛选 | `structured_note` 已能解析媒体，但不可高效过滤 | `media_types` 派生列 + 相关段过滤 | 必做 |
| Unique ID 展示、复制、分享依据 | `unique_id` 已存在，详情和分享链路已使用 | 无 | 已具备 |
| 词条名称、粤拼、释义 | `data/note/structured_note` 已聚合 | 无 | 已具备 |
| 来源语料集 | `category -> cantonese_categories` | 无 | 已具备 |
| 一级/二级分类 | `content_categories + corpus_category` | 无正式分类新表 | 已具备 |
| 标签及三级扩散 | `tags + corpus_tags + tag_related` | 无 | 已具备 |
| 贡献者 | update history + User，旧 note 也有 contributor | 无主表字段 | 已具备 |
| 视频卡片、播放、转写 | `structured_note` parser 已支持媒体 URL；前端播放器需实现 | 优先扩展 JSON 读取和 UI，不先建媒体表 | 本期前端/API |
| Agent 二级分类建议 | 已有外部 Agent task API；正式分类表不能存待确认建议 | 等 Agent 返回契约后最多增加一张建议状态表 | 必做但暂不冻结 DDL |
| 标注小程序任务 | 已有 `/api/miniprogram/task/*` 代理 | 扩展任务类型和 Fynn 回写接口 | 复用现有 Agent 任务体系 |
| 分享卡片 | 已有 entry identity、固定 UUID 链路；AW 负责体验 | Fynn 只补公开上下文；事件方案等 AW | 不建本地分享系统 |
| 投稿审核后正式入库 | 当前完全断链 | 独立 ingestion 设计 | 不由搜索原型自动触发 |

### 媒体字段为何不能继续只用标签

Production 只读统计显示：

| 数据 | 覆盖语料数 |
|---|---:|
| `structured_note` 中 audio block | 21,186 |
| 正式 block 与旧 context 去重后的 audio 语料 | 40,996 |
| 旧 `img/photo_url` 图片语料 | 10 |
| 旧 `voxel` 3D 模型语料 | 1 |
| `tags.facet=media` 的 `media-audio` | 5,627 |
| `media-animation` | 5,461 |
| `media-tv-series` | 40 |
| `media-txt` | 1 |

现有 media facet 混合了资源形态、作品类型和来源语义，且音频标签覆盖远低于实际媒体数据。旧 context 还使用 `音频/粤语/普通话/img/photo_url/voxel` 等自定义 key。标签不能稳定承担 text/audio/video/image/model3d 筛选，所以 `media_types` 不是由原型反推的字段，而是统一旧结构并正确过滤所需的派生索引字段。

## 四、原主表字段逐项裁决

| 原草案字段 | 本期裁决 | 依据 |
|---|---|---|
| `content_attribute` | **保留，P0** | 直接支撑现有 Search API 的属性过滤 |
| `media_types` | **保留，P0** | 直接支撑方案 B 的二级相关媒体筛选 |
| `original_text` | 不加主表，延后 | 当前 `data/structured_note` 已承载；只在原文和展示文本不同时需要 provenance |
| `source_corpus_id` | 删除 | 现有 `category` 已是来源 FK |
| `source_location` | 延后 | 搜索和当前原型不依赖；入库治理时放 provenance/JSON |
| `rights_status` | 独立治理阶段 | 来源已有 `is_public`，但它不是已确认的条目级权利规则；需先有权利确认流程 |
| `train_permission` | 独立治理阶段 | 不参与本期搜索、展示或分享；当前没有训练集导出链路 |
| `review_status` | 删除 | 本期没有已确认的独立审核写入方和消费方；也不把现有状态字段强行解释为发布状态 |
| `parent_entry_id` | 延后 | 本期没有已确认的派生内容写入链路 |
| `derived_content_type` | 延后 | 同上 |
| `generation_method` | 延后 | 同上 |
| `contributor_display_name` | 删除 | 现有 contributor/history/User 可聚合 |
| `contributor_public` | 延后为贡献者授权关系 | 不是词条单值属性 |
| `published_at` | 延后 | 当前没有独立 publication 状态机；不阻塞本期 Search |

这里的“延后”不表示业务永远不需要，而是不能在没有写入方、确认流程和消费方的情况下提前建字段。

## 五、原新增表逐项裁决

| 原草案表 | 本期裁决 | 原因 |
|---|---|---|
| `source_corpus_profiles` | 删除 | 与 `cantonese_categories` 重复 |
| `corpus_classification_workflows` | 不按原结构实施 | 与 Agent task 状态重叠，且 current-row 模型覆盖历史 |
| `corpus_agent_runs` | 不在本期本地建表 | Agent 已维护 run/task；先确认是否需要本地镜像 |
| `corpus_media_assets` | 延后 | 当前视频显示可复用 `structured_note`；批量视频切片入库属于下一期 |
| `corpus_review_tasks` | 删除本期草案 | 复用现有 Agent `/tasks`，不平行维护第二套任务系统 |
| `corpus_review_events` | 删除本期草案 | 任务事件先由 Agent 维护；Fynn 只保存最终业务写回审计 |
| `corpus_share_events` | 等 AW | 未确认使用本地表还是现有埋点系统 |
| `s6_outbox_events` | 删除本期草案 | 尚无必须采用异步可靠消息的已确认链路 |

Agent 分类如需由 DimSum 保存本地可信状态，建议最多增加一张轻量表，例如：

```text
corpus_category_review_state
  corpus_id
  candidate_category_id
  status
  evidence
  rationale
  agent_task_id
  reviewed_by
  reviewed_at
  updated_at
```

在 Agent 契约确认前，不进入 DDL。

## 六、状态与来源公开字段的观察及实现口径

真实库已有 `lifecycle_stage` 和来源 `is_public`，但 PRD 没有要求将二者组合为 S6 的公开搜索条件，当前 Search 也没有统一这么做。这个组合保留为后续权限决策候选，本期不启用。

默认搜索保持改造前的数据范围，也不增加内容属性条件。

请求明确传 `contentAttribute` 时，精准、相关、推荐三段共同增加：

```text
cantonese_corpus_all.content_attribute = request.contentAttribute
```

媒体筛选只应用于二级相关结果：

```text
requestedMediaType = text -> media_types = {text}
requestedMediaType = audio/video/image/model3d -> media_types 包含请求值
```

如果未来确认需要条目级权利或发布状态，再通过独立治理需求新增，不在本期提前预埋一组无人维护的默认值。

## 七、`unclassified` 的最小迁移策略

1. 新增 `content_attribute`，存量默认 `unclassified`。
2. 根据可靠来源规则和确定性条目规则回填。
3. 无法判断的条目只导出 ID、来源和判断所需信息。
4. 默认未过滤搜索迁移期仍按改造前 Search 范围处理，避免一次性隐藏存量。
5. 明确属性过滤不返回 `unclassified`。
6. 新增或正式整理内容在发布前必须选择 oral/cultural_knowledge。

## 八、本期真正的后端工作量

### 必做

1. 两个主表字段及回填脚本：`content_attribute`、`media_types`。
2. 无法判断属性清单的 dry-run 和导出。
3. Search API 增加可选 `contentAttribute`。
4. 精准、相关、推荐三段在显式过滤时统一属性范围。
5. 二级相关结果应用媒体筛选。
6. 保持默认 Search 结果范围兼容，不新增 `lifecycle_stage/is_public` 过滤。
7. entry identity 返回 `contentAttribute/mediaTypes`。
8. 视频卡片和播放器复用现有媒体解析。
9. 等 Agent 契约后扩展现有 task 中间层和最终分类写回。
10. 为 AW 提供公开 entry context，复用 UUID 分享链路。

### 不属于本期 Search 核心

1. 重建来源语料库配置系统。
2. 完整权利管理平台和训练数据治理平台。
3. 通用派生内容图谱。
4. 全量媒体资产管理系统。
5. 第二套标注任务系统。
6. 自建分享事件仓库。
7. 通用 outbox 基础设施。
8. 语料征集投稿自动转正式词条。

## 九、范围变化

本次审计将原方案从：

```text
14 个主表字段 + 8 张新表
```

收缩为当前可立即评审的：

```text
2 个主表字段 + 0 张立即新增表
```

Agent 分类是否增加 1 张轻量状态表，等 Agent 方接口和数据归属确认后单独评审。
