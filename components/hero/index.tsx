"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { GeneratePanel } from "@/components/generate-panel";

export default function Hero() {
  const tHero = useTranslations("hero");

  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center overflow-hidden bg-background text-center">
      <div className="absolute inset-0 z-0">
        <img src="/banner.png" alt="Background" className="absolute inset-0 w-full h-full object-cover opacity-60 dark:opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        <div className="absolute inset-0 bg-white/20 dark:bg-black/50" />
      </div>

      <div className="relative z-10 w-full max-w-5xl px-4 py-16 sm:px-6 lg:px-8 flex flex-col items-center gap-10">
        <div className="space-y-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl md:text-7xl drop-shadow-sm">
            {tHero("title")}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-light">
            {tHero("subtitle")}
          </p>

          <div className="flex items-center justify-center gap-4 pt-4">
            <div className="flex -space-x-3">
              {["/user/1.jpeg", "/user/2.jpeg", "/user/3.jpeg", "/user/4.jpeg", "/user/5.jpeg", "/user/6.jpeg"].map((src, i) => (
                <img key={i} src={src} alt="User" className="w-8 h-8 rounded-full border-2 border-background" />
              ))}
            </div>
            <div className="text-sm text-muted-foreground font-medium">
              {tHero("joinCreators")}
            </div>
          </div>
        </div>

        <GeneratePanel className="max-w-4xl" />
      </div>
    </section>
  );
}
