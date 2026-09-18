import axios from "axios";
import { requireProxy } from "./image-proxy";
import { audioStyleTags } from "@/lib/canvas/registry";
import type { TimedLyricWord } from "@/lib/audio-lyrics";
import type { AudioStyle } from "@/types/canvas";

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
  style?: AudioStyle;
}

export async function submitSunoTask(params: SunoSubmitParams): Promise<string> {
  const { baseUrl, headers } = requireProxy();
  const mv = sunoMv(params.model);
  const presetTags = audioStyleTags(params.style) || params.tags || "";

  const body: Record<string, unknown> = { mv };
  if (params.mode === "custom") {
    body.prompt = params.text;
    body.tags = presetTags;
    body.title = (params.title || params.text.slice(0, 20)).slice(0, 80);
    body.make_instrumental = false;
    const metadata: Record<string, unknown> = { create_mode: "custom" };
    if (params.vocal === "male") metadata.vocal_gender = "m";
    if (params.vocal === "female") metadata.vocal_gender = "f";
    body.metadata = metadata;
  } else if (params.mode === "instrumental") {
    body.tags = [params.text, presetTags].filter(Boolean).join(", ");
    body.title = (params.title || params.text.slice(0, 80)).slice(0, 80);
    body.make_instrumental = true;
  } else {
    const vocal = params.vocal === "male" || params.vocal === "female" ? params.vocal : "";
    body.gpt_description_prompt = [
      params.text,
      presetTags ? `Style: ${presetTags}` : "",
      vocal ? `Vocal: ${vocal}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    body.make_instrumental = false;
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
  /** Suno 生成或使用的歌词；纯音乐为空 */
  lyrics?: string;
}

export interface SunoTaskResult {
  status: "queued" | "running" | "succeeded" | "failed" | "unknown";
  /** 首个可用的音频地址（mp3） */
  audioUrl?: string;
  clips: SunoClip[];
  title?: string;
  lyrics?: string;
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
    lyrics: c.prompt || c.metadata?.prompt,
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

  return {
    status,
    audioUrl: ready?.audioUrl,
    clips,
    title: ready?.title,
    lyrics: ready?.lyrics,
    rawStatus: rawStatus || undefined,
    raw,
  };
}

export interface SunoLyricsVariant {
  id?: string;
  title?: string;
  text: string;
}

export interface SunoLyricsResult {
  status: "running" | "succeeded" | "failed" | "unknown";
  variants: SunoLyricsVariant[];
  rawStatus?: string;
}

/** 提交 Suno 歌词生成任务；prompt 最长 200 字。 */
export async function submitSunoLyrics(prompt: string): Promise<string> {
  const { baseUrl, headers } = requireProxy();
  const resp = await axios.post(
    `${baseUrl}/suno/submit/lyrics`,
    { prompt: prompt.trim().slice(0, 200) },
    { headers, timeout: 60_000 }
  );
  const taskId = resp.data?.data;
  if (![0, 200, "success"].includes(resp.data?.code)) {
    throw new Error(`Suno 歌词提交失败: ${resp.data?.message || resp.status}`);
  }
  if (typeof taskId !== "string" || !taskId) {
    throw new Error("Suno 歌词提交未返回任务 ID");
  }
  return taskId;
}

/** 查询歌词任务；结果与音乐任务共用 /suno/fetch/{taskId}。 */
export async function fetchSunoLyrics(taskId: string): Promise<SunoLyricsResult> {
  const { baseUrl, headers } = requireProxy();
  const resp = await axios.get(`${baseUrl}/suno/fetch/${taskId}`, {
    headers,
    timeout: 30_000,
  });
  const raw = resp.data;
  if (![0, 200, "success"].includes(raw?.code)) {
    throw new Error(`Suno 歌词查询失败: ${raw?.message || resp.status}`);
  }

  const data = raw?.data ?? raw;
  const rawStatus = String(data?.status ?? raw?.status ?? "").toUpperCase();
  const items = Array.isArray(data?.data) ? data.data : [];
  const variants = items
    .map((item: any) => ({
      id: item.id || item.clip_id,
      title: item.title,
      text: String(item.text || item.lyrics || item.prompt || item.metadata?.prompt || "").trim(),
    }))
    .filter((item: SunoLyricsVariant) => item.text);

  let status: SunoLyricsResult["status"] = "unknown";
  if (rawStatus.includes("FAIL")) status = "failed";
  else if (variants.length > 0) status = "succeeded";
  else if (["IN_PROGRESS", "QUEUED", "SUBMITTED", "PENDING"].includes(rawStatus) || !rawStatus)
    status = "running";

  return { status, variants, rawStatus: rawStatus || undefined };
}

export interface SunoTimingTrack {
  clipId?: string;
  words: TimedLyricWord[];
}

export interface SunoTimingResult {
  status: "running" | "succeeded" | "failed" | "unknown";
  tracks: SunoTimingTrack[];
  rawStatus?: string;
}

/** 根据原音乐生成任务提交歌词时间轴任务。 */
export async function submitSunoTiming(musicTaskId: string): Promise<string> {
  const { baseUrl, headers } = requireProxy();
  const resp = await axios.post(
    `${baseUrl}/suno/timing`,
    { task_id: musicTaskId },
    { headers, timeout: 60_000 }
  );
  const taskId = resp.data?.data;
  if (![0, 200, "success"].includes(resp.data?.code)) {
    throw new Error(`Suno 时间轴提交失败: ${resp.data?.message || resp.status}`);
  }
  if (typeof taskId !== "string" || !taskId) {
    throw new Error("Suno 时间轴提交未返回任务 ID");
  }
  return taskId;
}

/** 查询 timing 任务并兼容 alignment / aligned_words 及对象/数组嵌套形态。 */
export async function fetchSunoTiming(taskId: string): Promise<SunoTimingResult> {
  const { baseUrl, headers } = requireProxy();
  const resp = await axios.get(`${baseUrl}/suno/fetch/${taskId}`, {
    headers,
    timeout: 30_000,
  });
  const raw = resp.data;
  if (![0, 200, "success"].includes(raw?.code)) {
    throw new Error(`Suno 时间轴查询失败: ${raw?.message || resp.status}`);
  }

  const data = raw?.data ?? raw;
  const rawStatus = String(data?.status ?? raw?.status ?? "").toUpperCase();
  const payload = data?.data ?? data;
  const entries = Array.isArray(payload) ? payload : [payload];
  const tracks: SunoTimingTrack[] = entries
    .map((entry: any) => {
      const alignment =
        entry?.alignment ??
        entry?.aligned_words ??
        entry?.data?.alignment ??
        entry?.data?.aligned_words ??
        [];
      const words: TimedLyricWord[] = (Array.isArray(alignment) ? alignment : [])
        .filter(
          (word: any) =>
            word?.success !== false &&
            Number.isFinite(Number(word?.start_s ?? word?.startS)) &&
            Number.isFinite(Number(word?.end_s ?? word?.endS))
        )
        .map((word: any) => ({
          text: String(word.word ?? word.text ?? ""),
          startMs: Math.round(Number(word.start_s ?? word.startS) * 1000),
          endMs: Math.round(Number(word.end_s ?? word.endS) * 1000),
          ...(Number.isFinite(Number(word.p_align ?? word.palign))
            ? { confidence: Number(word.p_align ?? word.palign) }
            : {}),
        }))
        .filter((word: TimedLyricWord) => word.text);
      return { clipId: entry?.clip_id ?? entry?.audio_id ?? entry?.id, words };
    })
    .filter((track: SunoTimingTrack) => track.words.length > 0);

  let status: SunoTimingResult["status"] = "unknown";
  if (rawStatus.includes("FAIL")) status = "failed";
  else if (tracks.length > 0) status = "succeeded";
  else if (["IN_PROGRESS", "QUEUED", "SUBMITTED", "PENDING"].includes(rawStatus) || !rawStatus)
    status = "running";

  return { status, tracks, rawStatus: rawStatus || undefined };
}
