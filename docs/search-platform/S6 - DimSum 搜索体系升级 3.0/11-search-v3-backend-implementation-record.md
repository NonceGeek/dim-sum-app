# 11 · 现有 Search API 的 S6 兼容能力实施记录

实施日期：2026-08-28
当前入口：`GET /api/search/entries`
原则：不传新参数时保持现有 Search 行为，不增加功能开关

## 一、已实现

### 1.1 可选内容属性

```text
contentAttribute=oral
contentAttribute=cultural_knowledge
```

- 省略参数：不按属性过滤，旧 Primary RPC 和原有召回继续工作。
- 显式参数：Primary、similar、recommended 均在排序和 limit 前限制属性。
- `unclassified` 或其他值作为请求参数返回 HTTP 400。
- 显式属性 Primary 使用与旧 RPC 相同的精确、大小写、前缀、全文和包含排序，但在候选阶段加入属性条件。

### 1.2 方案 B 媒体过滤

```text
mediaType=text|audio|video|image|model3d
```

- 只限制 similar；Primary 和 recommended 不受媒体条件影响。
- `text` 要求 `media_types={text}`。
- 其他值使用数组包含判断。
- 条件位于 `row_number/limit/offset` 之前，不会先取 3 条再删掉不符合结果。
- 非法媒体值返回 HTTP 400。

### 1.3 Entry DTO

现有 DTO 新增：

```text
contentAttribute
mediaTypes
assets.model3dUrl
```

`model3dUrl` 与原有 `audioUrl/videoUrl/coverImage` 同属 `assets` 对象，只是补齐 3D 类型，不是另建顶层字段或独立资源协议。四种字段当前都返回从正式 block 与旧 context 兼容结构中找到的第一个可用 URL；`mediaTypes` 则用于数据库筛选。

旧媒体兼容读取补齐：

```text
音频1...音频5
粤语 / 普通话
photo_url
video_clips 对象数组
voxel / model3d / glb / gltf / usdz
```

帆船 Entry 当前返回：

```text
contentAttribute = cultural_knowledge
mediaTypes = [text,audio,model3d]
assets.model3dUrl = https://oss.aidimsum.com/vox-ship
```

## 二、验证证据

### 2.1 静态与构建

- `pnpm exec tsc --noEmit`：通过。
- Entry DTO 与既有 embedding 测试共 7 项：全部通过。
- `pnpm build`：通过，173 个静态页面生成完成。

### 2.2 本地代码 + Production 数据只读验收

| 用例 | 结果 |
|---|---|
| 默认搜索“船” | 精确返回广州话正音字典“船”，旧行为保持 |
| cultural 搜索“船” | 返回 cultural 的“船” |
| oral 搜索“船” | 返回 oral 范围内最佳“船家那些……” |
| oral + audio semantic | similar 3 条均 oral 且包含 audio |
| oral recommended | 4 条均 oral，不受 audio 条件限制 |
| cultural 搜索“帆船” | 返回帆船及完整 model3d DTO |
| `contentAttribute=unclassified` | HTTP 400 |
| `mediaType=document` | HTTP 400 |

可重复验收脚本：`main/scripts/test-s6-search-live.ts`。

## 三、未来候选设计，不是 S6 未完成项

复核真实代码后决定不为 AI 原型单独实现 `/api/search/v3/entries`。以下设计只有在出现明确调用方需求时再评审，不计入当前 S6 上线待办：

- 版本化路由和 `request/primary/related/recommended` 响应外壳；
- `similar` 对外统一命名为 `related`；
- `countsByMedia`；
- `scopeAvailability`；
- 签名 opaque cursor，而非当前数字 offset；
- `traceId` 和契约化错误 code；
- 移除公开 DTO 中的 `raw.note/raw.structuredNote`；
- Search Web/App 迁移至破坏性新 DTO；
- 前端属性选择器（明确后续实施）；
- `model3d` 前端筛选入口（后续交互需求）。

## 四、回退

代码尚未部署到线上应用。若后续部署后需要回退，恢复上一应用版本即可；Production 新字段与已回填数据保留。默认未传新参数的请求不依赖功能开关。
