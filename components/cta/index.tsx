"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function CTA() {
  const t = useTranslations("cta");

  return (
    <section className="py-16 md:py-24 max-w-[1600px] mx-auto w-full px-4 md:px-8">
      <div className="relative rounded-[2rem] overflow-hidden bg-primary/5 border border-primary/10">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-3xl" />
        </div>

        <div className="relative z-10 px-6 py-16 md:py-24 text-center flex flex-col items-center max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-6">
            {t("title")}
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl">
            {t("desc")}
          </p>
          <Button
            size="lg"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="rounded-full px-10 h-14 text-lg font-semibold bg-foreground text-background hover:bg-foreground/90 shadow-xl hover:scale-105 transition-all duration-300"
          >
            {t("button")}
          </Button>
        </div>
      </div>
    </section>
  );
}
