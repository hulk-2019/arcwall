import axios from "axios";
import { requireProxy } from "./image-proxy";

/**
 * 302.ai Suno 音乐生成接入（doc.302.ai/192310067e0 全自动模式、192310046e0 自定义模式）：
 * - 提交：POST /suno/submit/music，任务 id 在 data 字段，每次生成 2 首
 * - 三种模式：
 *   custom（自定义歌词）：prompt=歌词 + tags 风格 + title，metadata.create_mode=custom
 *   auto（自动写词）：gpt_description_prompt=歌曲描述
 *   instrumental（纯音乐）：gpt_description_prompt + make_instrumental=true
 * - 查询：GET /suno/fetch/{taskId}，clips 内含 audio_url
 */

/** 展示模型 ID → Suno mv 版本码 */
const MODEL_TO_MV: Record<string, string> = {
  "suno-v5.5": "chirp-fenix",
  "suno-v5": "chirp-crow",
  "suno-v4.5plus": "chirp-bluejay",
  "suno-v4.5": "chirp-auk",
  "suno-v4": "chirp-v4",
};

export const SUNO_MODELS = Object.keys(MODEL_TO_MV);

export function sunoMv(model: string): string {
  return MODEL_TO_MV[model] || "chirp-crow";
}

export interface SunoSubmitParams {
  model: string;
  mode: "custom" | "auto" | "instrumental";
  /** custom：歌词；auto/instrumental：歌曲/音乐描述 */
  text: string;
  tags?: string; // 风格标签（custom 模式生效）
  title?: string;
  vocal?: "auto" | "male" | "female";
}

export async function submitSunoTask(params: SunoSubmitParams): Promise<string> {
  const { baseUrl, headers } = requireProxy();
  const mv = sunoMv(params.model);

  const body: Record<string, unknown> = { mv };
  if (params.mode === "custom") {
    body.prompt = params.text;
    body.tags = params.tags || "";
    body.title = (params.title || params.text.slice(0, 20)).slice(0, 80);
    body.make_instrumental = false;
    const metadata: Record<string, unknown> = { create_mode: "custom" };
    if (params.vocal === "male") metadata.vocal_gender = "m";
    if (params.vocal === "female") metadata.vocal_gender = "f";
    body.metadata = metadata;
  } else {
    body.gpt_description_prompt = params.text;
    body.make_instrumental = params.mode === "instrumental";
  }

  const resp = await axios.post(`${baseUrl}/suno/submit/music`, body, {
    headers,
    timeout: 60_000,
  });
  const taskId = resp.data?.data;
  if (resp.data?.code !== 0 && resp.data?.code !== 200) {
    throw new Error(`Suno 提交失败: ${resp.data?.message || resp.status}`);
  }
  if (typeof taskId !== "string" || !taskId) {
    throw new Error("Suno 提交未返回任务 ID");
  }
  return taskId;
}

export interface SunoClip {
  id?: string;
  audioUrl?: string;
  videoUrl?: string;
  title?: string;
  tags?: string;
  status?: string;
}

export interface SunoTaskResult {
  status: "queued" | "running" | "succeeded" | "failed" | "unknown";
  /** 首个可用的音频地址（mp3） */
  audioUrl?: string;
  clips: SunoClip[];
  title?: string;
  /** 供应商原始任务状态（SUBMITTED/IN_PROGRESS/SUCCESS/...），落库 raw_status 用 */
  rawStatus?: string;
  raw: unknown;
}

/**
 * 查询 Suno 任务。
 * 兼容 302.ai 两种返回形态（实测 192310067e0）：
 * 1. `{ code, data: { task_id, status, data: [ { clip_id, audio_url, status, ... } ] } }`
 *    —— clips 在 data.data 数组，clip 主键为 clip_id；
 * 2. 开源 suno-api 形态 `{ data: { task: {...}, clips: [ { id, audio_url } ] } }`。
 * 状态映射：SUBMITTED/QUEUED/IN_PROGRESS/PENDING → running，SUCCESS/COMPLETE → 终态。
 */
export async function fetchSunoTask(taskId: string): Promise<SunoTaskResult> {
  const { baseUrl, headers } = requireProxy();
  const resp = await axios.get(`${baseUrl}/suno/fetch/${taskId}`, {
    headers,
    timeout: 30_000,
  });
  const raw = resp.data;
  const code = raw?.code;
  const data = raw?.data ?? raw;

  if (code !== 0 && code !== 200) {
    throw new Error(`Suno 查询失败: ${raw?.message || resp.status}`);
  }

  const task = data?.task ?? data ?? {};
  const rawStatus = String(task.status ?? data?.status ?? "").toUpperCase();

  // 形态 1：clips 在 data.data 数组（clip_id 为主键）；形态 2：task.clips / data.clips（id 为主键）
  const clipList: any[] = data?.data ?? task.clips ?? data?.clips ?? [];
  const clips: SunoClip[] = (Array.isArray(clipList) ? clipList : []).map((c: any) => ({
    id: c.clip_id || c.id,
    audioUrl: c.audio_url || c.audioUrl,
    videoUrl: c.video_url,
    title: c.title,
    tags: c.tags,
    status: c.status,
  }));

  const ready = clips.find((c) => c.audioUrl);
  const failed =
    rawStatus.includes("FAIL") ||
    (clips.length > 0 && clips.every((c) => String(c.status || "").toUpperCase().includes("FAIL")));

  let status: SunoTaskResult["status"] = "unknown";
  if (failed) status = "failed";
  else if (ready) status = "succeeded";
  else if (["IN_PROGRESS", "QUEUED", "SUBMITTED", "PENDING", "TEXT_SUCCESS", "FIRST_SUCCESS"].includes(rawStatus) || rawStatus === "")
    status = "running";

  return { status, audioUrl: ready?.audioUrl, clips, title: ready?.title, rawStatus: rawStatus || undefined, raw };
}
