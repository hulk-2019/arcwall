# AI 画布素材生成平台技术方案

系统架构 数据模型 接口与交付设计

| 字段 | 内容 |
| --- | --- |
| 文档版本 | V1.0 |
| 文档状态 | 可用于立项与方案评审 |
| 编制日期 | 2026 年 9 月 15 日 |
| 适用阶段 | MVP 设计与研发实施 |

**范围说明**

本文件定义一款面向内容创作者与营销团队的 AI 无限画布产品。用户可以在同一画布中组织文本、参考素材、图像、视频与生成结果，并通过连线构建可复用的素材生产流程。

## 文档导航

本文按评审顺序组织。先明确目标和用户流程，再展开需求、验收、风险与交付计划。

| 章节 | 评审重点 |
| --- | --- |
| 一至三 | 架构目标、关键决策、系统上下文 |
| 四至七 | 前后端、数据模型、DAG 与模型适配 |
| 八至十一 | 接口、事件、素材管线、任务与计费 |
| 十二至十五 | 安全、可靠性、性能成本、测试部署 |
| 附录 | 示例协议、错误码、表结构和实施拆解 |

## 一 技术结论

建议采用事件驱动的异步架构。浏览器负责画布编辑和乐观交互，应用服务保存规范化图数据，执行服务把选定子图编译成有向无环图任务，工作流调度器按依赖提交供应商任务，资产服务统一接管上传和生成文件。模型差异收敛到能力注册表与适配器，业务层只处理统一的生成请求和状态。

MVP 采用模块化单体加独立 Worker，而不是一开始拆成大量微服务。API、项目、资产、执行和计费模块共享一个代码库与主数据库；耗时生成、转存、审核和对账在队列 Worker 中运行。该结构能减少分布式事务，同时保留按任务量独立扩展 Worker 的能力。

## 二 架构目标与约束

### 二点一 目标

- 项目和节点编辑可快速保存，任务提交不受页面生命周期影响。

- 一次生成能够完整追溯到节点版本、上游素材、模型、供应商请求和成本流水。

- 供应商更换、模型下线或参数变化不破坏已有项目和历史结果。

- 任务至少一次投递时仍保持业务幂等，不产生重复扣费或重复结果。

- 画布规模、生成并发和二进制资产分别扩展，避免彼此成为瓶颈。

### 二点二 关键约束

| 约束 | 设计响应 |
| --- | --- |
| 视频生成通常为长任务 | 统一采用创建任务后轮询或回调的异步协议；前端订阅平台事件 |
| 供应商参数不一致 | 能力注册表定义端口和参数；适配器完成字段映射和错误归一 |
| 供应商结果链接可能过期 | Worker 在成功后校验并转存对象存储，再发布平台结果 |
| 用户可在运行期间继续编辑 | 执行使用不可变快照；新编辑生成新的节点版本 |
| 画布可形成环或非法依赖 | 保存时做轻量校验，执行前做完整 DAG 校验 |
| 生成成本不可精确预测 | 报价标明估算与有效期；最终按账单规则结算 |

## 三 系统上下文与组件

### 三点一 系统上下文

```text
Web Client
  │ HTTPS  WebSocket
  ▼
API Gateway  ── Auth and Rate Limit
  │
  ├── Project and Canvas Module ── PostgreSQL
  ├── Asset Module ────────────── Object Storage and CDN
  ├── Execution Module ────────── Redis Queue and Workers
  ├── Billing Module ──────────── Credit Ledger
  └── Policy Module ───────────── Moderation and Audit
                                      │
                                      ├── Image Provider Adapter
                                      └── Video Provider Adapter
```

### 三点二 组件职责

