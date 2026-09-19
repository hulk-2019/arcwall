import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Wallpaper } from "@/types/wallpaper";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<any>) => <button {...props}>{children}</button>,
}));
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  PopoverContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  PopoverTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
vi.mock("@/components/ui/loading", () => ({ Loading: () => <div>loading</div> }));
vi.mock("@/components/ui/image-with-placeholder", () => ({
  ImageWithPlaceholder: (props: { src: string; alt: string }) => (
    <img src={props.src} alt={props.alt} />
  ),
}));
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AvatarFallback: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AvatarImage: () => null,
}));

import { WallpaperCard } from "./wallpaper-card";

const copy = {
  card: { preview: "preview", download: "download", edit: "edit", delete: "delete", unpublish: "unpublish" },
};

function renderCard(wallpaper: Partial<Wallpaper>) {
  return renderToStaticMarkup(
    <WallpaperCard
      wallpaper={{
        img_description: "夜巷",
        model_name: "",
        created_at: "",
        status: 1,
        ...wallpaper,
      }}
      activeTab="creations"
      copy={copy}
      user={{ id: 7 }}
      selectedIds={[]}
      toggleSelect={() => {}}
      handlePreview={() => {}}
      handleRetry={() => {}}
      handleDelete={() => {}}
      handleEdit={() => {}}
      handleUnfavorite={() => {}}
      handleDownload={() => {}}
      handleUnpublish={() => {}}
      handlePublishClick={() => {}}
    />
  );
}

describe("WallpaperCard media types", () => {
  it("renders a video element for video works", () => {
    const html = renderCard({
      media_type: "video",
      img_url: "https://oss.test/clip.mp4",
    });
    expect(html).toContain("<video");
    expect(html).toContain("https://oss.test/clip.mp4");
    expect(html).toContain("publishToHomepage");
  });

  it("renders an audio placeholder for audio works", () => {
    const html = renderCard({ media_type: "audio" });
    expect(html).toContain("audioWork");
    expect(html).toContain("data-film-disc");
    expect(html).toContain("bg-black");
    expect(html).toContain("publishToHomepage");
  });

  it("keeps homepage publish for images", () => {
    const html = renderCard({ media_type: "image", img_thumbnail_url: "https://oss.test/thumb.jpg" });
    expect(html).toContain("publishToHomepage");
  });
});
