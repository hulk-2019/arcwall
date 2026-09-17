import axios from "axios";

/**
 * 豆包 Seedance 视频生成适配器（火山引擎 Ark 异步任务协议）。
 * 遵循技术方案 §八点四：把供应商任务收敛为 submit / status / cancel 三个动作。
 * 轮询节奏由平台 poller 控制（分层退避），不在此处阻塞等待。
 *
 * 原生 Ark 任务 API：
 *   创建：POST {ARK_API_BASE_URL}/contents/generations/tasks
 *   查询：GET  {ARK_API_BASE_URL}/contents/generations/tasks/{task_id}
 *   取消：DELETE {ARK_API_BASE_URL}/contents/generations/tasks/{task_id}
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
  const base = (process.env.ARK_API_BASE_URL || "").replace(/\/+$/, "");
  return `${base}/contents/generations/tasks`;
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.ARK_API_KEY || ""}`,
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
      timeout: 30_000,
    });
  } catch (error) {
    const response = (error as any)?.response;
    if (response?.status) {
      const detail =
        typeof response.data === "string" ? response.data : JSON.stringify(response.data);
      throw new Error(
        `Ark 视频任务创建失败（HTTP ${response.status}）：${detail || "无响应详情"}`
      );
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