| 组件 | 职责 | MVP 形态 |
| --- | --- | --- |
| Web Client | 画布交互、节点配置、预览、离线草稿和实时状态 | Next.js 或 React 应用 |
| API Gateway | 认证、限流、请求标识、灰度和统一错误 | 应用网关或 BFF |
| Project Module | 项目、画布、节点、边、版本与协作权限 | 模块化单体 |
| Execution Module | 子图编译、任务调度、状态汇总、取消与恢复 | 服务加 Worker |
| Asset Module | 直传签名、元数据、派生图、转存和生命周期 | 模块化单体加 Worker |
| Model Registry | 模型能力、参数定义、价格、地域和状态 | 数据库配置加缓存 |
| Provider Adapters | 鉴权、参数转换、提交、查询、取消和错误归一 | 独立包和 Worker 插件 |
| Billing Module | 预估、预扣、结算、退款和对账 | 事务模块与不可变账本 |
| Policy Module | 输入输出审核、权利策略、留存与审计 | 策略服务接口 |

## 四 前端方案

### 四点一 技术栈建议

| 层 | 建议 | 说明 |
| --- | --- | --- |
| 应用 | React 与 TypeScript | 共享类型、组件生态和长生命周期状态管理 |
| 画布 | React Flow 或等价图编辑库 | 支持节点、端口、边、视口、小地图和自定义节点 |
| 服务状态 | TanStack Query | 请求缓存、失效、轮询和重试策略 |
| 编辑状态 | Zustand 或等价轻量状态库 | 处理选择、拖拽、临时连线和撤销栈 |
| 本地草稿 | IndexedDB | 断网草稿、待同步操作和缩略图缓存 |
| 实时通道 | WebSocket 优先 SSE 备选 | 接收执行状态、成员变更和通知 |

### 四点二 状态分层

- 服务端事实状态包括项目权限、已保存节点版本、执行、素材和账本。

- 客户端暂存状态包括选区、视口、拖拽中的坐标、未提交表单和撤销栈。

- 乐观编辑以 operation_id 提交。服务端返回新 revision；冲突时按节点级版本合并，无法合并的字段交由用户选择。

- 任务状态不进入撤销栈。撤销节点编辑不能取消已经提交的供应商任务。

### 四点三 大画布性能

| 问题 | 策略 |
| --- | --- |
| 节点数量增长 | 只渲染视口及缓冲区内的重组件；不可见节点使用轻量占位 |
| 大图和视频解码 | 列表和节点默认使用派生缩略图；仅在预览器中加载原文件 |
| 频繁拖动保存 | 坐标变更 300 毫秒合并，文本 1 秒防抖，关键操作立即保存 |
| 连线重算 | 本地维护邻接表；仅对受影响子图执行拓扑检查 |
| 状态更新风暴 | 按 execution_id 合并事件；进度更新最多每秒渲染两次 |

## 五 后端模块与部署边界

### 五点一 模块化单体边界

| 模块 | 写入对象 | 公开能力 |
| --- | --- | --- |
| Identity | workspace_member、api_token | 登录态、角色、服务账号 |
| Project | project、canvas、node、edge、revision | 编辑、快照、复制、分享 |
| Asset | asset、asset_variant、upload | 上传、下载、转存、派生图 |
| Execution | execution、step_run、attempt、provider_job | 估算、提交、查询、取消、重试 |
| Billing | quote、reservation、ledger_entry | 预扣、结算、退款、余额 |
| Policy | moderation_event、consent_record、audit_log | 审核、策略决策、审计 |
| Template | template、template_version | 发布、复制、变量绑定 |

### 五点二 拆分条件

当单模块的资源模式、发布频率或故障域明显独立时再拆服务。优先拆分执行 Worker、资产转码和供应商回调接入。项目与计费在早期保持同库事务，以避免创建执行与额度预扣之间出现分布式一致性问题。

## 六 领域模型与数据设计

### 六点一 关系模型

