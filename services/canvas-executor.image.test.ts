import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  stepRunsFindMany: vi.fn(),
  arkGenerate: vi.fn(),
  getSignedInternalUrl: vi.fn(),
  fetchImageAsBase64: vi.fn(),
  fetchMediaAsBase64: vi.fn(),
  uploadFile: vi.fn(),
  providerJobCreate: vi.fn(),
  providerJobUpdate: vi.fn(),
  providerJobUpdateMany: vi.fn(),
  providerJobFindUnique: vi.fn(),
  createVideoTask: vi.fn(),
  failStepRun: vi.fn(),
  enqueueReadySteps: vi.fn(),
  skipDownstreamSteps: vi.fn(),
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
      updateMany: mocks.providerJobUpdateMany,
      findUnique: mocks.providerJobFindUnique,
    },
  },
}));
vi.mock("@/services/openai", () => ({
  getDoubaoAIClient: () => ({
    images: { generate: mocks.arkGenerate },
  }),
}));
vi.mock("@/lib/oss", () => ({
  getSignedInternalUrl: mocks.getSignedInternalUrl,
  fetchImageAsBase64: mocks.fetchImageAsBase64,
  fetchMediaAsBase64: mocks.fetchMediaAsBase64,
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
  PROVIDER_SUBMIT_GRACE_MS: 210_000,
  enqueueReadySteps: mocks.enqueueReadySteps,
  finalizeExecutionIfDone: vi.fn(),
  pollBackoffMs: vi.fn(),
  skipDownstreamSteps: mocks.skipDownstreamSteps,
}));
vi.mock("@/models/canvas", () => ({
  completeStepRun: vi.fn(),
  failStepRun: mocks.failStepRun,
}));
vi.mock("@/services/video", () => ({
  createVideoTask: mocks.createVideoTask,
  getVideoTask: vi.fn(),
  cancelVideoTask: vi.fn(),
}));

import { executeNodeStep, pollProviderJob } from "./canvas-executor";

