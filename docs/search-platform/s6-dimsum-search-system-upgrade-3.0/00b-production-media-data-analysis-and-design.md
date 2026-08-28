# 00b · Production 媒体数据分析与 `media_types` 设计

状态：基于 2026-08-28 Production 统计；字段、派生函数、trigger 和存量回填已实施并验证

## 一、结论

`media_types` 应保留为 `text[]` 多值派生列，当前必须支持：

```text
text / audio / video / image / model3d
```

它不是媒体事实来源，而是 Search related 在排序、分页和 limit 前执行媒体过滤的可索引缓存。资源 URL、时长、封面、转写和 3D viewer 地址继续读取 `structured_note/note`。

Production 已存在一条真实多媒体语料：`帆船（哥德堡一号）` 同时具有正文、粤语/普通话音频和 voxel 3D 模型。因此字段不能设计成单值枚举，也不能只识别标准英文 key。

## 二、为什么第一次统计会漏数据

`structured_note` 的正式结构非常收敛：

```text
root: data
data item: blocks, jyutping
block type: audio, definition, emotion, introduction, other, phrase, sentence
```

当前只有 audio block 存在 `url`，没有正式 video/image/model3d block。但大量旧媒体仍保存在 `note.context` 的项目自定义 key 中，包括：

```text
audio
音频 / 音频1...音频5
粤语 / 普通话
video
img / photo_url
voxel
```

只扫描 `structured_note` 或只识别 audio/video/image 会严重少算。正确口径必须对正式结构与旧 context 取并集。

## 三、Production 最终统计

总语料 50,994 条。只有存在非空 URL/link 才认定为相应媒体。

| 媒体组合 | 数量 | 占比 |
|---|---:|---:|
| `text + audio` | 40,995 | 80.39% |
| `text` | 9,983 | 19.58% |
| `text + image` | 10 | 0.02% |
| `text + video` | 5 | 0.01% |
| `text + audio + model3d` | 1 | <0.01% |

目前没有 audio+video、audio+image 或 video+image，但模型必须允许未来组合。

### 3.1 URL 型旧 context key

| key | 词条数 | 归一化类型 |
|---|---:|---|
| `audio` | 21,186 | audio |
| `音频` | 19,780 | audio |
| `音频1` | 28 | audio |
| `音频2` | 28 | audio |
| `音频3` | 7 | audio |
| `音频4` | 3 | audio |
| `音频5` | 2 | audio |
| `粤语` | 1 | audio |
| `普通话` | 1 | audio |
| `img` | 5 | image |
| `photo_url` | 5 | image |
| `video` | 5 | video |
| `voxel` | 1 | model3d |

同一条语料可能同时命中正式 block 和旧 key，因此表中数量不能直接相加，最终以词条去重组合为准。

### 3.2 `帆船（哥德堡一号）`

```text
id: 162
entry_id: 9fb359b2-f561-4264-8e5e-ec899fb0cab1
category: sshzlj
lifecycle_stage: draft
structured_note: null
```

旧 `note.context`：

```json
{
  "voxel": "https://oss.aidimsum.com/vox-ship",
  "粤语": "https://oss.aidimsum.com/粤语.m4a",
  "普通话": "https://oss.aidimsum.com/普通话.m4a",
  "描述": "哥德堡号模型及历史说明"
}
```

最终派生：

```text
{text,audio,model3d}
```

`voxel` URL 没有 GLB/GLTF 后缀，证明不能只按文件扩展名识别 3D；必须保留已确认的业务 key 映射。

当前 `main/lib/search/entry-identity.ts` 只聚合标准 audio/video/image key，尚未返回 `voxel`，也未完整覆盖 `音频1...音频5`、`粤语/普通话` 和 `photo_url`。因此这条帆船语料即使被现有 Search 命中，也会丢失 3D 和两条音频能力；S6 实施时必须同时扩展 Entry DTO 解析，不能只回填数据库索引列。

### 3.3 空资源规则

有 1 条 `note.video_clips` 数组，其元素 `link` 为空，不计为 video。仅有数组、block type 或描述文字都不足以证明媒体可用。

### 3.4 现有 5 条视频的展示约束

Production 的 5 条 `text + video` 语料均为旧结构，全部使用 `note.context.video` 保存 MP4，并使用 `note.context.subtitle` 保存完整转写；`structured_note` 均为空。因此 S6 不能只实现未来的正式 video block，也不能把字幕误当作普通释义。

只读核验结果：

| 项目 | 结果 |
|---|---|
| 视频数量 | 5 |
| 文件大小 | 约 1.5 MB、2.8 MB、27.6 MB、59.3 MB、72.2 MB |
| MIME | 全部 `video/mp4` |
| Range 请求 | 全部支持 `Accept-Ranges: bytes` |
| 转写 | 5 条均有非空 `subtitle` |
| 直接打开源文件 | 其中 4 条 OSS 响应带强制下载头 |

据此采用以下实现：精准结果和词条详情使用浏览器原生播放器，设置 `preload=metadata` 与 `playsInline`；转写默认折叠，用户按需展开。相关表达和继续探索卡片使用固定高度的视频槽，但初始 video 元素不设置 `src`，不请求 metadata；用户点击明确的“全屏播放”后才赋值并加载，Fullscreen API 不可用时降级为卡片内播放器。

公开 Search UI 不展示源文件 URL 或下载入口。播放失败只显示轻量状态，不把 OSS 技术资源暴露为用户操作。

