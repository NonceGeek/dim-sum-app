# 02b · 无法判断内容属性语料导出手册

状态：来源映射已完成，Production 剩余 253 条；导出查询已就绪，最终工作簿待生成

## 一、目的

来源级规则和确定性条目规则完成后，仍为 `content_attribute=unclassified` 的存量语料不得自动猜测。先导出待处理清单，供产品、内容团队或后续专门流程确认。

本步骤不自动创建 AW 标注任务，也不调用 Agent 批量判定。

## 二、执行时点

按以下顺序执行：

1. `content_attribute` 字段已部署。
2. 已评审的来源映射规则完成回填；映射可使用版本化 SQL/CSV，不要求新建永久来源表。
3. 混合来源中的确定性条目规则完成回填。
4. 对回填结果完成抽样审计。
5. 导出剩余 `unclassified` 清单。

如果在来源规则执行前导出，会把大量本可确定的数据错误纳入人工清单。

## 三、导出内容

CSV 建议包含：

| 字段 | 用途 |
|---|---|
| `corpus_id` | 内部关联 |
| `entry_id` | 稳定公开 ID |
| `entry_name` | 判断主题 |
| `source_category` | 现有来源字符串 |
| `source_corpus_name` | `cantonese_categories.nickname` |
| `current_primary/secondary_category` | 辅助判断，不作为结论 |
| `media_types` | 辅助信息，不可单独决定属性 |
| `original_text_preview` | 最多 500 字预览 |
| `created_at/updated_at` | 追踪批次 |
| `unclassified_reason` | no_source_rule/mixed_source/insufficient_context/conflict |

默认清单不导出完整媒体 URL、未授权贡献者身份、内部密钥或 Agent 原始响应。

## 四、查询草案

先创建只读查询或临时视图，由 DBA 按实际表结构确认：

```sql
select
  c.id as corpus_id,
  c.unique_id as entry_id,
  c.data as entry_name,
  c.category as source_category,
  source.nickname as source_corpus_name,
  parent.name as current_primary_category,
  child.name as current_secondary_category,
  c.media_types,
  left(c.data, 500) as original_text_preview,
  c.created_at,
  c.updated_at,
  case
    when source.name is null then 'no_source_config'
    else 'mixed_or_insufficient_context'
  end as unclassified_reason
from public.cantonese_corpus_all c
left join public.cantonese_categories source on source.name = c.category
left join public.corpus_category cg on cg.corpus_id = c.id
left join public.content_categories child on child.id = cg.category_id
left join public.content_categories parent on parent.id = child.parent_id
where c.content_attribute = 'unclassified'
order by c.category, c.id;
```

## 五、文件与清单

建议文件名：

```text
s6-content-attribute-unclassified-YYYYMMDD-HHMM.csv
s6-content-attribute-unclassified-YYYYMMDD-HHMM.manifest.json
```

Manifest 至少记录：

```json
{
  "exportedAt": "...",
  "databaseEnvironment": "production-read-replica",
  "queryVersion": "s6-unclassified-export-v1",
  "rowCount": 0,
  "sha256": "...",
  "sourceRuleVersion": "..."
}
```

文件放入受控私有位置，不提交到 Git，不上传公共文档或聊天。导出前确认接收人和保留期限。

## 六、执行参考

由有只读权限的 DBA/后端人员在只读副本执行。使用 `psql \copy` 时必须把第四节查询保存为已评审 SQL，并指定明确的受控输出路径。

执行后验证：

```text
CSV 行数 = manifest.rowCount
CSV entry_id 无重复
导出时数据库 unclassified count = CSV 行数
抽查 20 条与数据库一致
文件 hash 已记录
```

## 七、回填输入格式

人工处理后的最小回填文件：

```text
entry_id,content_attribute,decision_source,reviewer_ref,reviewed_at,note
```

其中：

- `content_attribute` 只能是 oral/cultural_knowledge/leave_unclassified。
- `decision_source` 固定为 manual_export_review。
- `leave_unclassified` 表示继续保留，不等于错误。
- 回填前校验 entry_id、重复行和当前版本，避免覆盖导出后发生的更新。

## 八、回填安全规则

1. 先导入 staging 表，不直接 update 主表。
2. 生成变更预览：oral、cultural、留空、冲突和不存在 entry_id 数量。
3. 由第二人确认统计和随机样本。
4. 使用事务分批更新并写审计事件。
5. 触发 Search 索引和缓存更新。
6. 保留原导出、回填文件、manifest 和批次 ID，支持追溯。

## 九、完成标准

- 每一条无法判断语料都出现在受控导出清单中。
- 没有因为媒体类型、来源名称猜测而自动误标。
- 导出与回填均有版本、hash、批次和审计记录。
- 显式属性过滤上线前，目标范围中的 `unclassified` 必须完成回填或明确保持在默认未过滤搜索中。
