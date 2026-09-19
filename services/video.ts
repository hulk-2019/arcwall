import axios from "axios";

/**
 * 豆包 Seedance 视频生成适配器（302.ai 转发火山方舟异步任务协议）。
 * 遵循技术方案 §八点四：把供应商任务收敛为 submit / status / cancel 三个动作。
 * 轮询节奏由平台 poller 控制（分层退避），不在此处阻塞等待。
 *
 * 302.ai Seedance API：
 *   创建：POST {PROXY_302AI_BASE_URL}/volcengine/api/v3/contents/generations/tasks
 *   查询：GET  {PROXY_302AI_BASE_URL}/volcengine/api/v3/contents/generations/tasks/{task_id}
 *   取消：DELETE 同一任务地址（供应商未公开文档，best-effort）
 */

export type VideoTaskStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired"
  | "unknown";

export interface CreateVideoTaskInput {
  model: string;
  prompt: string;
  firstFrameUrl?: string;
  /** 多模态参考图；与 firstFrameUrl 互斥。 */
  referenceImageUrls?: string[];
  /** 参考音频（PRD-VID-002）：仅在上游连接音频时传入 */
  referenceAudioUrl?: string;
  resolution?: string; // 480p | 720p | 1080p
  ratio?: string; // 16:9 | 9:16 | 1:1 ...
  duration?: number; // 秒
}

export interface VideoTaskRef {
  providerTaskId: string;
  status: VideoTaskStatus;
}

export interface VideoTaskResult {
  status: VideoTaskStatus;
  videoUrl?: string;
  raw?: unknown;
}

function apiBase(): string {
  const base = (process.env.PROXY_302AI_BASE_URL || "https://api.302.ai")
    .trim()
    .replace(/^["']+/, "")
    .replace(/["';\s]+$/, "")
    .replace(/\/+$/, "");
  return `${base}/volcengine/api/v3/contents/generations/tasks`;
}

function authHeaders() {
  const key = (process.env.PROXY_302AI_API_KEY || "").trim();
  if (!key) {
    throw new Error("未配置 302.ai 代理（PROXY_302AI_API_KEY）");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

function normalizeStatus(raw: string | undefined): VideoTaskStatus {
  switch (raw) {
    case "queued":
    case "running":
    case "succeeded":
    case "failed":
    case "cancelled":
    case "expired":
      return raw;
    default:
      return "unknown";
  }
}

/** 302.ai 创建任务会先处理内联图片/音频，图生视频常超过 30s。 */
export const CREATE_VIDEO_TASK_TIMEOUT_MS = 180_000;

export async function createVideoTask(
  input: CreateVideoTaskInput
): Promise<VideoTaskRef> {
  const content: any[] = [{ type: "text", text: input.prompt }];
  if (input.firstFrameUrl) {
    content.push({
      type: "image_url",
      image_url: { url: input.firstFrameUrl },
      role: "first_frame",
    });
  }
  for (const url of input.referenceImageUrls ?? []) {
    content.push({
      type: "image_url",
      image_url: { url },
      role: "reference_image",
    });
  }
  if (input.referenceAudioUrl) {
    content.push({
      type: "audio_url",
      audio_url: { url: input.referenceAudioUrl },
      role: "reference_audio",
    });
  }

  const body: Record<string, unknown> = {
    model: input.model,
    content,
  };
  if (input.resolution) body.resolution = input.resolution;
  if (input.ratio) body.ratio = input.ratio;
  if (input.duration) body.duration = input.duration;
  body.watermark = false;

  let res;
  try {
    res = await axios.post(apiBase(), body, {
      headers: authHeaders(),
      timeout: CREATE_VIDEO_TASK_TIMEOUT_MS,
    });
  } catch (error) {
    const response = (error as any)?.response;
    if (response?.status) {
      const detail =
        typeof response.data === "string" ? response.data : JSON.stringify(response.data);
      throw new Error(
        `302.ai 视频任务创建失败（HTTP ${response.status}）：${detail || "无响应详情"}`
      );
    }
    const code = (error as any)?.code;
    const message = error instanceof Error ? error.message : "";
    if (code === "ECONNABORTED" || /timeout/i.test(message)) {
      throw new Error("302.ai 视频任务创建超时");
    }
    throw error;
  }

  const data = res.data as { id?: string; status?: string };
  if (!data?.id) {
    throw new Error("VIDEO_CREATE_NO_TASK_ID");
  }
  return { providerTaskId: data.id, status: normalizeStatus(data.status) };
}

export async function getVideoTask(taskId: string): Promise<VideoTaskResult> {
  const res = await axios.get(`${apiBase()}/${taskId}`, {
    headers: authHeaders(),
    timeout: 30_000,
  });
  const data = res.data as {
    status?: string;
    content?: { video_url?: string };
    error?: unknown;
  };
  const status = normalizeStatus(data.status);
  const videoUrl = data.content?.video_url;
  return { status, videoUrl, raw: data };
}

export async function cancelVideoTask(taskId: string): Promise<boolean> {
  try {
    await axios.delete(`${apiBase()}/${taskId}`, {
      headers: authHeaders(),
      timeout: 15_000,
    });
    return true;
  } catch (e) {
    console.warn("cancel video task failed:", e);
    return false;
  }
}
