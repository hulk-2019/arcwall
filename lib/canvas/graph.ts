import type { ExecutionScope } from "@/types/canvas";

/**
 * DAG 编译辅助：邻接表、拓扑排序、环检测、执行范围解析。
 * 遵循技术方案 §七点一 的编译流程。节点 id 为客户端生成的 UUID 字符串。
 */

export interface EdgeRef {
  sourceNodeId: string;
  targetNodeId: string;
}

export interface Graph {
  successors: Map<string, string[]>; // nodeId -> downstream nodeIds
  predecessors: Map<string, string[]>; // nodeId -> upstream nodeIds
}

export function buildGraph(nodeIds: string[], edges: EdgeRef[]): Graph {
  const successors = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();
  for (const id of nodeIds) {
    successors.set(id, []);
    predecessors.set(id, []);
  }
  for (const e of edges) {
    // 忽略自环与非法边（保存阶段已校验，这里兜底）
    if (e.sourceNodeId === e.targetNodeId) continue;
    if (!successors.has(e.sourceNodeId) || !successors.has(e.targetNodeId)) continue;
    successors.get(e.sourceNodeId)!.push(e.targetNodeId);
    predecessors.get(e.targetNodeId)!.push(e.sourceNodeId);
  }
  return { successors, predecessors };
}

/**
 * 拓扑排序（Kahn，仅统计子图内的入度）。若子图内存在环则抛出错误（对应 INVALID_GRAPH）。
 * 注意：来自子图外节点的连线不算入度，否则「运行单节点/下游」会被误判为环。
 */
export function topoSort(nodeIds: string[], graph: Graph): string[] {
  const inSubgraph = new Set(nodeIds);
  const indegree = new Map<string, number>();
  for (const id of nodeIds) {
    const predsInSubgraph = (graph.predecessors.get(id) || []).filter((p) => inSubgraph.has(p));
    indegree.set(id, predsInSubgraph.length);
  }
  const queue: string[] = [];
  for (const id of nodeIds) {
    if (indegree.get(id) === 0) queue.push(id);
  }
  const result: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const next of graph.successors.get(current) || []) {
      if (!inSubgraph.has(next)) continue;
      const d = (indegree.get(next) || 0) - 1;
      indegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  if (result.length !== nodeIds.length) {
    throw new Error("INVALID_GRAPH");
  }
  return result;
}

/**
 * 计算某节点的所有下游节点（传递闭包，按拓扑顺序）。
 */
export function collectDownstream(root: string, graph: Graph): string[] {
  const visited = new Set<string>();
  const stack = [root];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const next of graph.successors.get(id) || []) {
      if (!visited.has(next)) stack.push(next);
    }
  }
  // 返回按拓扑顺序
  return topoSort([...visited], graph);
}

/**
 * 解析执行范围，返回该范围内需要执行的节点 id 列表（保持拓扑顺序）。
 */
export function resolveScope(
  nodeIds: string[],
  edges: EdgeRef[],
  scope: ExecutionScope,
  rootNodeId?: string
): string[] {
  const graph = buildGraph(nodeIds, edges);

  let targetIds: string[];
  if (scope === "all") {
    targetIds = [...nodeIds];
  } else if (scope === "downstream") {
    if (rootNodeId == null) {
      throw new Error("MISSING_ROOT_NODE");
    }
    targetIds = collectDownstream(rootNodeId, graph);
  } else {
    // "node": 仅执行该节点
    if (rootNodeId == null) {
      throw new Error("MISSING_ROOT_NODE");
    }
    targetIds = [rootNodeId];
  }

  return topoSort(targetIds, graph);
}

/**
 * 给定子图，返回其中可直接开始执行的节点（无子图内上游依赖）。
 */
export function readyRoots(nodeIds: string[], graph: Graph): string[] {
  return nodeIds.filter((id) => (graph.predecessors.get(id) || []).length === 0);
}

/**
 * 返回子图内某节点的上游节点（仅在子图内）。
 */
export function upstreamInSubgraph(nodeId: string, graph: Graph): string[] {
  return graph.predecessors.get(nodeId) || [];
}
