# 04 · 现有 Search API 的 S6 增量契约

状态：已按现有正式接口上线，并通过 `search.aidimsum.com` Production 验收

## 一、实施原则

S6 沿用现有正式入口：

```http
GET /api/search/entries
```

本期不新建 `/api/search/v3/entries`，不更改现有 `primary / similar / recommended` 三段结构，也不要求现有调用方迁移。AI 原型中提出的新响应外壳、`similar -> related`、opaque cursor、`countsByMedia`、`scopeAvailability` 和 `traceId` 都不是当前业务目标的必要条件，列为未来候选，不作为 S6 待办。

不传 S6 新参数时，接口继续使用原有搜索范围、Primary RPC、召回、排序和分页行为。

## 二、请求参数

```http
GET /api/search/entries
  ?q=骑楼
  &contentAttribute=oral
  &mediaType=audio
  &section=all
```

| 参数 | 必填 | 值 | 当前行为 |
|---|---:|---|---|
| `q` | 是 | 非空字符串 | 搜索词，trim 后不能为空 |
| `dataset` | 否 | 现有数据集名，逗号分隔 | 沿用现有 Primary 数据集限制 |
| `contentAttribute` | 否 | `oral` / `cultural_knowledge` | 明确提供时，在排序和 limit 前统一过滤三段；省略时不按属性过滤 |
| `mediaType` | 否 | `text` / `audio` / `video` / `image` / `model3d` | 只过滤 `similar`；本期不要求前端展示属性或 model3d 选择器 |
| `section` | 否 | `all` / `primary` / `semantic` | 沿用现有分段加载协议 |
| `semanticPart` | 否 | `all` / `similar` / `recommended` | `section=semantic` 时指定语义分段 |
| `primaryCorpusId` | 否 | 正整数 / `none` | 沿用现有语义请求上下文 |
| `similarCursor` | 否 | 非负数字 offset | 沿用现有 similar 分页 |
| `recommendedCursor` | 否 | 非负数字 offset | 沿用现有 recommended 分页 |

`contentAttribute=unclassified` 和其他非法属性返回 HTTP 400。非法 `mediaType` 也返回 HTTP 400。

## 三、现有响应结构

```json
{
  "query": "骑楼",
  "primary": null,
  "similar": [],
  "recommended": [],
  "loadingSections": {
    "primary": false,
    "semantic": false
  },
  "sectionStatus": {
    "primary": "idle",
    "semantic": "success"
  },
  "cursors": {
    "similarNext": null,
    "recommendedNext": null
  }
}
```

S6 不改变以上外壳。现有页面仍可按原字段消费结果。

## 四、Entry DTO 的兼容扩展

每个 Entry 在原 DTO 上新增：

```json
{
  "contentAttribute": "cultural_knowledge",
  "mediaTypes": ["text", "audio", "model3d"],
  "assets": {
    "audioUrl": "...",
    "videoUrl": null,
    "coverImage": null,
    "model3dUrl": "..."
  }
}
```

`model3dUrl` 不是单独建立的一套媒体模型，而是补齐原有 `assets` 对象。当前四类资源采用同一种兼容读取策略：

| 类型 | Search DTO 字段 | 正式结构 | 兼容旧结构 |
|---|---|---|---|
| audio | `assets.audioUrl` | `structured_note` 的 audio block | `audio/audioUrl/音频/音频1...5/粤语/普通话` 等 |
| video | `assets.videoUrl` | video block | `video/videoUrl/视频/视频链接/video_clips` 等 |
| image | `assets.coverImage` | image block | `img/image/imageUrl/cover/photo_url/图片/封面` 等 |
| model3d | `assets.model3dUrl` | model3d 或 voxel block | `voxel/model3d/model_3d/gltf/glb/usdz` 等 |

当前 DTO 对每种媒体返回第一个可用 URL，服务搜索卡片的快速展示；`mediaTypes` 是数据库中的检索/筛选索引，表示词条包含哪些媒体。两者不能互相替代。

一条词条可以同时拥有多种媒体，例如 Production 的“帆船（哥德堡一号）”返回 `mediaTypes=[text,audio,model3d]`。本期保留现有单 URL DTO，不把所有媒体重构为新的 `assets[]` 数组；如果详情页后续需要同类多个资源、时长、关键帧或转写，应基于真实消费需求单独设计资产列表契约。

## 五、过滤顺序

每个召回 SQL 或候选聚合器执行：

1. 沿用改造前 Search 的数据范围、排除规则和召回逻辑；S6 不新增 `lifecycle_stage/is_public` 门槛。
2. 仅当请求提供 `contentAttribute` 时，增加 `content_attribute = request.contentAttribute`；该条件自然排除 `unclassified`。
3. `similar` 额外应用媒体条件：`text` 使用 `media_types = ARRAY['text']`；其他媒体使用数组包含判断。
4. 去除当前 Primary 和重复 Entry。
5. 排序、limit、offset。

属性和媒体条件必须在排序分页前执行，不能先取少量结果再在应用层删除。

## 六、默认模式与方案 B

默认不传 `contentAttribute`：

- Primary 按现有全库权重选择最佳结果；
- similar/recommended 沿用现有全库召回；
- 迁移期允许命中 `unclassified`；
- 每条 DTO 仍返回自身属性和媒体类型。

传入 `mediaType=video`：

- Primary 不受影响；
- similar 只返回包含 video 的词条；
- recommended 不受影响。

`mediaType=text` 专指只有正文、没有其他媒体的纯文本词条。audio/video/image/model3d 按包含关系判断，所以同一词条可以满足多个媒体条件。

## 七、错误与降级

- 缺少或空白 `q`：HTTP 400。
- 非法 `contentAttribute`：HTTP 400。
- 非法 `mediaType`：HTTP 400。
- 语义搜索超时：沿用当前 fallback；Primary 保持可用。
- 暂时性数据库错误：沿用当前分段错误状态和 no-store 响应。

## 八、明确不属于本期的候选设计

以下内容只有在真实调用方提出需求、且兼容现有结构无法满足时再单独立项：

- `/api/search/v3/entries` 新入口；
- `similar` 改名为 `related`；
- `{status, items}` 分段响应包装；
- opaque cursor；
- `countsByMedia`、`scopeAvailability`、`traceId`；
- 删除 `raw.note/raw.structuredNote`；
- 通用多资源 `assets[]` DTO；
- 内容属性和 model3d 的前端筛选入口。

这些候选项不是当前实现缺陷，也不作为 S6 上线阻塞项。
