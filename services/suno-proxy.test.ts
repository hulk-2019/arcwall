import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  axiosGet: vi.fn(),
  axiosPost: vi.fn(),
}));

vi.mock("axios", () => {
  const actual = vi.importActual("axios");
  return {
    ...actual,
    default: {
      ...(actual as any).default,
      get: mocks.axiosGet,
      post: mocks.axiosPost,
    },
  };
});
vi.mock("./image-proxy", () => ({
  requireProxy: () => ({
    baseUrl: "https://api.302.ai",
    headers: { Authorization: "Bearer test" },
  }),
}));

import { fetchSunoTask, submitSunoTask } from "./suno-proxy";

/** 302.ai 实测返回形态（192310067e0）：clips 在 data.data 数组，主键 clip_id */
function realSuccessResponse() {
  return {
    code: 200,
    message: "success",
    progress: "100%",
    status: "SUCCESS",
    data: {
      task_id: "299989a9-ee57-4588-964b-b4f91d392a39",
      status: "SUCCESS",
      data: [
        {
          clip_id: "c307d682-8169-40d7-8991-951e2be2d99d",
          audio_url: "https://file.302.ai/gpt/imgs/20260918/first.mp3",
          status: "SUCCESS",
          state: "succeeded",
          title: "这扇窗",
          tags: "city-pop",
        },
        {
          clip_id: "a7fcc0df-eefc-4acb-9192-69d2f4ff5bbc",
          audio_url: "https://file.302.ai/gpt/imgs/20260918/second.mp3",
          status: "SUCCESS",
          state: "succeeded",
          title: "和这座城合个唱",
          tags: "城市文旅",
        },
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchSunoTask", () => {
  it("parses the real 302.ai response shape (clips under data.data with clip_id)", async () => {
    mocks.axiosGet.mockResolvedValue({ data: realSuccessResponse(), status: 200 });

    const result = await fetchSunoTask("299989a9-ee57-4588-964b-b4f91d392a39");

    // 修复前：clips 恒为空 → status 恒为 unknown → 轮询到平台超时
    expect(result.status).toBe("succeeded");
    expect(result.audioUrl).toBe("https://file.302.ai/gpt/imgs/20260918/first.mp3");
    expect(result.title).toBe("这扇窗");
    expect(result.rawStatus).toBe("SUCCESS");
    expect(result.clips).toHaveLength(2);
    expect(result.clips[0]).toMatchObject({
      id: "c307d682-8169-40d7-8991-951e2be2d99d",
      audioUrl: "https://file.302.ai/gpt/imgs/20260918/first.mp3",
      title: "这扇窗",
    });
  });

  it("maps in-progress tasks to running", async () => {
    mocks.axiosGet.mockResolvedValue({
      data: { code: 200, data: { task_id: "t1", status: "IN_PROGRESS", data: [] } },
      status: 200,
    });

    const result = await fetchSunoTask("t1");

    expect(result.status).toBe("running");
    expect(result.clips).toHaveLength(0);
    expect(result.audioUrl).toBeUndefined();
  });

  it("still supports the open-source suno-api shape (data.clips with id)", async () => {
    mocks.axiosGet.mockResolvedValue({
      data: {
        code: 200,
        data: {
          task: { status: "SUCCESS" },
          clips: [{ id: "c1", audio_url: "https://cdn/audio.mp3", title: "旧形态" }],
        },
      },
      status: 200,
    });

    const result = await fetchSunoTask("legacy-1");

    expect(result.status).toBe("succeeded");
    expect(result.audioUrl).toBe("https://cdn/audio.mp3");
    expect(result.clips[0].id).toBe("c1");
  });

  it("marks failure when provider reports FAIL", async () => {
    mocks.axiosGet.mockResolvedValue({
      data: { code: 200, data: { task_id: "t2", status: "CREATE_TASK_FAILED", data: [] } },
      status: 200,
    });

    const result = await fetchSunoTask("t2");

    expect(result.status).toBe("failed");
  });

  it("throws on non-zero code", async () => {
    mocks.axiosGet.mockResolvedValue({
      data: { code: 401, message: "unauthorized" },
      status: 200,
    });

    await expect(fetchSunoTask("bad")).rejects.toThrow("Suno 查询失败");
  });
});

describe("submitSunoTask", () => {
  it("sends custom mode fields and returns task id from data field", async () => {
    mocks.axiosPost.mockResolvedValue({
      data: { code: 200, data: "task-id-1", message: "success" },
      status: 200,
    });

    const id = await submitSunoTask({
      model: "suno-v5",
      mode: "custom",
      text: "[Verse]\n歌词",
      tags: "pop",
      title: "标题",
      vocal: "female",
    });

    expect(id).toBe("task-id-1");
    const [url, body, config] = mocks.axiosPost.mock.calls[0];
    expect(url).toBe("https://api.302.ai/suno/submit/music");
    expect(body).toMatchObject({
      mv: "chirp-crow",
      prompt: "[Verse]\n歌词",
      tags: "pop",
      title: "标题",
      make_instrumental: false,
      metadata: { create_mode: "custom", vocal_gender: "f" },
    });
    expect(config.timeout).toBe(60_000);
  });

  it("sends instrumental flag for instrumental mode", async () => {
    mocks.axiosPost.mockResolvedValue({
      data: { code: 200, data: "task-id-2" },
      status: 200,
    });

    await submitSunoTask({
      model: "suno-v4.5",
      mode: "instrumental",
      text: "轻快的清晨 BGM",
    });

    const [, body] = mocks.axiosPost.mock.calls[0];
    expect(body).toMatchObject({
      mv: "chirp-auk",
      gpt_description_prompt: "轻快的清晨 BGM",
      make_instrumental: true,
    });
    expect(body.prompt).toBeUndefined();
  });
});
