import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    post: mocks.post,
    get: mocks.get,
    delete: mocks.delete,
  },
}));

import { cancelVideoTask, createVideoTask, getVideoTask } from "./video";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PROXY_302AI_BASE_URL", "https://proxy.example.com/");
  vi.stubEnv("PROXY_302AI_API_KEY", "proxy-key");
  vi.stubEnv("ARK_API_BASE_URL", "https://ark.example.com/api/v3");
  vi.stubEnv("ARK_API_KEY", "ark-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("302.ai Seedance video tasks", () => {
  it("submits tasks through the 302.ai Volcengine proxy", async () => {
    mocks.post.mockResolvedValue({
      data: { id: "task-1", status: "queued" },
    });

    const result = await createVideoTask({
      model: "doubao-seedance-2-0-fast-260128",
      prompt: "animate",
      firstFrameUrl: "data:image/jpeg;base64,cmVm",
      resolution: "720p",
    });

    expect(result).toEqual({ providerTaskId: "task-1", status: "queued" });
    expect(mocks.post).toHaveBeenCalledWith(
      "https://proxy.example.com/volcengine/api/v3/contents/generations/tasks",
      expect.objectContaining({
        model: "doubao-seedance-2-0-fast-260128",
        content: expect.arrayContaining([
          {
            type: "image_url",
            image_url: { url: "data:image/jpeg;base64,cmVm" },
            role: "first_frame",
          },
        ]),
      }),
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer proxy-key",
        },
      })
    );
  });

  it("queries tasks through the same 302.ai proxy", async () => {
    mocks.get.mockResolvedValue({
      data: {
        id: "task-1",
        status: "succeeded",
        content: { video_url: "https://file.example.com/video.mp4" },
      },
    });

    const result = await getVideoTask("task-1");

    expect(result.status).toBe("succeeded");
    expect(result.videoUrl).toBe("https://file.example.com/video.mp4");
    expect(mocks.get).toHaveBeenCalledWith(
      "https://proxy.example.com/volcengine/api/v3/contents/generations/tasks/task-1",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer proxy-key" }),
      })
    );
  });

  it("attempts cancellation through the 302.ai proxy", async () => {
    mocks.delete.mockResolvedValue({});

    await expect(cancelVideoTask("task-1")).resolves.toBe(true);

    expect(mocks.delete).toHaveBeenCalledWith(
      "https://proxy.example.com/volcengine/api/v3/contents/generations/tasks/task-1",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer proxy-key" }),
      })
    );
  });

  it("includes 302.ai response details when task creation fails", async () => {
    mocks.post.mockRejectedValue(
      Object.assign(new Error("Request failed with status code 404"), {
        response: {
          status: 404,
          data: {
            error: {
              code: "InvalidImageURL",
              message: "image URL could not be fetched",
            },
          },
        },
      })
    );

    await expect(
      createVideoTask({
        model: "doubao-seedance-2-0-fast-260128",
        prompt: "animate",
        firstFrameUrl: "https://assets.example.com/reference.jpg",
        resolution: "720p",
      })
    ).rejects.toThrow(
      '302.ai 视频任务创建失败（HTTP 404）：{"error":{"code":"InvalidImageURL","message":"image URL could not be fetched"}}'
    );
  });
});
