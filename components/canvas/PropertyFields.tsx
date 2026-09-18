"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Upload as UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { uploadCanvasAsset } from "@/services/api";
import {
  ASPECT_RATIOS,
  AUDIO_MODES,
  AUDIO_STYLE_PRESETS,
  AUDIO_VOCALS,
  UPLOAD_ACCEPT,
  UPLOAD_MIME_TYPES,
  UPLOAD_SIZE_LIMITS,
  VIDEO_RESOLUTIONS,
  modelOptionsForType,
  modelSupportsResolution,
} from "@/lib/canvas/registry";
import { useModelOptions } from "./hooks/useModelOptions";
import type { CanvasNodeConfig, CanvasNodeType } from "@/types/canvas";
import { cn } from "@/lib/utils";
import { FieldLabel, ParamLabel, ParamSelect } from "./Field";

const LAYOUTS = ["grid3", "grid6", "grid9", "grid12"] as const;
const VIDEO_DURATIONS = [3, 4, 5, 6, 7, 8, 9, 10];

interface PropertyFieldsProps {
  type: CanvasNodeType;
  config: CanvasNodeConfig;
  previewUrl?: string;
  hasVideoFirstFrame?: boolean;
  onPatch: (patch: Partial<CanvasNodeConfig>) => void;
  onDiscrete: (patch: Partial<CanvasNodeConfig>) => void;
  onBeginEdit: () => void;
  labels: PropertyLabels;
}

interface PropertyLabels {
  titleLabel: string;
  model: string;
  mode: string;
  vocal: string;
  modeCustom: string;
  modeAuto: string;
  modeInstrumental: string;
  style: string;
  styles: Record<string, string>;
  vocalMale: string;
  vocalFemale: string;
  aspectRatio: string;
  count: string;
  layout: string;
  visualLock: string;
  videoMode: string;
  videoModeText: string;
  videoModeImage: string;
  duration: string;
  resolution: string;
  uploadFile: string;
  uploading: string;
  uploadSuccess: string;
  uploadFailed: string;
  uploadTypeInvalid: string;
  uploadTooLarge: string;
  noFile: string;
  layouts: Record<string, string>;
}