| 表 | 关键字段 | 约束 |
| --- | --- | --- |
| workspaces | id、name、plan、policy_id | 所有业务数据必须带 workspace_id |
| projects | id、workspace_id、owner_id、name、visibility | 软删除；名称不要求唯一 |
| canvases | id、project_id、revision、viewport_json | 每项目默认一张主画布 |
| nodes | id、canvas_id、type、x、y、current_revision_id | 坐标与当前版本分离 |
| node_revisions | id、node_id、config_json、content_hash | 不可变；通过父版本形成版本链 |
| edges | id、canvas_id、source_node_id、source_port、target_node_id、target_port | 活动边唯一；禁止自环 |
| assets | id、workspace_id、media_type、storage_key、sha256、status | 同工作区内容哈希可去重 |
| asset_variants | id、asset_id、kind、width、height、storage_key | 缩略图和转码文件 |
| executions | id、canvas_id、snapshot_id、scope、status、quote_id | 幂等键唯一 |
| step_runs | id、execution_id、node_revision_id、status、input_hash | 同执行节点唯一 |
| attempts | id、step_run_id、attempt_no、provider_job_id、error_code | 记录每次重试 |
| provider_jobs | id、provider、external_id、status、raw_status | provider 加 external_id 唯一 |
| ledger_entries | id、workspace_id、execution_id、type、amount | 只追加，不更新历史金额 |
| audit_logs | id、actor_id、action、resource、metadata_json | 安全事件不可由普通用户删除 |

### 六点二 节点配置包络

```json
{
  "schema_version": 3,
  "node_type": "image.generate",
  "model_key": "openai:gpt-image-2",
  "prompt": {"text": "...", "bindings": ["node:text-1.output"]},
  "inputs": [{"port": "reference_images", "asset_ids": ["ast_..."]}],
  "parameters": {"size": "1536x1024", "quality": "high", "format": "png"},
  "ui": {"title": "篮球鞋分镜", "collapsed": false}
}
```

config_json 使用 JSON Schema 版本化。历史节点版本保留原 schema_version；读取时通过纯函数迁移到当前视图，只有用户保存后才写入新版本。供应商原始参数不得直接成为长期数据合同。

## 七 工作流编译与执行

### 七点一 编译流程

1.  确定执行范围。根据当前节点、运行到此、运行下游或执行全部，选择目标子图。

2.  解析当前节点版本和上游引用，生成不可变 canvas_snapshot。

3.  校验端口类型、必填输入、模型能力、素材权限、循环依赖和预算。

    当前实现按目标端口编译引用：文本与分镜进入 `prompt`/`brief`，图片进入 `reference_images` 或 `first_frame`，音频进入 `reference_audio`。引用文本与节点自身提示词按“上游在前、自身配置在后”的顺序合并；分镜转为运动描述后只注入一次。已建立媒体引用连线但上游没有有效 `storageKey` 或 URL 时，按 `INPUT_NOT_READY` 拒绝执行，不允许静默退化为无引用生成。

4.  对目标子图执行拓扑排序，并计算每个步骤的 input_hash 与缓存状态。

5.  创建 execution、step_runs、成本报价和预扣流水，在同一事务内提交。

6.  向队列投递根步骤。Worker 成功后解锁下游步骤，直到目标节点进入终态。

### 七点二 状态机

| 状态 | 可进入自 | 可转出至 | 说明 |
| --- | --- | --- | --- |
| DRAFT | 创建 | VALIDATING | 尚未提交 |
| VALIDATING | DRAFT | QUEUED、REJECTED | 解析与安全预检 |
| QUEUED | VALIDATING、RETRY_WAIT | RUNNING、CANCELLED | 等待并发与供应商额度 |
| RUNNING | QUEUED | SUCCEEDED、FAILED、RETRY_WAIT、CANCEL_REQUESTED | 供应商或内部处理中 |
| RETRY_WAIT | RUNNING | QUEUED、FAILED | 退避等待 |
| CANCEL_REQUESTED | RUNNING | CANCELLED、SUCCEEDED、FAILED | 取消可能与完成竞争 |
| SUCCEEDED | RUNNING | 终态 | 结果已转存并通过输出检查 |
| FAILED | 运行相关状态 | 终态或人工重试 | 保存规范错误码 |
| CANCELLED | QUEUED、CANCEL_REQUESTED | 终态 | 区分平台取消与供应商取消 |
| REJECTED | VALIDATING | 终态 | 输入、安全、权限或预算不通过 |

### 七点三 幂等与并发

- 客户端每次提交生成 idempotency_key；同工作区和键只创建一个 execution。

- Worker 使用 step_run 行级锁或租约，投递可重复但步骤提交供应商最多一次。

- 供应商提交前写 SUBMITTING 记录，提交后写 external_id；未知结果由对账任务按请求指纹查询。

