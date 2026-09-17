import { prisma } from "@/lib/prisma";
import { getDoubaoAIClient } from "@/services/openai";
import { synthesizeDoubaoSpeech } from "@/services/doubao-speech";
import {
  fetchImageAsBase64,
  getSignedInternalUrl,
  uploadFile,
} from "@/lib/oss";
import {
  buildImagePrompt,
  buildStoryboardMessages,
  buildVideoPrompt,
  compileInputs,
  mergePrompt,
  parseStoryboardJson,
  storyboardToMotionText,
} from "@/lib/canvas/compiler";
import {
  type ExecutionSnapshot,
  deriveTextOutput,
  deriveUploadOutput,
} from "@/lib/canvas/plan";
import {
  IMAGE_MODEL_DEFAULT,
  STORYBOARD_MODEL,
  VIDEO_MODEL_DEFAULT,
  AUDIO_MODEL_DEFAULT,
  AUDIO_MUSIC_MODEL,
  AUDIO_VOICE_DEFAULT,
  AUDIO_VOICE_MALE_DEFAULT,
  AUDIO_VOICE_FEMALE_DEFAULT,
  estimateNodeCost,
  imageModelProvider,
} from "@/lib/canvas/registry";
import {
  generateGptImage,
  generateGeminiNativeImage,
  generateGeminiChatImage,
  gptImageSize,
  isProxyConfigured,
} from "@/services/image-proxy";
import {
  PROVIDER_JOB_TIMEOUT_MS,
  enqueueReadySteps,
  finalizeExecutionIfDone,
  pollBackoffMs,
  skipDownstreamSteps,
} from "@/lib/canvas/orchestrator";
import {
  completeStepRun,
  failStepRun,
} from "@/models/canvas";
import type {
  CanvasNodeConfig,
  CanvasNodeOutput,
} from "@/types/canvas";
import { createVideoTask, getVideoTask, cancelVideoTask } from "@/services/video";
import axios from "axios";
import { randomUUID } from "crypto";

export interface StepExecutionResult {
  output: CanvasNodeOutput;
  cost: number;
  /** 视频等异步任务：已提交供应商，轮询由 poller 接管，本步骤保持 running。 */
  asyncJob?: {
    provider: string;
    externalId: string;
  };
}

export class NormalizedStepError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || code);
    this.code = code;
  }
}

function parseSnapshot(raw: unknown): ExecutionSnapshot | null {
  if (!raw) return null;
  const snap = raw as ExecutionSnapshot;
  if (!Array.isArray(snap.nodes) || !Array.isArray(snap.edges)) return null;
  return snap;
}

