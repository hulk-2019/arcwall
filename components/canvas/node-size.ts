import type { CanvasNodeDTO, CanvasNodeType } from "@/types/canvas";

export const NODE_WIDTH = 248;

/**
 * 节点头部（标题行 + 状态徽标行 + 间距 + 边框）占用的固定高度。
 * NodeCard 头部布局变化时需同步此常量。
 */
const NODE_CHROME_HEIGHT = 72;

const COMPACT_HEIGHTS: Partial<Record<CanvasNodeType, number>> = {
  text: 168,
  storyboard: 176,
  audio: 176,
  upload: 300,
};

function parseHeightRatio(ratio?: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/.exec(ratio || "");
  if (!m) return 9 / 16;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 ? h / w : 1;
}

/**
 * 节点高度：
 * - 图片/视频：头部固定高度 + 媒体区按配置画幅（NODE_WIDTH × 高宽比）撑满，
 *   媒体内容无留白（区域比例即目标画幅）；
 * - 其余类型：固定紧凑高度。
 * 端口坐标、连线几何、命中检测都依赖该值，必须可静态计算。
 */
export function nodeHeight(node: Pick<CanvasNodeDTO, "type" | "config">): number {
  if (node.type === "image" || node.type === "video") {
    return Math.round(NODE_CHROME_HEIGHT + NODE_WIDTH * parseHeightRatio(node.config?.aspectRatio));
  }
  return COMPACT_HEIGHTS[node.type] ?? 176;
}

export function nodeSize(node: Pick<CanvasNodeDTO, "type" | "config">): {
  width: number;
  height: number;
} {
  return { width: NODE_WIDTH, height: nodeHeight(node) };
}
