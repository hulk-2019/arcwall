"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ImageWithPlaceholderProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  containerClassName?: string;
  fill?: boolean;
}

export function ImageWithPlaceholder({
  src,
  alt,
  className,
  containerClassName,
  fill,
  ...props
}: ImageWithPlaceholderProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted",
        fill && "absolute inset-0 h-full w-full pointer-events-none",
        containerClassName
      )}
    >
      <div
        className={cn(
          "absolute inset-0 z-10 flex items-center justify-center bg-muted transition-opacity duration-700",
          isLoading ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="h-full w-full bg-gradient-to-br from-muted/50 to-muted animate-pulse pointer-events-none" />
      </div>

      <img
        src={src as string}
        alt={alt}
        className={cn(
          "transition-all duration-700 ease-in-out",
          fill && "absolute inset-0 w-full h-full object-cover",
          isLoading ? "scale-105 blur-xl grayscale" : "scale-100 blur-0 grayscale-0",
          className
        )}
        onLoad={() => setIsLoading(false)}
        {...props}
      />
    </div>
  );
}
