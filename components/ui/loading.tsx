import { cn } from "@/lib/utils";

interface LoadingProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "spinner" | "skeleton" | "dots";
  size?: "sm" | "md" | "lg" | "xl"; // Kept for compatibility but unused
  text?: string;
}

export function Loading({ 
  className, 
  variant = "spinner", 
  size = "md", 
  text,
  ...props 
}: LoadingProps) {
  
  if (variant === "skeleton") {
    return (
      <div 
        className={cn(
          "animate-pulse rounded-xl bg-muted",
          className
        )} 
        {...props} 
      />
    );
  }

  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center gap-4 text-muted-foreground",
        className
      )} 
      {...props}
    >
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
        <div className="h-3 w-3 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
        <div className="h-3 w-3 rounded-full bg-current animate-bounce" />
      </div>
      {text && <p className="text-sm font-medium text-muted-foreground/80">{text}</p>}
    </div>
  );
}
