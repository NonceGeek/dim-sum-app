# `corpus_embedding_neighbors` 离线邻居表实施方案

更新时间：2026-08-27

## 一、目标

在不恢复在线 20 到 75 秒向量扫描的前提下，恢复完整的三级探索能力：

```text
query vector -> similar top 3
similar top 3 -> 各自预计算邻居
              -> 标签/分类/热度融合
              -> recommended top 4
```

在线请求只读取预计算邻居，不再使用数据库行中的动态向量执行相关 KNN。

## 二、数据模型

建议新增构建批次表与邻居表：

```sql
create table public.corpus_embedding_neighbor_builds (
  id uuid primary key default gen_random_uuid(),
  field_type text not null default 'doc',
  model_name text not null,
  embedding_dimension integer not null default 1024,
  neighbors_per_source smallint not null,
  status text not null check (status in ('building', 'ready', 'active', 'failed', 'retired')),
  source_count integer not null default 0,
  processed_source_count integer not null default 0,
  neighbor_count bigint not null default 0,
  source_watermark timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create unique index corpus_embedding_neighbor_one_active
  on public.corpus_embedding_neighbor_builds (field_type)
  where status = 'active';

create table public.corpus_embedding_neighbors (
  build_id uuid not null
    references public.corpus_embedding_neighbor_builds(id) on delete cascade,
  field_type text not null default 'doc',
  source_corpus_id bigint not null
    references public.cantonese_corpus_all(id) on delete cascade,
  target_corpus_id bigint not null
    references public.cantonese_corpus_all(id) on delete cascade,
  rank smallint not null check (rank > 0),
  distance real not null check (distance >= 0),
  similarity real not null check (similarity >= -1 and similarity <= 1),
  source_embedding_updated_at timestamptz not null,
  target_embedding_updated_at timestamptz not null,
  computed_at timestamptz not null default now(),
  primary key (build_id, field_type, source_corpus_id, target_corpus_id),
  unique (build_id, field_type, source_corpus_id, rank),
  check (source_corpus_id <> target_corpus_id)
);

create index corpus_embedding_neighbors_source_rank_idx
  on public.corpus_embedding_neighbors
    (build_id, field_type, source_corpus_id, rank);

create index corpus_embedding_neighbors_target_idx
  on public.corpus_embedding_neighbors
    (build_id, field_type, target_corpus_id);
```

另增加 `corpus_embedding_neighbor_sync_state`，按 `field_type` 保存当前 active build、
增量 watermark、上次执行时间、变更数量和错误。数据库定义位于：

```text
main/prisma/migrations/20260827090000_add_corpus_embedding_neighbors/migration.sql
main/prisma/schema.prisma
```

不直接把 `embedding vector(1024)` 复制进邻居表，避免重复占用大量空间。表中保存距离、
相似度、构建批次和源/目标向量更新时间，用于追踪陈旧数据。

## 三、canonical doc 向量

当前一条语料同一 `field_type` 可能存在多个 `content_ref`。离线任务统一选取：

```sql
select distinct on (corpus_id)
  id,
  corpus_id,
  embedding,
  updated_at
from public.corpus_field_embeddings
where field_type = 'doc'
order by corpus_id, updated_at desc, id desc;
```

后续如果 embedding 管线能保证一条语料只有一条 active doc 向量，应增加显式
`is_active` 或 `embedding_version`，替代隐式“最新一条”规则。

## 四、构建程序

已实现文件：

```text
main/scripts/build-corpus-embedding-neighbors.py
main/scripts/requirements-embedding-neighbors.txt
```

采用本地 Python + FAISS HNSW，而不是对当前 23,405 个 canonical doc source 逐个向生产 PostgreSQL
执行 KNN。canonical 1024 维向量只导出一次，在本地归一化、建索引和批量搜索，最终按
批次使用 PostgreSQL `COPY` 写回。

命令：

```text
pnpm db:neighbors:setup
pnpm db:neighbors:full --limit 1000
pnpm db:neighbors:full
pnpm db:neighbors:full --resume <build-id>
pnpm db:neighbors:activate --build-id <build-id>
pnpm db:neighbors:incremental
pnpm db:neighbors:status
```

关键步骤：

