import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasNodeDTO } from "@/types/canvas";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mocks = vi.hoisted(() => ({
  prepareCanvasDownload: vi.fn(),
  downloadItems: [] as Array<() => Promise<void>>,
}));

const state = {
  canvasId: 12,
  duplicateNode: vi.fn(),
  deleteNode: vi.fn(),
  openMediaPreview: vi.fn(),
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/store/useCanvasStore", () => ({
  useCanvasStore: (selector: (value: typeof state) => unknown) => selector(state),
}));
vi.mock("@/services/api", () => ({
  prepareCanvasDownload: mocks.prepareCanvasDownload,
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, asChild: _asChild, ...props }: React.PropsWithChildren<any>) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
  }: React.PropsWithChildren<{ onSelect: () => Promise<void> }>) => {
    mocks.downloadItems.push(onSelect);
    return <div>{children}</div>;
  },
}));

import { NodeActionToolbar } from "./NodeActionToolbar";

const audioNode: CanvasNodeDTO = {
  id: "audio-1",
  type: "audio",
  x: 0,
  y: 0,
  status: "succeeded",
  config: { title: "夜行" },
  output: {
    kind: "audio",
    urls: ["https://oss.test/song.mp3"],
    storageKeys: ["canvas/song.mp3"],
    meta: { lyrics: "灯火沿着河流" },
  },
};

describe("NodeActionToolbar downloads", () => {
  beforeEach(() => {
    mocks.downloadItems.length = 0;
    mocks.prepareCanvasDownload.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows original and lyric download choices in the node action toolbar", () => {
    const html = renderToStaticMarkup(<NodeActionToolbar node={audioNode} />);

    expect(html).toContain("downloadOriginal");
    expect(html).toContain("downloadLyricsMp3");
    expect(html).toContain("downloadSongPackage");
  });

  it("starts the prepared download in an isolated iframe", async () => {
    mocks.prepareCanvasDownload.mockResolvedValue("https://oss.test/song.mp3");
    const frame = {
      id: "",
      title: "",
      src: "",
      tabIndex: 0,
      style: {},
      setAttribute: vi.fn(),
    };
    const document = {
      body: { appendChild: vi.fn() },
      createElement: vi.fn().mockReturnValue(frame),
      getElementById: vi.fn().mockReturnValue(null),
    };
    vi.stubGlobal("document", document);
    renderToStaticMarkup(<NodeActionToolbar node={audioNode} />);

    await mocks.downloadItems[0]();

    expect(document.createElement).toHaveBeenCalledWith("iframe");
    expect(frame.src).toBe("https://oss.test/song.mp3");
  });
});
