import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  stepRunsFindMany: vi.fn(),
  providerJobCreate: vi.fn(),
  providerJobUpdate: vi.fn(),
  providerJobFindUnique: vi.fn(),
  uploadFile: vi.fn(),
  submitSunoTask: vi.fn(),
  fetchSunoTask: vi.fn(),
  axiosGet: vi.fn(),
  completeStepRun: vi.fn(),
  failStepRun: vi.fn(),
  enqueueReadySteps: vi.fn(),
  skipDownstreamSteps: vi.fn(),
  pollBackoffMs: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    step_runs: {
      findMany: mocks.stepRunsFindMany,
      findFirst: vi.fn(),
    },
    provider_jobs: {
      create: mocks.providerJobCreate,
      update: mocks.providerJobUpdate,
      findUnique: mocks.providerJobFindUnique,
    },
  },
}));
vi.mock("@/services/suno-proxy", () => ({
  submitSunoTask: mocks.submitSunoTask,
  fetchSunoTask: mocks.fetchSunoTask,
}));
vi.mock("@/lib/oss", () => ({
  getSignedInternalUrl: vi.fn(),
  fetchImageAsBase64: vi.fn(),
  uploadFile: mocks.uploadFile,
}));
vi.mock("@/services/image-proxy", () => ({
  generateGptImage: vi.fn(),
  generateGeminiNativeImage: vi.fn(),
  generateGeminiChatImage: vi.fn(),
  gptImageSize: vi.fn(),
  isProxyConfigured: vi.fn(),
}));
vi.mock("@/lib/canvas/orchestrator", () => ({
  PROVIDER_JOB_TIMEOUT_MS: 900_000,
  enqueueReadySteps: mocks.enqueueReadySteps,
  finalizeExecutionIfDone: vi.fn(),
  pollBackoffMs: mocks.pollBackoffMs,
  skipDownstreamSteps: mocks.skipDownstreamSteps,
}));
vi.mock("@/models/canvas", () => ({
  completeStepRun: mocks.completeStepRun,
  failStepRun: mocks.failStepRun,
}));
vi.mock("@/services/video", () => ({
  createVideoTask: vi.fn(),
  getVideoTask: vi.fn(),
  cancelVideoTask: vi.fn(),
}));
vi.mock("axios", () => {
  const actual = vi.importActual("axios");
  return {
    ...actual,
    default: {
      ...(actual as any).default,
      get: mocks.axiosGet,
    },
  };
});

import { executeNodeStep, pollProviderJob } from "./canvas-executor";

function audioExecution(config: Record<string, unknown>) {
  return {
    execution: {
      snapshot_json: {
        revision: 1,
        scope: "node",
        rootNodeId: "audio-node",
        nodes: [
          {
            id: "audio-node",
            type: "audio",
            revisionId: 1,
            config,
          },
        ],
        edges: [],
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.stepRunsFindMany.mockResolvedValue([]);
  mocks.providerJobCreate.mockResolvedValue({ id: 41 });
  mocks.providerJobUpdate.mockResolvedValue({});
  mocks.submitSunoTask.mockResolvedValue("suno-task-1");
  mocks.uploadFile.mockResolvedValue("canvas/result.mp3");
  mocks.pollBackoffMs.mockReturnValue(5_000);
  mocks.enqueueReadySteps.mockResolvedValue(undefined);
  mocks.skipDownstreamSteps.mockResolvedValue(undefined);
  mocks.completeStepRun.mockResolvedValue(undefined);
  mocks.failStepRun.mockResolvedValue(undefined);
});

describe("Suno music submit", () => {
  it("submits custom lyrics mode with tags, title and vocal gender", async () => {
    const result = await executeNodeStep({
      id: 90,
      node_id: "audio-node",
      execution_id: 23,
      ...audioExecution({
        model: "suno-v5",
        mode: "custom",
        text: "[verse]\n星空下的少年",
        tags: "pop, ballad",
        title: "星空",
        vocal: "female",
      }),
    });

    expect(mocks.submitSunoTask).toHaveBeenCalledWith({
      model: "suno-v5",
      mode: "custom",
      text: "[verse]\n星空下的少年",
      tags: "pop, ballad",
      title: "星空",
      vocal: "female",
    });
    expect(mocks.providerJobCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ provider: "suno_302", status: "submitting" }),
    });
    expect(result.asyncJob).toEqual({ provider: "suno_302", externalId: "suno-task-1" });
    expect(result.cost).toBe(0);
    expect(result.output.kind).toBe("audio");
  });

  it("submits auto mode with description and legacy music mode migrating to instrumental", async () => {
    await executeNodeStep({
      id: 91,
      node_id: "audio-node",
      execution_id: 23,
      ...audioExecution({
        model: "suno-v4.5",
        mode: "music", // 旧 TTS 配置：纯音乐 → instrumental
        text: "轻快的清晨 BGM",
      }),
    });

    expect(mocks.submitSunoTask).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "instrumental", text: "轻快的清晨 BGM" })
    );
  });

  it("rejects empty lyrics with INPUT_NOT_READY", async () => {
    await expect(
      executeNodeStep({
        id: 92,
        node_id: "audio-node",
        execution_id: 23,
        ...audioExecution({ mode: "custom", text: "   " }),
      })
    ).rejects.toMatchObject({ code: "INPUT_NOT_READY" });
    expect(mocks.submitSunoTask).not.toHaveBeenCalled();
  });

  it("marks provider job failed when submission throws", async () => {
    mocks.submitSunoTask.mockRejectedValue(new Error("302.ai 未配置"));

    await expect(
      executeNodeStep({
        id: 93,
        node_id: "audio-node",
        execution_id: 23,
        ...audioExecution({ mode: "auto", text: "描述" }),
      })
    ).rejects.toThrow("302.ai 未配置");

    expect(mocks.providerJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 41 },
        data: expect.objectContaining({ status: "failed" }),
      })
    );
  });
});

