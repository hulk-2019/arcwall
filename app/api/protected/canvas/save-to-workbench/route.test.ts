import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuthOrResponse: vi.fn(),
  findUserByEmail: vi.fn(),
  getOwnedCanvas: vi.fn(),
  saveCanvasMediaToWorkbench: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuthOrResponse: mocks.requireAuthOrResponse }));
vi.mock("@/models/user", () => ({ findUserByEmail: mocks.findUserByEmail }));
vi.mock("@/models/canvas", () => ({ getOwnedCanvas: mocks.getOwnedCanvas }));
vi.mock("@/services/canvas-workbench", () => ({
  CanvasWorkbenchError: class CanvasWorkbenchError extends Error {
    constructor(public code: "unsupported" | "no_media") {
      super(code);
    }
  },
  saveCanvasMediaToWorkbench: mocks.saveCanvasMediaToWorkbench,
}));

import { POST } from "./route";
import { CanvasWorkbenchError } from "@/services/canvas-workbench";

const NODE_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuthOrResponse.mockResolvedValue({ email: "owner@example.com" });
  mocks.findUserByEmail.mockResolvedValue({ id: 7 });
  mocks.getOwnedCanvas.mockResolvedValue({ id: 12 });
  mocks.saveCanvasMediaToWorkbench.mockResolvedValue({ saved: 1, alreadySaved: 0, ids: [11] });
});

describe("POST /canvas/save-to-workbench", () => {
  it("saves owned canvas media into the workbench", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/protected/canvas/save-to-workbench", {
        method: "POST",
        body: JSON.stringify({ canvasId: 12, nodeId: NODE_ID }),
      })
    );

    expect(await response.json()).toEqual({
      code: 0,
      message: "ok",
      data: { saved: 1, alreadySaved: 0, ids: [11] },
    });
    expect(mocks.saveCanvasMediaToWorkbench).toHaveBeenCalledWith({
      userId: 7,
      canvasId: 12,
      nodeId: NODE_ID,
    });
  });

  it("rejects saves outside the owned canvas", async () => {
    mocks.getOwnedCanvas.mockResolvedValue(null);

    const response = await POST(
      new NextRequest("http://localhost/api/protected/canvas/save-to-workbench", {
        method: "POST",
        body: JSON.stringify({ canvasId: 12, nodeId: NODE_ID }),
      })
    );

    const body = await response.json();
    expect(body.code).toBe(-1);
    expect(mocks.saveCanvasMediaToWorkbench).not.toHaveBeenCalled();
  });

  it("maps missing media to a locale error", async () => {
    mocks.saveCanvasMediaToWorkbench.mockRejectedValue(new CanvasWorkbenchError("no_media"));

    const response = await POST(
      new NextRequest("http://localhost/api/protected/canvas/save-to-workbench", {
        method: "POST",
        body: JSON.stringify({ canvasId: 12, nodeId: NODE_ID }),
      })
    );

    const body = await response.json();
    expect(body.code).toBe(-1);
    expect(body.message).toMatch(/素材|media/i);
  });
});
