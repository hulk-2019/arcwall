import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuthOrResponse: vi.fn(),
  findUserByEmail: vi.fn(),
  getOwnedCanvas: vi.fn(),
  stepRunFindFirst: vi.fn(),
  getSignedInternalUrl: vi.fn(),
  axiosGet: vi.fn(),
  embedLyricsInMp3: vi.fn(),
  buildSongPackage: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuthOrResponse: mocks.requireAuthOrResponse }));
vi.mock("@/models/user", () => ({ findUserByEmail: mocks.findUserByEmail }));
vi.mock("@/models/canvas", () => ({ getOwnedCanvas: mocks.getOwnedCanvas }));
vi.mock("@/lib/prisma", () => ({
  prisma: { step_runs: { findFirst: mocks.stepRunFindFirst } },
}));
vi.mock("@/lib/oss", () => ({ getSignedInternalUrl: mocks.getSignedInternalUrl }));
vi.mock("axios", () => ({
  default: { get: mocks.axiosGet },
}));
vi.mock("@/services/audio-download", () => ({
  embedLyricsInMp3: mocks.embedLyricsInMp3,
  buildSongPackage: mocks.buildSongPackage,
}));

import { GET } from "./route";

const output = {
  kind: "audio",
  storageKeys: ["canvas/song.mp3"],
  meta: {
    title: "夜行",
    lyrics: "灯火沿着河流",
    timedWords: [{ text: "灯火沿着河流\n", startMs: 500, endMs: 2200 }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuthOrResponse.mockResolvedValue({ email: "owner@example.com" });
  mocks.findUserByEmail.mockResolvedValue({ id: 7 });
  mocks.getOwnedCanvas.mockResolvedValue({ id: 12 });
  mocks.stepRunFindFirst.mockResolvedValue({ output_json: output });
  mocks.getSignedInternalUrl.mockReturnValue("https://oss.test/song.mp3");
  mocks.axiosGet.mockResolvedValue({ data: Uint8Array.from([1, 2, 3]).buffer });
  mocks.embedLyricsInMp3.mockReturnValue(Buffer.from("tagged"));
  mocks.buildSongPackage.mockResolvedValue(Buffer.from("zip"));
});

describe("GET /canvas/audio-download", () => {
  it("returns an MP3 with embedded lyrics for an owned canvas node", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/protected/canvas/audio-download?canvasId=12&nodeId=audio-1&format=mp3"
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(response.headers.get("content-disposition")).toContain(
      "filename*=UTF-8''%E5%A4%9C%E8%A1%8C.mp3"
    );
    expect(mocks.embedLyricsInMp3).toHaveBeenCalledWith(
      expect.any(Buffer),
      "夜行",
      "灯火沿着河流",
      output.meta.timedWords
    );
  });

  it("returns a ZIP song package with MP3, LRC and TXT", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/protected/canvas/audio-download?canvasId=12&nodeId=audio-1&format=zip"
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(mocks.buildSongPackage).toHaveBeenCalledWith(
      expect.any(Buffer),
      "夜行",
      "灯火沿着河流",
      output.meta.timedWords
    );
  });

  it("rejects a node outside the owned canvas", async () => {
    mocks.getOwnedCanvas.mockResolvedValue(null);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/protected/canvas/audio-download?canvasId=12&nodeId=audio-1&format=mp3"
      )
    );

    expect(response.status).toBe(404);
    expect(mocks.stepRunFindFirst).not.toHaveBeenCalled();
  });
});
