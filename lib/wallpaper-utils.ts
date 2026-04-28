import { Wallpaper } from "@/types/wallpaper";
import { getSignedUrl } from "@/lib/oss";

/**
 * Generate signed URLs for wallpaper images
 * @param wallpaper Wallpaper object with img_path, img_thumbnail_path, and img_watermark_path
 * @returns Wallpaper object with img_url, img_thumbnail_url, and img_watermark_url populated
 */
export async function addSignedUrlsToWallpaper(wallpaper: Wallpaper): Promise<Wallpaper> {
  const result = { ...wallpaper };

  // Generate signed URLs in parallel
  const urlPromises: Promise<void>[] = [];

  if (wallpaper.img_path) {
    urlPromises.push(
      getSignedUrl(wallpaper.img_path, 86400)
        .then(url => { result.img_url = url; })
        .catch(e => {
          console.log(`Failed to generate signed URL for ${wallpaper.img_path}:`, e);
          result.img_url = '';
        })
    );
  }

  if (wallpaper.img_thumbnail_path) {
    urlPromises.push(
      getSignedUrl(wallpaper.img_thumbnail_path, 86400)
        .then(url => { result.img_thumbnail_url = url; })
        .catch(e => {
          console.log(`Failed to generate signed URL for ${wallpaper.img_thumbnail_path}:`, e);
          result.img_thumbnail_url = '';
        })
    );
  }

  if (wallpaper.img_watermark_path) {
    urlPromises.push(
      getSignedUrl(wallpaper.img_watermark_path, 86400)
        .then(url => { result.img_watermark_url = url; })
        .catch(e => {
          console.log(`Failed to generate signed URL for ${wallpaper.img_watermark_path}:`, e);
          result.img_watermark_url = '';
        })
    );
  }

  await Promise.all(urlPromises);

  return result;
}

/**
 * Generate signed URLs for multiple wallpapers
 * @param wallpapers Array of wallpaper objects
 * @returns Array of wallpaper objects with signed URLs
 */
export async function addSignedUrlsToWallpapers(wallpapers: Wallpaper[]): Promise<Wallpaper[]> {
  return Promise.all(wallpapers.map(addSignedUrlsToWallpaper));
}

/**
 * Generate only thumbnail URL for wallpaper (for list views)
 * @param wallpaper Wallpaper object with img_thumbnail_path
 * @returns Wallpaper object with img_thumbnail_url populated
 */
export async function addThumbnailUrlToWallpaper(wallpaper: Wallpaper): Promise<Wallpaper> {
  const result = { ...wallpaper };

  if (wallpaper.img_thumbnail_path) {
    try {
      result.img_thumbnail_url = await getSignedUrl(wallpaper.img_thumbnail_path, 86400); // 24 hours
    } catch (e) {
      console.log(`Failed to generate signed URL for ${wallpaper.img_thumbnail_path}:`, e);
      result.img_thumbnail_url = '';
    }
  }

  return result;
}

/**
 * Generate only thumbnail URLs for multiple wallpapers (for list views)
 * @param wallpapers Array of wallpaper objects
 * @returns Array of wallpaper objects with img_thumbnail_url populated
 */
export async function addThumbnailUrlsToWallpapers(wallpapers: Wallpaper[]): Promise<Wallpaper[]> {
  return Promise.all(wallpapers.map(addThumbnailUrlToWallpaper));
}

