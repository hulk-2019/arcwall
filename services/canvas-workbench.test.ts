import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  nodeFindFirst: vi.fn(),
  stepRunFindFirst: vi.fn(),
  wallpaperFindFirst: vi.fn(),
  wallpaperCreate: vi.fn(),
  copyOssObject: vi.fn(),
  getOssObjectBuffer: vi.fn(),
  uploadFile: vi.fn(),
  uploadJpegThumbnail: vi.fn(),
  generateWorkbenchMediaKeys: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    nodes: { findFirst: mocks.nodeFindFirst },
    step_runs: { findFirst: mocks.stepRunFindFirst },
    wallpapers: {
      findFirst: mocks.wallpaperFindFirst,
      create: mocks.wallpaperCreate,
    },
  },
}));

vi.mock("@/lib/oss", () => ({
  copyOssObject: mocks.copyOssObject,
  getOssObjectBuffer: mocks.getOssObjectBuffer,
  uploadFile: mocks.uploadFile,
  uploadJpegThumbnail: mocks.uploadJpegThumbnail,
  generateWorkbenchMediaKeys: mocks.generateWorkbenchMediaKeys,
}));

import { CanvasWorkbenchError, saveCanvasMediaToWorkbench } from "./canvas-workbench";

const IMAGE_NODE_ID = "11111111-1111-4111-8111-111111111111";
const VIDEO_NODE_ID = "22222222-2222-4222-8222-222222222222";
const AUDIO_NODE_ID = "33333333-3333-4333-8333-333333333333";
const UPLOAD_NODE_ID = "44444444-4444-4444-8444-444444444444";
const TEXT_NODE_ID = "55555555-5555-4555-8555-555555555555";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.wallpaperFindFirst.mockResolvedValue(null);
  mocks.wallpaperCreate.mockImplementation(async ({ data }: { data: { img_path: string } }) => ({
    id: data.img_path.includes("video") ? 21 : data.img_path.includes("audio") ? 31 : 11,
  }));
  mocks.generateWorkbenchMediaKeys.mockImplementation((ext: string) => ({
    original: `wallpapers/20260919/copied${ext.startsWith(".") ? ext : `.${ext}`}`,
    thumbnail: "wallpapers/20260919/thumb.jpg",
  }));
  mocks.copyOssObject.mockImplementation(async (_source: string, dest: string) => dest);
  mocks.getOssObjectBuffer.mockResolvedValue(Buffer.from("image-bytes"));
  mocks.uploadFile.mockImplementation(async (_buffer: Buffer, path: string) => path);
  mocks.uploadJpegThumbnail.mockResolvedValue("wallpapers/20260919/thumb.jpg");
});

