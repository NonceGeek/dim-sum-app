# 词条身份信息 Admin 后台设计

## 一、设计原则

现有 Admin 已包含：

- `/admin/corpus`：语料数据管理，对应 `cantonese_corpus_all`
- `/admin/categories`：语料分类管理，对应 `cantonese_categories`
- `/admin/permissions`：分类权限
- `/admin/audit-logs`：审计日志

本需求不建议新增平行的 `/admin/search-entries` 后台。第一阶段应增强现有 `Corpus Data` 和 `Categories` 页面，必要时在现有导航下增加子页面。

---

## 二、后台导航建议

现有导航：

```text
/admin/corpus
/admin/categories
```

建议调整为：

```text
Corpus Data
  /admin/corpus
  /admin/corpus/identity
  /admin/corpus/tags
  /admin/corpus/share-cards
  /admin/corpus/search-config

Categories
  /admin/categories
```

如果不想改导航层级，也可先在 `/admin/corpus` 增加 tabs：

```text
Entries / Identity / Tags / Share Cards / Search Config
```

---

## 三、现有 Corpus Data 页面增强

当前 `/admin/corpus` 已支持：

- 按 `data` 搜索
- 按 `category` 筛选
- 展示 `data`、`category`、浏览、点赞、收藏、创建时间
- 通过接口删除语料

### 3.1 列表字段增强

建议新增字段：

| 字段 | 来源 | 说明 |
|------|------|------|
| Unique ID | `unique_id` | 可复制，和分享/SEO/搜索详情一致 |
| 词条内容 | `data` | 现有字段 |
| 释义摘要 | 从 `note` / `structured_note` 解析 | 用于运营快速判断 |
| 读音 / 粤拼 | 从 `note` / `structured_note` 解析 | 身份信息核心字段 |
| 分类 | `category` + `cantonese_categories.nickname` | 当前一层分类 |
| 标签 | `tags` | 支持结构化标签预览 |
| 生命周期 | `lifecycle_stage` | 草稿、审核、上线 |
| 分享 | 基于 `unique_id` 生成 | 预览卡片、复制链接 |
| 互动 | `view_num`、`liked_num`、`bookmark_num`、分享数 | 已有 + 新增 |

### 3.2 筛选增强

- 生命周期状态
- 是否缺少读音
- 是否缺少释义
- 是否缺少标签
- 标签类型：精准 / 关联 / 推荐
- 标签相关度：重度 / 中度 / 轻度
- 是否有分享卡片
- 是否可 SEO 收录

### 3.3 行操作

- 查看详情
- 编辑身份信息
- 编辑结构化标签
- 复制 Unique ID
- 预览 Search 展示
- 预览分享卡片
- 复制分享链接
- 上线 / 下线
- 删除或归档

---

## 四、词条详情与身份信息编辑

详情页或抽屉建议分区：

| 区域 | 字段 |
|------|------|
| 基础信息 | `data`、`unique_id`、`created_at`、`updated_at` |
| 内容信息 | 释义、读音、粤拼、音频、视频、图片 |
| 来源信息 | 分类、贡献者、原始 note |
| 标签信息 | 精准标签、关联标签、推荐标签、相关度、来源 |
| 状态信息 | `lifecycle_stage`、是否公开、是否可 SEO |
| 分享信息 | 卡片链接、SEO 链接、预览、分享数据 |
| 互动信息 | 浏览、点赞、收藏、分享 |

保存策略：

- 第一阶段可以写入 `structured_note.identity` 和结构化 `tags`。
- 不建议直接覆盖原始 `note` 中未知结构，避免破坏不同语料类别的展示。
- 对 `data`、`category` 等核心字段的修改应保留审核或日志。

---

## 五、标签治理后台

现有 `tags` 是 JSON，不存在独立标签表。本期有两种路径：

### 方案 A：仍使用 JSON 标签

在 `/admin/corpus` 批量编辑标签：

- 给选中词条添加标签
- 修改标签类型
- 修改相关度
- 删除标签
- 批量把旧字符串标签转换成结构化标签

优点是改动小，缺点是不利于全局去重和标签统计。

### 方案 B：新增标签字典表

新增 `corpus_tags` 和 `corpus_tag_relations`，把标签关系正规化。

优点是治理能力强，缺点是迁移和接口改动更大。

本期建议先做方案 A，并在文档和代码中保证兼容旧标签。

---

## 六、Categories 页面增强

当前 `/admin/categories` 已支持：

- 搜索分类
- 查看分类 nickname、公开状态、语料数量、权限数量、状态
- 切换公开状态

建议新增：

- 编辑 nickname
- 编辑 description
- 编辑 `recommend_words`
- 编辑 `related.apps` / `related.links`
- 是否进入全局搜索 `if_in_all_data`
- SEO slug 或公开路径配置
- 分类下身份信息完整度统计

如果确认需要 PRD 的一级/二级分类，再增加：

- 父分类配置
- 分类树视图
- 批量迁移词条分类

---

## 七、审核与清洗流程

现有 `cantonese_corpus_all.lifecycle_stage` 可承接状态流转。

建议状态：

```text
draft -> reviewing -> approved -> published -> offline
```

清洗流程：

```text
导入或已有词条
  -> 生成 entryIdentity 解析结果
  -> 标记缺失字段
  -> AI 建议分类/标签/释义摘要
  -> 人工复核
  -> 写入 structured_note.identity 与 tags
  -> 更新搜索展示和分享卡片
```

异常样本：

- 无释义
- 无读音或粤拼
- 无标签
- 标签仍为旧字符串格式
- 分类不存在或分类未公开
- `note` 结构无法解析
- 分享卡片生成失败

---

## 八、分享卡片后台

现有卡片工具：

```text
https://card.app.aidimsum.com/?uuid={unique_id}
/inner-apps/card-generator?uuid={unique_id}
```

后台增强：

- 根据 `unique_id` 预览卡片
- 复制外部卡片链接
- 打开站内卡片生成器
- 下载卡片图
- 查看分享事件
- 配置卡片字段展示

字段应来自统一 `entryIdentity`，不由卡片工具重复解析多套 note 结构。

---

## 九、权限

沿用现有 Admin 鉴权：

```text
session.user.isSystemAdmin = true
```

如果后续需要细粒度权限，可复用现有 `user_corpus_permissions` 思路：

- 按分类授权编辑。
- 按角色区分身份编辑、标签编辑、上线发布。
- 所有核心修改进入 audit log。

