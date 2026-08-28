# S6 Production 数据库实施记录

执行日期：2026-08-28
执行范围：`cantonese_corpus_all.content_attribute`、`media_types` 及媒体派生能力
执行原则：不改变旧 Search 默认行为；不使用功能开关；schema 先 pull 再 push

## 一、Schema 同步

1. 对 Production 成功执行 `pnpm db:pull`，introspect 得到 68 个模型。
2. pull 后 `schema.prisma` 的 52 增/52 删均为 Prisma 对齐、关系排序和格式变化，没有发现新的业务字段漂移。
3. 在最新 schema 上增加：
   - `content_attribute String @default("unclassified")`；
   - `media_types String[] @default(["text"])`；
   - `content_attribute` B-tree 索引；
   - `media_types` GIN 索引。
4. Production 到目标 schema 的只读 diff 只有两列和两个索引，无 drop、表重建或数据丢失操作。
5. `pnpm db:push` 执行成功。

只读 diff 留档见 [00-prisma-push-preview.sql](00-prisma-push-preview.sql)。

## 二、补充数据库对象

由于 Prisma 不能完整表达检查约束、函数和 trigger，`db push` 后执行 [01-supplemental-schema.sql](01-supplemental-schema.sql)：

- 显式设置 `media_types not null`；
- 安装内容属性合法值约束；
- 安装媒体数组合法值与顺序约束；
- 安装旧/新 JSON 媒体识别函数；
- 安装 `data/note/structured_note` 变更时自动刷新 `media_types` 的 trigger。

## 三、媒体回填

回填前：

```text
总数                         50,994
media_types 派生不一致       41,011
content_attribute 未分类     50,994
```

使用 [main/scripts/backfill-s6-media-types.ts](../../../../main/scripts/backfill-s6-media-types.ts) 每批 1,000 条独立更新，仅修改派生不一致的 `media_types`。执行结果：

```text
processed                   41,011
remaining mismatches             0
```

## 四、最终验收

| 检查项 | 结果 |
|---|---:|
| 总语料 | 50,994 |
| 非法 `content_attribute` | 0 |
| 空 `media_types` | 0 |
| 非法媒体值或顺序 | 0 |
| JSON 与派生列不一致 | 0 |

最终媒体组合：

| `media_types` | 数量 |
|---|---:|
| `{text,audio}` | 40,995 |
| `{text}` | 9,983 |
| `{text,image}` | 10 |
| `{text,video}` | 5 |
| `{text,audio,model3d}` | 1 |

固定样本：

```text
帆船（哥德堡一号）
unique_id = 9fb359b2-f561-4264-8e5e-ec899fb0cab1
media_types = {text,audio,model3d}
```

`corpus_content_attribute_ck` 和 `corpus_media_types_ck` 均已完成 `VALIDATE CONSTRAINT`。

## 五、未执行事项

- 没有修改旧 Search API 或默认查询语义。
- 没有根据 `lifecycle_stage/is_public` 增加搜索门槛。
- Schema 部署当步没有自动猜测属性；随后只按第六节的高置信来源映射写入，最终保留 253 条 `unclassified`。
- 没有创建 Agent、审核、媒体资产或分享新表。
- `unclassified` 导出查询已准备，但当前会话缺少 Spreadsheets artifact runtime，尚未生成最终表格文件。

## 六、Content Attribute 首批来源回填

同日完成 29 个来源的只读画像和边界样本复核，规则见 [08-content-attribute-source-analysis.md](../08-content-attribute-source-analysis.md)。映射版本为 `s6-content-attribute-source-v1`。

第一次执行因 Prisma interactive transaction 默认 5 秒超时而回滚；回滚后只读确认仍有 50,994 条 `unclassified`，不存在部分提交。随后将事务超时显式设为 120 秒，用同一映射重试成功：

| 属性 | 数量 |
|---|---:|
| `oral` | 41,038 |
| `cultural_knowledge` | 9,703 |
| `unclassified` | 253 |

保留未分类的是 `lnwm`、`fsys`、`dbl` 三个将书面文化原文和粤语口语改写放在同一个 Entry 的来源。此次没有按媒体类型猜测属性，也没有覆盖任何非 `unclassified` 结果。