- 取消和完成采用比较并交换。若供应商已成功，平台保留结果并按供应商真实账单结算。

- 用户请求取消时，execution 先进入 `CANCEL_REQUESTED`，仍在运行的 step_run 收敛为 `CANCELLED`；后到达的供应商完成或失败回调不得覆盖已取消状态。存在 external_id 的异步任务同时执行供应商侧 best-effort 取消。

## 八 模型能力注册表与适配器

### 八点一 能力注册表

| 字段 | 示例 | 用途 |
| --- | --- | --- |
| model_key | openai:gpt-image-2 | 稳定的产品侧标识 |
| provider_model_id | 由环境配置 | 供应商真实模型名，不写入前端代码 |
| task_type | image.generate、video.image_to_video | 决定输入和输出类型 |
| input_ports | prompt、reference_images、first_frame | 动态生成节点端口 |
| parameter_schema | 尺寸、质量、时长、比例 | 表单和服务端双重校验 |
| limits | 最大图片数、文件大小、时长 | 阻止无效提交 |
| price_rule | 固定、按秒、按分辨率或令牌 | 报价与结算 |
| region_policy | 允许区域和数据路径 | 地域路由与合规 |
| lifecycle | preview、active、deprecated、disabled | 灰度、下线和历史兼容 |

画布属性面板通过 `canvas_model` 字典加载模型，并在 API 查询与客户端会话缓存中都以节点类型 `image`、`video`、`audio` 隔离。视频节点不得展示 Seedream，图像节点不得展示 Seedance，避免把不兼容模型写入节点版本。

### 八点二 统一适配器接口

```text
interface MediaProviderAdapter {
  validate(request: UnifiedGenerationRequest): ValidationResult
  estimate(request: UnifiedGenerationRequest): CostEstimate
  submit(request: UnifiedGenerationRequest): Promise<ProviderJobRef>
  getStatus(job: ProviderJobRef): Promise<ProviderJobStatus>
  cancel?(job: ProviderJobRef): Promise<CancelResult>
  normalizeError(error: unknown): NormalizedProviderError
}
```

### 八点三 图像适配

OpenAI 官方文档区分从提示词生成图片的 generations 能力、基于输入图编辑的 edits 能力，以及适合多轮编辑流程的 Responses API。适配器应根据节点类型和会话需求选择调用路径，同时把尺寸、质量、格式、压缩和多结果数量映射到统一字段。[3]

- 图片返回为 base64 时，Worker 先流式解码到临时文件，计算哈希和安全扫描后上传对象存储。

- 使用参考图时按注册表顺序构造输入，保留 asset_id 到供应商字段的映射，便于问题追踪。

- OSS 开启 Referer 白名单时，由 Worker 使用内部签名地址下载参考图，再以内联 Data URL 交给 Seedream，避免供应商直接回源触发 403。

- GPT Image 编辑请求只有一张参考图时使用单文件 `image` 字段；多张参考图才使用数组形式，避免 multipart 参数形态不兼容。

- 局部编辑先验证原图和遮罩尺寸、格式与透明通道；不在浏览器端静默修正。

- 供应商返回修订后的提示词时单独存储，不覆盖用户原始提示词。

### 八点四 视频适配

火山引擎的公开视频生成文档提供创建、查询、列表以及取消或删除任务等异步接口类别；Seedance 2.0 提示词指南强调多模态输入和镜头描述。当前实现通过 302.ai 转发 Seedance 异步任务，使用 `PROXY_302AI_BASE_URL` 与独立的 `PROXY_302AI_API_KEY`，并把供应商任务收敛为 submit、status、cancel 三个核心动作。[4][5]

- 创建任务后立即保存 external_id，再开始轮询；轮询频率按运行时长逐步降低。

- 若支持回调，验证签名并按 external_id 去重；回调丢失时轮询仍能收敛。

- 供应商成功状态只表示可取结果。平台必须完成下载、校验、转存和输出审核后才标记 SUCCEEDED。

- 首尾帧、多图、参考视频和参考音频仅由能力注册表开放，避免无效字段透传。