1. 流式读取 canonical embedding，并验证所有向量维度和有限值。
2. 在本地建立 cosine/IP FAISS HNSW 索引。
3. 分批查询 `top-k + buffer`，排除自身并去重。
4. 每 200 个 source 提交一次 COPY；中断后可按 build ID 跳过已完成 source。
5. 数量校验通过后标记 `ready`，不会自动影响线上。
6. `activate` 在事务内把旧 active 退役并切换新 build，同时初始化增量 watermark。

数据库绑定参数 KNN 保留为诊断和小规模备选，不用于首次全量：

```sql
select
  e.corpus_id as target_corpus_id,
  e.updated_at as target_embedding_updated_at,
  e.embedding <=> $1::vector as distance,
  1 - (e.embedding <=> $1::vector) as similarity
from public.corpus_field_embeddings e
where e.field_type = 'doc'
  and e.corpus_id <> $2
order by e.embedding <=> $1::vector
limit $3;
```

`$1` 必须是应用绑定的 vector 常量。不要使用 Web/Vercel 请求执行全量构建。

当前数据量的预计本地资源：canonical float32 约 92 MiB，考虑 Python、FAISS 图和写入
缓冲后建议至少 4 GiB 可用内存、2 到 4 GiB 临时磁盘。2026-08-27 本机实测：FAISS
建索引 5.1 到 6.1 秒，全量计算写入 23,405 source 约 3 分 35 秒，包含跨境向量下载
约 5 分钟。后续仍应为网络波动预留 10 到 20 分钟窗口。

## 五、构建与激活

采用 build id 双版本切换：

```text
building build A
  -> 分批写入 A
  -> 数量、重复、抽样质量检查
  -> 事务内 active old -> retired
  -> 事务内 A -> active
```

在线 SQL 只读取 `status='active'` 的 build。构建中断不会污染当前推荐，旧 build 至少
保留 7 天便于回滚。

## 六、在线推荐 SQL

恢复的候选段：

```sql
select
  n.target_corpus_id as id,
  n.similarity * 45 as score
from similar_ids s
join corpus_embedding_neighbor_builds b
  on b.field_type = 'doc'
 and b.status = 'active'
join corpus_embedding_neighbors n
  on n.build_id = b.id
 and n.field_type = b.field_type
 and n.source_corpus_id = s.id
where n.rank <= 24
  and n.target_corpus_id <> coalesce((select id from primary_seed), -1)
  and not exists (
    select 1 from similar_ids existing
    where existing.id = n.target_corpus_id
  );
```

此段只读取最多 `3 * 24 = 72` 行邻居，随后继续融合：

- query vector 弱召回。
- `tag_related`。
- 同一级/二级分类。
- 浏览量、收藏量和点赞量。
- 后续运营置顶。

## 七、增量更新

### 7.1 日常增量

当 canonical doc embedding 更新时：

- 删除并重算该 source 的 outgoing neighbors。
- 记录 `source_embedding_updated_at`。
- 每小时或每天批处理变化 source。

第一阶段允许定时增量扫描，但不应每次全量扫描向量内容。任务只按 watermark 查询：

```sql
select distinct on (corpus_id)
  id,
  corpus_id,
  embedding,
  updated_at
from public.corpus_field_embeddings
where field_type = 'doc'
  and updated_at > $1
order by corpus_id, updated_at desc, id desc;
```

`$1` 是上一次成功任务的 watermark。watermark 必须在整批邻居写入成功后更新，失败时
保持原值，使任务可以安全重跑。单纯查询 `updated_at` 的 btree 索引是否需要新增，应在
生产执行计划确认后决定；增量量小且运行频率低时不先增加推测性索引。

目标向量变化也会影响其他 source 的入邻居排名，无法只靠重算自身完全修复。因此：

- 日常增量保证新/改语料能够主动推荐出去。
- 每周全量 rebuild 修正所有 incoming 邻居和全局排序。
- 大批量 embedding 导入后立即触发全量 rebuild。

### 7.2 推荐调度频率

| 任务 | 建议频率 | 是否全量扫表 | 用途 |
|---|---|---|---|
| 增量邻居构建 | 每小时或每天 | 否 | 按 watermark 处理新增/更新 doc 向量 |
| 陈旧数据检测 | 每天 | 否 | 比较 embedding 与 neighbor 更新时间 |
| 全量邻居重建 | 每周 | 是 | 修正所有 incoming 邻居和全局排名 |
| 大批量 embedding 导入后 | 立即 | 是 | 避免大批新数据长期缺失 |
| 模型、维度或 canonical 规则变化 | 立即 | 是 | 不同向量空间不能混用 |