describe("Suno music polling", () => {
  function sunoJob(overrides: Record<string, unknown> = {}) {
    return {
      id: 41,
      provider: "suno_302",
      external_id: "suno-task-1",
      status: "running",
      poll_count: 0,
      created_at: new Date(),
      ...overrides,
      step_run: {
        id: 90,
        node_id: "audio-node",
        execution_id: 23,
        node_revision: { config_json: { model: "suno-v5", mode: "custom", text: "歌词" } },
        ...((overrides.step_run as Record<string, unknown>) ?? {}),
      },
    };
  }

  it("downloads audio, transfers to OSS and completes the step", async () => {
    mocks.providerJobFindUnique.mockResolvedValue(sunoJob());
    mocks.fetchSunoTask.mockResolvedValue({
      status: "succeeded",
      audioUrl: "https://cdn.suno.ai/audio.mp3",
      clips: [{ id: "c1", audioUrl: "https://cdn.suno.ai/audio.mp3" }],
      title: "星空下的少年",
      rawStatus: "SUCCESS",
      raw: {},
    });
    mocks.axiosGet.mockResolvedValue({ data: Uint8Array.from([1, 2, 3]).buffer });

    await pollProviderJob(41);

    expect(mocks.axiosGet).toHaveBeenCalledWith(
      "https://cdn.suno.ai/audio.mp3",
      expect.objectContaining({ responseType: "arraybuffer" })
    );
    expect(mocks.uploadFile).toHaveBeenCalledWith(expect.any(Buffer), expect.stringMatching(/^canvas\/.+\.(mp3|mp3)$/));
    expect(mocks.completeStepRun).toHaveBeenCalledWith(
      90,
      expect.objectContaining({
        kind: "audio",
        storageKeys: [expect.any(String)],
        meta: expect.objectContaining({ title: "星空下的少年", clipCount: 1, providerTaskId: "suno-task-1" }),
      }),
      expect.any(Number)
    );
    expect(mocks.enqueueReadySteps).toHaveBeenCalledWith(23);
  });

  it("fails the step and skips downstream when provider reports failure", async () => {
    mocks.providerJobFindUnique.mockResolvedValue(sunoJob());
    mocks.fetchSunoTask.mockResolvedValue({
      status: "failed",
      clips: [],
      rawStatus: "CREATE_TASK_FAILED",
      raw: {},
    });

    await pollProviderJob(41);

    expect(mocks.completeStepRun).not.toHaveBeenCalled();
    expect(mocks.failStepRun).toHaveBeenCalledWith(90, "PROVIDER_REJECTED", expect.any(String));
    expect(mocks.skipDownstreamSteps).toHaveBeenCalledWith(23, "audio-node");
  });

  it("keeps polling with backoff when task is still running", async () => {
    mocks.providerJobFindUnique.mockResolvedValue(sunoJob());
    mocks.fetchSunoTask.mockResolvedValue({
      status: "running",
      clips: [],
      rawStatus: "IN_PROGRESS",
      raw: {},
    });

    await pollProviderJob(41);

    expect(mocks.completeStepRun).not.toHaveBeenCalled();
    expect(mocks.failStepRun).not.toHaveBeenCalled();
    // 两次更新：先记录 poll_count + raw_status，再安排下次轮询
    const calls = mocks.providerJobUpdate.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toEqual(
      expect.objectContaining({
        where: { id: 41 },
        data: expect.objectContaining({ raw_status: "IN_PROGRESS" }),
      })
    );
    expect(calls[1][0]).toEqual(
      expect.objectContaining({
        where: { id: 41 },
        data: expect.objectContaining({
          status: "running",
          next_poll_at: expect.any(Date),
        }),
      })
    );
  });

  it("times out and fails when provider never reaches a terminal state", async () => {
    mocks.providerJobFindUnique.mockResolvedValue(
      sunoJob({ created_at: new Date(Date.now() - 1_000_000) })
    );
    mocks.fetchSunoTask.mockResolvedValue({
      status: "running",
      clips: [],
      rawStatus: "IN_PROGRESS",
      raw: {},
    });

    await pollProviderJob(41);

    expect(mocks.fetchSunoTask).not.toHaveBeenCalled();
    expect(mocks.failStepRun).toHaveBeenCalledWith(
      90,
      "PROVIDER_TIMEOUT",
      expect.stringContaining("音乐生成")
    );
  });
});