- 视频节点连接 `first_frame` 后，无论历史 `videoMode` 是否仍为 `text`，均按图生视频执行：请求同时携带文本 prompt 与 `role=first_frame` 的图片。属性面板同步显示并锁定“图生视”，断开首帧引用后恢复使用节点配置。

- 首帧来自私有 OSS 时，Worker 先下载并转为 Data URL，再提交 302.ai，避免 OSS 防盗链阻止供应商回源。Seedance 2.0 Fast 配置为 1080p 时在适配层降为其支持的 720p。

- `provider_jobs.provider` 记录为 `302ai`；供应商状态规范化为 queued、running、succeeded、failed、cancelled、expired。查询失败或结果转存失败时按退避时间重试，超过平台期限后归一为 `PROVIDER_TIMEOUT`。

### 八点五 音频适配

Doubao Seed TTS 使用火山语音原生单向流式接口，不复用 Ark/OpenAI 兼容密钥。Worker 使用 `DOUBAO_SPEECH_API_KEY` 与 `DOUBAO_SPEECH_RESOURCE_ID`，解析 NDJSON 音频分片、拼接后转存 OSS；上游文本与节点自身文案按顺序合并后送入 TTS。

## 九 API 设计

### 九点一 外部接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | /v1/projects | 创建项目 |
| GET | /v1/projects/{id} | 获取项目与权限 |
| PATCH | /v1/canvases/{id} | 批量提交画布操作 |
| POST | /v1/canvases/{id}/snapshot | 创建明确版本快照 |
| POST | /v1/executions/estimate | 校验执行范围并报价 |
| POST | /v1/executions | 提交节点或工作流执行 |
| GET | /v1/executions/{id} | 查询汇总状态和步骤 |
| POST | /v1/executions/{id}/cancel | 请求取消 |
| POST | /v1/uploads | 创建直传会话 |
| POST | /v1/uploads/{id}/complete | 完成上传并触发扫描 |
| GET | /v1/assets | 筛选资产库 |
| POST | /v1/templates/{id}/instantiate | 从模板新建项目 |

### 九点二 提交执行示例

```text
POST /v1/executions
Idempotency-Key: 5be6...

{
  "canvas_id": "cnv_123",
  "base_revision": 42,
  "scope": {"mode": "downstream", "from_node_id": "node_storyboard"},
  "quote_id": "qte_789",
  "force_regenerate": false
}
```

```json
{
  "execution_id": "exe_456",
  "status": "QUEUED",
  "snapshot_revision": 42,
  "reserved_credits": 36,
  "event_channel": "execution:exe_456"
}
```

### 九点三 错误合同

API 错误返回稳定的 code、message、details、request_id 和 retryable。message 面向用户，details 提供字段路径、限制值或供应商分类；不得直接返回供应商原始错误和敏感请求。

## 十 实时事件与客户端恢复

| 事件 | 载荷 | 客户端动作 |
| --- | --- | --- |
| execution.created | execution_id、status、estimate | 创建执行面板 |
| step.queued | node_id、queue_position | 节点显示排队 |
| step.progress | node_id、progress、stage | 节流更新进度 |
| step.succeeded | node_id、asset_ids、cost | 追加新版本并刷新余额 |
| step.failed | node_id、error_code、retryable | 展示错误和重试入口 |
| execution.completed | summary、settlement | 完成通知与最终结算 |
| canvas.revision | revision、operations | 合并其他会话编辑 |

WebSocket 断线重连时客户端携带 last_event_id。服务端若已清理事件缓冲，则返回 resync_required，客户端重新获取 execution 和 canvas 当前快照。事件用于加速界面，不替代数据库事实状态。

## 十一 素材管线与生命周期

### 十一点一 上传

1.  客户端请求上传会话，服务端根据媒体类型、大小和工作区策略签发短期直传 URL。

2.  客户端分片直传对象存储并报告完成，服务端校验对象大小、MIME、哈希和分片摘要。

3.  Worker 执行恶意文件扫描、媒体探测、缩略图或代理文件生成以及内容安全检查。

4.  只有状态为 READY 的素材才能进入模型输入；失败素材返回明确原因。

### 十一点二 存储键和访问

