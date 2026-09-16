"use client";

import { AppStoreProvider } from "@/components/providers/AppStoreProvider";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function CanvasLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppStoreProvider>
      <TooltipProvider delayDuration={200}>
        <div className="min-h-dvh w-full bg-background">{children}</div>
      </TooltipProvider>
    </AppStoreProvider>
  );
}
