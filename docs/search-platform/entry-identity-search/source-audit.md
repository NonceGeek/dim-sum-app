# 现有源码业务梳理

## 一、当前实现结论

这次 PRD 不适合直接新建一套独立 `entry` 业务域。现有项目已经有语料主表、搜索页、分类后台、语料后台、分享卡片工具和互动统计，新的“词条身份信息体系”应该作为现有语料系统的增强层落地。

建议核心映射：

| PRD 概念 | 现有实现 | 设计结论 |
|----------|----------|----------|
| 词条 / Entry | `cantonese_corpus_all` | 不新建独立主实体，优先扩展现有语料主表 |
| 词条唯一 ID | `unique_id` | 继续使用 `unique_id` 作为公开身份 ID |
| 词条内容 | `data` | Search 和卡片主标题继续使用 `data` |
| 词条扩展信息 | `note` / `structured_note` | 身份信息中的读音、释义、贡献者等优先从结构化 note 解析 |
| 分类 | `category` -> `cantonese_categories.name` | 现阶段是一层分类，不具备 PRD 里的一级/二级分类 |
| 标签 | `tags` JSON | 现阶段是扁平标签，需要扩展类型与相关度 |
| 搜索结果 | Deno `/v2/text_search` | 现有搜索来自 Deno backend；本期新分层搜索建议改由 Next Route Handler 直连 Supabase RPC |
| 词条详情 | `/v2/corpus_item?unique_id=` | 可作为身份详情数据源 |
| 分享卡片 | `card.app.aidimsum.com/?uuid=` 与 `/inner-apps/card-generator` | 本期应复用并增强现有卡片工具 |
| Admin 词条管理 | `/admin/corpus` | 不建议新增孤立后台，建议增强 Corpus Data 页面 |
| Admin 分类管理 | `/admin/categories` | 建议增强现有 Categories 页面 |
| 互动统计 | `user_corpus_interactions` + `liked_num/bookmark_num/view_num` | 可复用浏览、点赞、收藏数据，分享需补充统计 |

---

## 二、关键源码位置

| 模块 | 文件 | 说明 |
|------|------|------|
| Prisma 主模型 | `prisma/schema.prisma` | `cantonese_corpus_all`、`cantonese_categories`、`user_corpus_interactions` |
| Search API client | `lib/api/search.ts` | 调用 `/v2/text_search` 与 `/v2/corpus_item` |
| Search 页面 | `app/[locale]/(home)/search/page.tsx` | URL 参数驱动搜索、分类 tabs、本地分页 |
| 搜索结果卡片 | `app/[locale]/(home)/_components/search-result-item.tsx` | 展示 data、note、tags、音视频、分享入口、编辑入口 |
| 分类 API | `lib/api/category.ts` | 获取 `/corpus_categories`，前台用于 category nickname 映射 |
| Admin 分类接口 | `app/api/admin/categories/route.ts` | 管理分类公开状态 |
| Admin 分类页 | `app/[locale]/admin/categories/page.tsx` | 分类搜索、公开开关、条目数量 |
| Admin 语料接口 | `app/api/admin/corpus/route.ts` | 查询和删除 `cantonese_corpus_all` |
| Admin 语料页 | `app/[locale]/admin/corpus/page.tsx` | 语料列表、搜索、分类筛选 |
| 卡片生成器 | `app/[locale]/(home)/inner-apps/card-generator/page.tsx` | 通过 `uuid` 获取语料并生成图片 |
| 互动接口 | `app/api/public/corpus/stats/route.ts`、`app/api/public/corpus/view/route.ts`、`app/api/user/corpus/interactions/route.ts` | 浏览、点赞、收藏统计 |
| 外部 backend | `lib/api/backend.ts` | `NEXT_PUBLIC_BACKEND_URL` fallback 到 `https://backend.aidimsum.com` |
| Deno 搜索服务 | `deno/main.tsx` | `textSearchV2Handler` 调用 Supabase RPC `search_cantonese_corpus` |

---

## 三、现有数据模型

### 3.1 `cantonese_corpus_all`

当前语料主表字段：

