# S6 · DimSum 搜索体系升级 3.0 实施文档

状态：数据库、媒体回填、首批内容属性标记和现有 Search API 兼容升级已完成；应用部署、前端和跨团队联调待实施
业务基线：`S6 - DimSum 搜索体系升级 3.0.md`
技术负责人：Fynn

## 一、当前实施判断

S6 数据库基础已于 2026-08-28 在 Production 完成：新增 `content_attribute`、`media_types`，安装自动派生 trigger，完成媒体存量回填，并按高置信来源标记 50,741 条内容属性。现有 Search API 已实现可选属性过滤、方案 B 媒体过滤和 Entry DTO 兼容扩展；代码待部署线上应用并进行跨团队联调。本期不新建 V3 路由。

当前工程已具备 Unique ID、两级分类、标签、三层搜索、词条详情页、分享预览和媒体资源读取等基础能力。S6 以兼容升级为原则，不重写现有 P0。AI 生成原型只作为视觉与交互参考，不用于反推数据库字段或新建后台系统。

经 Production 和真实代码复核，本期立即需要评审的主表新增字段已从原方案的 14 个收缩为 `content_attribute`、`media_types` 两个；原 8 张新表均不进入当前 migration。Agent 分类如确需本地状态表，等待 Agent 契约后单独评审。

## 二、已确认决策

1. 主 PRD 是唯一业务基线；Web/App/小程序 Demo 只作为视觉参考，时序图已同步为 S6 流程概览。
2. 内容属性只有 `oral` 和 `cultural_knowledge` 两个公开搜索范围。
3. 默认搜索不按内容属性过滤；精准搜索继续按全库排序返回最佳结果。
4. 现有 Search API 增加可选 `oral` / `cultural_knowledge` 过滤；只有明确传入时，精准、相关、推荐三段才统一过滤。本期不实现前端属性选择器。
5. 媒体筛选采用方案 B：只筛选二级相关结果；一级精准结果和三级推荐结果保持稳定。
6. 分享卡片及模板体验由 AW 负责；Fynn 提供公开权限判断和标准化词条上下文。
7. Production 离线邻居表已经启用，不再作为 S6 上线阻塞项。
8. S6 沿用正式 `/api/search/entries` 并做向后兼容扩展；不因 AI 原型另建版本接口，兼容更新不增加功能开关。
9. 无法判断内容属性的存量语料先导出待处理清单，不自动猜测。
10. `lifecycle_stage=normalized + 来源 is_public=true` 仅作为数据库观察和待决策候选保留，不是 PRD 明确要求，也不是 S6 当前硬过滤；默认搜索不因此改变范围。

待确认项见 [01-decisions-and-scope.md](01-decisions-and-scope.md)。

## 三、文档导航

| 文档 | 主要读者 | 用途 |
|---|---|---|
| [00-production-database-analysis.md](00-production-database-analysis.md) | Fynn、后端、DBA | Production 数据库真实结构、数量、覆盖率和 S6 建模结论 |
| [00a-requirement-implementation-traceability.md](00a-requirement-implementation-traceability.md) | 产品、Fynn、后端 | 逐项判断本期需求、现有复用、必要新增和延后范围 |
| [00b-production-media-data-analysis-and-design.md](00b-production-media-data-analysis-and-design.md) | Fynn、后端、DBA | Production 媒体组合、新旧结构重叠及多值派生列设计 |
| [migration/README.md](migration/README.md) | Fynn、后端、DBA | Production schema、回填、验证、导出和安全回退实施包 |
| [01-decisions-and-scope.md](01-decisions-and-scope.md) | 产品、Fynn、AW、Agent | 决策、范围、术语和职责边界 |
| [02-data-model-and-migration.md](02-data-model-and-migration.md) | Fynn、后端、DBA | 正式数据库模型、索引、迁移和存量回填 |
| [02a-postgresql-ddl-draft.sql](02a-postgresql-ddl-draft.sql) | Fynn、后端、DBA | 精简后的两字段 PostgreSQL DDL 评审草案，不可直接上 Production |
| [02b-unclassified-export-runbook.md](02b-unclassified-export-runbook.md) | Fynn、DBA、内容团队 | 无法判断属性的存量语料导出、复核和安全回填 |
| [03-state-machines-and-rules.md](03-state-machines-and-rules.md) | 产品、Fynn、AW、Agent | 内容、分类、任务、公开与分享状态机 |
| [04-search-api-contract.md](04-search-api-contract.md) | Fynn、Web/App | 现有 Search API 的 S6 增量请求、响应、过滤与降级 |
| [05-agent-integration-reference.md](05-agent-integration-reference.md) | Fynn、Agent 方 | Agent 当前需求和参考对接契约 |
| [06-annotation-api-contract.md](06-annotation-api-contract.md) | Fynn、AW | 标注任务、领取、提交、回写和幂等 |
| [07-share-service-boundary.md](07-share-service-boundary.md) | Fynn、AW | 分享服务职责、公开上下文和埋点边界 |
| [08-performance-rollout-and-observability.md](08-performance-rollout-and-observability.md) | Fynn、运维 | 性能指标、缓存、灰度、监控和回滚 |
| [09-acceptance-test-plan.md](09-acceptance-test-plan.md) | 产品、QA、三方 | 可执行验收矩阵和上线门槛 |
| [10-corpus-flow-and-ingestion-audit.md](10-corpus-flow-and-ingestion-audit.md) | Fynn、后端、AW、Agent | 小程序、Agent、后台审核和正式入库的真实流转及断点 |
| [11-search-v3-backend-implementation-record.md](11-search-v3-backend-implementation-record.md) | Fynn、后端、QA | 当前兼容 API 过滤、DTO 扩展、测试证据和未来候选项 |

## 四、建议确认顺序

1. 先确认 01、02、03，冻结业务口径和数据库结构。
2. 再确认 04、05、06、07，冻结跨系统接口。
3. 最后依据 08、09 开发、联调、灰度和验收。

## 五、权威性说明

- 业务规则冲突时，以主 PRD及其后续明确决策为准。
- 技术细节冲突时，以本目录中编号更具体的实施文档为准。
- 时序图文件名为兼容旧链接保留；正式状态与字段以状态机和接口文档为准。
- Demo 用于保持现有视觉语言，不代表按钮、权限、失败处理或真实 API 已完成。