function ossKey(ext: string): string {
  return `canvas/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
}

/**
 * 按执行快照解析某节点的上游输出（技术方案 §二点二 不可变快照）：
 * 1. 本执行内的上游步骤 → 其 step_run 输出；
 * 2. text / upload 被动节点 → 由快照配置推导；
 * 3. 范围外的可执行节点 → 快照 revision 对应的最近一次成功 step_run；
 * 4. 都没有 → 输出缺失，由调用方以 INPUT_NOT_READY 失败。
 */
async function resolveUpstreamInputs(
  nodeId: string,
  snapshot: ExecutionSnapshot,
  executionId: number
) {
  const targetEdges = snapshot.edges.filter((e) => e.targetNodeId === nodeId);

  const siblings = await prisma.step_runs.findMany({
    where: { execution_id: executionId, status: "succeeded" },
    orderBy: { id: "desc" },
  });
  const siblingOutputByNode = new Map<string, CanvasNodeOutput>();
  for (const s of siblings) {
    if (!siblingOutputByNode.has(s.node_id) && s.output_json) {
      siblingOutputByNode.set(s.node_id, s.output_json as unknown as CanvasNodeOutput);
    }
  }

  const outputs = new Map<string, CanvasNodeOutput>();
  const textMemo = new Map<string, CanvasNodeOutput>();

  for (const edge of targetEdges) {
    if (outputs.has(edge.sourceNodeId)) continue;

    const sibling = siblingOutputByNode.get(edge.sourceNodeId);
    if (sibling) {
      outputs.set(edge.sourceNodeId, sibling);
      continue;
    }

    const snapNode = snapshot.nodes.find((n) => n.id === edge.sourceNodeId);
    if (!snapNode) continue; // 快照外节点：视为缺失，compileInputs 会标记

    if (snapNode.type === "text") {
      outputs.set(edge.sourceNodeId, deriveTextOutput(snapshot, snapNode.id, textMemo));
    } else if (snapNode.type === "upload") {
      outputs.set(edge.sourceNodeId, deriveUploadOutput(snapshot, snapNode.id));
    } else {
      // 范围外可执行节点：取最近一次成功输出（与节点界面展示的产物一致，所见即所用）。
      // 配置变更导致的过期由节点上的「产物过期」标记提示，不再阻塞下游执行。
      const run = await prisma.step_runs.findFirst({
        where: { node_id: snapNode.id, status: "succeeded" },
        orderBy: { id: "desc" },
      });
      if (run?.output_json) {
        outputs.set(edge.sourceNodeId, run.output_json as unknown as CanvasNodeOutput);
      }
    }
  }

  return { edges: targetEdges, outputs };
}

async function toHttpUrl(keyOrUrl: string): Promise<string> {
  return keyOrUrl.startsWith("http") ? keyOrUrl : getSignedInternalUrl(keyOrUrl, 3600);
}

// ---------------------------------------------------------------------------
// 图像生成
// ---------------------------------------------------------------------------

const ASPECT_SIZE_MAP: Record<string, string> = {
  "16:9": "2848x1600",
  "9:16": "1600x2848",
  "1:1": "2048x2048",
  "4:3": "2304x1728",
  "3:4": "1728x2304",
  "3:2": "2496x1664",
  "2:3": "1664x2496",
  "21:9": "3136x1344",
};

async function executeImage(
  config: CanvasNodeConfig,
  compiled: ReturnType<typeof compileInputs>
): Promise<StepExecutionResult> {
  const prompt = buildImagePrompt(config, compiled);
  if (!prompt.trim()) {
    throw new NormalizedStepError("INPUT_NOT_READY", "缺少提示词");
  }

  const model = config.model || IMAGE_MODEL_DEFAULT;
  const aspectRatio = config.aspectRatio || "16:9";

  const referenceKeys = [
    ...compiled.referenceImages,
    ...(Array.isArray(config.referenceImages) ? config.referenceImages : []),
  ];
  const referenceUrls =
    referenceKeys.length > 0 ? await Promise.all(referenceKeys.map(toHttpUrl)) : [];

  // 按模型分发供应商：Ark Seedream / 302.ai 代理（GPT-Image、Nano Banana 2/Pro）
  let rawImages: string[];
  try {
    const provider = imageModelProvider(model);
    if (provider === "ark") {
      const client = getDoubaoAIClient();
      // OSS 开启了 Referer 白名单，Ark 回源无法携带所需请求头。
      // 由本服务下载参考图并以内联 Data URL 传入，避免供应商回源 403。
      const inlineReferences =
        referenceUrls.length > 0
          ? await Promise.all(referenceUrls.map((url) => fetchImageAsBase64(url)))
          : [];
      const params: any = {
        model,
        prompt,
        size: ASPECT_SIZE_MAP[aspectRatio] || "2048x2048",
        response_format: "url",
        watermark: false,
        sequential_image_generation: "disabled",
        n: 1,
      };
      if (inlineReferences.length > 0) {
        params.image = inlineReferences.length === 1 ? inlineReferences[0] : inlineReferences;
      }
      const res = await client.images.generate(params);
      rawImages = (res?.data || [])
        .map((d: any) => d?.url || (d?.b64_json ? `data:image/png;base64,${d.b64_json}` : null))
        .filter(Boolean);
    } else {
      if (!isProxyConfigured()) {
        throw new NormalizedStepError(
          "PROVIDER_REJECTED",
          "未配置 302.ai 代理（PROXY_302AI_API_KEY），无法使用该模型"
        );
      }
      if (provider === "gpt-image") {
        // 局部调整模式（有参考图）：显式要求保持未提及部分不变，提升保真度
        const editPrompt =
          referenceUrls.length > 0
            ? `请对参考图进行局部编辑：严格保持未提及部分的构图、内容、风格与文字完全不变，仅应用以下修改要求。\n${prompt}`
            : prompt;
        rawImages = await generateGptImage({
          model,
          prompt: editPrompt,
          size: gptImageSize(aspectRatio, config.resolution === "2k" ? "2k" : "1k"),
          referenceUrls,
        });
      } else if (provider === "gemini-native") {
        rawImages = await generateGeminiNativeImage({
          model,
          prompt,
          aspectRatio,
          referenceUrls,
        });
      } else {
        // Nano Banana Pro 无画幅参数，比例写入提示词
        rawImages = await generateGeminiChatImage({
          model,
          prompt: `${prompt}\n\n（请生成 ${aspectRatio} 画幅的图片）`,
          referenceUrls,
        });
      }
    }
  } catch (e) {
    if (e instanceof NormalizedStepError) throw e;
    throw new NormalizedStepError(
      "PROVIDER_REJECTED",
      e instanceof Error ? e.message : "图片生成失败"
    );
  }

  if (rawImages.length === 0) {
    throw new NormalizedStepError("PROVIDER_REJECTED", "图像模型未返回结果");
  }

  // 转存 OSS；输出只持久化 storageKeys，URL 由读取方动态签名（技术方案 §十一点二）
  const storageKeys: string[] = [];
  for (const raw of rawImages) {
    if (raw.startsWith("data:")) {
      const [meta, b64] = raw.split(",");
      const ext = meta.includes("jpeg") ? "jpg" : "png";
      const key = ossKey(ext);
      await uploadFile(Buffer.from(b64, "base64"), key);
      storageKeys.push(key);
    } else {
      const resp = await axios.get(raw, { responseType: "arraybuffer", timeout: 120_000 });
      const contentType = String(resp.headers["content-type"] || "image/png");
      const ext = contentType.includes("jpeg") ? "jpg" : "png";
      const key = ossKey(ext);
      await uploadFile(Buffer.from(resp.data), key);
      storageKeys.push(key);
    }
  }

  return {
    output: { kind: "image", storageKeys, meta: { prompt, model } },
    cost: estimateNodeCost("image", config),
  };
}

// ---------------------------------------------------------------------------
// 分镜规划
// ---------------------------------------------------------------------------

async function executeStoryboard(
  config: CanvasNodeConfig,
  compiled: ReturnType<typeof compileInputs>
): Promise<StepExecutionResult> {
  const brief = mergePrompt(compiled.textChunks, config.brief).trim();
  if (!brief) {
    throw new NormalizedStepError("INPUT_NOT_READY", "缺少创意简报");
  }
  const { system, user } = buildStoryboardMessages(brief, config.visualLock);

  const client = getDoubaoAIClient();
  const response = await client.chat.completions.create({
    model: STORYBOARD_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  const content = response.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new NormalizedStepError("PROVIDER_REJECTED", "分镜模型未返回结果");
  }

  const storyboard = parseStoryboardJson(content);
  const layout = config.layout || "grid9";
  const limits: Record<string, number> = { grid3: 3, grid6: 6, grid9: 9, grid12: 12 };
  const shots = storyboard.shots.slice(0, limits[layout] ?? storyboard.shots.length);

  return {
    output: {
      kind: "storyboard",
      storyboard: { ...storyboard, shots },
      text: storyboardToMotionText({ ...storyboard, shots }),
    },
    cost: estimateNodeCost("storyboard", config),
  };
}

// ---------------------------------------------------------------------------
// 视频生成：两阶段（提交 + poller 轮询），不再阻塞 Worker（技术方案 §八点四）
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 音频生成（TTS）：上游文本 + 自身文案 → 供应商语音合成 → 转存 OSS
// ---------------------------------------------------------------------------

async function executeAudio(
  config: CanvasNodeConfig,
  compiled: ReturnType<typeof compileInputs>
): Promise<StepExecutionResult> {
  const input = mergePrompt(compiled.textChunks, config.text);
  if (!input.trim()) {
    throw new NormalizedStepError("INPUT_NOT_READY", "缺少音频文案");
  }

  const model = config.model || AUDIO_MODEL_DEFAULT;
  const mode = config.mode === "music" ? "music" : "song";
  const vocal = config.vocal === "male" || config.vocal === "female" ? config.vocal : "auto";
  // 纯音乐需要音乐生成模型（豆包音乐生成为独立签名 API，需单独开通接入）
  if (mode === "music" && model !== AUDIO_MUSIC_MODEL) {
    throw new NormalizedStepError(
      "PROVIDER_REJECTED",
      "纯音乐模式需要配置音乐生成模型（CANVAS_AUDIO_MUSIC_MODEL）"
    );
  }

  // 人声偏好 → 音色：显式音色优先，其次按偏好映射，最后回退默认
  const voice =
    config.voice ||
    (vocal === "male"
      ? AUDIO_VOICE_MALE_DEFAULT
      : vocal === "female"
        ? AUDIO_VOICE_FEMALE_DEFAULT
        : AUDIO_VOICE_DEFAULT);
  const speed = Math.max(0.5, Math.min(2, Number(config.speed) || 1));

  const buffer = await synthesizeDoubaoSpeech({
    model,
    text: input,
    speaker: voice,
    speed,
  });

  const key = ossKey("mp3");
  await uploadFile(buffer, key);

  return {
    output: { kind: "audio", storageKeys: [key], meta: { model, voice, mode, vocal } },
    cost: estimateNodeCost("audio", config),
  };
}

// ---------------------------------------------------------------------------
// 视频生成：两阶段（提交 + poller 轮询），不再阻塞 Worker（技术方案 §八点四）
// ---------------------------------------------------------------------------

async function executeVideoSubmit(
  stepRunId: number,
  config: CanvasNodeConfig,
  compiled: ReturnType<typeof compileInputs>
): Promise<StepExecutionResult> {
  const prompt = buildVideoPrompt(config, compiled);
  if (!prompt.trim()) {
    throw new NormalizedStepError("INPUT_NOT_READY", "缺少运动提示词");
  }

  const model = config.model || VIDEO_MODEL_DEFAULT;
  const configuredResolution = config.resolution || "1080p";
  // Seedance 2.0 Fast 最高支持 720p；历史节点可能仍保存了 1080p。
  const resolution =
    model === "doubao-seedance-2-0-fast-260128" && configuredResolution === "1080p"
      ? "720p"
      : configuredResolution;
  const duration = Math.max(3, Math.min(10, Number(config.duration) || 5));
  const ratio = config.aspectRatio || "16:9";

  const firstFrame = compiled.firstFrame;
  // 首帧连线代表图生视频：图片与 prompt 必须一起提交，不能被历史/default text 配置覆盖。
  const mode = firstFrame ? "image" : config.videoMode || "text";
  let firstFrameUrl: string | undefined;
  if (mode === "image") {
    if (!firstFrame) {
      throw new NormalizedStepError("INPUT_NOT_READY", "图生视频缺少首帧");
    }
    // OSS 有 Referer 白名单，Ark 无法直接回源；由本服务读取后内联提交。
    firstFrameUrl = await fetchImageAsBase64(await toHttpUrl(firstFrame));
  }

  // 参考音频（PRD-VID-002）：上游音频连接后透传给供应商，模型不支持时按供应商错误归一
  let referenceAudioUrl: string | undefined;
  if (compiled.referenceAudios.length > 0) {
    referenceAudioUrl = await toHttpUrl(compiled.referenceAudios[0]);
  }

  // 先落 SUBMITTING 记录再提交供应商：崩溃后可由恢复任务收敛（技术方案 §七点三）
  const job = await prisma.provider_jobs.create({
    data: {
      step_run_id: stepRunId,
      provider: "302ai",
      status: "submitting",
      next_poll_at: new Date(Date.now() + 60_000),
    },
  });

  try {
    const task = await createVideoTask({
      model,
      prompt,
      firstFrameUrl,
      referenceAudioUrl,
      resolution,
      ratio,
      duration,
    });

    await prisma.provider_jobs.update({
      where: { id: job.id },
      data: {
        external_id: task.providerTaskId,
        status: "running",
        raw_status: task.status,
        next_poll_at: new Date(Date.now() + 3000),
        updated_at: new Date(),
      },
    });

    // 供应商任务已提交，本步骤保持 running，由 poller 驱动至终态
    return {
      output: { kind: "video", storageKeys: [], meta: { prompt, model, duration, resolution } },
      cost: 0,
      asyncJob: { provider: "302ai", externalId: task.providerTaskId },
    };
  } catch (e) {
    await prisma.provider_jobs.update({
      where: { id: job.id },
      data: { status: "failed", updated_at: new Date() },
    });
    throw e;
  }
}

/** 下载供应商临时链接并转存平台 OSS（技术方案 §八点四：转存成功才算任务成功）。 */
async function transferVideoToOss(videoUrl: string): Promise<string> {
  const resp = await axios.get(videoUrl, { responseType: "arraybuffer", timeout: 300_000 });
  const key = ossKey("mp4");
  await uploadFile(Buffer.from(resp.data), key);
  return key;
}

/**
 * 轮询处理一条供应商任务（由 poller 消息驱动）。幂等：终态直接返回。
 */
export async function pollProviderJob(providerJobId: number): Promise<void> {
  const job = await prisma.provider_jobs.findUnique({
    where: { id: providerJobId },
    include: {
      step_run: { include: { execution: true, node_revision: true } },
    },
  });
  if (!job) return;
  if (["succeeded", "failed", "cancelled"].includes(job.status)) return;

  const stepRun = job.step_run;

  // 步骤已被取消（用户取消等）：尽力取消供应商任务并收敛
  if (stepRun && ["cancelled", "skipped"].includes(stepRun.status)) {
    if (job.external_id) await cancelVideoTask(job.external_id).catch(() => false);
    await prisma.provider_jobs.update({
      where: { id: job.id },
      data: { status: "cancelled", updated_at: new Date() },
    });
    return;
  }
  if (!stepRun || !job.external_id) {
    // 提交阶段中断且无 external_id：无法查询，按平台超时失败
    await prisma.provider_jobs.update({
      where: { id: job.id },
      data: { status: "failed", updated_at: new Date() },
    });
    if (stepRun) {
      await failStepRun(stepRun.id, "PROVIDER_TIMEOUT", "供应商任务提交中断");
      await skipDownstreamSteps(stepRun.execution_id, stepRun.node_id);
      await enqueueReadySteps(stepRun.execution_id);
    }
    return;
  }

  const executionId = stepRun.execution_id;

  // 平台超时：供应商长时间无终态（技术方案 §十四点三）
  const deadline = new Date(job.created_at?.getTime() ?? 0).getTime() + PROVIDER_JOB_TIMEOUT_MS;
  if (Date.now() > deadline) {
    await cancelVideoTask(job.external_id).catch(() => false);
    await prisma.provider_jobs.update({
      where: { id: job.id },
      data: { status: "failed", raw_status: "platform_timeout", updated_at: new Date() },
    });
    await failStepRun(stepRun.id, "PROVIDER_TIMEOUT", "视频生成超时");
    await skipDownstreamSteps(executionId, stepRun.node_id);
    await enqueueReadySteps(executionId);
    return;
  }

  let result;
  try {
    result = await getVideoTask(job.external_id);
  } catch (e) {
    // 查询失败：退避后重试，不改状态
    await prisma.provider_jobs.update({
      where: { id: job.id },
      data: {
        poll_count: { increment: 1 },
        next_poll_at: new Date(Date.now() + pollBackoffMs(job.poll_count + 1)),
        updated_at: new Date(),
      },
    });
    return;
  }

  await prisma.provider_jobs.update({
    where: { id: job.id },
    data: {
      raw_status: result.status,
      poll_count: { increment: 1 },
      updated_at: new Date(),
    },
  });

  if (result.status === "succeeded" && result.videoUrl) {
    let storageKey: string;
    try {
      storageKey = await transferVideoToOss(result.videoUrl);
    } catch (e) {
      // 转存失败：可重试（ASSET_TRANSFER_FAILED），退避后再试
      await prisma.provider_jobs.update({
        where: { id: job.id },
        data: {
          status: "running",
          next_poll_at: new Date(Date.now() + pollBackoffMs(job.poll_count + 1)),
          updated_at: new Date(),
        },
      });
      return;
    }

    const config = (stepRun.node_revision?.config_json ?? {}) as CanvasNodeConfig;
    await prisma.provider_jobs.update({
      where: { id: job.id },
      data: { status: "succeeded", next_poll_at: null, updated_at: new Date() },
    });
    await completeStepRun(
      stepRun.id,
      {
        kind: "video",
        storageKeys: [storageKey],
        meta: { ...(result.raw as any)?.content, providerTaskId: job.external_id },
      },
      estimateNodeCost("video", config)
    );
    await enqueueReadySteps(executionId);
    return;
  }

  if (result.status === "failed" || result.status === "cancelled" || result.status === "expired") {
    await prisma.provider_jobs.update({
      where: { id: job.id },
      data: { status: "failed", next_poll_at: null, updated_at: new Date() },
    });
    await failStepRun(stepRun.id, "PROVIDER_REJECTED", `视频任务 ${result.status}`);
    await skipDownstreamSteps(executionId, stepRun.node_id);
    await enqueueReadySteps(executionId);
    return;
  }

  // queued / running / unknown：按退避继续轮询
  await prisma.provider_jobs.update({
    where: { id: job.id },
    data: {
      status: "running",
      next_poll_at: new Date(Date.now() + pollBackoffMs(job.poll_count + 1)),
      updated_at: new Date(),
    },
  });
}

/**
 * 执行单个可执行步骤。按 step_run 绑定的不可变 node_revision 配置执行，
 * 上游一律来自执行快照（同执行步骤 / 被动节点推导 / 快照 revision 的历史输出）。
 */
export async function executeNodeStep(stepRun: {
  id: number;
  node_id: string;
  execution_id: number;
  node_revision?: { config_json: unknown } | null;
  execution?: { snapshot_json: unknown } | null;
}): Promise<StepExecutionResult> {
  const snapshot = parseSnapshot(stepRun.execution?.snapshot_json);
  if (!snapshot) {
    throw new NormalizedStepError("INVALID_GRAPH", "执行快照缺失");
  }
  const snapNode = snapshot.nodes.find((n) => n.id === stepRun.node_id);
  if (!snapNode) {
    throw new NormalizedStepError("INVALID_GRAPH", "节点不在执行快照内");
  }

  const config = (snapNode.config ?? {}) as CanvasNodeConfig;
  const { edges, outputs } = await resolveUpstreamInputs(stepRun.node_id, snapshot, stepRun.execution_id);
  const compiled = compileInputs(edges, outputs);
  if (compiled.missingNodeIds.length > 0) {
    const labelOf = (id: string) => {
      const n = snapshot.nodes.find((x) => x.id === id);
      return typeof n?.config?.title === "string" && n.config.title ? n.config.title : id;
    };
    throw new NormalizedStepError(
      "INPUT_NOT_READY",
      `上游输出未就绪：${compiled.missingNodeIds.map(labelOf).join("、")}（请先运行上游节点）`
    );
  }

  const type = snapNode.type;
  switch (type) {
    case "image":
      return executeImage(config, compiled);
    case "storyboard":
      return executeStoryboard(config, compiled);
    case "audio":
      return executeAudio(config, compiled);
    case "video":
      return executeVideoSubmit(stepRun.id, config, compiled);
    case "text":
    case "upload":
      // 被动节点在创建执行时已自动完成，不应进入此处
      return {
        output:
          type === "text"
            ? deriveTextOutput(snapshot, stepRun.node_id)
            : deriveUploadOutput(snapshot, stepRun.node_id),
        cost: 0,
      };
    default:
      throw new NormalizedStepError("MODEL_CAPABILITY_MISMATCH", `未知节点类型 ${String(type)}`);
  }
}

export { finalizeExecutionIfDone };
