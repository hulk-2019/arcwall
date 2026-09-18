import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuthOrResponse: vi.fn(),
  findUserByEmail: vi.fn(),
  getOwnedCanvas: vi.fn(),
  stepRunFindFirst: vi.fn(),
  getSignedInternalUrl: vi.fn(),
  internalDownloadHeaders: vi.fn(),
  objectExists: vi.fn(),
  uploadFile: vi.fn(),
  getSignedDownloadUrl: vi.fn(),
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
vi.mock("@/lib/oss", () => ({
  getSignedInternalUrl: mocks.getSignedInternalUrl,
  internalDownloadHeaders: mocks.internalDownloadHeaders,
  objectExists: mocks.objectExists,
  uploadFile: mocks.uploadFile,
  getSignedDownloadUrl: mocks.getSignedDownloadUrl,
}));
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
  mocks.internalDownloadHeaders.mockReturnValue({ Referer: "https://static.example.com/" });
  mocks.objectExists.mockResolvedValue(false);
  mocks.uploadFile.mockImplementation(async (_buffer: Buffer, key: string) => key);
  mocks.getSignedDownloadUrl.mockReturnValue("https://oss.test/cached-download");
  mocks.axiosGet.mockResolvedValue({ data: Uint8Array.from([1, 2, 3]).buffer });
  mocks.embedLyricsInMp3.mockReturnValue(Buffer.from("tagged"));
  mocks.buildSongPackage.mockResolvedValue(Buffer.from("zip"));
});

describe("GET /canvas/audio-download", () => {
  it("generates, caches and redirects to a lyrics-tagged MP3", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/protected/canvas/audio-download?canvasId=12&nodeId=audio-1&format=mp3"
      )
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://oss.test/cached-download");
    expect(mocks.axiosGet).toHaveBeenCalledWith(
      "https://oss.test/song.mp3",
      expect.objectContaining({
        headers: { Referer: "https://static.example.com/" },
      })
    );
    expect(mocks.embedLyricsInMp3).toHaveBeenCalledWith(
      expect.any(Buffer),
      "夜行",
      "灯火沿着河流",
      output.meta.timedWords
    );
    expect(mocks.uploadFile).toHaveBeenCalledWith(
      Buffer.from("tagged"),
      expect.stringMatching(/^canvas\/downloads\/[a-f0-9]{64}\.mp3$/)
    );
    expect(mocks.getSignedDownloadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^canvas\/downloads\/[a-f0-9]{64}\.mp3$/),
      "夜行.mp3",
      600
    );
  });

  it("generates and caches a ZIP song package", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/protected/canvas/audio-download?canvasId=12&nodeId=audio-1&format=zip"
      )
    );

    expect(response.status).toBe(302);
    expect(mocks.buildSongPackage).toHaveBeenCalledWith(
      expect.any(Buffer),
      "夜行",
      "灯火沿着河流",
      output.meta.timedWords
    );
    expect(mocks.uploadFile).toHaveBeenCalledWith(
      Buffer.from("zip"),
      expect.stringMatching(/^canvas\/downloads\/[a-f0-9]{64}\.zip$/)
    );
  });

  it("reuses an existing cached derivative without downloading the source", async () => {
    mocks.objectExists.mockResolvedValue(true);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/protected/canvas/audio-download?canvasId=12&nodeId=audio-1&format=mp3",
        { headers: { Accept: "application/json" } }
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://oss.test/cached-download" });
    expect(mocks.axiosGet).not.toHaveBeenCalled();
    expect(mocks.embedLyricsInMp3).not.toHaveBeenCalled();
    expect(mocks.uploadFile).not.toHaveBeenCalled();
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
