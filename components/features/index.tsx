"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Features() {
  const t = useTranslations("features");
  const items = t.raw("items") as {
    decorativeText: string;
    title?: string;
    description: string;
    buttonText: string;
    buttonLink: string;
    image: string;
    imagePosition: "left" | "right";
  }[];

  return (
    <section className="py-24 md:py-32 max-w-[1400px] mx-auto w-full px-4 md:px-8">
      <div className="flex flex-col gap-24 lg:gap-32">
        {items.map((item, index) => {
          const isLeftImage = item.imagePosition === "left";
          return (
            <div
              key={index}
              className={`flex flex-col lg:flex-row items-center gap-12 lg:gap-24 ${isLeftImage ? "lg:flex-row-reverse" : ""}`}
            >
              <div className="flex-1 flex flex-col w-full">
                {item.decorativeText && (
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 leading-tight pb-2">
                    {item.decorativeText}
                  </h2>
                )}
                {item.title && (
                  <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mt-4">
                    {item.title}
                  </h3>
                )}
                <p className="text-muted-foreground text-lg leading-relaxed mt-6">
                  {item.description}
                </p>
                <div className="pt-8">
                  <Link href={item.buttonLink}>
                    <Button size="lg" className="rounded-full px-8 h-12 text-base font-medium shadow-sm hover:shadow-md transition-all">
                      {item.buttonText}
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="flex-1 w-full">
                <div className="relative rounded-[32px] overflow-hidden aspect-[4/3] shadow-2xl bg-muted">
                  <img
                    src={item.image}
                    alt={item.title || item.decorativeText}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
