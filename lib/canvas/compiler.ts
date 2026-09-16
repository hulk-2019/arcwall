import type {
  CanvasNodeConfig,
  CanvasNodeOutput,
  OutputKind,
  Storyboard,
  StoryboardShot,
} from "@/types/canvas";

/**
 * 节点输入解析与提示词编译。
 * 负责把上游节点的输出映射为当前节点的有效输入（提示词、参考图、首帧、分镜）。
 */

export interface CompiledInputs {
  textChunks: string[];
  referenceImages: string[];
  referenceAudios: string[];
  firstFrame?: string;
  storyboard?: Storyboard;
  /** 有连线但解析不到输出的上游节点 id（用于 INPUT_NOT_READY 定位） */
  missingNodeIds: string[];
}

export interface UpstreamEdge {
  sourceNodeId: string;
  targetNodeId: string;
  targetPort: string;
}

/**
 * 根据上游输出与连线，汇总某个节点的有效输入。
 * 按快照中的连线顺序遍历，保证提示词合并顺序稳定（PRD §八点一）。
 */
export function compileInputs(
  edges: UpstreamEdge[],
  outputsByNode: Map<string, CanvasNodeOutput>
): CompiledInputs {
  const textChunks: string[] = [];
  const referenceImages: string[] = [];
  const referenceAudios: string[] = [];
  const missingNodeIds: string[] = [];
  let firstFrame: string | undefined;
  let storyboard: Storyboard | undefined;

  for (const edge of edges) {
    const output = outputsByNode.get(edge.sourceNodeId);
    if (!output) {
      missingNodeIds.push(edge.sourceNodeId);
      continue;
    }

    switch (edge.targetPort) {
      case "prompt":
        if (output.kind === "text" && output.text) {
          textChunks.push(output.text);
        } else if (output.kind === "storyboard" && output.storyboard) {
          storyboard = storyboard || output.storyboard;
          textChunks.push(storyboardToMotionText(output.storyboard));
        }
        break;
      case "text":
      case "brief":
        if (output.kind === "text" && output.text) {
          textChunks.push(output.text);
        }
        break;
      case "reference_images":
        if (output.kind === "image") {
          const images = output.storageKeys || output.urls || [];
          referenceImages.push(...images);
        }
        break;
      case "first_frame":
        if (output.kind === "image") {
          const first = (output.storageKeys || output.urls || [])[0];
          if (first && !firstFrame) firstFrame = first;
        }
        break;
      case "reference_audio":
        if (output.kind === "audio") {
          const audios = output.storageKeys || output.urls || [];
          referenceAudios.push(...audios);
        }
        break;
    }
  }

  return { textChunks, referenceImages, referenceAudios, firstFrame, storyboard, missingNodeIds };
}

/**
 * 将分镜 JSON 转为一段面向图像/视频模型的可读镜头描述。
 */
export function storyboardToMotionText(storyboard: Storyboard): string {
  const lines = (storyboard.shots || []).map((s) => {
    const parts = [
      `镜头${s.index}`,
      s.shot_size ? `景别:${s.shot_size}` : "",
      s.lens_mm ? `焦段:${s.lens_mm}mm` : "",
      s.subject_action || "",
      s.camera_move ? `运镜:${s.camera_move}` : "",
      s.transition_motivation ? `转场:${s.transition_motivation}` : "",
    ].filter(Boolean);
    return parts.join("，");
  });
  const head = storyboard.title ? `《${storyboard.title}》` : "";
  const visualLock = storyboard.visual_lock
    ? Object.entries(storyboard.visual_lock)
        .map(([k, v]) => `${k}:${v}`)
        .join("；")
    : "";
  return [head, visualLock, ...lines].filter(Boolean).join("\n");
}

/**
 * 合并文本块与节点自身提示词。
 */
export function mergePrompt(chunks: string[], ownPrompt?: string): string {
  const parts = [...chunks, ownPrompt].filter((s) => s && s.trim().length > 0);
  return parts.join("\n\n");
}

/**
 * 图像节点最终提示词（含上游文本 + 分镜描述 + 锁定项 + 自身提示词）。
 */
export function buildImagePrompt(
  config: CanvasNodeConfig,
  compiled: CompiledInputs
): string {
  const lock = config.visualLock
    ? Object.entries(config.visualLock)
        .map(([k, v]) => `${k}: ${v}`)
        .join("，")
    : "";
  return mergePrompt(
    [...compiled.textChunks, lock],
    config.prompt
  );
}

/**
 * 分镜规划节点的结构化输出提示词（system 与 user）。
 */
export function buildStoryboardMessages(
  brief: string,
  visualLock?: Record<string, string>
): { system: string; user: string } {
  const system = [
    "你是一名资深影视分镜师。将用户的创意简报拆分为 3~9 个镜头的结构化分镜列表。",
    "严格输出 JSON 对象，不要输出任何解释、注释或 Markdown 代码块。",
    "JSON 结构必须为：",
    '{"title": string, "duration_seconds": number, "visual_lock": object, "shots": [',
    '  {"index": number, "timecode": string, "shot_size": string, "lens_mm": number,',
    '   "subject_action": string, "camera_move": string, "transition_motivation": string}',
    "]}",
    "shot_size 取值：wide / medium / closeup / extreme_closeup / full / pov。",
    "camera_move 用中文描述运镜（如：缓慢推近、水平横移、固定机位）。",
    "每个镜头必须有 subject_action 与 transition_motivation。",
  ].join("\n");

  const lockText = visualLock
    ? Object.entries(visualLock)
        .map(([k, v]) => `${k}：${v}`)
        .join("；")
    : "";
  const user = lockText ? `创意简报：${brief}\n视觉锁定项：${lockText}` : `创意简报：${brief}`;

  return { system, user };
}

/**
 * 视频节点最终运动提示词。
 */
export function buildVideoPrompt(
  config: CanvasNodeConfig,
  compiled: CompiledInputs
): string {
  const storyboardText = compiled.storyboard
    ? storyboardToMotionText(compiled.storyboard)
    : "";
  return mergePrompt(
    [...compiled.textChunks, storyboardText],
    config.prompt
  );
}

/**
 * 从 LLM 返回文本中稳健地解析分镜 JSON。
 */
export function parseStoryboardJson(text: string): Storyboard {
  const trimmed = text.trim();
  // 去掉可能的 Markdown 代码块
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("STORYBOARD_PARSE_FAILED");
  }
  const obj = JSON.parse(candidate.slice(start, end + 1));
  const shots: StoryboardShot[] = (Array.isArray(obj.shots) ? obj.shots : []).map(
    (s: any, i: number) => ({
      index: Number(s.index ?? i + 1),
      timecode: s.timecode ?? "",
      shot_size: s.shot_size ?? "medium",
      lens_mm: s.lens_mm ? Number(s.lens_mm) : undefined,
      subject_action: String(s.subject_action ?? ""),
      camera_move: s.camera_move ?? "",
      transition_motivation: s.transition_motivation ?? "",
    })
  );
  return {
    title: obj.title ?? "",
    duration_seconds: obj.duration_seconds ? Number(obj.duration_seconds) : undefined,
    visual_lock: obj.visual_lock ?? {},
    shots,
  };
}

export type { OutputKind };
