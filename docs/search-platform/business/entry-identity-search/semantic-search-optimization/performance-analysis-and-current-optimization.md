# 探索搜索性能分析与当前优化

更新时间：2026-08-27

## 一、结论

线上“继续探索”慢的主要原因不是浏览器、CDN、DashScope 或 HNSW
索引缺失，而是三级推荐 SQL 使用数据库行中的动态向量，对 3 个相似结果分别执行
相关 KNN 子查询。该写法没有命中 HNSW，导致同一请求重复扫描约 1.05 GB 的
`corpus_field_embeddings`。

本次当前版本处理：

- 保留 query vector 的一次 HNSW 召回。
- 保留 `corpus_tags`、`tag_related`、二级/一级分类和热度融合。
- 暂时移除 similar -> doc vector -> recommended 的在线二次扩散。
- 前端先获取 primary，再把 `primaryCorpusId` 传给 semantic，避免重复文本匹配。
- semantic SQL 增加 8 秒 `statement_timeout`、2 秒连接等待和 10 秒事务上限。
- 全量 semantic 超时时尝试只返回 similar，并把状态标记为 `fallback`。

完整的 similar 向量扩散不能长期删除，后续通过离线
`corpus_embedding_neighbors` 恢复，见
`offline-neighbor-table-implementation-plan.md`。

## 二、线上基线

测试接口：

```text
GET https://search.aidimsum.com/api/search/entries
```

每次请求使用唯一探针参数并发送 `Cache-Control: no-cache`，避免 CDN 命中。

| 类型 | 查询 | HTTP | TTFB / Total |
|---|---|---:|---:|
| primary | 饮茶 | 500 | 5.66s |
| semantic | 饮茶 | 200 | 38.94s |
| primary | 粤语 | 200 | 3.09s |
| semantic | 粤语 | 200 | 25.24s |
| primary | 早晨 | 200 | 1.73s |
| semantic | 早晨 | 200 | 22.38s |

隔离测试：

| semanticPart | 返回 | Total |
|---|---|---:|
| `similar` | 3 条 similar | 5.66s |
| `recommended` | 4 条 recommended | 38.52s |

因此慢点集中在 recommended，而不是 query embedding 或 similar。

## 三、数据库证据

### 3.1 数据规模

| 表 | 估算行数 | 总大小 |
|---|---:|---:|
| `cantonese_corpus_all` | 50,735 | 67 MB |
| `corpus_field_embeddings` | 74,122 | 1,052 MB |
| `corpus_tags` | 43,022 | 4,392 KB |
| `corpus_category` | 30,918 | 3,232 KB |
| `tag_related` | 3,288 | 496 KB |

### 3.2 历史 SQL

`pg_stat_statements` 中两种 semantic SQL 形态：

| Calls | Mean | Max |
|---:|---:|---:|
| 144 | 37.04s | 75.32s |
| 80 | 38.27s | 61.93s |

这是稳定存在的查询结构问题，不是单次网络抖动。

### 3.3 HNSW 验证

`corpus_field_emb_doc_hnsw` 存在且单次 query-vector KNN 正常使用：

- 节点：`Index Scan`
- 数据库执行时间：约 1.02s
- 返回候选：40 条（受当前 HNSW `ef_search` 影响）

测试时约 224 次 semantic 历史调用只对应约 233 次 doc HNSW index scan，接近
每请求一次，不是设计预期的 query 一次加 3 个 similar 各一次。说明相关子查询中的
动态 `source.embedding` 没有形成 HNSW KNN index scan。

## 四、根因链路

旧链路：

```text
query -> DashScope query vector
      -> HNSW top 48                         命中索引
      -> similar top 3
      -> similar 1 doc vector -> top 24      未命中索引
      -> similar 2 doc vector -> top 24      未命中索引
      -> similar 3 doc vector -> top 24      未命中索引
      -> 标签/分类/热度聚合
      -> entryIdentity 聚合
```

附加问题：

- primary 与 semantic 原本并发，semantic 内部又执行一次 primary 文本匹配。
- semantic 没有数据库 statement timeout，可占用连接 20 到 75 秒。
- primary 的 5 秒 statement timeout 偶发返回 500，现已规范为可重试 503。
- 测试响应 `x-vercel-id` 显示函数链路经过 `hkg1`；生产发布后需在 Vercel 日志再次
  核对 `VERCEL_REGION` 是否为预期 `sin1`。

## 五、当前实现

请求顺序：

```text
primary(q, dataset)
  -> 立即展示精准结果
  -> semantic(q, primaryCorpusId)
```

`primaryCorpusId` 取值：

- 正整数：semantic 直接按 `cantonese_corpus_all.id` 获取分类与标签种子。
- `none`：已确认没有 primary，semantic 不再重复文本匹配。
- 缺省：兼容旧客户端，服务端仍自行执行种子匹配。

当前 recommended 候选：

```text
query vector 弱召回
+ primary 的 tag_related
+ 同二级分类
+ 同一级分类
+ 浏览/收藏/点赞排序
```

当前不再在线执行：

```text
3 个 similar 各自再次向量 KNN
```

## 六、修改后验证

修改后代码在同一应用环境直连现有数据库验证：

| 查询 | primary | semantic | 结果 |
|---|---:|---:|---|
| 饮茶，无 primary seed | 原 primary 本次超时 | 4.60s | similar=3, recommended=4 |
| 粤语，`primaryCorpusId=51683` | 6.49s | 3.88s | similar=3, recommended=4 |

这些是部署前应用级验证，不替代生产区真实延迟。部署后使用相同探针重新跑基线。

## 七、生产验收标准

P0.5 当前优化验收：

- semantic P50 <= 4s。
- semantic P95 <= 8s。
- 不再出现 20 到 75 秒 semantic SQL。
- similar=3、recommended=4 的接口契约不变。
- semantic 超时不占用数据库连接超过 10 秒。
- P2024 数量不因搜索流量上升。
- primary 可先展示，探索区域独立 loading。

回滚条件：

- 推荐相关性人工样本通过率相比旧版本下降超过 15%。
- semantic P95 仍超过 8 秒。
- 503 或 `fallback` 比例超过 5%。

回滚只恢复候选策略，不应移除数据库 timeout。完整相关性优先通过离线邻居表恢复，
不恢复旧的在线动态向量扫描。
