# 07 · AW 分享服务边界与参考契约

状态：供 AW 设计参考

## 一、职责结论

AW 负责分享卡片的设计与生成；Fynn 不实现第二套卡片模板系统。

但公开权限和词条事实数据必须由 Fynn 提供，AW 不根据客户端传来的字段自行生成公开卡片。

## 二、调用链

```text
Search Web/App
  -> 请求 AW 分享预览/生成
  -> AW 使用服务身份向 Fynn 获取 share context
  -> Fynn 实时计算 canShare 并只返回公开字段
  -> AW 渲染模板、二维码和图片
  -> AW/Fynn 记录分享事件
```

客户端不得把 entryName、分类、权利状态拼成可信请求体交给 AW。

## 三、Fynn 提供的分享上下文

```http
GET /api/internal/s6/entries/{entryId}/share-context
Authorization: Bearer <AW service token>
```

允许时：

```json
{
  "entryId": "uuid",
  "canShare": true,
  "policyVersion": "s6-share-v1",
  "content": {
    "entryName": "骑楼",
    "pronunciation": null,
    "jyutping": "ke4 lau4",
    "shortMeaning": "...",
    "sourceCorpusName": "岭南建筑口语介绍集",
    "primaryCategoryName": "建筑主题",
    "secondaryCategoryName": "街区建筑",
    "classificationDisplayStatus": "reviewed_curated",
    "tags": ["粤语", "导览讲解"],
    "contributorDisplayName": null,
    "coverImageUrl": "..."
  },
  "canonicalUrl": "https://search.aidimsum.com/entries/uuid",
  "expiresAt": "2026-08-27T21:00:00Z"
}
```

禁止时：

```json
{
  "entryId": "uuid",
  "canShare": false,
  "reasonCode": "CLASSIFICATION_PENDING_REVIEW",
  "policyVersion": "s6-share-v1"
}
```

`reasonCode`：

```text
NOT_PUBLISHED
RIGHTS_NOT_PUBLIC
CONTENT_ATTRIBUTE_UNCLASSIFIED
CLASSIFICATION_PENDING_REVIEW
ENTRY_OFFLINE
SHARE_LINK_UNAVAILABLE
```

Fynn 不向 AW 返回 Agent 依据、训练许可、未授权贡献者身份或内部原始路径。

## 四、AW 参考接口

最终路径由 AW 确认，建议语义：

### 获取模板

```http
GET /v1/share-templates?surface=web|app&locale=zh-CN
```

### 生成或预览

```http
POST /v1/share-cards
Idempotency-Key: uuid
```

```json
{
  "entryId": "uuid",
  "templateId": "entry-default",
  "surface": "web",
  "theme": "dark"
}
```

AW 内部调用 Fynn share-context，成功后返回：

```json
{
  "cardId": "uuid",
  "templateVersion": "entry-default@3",
  "previewUrl": "...",
  "imageUrl": "...",
  "canonicalUrl": "...",
  "qrPayload": "https://search.aidimsum.com/entries/uuid",
  "expiresAt": "..."
}
```

二维码必须编码 `canonicalUrl`，不能只跳首页。下载文件名建议：

```text
dimsum-{entryId}-{templateVersion}.png
```

## 五、权限缓存

- AW 可短缓存 share-context，建议不超过 5 分钟。
- Fynn 返回 `expiresAt`，AW 不得超过该时间复用。
- 词条下线或权利变更时，Fynn 应向 AW 发送失效事件或调用失效接口。
- 卡片图片即使已生成，公开访问仍应支持撤销或短期签名 URL。

## 六、事件上报

AW 或端侧向 Fynn 上报：

```http
POST /api/s6/share-events
Idempotency-Key: request-id
```

```json
{
  "entryId": "uuid",
  "eventType": "image_download",
  "channel": "web",
  "templateVersion": "entry-default@3",
  "cardId": "uuid"
}
```

`eventType`：card_open/image_download/link_copy/share_send/link_open。

事件接口失败不阻止用户完成分享；客户端或 AW 可有限重试，Fynn 以 request-id 去重。

## 七、Web/App 体验约束

- Web 使用当前设计语言的居中 Dialog。
- App 使用当前设计语言的底部 Sheet，支持遮罩关闭、关闭按钮和下滑收起。
- 权限检查期间显示 loading，不先展示后撤回敏感数据。
- 生成失败显示可重试状态；复制固定链接可作为图片生成失败时的降级。
- 分享卡片只展示 Fynn context 中存在的字段，无值不占位。
- QR 必须经过自动化解码测试。

## 八、待 AW 确认

1. 最终接口域名、鉴权方式和 SLA。
2. 模板 ID/version 规则。
3. 图片存储时长和撤销能力。
4. App 系统分享调用方式。
5. 社群发布是否属于首期，以及所需用户确认流程。
