"use client";

import { useTranslations } from "next-intl";
import { Star } from "lucide-react";

export default function Testimonials() {
  const t = useTranslations("testimonials");
  const items = t.raw("items") as {
    initials: string;
    name: string;
    content: string;
    avatar?: string;
  }[];

  return (
    <section className="py-16 md:py-24 max-w-[1400px] mx-auto w-full px-4 md:px-8 bg-muted/30 rounded-3xl my-12">
      <div className="text-center mb-12 md:mb-16">
        <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {t("title")}
        </h2>
      </div>

      <div className="relative flex overflow-hidden group [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        {[0, 1].map((pass) => (
          <div
            key={pass}
            className="flex animate-marquee gap-6 py-4 pr-6 shrink-0 group-hover:[animation-play-state:paused]"
            aria-hidden={pass === 1}
          >
            {items.map((item, index) => (
              <div
                key={index}
                className="bg-card border border-border p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow w-[350px] md:w-[450px] flex-shrink-0 flex flex-col"
              >
                <div className="flex items-center gap-4 mb-6">
                  {item.avatar ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.avatar} alt={item.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      {item.initials}
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-foreground">{item.name}</h4>
                    <div className="flex text-yellow-400 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-current" />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground leading-relaxed flex-grow">
                  {item.content}
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
