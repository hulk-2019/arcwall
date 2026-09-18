import { afterEach, describe, expect, it, vi } from "vitest";
import { getCanvasSnapshot, prepareCanvasDownload } from "./api";

describe("getCanvasSnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("bypasses the browser cache so OSS URLs are signed again", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 0, data: { nodes: [], edges: [] } }))
    );
    vi.stubGlobal("fetch", fetchMock);

    await getCanvasSnapshot(3);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/protected/canvas/3",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("prepares a signed download without following its redirect", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: "https://oss.test/file" }))
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      prepareCanvasDownload("/api/protected/canvas/download?nodeId=1")
    ).resolves.toBe("https://oss.test/file");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/protected/canvas/download?nodeId=1",
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: "application/json" }),
      })
    );
  });
});
