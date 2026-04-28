"use client";

import { useState } from "react";
import Hero from "@/components/hero";
import Wallpapers from "@/components/wallpapers";
import { useQuery } from "@tanstack/react-query";
import { getWallpapers } from "@/services/api";
import Features from "@/components/features";
import HowItWorks from "@/components/how-it-works";
import Testimonials from "@/components/testimonials";
import FAQ from "@/components/faq";
import CTA from "@/components/cta";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations } from "next-intl";

export default function HomePage() {
  const t = useTranslations("gallery");
  const [activeTab, setActiveTab] = useState("latest");

  const { data, isLoading } = useQuery({
    queryKey: ["wallpapers", activeTab],
    queryFn: async () => getWallpapers({ tab: activeTab }),
  });

  const wallpapers = (data as any)?.result?.items || [];

  return (
    <div className="space-y-4 pb-16">
      <Hero />
      <HowItWorks />
      <Features />

      <div className="max-w-[1600px] mx-auto w-full px-4 md:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              {t("title")}
            </h2>
            <p className="text-muted-foreground mt-1">
              {t("subtitle")}
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="grid w-full grid-cols-2 md:w-auto">
              <TabsTrigger value="trending">{t("trending")}</TabsTrigger>
              <TabsTrigger value="latest">{t("latest")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Wallpapers wallpapers={wallpapers} loading={isLoading} />
      </div>

      <Testimonials />
      <FAQ />
      <CTA />
    </div>
  );
}
