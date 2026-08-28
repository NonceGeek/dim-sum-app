# 08 · 性能、灰度、监控与回滚

状态：待确认

## 一、当前基础

- Production 离线邻居表已启用；这是 S6 的现状前提，不列为阻塞项。
- 现有 primary、similar、recommended 和 Entry 聚合代码继续复用。
- S6 新增的属性、权利和审核条件必须进入数据库查询，不允许前端拿到结果后再过滤。

上线前仍需在 Production 验证：实际 active build ID、覆盖率、读取延迟和 fallback 比例。已启用不等于已经完成 S6 范围验收。

## 二、响应架构

页面采用分段请求和渐进渲染：

```text
请求 1：primary + scope availability
  -> 先展示精准结果

请求 2：related（含可选 mediaType）
  -> 独立 loading / fallback / 换一批

请求 3：recommended
  -> 独立 loading / fallback / 换一批
```

如果一次 `section=all` 调用，也应在服务内部并发执行后两段，不让 recommended 阻塞 primary。

## 三、上线 SLO

以下均以 Production 服务端耗时、固定查询集和正常缓存组合统计：

| 指标 | 上线门槛 | 目标值 |
|---|---:|---:|
| primary p95 | ≤ 1.5s | ≤ 1.0s |
| primary p99 | ≤ 2.5s | ≤ 1.8s |
| related p95 | ≤ 4.0s | ≤ 2.5s |
| recommended p95 | ≤ 4.0s | ≤ 3.0s |
| 任一分段 5xx 比例 | < 1% | < 0.3% |
| semantic fallback 比例 | < 10% | < 3% |
| 显式属性过滤请求中的不符属性结果 | 0 | 0 |
| 未授权内容公开返回 | 0 | 0 |
| primary 首屏可见 p95 | ≤ 2.0s | ≤ 1.5s |

超时预算：

- primary 数据库 statement timeout：2 秒；超时视为严重错误，不返回不可信替代结果。
- related/recommended 单段预算：4 秒。
- query embedding 超时后立即走离线邻居/标签/分类 fallback，不重复等待第二次远程 embedding。
- 分享和媒体服务不计入 Search API 首屏预算。

## 四、缓存策略

### Search 缓存

键包含：query、规范化 contentAttribute（none/oral/cultural_knowledge）、section、mediaType、cursor、rankingVersion、policyVersion。

- primary：短 TTL 60 秒，允许 stale-while-revalidate 300 秒。
- related/recommended：TTL 5–15 分钟，按 rankingVersion 主动失效。
- scope availability：可按 normalized query 缓存 5 分钟。

### 索引字段变化

以下事件必须触发索引和缓存失效：

- content_attribute 修正；
- 分类从 pending_review/confirmed 变化；
- `media_types` 或媒体 JSON 变化。

读取缓存命中时仍应确保缓存的 policyVersion 有效。若后续决策启用 `lifecycle_stage/is_public` 过滤，再将二者纳入强制失效事件；高风险权限变更应支持按 entryId 主动清除。

## 五、召回降级

| 故障 | 降级 |
|---|---|
| query embedding 超时 | 使用 Production 离线邻居、标签、分类和热度 |
| 离线邻居不可用 | 使用标签、确认分类和热度 |
| related 失败 | primary/recommended 继续，相关区可重试 |
| recommended 失败 | primary/related 继续，推荐区可重试 |
| 媒体元数据异常 | 回退文本卡片并记录 media_metadata_invalid |
| 视频加载失败 | 文本转写；有音频时提供音频入口 |
| AW 分享服务失败 | 搜索正常，分享入口显示暂不可用或复制链接降级 |

任何降级都不得扩大改造前的默认检索范围；请求明确提供 contentAttribute 时必须继续应用，不能因降级退回未过滤结果。

## 六、埋点与日志

### 用户行为

```text
search_submit
content_attribute_filter_applied（预留，前端选择器上线后启用）
search_section_impression
media_filter_change
search_empty_scope
alternate_scope_click
video_play
video_load_failed
share_card_open
share_image_download
share_link_copy
share_link_open
```

公共字段：traceId、searchKeywordHash、contentAttribute、resultEntryId、resultLevel、mediaTypeFilter、rankingVersion、fallbackReason、latencyMs。

原始搜索词是否进入分析系统应遵守现有隐私规则；默认优先存 hash 和经批准的采样日志。

### 服务指标

- 各 section p50/p95/p99。
- DB、embedding、neighbor、tag/category 各阶段耗时。
- cache hit rate。
- fallback 原因和比例。
- 每个 contentAttribute 的零结果率。
- 过滤前后候选数量。
- 跨属性防线拦截数量。
- Agent 成功率、无建议率、无效输出率。
- AW 任务积压、平均处理时间、冲突率和回写失败率。

## 七、上线与线上验证阶段

### Stage 0：数据审计

- `content_attribute` 和 `media_types` 已部署并完成目标范围回填。
- 显式属性过滤目标范围的属性完整率达到验收门槛。
- 运行跨属性和媒体类型一致性审计；同时记录 `lifecycle_stage × 来源公开性` 分布供后续决策，但它不构成本期上线门槛。

### Stage 1：Production 固定请求验证

- 不改变普通用户默认搜索参数和语义。
- 直接在 Production 使用固定测试词和显式新参数请求验证 S6 查询并记录差异。
- 不调用 AW 公开分享生成。

### Stage 2：内部联调

- 项目成员直接调用新接口参数验证，不设置 Search S6 功能开关。
- Agent 和 AW 使用测试来源语料库联调。

### Stage 3：正式接入

- 调用方在接口验收后正式接入新能力。
- 至少观察一个完整业务周期或 24 小时。
- 检查 SLO、空结果、显式属性过滤、权限和任务积压。

### Stage 4：全量

- 全量后仍保留旧 API 至少一个稳定周期。
- 稳定后再规划旧搜索入口退役。

## 八、开关原则

- `content_attribute`、`media_types`、可选过滤参数等不改变旧搜索默认行为的增量更新不使用功能开关。
- schema 变更遵循 Production `db pull` → diff 审查 → 编辑 schema → `db push`，再执行 Prisma 无法表达的补充 SQL。
- Agent 任务创建、AW 分享发布等存在外部副作用的能力，按各自接口契约保留停止入口，但不与本次 Search schema 更新绑定。

## 九、回滚

- UI 回滚：调用方恢复旧入口或停止传入新参数。
- Agent/AW 回滚：停止创建新任务，保留已有任务和审计记录，不能删除。
- 数据库回滚：新增列和表保留，不执行破坏性 down migration。
- Search 回滚：回滚应用版本或恢复旧 API 调用；新增兼容字段、索引保留。
- 分享回滚：关闭 AW 生成入口，固定 SEO 词条页继续可用。

触发立即回滚：显式属性过滤失效、未授权内容泄露、错误下线绕过或数据不可逆覆盖。
