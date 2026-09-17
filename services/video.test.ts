import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    post: mocks.post,
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

import { createVideoTask } from "./video";

describe("createVideoTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes Ark response details when task creation fails", async () => {
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
      'Ark 视频任务创建失败（HTTP 404）：{"error":{"code":"InvalidImageURL","message":"image URL could not be fetched"}}'
    );
  });
});
