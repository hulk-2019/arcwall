import { NODE_WIDTH, nodeHeight } from "./node-size";
import type { CanvasNodeDTO } from "@/types/canvas";

export interface Point {
  x: number;
  y: number;
}

export function bezierPath(a: Point, b: Point): string {
  const dx = Math.max(48, Math.abs(b.x - a.x) * 0.5);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

export function outputPoint(node: CanvasNodeDTO): Point {
  return { x: node.x + NODE_WIDTH, y: node.y + nodeHeight(node) / 2 };
}

export function inputPoint(node: CanvasNodeDTO): Point {
  return { x: node.x, y: node.y + nodeHeight(node) / 2 };
}

export function clientToWorld(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
  viewport: { x: number; y: number; scale: number }
): Point {
  return {
    x: (clientX - rect.left - viewport.x) / viewport.scale,
    y: (clientY - rect.top - viewport.y) / viewport.scale,
  };
}

export function worldToScreen(
  point: Point,
  viewport: { x: number; y: number; scale: number }
): Point {
  return {
    x: point.x * viewport.scale + viewport.x,
    y: point.y * viewport.scale + viewport.y,
  };
}

export function hitTestConnectTarget(
  world: Point,
  nodes: CanvasNodeDTO[],
  sourceId: string,
  scale: number
): string | null {
  const handleRadius = 24 / Math.max(scale, 0.2);
  let nearest: { id: string; distance: number } | null = null;

  for (const node of nodes) {
    if (node.id === sourceId) continue;
    const input = inputPoint(node);
    const distance = Math.hypot(world.x - input.x, world.y - input.y);
    if (distance <= handleRadius && (!nearest || distance < nearest.distance)) {
      nearest = { id: node.id, distance };
    }
  }
  if (nearest) return nearest.id;

  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (node.id === sourceId) continue;
    if (
      world.x >= node.x &&
      world.x <= node.x + NODE_WIDTH &&
      world.y >= node.y &&
      world.y <= node.y + nodeHeight(node)
    ) {
      return node.id;
    }
  }
  return null;
}

export interface ChromeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function canvasChromeInsets(width: number): ChromeInsets {
  if (width < 768) {
    return { top: 76, right: 16, bottom: 96, left: 16 };
  }
  return { top: 76, right: 24, bottom: 56, left: 108 };
}

export function workAreaCenter(width: number, height: number): Point {
  const insets = canvasChromeInsets(width);
  return {
    x: insets.left + Math.max(160, width - insets.left - insets.right) / 2,
    y: insets.top + Math.max(160, height - insets.top - insets.bottom) / 2,
  };
}

export function viewportCenterWorld(
  viewport: { x: number; y: number; scale: number },
  width: number,
  height: number
): Point {
  const center = workAreaCenter(width, height);
  return {
    x: (center.x - viewport.x) / viewport.scale,
    y: (center.y - viewport.y) / viewport.scale,
  };
}

export function nextNodePosition(
  nodes: CanvasNodeDTO[],
  viewport: { x: number; y: number; scale: number },
  width: number,
  height: number
): Point {
  const center = viewportCenterWorld(viewport, width, height);
  const gap = 48;
  for (let index = 0; index < 64; index += 1) {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const x = Math.round(center.x - NODE_WIDTH / 2 + col * (NODE_WIDTH + gap));
    const rowH = Math.max(...(nodes.length ? nodes.map((n) => nodeHeight(n)) : [176])) + gap;
    const y = Math.round(center.y - 176 / 2 + row * rowH);
    const occupied = nodes.some(
      (node) => Math.abs(node.x - x) < NODE_WIDTH && Math.abs(node.y - y) < nodeHeight(node)
    );
    if (!occupied) return { x, y };
  }
  return {
    x: Math.round(center.x - NODE_WIDTH / 2 + nodes.length * 32),
    y: Math.round(center.y - 176 / 2 + nodes.length * 32),
  };
}

export function getStageSize(stage?: HTMLElement | null): { width: number; height: number } {
  return {
    width: stage?.clientWidth || window.innerWidth,
    height: stage?.clientHeight || window.innerHeight,
  };
}

export function fitNodesToView(
  nodes: CanvasNodeDTO[],
  width: number,
  height: number
): { x: number; y: number; scale: number } {
  const center = workAreaCenter(width, height);
  if (nodes.length === 0 || width <= 0 || height <= 0) {
    return { x: center.x, y: center.y, scale: 1 };
  }

  const insets = canvasChromeInsets(width);
  const workW = Math.max(160, width - insets.left - insets.right);
  const workH = Math.max(160, height - insets.top - insets.bottom);
  const pad = 64;
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + NODE_WIDTH));
  const maxY = Math.max(...nodes.map((n) => n.y + nodeHeight(n)));
  const contentW = Math.max(1, maxX - minX + pad * 2);
  const contentH = Math.max(1, maxY - minY + pad * 2);
  const fitScale = Math.min(workW / contentW, workH / contentH);
  const scale = Math.min(1, Math.max(0.2, fitScale));
  const contentCx = (minX + maxX) / 2;
  const contentCy = (minY + maxY) / 2;

  return {
    scale,
    x: center.x - contentCx * scale,
    y: center.y - contentCy * scale,
  };
}