function silentWavDataUrl(seconds: number, sampleRate = 8000) {
  const samples = seconds * sampleRate;
  const dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  return `data:audio/wav;base64,${buf.toString("base64")}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.stepRunsFindMany.mockResolvedValue([
    {
      node_id: "image-node",
      output_json: {
        kind: "image",
        storageKeys: ["canvas/reference.jpg"],
      },
    },
  ]);
  mocks.getSignedInternalUrl.mockReturnValue("http://oss.example.com/reference.jpg?signed=1");
  mocks.fetchImageAsBase64.mockResolvedValue("data:image/jpeg;base64,cmVmZXJlbmNl");
  mocks.fetchMediaAsBase64.mockResolvedValue(silentWavDataUrl(8));
  mocks.arkGenerate.mockResolvedValue({
    data: [{ b64_json: Buffer.from("result").toString("base64") }],
  });
  mocks.uploadFile.mockResolvedValue("canvas/result.jpg");
  mocks.providerJobCreate.mockResolvedValue({ id: 31 });
  mocks.providerJobUpdate.mockResolvedValue({});
  mocks.providerJobUpdateMany.mockResolvedValue({ count: 1 });
  mocks.createVideoTask.mockResolvedValue({
    providerTaskId: "task-1",
    status: "queued",
  });
});

describe("Seedream image editing", () => {
  it("inlines OSS references so Ark does not need to download them", async () => {
    await executeNodeStep({
      id: 88,
      node_id: "image-node",
      execution_id: 21,
      execution: {
        snapshot_json: {
          revision: 1,
          scope: "all",
          rootNodeId: null,
          nodes: [
            {
              id: "upload-node",
              type: "upload",
              revisionId: 1,
              config: {
                storageKey: "canvas/reference.jpg",
                mediaType: "image",
              },
            },
            {
              id: "image-node",
              type: "image",
              revisionId: 2,
              config: {
                model: "doubao-seedream-4-5-251128",
                prompt: "change the sky",
                aspectRatio: "1:1",
              },
            },
          ],
          edges: [
            {
              sourceNodeId: "upload-node",
              targetNodeId: "image-node",
              sourcePort: "output",
              targetPort: "reference_images",
            },
          ],
        },
      },
    });

    expect(mocks.fetchImageAsBase64).toHaveBeenCalledWith(
      "http://oss.example.com/reference.jpg?signed=1"
    );
    expect(mocks.arkGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        image: "data:image/jpeg;base64,cmVmZXJlbmNl",
      })
    );
  });
});

describe("Seedance image-to-video", () => {
  it("combines a connected first frame with the prompt even when the saved mode is text", async () => {
    const result = await executeNodeStep({
      id: 89,
      node_id: "video-node",
      execution_id: 22,
      execution: {
        snapshot_json: {
          revision: 1,
          scope: "node",
          rootNodeId: "video-node",
          nodes: [
            {
              id: "image-node",
              type: "image",
              revisionId: 1,
              config: {},
            },
            {
              id: "video-node",
              type: "video",
              revisionId: 2,
              config: {
                model: "doubao-seedance-2-0-fast-260128",
                prompt: "animate the scene",
                videoMode: "text",
                resolution: "1080p",
                aspectRatio: "16:9",
                duration: 3,
              },
            },
          ],
          edges: [
            {
              sourceNodeId: "image-node",
              targetNodeId: "video-node",
              sourcePort: "output",
              targetPort: "first_frame",
            },
          ],
        },
      },
    });

    expect(mocks.fetchImageAsBase64).toHaveBeenCalledWith(
      "http://oss.example.com/reference.jpg?signed=1"
    );
    expect(mocks.createVideoTask).toHaveBeenCalledWith(
      expect.objectContaining({
        firstFrameUrl: "data:image/jpeg;base64,cmVmZXJlbmNl",
        resolution: "720p",
        duration: 4,
      })
    );
    expect(mocks.providerJobCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ provider: "302ai" }),
    });
    expect(result.asyncJob?.provider).toBe("302ai");
  });

  it("submits connected image and audio as multimodal references", async () => {
    mocks.stepRunsFindMany.mockResolvedValue([
      {
        node_id: "image-node",
        output_json: {
          kind: "image",
          storageKeys: ["canvas/reference.jpg"],
        },
      },
      {
        node_id: "audio-node",
        output_json: {
          kind: "audio",
          storageKeys: ["canvas/clip.wav"],
        },
      },
    ]);
    mocks.getSignedInternalUrl.mockImplementation((key: string) =>
      key.endsWith(".wav")
        ? "http://oss.example.com/clip.wav?signed=1"
        : "http://oss.example.com/reference.jpg?signed=1"
    );

    await executeNodeStep({
      id: 90,
      node_id: "video-node",
      execution_id: 23,
      execution: {
        snapshot_json: {
          revision: 1,
          scope: "node",
          rootNodeId: "video-node",
          nodes: [
            {
              id: "image-node",
              type: "image",
              revisionId: 1,
              config: {},
            },
            {
              id: "audio-node",
              type: "audio",
              revisionId: 2,
              config: {},
            },
            {
              id: "video-node",
              type: "video",
              revisionId: 3,
              config: {
                model: "doubao-seedance-2-0-fast-260128",
                prompt: "cut to the rhythm",
                videoReferenceMode: "multimodal",
                duration: 5,
              },
            },
          ],
          edges: [
            {
              sourceNodeId: "image-node",
              targetNodeId: "video-node",
              sourcePort: "output",
              targetPort: "first_frame",
            },
            {
              sourceNodeId: "audio-node",
              targetNodeId: "video-node",
              sourcePort: "output",
              targetPort: "reference_audio",
            },
          ],
        },
      },
    });

    expect(mocks.fetchMediaAsBase64).toHaveBeenCalledWith(
      "http://oss.example.com/clip.wav?signed=1",
      "audio/mpeg"
    );
    expect(mocks.createVideoTask).toHaveBeenCalledWith(
      expect.objectContaining({
        firstFrameUrl: undefined,
        referenceImageUrls: ["data:image/jpeg;base64,cmVmZXJlbmNl"],
        referenceAudioUrl: expect.stringMatching(/^data:audio\/wav;base64,/),
      })
    );
  });

  it("downgrades 1080p for Seedance 2.0 standard", async () => {
    await executeNodeStep({
      id: 91,
      node_id: "video-node",
      execution_id: 24,
      execution: {
        snapshot_json: {
          revision: 1,
          scope: "node",
          rootNodeId: "video-node",
          nodes: [
            {
              id: "video-node",
              type: "video",
              revisionId: 1,
              config: {
                model: "doubao-seedance-2-0-260128",
                prompt: "a quiet street at dusk",
                videoMode: "text",
                resolution: "1080p",
                duration: 5,
              },
            },
          ],
          edges: [],
        },
      },
    });

    expect(mocks.createVideoTask).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "doubao-seedance-2-0-260128",
        resolution: "720p",
      })
    );
  });

  it("rejects reference audio longer than 15 seconds before calling 302.ai", async () => {
    mocks.stepRunsFindMany.mockResolvedValue([
      {
        node_id: "image-node",
        output_json: {
          kind: "image",
          storageKeys: ["canvas/reference.jpg"],
        },
      },
      {
        node_id: "audio-node",
        output_json: {
          kind: "audio",
          storageKeys: ["canvas/song.mp3"],
        },
      },
    ]);
    mocks.fetchMediaAsBase64.mockResolvedValue(silentWavDataUrl(20));

    await expect(
      executeNodeStep({
        id: 92,
        node_id: "video-node",
        execution_id: 25,
        execution: {
          snapshot_json: {
            revision: 1,
            scope: "node",
            rootNodeId: "video-node",
            nodes: [
              { id: "image-node", type: "image", revisionId: 1, config: {} },
              { id: "audio-node", type: "audio", revisionId: 2, config: {} },
              {
                id: "video-node",
                type: "video",
                revisionId: 3,
                config: {
                  model: "doubao-seedance-2-0-fast-260128",
                  prompt: "cut to the rhythm",
                  videoReferenceMode: "multimodal",
                  duration: 5,
                },
              },
            ],
            edges: [
              {
                sourceNodeId: "image-node",
                targetNodeId: "video-node",
                sourcePort: "output",
                targetPort: "first_frame",
              },
              {
                sourceNodeId: "audio-node",
                targetNodeId: "video-node",
                sourcePort: "output",
                targetPort: "reference_audio",
              },
            ],
          },
        },
      })
    ).rejects.toMatchObject({
      code: "MODEL_CAPABILITY_MISMATCH",
      message: expect.stringMatching(/2[–-]15/),
    });
    expect(mocks.createVideoTask).not.toHaveBeenCalled();
  });
});

describe("Seedance submit interruption", () => {
  function submittingJob(createdAt: Date) {
    return {
      id: 31,
      provider: "302ai",
      status: "submitting",
      external_id: null,
      poll_count: 0,
      created_at: createdAt,
      step_run: {
        id: 89,
        node_id: "video-node",
        execution_id: 22,
        status: "running",
      },
    };
  }

  it("does not fail a submitting video job still inside the create timeout window", async () => {
    mocks.providerJobFindUnique.mockResolvedValue(submittingJob(new Date()));

    await pollProviderJob(31);

    expect(mocks.failStepRun).not.toHaveBeenCalled();
    expect(mocks.providerJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 31 },
        data: expect.objectContaining({
          next_poll_at: expect.any(Date),
        }),
      })
    );
  });

  it("fails a submitting video job only after the create timeout window", async () => {
    mocks.providerJobFindUnique.mockResolvedValue(
      submittingJob(new Date(Date.now() - 211_000))
    );

    await pollProviderJob(31);

    expect(mocks.failStepRun).toHaveBeenCalledWith(
      89,
      "PROVIDER_TIMEOUT",
      "供应商任务提交中断"
    );
    expect(mocks.enqueueReadySteps).toHaveBeenCalledWith(22);
  });
});
