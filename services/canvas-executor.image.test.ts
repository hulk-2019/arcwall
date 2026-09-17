import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  stepRunsFindMany: vi.fn(),
  arkGenerate: vi.fn(),
  getSignedInternalUrl: vi.fn(),
  fetchImageAsBase64: vi.fn(),
  uploadFile: vi.fn(),
  providerJobCreate: vi.fn(),
  providerJobUpdate: vi.fn(),
  createVideoTask: vi.fn(),
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
  enqueueReadySteps: vi.fn(),
  finalizeExecutionIfDone: vi.fn(),
  pollBackoffMs: vi.fn(),
  skipDownstreamSteps: vi.fn(),
}));
vi.mock("@/models/canvas", () => ({
  completeStepRun: vi.fn(),
  failStepRun: vi.fn(),
}));
vi.mock("@/services/video", () => ({
  createVideoTask: mocks.createVideoTask,
  getVideoTask: vi.fn(),
  cancelVideoTask: vi.fn(),
}));

import { executeNodeStep } from "./canvas-executor";

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
  mocks.arkGenerate.mockResolvedValue({
    data: [{ b64_json: Buffer.from("result").toString("base64") }],
  });
  mocks.uploadFile.mockResolvedValue("canvas/result.jpg");
  mocks.providerJobCreate.mockResolvedValue({ id: 31 });
  mocks.providerJobUpdate.mockResolvedValue({});
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
  it("inlines the first frame and limits the Fast model to 720p", async () => {
    await executeNodeStep({
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
                videoMode: "image",
                resolution: "1080p",
                aspectRatio: "16:9",
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
      })
    );
  });
});
