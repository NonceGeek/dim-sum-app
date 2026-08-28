# 探索搜索性能优化

更新时间：2026-08-27

本目录集中保存 2026-08-27 探索搜索慢查询治理的分析、当前代码优化和后续完整
推荐能力恢复方案。

## 阅读顺序

| 文档 | 内容 |
|---|---|
| `performance-analysis-and-current-optimization.md` | 线上基线、数据库证据、根因、已实施优化和验收标准 |
| `offline-neighbor-table-implementation-plan.md` | 邻居表 DDL、离线构建、增量/全量任务、灰度和回滚 |
| `local-neighbor-builder-runbook.md` | 本地首次全量、手动增量、激活、恢复和故障处理操作手册 |
| `iad1-query-embedding-relay.md` | 查询向量中转、Edge 冷启动优化与 Preview/Production 验收 |

日常维护直接阅读 `local-neighbor-builder-runbook.md` 的“日常手动维护速查”，按
`status -> incremental -> status` 执行；周期性全量按 `full -> status/抽查 -> activate -> status`
执行。

## 当前状态

- 已实施：删除未命中 HNSW 的在线动态向量扩散。
- 已实施：semantic 复用 `primaryCorpusId`。
- 已实施：8 秒 statement timeout 和 similar-only 降级。
- 已验证：部署前 semantic 从原线上 22-39 秒降至约 3.88-4.60 秒。
- 已实现：邻居表 Prisma 模型与 SQL migration。
- 已实现：本地 FAISS/HNSW 全量、增量、状态、激活脚本。
- 已实现：线上 feature flag 控制的邻居候选融合。
- 已执行：数据库建表、1,000 条样本验证、首次全量构建和 active 数据切换。
- 当前 active：23,405 source、748,960 邻居、canonical 覆盖率 100%。
- 已验证：线上读取 3 * 24 条邻居的 SQL 实际执行 8.807ms。
- 已部署：查询向量经 Edge Runtime `iad1` 中转访问 DashScope，提交 `eba9150` 已通过
  PR #387 合并到 `main`。
- 已验收：Preview 20/20 成功，P50 1.876 秒、P95 3.210 秒、最大 5.508 秒。
- 已上线：Production `SEARCH_OFFLINE_NEIGHBORS_ENABLED=true`；20/20 成功，P50
  1.656 秒、P95 4.976 秒、最大 7.899 秒。
- 待观察：首个冷请求仍可能超过 5 秒，持续检查超过 8 秒请求、P2024 与 statement
  timeout；异常时关闭开关并重新部署，不删除 active build。

## 目标架构

```text
query vector -> similar
             -> active offline neighbors
             -> tag/category/heat fusion
             -> recommended
```

当前实现不会恢复动态 source vector 的在线相关扫描。
