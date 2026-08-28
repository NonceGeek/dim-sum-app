# S6 数据库实施 Runbook

状态：已于 2026-08-28 在 Production 执行并验证；本文保留为可重复操作与审计记录
目标：为 `cantonese_corpus_all` 增加 `content_attribute`、`media_types`，不改变现有 Search 默认行为。

## 文件

| 顺序 | 文件 | 用途 |
|---|---|---|
| 0 | `00-prisma-push-preview.sql` | 2026-08-28 对 Production 执行的只读 schema diff 留档 |
| 1 | `01-supplemental-schema.sql` | `db push` 后补齐非空约束，并安装 check、派生函数和 trigger |
| 2 | `02-backfill-batch.sql` | 按 ID 范围分批回填 `media_types` |
| 3 | `03-verify.sql` | 核对字段、合法值、媒体组合和固定样本 |
| 4 | `04-export-unclassified.sql` | 导出仍无法判断属性的存量语料 |
| 5 | `05-safe-rollback.sql` | 派生逻辑异常时停止 trigger；不删除字段和回填数据 |
| 6 | `06-validate-constraints.sql` | 全量核对通过后确认两个数据库约束 |

## 执行前

在 `main` 目录操作。Production 是 schema 真源：

```bash
pnpm db:pull
git diff -- prisma/schema.prisma
```

确认 pull 只同步线上真实结构后，再加入目标字段。禁止使用 pull 前的旧 schema 直接 push。

执行：

```bash
pnpm exec prisma format
pnpm exec prisma validate
pnpm db:push
```

`db:push` 只负责 Prisma schema 能表达的两个字段、默认值和索引。执行前必须阅读 Prisma 输出；出现删除字段、重建表、数据丢失提示或需要 `--accept-data-loss` 时立即停止，不得强制继续。

注意：Prisma 6.8 为 `String[]` 生成的本次 SQL 没有给 `media_types` 增加 `NOT NULL`。因此 `01-supplemental-schema.sql` 会在默认值已经填入存量行后显式补齐数据库非空约束。

## 执行顺序

1. 完成 `db pull → diff 审查 → schema 编辑 → format/validate`。
2. 运行 `db push`，确认只新增两个字段和两个索引。
3. 执行 `01-supplemental-schema.sql`。
4. 先运行 `03-verify.sql` 的结构和 trigger 检查。
5. 用 `02-backfill-batch.sql` 按连续 ID 范围分批回填；每批提交后观察锁等待和错误。
6. 完整运行 `03-verify.sql`，结果必须符合审计基线。
7. 运行 `04-export-unclassified.sql`；本期不自动猜测无法判断的内容属性。
8. 直接使用 Production 固定搜索请求验证新可选参数；普通请求不传新参数，现有 Search 行为不变。

## 停止条件

- `db push` 提示 drop、table recreate、data loss 或 `--accept-data-loss`；
- 出现持续锁等待或旧 Search 错误率上升；
- `media_types` 出现空数组、未知值或顺序错误；
- `帆船（哥德堡一号）` 不是 `{text,audio,model3d}`；
- 回填组合与 `03-verify.sql` 中基线不一致；
- 未传新参数的旧 Search 结果范围发生变化。

## 回退

本次为向后兼容新增字段，不使用 Search 功能开关。应用回退时停止传入新参数或恢复旧 API/应用版本，新增字段继续保留。

只有媒体派生 trigger 本身异常时才执行 `05-safe-rollback.sql`。Production 默认不执行 `DROP COLUMN`，避免丢失回填结果和造成不必要的表锁。
