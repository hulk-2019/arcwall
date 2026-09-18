import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuthOrResponse: vi.fn(),
  findUserByEmail: vi.fn(),
  getOwnedCanvas: vi.fn(),
  submitSunoLyrics: vi.fn(),
  fetchSunoLyrics: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuthOrResponse: mocks.requireAuthOrResponse }));
vi.mock("@/models/user", () => ({ findUserByEmail: mocks.findUserByEmail }));
vi.mock("@/models/canvas", () => ({ getOwnedCanvas: mocks.getOwnedCanvas }));
vi.mock("@/services/suno-proxy", () => ({
  submitSunoLyrics: mocks.submitSunoLyrics,
  fetchSunoLyrics: mocks.fetchSunoLyrics,
}));
vi.mock("@/lib/redis", () => ({
  redis: {
    get: mocks.redisGet,
    set: mocks.redisSet,
  },
}));

import { GET, POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuthOrResponse.mockResolvedValue({ email: "owner@example.com" });
  mocks.findUserByEmail.mockResolvedValue({ id: 7 });
  mocks.getOwnedCanvas.mockResolvedValue({ id: 12 });
  mocks.submitSunoLyrics.mockResolvedValue("lyrics-task-1");
  mocks.redisSet.mockResolvedValue("OK");
});

describe("POST /canvas/generate-lyrics", () => {
  it("submits a lyrics task for an owned canvas", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/protected/canvas/generate-lyrics", {
        method: "POST",
        body: JSON.stringify({ canvasId: 12, prompt: "城市夜晚的温柔民谣" }),
      })
    );

    expect(await response.json()).toEqual({
      code: 0,
      message: "ok",
      data: { taskId: "lyrics-task-1" },
    });
    expect(mocks.submitSunoLyrics).toHaveBeenCalledWith("城市夜晚的温柔民谣");
    expect(mocks.redisSet).toHaveBeenCalledWith(
      "canvas:lyrics-task:lyrics-task-1",
      "7",
      "EX",
      900
    );
  });

  it("rejects descriptions over Suno's 200-character limit", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/protected/canvas/generate-lyrics", {
        method: "POST",
        body: JSON.stringify({ canvasId: 12, prompt: "歌".repeat(201) }),
      })
    );

    const body = await response.json();
    expect(body.code).toBe(-1);
    expect(mocks.submitSunoLyrics).not.toHaveBeenCalled();
  });
});

describe("GET /canvas/generate-lyrics", () => {
  it("returns generated variants only to the task owner", async () => {
    mocks.redisGet.mockResolvedValue("7");
    mocks.fetchSunoLyrics.mockResolvedValue({
      status: "succeeded",
      variants: [{ id: "v1", title: "夜行", text: "[Verse]\n灯火沿着河流" }],
      rawStatus: "SUCCESS",
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/protected/canvas/generate-lyrics?taskId=lyrics-task-1"
      )
    );

    expect(await response.json()).toEqual({
      code: 0,
      message: "ok",
      data: {
        status: "succeeded",
        variants: [{ id: "v1", title: "夜行", text: "[Verse]\n灯火沿着河流" }],
        rawStatus: "SUCCESS",
      },
    });
  });

  it("rejects polling a task owned by another user", async () => {
    mocks.redisGet.mockResolvedValue("99");

    const response = await GET(
      new NextRequest(
        "http://localhost/api/protected/canvas/generate-lyrics?taskId=lyrics-task-1"
      )
    );

    const body = await response.json();
    expect(body.code).toBe(-1);
    expect(mocks.fetchSunoLyrics).not.toHaveBeenCalled();
  });
});