```text
workspaces/{workspace_id}/assets/{asset_id}/original/{sha256}.{ext}
workspaces/{workspace_id}/assets/{asset_id}/variants/thumb-512.webp
workspaces/{workspace_id}/assets/{asset_id}/variants/preview-720p.mp4
```

- 数据库和消息中只保存 storage_key，不保存永久公开 URL。

- 下载通过短期签名 URL 或鉴权代理；分享链接绑定项目权限和有效期。

- 画布快照与执行结果查询根据 `storage_key` 即时生成签名 URL；客户端读取快照时使用 `cache: no-store`，避免浏览器或框架复用已经过期的签名地址。持久化输出不得写入临时签名 URL。

- 删除采用软删除、引用检查和延迟清理。对象清理任务必须确认无活动引用。

- 供应商临时文件转存完成后，保存源 URL 的加密摘要用于对账，不长期暴露原地址。

## 十二 计费 幂等与对账

### 十二点一 账本流程

| 动作 | 账本类型 | 规则 |
| --- | --- | --- |
| 提交执行 | RESERVE | 按报价预扣；余额不足则整个执行拒绝 |
| 步骤成功 | CAPTURE | 按实际模型、参数和输出结算 |
| 系统失败 | RELEASE | 释放未消耗预扣；已发生供应商成本按明确规则处理 |
| 用户取消 | CAPTURE 或 RELEASE | 依据供应商是否接受取消及是否已计费 |
| 人工补偿 | ADJUSTMENT | 必须带原因、操作者和关联工单 |

### 十二点二 一致性要求

- 余额是账本汇总的物化结果，账本条目只追加。

- execution_id 与 ledger_entry 建立唯一约束，重复回调不会重复结算。

- 报价包含 price_version 和 expires_at；提交时过期必须重新报价。

- 每日按供应商账单、provider_job 和内部账本进行三方对账，差异进入人工队列。

## 十三 安全 隐私与多租户

### 十三点一 安全控制

| 领域 | 控制 |
| --- | --- |
| 身份与会话 | OIDC 或受管认证、短会话、刷新令牌轮换、关键操作二次验证 |
| 授权 | workspace_id 强制过滤、对象级 RBAC、分享令牌哈希存储 |
| 供应商密钥 | 密钥管理服务托管、按环境和供应商隔离、定期轮换 |
| 网络 | 服务私网、对象存储私有桶、出站域名白名单、Webhook 独立入口 |
| 上传安全 | MIME 与魔数双检、大小限制、恶意文件扫描、媒体解码隔离 |
| 提示词与素材 | 日志脱敏、禁止写入通用 APM 字段、按工作区留存策略删除 |
| 审计 | 权限、下载、分享、计费调整、模型策略变更写不可变审计日志 |

### 十三点二 内容安全链路

```text
输入文本审核 ─┐
图片与视频预检 ├─ 策略决策 ─ 允许 限制 拒绝 人审
权利与肖像确认 ┘
                     ↓
                 供应商生成
                     ↓
           输出审核与来源信息写入
```

策略结果必须携带 policy_version、reason_code 和可申诉信息。原始素材只在必要系统中可见；审核服务使用最小权限和最短可用留存。不同供应商的数据保留承诺不能在产品层被概括为统一承诺，需按实际合同和接口分别配置。

## 十四 可靠性 可观测性与灾备

### 十四点一 SLO

| 指标 | 目标 | 说明 |
| --- | --- | --- |
| 画布读取可用性 | 99.9% 月度 | 不含供应商生成能力 |
| 编辑保存成功率 | 99.95% | 最终在 10 秒内持久化 |
| 任务提交 API P95 | 小于 800 毫秒 | 不等待供应商完成 |
| 任务终态覆盖率 | 99.5% 在 24 小时内 | 包含成功、失败、取消和拒绝 |
| 状态事件延迟 P95 | 小于 3 秒 | 供应商状态可用后到客户端展示 |
| RPO 与 RTO | RPO 15 分钟  RTO 2 小时 | 主数据库与对象存储元数据 |

### 十四点二 观测

- 全链路使用 request_id、execution_id、step_run_id 和 provider_job_id 关联日志与追踪。

