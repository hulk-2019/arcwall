import { Film, Image as ImageIcon, Type, Upload, Video, type LucideIcon } from "lucide-react";
import type { CanvasNodeType, StepStatus } from "@/types/canvas";

export const NODE_TYPE_ICON: Record<CanvasNodeType, LucideIcon> = {
  text: Type,
  image: ImageIcon,
  storyboard: Film,
  video: Video,
  upload: Upload,
};

export const NODE_TYPE_TONE: Record<CanvasNodeType, string> = {
  text: "text-canvas-text bg-canvas-text/10",
  image: "text-canvas-image bg-canvas-image/10",
  storyboard: "text-canvas-storyboard bg-canvas-storyboard/10",
  video: "text-canvas-video bg-canvas-video/10",
  upload: "text-canvas-upload bg-canvas-upload/10",
};

export const NODE_TYPE_ACCENT: Record<CanvasNodeType, string> = {
  text: "bg-canvas-text",
  image: "bg-canvas-image",
  storyboard: "bg-canvas-storyboard",
  video: "bg-canvas-video",
  upload: "bg-canvas-upload",
};

export const STATUS_BADGE: Record<StepStatus, string> = {
  idle: "bg-muted text-muted-foreground",
  pending: "bg-warning/15 text-warning",
  queued: "bg-primary/15 text-primary",
  running: "bg-primary/20 text-primary",
  succeeded: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  skipped: "bg-muted text-muted-foreground",
};

export function NodeTypeIcon({
  type,
  className,
}: {
  type: CanvasNodeType;
  className?: string;
}) {
  const Icon = NODE_TYPE_ICON[type];
  return <Icon className={className} aria-hidden />;
}
