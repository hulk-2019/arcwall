import { afterEach, describe, expect, it, vi } from "vitest";
import { getCanvasSnapshot } from "./api";

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
});
