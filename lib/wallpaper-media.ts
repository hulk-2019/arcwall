export type WorkbenchMediaType = "image" | "video" | "audio";

export function wallpaperMediaType(wallpaper: {
  media_type?: string | null;
}): WorkbenchMediaType {
  return wallpaper.media_type === "video" || wallpaper.media_type === "audio"
    ? wallpaper.media_type
    : "image";
}

export function isPublishableWallpaper(wallpaper: {
  media_type?: string | null;
  status?: number;
  is_public?: boolean;
}): boolean {
  return wallpaper.status === 1 && !wallpaper.is_public;
}
