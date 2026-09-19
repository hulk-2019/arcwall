import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Wallpaper } from "@/types/wallpaper";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/components/ui/image-with-placeholder", () => ({
  ImageWithPlaceholder: (props: { src: string; alt: string }) => (
    <img src={props.src} alt={props.alt} />
  ),
}));
vi.mock("@/components/ui/loading", () => ({ Loading: () => <div>loading</div> }));

import { WallpaperPreviewDialog } from "./wallpaper-preview-dialog";

const wallpaper: Wallpaper = {
  img_description: "夜巷漫步",
  model_name: "seedance",
  created_at: "",
  status: 1,
};

describe("WallpaperPreviewDialog media types", () => {
  it("plays video works in the preview pane", () => {
    const html = renderToStaticMarkup(
      <WallpaperPreviewDialog
        wallpaper={{ ...wallpaper, media_type: "video" }}
        imageUrl="https://oss.test/clip.mp4"
        onClose={() => {}}
        promptLabel="提示词"
      />
    );
    expect(html).toContain("<video");
    expect(html).toContain("https://oss.test/clip.mp4");
  });

  it("plays audio works in the preview pane", () => {
    const html = renderToStaticMarkup(
      <WallpaperPreviewDialog
        wallpaper={{ ...wallpaper, media_type: "audio" }}
        imageUrl="https://oss.test/song.mp3"
        onClose={() => {}}
        promptLabel="提示词"
      />
    );
    expect(html).toContain("<audio");
    expect(html).toContain("https://oss.test/song.mp3");
    expect(html).toContain("data-audio-disc-player");
    expect(html).toContain("data-film-disc");
  });
});