- 核心指标包括提交率、成功率、终态延迟、供应商错误分布、转存失败率、缓存命中率和单位有效素材成本。

- 供应商原始响应进入受限诊断存储并按短期保留，不进入普通应用日志。

- 告警按用户影响分级；单供应商故障优先熔断和降级，平台数据损坏触发发布冻结。

### 十四点三 恢复任务

定时协调器扫描长时间停留在 SUBMITTING、RUNNING、CANCEL_REQUESTED 和 TRANSFERRING 的记录。它通过供应商查询、对象存储校验和账本核对推进状态。任何自动修复必须幂等，并把前后状态写入审计日志。

## 十五 性能与成本设计

| 成本或瓶颈 | 措施 | 验证指标 |
| --- | --- | --- |
| 重复生成 | 内容哈希缓存、未变化子图复用、结果版本化 | 缓存命中率与避免成本 |
| 大文件传输 | 客户端直传、同地域 Worker、分片和断点续传 | 上传成功率与出口流量 |
| 视频轮询 | 分层退避、Webhook 加速、批量状态查询 | 每任务查询次数 |
| 缩略图解码 | 预生成 WebP 与视频代理文件、CDN 缓存 | 画布首屏与内存占用 |
| 数据库写放大 | 坐标批量提交、事件合并、历史版本压缩 | 每分钟写入与表膨胀 |
| 供应商价格变化 | 价格版本、配额路由、每日毛利告警 | 单位素材毛利与差异率 |

## 十六 测试策略

| 层级 | 范围 | 必须覆盖 |
| --- | --- | --- |
| 单元测试 | DAG、参数映射、哈希、计费和状态机 | 环检测、拓扑排序、舍入、错误归一 |
| 契约测试 | 前后端 Schema 与供应商适配器 | 能力注册表的每个活动模型 |
| 集成测试 | 数据库、队列、对象存储和 Webhook | 重复事件、乱序事件、网络超时 |
| 端到端测试 | 浏览器到最终资产 | 文生图、分镜转视频、失败返还、恢复 |
| 视觉测试 | 节点、边、属性面板和状态 | 常用缩放级别、暗色模式和长文本 |
| 性能测试 | 大画布、并发提交、资产转存 | 500 节点、峰值队列、超大允许文件 |
| 安全测试 | 租户隔离、上传、分享、回调和密钥 | 越权、SSRF、恶意媒体、重放攻击 |
| 故障演练 | 供应商、Redis、数据库和对象存储 | 熔断、恢复、对账和回滚 |

## 十七 部署 发布与迁移

### 十七点一 环境

- 开发、测试、预发布和生产环境使用独立数据库、存储桶、队列、密钥和供应商项目。

- 模型能力注册表通过受审配置发布，支持按工作区、地区和百分比灰度。

- 数据库迁移遵循扩展、双写或回填、切换、收缩四步，部署期间保持旧客户端可用。

- Worker 与 API 使用不同扩缩容指标；Worker 按队列长度和任务类型扩容。

### 十七点二 发布门槛

| 门槛 | 通过条件 |
| --- | --- |
| 功能 | PRD P0 需求具备自动化验收或记录的人工验收 |
| 数据 | 备份恢复、迁移回滚和对象清理在预发布演练 |
| 安全 | 租户隔离、上传、分享和供应商密钥无高危问题 |
| 可靠性 | 任务恢复、重复回调、供应商超时和转存失败演练通过 |
| 运营 | 错误码、告警、客服查询、人工补偿和模型下线流程可用 |

## 十八 实施计划与工作包

| 工作包 | 交付内容 | 依赖 |
| --- | --- | --- |
| WP1 画布基础 | 项目、节点、边、视口、撤销、自动保存 | 身份与数据库 |
| WP2 素材基础 | 直传、资产表、缩略图、下载、生命周期 | 对象存储与 Worker |
| WP3 图像生成 | 能力注册表、图像适配、结果转存、版本 | WP1 与 WP2 |
| WP4 分镜规划 | 镜头 Schema、结构化生成、编辑器、模板 | WP1 与文本模型 |
| WP5 视频生成 | 异步适配、轮询回调、播放器、恢复 | WP2 与执行框架 |
| WP6 调度计费 | DAG、缓存、预扣结算、重试、对账 | WP3 与 WP5 |
| WP7 安全运营 | 审核、审计、后台、告警、补偿工具 | 全部核心模块 |
| WP8 发布准备 | 压测、灾备、灰度、文档和培训 | 全部工作包 |

