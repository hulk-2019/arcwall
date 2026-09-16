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
  VIDEO_RESOLUTIONS,
  UPLOAD_ACCEPT,
  UPLOAD_MIME_TYPES,
  UPLOAD_SIZE_LIMITS,
} from "@/lib/canvas/registry";
import type { CanvasNodeConfig, CanvasNodeType } from "@/types/canvas";
import { FieldLabel, FieldSelect } from "./Field";

const LAYOUTS = ["grid3", "grid6", "grid9", "grid12"] as const;

interface PropertyFieldsProps {
  type: CanvasNodeType;
  config: CanvasNodeConfig;
  previewUrl?: string;
  onPatch: (patch: Partial<CanvasNodeConfig>) => void;
  onDiscrete: (patch: Partial<CanvasNodeConfig>) => void;
  onBeginEdit: () => void;
  labels: {
    titleLabel: string;
    text: string;
    prompt: string;
    brief: string;
    aspectRatio: string;
    count: string;
    layout: string;
    visualLock: string;
    videoMode: string;
    videoModeText: string;
    videoModeImage: string;
    duration: string;
    resolution: string;
    voice: string;
    speed: string;
    uploadFile: string;
    uploading: string;
    uploadSuccess: string;
    uploadFailed: string;
    uploadTypeInvalid: string;
    uploadTooLarge: string;
    noFile: string;
    layouts: Record<string, string>;
  };
}

