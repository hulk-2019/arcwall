"use client";

import { create } from "zustand";
import { saveCanvas } from "@/services/api";
import { resolveTargetPort, getNodeTypeDef, nodeOutputKind } from "@/lib/canvas/registry";
import type { TimedLyricWord } from "@/lib/audio-lyrics";
import type {
  CanvasEdgeDTO,
  CanvasNodeDTO,
  CanvasNodeOutput,
  CanvasNodeType,
  CanvasOperation,
  CanvasSnapshot,
  CanvasNodeConfig,
  ExecutionDTO,
  StepStatus,
  VideoReferenceMode,
} from "@/types/canvas";

export type ConnectNodesErrorKey = "connectFailed" | "connectFirstFrameNoAudio";
export type ConnectNodesResult = { ok: true } | { ok: false; errorKey: ConnectNodesErrorKey };

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

interface Snapshot {
  nodes: CanvasNodeDTO[];
  edges: CanvasEdgeDTO[];
}

/** 运行中执行的实时覆盖层：按节点映射 step 状态 / 输出 / 错误（PRD-RUN-003）。 */
export interface LiveExecution {
  id: number;
  statusByNode: Record<string, StepStatus>;
  outputs: Record<string, CanvasNodeOutput>;
  errors: Record<string, string>;
}

/** 媒体预览弹窗状态：urls 为已签名链接，多图时可切换。 */
export interface MediaPreviewState {
  kind: "image" | "video" | "audio";
  urls: string[];
  index: number;
  title?: string;
  nodeId?: string;
  lyrics?: string;
  timedWords?: TimedLyricWord[];
}

interface CanvasState {
  canvasId: number | null;
  projectId: number | null;
  nodes: CanvasNodeDTO[];
  edges: CanvasEdgeDTO[];
  selectedId: string | null;
  viewport: Viewport;
  dirty: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;
  lastRevision: number | null;
  liveExecution: LiveExecution | null;
  /** 引用拾取模式：从某节点「添加引用」后，点击目标节点完成连线 */
  connectFrom: string | null;
  mediaPreview: MediaPreviewState | null;

  reset: () => void;
  loadSnapshot: (snapshot: CanvasSnapshot) => void;
  addNode: (type: CanvasNodeType, x: number, y: number) => void;
  moveNode: (id: string, x: number, y: number, commit?: boolean) => void;
  updateNodeConfig: (id: string, config: CanvasNodeConfig) => void;
  editNodeConfig: (id: string, config: CanvasNodeConfig) => void;
  beginEdit: () => void;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  connectNodes: (sourceId: string, targetId: string) => ConnectNodesResult;
  setVideoReferenceMode: (nodeId: string, mode: VideoReferenceMode) => number;
  deleteEdge: (id: string) => void;
  select: (id: string | null) => void;
  setViewport: (vp: Partial<Viewport>) => void;
  undo: () => void;
  redo: () => void;
  flush: () => Promise<boolean>;
  applyExecution: (execution: ExecutionDTO) => void;
  clearLiveExecution: () => void;
  setConnectFrom: (nodeId: string | null) => void;
  openMediaPreview: (preview: Omit<MediaPreviewState, "index"> & { index?: number }) => void;
  closeMediaPreview: () => void;
  cycleMediaPreview: (delta: number) => void;
}

interface PendingState {
  pendingOps: CanvasOperation[];
  persistedNodeIds: Set<string>;
  persistedEdgeIds: Set<string>;
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  saveTimer: ReturnType<typeof setTimeout> | null;
}

type Store = CanvasState & PendingState;

function clone(nodes: CanvasNodeDTO[], edges: CanvasEdgeDTO[]): Snapshot {
  return {
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
  };
}

/**
 * 节点/边主键为客户端生成的 UUID（crypto.randomUUID）：
 * - 乐观创建无需服务端回传 id 映射；
 * - 保存操作按 id upsert，天然幂等；
 * - UUID 全局唯一，不存在临时 id 与真实 id 的碰撞/重映射问题。
 */

