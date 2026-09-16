# AI 画布素材生成 重构方案（对齐 PRD V1.0 与技术方案 V1.0）

现有实现（feature/workflow 分支未提交代码）已覆盖项目/画布/节点/边/执行主链路，但与技术方案有 6 处关键偏差，本次重构以「执行正确性 + 计费 + 视频异步化 + P0 缺口」为核心，不做推倒重写。

## 一、执行正确性：不可变快照（技术方案 §二点二 / §七点一，PRD §八点二）— 后端

**问题**：Worker 执行时读 `node.current_revision`（可变）和跨执行的最新输出；orchestrator 用**当前**画布 edges 解锁下游。用户运行期间编辑节点会改变已提交任务的输入，违反「执行使用不可变快照」。

1. run 提交时 `snapshot_json` 保存**全图**节点（含 text 节点及其 revision 配置）+ 全部 edges。
2. Worker 一律使用 `step_run.node_revision_id` 对应的 `node_revisions.config_json` 执行。
3. 上游输出解析规则（新函数，替换 `resolveUpstreamOutputs`）：
   - 上游节点在本执行内有 step_run → 用其输出；
   - 范围外节点 → 取「node_revision_id 等于快照中该节点 revision」的最近成功 step_run；
   - text / upload 节点 → 直接由快照配置推导输出；
   - 均无 → 该步骤失败 `INPUT_NOT_READY`（快扣快还）。
4. text / upload 节点在建执行事务内直接写成 `succeeded` step_run（成本 0），下游解锁逻辑统一。
5. `enqueueReadySteps` 改用 `snapshot_json.edges` 构建依赖，不再读当前画布。

## 二、计费：预扣 → 结算 → 释放（技术方案 §十二，PRD-RUN-002/004）

**问题**：现在只在成功后扣费、提交时仅查余额，并发提交可超额；扣费失败仅打日志（白嫖）。

1. 新增 `lib/canvas/plan.ts`：范围解析 + 计价（image 按 count 计价），estimate 与 run 共用。
2. 提交执行同一事务内**预扣**（`updateUserCredits` 负数，type=consume，备注带 execution id）；余额不足整个执行拒绝。
3. 步骤成功累计 `executions.captured_credits`；执行进入终态时释放 `reserved - captured`（type=refund）。
4. 复用 `credit_transactions` 作为只追加账本，不改 TransactionType 枚举。

## 三、视频异步任务化（技术方案 §八点四，PRD-VID-004）

**问题**：`executeVideo` 在 Worker 内同步轮询最长 10 分钟，prefetch(1) 导致整个画布队列被一个视频任务卡死；Worker 崩溃则供应商任务丢失、无恢复。

1. 新表 `provider_jobs`（step_run_id、provider、external_id、status、next_poll_at、poll_count），`(provider, external_id)` 唯一。
2. 视频步骤拆两阶段：execute-step 只负责提交供应商任务并落库 external_id 后立即返回；轮询由 Worker 进程内新增的 **poller 扫描器**（约 3s）认领到期任务（`next_poll_at` 乐观租约防重复投递）→ 投递 `poll-provider-job` 消息；退避 3s→20s；超 15 分钟平台超时终态。
3. 供应商成功 → 下载转存 OSS（沿用现有转存逻辑）→ complete step；失败/超时 → fail step + 释放。
4. Worker 启动时恢复扫描悬挂的 submitting/running 任务（技术方案 §十四点三）。
5. `services/video.ts` 保留 submit/get/cancel，移除长轮询用法。

## 四、失败传播与取消（PRD 工作流成功率、PRD-VID-005）

**问题**：任一步骤失败会把整个执行所有 pending/queued 步骤标 skipped（含无依赖分支）；无取消入口。

1. 步骤失败只跳过其（快照内的）传递下游，独立分支继续执行。
2. 新增 `POST /api/protected/canvas/executions/[id]/cancel`：执行置 `cancel_requested`，pending/queued 步骤置 `cancelled`，运行中视频任务调用供应商 cancel；已成功步骤保留结果并照常结算；终态统一释放差额。
3. ExecutionStatus 增加 `cancel_requested`。

## 五、资产与输出修复（技术方案 §十一，PRD-AST-005 / PRD-NOD-001）

**问题**：`output_json` 持久化了生成时刻的签名 URL（24h 过期后画布图片全挂）；参考图/首帧端口没有图片来源（缺上传节点）。

1. `output_json` 只存 `storageKeys`；快照/执行查询接口在读取时动态签名（1 小时有效期）。
2. 新增**上传节点**（P0）：新路由 `POST /api/protected/canvas/assets`（上传 OSS + 登记 `canvas_assets` 表）；节点 config 存 storageKey；作为 image 节点参考图、video 节点首帧的来源。

## 六、前端重构

1. **`useCanvasExecution` 重写**：运行前先调 estimate（新路由 `POST .../executions/estimate`）→ 确认弹窗展示执行范围/节点/预计成本（PRD-RUN-001/002）→ 提交 → 轮询期间把 step 状态实时映射到节点（store 新增 `liveStatus` overlay，NodeCard 合并展示）→ 终态刷新快照 + 余额。
2. Toolbar 增加取消任务按钮；保留运行按钮禁用逻辑。
3. 进入画布时查询该画布活跃执行并恢复轮询（PRD-VID-004 后台运行），新增 `GET .../executions?canvasId=` 列表接口。
4. PropertyFields：上传节点（上传按钮 + 预览）、video 节点补 aspectRatio 选择；NodePalette / node-meta 增加上传节点。
5. `messages/zh.json`、`en.json`、`errors.ts` 补齐新文案。

## 七、Schema 变更（全部增量，`npm run db:push` 即可）

- 新增 `provider_jobs` 模型；`executions` 增加 `captured_credits Int @default(0)`。

## 涉及文件

后端：`prisma/schema.prisma`、`lib/canvas/{registry,graph,orchestrator,plan}.ts`、`models/canvas.ts`、`services/canvas-executor.ts`、`services/video.ts`、`workers/canvas-worker.ts`、`app/api/protected/canvas/**`（run 重构 + estimate/cancel/list/assets 新路由）、`messages/errors.ts`。
前端：`types/canvas.ts`、`services/api.ts`、`store/useCanvasStore.ts`、`components/canvas/hooks/useCanvasExecution.ts`、`CanvasToolbar.tsx`、`NodeCard.tsx`、`PropertyFields.tsx`、`NodePalette.tsx`、`node-meta.tsx`、新增确认弹窗组件、`messages/{zh,en}.json`。

## 明确不做（后续版本）

WebSocket/SSE 事件推送（保留 2s 轮询）、attempts 独立表、独立 ledger_entries 表、内容审核链路、模板市场、多人协作、缓存命中复用、下游过期标记。

## 验证

`npx tsc --noEmit`、`npm run build`、`npm run lint`、`npm run prisma:generate`（有数据库连接时 `npm run db:push`）。