| 字段 | 当前用途 | 对 PRD 的意义 |
|------|----------|---------------|
| `id` | 内部自增 ID | 后台展示和内部排序 |
| `unique_id` | 公开 UUID | 对应词条 Unique ID |
| `data` | 语料文本 | 对应词条内容 |
| `note` | JSON 扩展内容 | 存放释义、拼音、贡献者、音视频等 |
| `structured_note` | JSON 扩展结构 | 可承接新的身份信息标准字段 |
| `category` | 分类名 | 当前分类路径唯一字段 |
| `tags` | JSON 标签 | 需扩展为类型化标签 |
| `lifecycle_stage` | 生命周期状态 | 对应草稿、审核、上线状态 |
| `liked_num` | 点赞数 | 互动指标 |
| `bookmark_num` | 收藏数 | 互动指标 |
| `view_num` | 浏览数 | 互动指标 |
| `editable_level` | 编辑权限等级 | 现有协作编辑能力 |

### 3.2 `cantonese_categories`

当前分类表字段：

| 字段 | 当前用途 |
|------|----------|
| `name` | 分类主键业务名 |
| `nickname` | 前台展示名 |
| `description` | 分类说明 |
| `tags` | 分类标签 JSON |
| `related` | 相关 app/link 配置 |
| `recommend_words` | 推荐词 |
| `if_in_all_data` | 是否进入全局搜索数据集筛选 |
| `is_public` | 是否公开 |
| `editable_level` | 分类编辑权限等级 |
| `status` | 分类状态 |

---

## 四、现有 Search 行为

当前 `/search` 页面：

1. 从 URL 读取 `q` 和 `dataset`。
2. 调用 `useSearchQuery(keyword, categoryParam)`。
3. `useSearchQuery` 请求 Deno backend 的 `/v2/text_search?table_name=...&column=data&keyword=...`。
4. 前端拿到扁平 `SearchResult[]`。
5. 前端通过 `useAllCategories()` 把 `category` 映射成 nickname。
6. 前端用 `CategoryTabs` 做分类筛选。
7. 前端每页展示 5 条。

当前没有：

- 一级精准结果 / 二级相似结果 / 三级推荐结果的结构化返回。
- 搜索接口内的身份信息聚合对象。
- 标签类型和相关度。
- SEO 词条详情页。
- 搜索结果页的通用分享卡片预览弹窗。

---

## 四点五、Deno 搜索实现

`deno/main.tsx` 中的 `textSearchV2Handler` 当前负责：

1. 读取 `keyword`、`table_name`、`limit`。
2. 使用 `tify` / `sify` 生成繁简搜索词。
3. 调用 Supabase RPC `search_cantonese_corpus`。
4. 合并繁简结果。
5. 按 `unique_id` 去重。
6. 按现有 `category` 过滤 dataset。
7. 排除包含 `test` 的 category。
8. 返回扁平数组。

本期不建议继续扩展 Deno `/v2/text_search`，原因：

- 新需求同时覆盖 Search UI、Admin、SEO、分享卡片，主要交付面都在 Next。
- Next 可以在 Route Handler 服务端安全使用 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 直连 Supabase RPC。
- Next 直连 RPC 少一次请求 Deno 的网络中转，性能和成本更优。
- Deno 保留旧接口能降低回归风险。

建议：

```text
Deno /v2/text_search
  -> 保持旧行为
  -> 作为 fallback

Next /api/search/entries
  -> 新分层搜索
  -> 身份信息聚合
  -> 一级/二级分类
  -> 标签召回
  -> 分享和 SEO 链接
```

---

## 五、现有分享逻辑

当前分享能力分散在两个地方：

1. 搜索结果中的粤语曲库结果直接生成 `https://card.app.aidimsum.com/?uuid={unique_id}`，点击后复制链接。
2. 站内 `/inner-apps/card-generator?uuid={unique_id}` 可通过 `dom-to-image` 下载卡片图片。

现有卡片只解析 `data`、`category`、`note`、`tags`，没有统一身份信息对象，也没有分享行为埋点。

---

## 六、设计修正原则

1. 以 `cantonese_corpus_all.unique_id` 作为词条身份主键。
2. 不在第一阶段新建孤立 `entry` 主表。
3. 优先在现有 `structured_note` 或新增轻量扩展表中承载身份信息。
4. Search 前台先适配 Next `/api/search/entries` 分层响应，同时兼容旧 Deno `SearchResult[]`。
5. Admin 侧优先增强 `/admin/corpus` 和 `/admin/categories`，不要平行新建重复后台。
6. 分享卡片工具复用现有 `uuid` 链路，新增预览弹窗、字段标准化和埋点。
