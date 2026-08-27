# 本地邻居构建操作手册

更新时间：2026-08-27

## 一、适用范围

当前阶段不部署常驻 worker。首次全量、日常增量和周期性全量都由开发者在本地手动
执行。Vercel 只读取已激活的邻居数据，不承担离线计算。

```text
本地脚本 -> 直连 PostgreSQL -> building/ready build
                                  -> 人工校验
                                  -> 原子激活
Vercel search API -> active build -> 最多读取 3 * 24 个邻居
```

## 二、安全边界

- 优先使用 `.env.local` 中的 `DIRECT_URL`，脚本也兼容 `DIRECT_DATABASE_URL` 和
  `DATABASE_URL`。
- 脚本使用固定 PostgreSQL advisory lock，同一时间只允许一个构建/激活任务。
- 全量数据写入独立 build；`full` 完成后只标记 `ready`，不会自动上线。
- 覆盖率低于 95% 的样本 build 默认禁止激活。
- active build 切换在一个事务内完成，旧 build 标记为 `retired`，可用于回滚。
- `SEARCH_OFFLINE_NEIGHBORS_ENABLED` 默认 `false`；数据库未准备好时线上 SQL 不引用
  新表。

## 三、日常手动维护速查

所有命令都在 `main` 目录执行：

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main
```

### 3.1 常规新增或修改 embedding 后

```bash
# 1. 查看 active build、watermark 和待处理数量
pnpm db:neighbors:status

# 2. 只处理 watermark 后发生变化的 source
pnpm db:neighbors:incremental --batch-size 200

# 3. 确认 changed_after_watermark=0、last_error=None
pnpm db:neighbors:status
```

无变化时增量命令会在轻量检查后退出，不下载完整向量。增量失败时 watermark 不推进，
修复网络或数据库问题后直接重跑相同命令。

### 3.2 每月或每季度完整重建

```bash
# 1. 创建隔离的新 build；不会自动影响线上
pnpm db:neighbors:full --top-k 32 --batch-size 200

# 2. 从完成日志取得 build ID，检查状态必须为 ready
pnpm db:neighbors:status

# 3. 抽查邻居质量后原子激活
pnpm db:neighbors:activate --build-id <build-id>

