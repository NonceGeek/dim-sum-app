# 09 · 验收测试计划

状态：待产品、QA、Fynn、AW、Agent 确认

## 一、上线硬门槛

以下任一未通过，不得全量上线：

1. 已纳入显式属性搜索范围的内容，`content_attribute` 完整率 100%。
2. 显式传入内容属性时，三段返回不符合该属性的数量为 0。
3. 默认未过滤请求不因 S6 新增状态/来源门槛，结果范围与改造前基线兼容。
4. `pending_review` 分类公开展示数量为 0。
5. Agent、AW、Search、分享接口契约测试全部通过。
6. 性能达到 08 文档上线门槛。
7. 可通过停止传入新参数、恢复旧 API 调用或回滚应用版本恢复旧行为，且不会丢失任务和审核记录。

## 二、数据验收

| 编号 | 用例 | 预期 |
|---|---|---|
| D-01 | 新建正式 oral 词条 | 必填字段齐全，可在 oral 检索 |
| D-02 | 新建正式 cultural 词条 | 只在 cultural 检索 |
| D-03 | unclassified 词条 + 显式属性过滤 | 不返回 |
| D-04 | unclassified 词条 + 默认未过滤请求 | 迁移期按改造前 Search 规则处理 |
| D-05 | 默认请求的新旧实现对比 | 不因 S6 新增 `lifecycle_stage/is_public` 条件 |
| D-06 | `lifecycle_stage × is_public` 数据审计 | 输出交叉分布和影子查询差异，不据此拦截上线 |
| D-07 | video 媒体类型回填 | 只有非空 URL/link 时 `media_types` 才包含 video，相关结果可筛选 |
| D-08 | 贡献者未授权 | 前台和分享不返回姓名 |
| D-09 | unique_id 更新 | 被数据库/服务拒绝 |

## 三、默认搜索与属性过滤矩阵

固定构造同关键词下的 oral 和 cultural 数据。默认不传 `contentAttribute`：

| 模式 | Primary | Related | Recommended |
|---|---|---|---|
| 默认未过滤 | 按现有全库权重返回最佳结果，属性不限 | 属性不限 | 属性不限 |

明确传入过滤参数：

| 选择 | Primary | Related | Recommended |
|---|---|---|---|
| oral | 全部 oral | 全部 oral | 全部 oral |
| cultural_knowledge | 全部 cultural | 全部 cultural | 全部 cultural |

显式过滤补充用例：

- 当前范围不足时不得跨属性补足 3/4 条。
- 当前范围完全为空时 API 返回范围空状态信号；本期前端不展示切换入口。
- 参数从 oral 改为 cultural 时旧 cursor 失效。
- 缓存命中后仍保持属性隔离。
- semantic fallback 后仍保持属性隔离。

默认模式补充用例：

- API 请求不包含 `contentAttribute`。
- 精准结果可为 oral 或 cultural，取决于现有匹配排序。
- related/recommended 不强制继承 primary 的属性。
- 每条结果仍正确返回自身 contentAttribute。
- 默认未过滤请求迁移期允许 `unclassified` 按改造前 Search 规则返回；显式属性请求不得返回。

## 四、方案 B 媒体验收

以默认未过滤模式下 primary=text，related 同时包含 text/audio/video，recommended=text 为例：

| 操作 | 预期 |
|---|---|
| 筛选 video | primary 仍显示 |
| 筛选 video | related 只显示 video |
| 筛选 video | recommended 不变化 |
| 切换 audio | 只重新请求/更新 related |
| 显式 cultural 过滤下 audio 数量为 0 | related 局部空状态 |
| 刷新页面 | 本期 URL 还原媒体状态；属性 URL 状态随后续选择器实现 |
| 筛选 text | related 只返回 `media_types={text}` 的纯文本词条 |
| 同一词条含 audio+video | 同时出现在 audio/video 筛选和计数中，不进入纯文本计数 |
| `video_clips=[{link:""}]` | 不标记为 video |
| 帆船语料含 voxel + 粤语/普通话音频 | `media_types={text,audio,model3d}` |
| 筛选 model3d | related 只显示含 model3d 的词条，primary/recommended 保持稳定 |
| model3d 精准结果和详情页 | Viewer 懒加载，可旋转/缩放并保留外链降级；加载失败不影响其他媒体和搜索结果 |
| model3d 相关结果列表 | 只显示资源按钮，不批量下载模型文件 |

媒体列表不得预加载视频流。使用网络面板验证初始请求中没有 video 内容下载。

