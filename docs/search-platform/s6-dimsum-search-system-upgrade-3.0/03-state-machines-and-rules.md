# 03 · S6 精简状态规则

状态：根据真实实现重新审计，Agent/AW 部分待契约确认

## 一、本期不新建内容审核状态机

原方案为词条新增 `review_status` 和 `rights_status`，但当前没有相应的后台入口、确认人和消费链路。本期不创建无人维护的平行状态。

`lifecycle_stage` 继续表示现有加工阶段，不迁移、不双写、不在本期废弃；来源 `is_public` 也保持现状。二者是否应共同成为公开搜索条件尚未由 PRD 确认，当前 Search 也未统一使用，因此本期不新增该门槛。

训练许可和条目级权利属于后续数据治理。业务上仍保持“禁训不等于禁止公开”，但本期不实现新字段。

## 二、内容属性状态

```text
unclassified
  ├─可靠来源/条目规则-> oral
  ├─可靠来源/条目规则-> cultural_knowledge
  └─无法判断-> 导出待确认，保持 unclassified
```

规则：

- `unclassified` 是存量迁移态，不是第三种公开属性；
- 默认未过滤搜索迁移期可继续按现有 Search 范围返回 `unclassified`；
- 显式 oral/cultural_knowledge 过滤永远不返回 `unclassified`；
- 新内容在加工期可以暂为 `unclassified`，正式整理完成前必须确定属性；
- 媒体类型不能自动决定内容属性。

## 三、分类业务状态

分类业务仍有以下状态，但不预设必须新建本地任务表：

```text
source_provided     原始资料已有分类
pending_sample      Agent 候选明确，进入抽检池
pending_review      Agent 判断存在歧义，需要标注员处理
confirmed           已确认，可写正式分类
empty               无法判断或不适用
```

### 原始资料已有分类

```text
source_provided -> confirmed -> corpus_category
```

### Agent 唯一明确候选

```text
Agent suggestion -> pending_sample
  ├─抽中-> 现有 Agent task -> reviewer confirmed/modified -> confirmed
  └─未抽中-> 保持候选，仅用于允许的相关/推荐逻辑
```

### Agent 判断有歧义

```text
Agent suggestion -> pending_review
  -> 现有 Agent task
  -> confirmed / modified / empty
```

规则：

- 未确认候选不得提前写入正式 `corpus_category`；
- pending_review 不公开展示二级分类；
- empty 是合法结果，不创建无意义任务；
- confirmed 后由 Fynn 服务执行正式分类写回；
- 是否增加一张本地轻量分类状态表，等 Agent 契约确认后决定。

## 四、任务状态归 Agent 服务维护

当前 Review App 已使用外部 Agent `/tasks`：

```text
created -> notified -> in_progress -> completed
                    -> reassigning / cancelled
```

本期不在 DimSum 数据库复制 `corpus_review_tasks/corpus_review_events/corpus_agent_runs`。

职责：

- Agent：创建、分配、状态、运行记录和任务完成结果；
- AW：展示任务并提交标注结果；
- Fynn：鉴权、上下文、结果校验和最终 `corpus_category` 写回；
- Agent/AW 都不能绕过 Fynn 直接改变正式分类或公开搜索字段。

## 五、搜索范围判定

```text
default_search_scope(entry) = 改造前 Search 的现有检索规则
```

默认请求：

```text
can_search = default_search_scope(entry)
```

显式属性请求：

```text
can_search =
  default_search_scope(entry)
  AND entry.content_attribute == request.contentAttribute
```

默认模式不因 `unclassified` 隐藏大量尚未回填的存量内容。

`lifecycle_stage + source.is_public` 作为公开范围候选规则记录在数据库分析和决策清单中；只有后续完成权限责任确认、影响评估和产品决策，才另行启用。

## 六、分类公开规则

| 分类来源/状态 | 公开二级分类 | 公开文案 |
|---|---:|---|
| confirmed + source_provided | 是 | 原始资料整理 |
| confirmed + reviewer_confirmed | 是 | 已审核整理 |
| pending_sample | 否 | 不显示 |
| pending_review | 否 | 不显示 |
| empty | 否 | 不显示 |

在本地分类状态存储尚未确认前，公开 DTO 只读取正式 `corpus_category`，不从 Agent task 动态拼接候选分类。

## 七、分享判定

本期复用 `unique_id`、现有固定链接以及当前分享链路已有的可用性判断。Fynn 分享上下文至少检查：

```text
entry_id 可解析
现有分享对象可用
```

如果 Agent 返回该 Entry 存在 `pending_review` 分类任务，分享卡片隐藏或禁用由最终 AW/Fynn 契约确定；不能为此提前建立整套分享事件表。

AW 每次通过 Fynn 的公开 entry context 获取 `canShare` 和可展示字段，不直接读取底层表。

## 八、Search 三段规则

### Primary

- 复用 exact、繁简 exact、prefix、全文匹配和现有排序；
- 默认在现有 Search 检索范围中返回最佳匹配；
- 显式属性请求只在指定属性中匹配；
- 未确认二级分类不得作为唯一精准条件。

### Related

- 可继续使用文本、向量邻居、标签和正式分类；
- `pending_sample` 是否参与，等 Agent 契约和本地数据可用性确认；
- 方案 B 的 `mediaType` 只在本段过滤；
- 显式属性请求必须继续应用属性过滤。

### Recommended

- 继续使用推荐标签、邻居、正式分类和热度；
- 不受媒体筛选影响；
- 显式属性请求必须继续应用属性过滤；
- 默认模式不强制继承 primary 的属性。

## 九、失败与降级

- Agent 超时或失败：保持当前正式分类不变，由 Agent 服务按既有机制重试；
- AW 提交失败：任务保持 Agent 返回的未完成状态，不假装成功；
- Fynn 写回失败：返回明确错误，正式 `corpus_category` 不变，可用幂等键重试；
- related/recommended 失败：保留可用分段；
- 媒体解析失败：回退文本卡片；
- 分享服务失败：不影响搜索，分享入口降级。

任何降级都不得扩大改造前的默认检索范围，也不得绕过显式内容属性过滤。

## 十、延后状态

以下状态仅在对应业务真正启动时设计：

- 条目级权利确认；
- 训练许可；
- 独立发布审批；
- 派生内容审核；
- 投稿转正式语料 ingestion；
- 分享事件存储。

不得仅依据 AI 原型中的标签、按钮或文案提前创建这些状态。
