import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/store/useAppStore", () => ({
  useAppStore: () => ({ user: { id: 7 } }),
}));
vi.mock("@/store/useDesignStore", () => ({
  useDesignStore: () => ({
    setPrompt: vi.fn(),
    setModel: vi.fn(),
    setAspectRatio: vi.fn(),
    setResolution: vi.fn(),
    setImgPath: vi.fn(),
    setImgUrl: vi.fn(),
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/components/ui/image-with-placeholder", () => ({
  ImageWithPlaceholder: (props: { src: string; alt: string }) => (
    <img src={props.src} alt={props.alt} />
  ),
}));
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => <div /> }));
vi.mock("@/components/ui/wallpaper-preview-dialog", () => ({
  WallpaperPreviewDialog: () => null,
}));

import WallpapersGrid from "./index";

describe("WallpapersGrid media types", () => {
  it("renders published video works as playable video", () => {
    const html = renderToStaticMarkup(
      <WallpapersGrid
        loading={false}
        wallpapers={[
          {
            id: 8,
            img_description: "夜巷",
            model_name: "seedance",
            created_at: "",
            media_type: "video",
            img_url: "https://oss.test/clip.mp4",
          },
        ]}
      />
    );
    expect(html).toContain("<video");
    expect(html).toContain("https://oss.test/clip.mp4");
  });
});
