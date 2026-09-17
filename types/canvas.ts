// AI 画布素材生成平台 共享类型定义（前后端共用）
// 节点与边的主键为客户端生成的 UUID（string），乐观创建无需服务端回传 id 映射。

export type CanvasNodeType = "text" | "image" | "storyboard" | "video" | "audio" | "upload";

export type OutputKind = "text" | "image" | "video" | "storyboard" | "audio";

export type StepStatus =
  | "idle"
  | "pending"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "skipped";

export type ExecutionScope = "node" | "downstream" | "all";

export type ExecutionStatus =
  | "queued"
  | "running"
  | "cancel_requested"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "partially_succeeded";

export interface StoryboardShot {
  index: number;
  timecode?: string;
  shot_size?: string;
  lens_mm?: number;
  subject_action: string;
  camera_move?: string;
  transition_motivation?: string;
}

export interface Storyboard {
  title?: string;
  duration_seconds?: number;
  visual_lock?: Record<string, string>;
  shots: StoryboardShot[];
}

export interface CanvasNodeConfig {
  title?: string;
  // text 节点
  text?: string;
  // image 节点
  prompt?: string;
  model?: string;
  aspectRatio?: string;
  count?: number;
  referenceImages?: string[]; // 参考图（storage key 或 url）
  // storyboard 节点
  brief?: string;
  visualLock?: Record<string, string>;
  shots?: StoryboardShot[];
  layout?: string; // "grid3" | "grid6" | "grid9" | "grid12" | "keyframes"
  // video 节点
  videoMode?: "text" | "image";
  duration?: number;
  // video: 480p/720p/1080p；image（GPT-Image 系列）: 1k/2k
  resolution?: string;
  // audio 节点（TTS / 音乐生成）
  voice?: string;
  speed?: number;
  mode?: "song" | "music"; // 歌曲（人声）/ 纯音乐
  vocal?: "auto" | "male" | "female"; // 人声偏好（映射到音色）
  // upload 节点
  storageKey?: string; // OSS 对象键
  fileName?: string;
  mediaType?: string; // image | video | audio
  // 通用
  [key: string]: unknown;
}

export interface CanvasNodeOutput {
  kind: OutputKind;
  text?: string;
  /** 展示用 URL，由读取方（快照/执行接口）对 storageKeys 动态签名生成，不持久化。 */
  urls?: string[];
  /** 结果的事实源：OSS storage key。 */
  storageKeys?: string[];
  storyboard?: Storyboard;
  meta?: Record<string, unknown>;
}

export interface CanvasNodeDTO {
  id: string;
  type: CanvasNodeType;
  x: number;
  y: number;
  revisionId?: number;
  config: CanvasNodeConfig;
  status: StepStatus;
  /** 最近一次执行后配置又被修改：展示的产物已过期，下游引用会被预检拦截 */
  outputStale?: boolean;
  output?: CanvasNodeOutput;
  error?: string;
}

export interface CanvasEdgeDTO {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
}

export interface CanvasSnapshot {
  canvasId: number;
  projectId: number;
  revision: number;
  nodes: CanvasNodeDTO[];
  edges: CanvasEdgeDTO[];
}

export interface StepRunDTO {
  id: number;
  executionId: number;
  nodeId: string;
  status: StepStatus;
  output?: CanvasNodeOutput;
  errorCode?: string;
  errorMessage?: string;
  creditsConsumed: number;
}

export interface ExecutionDTO {
  id: number;
  canvasId: number;
  scope: ExecutionScope;
  rootNodeId?: string;
  status: ExecutionStatus;
  reservedCredits: number;
  capturedCredits: number;
  errorCode?: string;
  stepRuns: StepRunDTO[];
  createdAt?: string;
  updatedAt?: string;
}

// 运行前估算（PRD-RUN-002 / 技术方案 §九点一 executions/estimate）
export interface EstimateItemDTO {
  nodeId: string;
  nodeType: CanvasNodeType;
  title?: string;
  model?: string;
  credits: number;
}

export interface EstimateDTO {
  canvasId: number;
  scope: ExecutionScope;
  rootNodeId?: string;
  items: EstimateItemDTO[];
  totalCredits: number;
  baseRevision: number;
}

// 不可变执行快照（技术方案 §八点二）：提交执行时冻结的全图状态
export interface SnapshotNode {
  id: string;
  type: CanvasNodeType;
  revisionId: number | null;
  config: CanvasNodeConfig;
}

export interface SnapshotEdge {
  sourceNodeId: string;
  targetNodeId: string;
  sourcePort: string;
  targetPort: string;
}

export interface ExecutionSnapshot {
  revision: number;
  scope: ExecutionScope;
  rootNodeId: string | null;
  nodes: SnapshotNode[];
  edges: SnapshotEdge[];
}

// 画布操作（批量提交）。opId 为客户端生成的一次性序号，仅用于保存响应后
// 精确移除「已发送且未被后续编辑合并」的操作，服务端会忽略该字段。
// nodeId/edgeId 为客户端生成的 UUID，服务端 upsert 天然幂等。
type CanvasOperationCore =
  | { op: "node.upsert"; nodeId: string; type: CanvasNodeType; x: number; y: number; config: CanvasNodeConfig }
  | { op: "node.move"; nodeId: string; x: number; y: number }
  | { op: "node.config"; nodeId: string; config: CanvasNodeConfig }
  | { op: "node.delete"; nodeId: string }
  | { op: "edge.add"; edgeId: string; sourceNodeId: string; targetNodeId: string; targetPort: string }
  | { op: "edge.delete"; edgeId: string }
  | { op: "viewport"; viewport: Record<string, unknown> };

export type CanvasOperation = CanvasOperationCore & { opId?: number };
