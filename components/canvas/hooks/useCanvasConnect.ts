"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useCanvasStore } from "@/store/useCanvasStore";
import { clientToWorld, hitTestConnectTarget, type Point } from "../geometry";

export interface ConnectSession {
  sourceId: string;
  cursor: Point;
  targetId: string | null;
}

export function useCanvasConnect(containerRef: RefObject<HTMLDivElement | null>) {
  const t = useTranslations("canvas");
  const [session, setSession] = useState<ConnectSession | null>(null);
  const sessionRef = useRef<ConnectSession | null>(null);

  const readWorld = (event: ReactPointerEvent): Point | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return clientToWorld(event.clientX, event.clientY, rect, useCanvasStore.getState().viewport);
  };

  const syncSession = (sourceId: string, world: Point): ConnectSession => {
    const { nodes, viewport } = useCanvasStore.getState();
    const next: ConnectSession = {
      sourceId,
      cursor: world,
      targetId: hitTestConnectTarget(world, nodes, sourceId, viewport.scale),
    };
    sessionRef.current = next;
    setSession(next);
    return next;
  };

  const begin = (sourceId: string, event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    containerRef.current?.setPointerCapture(event.pointerId);
    const world = readWorld(event) ?? { x: 0, y: 0 };
    syncSession(sourceId, world);
  };

  const onMove = (event: ReactPointerEvent) => {
    const current = sessionRef.current;
    if (!current) return;
    const world = readWorld(event);
    if (!world) return;
    syncSession(current.sourceId, world);
  };

  const onUp = (event: ReactPointerEvent) => {
    const current = sessionRef.current;
    if (!current) return;
    const world = readWorld(event);
    const targetId = world
      ? hitTestConnectTarget(
          world,
          useCanvasStore.getState().nodes,
          current.sourceId,
          useCanvasStore.getState().viewport.scale
        )
      : current.targetId;

    if (containerRef.current?.hasPointerCapture(event.pointerId)) {
      containerRef.current.releasePointerCapture(event.pointerId);
    }
    sessionRef.current = null;
    setSession(null);

    if (targetId == null) return;
    const connected = useCanvasStore.getState().connectNodes(current.sourceId, targetId);
    if (!connected) toast.error(t("connectFailed"));
  };

  const isConnecting = () => sessionRef.current != null;

  return { session, begin, onMove, onUp, isConnecting };
}
