import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const state = {
  canvasId: 12,
  mediaPreview: {
    kind: "audio" as const,
    urls: ["https://oss.test/song.mp3"],
    index: 0,
    nodeId: "audio-1",
    title: "夜行",
    lyrics: "灯火沿着河流\n晚风轻轻吹",
    timedWords: [
      { text: "灯火沿着河流\n", startMs: 500, endMs: 2200 },
      { text: "晚风轻轻吹\n", startMs: 3000, endMs: 4400 },
    ],
  },
  closeMediaPreview: vi.fn(),
  cycleMediaPreview: vi.fn(),
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/store/useCanvasStore", () => ({
  useCanvasStore: (selector: (value: typeof state) => unknown) => selector(state),
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

import { MediaPreviewDialog } from "./MediaPreviewDialog";

describe("MediaPreviewDialog audio lyrics", () => {
  it("renders timed lyrics without duplicating node-toolbar download actions", () => {
    const html = renderToStaticMarkup(<MediaPreviewDialog />);

    expect(html).toContain("灯火沿着河流");
    expect(html).toContain("晚风轻轻吹");
    expect(html).toContain("data-audio-disc-player");
    expect(html).toContain("data-film-disc");
    expect(html).toContain("bg-red-950");
    expect(html).not.toContain("bg-muted/30");
    expect(html).not.toContain("downloadOriginal");
    expect(html).not.toContain("downloadLyricsMp3");
    expect(html).not.toContain("downloadSongPackage");
  });
});
