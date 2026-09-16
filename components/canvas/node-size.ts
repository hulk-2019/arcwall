import type { CanvasNodeDTO, CanvasNodeType } from "@/types/canvas";

export const NODE_WIDTH = 248;

/**
 * 按节点类型区分高度：媒体类节点（图片/视频/上传）内嵌展示区更高，
 * 文本/分镜/音频节点保持紧凑。高度必须为固定值——
 * 输入/输出端口坐标、连线几何、命中检测都依赖它，动态测量会导致端口跳动。
 */
const TYPE_HEIGHTS: Record<CanvasNodeType, number> = {
  text: 168,
  storyboard: 176,
  image: 300,
  video: 312,
  audio: 176,
  upload: 300,
};

export function nodeHeight(type: CanvasNodeType): number {
  return TYPE_HEIGHTS[type] ?? 176;
}

export function nodeSize(node: Pick<CanvasNodeDTO, "type">): {
  width: number;
  height: number;
} {
  return { width: NODE_WIDTH, height: nodeHeight(node.type) };
}

/** 兼容旧调用：批量布局场景下的最大高度。 */
export const NODE_HEIGHT = Math.max(...Object.values(TYPE_HEIGHTS));