当前阶段全量重建由开发者在本地手动执行，不能由 Vercel Web 请求触发，也不能覆盖
当前 active build。新 build 完整校验后再原子切换。电脑必须保持唤醒、网络稳定；任务
中断可用 `--resume <build-id>` 恢复。如果中断期间 canonical 数量发生变化，则新建一次
全量 build，避免混合快照。

### 7.3 后续用任务队列替代日常扫表

当 embedding 写入管线可修改时，建议增加：

```text
corpus_embedding_neighbor_jobs
```

每次新增或更新 canonical doc embedding 时，在同一业务事务中写入一条去重任务：

```text
pending -> processing -> completed / failed
```

建议唯一键为 `(corpus_id, field_type)`，重复更新只刷新 `requested_at`，避免同一 source
堆积多个任务。worker 使用 `FOR UPDATE SKIP LOCKED` 分批领取任务并支持失败重试。

队列上线后：

- 日常任务只消费队列，不再扫描 `corpus_field_embeddings`。
- 每天仍执行轻量陈旧检测，防止漏单。
- 每周全量重建继续保留，用于修正 incoming 邻居和全局排序。

### 7.4 陈旧检测

```sql
select count(*)
from corpus_embedding_neighbors n
join corpus_field_embeddings e
  on e.corpus_id = n.source_corpus_id
 and e.field_type = n.field_type
where e.updated_at > n.source_embedding_updated_at;
```

陈旧 source 比例超过 5% 时告警，超过 10% 时暂停启用邻居信号或触发全量构建。

## 八、质量验收

准备固定查询集：

- 20 个短词。
- 20 个完整句子。
- 10 个繁简变体。
- 10 个没有 primary 的探索 query。
- 10 个容易漂移的单字/双字 query。

每个 query 对比：

- 当前临时推荐。
- 旧在线动态扩散推荐。
- 离线邻居推荐。

指标：

- `Precision@4` 人工相关率。
- `Diversity@4` 分类/标签去重程度。
- primary/similar/recommended 重复率。
- 空推荐率。
- semantic P50/P95。

上线门槛：

- 推荐相关率不低于旧在线动态扩散。
- semantic P95 <= 5s。
- 邻居读取 SQL P95 <= 100ms。
- 重复率为 0。
- active build 覆盖至少 95% canonical doc source。

## 九、灰度与回滚

建议环境变量：

```text
SEARCH_OFFLINE_NEIGHBORS_ENABLED=false
SEARCH_OFFLINE_NEIGHBORS_WEIGHT=45
SEARCH_OFFLINE_NEIGHBORS_MAX_RANK=24
```

灰度顺序：

1. 只构建数据，不参与排序。
2. 后台 shadow 记录候选差异，不返回用户。
3. 内部账号启用。
4. 10% 请求启用。
5. 50% 请求启用。
6. 全量启用并观察 7 天。

回滚只需关闭 feature flag 或把上一 build 重新标记为 active，不需要删除邻居数据。

## 十、实施阶段

| 阶段 | 工作 | 预计结果 |
|---|---|---|
| 1 | Prisma 模型、SQL migration、本地构建脚本 | 已完成并建表 |
| 2 | 小样本 1,000 source 构建 | 已完成，32,000 邻居 |
| 3 | 全量 top 32 构建并激活 | 已完成，748,960 邻居、覆盖率 100% |
| 4 | 打开线上 feature flag | 待代码部署后执行，恢复完整探索推荐 |
| 5 | 固定查询集质量与性能验收 | 待执行，异常可立即关闭 flag |
| 6 | 本地手动增量、每月全量重建 | 长期运行方式 |

数据库仍遵循当前项目的 `pull -> 更新 -> push` 迭代方式。当前 Prisma schema 已增加三张
表，执行 `db:push` 前必须先审查 SQL diff；migration 文件保留完整约束、部分唯一索引和
可审计 DDL。建表后先执行小样本验证，禁止直接用生产 Web 请求回填。完整操作顺序见
`local-neighbor-builder-runbook.md`。
