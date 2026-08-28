# 词条身份信息与搜索分发业务逻辑

## 一、项目背景

Search 平台当前已经具备基础语料搜索能力：用户在 `/search` 输入关键词后，前端调用 Deno backend 的 `/v2/text_search`，返回 `cantonese_corpus_all` 语料结果，并按分类 tabs 与分页展示。

新 PRD 的核心不是从零建设搜索，而是在现有语料搜索基础上补齐：

- 词条身份信息标准化
- 一级精准结果展示
- 二级相似结果
- 三级扩展推荐
- 分享卡片预览和分发
- SEO 词条页和聚合页
- Admin 数据治理能力

---

## 二、现有业务基础

| 能力 | 当前状态 |
|------|----------|
| 语料主数据 | `cantonese_corpus_all` |
| 公开唯一 ID | `unique_id` |
| 搜索入口 | `/search?q=&dataset=` |
| 旧搜索数据源 | Deno backend `/v2/text_search` |
| 新搜索数据源 | Next `/api/search/entries` 直连 Supabase RPC |
| 词条详情数据源 | Deno backend `/v2/corpus_item?unique_id=` |
| 分类 | `cantonese_categories`，当前一层分类 |
| 标签 | `tags` / `corpus_tags` / `tag_related`，旧 `cantonese_corpus_all.tags` 仅作为导入兼容 |
| 搜索结果卡片 | `SearchResultItem` |
| 分享卡片 | `card.app.aidimsum.com/?uuid=`、`/inner-apps/card-generator?uuid=` |
| 互动 | 浏览、点赞、收藏已有；分享统计待补充 |
| Admin | `/admin/corpus`、`/admin/categories` |

---

## 三、产品目标

| 目标 | 说明 |
|------|------|
| 统一身份 | 基于 `unique_id` 建立统一身份对象 `entryIdentity` |
| 提升搜索体验 | 一级结果完整展示身份信息，二级/三级结果帮助继续发现 |
| 支撑内容分发 | 分享卡片和 SEO 页面复用同一份身份信息 |
| 支撑运营治理 | Admin 可维护身份字段、结构化标签、分类与上线状态 |
| 保持兼容 | 不破坏现有 Deno `/v2/text_search`、卡片工具、互动接口和编辑链路 |

---

## 四、用户场景

### 4.1 用户精准搜索词条

用户输入关键词后，系统优先展示精准命中的语料词条，并把 `unique_id`、粤拼、释义、来源分类、标签、分享入口集中展示。

本场景对应现有 `/search` 页面改造：

- 当前扁平结果列表升级为“一级精准结果 + 其他结果”。
- `SearchResultItem` 增加身份信息区域。
- 已存在但注释掉的 Unique ID 展示能力可以恢复并优化。

### 4.2 用户继续浏览相似词条

用户查看某个一级结果后，希望继续看到标签相近、分类相近或语义相似的内容。

本期建议：

- 先基于结构化标签召回。
- 若标签未结构化，则用旧字符串标签做弱相关召回。
- 向量召回后续由搜索 backend 增强。

### 4.3 运营进行内容传播

运营或用户点击分享入口后，系统展示卡片预览，并提供：

- 下载图片
- 复制卡片链接
- 复制 SEO 落地页链接
- 记录分享事件

本场景复用现有：

```text
https://card.app.aidimsum.com/?uuid={unique_id}
/inner-apps/card-generator?uuid={unique_id}
```

---

## 五、搜索结果分层

### 5.1 当前状态

当前搜索返回 `SearchResult[]`，前端本地做：

- 分类 nickname 映射
- 分类 tabs 筛选
- 每页 5 条分页

没有服务端分层。

### 5.2 目标结构

```text
一级精准结果 primary
  -> 完全匹配或高置信命中的 1 个最佳答案
  -> 展示完整 entryIdentity

二级相似结果 similar
  -> 基于精准/关联标签召回
  -> 展示一批相似词条，支持换一批

三级扩展推荐 recommended
  -> 基于推荐标签召回
  -> 展示一批更宽泛的探索内容，支持换一批
```

### 5.3 迁移策略