回填验收基线：`text=9,983`、`text+audio=40,995`、`text+image=10`、`text+video=5`、`text+audio+model3d=1`；另构造 `text+audio+video`、`text+video+image`、`text+audio+video+image+model3d` 测试数据，验证多值数组、过滤和计数。

## 五、分类与 Agent 验收

| Agent 结果 | 预期状态 | AW 任务 |
|---|---|---|
| 原始资料有分类 | confirmed/source_provided | 无 |
| single_candidate | pending_sample | 按 10%–20% 策略抽检 |
| ambiguous | pending_review | classification_confirm |
| insufficient_evidence | empty 或 needs_info | 默认无 |
| not_applicable | empty | 无 |
| blocked | needs_info | 无分类任务 |

必须测试：

- Agent 返回两个候选时被契约校验拒绝或规范为 ambiguous。
- 不存在的 categoryId 不落库。
- evidence 无法定位时标记 invalid。
- 重复回调只处理一次。
- taxonomy 旧版本结果不覆盖新结果。
- Agent 超时不创建伪任务。
- pending_sample 不公开显示、不进入训练集。

## 六、AW 标注验收

- 任务类型和来源语料库组合筛选正确。
- 任务详情只显示必要上下文。
- 确认、修改、暂不分类三条路径均可回写。
- 修改分类只能选择当前一级分类下 active 二级分类。
- 重复点击提交只产生一个决策。
- 两人同时处理同一任务时，后一人收到 409，不覆盖结果。
- 网络中断后可以确认任务最终状态。
- 已处理记录包含任务类型、来源、最终动作和时间。
- 回写成功后 Search 索引和缓存最终一致。
- 通知失败时任务仍可在列表找到。

## 七、公开展示验收

- confirmed/source_provided 显示“原始资料整理”。
- confirmed/reviewer_confirmed 显示“已审核整理”。
- pending_sample、pending_review、empty 不展示二级分类及内部状态。
- 不显示 AI 建议、置信度和依据。
- Unique ID 截断显示但可复制完整 ID。
- 无值字段不占位。
- 推荐区固定显示非直接匹配提示。

## 八、视频验收

- 列表有真实 keyframe、时长和视频优先标识。
- Web 打开右侧播放面板；App 打开底部 Sheet。
- 时间码转写顺序正确并可滚动。
- App Sheet 可遮罩、关闭按钮和下滑关闭。
- 视频失败显示明确提示并回退文本。
- 有音频时才显示音频切换；切换后播放真实音频状态。
- 媒体 URL 过期、404、慢响应均不造成白屏或无限 loading。

## 九、分享验收

- canShare=false 时前端没有可用分享入口。
- draft/pending_review/offline/restricted 内容不能生成公开卡片。
- 卡片字段与 Fynn share-context 完全一致。
- 未授权贡献者不出现在卡片。
- 二级分类未确认时按政策隐藏或禁止卡片。
- QR 自动解码后精确等于 canonical entry URL。
- 下载文件名包含 entryId 和模板版本。
- Web Dialog、App Sheet 符合当前设计系统。
- AW 服务失败时 Search 不受影响，并可降级复制固定链接。
- card_open/download/link_copy/share_send/link_open 均能去重记录。

## 十、SEO 与安全验收

- canonical URL 仅返回可公开词条。
- 下线/受限词条返回 404 或 410，不泄露正文和内部元数据。
- 页面 metadata 不含 Agent 依据和隐私贡献者信息。
- 搜索和分享接口不能通过传入字段绕过权限。
- 内部 Agent/AW 接口验证服务身份、签名、时间窗口和重放。
- 日志不记录令牌、完整授权文件或不必要的个人信息。

## 十一、性能验收

使用至少包含以下查询的固定集：

- 单字和短词，如“好”。
- 繁简变体。
- 长句。
- oral/cultural 均有结果的关键词。
- 只有一个属性有结果的关键词。
- 没有 primary 但有 related 的关键词。
- text/audio/video 不同媒体分布。

每个查询执行冷缓存和热缓存，分别统计三个 section 的 p50/p95/p99、fallback、零结果率和过滤候选数。

## 十二、签字条件

| 角色 | 确认内容 |
|---|---|
| 产品 | 决策项、默认搜索、空状态和分享政策 |
| Fynn | 数据迁移、状态机、Search/API、性能和回滚 |
| Agent 方 | 输入输出、错误、幂等和样例集 |
| AW | 任务 API、分享边界和端侧交互 |
| QA | 自动化覆盖、回归结果和上线门槛 |

签字是对版本化文档的确认；修改字段或状态必须升级 contract/policy version，并更新对应测试。
