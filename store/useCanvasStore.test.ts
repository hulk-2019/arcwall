import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasSnapshot } from "@/types/canvas";

vi.mock("@/services/api", () => ({
  saveCanvas: vi.fn(),
}));

import { useCanvasStore } from "./useCanvasStore";

const snapshot: CanvasSnapshot = {
  canvasId: 12,
  projectId: 7,
  revision: 3,
  nodes: [
    {
      id: "image-1",
      type: "image",
      x: 0,
      y: 0,
      status: "succeeded",
      config: { title: "Image" },
      output: { kind: "image", storageKeys: ["canvas/image.jpg"] },
    },
    {
      id: "audio-1",
      type: "audio",
      x: 0,
      y: 0,
      status: "succeeded",
      config: { title: "Audio" },
      output: { kind: "audio", storageKeys: ["canvas/audio.mp3"] },
    },
    {
      id: "video-1",
      type: "video",
      x: 0,
      y: 0,
      status: "idle",
      config: { title: "Video", videoReferenceMode: "multimodal" },
    },
  ],
  edges: [
    {
      id: "image-edge",
      sourceNodeId: "image-1",
      sourcePort: "output",
      targetNodeId: "video-1",
      targetPort: "first_frame",
    },
    {
      id: "audio-edge",
      sourceNodeId: "audio-1",
      sourcePort: "output",
      targetNodeId: "video-1",
      targetPort: "reference_audio",
    },
  ],
};

describe("video reference mode constraints", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useCanvasStore.getState().reset();
    useCanvasStore.getState().loadSnapshot(snapshot);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("removes audio references when switching to first-frame mode", () => {
    const removed = useCanvasStore
      .getState()
      .setVideoReferenceMode("video-1", "first_frame");

    const state = useCanvasStore.getState();
    expect(removed).toBe(1);
    expect(state.nodes.find((node) => node.id === "video-1")?.config.videoReferenceMode).toBe(
      "first_frame"
    );
    expect(state.edges.map((edge) => edge.id)).toEqual(["image-edge"]);
    expect(state.pendingOps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: "edge.delete", edgeId: "audio-edge" }),
        expect.objectContaining({
          op: "node.config",
          nodeId: "video-1",
          config: expect.objectContaining({ videoReferenceMode: "first_frame" }),
        }),
      ])
    );
  });

  it("rejects a new audio reference while an image uses first-frame mode", () => {
    useCanvasStore.getState().setVideoReferenceMode("video-1", "first_frame");

    expect(useCanvasStore.getState().connectNodes("audio-1", "video-1")).toEqual({
      ok: false,
      errorKey: "connectFirstFrameNoAudio",
    });
    expect(
      useCanvasStore
        .getState()
        .edges.some((edge) => edge.sourceNodeId === "audio-1" && edge.targetNodeId === "video-1")
    ).toBe(false);
  });

  it("rejects an audio reference until the video has an image reference", () => {
    useCanvasStore.getState().loadSnapshot({
      ...snapshot,
      edges: [],
    });

    expect(useCanvasStore.getState().connectNodes("audio-1", "video-1")).toEqual({
      ok: false,
      errorKey: "connectFailed",
    });
  });

  it("uses multimodal mode when adding an image to an existing audio reference", () => {
    useCanvasStore.getState().loadSnapshot({
      ...snapshot,
      nodes: snapshot.nodes.map((node) =>
        node.id === "video-1"
          ? { ...node, config: { ...node.config, videoReferenceMode: "first_frame" } }
          : node
      ),
      edges: snapshot.edges.filter((edge) => edge.id === "audio-edge"),
    });

    expect(useCanvasStore.getState().connectNodes("image-1", "video-1")).toEqual({ ok: true });
    expect(
      useCanvasStore.getState().nodes.find((node) => node.id === "video-1")?.config
        .videoReferenceMode
    ).toBe("multimodal");
  });
});
