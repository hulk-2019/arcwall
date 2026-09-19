"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Coins } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CREDIT_PACKAGES, packageCapacity } from "@/lib/canvas/pricing";
import { cn } from "@/lib/utils";

export function PricingPage() {
  const t = useTranslations("pricing");
  const faqs = t.raw("faqs") as Array<{ q: string; a: string }>;
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8 md:py-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium text-primary">{t("eyebrow")}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{t("subtitle")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("unitPrice")}</p>
      </header>

      <div className="mt-12 grid items-stretch gap-6 md:grid-cols-3">
        {CREDIT_PACKAGES.map((pack) => {
          const capacity = packageCapacity(pack.credits);
          const features = t.raw(`packs.${pack.id}.features`) as string[];
          return (
            <article
              key={pack.id}
              className={cn(
                "flex flex-col rounded-2xl border bg-card p-6 text-card-foreground",
                pack.featured
                  ? "border-primary bg-primary/5 shadow-sm md:-translate-y-2 md:p-7"
                  : "border-border"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{t(`packs.${pack.id}.name`)}</h2>
                  <p className="mt-1 text-sm text-primary">{t(`packs.${pack.id}.audience`)}</p>
                </div>
                {pack.featured ? (
                  <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
                    {t("featured")}
                  </span>
                ) : null}
              </div>

              <p className="mt-5 text-4xl font-semibold tracking-tight">
                {t("price", { amount: pack.amountCny })}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("credits", { count: pack.credits })}
              </p>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {t(`packs.${pack.id}.description`)}
              </p>

              <div className="mt-6 rounded-xl bg-muted/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("yieldTitle")}
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>{t("yieldImages", { count: capacity.seedreamImages })}</li>
                  <li>{t("yieldGpt", { count: capacity.gpt2kImages })}</li>
                  <li>{t("yieldAudio", { count: capacity.songs })}</li>
                  <li>
                    {capacity.videos > 0
                      ? t("yieldVideo", { count: capacity.videos })
                      : t("yieldVideoNone")}
                  </li>
                </ul>
              </div>

              <ul className="mt-6 space-y-2.5 text-sm">
                {features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex flex-col gap-2 pt-8">
                <Button className="h-11 w-full" disabled>
                  {t("cta")}
                </Button>
                <p className="text-center text-xs leading-5 text-muted-foreground">{t("ctaHint")}</p>
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Coins className="h-4 w-4" aria-hidden />
        {t("giftNote")}
      </p>
      <p className="mt-2 text-center text-sm">
        <Link
          href="/billing"
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("billingLink")}
        </Link>
      </p>

      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="text-center text-xl font-semibold text-foreground md:text-2xl">
          {t("faqTitle")}
        </h2>
        <div className="mt-8 space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={faq.q}
                className={cn(
                  "rounded-2xl border transition-colors",
                  isOpen
                    ? "border-primary/20 bg-muted/50"
                    : "border-border bg-card hover:border-primary/30"
                )}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenFaq(isOpen ? -1 : index)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180 text-primary"
                    )}
                    aria-hidden
                  />
                </button>
                {isOpen ? (
                  <p className="px-6 pb-5 text-sm leading-6 text-muted-foreground">{faq.a}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