Entry DTO 增加 `assets.videoTranscript`，兼容正式 `subtitle/transcript/transcription` block 和旧 `note.context.subtitle/transcript/transcription/字幕/转写/视频转写`。该字段只是读取现有事实数据，不增加数据库列。

### 3.5 现有 10 条图片的展示约束

Production 的 10 条 `text + image` 语料全部是旧结构：5 条使用 `note.context.img`，5 条使用 `note.context.photo_url`，`structured_note` 均为空。资源来自两个 Aliyun OSS bucket，抽查两侧响应均为正确的 `image/png` 或 `image/jpeg`，但同时带 `Content-Disposition: attachment` 和 `x-oss-force-download: true`。

因此图片可直接在页面 `<img>` 中展示，但不能提供直连 OSS 的公开按钮，否则会触发下载。S6 在相关表达和继续探索卡片的正文与标签之间提供固定图片槽；图片使用懒加载和 `object-contain`，点击打开站内灯箱，加载失败时显示明确占位。精准结果和详情页复用同一灯箱组件，不展示源文件入口。该实现继续读取 `assets.coverImage`，不增加数据库字段或图片代理服务。

## 四、字段定义

```sql
media_types text[] not null
```

| 值 | 认定条件 |
|---|---|
| `text` | `data` 非空 |
| `audio` | 正式 audio block，或已确认 audio 兼容 key 存在非空 URL |
| `video` | 正式 video block、video 兼容 key或有效 `video_clips[].link` |
| `image` | 正式 image block，或 img/photo_url 等兼容 key存在非空 URL |
| `model3d` | 正式 model3d/voxel block，或旧 voxel/model3d 兼容 key存在非空 URL |

数组固定按 `text, audio, video, image, model3d` 排序并去重。合法示例：

```text
{text}
{text,audio}
{text,image}
{text,audio,model3d}
{text,audio,video,image,model3d}
```

## 五、Search 参数语义

因为每条正式语料都有正文，`mediaType=text` 定义为纯文本：

```text
mediaType=text    -> media_types = ARRAY['text']
mediaType=audio   -> media_types @> ARRAY['audio']
mediaType=video   -> media_types @> ARRAY['video']
mediaType=image   -> media_types @> ARRAY['image']
mediaType=model3d -> media_types @> ARRAY['model3d']
参数省略           -> 不按媒体过滤
```

存储、DTO 和前端筛选均支持 `model3d`。精准结果与词条详情通过 iframe 懒加载来源已有的 Viewer 页面并保留外链降级；相关结果列表只显示资源按钮，不批量预载约 9.6 MB 的帆船 GLB。DimSum 不重复引入 Three.js/model-viewer 依赖。回填仍不得丢掉现有 voxel 资产。

若未来真实前端需要 `countsByMedia`，其中 `text` 应专指纯文本，其他类型按包含关系计数，因此多个媒体计数之和允许大于候选总数。当前接口未返回该计数，且它不是 S6 上线条件。

## 六、派生和同步设计

`structured_note/note` 是事实来源，`media_types` 是派生缓存。应用入口不得手工维护该列。

数据库提供唯一派生函数和 trigger，在 `data/note/structured_note` 变化时重新计算。采用 trigger 是因为当前存在 Next API、外部 backend、历史导入和直接整理等多个写入入口。

兼容 key 必须集中维护成明确映射，不使用任意 URL 或正文关键词猜测媒体类型：

```text
audio: audio/audioUrl/音频[数字]/粤语/普通话
video: video/videoUrl/视频/视频链接/video_clips
image: img/image/imageUrl/cover/coverImage/photo_url/图片/封面/封面图
model3d: voxel/model3d/model_3d/3d_model/gltf/glb/usdz
```

未来正式结构建议统一为：

```json
{
  "type": "model3d",
  "url": "...",
  "format": "voxel-or-glb",
  "posterUrl": "..."
}
```

旧 `voxel` 删除前必须先迁移为正式 block，并验证派生结果不变。

## 七、索引和查询

对 `media_types` 建 GIN 索引，服务 audio/video/image/model3d 包含查询。纯文本条件使用精确数组等值；当前 9,983 条，占比约 19.58%，是否增加独立部分索引由影子查询决定。

媒体条件必须在 related 排序、limit 和 cursor 之前执行，不能先取三条再由 Node.js 删除。

## 八、迁移和验收

1. 部署字段、派生函数和 trigger，新写入自动计算。
2. 审计 50,994 条存量，并按每批 1,000 条回填其中 41,011 条派生不一致记录。
3. 回填后重新得到本文件第三节组合基线。
4. 固定验收 `帆船（哥德堡一号） -> {text,audio,model3d}`。
5. 抽查 structured-only、中文音频 key、photo_url、voxel 和空 video_clips。
6. 建 GIN 索引并运行 `ANALYZE`。
7. 直接使用 Production 固定请求验证过滤发生在 limit 前，分页无漏项。
8. 开启 Search 媒体筛选前要求 JSON 与派生列一致率 100%。

## 九、Production 实施结果

2026-08-28 已按 `db pull → diff 审查 → db push` 完成两字段和两索引部署，并通过补充 SQL 安装检查约束、媒体派生函数和 trigger。随后分批回填 41,011 条 `media_types`，最终 50,994 条派生不一致数为 0；两个检查约束均已 validated。

实施记录和可复核脚本见 [migration/07-production-execution-record.md](migration/07-production-execution-record.md)。
