# Next.js 公共语料访问隔离

本次范围是 Next.js 新版搜索 `/api/search/entries`（主搜索、相似/推荐、语义查询及回退）
以及 Next.js 公共详情 `/api/entries/[entryId]`、`/[locale]/entries/[entryId]`。
这些入口只允许 `cantonese_categories.is_public = true` 的语料，登录、编辑授权、管理员身份
都不会放宽条件。无有效所属语料集的记录也不公开。

Deno 旧版搜索、搜索框联想及旧详情接口暂不调整，不包含在本次隔离保证中。

私有语料通过独立管理/编辑接口按权限读取：

- `GET /api/marker/corpus/items/[uuid]`：当前有效用户，所属语料集 WRITE 或更高权限，或系统管理员。
- `GET /api/marker/corpus/items?category=...`：同样按语料集校验权限。
- `POST /api/marker/corpus/update`：根据 UUID 查询真实所属语料集再校验 WRITE，不信任请求中的 category，不能省略 category 绕过权限。请求继续进入既有待审核更新流程，无需修改 Deno 后端。

Next.js 公共详情拒绝私有数据时返回 404。新版搜索及详情 HTTP 响应禁止缓存；新版搜索客户端离开后不保留查询缓存，后台切换开关时重置当前客户端的搜索缓存。
已加载到其他用户屏幕或自行保存的数据不能追回；本次未加入跨客户端推送清屏。

## 数据库与发布

项目继续使用 `pnpm db:pull` / `pnpm db:push` 管理 Prisma schema。本次没有表结构变更，
没有新增 Prisma migration。Prisma 不同步 SQL 函数体，所以新增 RPC 使用独立、可重复执行的发布脚本。

新函数源码：[`search_public_entry_primary.sql`](../../prisma/functions/search_public_entry_primary.sql)。
签名是 `search_public_entry_primary(text[], text[], text)`，分别接收查询变体、语料集范围和内容属性。
函数始终限制公开语料集，依次尝试完全匹配、忽略大小写、前缀、全文、包含，命中即返回。
`NULL` 范围表示全部公开语料集；空数组、仅私有或不存在的范围直接返回空集。
并列排序最后按 ID 升序保证稳定。函数以调用者权限执行，返回行数声明为 1。

`search_entry_primary` 与 `get_entry_identities` 保持现有定义；新版 primary 使用新函数，
外层仍校验公开范围；semantic/recommended、回退和详情继续在 SQL 内过滤公开状态。

在 `main` 目录执行（连接来自当前环境配置）：

```sh
pnpm db:public-search:check
pnpm db:public-search:publish
# 仅用于更新由本脚本创建并标记的同名函数；不同来源的函数默认拒绝覆盖
pnpm db:public-search:publish --replace-managed
pnpm test:public-corpus:live
```

发布脚本事务内检查旧函数定义未改变、空范围返回为空；任一检查失败则回滚。
重复发布相同源码是空操作，回执保存源码哈希、旧函数哈希及替换前定义。
先发布数据库函数、验证通过，再发布 Next.js 应用。回滚时先回滚应用，确认无新调用后才移除新函数，
或使用回执中的旧定义恢复新函数的上一版本，不能先删掉仍被应用调用的函数。

本次已经在配置指向的数据库创建并验证新 RPC；Next.js 接入代码尚未部署。
部署后如平台另有 CDN 缓存，应清除新版搜索/详情的旧缓存，并检查公开、私有和编辑入口。

## 验证

在 `main` 目录运行：

```sh
pnpm exec tsc --noEmit --incremental false
pnpm run test:search-regression
PUBLIC_CORPUS_TEST_DATABASE_URL=postgresql://USER@127.0.0.1:PORT/dimsum_public_corpus_test pnpm run test:public-corpus:integration
```

集成测试只接受本机、名称以 `dimsum_public_corpus_test` 开头的空数据库。
测试创建 fixture，载入仓库内已有的详情 RPC 定义及新公共搜索函数，不删除现有表；
重跑应使用新的空测试数据库。
覆盖私有高排名候选、缺失所属语料集、指定私有语料集、语义/回退/离线推荐、分页、
详情、游客/普通用户/编辑者/研究员/管理员、撤销权限及公开转私有。
还验证五级匹配、大小写、引号输入、稳定并列排序、空范围、内容属性、只读事务，
以及即使已有详情 RPC 返回私有记录，Next.js 公共详情仍会过滤它。
测试使用确定性的文本/向量算子替身，验证 SQL 权限过滤和分页；不验证生产
PGroonga/pgvector 的相关性、索引使用和查询性能，发布前仍应在实际扩展环境进行冒烟验证。

## 线上只读性能对比

```sh
node --import tsx scripts/public-corpus/inspect-database.ts
pnpm benchmark:public-corpus -- --smoke
pnpm benchmark:public-corpus
python3 scripts/public-corpus/summarize-benchmark.py
```

脚本使用现有 `.env` 中的数据库连接。所有线上 SQL 均在 READ ONLY 事务中串行执行，
单条 statement timeout 为 5 秒，不修改数据、表、索引或函数。
历史对比脚本比较完整 primary 查询（含详情聚合）的三种候选选择方式：原直接 SQL、已有 RPC
加公开语料集范围、可封装成新公共 RPC 的分阶段 SQL。该历史脚本的第三种测量对象是候选 SQL，
实际新 RPC 的验证使用 `pnpm test:public-corpus:live`，两类数据应分开解读。

每个场景先执行一轮观察/预热，再交替顺序采样三轮；报告数据库执行时间中位数、
最小值/最大值和计划时间，网络/连接/事务往返时间单独保留。不清空共享缓存，不模拟并发压力。
同一方案/场景两次出错后跳过后续重复，累计 12 次失败停止，避免反复施加慢查询负载。
查询结果只保存数量和标识哈希，不保存语料正文。
原始计划压缩保存在 `results/*.json.gz`，统计在 `results/benchmark-summary.json`。

历史对比见 [性能报告](../../../../../docs/project/dimsum-app/search-platform/public-search-performance-2026-09-16.md)，
落地及实际 RPC 验证见 [实施记录](../../../../../docs/project/dimsum-app/search-platform/public-search-rpc-2026-09-16.md)。
