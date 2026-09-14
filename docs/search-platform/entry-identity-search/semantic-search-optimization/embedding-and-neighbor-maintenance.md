# 语料 embedding 与离线近邻的更新职责

记录日期：2026-09-11。依据现有数据侧契约、本地近邻构建脚本和运维手册整理；未执行生产更新，未核验外部 Agent 的自动任务。

## 1. 更新顺序

```text
语料正文或结构化内容更新
  → 数据侧重新准备受影响字段的模型输入
  → 调用 embedding 模型
  → 更新 corpus_field_embeddings，并正确维护 updated_at
  → 运行离线近邻增量或全量构建
  → 搜索消费新向量及近邻（已有响应缓存按策略失效）
```

只改语料正文不会自动更新向量；只执行近邻脚本也不会生成语料向量。当前近邻增量检查的是向量表的 updated_at，而不是主表正文更新时间。

如果正文变了而向量没更新，搜索可能展示新正文，但语义排序仍依据旧内容。若向量更新而近邻未更新，在线 query 向量召回和离线推荐扩散也可能出现新旧不一致。

## 2. 是否必须由 Agent 更新 embedding

旧交接把数据底座职责交给 @RAiN，正式前后端契约将 corpus_field_embeddings 的维护归为后端/数据侧。因此应由该数据链路落实生成与更新，但生成向量只需调用 embedding 模型，可以由普通批处理或后台任务执行，不要求先做 Agent 分类推理。

| 环节 | 职责与现状 |
| --- | --- |
| 内容清洗、结构统一、分类建议 | Agent/数据侧按业务规则处理；新分类契约要求平台控制正式写回 |
| 语料 embedding | 旧契约归后端数据侧；准备字段输入、调用模型、维护向量与更新时间 |
| 用户搜索词 query embedding | Search 服务实时生成并短期缓存，不是批量语料向量更新 |
| 离线近邻 | 本仓库 Python/FAISS 构建脚本读取已有 doc 向量；当前手册规定开发者本地手动执行 |
| 线上搜索 | Vercel 消费已激活的近邻数据，不承担离线构建 |

目前不能确认外部 Agent 已实现“语料变更自动重算 embedding”。维护职责已写入旧契约，不代表自动触发、失败重试和近邻交接已经落地；本文也不授权新 Agent 绕过平台规则直接修改正式语料或分类。

## 3. 哪些表需要维护

| 表 | 内容 | 谁更新 |
| --- | --- | --- |
| corpus_field_embeddings | doc、definition、sentence、headword 等字段向量和 content_ref、updated_at | 数据侧向量生成链路 |
| corpus_embedding_neighbors | 词条到词条的近邻、rank、distance、similarity | 近邻脚本 |
| corpus_embedding_neighbor_builds | 构建批次、状态、覆盖数量 | 近邻脚本 |
| corpus_embedding_neighbor_sync_state | 增量水位、上次执行时间和错误 | 近邻脚本 |

后三张为搜索性能优化新增的离线近邻表；状态表由脚本维护，不需要人工逐行编辑。tags.embedding 和 tag_related 是另一套标签向量/关联数据，不由该 doc 近邻脚本更新。

## 4. 什么时候更新

按现有本地操作手册：

| 情况 | 处理 |
| --- | --- |
| 没有相关向量变化 | 不需要反复重建；可用 status 检查 |
| 少量新增或修改 doc 向量 | 数据侧成功写入后，执行一次 incremental |
| 大批量导入向量 | 执行 full，检查后激活新批次 |
| 数据变化较频繁 | 每月手动 full |
| 数据变化很少 | 每季度手动 full |
| 更换模型或维度 | 先统一语料/query 模型、维度和索引配置，再重建向量与 full 近邻；不能只运行近邻命令就完成迁移 |

仅修改展示配置等不影响 embedding 输入的字段，不应一律要求重算向量；触发范围应由数据侧明确。删除语料或向量同样需要明确失效处理，不能假设仅扫描 updated_at 的增量任务涵盖所有删除场景。

## 5. 为什么增量不能永久替代全量

当前 incremental 只重算发生变化的 source 的 outgoing 近邻。例如新增词条 A 后，会计算“A 与哪些词条相似”，但不会全面重新计算“所有旧词条是否应该把 A 加入近邻”。

因此增量用于及时跟进变更，周期性 full 用于修正整个候选集合变化带来的影响。

无变化时增量轻量检查后退出；存在变化时需要加载候选向量并建立本地索引，但只写回变化 source 的近邻。失败时水位不推进，修复后可重跑；这不代表失败时 active 批次中已完成的所有分批写入都会整体回滚。

## 6. 当前命令与上线方式

在 main 目录执行：

```bash
pnpm db:neighbors:status
pnpm db:neighbors:incremental --batch-size 200
pnpm db:neighbors:status
```

检查 changed_after_watermark=0 和无 last_error。该变更数只反映向量水位，不证明所有主表正文已生成最新向量。

全量流程：

```bash
pnpm db:neighbors:full --top-k 32 --batch-size 200
pnpm db:neighbors:status
# 抽查 ready 批次后，将下面的占位符替换为真实 build ID
pnpm db:neighbors:activate --build-id <build-id>
pnpm db:neighbors:status
```

full 创建独立批次，完成后为 ready，需要检查并激活；incremental 直接更新当前 active 批次。不要把两种命令都理解成“不影响线上直到手动发布”。详细操作沿用现有 runbook，本文仅记录流程，不代表本次已执行。

## 7. 待和 Agent/数据侧确认的交接

1. 哪些正文/结构化字段变化触发哪些 field_type 重算；模型输入如何确定。
2. 更新时如何替换或淘汰旧 content_ref 对应向量，避免内容改了却继续保留失效向量；updated_at 必须可靠变化。
3. 失败重试、重复执行、删除数据的处理，以及模型版本/维度一致性。
4. 如何证明某批语料向量全部生成成功，而不仅是任务发起成功。
5. 完成后由谁运行近邻更新、检查水位与质量，失败由谁跟进。
6. 是否继续采用本地手动操作，还是另行实施定时任务/队列；当前不能宣称已有自动调度。

这是现有搜索数据维护的交接待办，不自动扩大为新建 worker、队列或任务表的开发授权。

## 8. 依据

- [前后端数据维护契约](../frontend-backend-contract.md)
- [字段向量数据结构](../语料身份需求.md)
- [本地近邻操作手册](./local-neighbor-builder-runbook.md)
- [离线近邻实施方案](./offline-neighbor-table-implementation-plan.md)
- [实际构建脚本](../../../../main/scripts/build-corpus-embedding-neighbors.py)
