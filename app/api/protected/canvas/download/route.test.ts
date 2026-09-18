import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuthOrResponse: vi.fn(),
  findUserByEmail: vi.fn(),
  getOwnedCanvas: vi.fn(),
  stepRunFindFirst: vi.fn(),
  nodeFindFirst: vi.fn(),
  getSignedDownloadUrl: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuthOrResponse: mocks.requireAuthOrResponse }));
vi.mock("@/models/user", () => ({ findUserByEmail: mocks.findUserByEmail }));
vi.mock("@/models/canvas", () => ({ getOwnedCanvas: mocks.getOwnedCanvas }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    step_runs: { findFirst: mocks.stepRunFindFirst },
    nodes: { findFirst: mocks.nodeFindFirst },
  },
}));
vi.mock("@/lib/oss", () => ({
  getSignedDownloadUrl: mocks.getSignedDownloadUrl,
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuthOrResponse.mockResolvedValue({ email: "owner@example.com" });
  mocks.findUserByEmail.mockResolvedValue({ id: 7 });
  mocks.getOwnedCanvas.mockResolvedValue({ id: 12 });
  mocks.stepRunFindFirst.mockResolvedValue({
    output_json: {
      kind: "image",
      storageKeys: ["canvas/image-1.png", "canvas/image-2.png"],
      meta: { title: "城市夜景" },
    },
    node_revision: { config_json: { title: "备用标题" } },
  });
  mocks.nodeFindFirst.mockResolvedValue({
    type: "image",
    current_revision: { config_json: { title: "备用标题" } },
  });
  mocks.getSignedDownloadUrl.mockReturnValue("https://oss.test/download");
});

describe("GET /canvas/download", () => {
  it("authorizes the node and redirects to an attachment-signed OSS URL", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/protected/canvas/download?canvasId=12&nodeId=image-1&index=1"
      )
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://oss.test/download");
    expect(mocks.getSignedDownloadUrl).toHaveBeenCalledWith(
      "canvas/image-2.png",
      "城市夜景-2.png",
      600
    );
  });

  it("returns the prepared download URL to same-origin clients", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/protected/canvas/download?canvasId=12&nodeId=image-1&index=0",
        { headers: { Accept: "application/json" } }
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://oss.test/download" });
  });

  it("rejects downloads outside the owned canvas", async () => {
    mocks.getOwnedCanvas.mockResolvedValue(null);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/protected/canvas/download?canvasId=12&nodeId=image-1&index=0"
      )
    );

    expect(response.status).toBe(404);
    expect(mocks.stepRunFindFirst).not.toHaveBeenCalled();
  });

  it("downloads a passive upload node without a step run", async () => {
    mocks.stepRunFindFirst.mockResolvedValue(null);
    mocks.nodeFindFirst.mockResolvedValue({
      type: "upload",
      current_revision: {
        config_json: {
          storageKey: "canvas/uploads/demo.mp4",
          fileName: "演示视频.mp4",
          mediaType: "video",
        },
      },
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/protected/canvas/download?canvasId=12&nodeId=upload-1&index=0"
      )
    );

    expect(response.status).toBe(302);
    expect(mocks.getSignedDownloadUrl).toHaveBeenCalledWith(
      "canvas/uploads/demo.mp4",
      "演示视频.mp4",
      600
    );
  });
});
