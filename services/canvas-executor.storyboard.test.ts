import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  stepRunsFindMany: vi.fn(),
  chatCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    step_runs: {
      findMany: mocks.stepRunsFindMany,
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("@/services/openai", () => ({
  getDoubaoAIClient: () => ({
    chat: { completions: { create: mocks.chatCreate } },
  }),
}));
vi.mock("@/lib/oss", () => ({
  getSignedInternalUrl: vi.fn(),
  fetchImageAsBase64: vi.fn(),
  fetchMediaAsBase64: vi.fn(),
  uploadFile: vi.fn(),
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
  createVideoTask: vi.fn(),
  getVideoTask: vi.fn(),
  cancelVideoTask: vi.fn(),
}));

import { executeNodeStep } from "./canvas-executor";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.stepRunsFindMany.mockResolvedValue([]);
  mocks.chatCreate.mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            title: "Result",
            shots: [{ index: 1, subject_action: "walk" }],
          }),
        },
      },
    ],
  });
});

describe("storyboard references", () => {
  it("combines connected text with the node brief", async () => {
    await executeNodeStep({
      id: 91,
      node_id: "storyboard-node",
      execution_id: 24,
      execution: {
        snapshot_json: {
          revision: 1,
          scope: "node",
          rootNodeId: "storyboard-node",
          nodes: [
            {
              id: "text-node",
              type: "text",
              revisionId: 1,
              config: { text: "reference brief" },
            },
            {
              id: "storyboard-node",
              type: "storyboard",
              revisionId: 2,
              config: { brief: "own brief" },
            },
          ],
          edges: [
            {
              sourceNodeId: "text-node",
              targetNodeId: "storyboard-node",
              sourcePort: "output",
              targetPort: "brief",
            },
          ],
        },
      },
    });

    expect(mocks.chatCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          { role: "user", content: "创意简报：reference brief\n\nown brief" },
        ]),
      })
    );
  });
});
