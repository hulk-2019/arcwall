"use client";

import { useEffect, useState } from "react";
import { getCanvasModels } from "@/services/api";

export interface ModelOption {
  value: string;
  label: string;
}

/** 字典表模型选项的会话级缓存（canvas_model 分类，type 区分节点类型） */
const cache = new Map<string, ModelOption[]>();
const pending = new Set<string>();

/**
 * 从字典表加载节点可选模型（{ value: 模型 ID, label: 展示名 }）。
 * 加载中/失败时返回空数组，调用方回退到 registry 内置列表。
 */
export function useModelOptions(type: "image" | "video" | "audio"): ModelOption[] {
  const [options, setOptions] = useState<ModelOption[]>(() => cache.get(type) ?? []);

  useEffect(() => {
    if (cache.has(type) || pending.has(type)) return;
    pending.add(type);
    let alive = true;
    (async () => {
      try {
        const res: any = await getCanvasModels(type);
        if (res.code === 0 && Array.isArray(res.data) && res.data.length > 0) {
          const list: ModelOption[] = res.data.map((d: any) => ({
            value: d.key,
            label: d.label_zh || d.label_en || d.key,
          }));
          cache.set(type, list);
          if (alive) setOptions(list);
        }
      } catch {
        // 静默失败：调用方使用 registry 回退列表
      } finally {
        pending.delete(type);
      }
    })();
    return () => {
      alive = false;
    };
  }, [type]);

  return options;
}
