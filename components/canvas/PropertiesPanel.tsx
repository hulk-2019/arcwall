"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCanvasStore } from "@/store/useCanvasStore";
import type { CanvasNodeConfig } from "@/types/canvas";
import { CanvasGlass } from "./CanvasGlass";
import { PropertyFields } from "./PropertyFields";

interface PropertiesPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PropertiesPanel({ open, onOpenChange }: PropertiesPanelProps) {
  const selectedId = useCanvasStore((s) => s.selectedId);
  const node = useCanvasStore((s) => s.nodes.find((item) => item.id === s.selectedId));
  const updateNodeConfig = useCanvasStore((s) => s.updateNodeConfig);
  const editNodeConfig = useCanvasStore((s) => s.editNodeConfig);
  const beginEdit = useCanvasStore((s) => s.beginEdit);
  const t = useTranslations("canvas");

  const labels = {
    titleLabel: t("titleLabel"),
    text: t("text"),
    prompt: t("prompt"),
    brief: t("brief"),
    aspectRatio: t("aspectRatio"),
    count: t("count"),
    layout: t("layout"),
    visualLock: t("visualLock"),
    videoMode: t("videoMode"),
    videoModeText: t("videoModeText"),
    videoModeImage: t("videoModeImage"),
    duration: t("duration"),
    resolution: t("resolution"),
    uploadFile: t("uploadFile"),
    uploading: t("uploading"),
    uploadSuccess: t("uploadSuccess"),
    uploadFailed: t("uploadFailed"),
    noFile: t("noFile"),
    layouts: t.raw("layouts") as Record<string, string>,
  };

  const body = !node ? (
    <p className="text-sm text-muted-foreground">{t("propertiesEmpty")}</p>
  ) : (
    <PropertyFields
      key={node.id}
      type={node.type}
      config={node.config}
      previewUrl={node.output?.urls?.[0]}
      labels={labels}
      onBeginEdit={beginEdit}
      onPatch={(patch: Partial<CanvasNodeConfig>) =>
        updateNodeConfig(node.id, { ...node.config, ...patch })
      }
      onDiscrete={(patch: Partial<CanvasNodeConfig>) =>
        editNodeConfig(node.id, { ...node.config, ...patch })
      }
    />
  );

  return (
    <>
      <CanvasGlass className="pointer-events-auto absolute right-3 top-20 z-30 hidden max-h-[calc(100dvh-6rem)] w-80 overflow-y-auto p-4 md:block">
        <h2 className="mb-3 text-sm font-semibold">{t("properties")}</h2>
        {body}
      </CanvasGlass>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto md:hidden">
          <DialogHeader>
            <DialogTitle>{t("properties")}</DialogTitle>
            <DialogDescription>
              {selectedId == null ? t("propertiesEmpty") : t(`nodeTypes.${node?.type || "text"}`)}
            </DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    </>
  );
}
