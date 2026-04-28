import { User } from "./user";

export interface Wallpaper {
  id?: number;
  user_id?: number;
  img_description: string;
  img_size?: string;
  img_url?: string;
  img_path?: string;
  img_thumbnail_url?: string;
  aspect_ratio_name?: string;
  model_key?: string;
  aspect_ratio_key?: string;
  img_thumbnail_path?: string;
  img_watermark_path?: string;
  img_watermark_url?: string;
  img_download_url?: string;
  created_at: string;
  deleted_at?: string;
  is_permanently_delete?: boolean;
  model_name: string;
  llm_params?: any;
  created_user?: User;
  status?: number;
  failure_reason?: string;
  is_favorite?: boolean;
  likes_count?: number;
  is_public?: boolean;
}
