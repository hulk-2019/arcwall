export interface Dictionary {
  id?: number;
  category: string;
  key: string;
  label_en?: string;
  label_zh?: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type DictionaryCategory = 'model' | 'aspect_ratio';
