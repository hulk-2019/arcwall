import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mt-4 block text-xs font-medium text-muted-foreground first:mt-0">
      {children}
    </label>
  );
}

export function FieldSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "mt-1.5 flex h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/** 浮框参数网格内的紧凑标签（横向布局用） */
export function ParamLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-medium leading-tight text-muted-foreground">
      {children}
    </label>
  );
}

/** 浮框参数网格内的紧凑下拉（h-8，与横向布局配套） */
export function ParamSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "mt-1 flex h-8 w-full cursor-pointer rounded-md border border-input bg-background px-2 text-xs",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