export const useCanvasStore = create<Store>((set, get) => {
  // 递增 op 序号：保存响应后按 opId 精确移除「已发送且未被合并替换」的操作。
  // recordOp 中对已有 op 的去重/合并会替换为带新 opId 的对象，使合并结果得以保留。
  let opSeq = 0;
  const nextOpId = () => ++opSeq;

  const scheduleSave = (delay = 900) => {
    const cur = get();
    if (cur.saveTimer) clearTimeout(cur.saveTimer);
    const timer = setTimeout(() => {
      void get().flush();
    }, delay);
    set({ saveTimer: timer });
  };

  const recordOp = (op: CanvasOperation) => {
    const { pendingOps } = get();
    let ops = [...pendingOps];
    const tagged = { ...op, opId: nextOpId() };

    if (op.op === "node.upsert") {
      const idx = ops.findLastIndex((o) => o.op === "node.upsert" && o.nodeId === op.nodeId);
      if (idx >= 0) ops[idx] = tagged;
      else ops.push(tagged);
    } else if (op.op === "node.move") {
      const ui = ops.findLastIndex((o) => o.op === "node.upsert" && o.nodeId === op.nodeId);
      if (ui >= 0) {
        const base = ops[ui] as Extract<CanvasOperation, { op: "node.upsert" }>;
        ops[ui] = { ...base, x: op.x, y: op.y, opId: nextOpId() };
      } else {
        const idx = ops.findLastIndex((o) => o.op === "node.move" && o.nodeId === op.nodeId);
        if (idx >= 0) ops[idx] = tagged;
        else ops.push(tagged);
      }
    } else if (op.op === "node.config") {
      const ui = ops.findLastIndex((o) => o.op === "node.upsert" && o.nodeId === op.nodeId);
      if (ui >= 0) {
        const base = ops[ui] as Extract<CanvasOperation, { op: "node.upsert" }>;
        ops[ui] = { ...base, config: op.config, opId: nextOpId() };
      } else {
        const idx = ops.findLastIndex((o) => o.op === "node.config" && o.nodeId === op.nodeId);
        if (idx >= 0) ops[idx] = tagged;
        else ops.push(tagged);
      }
    } else if (op.op === "node.delete") {
      ops = ops.filter((o) => {
        if (o.op === "node.delete" || o.op === "node.move" || o.op === "node.config" || o.op === "node.upsert") {
          return o.nodeId !== op.nodeId;
        }
        return true;
      });
      ops = ops.filter((o) => {
        if (o.op === "edge.add") {
          return o.sourceNodeId !== op.nodeId && o.targetNodeId !== op.nodeId;
        }
        return true;
      });
      if (get().persistedNodeIds.has(op.nodeId)) {
        ops.push(tagged);
      }
    } else if (op.op === "edge.add") {
      const idx = ops.findLastIndex((o) => o.op === "edge.add" && o.edgeId === op.edgeId);
      if (idx >= 0) ops[idx] = tagged;
      else ops.push(tagged);
    } else if (op.op === "edge.delete") {
      ops = ops.filter((o) => !(o.op === "edge.add" && o.edgeId === op.edgeId));
      if (get().persistedEdgeIds.has(op.edgeId)) {
        ops.push(tagged);
      }
    } else {
      ops.push(tagged);
    }

    set({ pendingOps: ops, dirty: true });
    scheduleSave();
  };

  const pushUndo = () => {
    const { nodes, edges, undoStack } = get();
    set({
      undoStack: [...undoStack.slice(-99), clone(nodes, edges)],
      redoStack: [],
    });
  };

  const rebuildOps = (snapshot: Snapshot): CanvasOperation[] => {
    const { persistedNodeIds, persistedEdgeIds } = get();
    const ops: CanvasOperation[] = [];

    // 删除：已持久化但目标状态中不存在的节点/边
    const targetNodeIds = new Set(snapshot.nodes.map((n) => n.id));
    const targetEdgeIds = new Set(snapshot.edges.map((e) => e.id));
    for (const id of persistedNodeIds) {
      if (!targetNodeIds.has(id)) ops.push({ op: "node.delete", nodeId: id, opId: nextOpId() });
    }
    for (const id of persistedEdgeIds) {
      if (!targetEdgeIds.has(id)) ops.push({ op: "edge.delete", edgeId: id, opId: nextOpId() });
    }
    for (const n of snapshot.nodes) {
      ops.push({ op: "node.upsert", nodeId: n.id, type: n.type, x: n.x, y: n.y, config: n.config, opId: nextOpId() });
    }
    for (const e of snapshot.edges) {
      ops.push({
        op: "edge.add",
        edgeId: e.id,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        targetPort: e.targetPort,
        opId: nextOpId(),
      });
    }
    return ops;
  };

  const applySnapshot = (snapshot: Snapshot) => {
    set({
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      pendingOps: rebuildOps(snapshot),
      dirty: true,
    });
    scheduleSave();
  };

  return {
    canvasId: null,
    projectId: null,
    nodes: [],
    edges: [],
    selectedId: null,
    viewport: { x: 0, y: 0, scale: 1 },
    dirty: false,
    isSaving: false,
    lastSavedAt: null,
    lastRevision: null,
    liveExecution: null,
    connectFrom: null,
    mediaPreview: null,

    pendingOps: [],
    persistedNodeIds: new Set<string>(),
    persistedEdgeIds: new Set<string>(),
    undoStack: [],
    redoStack: [],
    saveTimer: null,

    reset: () =>
      set({
        canvasId: null,
        projectId: null,
        nodes: [],
        edges: [],
        selectedId: null,
        viewport: { x: 0, y: 0, scale: 1 },
        dirty: false,
        isSaving: false,
        lastSavedAt: null,
        lastRevision: null,
        liveExecution: null,
        connectFrom: null,
        mediaPreview: null,
        pendingOps: [],
        persistedNodeIds: new Set<string>(),
        persistedEdgeIds: new Set<string>(),
        undoStack: [],
        redoStack: [],
      }),

    loadSnapshot: (snapshot) => {
      set({
        canvasId: snapshot.canvasId,
        projectId: snapshot.projectId,
        nodes: JSON.parse(JSON.stringify(snapshot.nodes)),
        edges: JSON.parse(JSON.stringify(snapshot.edges)),
        selectedId: null,
        dirty: false,
        lastRevision: snapshot.revision,
        pendingOps: [],
        persistedNodeIds: new Set<string>(snapshot.nodes.map((n) => n.id)),
        persistedEdgeIds: new Set<string>(snapshot.edges.map((e) => e.id)),
        undoStack: [],
        redoStack: [],
        connectFrom: null,
      });
    },

    addNode: (type, x, y) => {
      pushUndo();
      const def = getNodeTypeDef(type);
      const node: CanvasNodeDTO = {
        id: crypto.randomUUID(),
        type,
        x,
        y,
        config: JSON.parse(JSON.stringify(def.defaults)),
        status: "idle",
      };
      set({ nodes: [...get().nodes, node], selectedId: node.id });
      recordOp({ op: "node.upsert", nodeId: node.id, type, x, y, config: node.config });
    },

    moveNode: (id, x, y, commit = true) => {
      set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) });
      if (commit) recordOp({ op: "node.move", nodeId: id, x, y });
    },

    updateNodeConfig: (id, config) => {
      set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, config } : n)) });
      recordOp({ op: "node.config", nodeId: id, config });
    },

    editNodeConfig: (id, config) => {
      pushUndo();
      set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, config } : n)) });
      recordOp({ op: "node.config", nodeId: id, config });
    },

    beginEdit: () => {
      pushUndo();
    },

    deleteNode: (id) => {
      pushUndo();
      set({
        nodes: get().nodes.filter((n) => n.id !== id),
        edges: get().edges.filter((e) => e.sourceNodeId !== id && e.targetNodeId !== id),
        selectedId: get().selectedId === id ? null : get().selectedId,
        connectFrom: get().connectFrom === id ? null : get().connectFrom,
      });
      recordOp({ op: "node.delete", nodeId: id });
    },

    duplicateNode: (id) => {
      const src = get().nodes.find((n) => n.id === id);
      if (!src) return;
      pushUndo();
      const copy: CanvasNodeDTO = {
        ...JSON.parse(JSON.stringify(src)),
        id: crypto.randomUUID(),
        x: src.x + 32,
        y: src.y + 32,
        status: "idle",
        output: undefined,
        error: undefined,
      };
      set({ nodes: [...get().nodes, copy], selectedId: copy.id });
      recordOp({ op: "node.upsert", nodeId: copy.id, type: copy.type, x: copy.x, y: copy.y, config: copy.config });
    },

    setVideoReferenceMode: (nodeId, mode) => {
      const { nodes, edges } = get();
      const node = nodes.find((item) => item.id === nodeId);
      if (!node || node.type !== "video") return 0;

      const removedEdges =
        mode === "first_frame"
          ? edges.filter(
              (edge) => edge.targetNodeId === nodeId && edge.targetPort === "reference_audio"
            )
          : [];
      const removedIds = new Set(removedEdges.map((edge) => edge.id));
      const config = { ...node.config, videoReferenceMode: mode };

      pushUndo();
      set({
        nodes: nodes.map((item) => (item.id === nodeId ? { ...item, config } : item)),
        edges: edges.filter((edge) => !removedIds.has(edge.id)),
      });
      recordOp({ op: "node.config", nodeId, config });
      for (const edge of removedEdges) {
        recordOp({ op: "edge.delete", edgeId: edge.id });
      }
      return removedEdges.length;
    },

    connectNodes: (sourceId, targetId) => {
      const { nodes, edges } = get();
      if (sourceId === targetId) return { ok: false, errorKey: "connectFailed" };
      const source = nodes.find((n) => n.id === sourceId);
      const target = nodes.find((n) => n.id === targetId);
      if (!source || !target) return { ok: false, errorKey: "connectFailed" };
      // upload 节点的输出类型随 mediaType 变化（image/video/audio）
      const sourceKind = nodeOutputKind(source.type, source.config);
      const targetPort = resolveTargetPort(sourceKind, target.type);
      if (!targetPort) return { ok: false, errorKey: "connectFailed" };
      if (edges.some((e) => e.sourceNodeId === sourceId && e.targetNodeId === targetId)) {
        return { ok: true };
      }

      const hasImageReference =
        target.type === "video" &&
        edges.some((edge) => edge.targetNodeId === targetId && edge.targetPort === "first_frame");
      if (target.type === "video" && sourceKind === "audio") {
        const mode = target.config.videoReferenceMode || "first_frame";
        if (mode !== "multimodal") {
          return { ok: false, errorKey: "connectFirstFrameNoAudio" };
        }
        if (!hasImageReference) {
          return { ok: false, errorKey: "connectFailed" };
        }
      }

      const hasAudioReference =
        target.type === "video" &&
        edges.some(
          (edge) => edge.targetNodeId === targetId && edge.targetPort === "reference_audio"
        );
      const shouldUseMultimodal =
        target.type === "video" && sourceKind === "image" && hasAudioReference;
      const targetConfig = shouldUseMultimodal
        ? { ...target.config, videoReferenceMode: "multimodal" as const }
        : target.config;

      pushUndo();
      const edge: CanvasEdgeDTO = {
        id: crypto.randomUUID(),
        sourceNodeId: sourceId,
        sourcePort: "output",
        targetNodeId: targetId,
        targetPort,
      };
      set({
        nodes: shouldUseMultimodal
          ? nodes.map((node) =>
              node.id === targetId ? { ...node, config: targetConfig } : node
            )
          : nodes,
        edges: [...edges, edge],
      });
      if (shouldUseMultimodal) {
        recordOp({ op: "node.config", nodeId: targetId, config: targetConfig });
      }
      recordOp({
        op: "edge.add",
        edgeId: edge.id,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        targetPort,
      });
      return { ok: true };
    },

    deleteEdge: (id) => {
      pushUndo();
      set({ edges: get().edges.filter((e) => e.id !== id) });
      recordOp({ op: "edge.delete", edgeId: id });
    },

    select: (id) => set({ selectedId: id }),

    setViewport: (vp) => set({ viewport: { ...get().viewport, ...vp } }),

    applyExecution: (execution) => {
      const statusByNode: Record<string, StepStatus> = {};
      const outputs: Record<string, CanvasNodeOutput> = {};
      const errors: Record<string, string> = {};
      for (const step of execution.stepRuns || []) {
        statusByNode[step.nodeId] = step.status;
        if (step.output) outputs[step.nodeId] = step.output;
        if (step.errorMessage) errors[step.nodeId] = step.errorMessage;
      }
      set({ liveExecution: { id: execution.id, statusByNode, outputs, errors } });
    },

    clearLiveExecution: () => set({ liveExecution: null }),

    setConnectFrom: (nodeId) => set({ connectFrom: nodeId }),

    openMediaPreview: (preview) =>
      set({ mediaPreview: { index: preview.index ?? 0, ...preview } }),

    closeMediaPreview: () => set({ mediaPreview: null }),

    cycleMediaPreview: (delta) => {
      const cur = get().mediaPreview;
      if (!cur || cur.urls.length <= 1) return;
      const index = (cur.index + delta + cur.urls.length) % cur.urls.length;
      set({ mediaPreview: { ...cur, index } });
    },

    undo: () => {
      const { undoStack, redoStack, nodes, edges } = get();
      if (undoStack.length === 0) return;
      const prev = undoStack[undoStack.length - 1];
      set({
        undoStack: undoStack.slice(0, -1),
        redoStack: [...redoStack, clone(nodes, edges)],
      });
      applySnapshot(prev);
    },

    redo: () => {
      const { redoStack, undoStack, nodes, edges } = get();
      if (redoStack.length === 0) return;
      const next = redoStack[redoStack.length - 1];
      set({
        redoStack: redoStack.slice(0, -1),
        undoStack: [...undoStack, clone(nodes, edges)],
      });
      applySnapshot(next);
    },

    /**
     * 提交待保存操作。核心原则：本地状态（nodes/edges）始终等于
     * 「已持久化状态 + 未保存操作」，节点/边 id 为客户端 UUID，保存后 id 不变，
     * 因此成功响应完全不需要触碰本地 nodes/edges/selectedId，只做：
     * 1. 按 opId 移除「已发送且未被后续编辑合并替换」的操作；
     * 2. 把本次发送的实体 id 标记为已持久化；
     * 3. 补偿：保存飞行期间被本地删除的新建实体，追加 delete 操作，
     *    避免服务端留下孤儿（刷新后“复活”）。
     */
    flush: async () => {
      const { canvasId, pendingOps, isSaving } = get();
      if (!canvasId || pendingOps.length === 0 || isSaving) return false;

      const sentOps = pendingOps;
      const sentOpIds = new Set(
        sentOps.map((o) => o.opId).filter((v): v is number => v != null)
      );
      // 本次发送中属于「新建」的实体（发送时尚未持久化）
      const sentUpsertNodeIds = sentOps
        .filter((o) => o.op === "node.upsert")
        .map((o) => o.nodeId);
      const sentAddEdgeIds = sentOps.filter((o) => o.op === "edge.add").map((o) => o.edgeId);

      set({ isSaving: true });
      try {
        const res: any = await saveCanvas(canvasId, sentOps);
        if (res.code === 0 && res.data) {
          // 保留保存期间新增/合并的操作（UUID id 无需任何重映射）
          const remainingOps = (get().pendingOps as CanvasOperation[]).filter(
            (o) => o.opId == null || !sentOpIds.has(o.opId)
          );

          const persistedNodeIds = new Set(get().persistedNodeIds);
          const persistedEdgeIds = new Set(get().persistedEdgeIds);

          // 补偿：飞行期间被本地删除（不在当前状态且无删除操作）的新建节点
          const currentNodeIds = new Set(get().nodes.map((n) => n.id));
          const deletedNodeIds = new Set(
            remainingOps.filter((o) => o.op === "node.delete").map((o) => o.nodeId)
          );
          for (const id of sentUpsertNodeIds) {
            persistedNodeIds.add(id);
            if (!currentNodeIds.has(id) && !deletedNodeIds.has(id)) {
              remainingOps.push({ op: "node.delete", nodeId: id, opId: nextOpId() });
            }
          }
          // 补偿：飞行期间被本地删除的新建边
          const currentEdgeIds = new Set(get().edges.map((e) => e.id));
          const deletedEdgeIds = new Set(
            remainingOps.filter((o) => o.op === "edge.delete").map((o) => o.edgeId)
          );
          for (const id of sentAddEdgeIds) {
            persistedEdgeIds.add(id);
            if (!currentEdgeIds.has(id) && !deletedEdgeIds.has(id)) {
              remainingOps.push({ op: "edge.delete", edgeId: id, opId: nextOpId() });
            }
          }

          set({
            pendingOps: remainingOps,
            persistedNodeIds,
            persistedEdgeIds,
            lastRevision: res.data.revision,
            dirty: remainingOps.length > 0,
            lastSavedAt: Date.now(),
            isSaving: false,
          });

          // 保存期间又产生了新操作（或合并更新）：立即安排下一次保存
          if (remainingOps.length > 0) scheduleSave(300);
          return true;
        }
        // 接口级失败：保留操作并延时重试
        set({ isSaving: false });
        scheduleSave(3000);
        return false;
      } catch (e) {
        console.error("canvas save failed:", e);
        set({ isSaving: false });
        scheduleSave(3000);
        return false;
      }
    },
  };
});
