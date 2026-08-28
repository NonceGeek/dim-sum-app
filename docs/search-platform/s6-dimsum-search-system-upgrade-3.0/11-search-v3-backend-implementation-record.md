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
assets.videoTranscript
```

`model3dUrl` 与原有 `audioUrl/videoUrl/coverImage` 同属 `assets` 对象，只是补齐 3D 类型，不是另建顶层字段或独立资源协议。四种字段当前都返回从正式 block 与旧 context 兼容结构中找到的第一个可用 URL；`mediaTypes` 则用于数据库筛选。

`videoTranscript` 同样位于 `assets`，读取正式 `subtitle/transcript/transcription` block 或旧 `note.context` 的对应字幕 key。它复用已有 JSON，不新增数据库列。Production 现有 5 条视频全部使用旧 `video + subtitle` 结构，因此这项兼容是现有数据可展示的必要条件。

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

### 2.2 Production 线上验收

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

验收目标：`https://search.aidimsum.com`。可重复验收脚本：`main/scripts/test-s6-search-live.ts`。

### 2.3 部署记录

- 功能提交：`9079446`，推送到 `dev`。
- Pull Request：`#388`，Vercel Preview 检查通过后合并。
- `main` 合并提交：`a803252`。
- Production：由 `aid-im-sum-lab/dim-sum-app` 的 GitHub 集成自动部署，状态 `success`。
- 正式流程固定为 `dev -> PR -> main -> Vercel 自动部署`，不得绕过该流程从本地 CLI 手动发布 Production。

### 2.4 上线后稳定性抽样

2026-08-28 在最终 `main` 自动部署完成后，对 `https://search.aidimsum.com` 进行只读复核：

| 请求 | HTTP | 单次样本耗时 |
|---|---:|---:|
| 默认“船” Primary | 200 | 0.37–0.50s |
| oral“船” Primary | 200 | 0.35s |
| cultural“帆船” Primary | 200 | 0.20s |
| oral + audio semantic | 200 | 2.88s |
| 非法 `contentAttribute=unclassified` | 400 | 0.33s |

部署切换后的第一次完整冒烟请求曾收到一次 503；15 秒后重试及其后连续抽样均通过。当前按 Serverless/数据库连接冷启动瞬态记录，不据此修改搜索业务逻辑。后续若重复出现，应结合团队 Vercel 函数日志和数据库连接指标立项排查。

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

### 3.1 独立分支上的媒体前端

`s6-media-filter-ui` 已实现方案 B 的 text/audio/video/image/model3d 前端筛选。精准结果和词条详情通过 iframe 懒加载来源已有的 3D Viewer 页面。当前不复制来源端的 Three.js/model-viewer 依赖，也不改变 Production。

视频复用一个原生播放器组件：精准结果和词条详情使用 `preload=metadata + playsInline`，现有转写默认折叠展示。相关表达和继续探索使用固定视频槽，初始 video 元素不设置 `src`；点击“全屏播放”后才加载，原生全屏不可用时降级为卡片内播放器。这避免同时预载 5 个约 1.5–72.2 MB 的资源。

音频和图片也复用共享媒体卡片。音频在精准结果和详情页使用原生控件，相关卡片使用明确的“试听/暂停”并保证同时只播放一条；图片在两组相关卡片的正文和标签间使用固定预览槽，点击打开站内灯箱，失败显示占位。Production 的 10 条图片源均来自旧 `img/photo_url`，且 OSS 设为强制下载，因此公开 Search UI 已移除所有媒体源文件和下载入口。

## 四、回退

应用代码如需回退，应通过 Git revert/回退 PR 进入 `main`，由团队 Vercel 项目自动部署；不要使用个人 Vercel 项目或本地 CLI 覆盖 Production。Production 新字段与已回填数据保留，默认未传新参数的请求不依赖功能开关。
