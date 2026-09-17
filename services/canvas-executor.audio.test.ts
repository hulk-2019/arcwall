import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  stepRunsFindMany: vi.fn(),
  legacySpeechCreate: vi.fn(),
  uploadFile: vi.fn(),
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
    audio: {
      speech: {
        create: mocks.legacySpeechCreate,
      },
    },
  }),
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

describe("Doubao Seed TTS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DOUBAO_SPEECH_API_KEY", "speech-test-key");
    mocks.stepRunsFindMany.mockResolvedValue([]);
    mocks.legacySpeechCreate.mockResolvedValue({
      arrayBuffer: async () => Uint8Array.from([9, 9]).buffer,
    });
    mocks.uploadFile.mockResolvedValue("canvas/result.mp3");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the dedicated Speech API key and decodes streamed audio", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        [
          JSON.stringify({ code: 0, message: "", data: Buffer.from([1, 2]).toString("base64") }),
          JSON.stringify({ code: 0, message: "", data: Buffer.from([3, 4]).toString("base64") }),
          JSON.stringify({ code: 20000000, message: "ok", data: null }),
        ].join("\n"),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await executeNodeStep({
      id: 90,
      node_id: "audio-node",
      execution_id: 23,
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
              config: {
                model: "doubao-seed-tts-1-0",
                text: "你好，世界",
                voice: "zh_female_cancan_mars_bigtreenlm",
                speed: 1.5,
              },
            },
          ],
          edges: [],
        },
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openspeech.bytedance.com/api/v3/tts/unidirectional");
    expect(init.headers).toEqual(
      expect.objectContaining({
        "Content-Type": "application/json",
        "X-Api-Key": "speech-test-key",
        "X-Api-Resource-Id": "seed-tts-1.0",
      })
    );
    expect(JSON.parse(String(init.body))).toEqual({
      user: { uid: "arcwall" },
      req_params: {
        text: "你好，世界",
        speaker: "zh_female_cancan_mars_bigtreenlm",
        audio_params: {
          format: "mp3",
          sample_rate: 24000,
          speech_rate: 50,
        },
      },
    });
    expect(mocks.uploadFile).toHaveBeenCalledWith(Buffer.from([1, 2, 3, 4]), expect.any(String));
    expect(mocks.legacySpeechCreate).not.toHaveBeenCalled();
  });
});
