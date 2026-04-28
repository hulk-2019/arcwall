"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function AnimatedBackground({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className={cn("relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300", className)}>
      {/* Background Gradients */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100 via-slate-100 to-white dark:from-slate-900 dark:via-slate-950 dark:to-black transition-colors duration-300" />

      {/* Animated Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-purple-500/20 blur-[100px] animate-blob mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[100px] animate-blob animation-delay-2000 mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute -bottom-[10%] left-[20%] w-[45%] h-[45%] rounded-full bg-indigo-500/20 blur-[100px] animate-blob animation-delay-4000 mix-blend-multiply dark:mix-blend-screen" />

        {/* Floating Particles/Stars */}
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
      </div>

        {/* Shooting Stars */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="absolute h-[2px] w-[100px] bg-gradient-to-r from-transparent via-slate-500 dark:via-white to-transparent opacity-0 animate-shooting-star"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                transform: `rotate(${Math.random() * 45 - 22.5}deg)`,
              }}
            />
          ))}
        </div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] animate-grid-fade pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-4">
        {children}
      </div>

      <style jsx global>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes shooting-star {
          0% { transform: translateX(0) translateY(0) rotate(-45deg) scale(1); opacity: 1; }
          100% { transform: translateX(-200px) translateY(200px) rotate(-45deg) scale(0); opacity: 0; }
        }
        @keyframes grid-fade {
          0% { opacity: 0.5; transform: translateY(0); }
          50% { opacity: 0.8; transform: translateY(-10px); }
          100% { opacity: 0.5; transform: translateY(0); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animate-shooting-star { animation: shooting-star 3s linear infinite; }
        .animate-grid-fade { animation: grid-fade 10s ease-in-out infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
}
