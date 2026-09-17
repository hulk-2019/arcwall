import { randomUUID } from "node:crypto";

const DOUBAO_SPEECH_API_URL =
  "https://openspeech.bytedance.com/api/v3/tts/unidirectional";

interface SynthesizeSpeechParams {
  model: string;
  text: string;
  speaker: string;
  speed: number;
}

interface SpeechStreamEvent {
  code?: number;
  message?: string;
  data?: string | null;
}

function resourceIdForModel(model: string): string {
  const configured = process.env.DOUBAO_SPEECH_RESOURCE_ID?.trim();
  if (configured) return configured;
  return model.includes("2-0") ? "seed-tts-2.0" : "seed-tts-1.0";
}

function speechRate(speed: number): number {
  const normalized = Math.max(0.5, Math.min(2, speed));
  return Math.round((normalized - 1) * 100);
}

export async function synthesizeDoubaoSpeech(
  params: SynthesizeSpeechParams
): Promise<Buffer> {
  const apiKey = process.env.DOUBAO_SPEECH_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("未配置豆包语音 API Key（DOUBAO_SPEECH_API_KEY）");
  }

  const response = await fetch(DOUBAO_SPEECH_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
      "X-Api-Resource-Id": resourceIdForModel(params.model),
      "X-Api-Request-Id": randomUUID(),
    },
    body: JSON.stringify({
      user: { uid: "arcwall" },
      req_params: {
        text: params.text,
        speaker: params.speaker,
        audio_params: {
          format: "mp3",
          sample_rate: 24000,
          speech_rate: speechRate(params.speed),
        },
      },
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`豆包语音请求失败（HTTP ${response.status}）：${body || response.statusText}`);
  }

  const audioChunks: Buffer[] = [];
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let event: SpeechStreamEvent;
    try {
      event = JSON.parse(trimmed) as SpeechStreamEvent;
    } catch {
      throw new Error("豆包语音返回了无法解析的流数据");
    }

    if (event.code === 0) {
      if (event.data) audioChunks.push(Buffer.from(event.data, "base64"));
      continue;
    }
    if (event.code === 20000000) continue;

    throw new Error(
      `豆包语音合成失败（${event.code ?? "未知错误码"}）：${event.message || "未知错误"}`
    );
  }

  const audio = Buffer.concat(audioChunks);
  if (audio.length === 0) {
    throw new Error("豆包语音未返回音频数据");
  }
  return audio;
}