第一阶段不改 Deno `/v2/text_search`，新能力落在 Next Route Handler：

```text
Next /api/search/entries
  -> 使用 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
  -> 服务端调用 Supabase RPC search_cantonese_corpus
  -> 合并繁简结果并去重
  -> primary 在候选排序前按 dataset 过滤现有 category
  -> 通过 content_categories / corpus_category 读取一级/二级身份分类
  -> 通过 tags / corpus_tags / tag_related 读取标签和相关标签
  -> exact match 进入 primary
  -> similar / recommended 保持全库召回，不受 dataset 限制
  -> 标签相同 / 语义分类相同进入 similar
  -> 推荐标签进入 recommended
```

旧接口只做兜底：

```text
Deno /v2/text_search
  -> 保持原扁平数组返回
  -> 新接口失败时前端 fallback
```

---

## 六、词条身份信息展示规则

身份信息从现有字段解析：

| 展示项 | 来源 |
|--------|------|
| 词条内容 | `data` |
| Unique ID | `unique_id` |
| 粤拼 | `structured_note.data[].jyutping` 优先，其次 `note.context.pron/pinyin` |
| 释义 | `structured_note.data[].blocks[type=definition]` 优先，其次 `note.context.meaning` |
| 来源 | `category` + `cantonese_categories.nickname` |
| 一级分类 | `content_categories(level=1)` |
| 二级分类 | `content_categories(level=2)` |
| 贡献者 | `cantonese_corpus_update_history.contributor_user_id` 聚合，展示为编辑贡献者 |
| 标签 | P0 将 `corpus_tags` 已有标签聚合为 related；recommended 由 `tag_related` 扩展 |
| 分享链接 | 按 `unique_id` 生成 |

缺失字段处理：

- 不阻断词条展示。
- 前台隐藏缺失字段。
- Admin 标记身份完整度，供运营补齐。

---

## 七、分享卡片逻辑

### 7.1 Web 端

用户点击“分享卡片”：

```text
打开居中弹窗
  -> 加载 entryIdentity
  -> 展示卡片预览
  -> 可下载图片
  -> 可复制 card.app 链接
  -> 可复制 SEO 链接
  -> 记录分享事件
```

### 7.2 移动端

用户点击“分享卡片”：

```text
底部上滑分享层
  -> 展示移动端卡片
  -> 保存图片
  -> 复制链接
  -> 系统分享
```

### 7.3 与现有卡片工具关系

现有卡片工具负责渲染图片，本需求需要补齐：

- 标准化输入数据：`entryIdentity`
- 统一字段取值规则
- 分享预览入口
- 分享事件统计
- SEO 链接

---

## 八、SEO 与分发

建议新增页面：

| 页面 | 路径建议 | 数据主键 |
|------|----------|----------|
| 词条页 | `/entries/{uniqueId}` | `unique_id` |
| 分享落地页 | `/share/entries/{uniqueId}` | `unique_id` |
| 分类页 | `/categories/{categoryName}` | `category` |
| 标签页 | `/tags/{tagName}` | `tags.name` |

SEO 页面要求：

- 可被搜索引擎访问。
- 复用 `entryIdentity`。
- 输出 title、description、canonical。
- 提供相似词条和分享卡片入口。

---

## 九、验收标准

### 9.1 Search

- 搜索结果页可展示一级精准结果。
- 一级结果完整展示可解析的身份字段。
- 旧 `SearchResult[]` 搜索流程仍可工作。
- 二级结果至少可基于标签或分类返回。

### 9.2 Admin

- `/admin/corpus` 可查看和编辑身份信息。
- `/admin/corpus` 可编辑结构化标签。
- `/admin/categories` 可维护分类展示和 SEO 所需字段。
- 缺失身份字段可被筛选。

### 9.3 分享

- 任意公开词条可通过 `unique_id` 打开分享卡片。
- Search 页面可弹出分享预览。
- 可复制链接、下载图片。
- 分享行为可被统计。

### 9.4 SEO

- 词条页可通过 `unique_id` 打开。
- 页面包含词条内容、释义、分类、标签和相似词条。
- meta 信息使用身份信息生成。
