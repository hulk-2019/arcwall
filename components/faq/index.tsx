"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function FAQ() {
  const t = useTranslations("faq");
  const items = t.raw("items") as { q: string; a: string }[];
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-16 md:py-24 max-w-4xl mx-auto w-full px-4 md:px-8">
      <div className="text-center mb-12 md:mb-16">
        <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {t("title")}
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className={`rounded-2xl border transition-colors ${isOpen ? "bg-muted/50 border-primary/20" : "bg-card border-border hover:border-primary/30"}`}
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between px-6 py-5 text-left font-semibold focus:outline-none"
              >
                <span className="text-lg">{item.q}</span>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${isOpen ? "rotate-180 text-primary" : ""}`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}
              >
                <div className="px-6 pb-5 text-muted-foreground leading-relaxed">
                  {item.a}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
