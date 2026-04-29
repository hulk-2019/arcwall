import { z } from "zod";

// --- Public API schemas ---

export const DictionariesSchema = z.object({
  categories: z
    .array(z.enum(["model", "aspect_ratio"]))
    .min(1),
});

export const GetWallpapersSchema = z.object({
  tab: z.string().optional(),
});

export const SignedUrlSchema = z.object({
  paths: z.array(z.string()).min(1),
});

// --- Protected API schemas ---

export const GenWallpaperSchema = z.object({
  description: z.string().min(1),
  aspectRatio: z.string().optional(),
  model: z.string().optional(),
  language: z.enum(["en", "zh", "EN"]).optional(),
  imgUrl: z.string().url().optional(),
  imgPath: z.array(z.string()).optional(),
});

export const OptimizePromptSchema = z.object({
  prompt: z.string().min(1),
  language: z.enum(["en", "zh", "EN"]).optional(),
});

export const MyWorksSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  type: z.string().optional(),
  keyword: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortByLikes: z.enum(["asc", "desc"]).optional(),
});

export const DeleteWorkSchema = z.object({
  id: z.number().int().positive(),
});

export const BatchDeleteWorksSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

export const FavoriteSchema = z.object({
  wallpaperId: z.union([z.number().int().positive(), z.string().min(1)]),
});

export const BatchUnfavoriteSchema = z.object({
  wallpaperIds: z.array(z.number().int().positive()).min(1),
});

export const PublishWallpaperSchema = z
  .object({
    wallpaperId: z.number().int().positive().optional(),
    wallpaperIds: z.array(z.number().int().positive()).optional(),
  })
  .refine((d) => d.wallpaperId || (d.wallpaperIds && d.wallpaperIds.length > 0), {
    message: "wallpaperId or wallpaperIds is required",
  });

export const UnpublishWallpaperSchema = z
  .object({
    wallpaperId: z.number().int().positive().optional(),
    wallpaperIds: z.array(z.number().int().positive()).optional(),
    systemWallpaperId: z.number().int().positive().optional(),
    systemWallpaperIds: z.array(z.number().int().positive()).optional(),
  })
  .refine(
    (d) =>
      d.wallpaperId ||
      (d.wallpaperIds && d.wallpaperIds.length > 0) ||
      d.systemWallpaperId ||
      (d.systemWallpaperIds && d.systemWallpaperIds.length > 0),
    { message: "at least one wallpaper id is required" }
  );

export const WallpaperUrlsSchema = z
  .object({
    wallpaperId: z.number().int().positive().optional(),
    systemWallpaperId: z.number().int().positive().optional(),
    type: z.enum(["download", "preview"]),
  })
  .refine((d) => d.wallpaperId || d.systemWallpaperId, {
    message: "wallpaperId or systemWallpaperId is required",
  });

export const TrashItemSchema = z.object({
  id: z.number().int().positive(),
});

export const RedeemCodeSchema = z.object({
  code: z.string().min(1),
});

export const CheckoutSchema = z.object({
  credits: z.number().positive(),
  amount: z.number().positive(),
  plan: z.enum(["monthly", "one-time"]),
});

export const TransactionsQuerySchema = z.object({
  type: z.enum(["consume", "recharge"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const TaskStatusQuerySchema = z.object({
  id: z.string().min(1),
});