function parseVisualLock(value: string) {
  const lock: Record<string, string> = {};
  for (const line of value.split("\n").filter((item) => item.trim())) {
    const idx = line.indexOf(":");
    if (idx > 0) lock[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return lock;
}

/** 横向网格中的枚举参数：value → 文案映射 */
function ParamEnumField({
  label,
  value,
  options,
  onChange,
  className,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <ParamLabel>{label}</ParamLabel>
      <ParamSelect
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </ParamSelect>
    </div>
  );
}

/**
 * 节点参数字段（在选中浮框中渲染，横向网格布局）：
 * 主提示词/文本编辑由 NodeDock 提供，这里只承载标题 + 各类型生成参数 + 上传管理。
 */
export function PropertyFields({
  type,
  config,
  previewUrl,
  hasVideoFirstFrame = false,
  onPatch,
  onDiscrete,
  onBeginEdit,
  labels,
}: PropertyFieldsProps) {
  const t = useTranslations("canvas");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  // 模型选项：字典表优先（canvas_model 分类 + type 列），未加载时回退 registry 内置列表
  const modelType = type === "video" ? "video" : type === "audio" ? "audio" : "image";
  const dictModels = useModelOptions(modelType);
  const modelOptions =
    dictModels.length > 0
      ? dictModels
      : modelOptionsForType(modelType).map((v) => ({ value: v, label: v }));

  const handleUpload = async (file: File) => {
    // 客户端校验（与服务端共用 registry 中的白名单与限制）
    const allowed = UPLOAD_MIME_TYPES[file.type];
    if (!allowed) {
      toast.error(t("uploadTypeInvalid"));
      return;
    }
    if (file.size > UPLOAD_SIZE_LIMITS[allowed.kind]) {
      toast.error(t("uploadTooLarge"));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res: any = await uploadCanvasAsset(formData);
      if (res.code === 0 && res.data?.storageKey) {
        onDiscrete({
          storageKey: res.data.storageKey,
          fileName: res.data.fileName || file.name,
          mediaType: res.data.mediaType || allowed.kind,
        });
        toast.success(t("uploadSuccess"));
      } else {
        toast.error(res.message || t("uploadFailed"));
      }
    } catch (error: any) {
      toast.error(error?.message || t("uploadFailed"));
    }
    setUploading(false);
  };

  return (
    <div className="mb-1">
      <FieldLabel>{labels.titleLabel}</FieldLabel>
      <Input
        className="mt-1 h-8 text-xs"
        value={config.title || ""}
        onFocus={onBeginEdit}
        onChange={(event) => onPatch({ title: event.target.value })}
      />

      {type === "image" && (
        <div className="mt-2 flex items-end gap-2">
          <ParamEnumField
            label={labels.model}
            className="min-w-0 flex-1"
            value={config.model || modelOptions[0]?.value || ""}
            options={modelOptions}
            onChange={(v) => onDiscrete({ model: v })}
          />
          <ParamEnumField
            label={labels.aspectRatio}
            className="w-20"
            value={config.aspectRatio || "16:9"}
            options={ASPECT_RATIOS.map((r) => ({ value: r, label: r }))}
            onChange={(v) => onDiscrete({ aspectRatio: v })}
          />
          {modelSupportsResolution(config.model || modelOptions[0]?.value || "") && (
            <ParamEnumField
              label={labels.resolution}
              className="w-16"
              value={config.resolution === "2k" ? "2k" : "1k"}
              options={[
                { value: "1k", label: "1K" },
                { value: "2k", label: "2K" },
              ]}
              onChange={(v) => onDiscrete({ resolution: v })}
            />
          )}
        </div>
      )}

      {type === "video" && (
        <div className="mt-2 flex items-end gap-2">
          <ParamEnumField
            label={labels.model}
            className="min-w-0 flex-1"
            value={config.model || modelOptions[0]?.value || ""}
            options={modelOptions}
            onChange={(v) => onDiscrete({ model: v })}
          />
          <ParamEnumField
            label={labels.videoMode}
            className="w-[72px]"
            value={hasVideoFirstFrame ? "image" : config.videoMode || "text"}
            options={[
              { value: "text", label: labels.videoModeText },
              { value: "image", label: labels.videoModeImage },
            ]}
            disabled={hasVideoFirstFrame}
            onChange={(v) => onDiscrete({ videoMode: v as "text" | "image" })}
          />
          <ParamEnumField
            label={labels.duration}
            className="w-14"
            value={String(config.duration || 5)}
            options={VIDEO_DURATIONS.map((d) => ({ value: String(d), label: `${d}s` }))}
            onChange={(v) => onDiscrete({ duration: Number(v) })}
          />
          <ParamEnumField
            label={labels.aspectRatio}
            className="w-[68px]"
            value={config.aspectRatio || "16:9"}
            options={ASPECT_RATIOS.map((r) => ({ value: r, label: r }))}
            onChange={(v) => onDiscrete({ aspectRatio: v })}
          />
          <ParamEnumField
            label={labels.resolution}
            className="w-[72px]"
            value={config.resolution || "1080p"}
            options={VIDEO_RESOLUTIONS.map((r) => ({ value: r, label: r }))}
            onChange={(v) => onDiscrete({ resolution: v })}
          />
        </div>
      )}

      {type === "audio" && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <ParamEnumField
            label={labels.model}
            className="min-w-0 flex-1"
            value={config.model || modelOptions[0]?.value || ""}
            options={modelOptions}
            onChange={(v) => onDiscrete({ model: v })}
          />
          <ParamEnumField
            label={labels.mode}
            className="w-[96px]"
            value={config.mode || "auto"}
            options={AUDIO_MODES.map((m) => ({
              value: m,
              label:
                m === "custom"
                  ? labels.modeCustom
                  : m === "instrumental"
                    ? labels.modeInstrumental
                    : labels.modeAuto,
            }))}
            onChange={(v) => onDiscrete({ mode: v as "custom" | "auto" | "instrumental" })}
          />
          <ParamEnumField
            label={labels.style}
            className="w-[82px]"
            value={config.style || "pop"}
            options={AUDIO_STYLE_PRESETS.map((style) => ({
              value: style.value,
              label: labels.styles[style.value] || style.name,
            }))}
            onChange={(v) => onDiscrete({ style: v as CanvasNodeConfig["style"] })}
          />
          {(config.mode || "auto") !== "instrumental" && (
            <ParamEnumField
              label={labels.vocal}
              className="w-[68px]"
              value={config.vocal === "male" ? "male" : "female"}
              options={AUDIO_VOCALS.map((v) => ({
                value: v,
                label: v === "male" ? labels.vocalMale : labels.vocalFemale,
              }))}
              onChange={(v) => onDiscrete({ vocal: v as "male" | "female" })}
            />
          )}
        </div>
      )}

      {type === "storyboard" && (
        <div className="mt-2 flex flex-col gap-2">
          <ParamEnumField
            label={labels.layout}
            className="w-28"
            value={config.layout || "grid9"}
            options={LAYOUTS.map((layout) => ({
              value: layout,
              label: labels.layouts[layout] || layout,
            }))}
            onChange={(v) => onDiscrete({ layout: v })}
          />
          <div className="min-w-0">
            <ParamLabel>{labels.visualLock}</ParamLabel>
            <Textarea
              className="mt-1 min-h-[56px] resize-none font-mono text-[11px]"
              placeholder={labels.visualLock}
              defaultValue={
                config.visualLock
                  ? Object.entries(config.visualLock)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join("\n")
                  : ""
              }
              onFocus={onBeginEdit}
              onBlur={(event) => onPatch({ visualLock: parseVisualLock(event.target.value) })}
            />
          </div>
        </div>
      )}

      {type === "upload" && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 w-full justify-start gap-2 text-xs"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <UploadIcon className="h-3.5 w-3.5" aria-hidden />
            )}
            <span className="truncate">
              {uploading ? labels.uploading : config.fileName || labels.uploadFile}
            </span>
          </Button>
          {previewUrl ? null : (
            <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
              {config.fileName || labels.noFile}
            </p>
          )}
        </>
      )}
    </div>
  );
}
