import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function CanvasGlass({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-background/80 shadow-lg backdrop-blur-xl",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