describe("saveCanvasMediaToWorkbench", () => {
  it("copies image outputs into wallpapers/ and records succeeded image works", async () => {
    mocks.nodeFindFirst.mockResolvedValue({
      type: "image",
      current_revision: { config_json: { title: "城市夜景", prompt: "霓虹雨巷", model: "seedream", aspectRatio: "9:16" } },
    });
    mocks.stepRunFindFirst.mockResolvedValue({
      output_json: { kind: "image", storageKeys: ["canvas/night.png"], meta: { title: "城市夜景" } },
      node_revision: { config_json: { title: "城市夜景", prompt: "霓虹雨巷", model: "seedream", aspectRatio: "9:16" } },
    });

    const result = await saveCanvasMediaToWorkbench({
      userId: 7,
      canvasId: 12,
      nodeId: IMAGE_NODE_ID,
    });

    expect(result).toEqual({ saved: 1, alreadySaved: 0, ids: [11] });
    expect(mocks.getOssObjectBuffer).toHaveBeenCalledWith("canvas/night.png");
    expect(mocks.uploadFile).toHaveBeenCalledWith(expect.any(Buffer), "wallpapers/20260919/copied.png");
    expect(mocks.uploadJpegThumbnail).toHaveBeenCalled();
    expect(mocks.wallpaperCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 7,
        img_description: "霓虹雨巷",
        model_key: "seedream",
        aspect_ratio_key: "9:16",
        img_path: "wallpapers/20260919/copied.png",
        img_thumbnail_path: "wallpapers/20260919/thumb.jpg",
        media_type: "image",
        status: 1,
        llm_params: expect.objectContaining({
          source: {
            kind: "canvas",
            canvasId: 12,
            nodeId: IMAGE_NODE_ID,
            storageKey: "canvas/night.png",
            nodeType: "image",
          },
        }),
      }),
    });
  });

  it("saves every image when a node has multiple outputs", async () => {
    mocks.generateWorkbenchMediaKeys
      .mockReturnValueOnce({ original: "wallpapers/20260919/a.png", thumbnail: "wallpapers/20260919/a-thumb.jpg" })
      .mockReturnValueOnce({ original: "wallpapers/20260919/b.png", thumbnail: "wallpapers/20260919/b-thumb.jpg" });
    mocks.wallpaperCreate
      .mockResolvedValueOnce({ id: 11 })
      .mockResolvedValueOnce({ id: 12 });
    mocks.nodeFindFirst.mockResolvedValue({
      type: "image",
      current_revision: { config_json: { prompt: "双图" } },
    });
    mocks.stepRunFindFirst.mockResolvedValue({
      output_json: { kind: "image", storageKeys: ["canvas/a.png", "canvas/b.png"] },
      node_revision: { config_json: { prompt: "双图" } },
    });

    const result = await saveCanvasMediaToWorkbench({
      userId: 7,
      canvasId: 12,
      nodeId: IMAGE_NODE_ID,
    });

    expect(result.saved).toBe(2);
    expect(result.ids).toEqual([11, 12]);
    expect(mocks.wallpaperCreate).toHaveBeenCalledTimes(2);
  });

  it("does not insert a duplicate for the same node and storage key", async () => {
    mocks.wallpaperFindFirst.mockResolvedValue({ id: 99 });
    mocks.nodeFindFirst.mockResolvedValue({
      type: "image",
      current_revision: { config_json: { prompt: "霓虹雨巷" } },
    });
    mocks.stepRunFindFirst.mockResolvedValue({
      output_json: { kind: "image", storageKeys: ["canvas/night.png"] },
      node_revision: { config_json: { prompt: "霓虹雨巷" } },
    });

    const result = await saveCanvasMediaToWorkbench({
      userId: 7,
      canvasId: 12,
      nodeId: IMAGE_NODE_ID,
    });

    expect(result).toEqual({ saved: 0, alreadySaved: 1, ids: [99] });
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.wallpaperCreate).not.toHaveBeenCalled();
  });

  it("copies video outputs without generating an image thumbnail", async () => {
    mocks.nodeFindFirst.mockResolvedValue({
      type: "video",
      current_revision: { config_json: { title: "夜巷漫步", prompt: "镜头前推", model: "seedance" } },
    });
    mocks.stepRunFindFirst.mockResolvedValue({
      output_json: { kind: "video", storageKeys: ["canvas/clip.mp4"] },
      node_revision: { config_json: { title: "夜巷漫步", prompt: "镜头前推", model: "seedance" } },
    });

    const result = await saveCanvasMediaToWorkbench({
      userId: 7,
      canvasId: 12,
      nodeId: VIDEO_NODE_ID,
    });

    expect(result.saved).toBe(1);
    expect(mocks.copyOssObject).toHaveBeenCalledWith("canvas/clip.mp4", "wallpapers/20260919/copied.mp4");
    expect(mocks.uploadJpegThumbnail).not.toHaveBeenCalled();
    expect(mocks.wallpaperCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        media_type: "video",
        status: 1,
        img_path: "wallpapers/20260919/copied.mp4",
        img_description: "镜头前推",
      }),
    });
  });

  it("copies audio outputs as audio works", async () => {
    mocks.nodeFindFirst.mockResolvedValue({
      type: "audio",
      current_revision: { config_json: { title: "夜行" } },
    });
    mocks.stepRunFindFirst.mockResolvedValue({
      output_json: { kind: "audio", storageKeys: ["canvas/song.mp3"], meta: { title: "夜行" } },
      node_revision: { config_json: { title: "夜行" } },
    });

    const result = await saveCanvasMediaToWorkbench({
      userId: 7,
      canvasId: 12,
      nodeId: AUDIO_NODE_ID,
    });

    expect(result.saved).toBe(1);
    expect(mocks.copyOssObject).toHaveBeenCalledWith("canvas/song.mp3", "wallpapers/20260919/copied.mp3");
    expect(mocks.wallpaperCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        media_type: "audio",
        img_description: "夜行",
      }),
    });
  });

  it("saves an upload node from its current storage key", async () => {
    mocks.nodeFindFirst.mockResolvedValue({
      type: "upload",
      current_revision: {
        config_json: { storageKey: "canvas/uploads/ref.jpg", mediaType: "image", fileName: "ref.jpg" },
      },
    });
    mocks.stepRunFindFirst.mockResolvedValue(null);

    await saveCanvasMediaToWorkbench({
      userId: 7,
      canvasId: 12,
      nodeId: UPLOAD_NODE_ID,
    });

    expect(mocks.getOssObjectBuffer).toHaveBeenCalledWith("canvas/uploads/ref.jpg");
    expect(mocks.wallpaperCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        media_type: "image",
        img_description: "ref.jpg",
      }),
    });
  });

  it("rejects nodes that are not image, video, or audio media", async () => {
    mocks.nodeFindFirst.mockResolvedValue({
      type: "text",
      current_revision: { config_json: { text: "hello" } },
    });
    mocks.stepRunFindFirst.mockResolvedValue(null);

    await expect(
      saveCanvasMediaToWorkbench({ userId: 7, canvasId: 12, nodeId: TEXT_NODE_ID })
    ).rejects.toMatchObject({ code: "unsupported" } satisfies Partial<CanvasWorkbenchError>);
    expect(mocks.wallpaperCreate).not.toHaveBeenCalled();
  });

  it("rejects media nodes that have no file yet", async () => {
    mocks.nodeFindFirst.mockResolvedValue({
      type: "image",
      current_revision: { config_json: { prompt: "还没生成" } },
    });
    mocks.stepRunFindFirst.mockResolvedValue(null);

    await expect(
      saveCanvasMediaToWorkbench({ userId: 7, canvasId: 12, nodeId: IMAGE_NODE_ID })
    ).rejects.toMatchObject({ code: "no_media" });
  });
});