# 4. 确认新 build 为 active、覆盖率为 100%、变更数为 0
pnpm db:neighbors:status
```

全量中断且期间没有 embedding 变化时：

```bash
pnpm db:neighbors:full --resume <build-id> --top-k 32 --batch-size 200
```

如果中断期间发生了 embedding 导入，不要 resume，重新创建 full build。不要激活
`--limit` 生成的样本 build，也不要在不理解影响时使用 `--allow-partial`。

### 3.3 维护完成检查表

- `status` 中只有预期 build 为 `active`。
- `sources` 等于当前 `canonical_sources`。
- 每个 source 对应 32 条邻居，总量约为 `canonical_sources * 32`。
- `changed_after_watermark=0`。
- `last_error=None`。
- 线上异常时先关闭 `SEARCH_OFFLINE_NEIGHBORS_ENABLED`，不删除 active 数据。

## 四、首次准备

在 `main` 目录执行：

```bash
pnpm exec prisma validate
pnpm db:push
pnpm db:pull
pnpm db:neighbors:setup
pnpm db:neighbors:status
```

`db:push` 属于生产数据库结构变更，执行前必须确认 Prisma diff 只包含本方案三张表。
当前代码中的 `schema.prisma` 已经是“pull 后完成更新”的版本，因此建表之前不要再次执行
`db:pull`，否则会把尚未存在于数据库的三个模型从本地 schema 中移除。`db:push` 成功后
再 pull 一次，用数据库真实结构校准 schema。
SQL 审查基准是：

```text
prisma/migrations/20260827090000_add_corpus_embedding_neighbors/migration.sql
```

若团队选择执行 migration SQL，而不是 `db:push`，执行后应再次 `pnpm db:pull` 并检查
schema 没有非预期变化。两种建表方法只能选择一种，不可重复执行。

本地依赖安装在 `main/.venv-neighbors`，不会修改系统 Python。

## 五、1,000 条样本验证

```bash
pnpm db:neighbors:full --limit 1000 --top-k 32 --batch-size 200
pnpm db:neighbors:status
```

验收：

- 构建状态为 `ready`。
- source 为 1,000，neighbor 为 32,000。
- 全部 23,405 个 canonical doc 向量都会参与本地索引，`--limit` 只限制写入的 source，
  因而样本邻居仍从完整目标空间选出。
- 无维度不一致、NaN、重复 rank 或 source=target 错误。
- 记录导出、建索引、计算和写回耗时，并据此估算全量窗口。
- 样本 build 不激活。

## 六、首次全量

确保电脑接电并关闭自动休眠，然后执行：

```bash
pnpm db:neighbors:full --top-k 32 --batch-size 200
```

如中断，使用日志最后输出的 build ID：

```bash
pnpm db:neighbors:full --resume <build-id> --top-k 32 --batch-size 200
```

恢复要求 canonical 集合的数量和维度没有变化。如果期间发生向量导入，放弃该 staging
build 并重新执行 full，更容易保证快照一致性。

完成后：

```bash
pnpm db:neighbors:status
pnpm db:neighbors:activate --build-id <build-id>
pnpm db:neighbors:status
```

截至 2026-08-27 实测为 23,405 个 canonical doc source、每个 32 邻居，即约 748,960
行。激活前抽查至少 20 个 source 的
邻居语义相关性。

## 七、线上启用和回滚

全量 build 激活后，在 Vercel 配置：

```text
SEARCH_OFFLINE_NEIGHBORS_ENABLED=true
SEARCH_OFFLINE_NEIGHBORS_WEIGHT=45
SEARCH_OFFLINE_NEIGHBORS_MAX_RANK=24
```

重新部署后测试固定查询集，确认 semantic P95、推荐重复率和相关性。异常时把
`SEARCH_OFFLINE_NEIGHBORS_ENABLED` 改回 `false` 并重新部署；关闭后生成的 SQL 不会
引用邻居表。

如果需要切回旧数据，把目标 retired build 改成 `ready` 后通过 activate 命令重新激活；
不要直接删除当前 active build。

## 八、手动增量原理

查看变更数：

```bash
pnpm db:neighbors:status
```

执行增量：

```bash
pnpm db:neighbors:incremental --batch-size 200
```

增量任务会：

1. 读取 active build 的 watermark。
2. 以任务开始时数据库时间作为 cutoff，先执行不传输向量的轻量变更检查。
3. 没有变更时直接推进 watermark，不下载完整向量。
4. 存在变更时才导出 cutoff 之前的 canonical 向量并建立本地索引。
5. 只重算 `updated_at > watermark` 的 source outgoing 邻居。
6. 全部成功后才把 watermark 推进到 cutoff。

诊断时可以增加 `--limit`，但有限任务不会推进 watermark，下一次完整增量会安全重算。

## 九、执行频率

| 场景 | 命令 |
|---|---|
| 少量新增或更新 embedding 后 | `pnpm db:neighbors:incremental` |
| 大批量导入或模型/维度变化 | `pnpm db:neighbors:full` |
| 日常变化较频繁 | 每月手动 full |
| 数据变化很少 | 每季度手动 full |

增量只能更新变更 source 指向谁，不能完整修正其他 source 是否应该指向新目标，因此不能
永久替代全量重建。

## 十、故障处理

| 情况 | 处理 |
|---|---|
| 本地中断或断网 | 保留 build ID，确认无向量导入后使用 `--resume` |
| 显示已有 builder | 检查另一终端是否仍运行；连接断开后 advisory lock 会自动释放 |
| build 为 `failed` | 查看 `error_message`，修复后新建 full build |
| 样本误激活 | 95% 覆盖门槛会阻止；不要使用 `--allow-partial` 上线 |
| 增量失败 | watermark 不推进，修复后直接重跑 |
| 线上搜索异常 | 关闭 `SEARCH_OFFLINE_NEIGHBORS_ENABLED` 并重新部署 |

## 十一、完成定义

- 数据库三张表存在且索引、外键正确。
- 1,000 条样本验证通过。
- 全量 build 覆盖至少 95%，实际目标为 100%。
- active build 每个 source 有连续的 rank 1～32。
- 固定查询集 recommended 无 primary/similar 重复。
- 邻居读取 SQL P95 不超过 100ms，semantic P95 不超过 5s。
- 增量重复执行具备幂等结果，失败不会错误推进 watermark。

## 十二、首次实施记录（2026-08-27）

| 项目 | 结果 |
|---|---|
| canonical doc source | 23,405 |
| 样本 build | `134e06b8-4f18-4083-8a9e-ae0ded92c7b8`，1,000 / 32,000，未激活 |
| active full build | `0b7eceab-68c0-4a71-b653-a22e5ff77e68` |
| full neighbor count | 748,960 |
| coverage | 100% |
| FAISS HNSW 建索引 | 5.1 秒 |
| full 计算与 COPY | 约 3 分 35 秒，约 110.7 source/秒 |
| 端到端 | 约 5 分钟 |
| 无变更增量空跑 | 约 10 秒，不下载向量、不改写邻居 |
| 在线邻居读取 EXPLAIN | 72 行，index scan，Execution Time 8.807ms |

抽样邻居的诗句、主题和语义关系正常。抽查同时发现源语料中存在 `ttt`、
`text已修改测试v2`、`ddd` 等测试残留；这是 embedding 输入数据质量问题，后续应单独
清理并执行一次增量或全量重建。
