"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sparkles, Monitor, Palette, Download } from "lucide-react";

export default function HowItWorks() {
  const t = useTranslations("howItWorks");
  const items = t.raw("items") as { step: string; title: string; desc: string }[];

  return (
    <section className="py-16 md:py-24 max-w-[1200px] mx-auto w-full px-4 md:px-8">
      <div className="text-center mb-16 md:mb-20">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground md:text-5xl mb-6">
          {t("title")}
        </h2>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          {t("subtitle")}
        </p>
      </div>

      <div className="max-w-4xl mx-auto relative mb-20 px-4 md:px-8 mt-12">
        <div className="absolute top-8 bottom-12 left-[2.5rem] md:left-[4rem] w-[2px] bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />

        <div className="space-y-12 md:space-y-16">
          {items.map((item, index) => {
            const Icon = [Sparkles, Monitor, Palette, Download][index] || Sparkles;
            return (
              <div key={index} className="relative flex flex-row gap-6 md:gap-12 group">
                <div className="flex-shrink-0 relative z-10 pl-2 md:pl-4">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-background border-[3px] border-border group-hover:border-primary group-hover:bg-primary group-hover:scale-110 text-muted-foreground group-hover:text-primary-foreground flex items-center justify-center transition-all duration-500 shadow-sm">
                    <Icon className="w-5 h-5 md:w-7 md:h-7" strokeWidth={2} />
                  </div>
                </div>

                <div className="flex-1 pb-4 pt-1 md:pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4 mb-3">
                    <span className="text-3xl md:text-5xl font-black text-primary/10 group-hover:text-primary/20 transition-colors duration-300">
                      0{item.step}
                    </span>
                    <h3 className="text-xl md:text-2xl font-bold text-foreground group-hover:text-primary transition-colors duration-300">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-muted-foreground leading-relaxed text-base md:text-lg max-w-2xl">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-center">
        <Button size="lg" className="rounded-full px-8" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          {t("cta")}
        </Button>
      </div>
    </section>
  );
}