function visualLockText(lock?: Record<string, string>) {
  if (!lock) return "";
  return Object.entries(lock)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function parseVisualLock(value: string) {
  const lock: Record<string, string> = {};
  for (const line of value.split("\n").filter((item) => item.trim())) {
    const idx = line.indexOf(":");
    if (idx > 0) lock[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return lock;
}

export function PropertyFields({
  type,
  config,
  previewUrl,
  onPatch,
  onDiscrete,
  onBeginEdit,
  labels,
}: PropertyFieldsProps) {
  const t = useTranslations("canvas");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

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
    <div>
      <FieldLabel>{labels.titleLabel}</FieldLabel>
      <Input
        className="mt-1.5"
        value={config.title || ""}
        onFocus={onBeginEdit}
        onChange={(event) => onPatch({ title: event.target.value })}
      />

      {type === "text" && (
        <>
          <FieldLabel>{labels.text}</FieldLabel>
          <Textarea
            className="mt-1.5 min-h-[160px] resize-none"
            value={config.text || ""}
            onFocus={onBeginEdit}
            onChange={(event) => onPatch({ text: event.target.value })}
          />
        </>
      )}

      {type === "upload" && (
        <>
          <FieldLabel>{labels.uploadFile}</FieldLabel>
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
            className="mt-1.5 w-full justify-start gap-2"
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
          {previewUrl && config.mediaType === "video" ? (
            <video
              src={previewUrl}
              controls
              className="mt-2 h-36 w-full rounded-md border border-border object-cover"
            />
          ) : previewUrl && config.mediaType === "audio" ? (
            <audio src={previewUrl} controls className="mt-2 h-10 w-full" />
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className="mt-2 h-32 w-full rounded-md border border-border object-cover"
            />
          ) : config.fileName ? (
            <p className="mt-1.5 truncate text-xs text-muted-foreground">{config.fileName}</p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">{labels.noFile}</p>
          )}
        </>
      )}

      {type === "audio" && (
        <>
          <FieldLabel>{labels.text}</FieldLabel>
          <Textarea
            className="mt-1.5 min-h-[120px] resize-none"
            value={config.text || ""}
            onFocus={onBeginEdit}
            onChange={(event) => onPatch({ text: event.target.value })}
          />
          <FieldLabel>{labels.voice}</FieldLabel>
          <Input
            className="mt-1.5"
            value={config.voice || ""}
            onFocus={onBeginEdit}
            onChange={(event) => onPatch({ voice: event.target.value })}
          />
          <FieldLabel>{labels.speed}</FieldLabel>
          <Input
            type="number"
            min={0.5}
            max={2}
            step={0.1}
            className="mt-1.5"
            value={config.speed ?? 1}
            onChange={(event) =>
              onDiscrete({
                speed: Math.max(0.5, Math.min(2, Number(event.target.value) || 1)),
              })
            }
          />
        </>
      )}

      {type === "image" && (
        <>
          <FieldLabel>{labels.prompt}</FieldLabel>
          <Textarea
            className="mt-1.5 min-h-[120px] resize-none"
            value={config.prompt || ""}
            onFocus={onBeginEdit}
            onChange={(event) => onPatch({ prompt: event.target.value })}
          />
          <FieldLabel>{labels.aspectRatio}</FieldLabel>
          <FieldSelect
            value={config.aspectRatio || "16:9"}
            onChange={(event) => onDiscrete({ aspectRatio: event.target.value })}
          >
            {ASPECT_RATIOS.map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio}
              </option>
            ))}
          </FieldSelect>
          <FieldLabel>{labels.count}</FieldLabel>
          <Input
            type="number"
            min={1}
            max={4}
            className="mt-1.5"
            value={config.count || 1}
            onChange={(event) =>
              onDiscrete({ count: Math.max(1, Math.min(4, Number(event.target.value) || 1)) })
            }
          />
        </>
      )}

      {type === "storyboard" && (
        <>
          <FieldLabel>{labels.brief}</FieldLabel>
          <Textarea
            className="mt-1.5 min-h-[112px] resize-none"
            value={config.brief || ""}
            onFocus={onBeginEdit}
            onChange={(event) => onPatch({ brief: event.target.value })}
          />
          <FieldLabel>{labels.layout}</FieldLabel>
          <FieldSelect
            value={config.layout || "grid9"}
            onChange={(event) => onDiscrete({ layout: event.target.value })}
          >
            {LAYOUTS.map((layout) => (
              <option key={layout} value={layout}>
                {labels.layouts[layout] || layout}
              </option>
            ))}
          </FieldSelect>
          <FieldLabel>{labels.visualLock}</FieldLabel>
          <Textarea
            className="mt-1.5 min-h-[96px] resize-none font-mono text-xs"
            placeholder={labels.visualLock}
            defaultValue={visualLockText(config.visualLock)}
            onFocus={onBeginEdit}
            onBlur={(event) => onPatch({ visualLock: parseVisualLock(event.target.value) })}
          />
        </>
      )}

      {type === "video" && (
        <>
          <FieldLabel>{labels.prompt}</FieldLabel>
          <Textarea
            className="mt-1.5 min-h-[112px] resize-none"
            value={config.prompt || ""}
            onFocus={onBeginEdit}
            onChange={(event) => onPatch({ prompt: event.target.value })}
          />
          <FieldLabel>{labels.videoMode}</FieldLabel>
          <FieldSelect
            value={config.videoMode || "text"}
            onChange={(event) =>
              onDiscrete({ videoMode: event.target.value as "text" | "image" })
            }
          >
            <option value="text">{labels.videoModeText}</option>
            <option value="image">{labels.videoModeImage}</option>
          </FieldSelect>
          <FieldLabel>{labels.duration}</FieldLabel>
          <Input
            type="number"
            min={3}
            max={10}
            className="mt-1.5"
            value={config.duration || 5}
            onChange={(event) =>
              onDiscrete({ duration: Math.max(3, Math.min(10, Number(event.target.value) || 5)) })
            }
          />
          <FieldLabel>{labels.resolution}</FieldLabel>
          <FieldSelect
            value={config.resolution || "1080p"}
            onChange={(event) => onDiscrete({ resolution: event.target.value })}
          >
            {VIDEO_RESOLUTIONS.map((resolution) => (
              <option key={resolution} value={resolution}>
                {resolution}
              </option>
            ))}
          </FieldSelect>
          <FieldLabel>{labels.aspectRatio}</FieldLabel>
          <FieldSelect
            value={config.aspectRatio || "16:9"}
            onChange={(event) => onDiscrete({ aspectRatio: event.target.value })}
          >
            {ASPECT_RATIOS.map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio}
              </option>
            ))}
          </FieldSelect>
        </>
      )}
    </div>
  );
}
