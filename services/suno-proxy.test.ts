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

import * as sunoProxy from "./suno-proxy";

const { fetchSunoTask, submitSunoTask } = sunoProxy;

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
          prompt: "[Verse]\n推开清晨的玻璃门",
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
    expect(result.lyrics).toBe("[Verse]\n推开清晨的玻璃门");
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
      style: "pop",
    } as any);

    expect(id).toBe("task-id-1");
    const [url, body, config] = mocks.axiosPost.mock.calls[0];
    expect(url).toBe("https://api.302.ai/suno/submit/music");
    expect(body).toMatchObject({
      mv: "chirp-crow",
      prompt: "[Verse]\n歌词",
      tags: "pop, ballad, acoustic",
      title: "标题",
      make_instrumental: false,
      metadata: { create_mode: "custom", vocal_gender: "f" },
    });
    expect(config.timeout).toBe(60_000);
  });

  it("sends instrumental description and style as tags without vocal fields", async () => {
    mocks.axiosPost.mockResolvedValue({
      data: { code: 200, data: "task-id-2" },
      status: 200,
    });

    await submitSunoTask({
      model: "suno-v4.5",
      mode: "instrumental",
      text: "轻快的清晨 BGM",
      style: "electronic",
      vocal: "female",
    } as any);

    const [, body] = mocks.axiosPost.mock.calls[0];
    expect(body).toMatchObject({
      mv: "chirp-auk",
      tags: "轻快的清晨 BGM, electronic, edm, synthwave",
      title: "轻快的清晨 BGM",
      make_instrumental: true,
    });
    expect(body.prompt).toBeUndefined();
    expect(body.gpt_description_prompt).toBeUndefined();
    expect(body.metadata?.vocal_gender).toBeUndefined();
  });

  it("appends selected style and vocal to automatic mode description", async () => {
    mocks.axiosPost.mockResolvedValue({
      data: { code: 200, data: "task-id-3" },
      status: 200,
    });

    await submitSunoTask({
      model: "suno-v5",
      mode: "auto",
      text: "关于夏日旅行的歌曲",
      style: "rock",
      vocal: "male",
    } as any);

    const [, body] = mocks.axiosPost.mock.calls[0];
    expect(body).toMatchObject({
      gpt_description_prompt:
        "关于夏日旅行的歌曲\nStyle: rock, indie, alternative\nVocal: male",
      make_instrumental: false,
    });
  });
});

describe("Suno lyrics generation", () => {
  it("exposes task submission and polling functions", () => {
    expect(typeof (sunoProxy as any).submitSunoLyrics).toBe("function");
    expect(typeof (sunoProxy as any).fetchSunoLyrics).toBe("function");
  });

  it("submits a description to /suno/submit/lyrics", async () => {
    mocks.axiosPost.mockResolvedValue({
      data: { code: 200, data: "lyrics-task-1" },
      status: 200,
    });

    const taskId = await (sunoProxy as any).submitSunoLyrics("城市夜晚的温柔民谣");

    expect(taskId).toBe("lyrics-task-1");
    expect(mocks.axiosPost).toHaveBeenCalledWith(
      "https://api.302.ai/suno/submit/lyrics",
      { prompt: "城市夜晚的温柔民谣" },
      expect.objectContaining({ timeout: 60_000 })
    );
  });

  it("parses generated lyric variants from the shared fetch endpoint", async () => {
    mocks.axiosGet.mockResolvedValue({
      data: {
        code: 200,
        data: {
          task_id: "lyrics-task-1",
          status: "SUCCESS",
          data: [
            {
              id: "lyrics-1",
              title: "夜行",
              text: "[Verse]\n灯火沿着河流",
              status: "complete",
            },
          ],
        },
      },
      status: 200,
    });

    const result = await (sunoProxy as any).fetchSunoLyrics("lyrics-task-1");

    expect(result).toEqual({
      status: "succeeded",
      variants: [
        {
          id: "lyrics-1",
          title: "夜行",
          text: "[Verse]\n灯火沿着河流",
        },
      ],
      rawStatus: "SUCCESS",
    });
  });
});

describe("Suno timestamped lyrics", () => {
  it("submits the original music task to /suno/timing", async () => {
    mocks.axiosPost.mockResolvedValue({
      data: { code: "success", data: "timing-task-1" },
      status: 200,
    });

    const taskId = await (sunoProxy as any).submitSunoTiming("music-task-1");

    expect(taskId).toBe("timing-task-1");
    expect(mocks.axiosPost).toHaveBeenCalledWith(
      "https://api.302.ai/suno/timing",
      { task_id: "music-task-1" },
      expect.objectContaining({ timeout: 60_000 })
    );
  });

  it("parses alignment words returned by a timing fetch task", async () => {
    mocks.axiosGet.mockResolvedValue({
      data: {
        code: 200,
        data: {
          task_id: "timing-task-1",
          status: "SUCCESS",
          data: {
            alignment: [
              {
                word: "[Verse]\\n灯火",
                success: true,
                start_s: 0.55851,
                end_s: 1.2,
                p_align: 0.98,
              },
              {
                word: "沿着河流\\n",
                success: true,
                start_s: 1.2,
                end_s: 2.4,
                p_align: 0.96,
              },
            ],
          },
        },
      },
      status: 200,
    });

    const result = await (sunoProxy as any).fetchSunoTiming("timing-task-1");

    expect(result).toEqual({
      status: "succeeded",
      rawStatus: "SUCCESS",
      tracks: [
        {
          clipId: undefined,
          words: [
            {
              text: "[Verse]\\n灯火",
              startMs: 559,
              endMs: 1200,
              confidence: 0.98,
            },
            {
              text: "沿着河流\\n",
              startMs: 1200,
              endMs: 2400,
              confidence: 0.96,
            },
          ],
        },
      ],
    });
  });

  it("supports timing results nested as one entry in data.data", async () => {
    mocks.axiosGet.mockResolvedValue({
      data: {
        code: 200,
        data: {
          status: "SUCCESS",
          data: [
            {
              clip_id: "clip-1",
              data: {
                alignment: [
                  { word: "第一句\\n", success: true, start_s: 2, end_s: 3 },
                ],
              },
            },
          ],
        },
      },
      status: 200,
    });

    const result = await (sunoProxy as any).fetchSunoTiming("timing-task-2");

    expect(result.status).toBe("succeeded");
    expect(result.tracks[0]).toMatchObject({
      clipId: "clip-1",
      words: [{ text: "第一句\\n", startMs: 2000, endMs: 3000 }],
    });
  });
});