## 十九 架构决策记录

| 决策 | 选择 | 理由 | 触发复审条件 |
| --- | --- | --- | --- |
| ADR-001 | 模块化单体加 Worker | 早期保持事务简单，生成负载可独立扩展 | 团队或模块发布冲突持续影响交付 |
| ADR-002 | 画布保存规范化图，执行保存不可变快照 | 兼顾编辑效率与执行可复现 | 实时协作需要 CRDT 且冲突显著增加 |
| ADR-003 | 平台对象存储为结果事实源 | 避免供应商临时链接失效 | 合同明确提供长期稳定且可审计存储 |
| ADR-004 | 能力注册表驱动 UI | 防止前端硬编码供应商差异 | 模型集合长期固定且参数完全同构 |
| ADR-005 | 账本只追加 | 重复事件和退款可审计 | 引入外部计费系统成为唯一账本 |

## 附录一 示例数据库约束

```sql
UNIQUE (workspace_id, idempotency_key) ON executions
UNIQUE (execution_id, node_revision_id) ON step_runs
UNIQUE (provider, external_id) ON provider_jobs
CHECK (source_node_id <> target_node_id) ON edges
CHECK (amount <> 0) ON ledger_entries
INDEX (workspace_id, created_at DESC) ON assets
INDEX (status, next_poll_at) ON provider_jobs
```

## 附录二 规范错误码

| 错误码 | 是否可重试 | 用户提示与处理 |
| --- | --- | --- |
| INVALID_GRAPH | 否 | 画布存在循环或非法连接；定位问题边 |
| INPUT_NOT_READY | 否 | 上游素材尚未就绪；等待或更换版本 |
| MODEL_CAPABILITY_MISMATCH | 否 | 当前模型不支持该输入或参数；给出兼容选项 |
| POLICY_REJECTED | 否 | 内容或权利策略拒绝；显示原因类别和申诉入口 |
| INSUFFICIENT_CREDITS | 否 | 余额不足；显示所需与剩余 |
| PROVIDER_RATE_LIMIT | 是 | 已排队重试；展示下一次尝试 |
| PROVIDER_TIMEOUT | 是 | 供应商暂未返回；后台继续检查 |
| PROVIDER_REJECTED | 视原因 | 显示规范化原因，不暴露供应商内部信息 |
| ASSET_TRANSFER_FAILED | 是 | 结果转存失败；后台自动重试 |
| UNKNOWN_PROVIDER_STATE | 是 | 状态待对账；阻止重复提交 |

## 附录三 分镜结构示例

```json
{
  "title": "篮球鞋广告 起飞篇",
  "duration_seconds": 15,
  "visual_lock": {
    "character": "青少年亚洲运动员",
    "product": "荧光橙到电光绿高帮篮球鞋",
    "style": "高对比运动广告"
  },
  "shots": [{
    "index": 1,
    "timecode": "00:00-00:02",
    "shot_size": "wide",
    "lens_mm": 35,
    "subject_action": "空旷球场的灯光依次亮起",
    "camera_move": "slow push in",
    "transition_motivation": "灯光引导视线进入球鞋特写"
  }]
}
```

## 附录四 参考资料

[1] [Oimi AI  Seedance 2.0 分镜图工作流](https://oimi.ai/zh/blog/gpt-image-2-seedance-2-workflow)

[2] [Oimi AI 无限画布参考页面](https://oimi.ai/zh/canvas/134d0090-ae5f-4dde-967d-697a39ffc895)

[3] [OpenAI API  Image generation](https://developers.openai.com/api/docs/guides/image-generation)

[4] [火山引擎  Doubao Seedance 2.0 系列提示词指南](https://www.volcengine.com/docs/82379/2222480?lang=zh)

[5] [火山引擎  视频生成 API](https://www.volcengine.com/docs/82379/1520758?lang=zh)
