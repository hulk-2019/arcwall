import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, string | number>) => {
      if (key === "credits") return `${values?.count} credits`;
      if (key === "price") return `¥${values?.amount}`;
      if (key === "yieldImages") return `${values?.count} Seedream images`;
      if (key === "yieldGpt") return `${values?.count} GPT-Image 2K stills`;
      if (key === "yieldAudio") return `${values?.count} Suno tracks`;
      if (key === "yieldVideo") return `${values?.count} Fast 720p 5s videos`;
      if (key === "yieldVideoNone") return "Not enough for a default video";
      return key;
    };
    t.raw = (key: string) => {
      if (key.endsWith(".features")) return ["feature-a", "feature-b"];
      return [];
    };
    return t;
  },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { PricingPage } from "./pricing-page";

describe("PricingPage", () => {
  it("shows enriched packs and hides the generation rate table", () => {
    const html = renderToStaticMarkup(<PricingPage />);
    expect(html).toContain("20 credits");
    expect(html).toContain("100 credits");
    expect(html).toContain("200 credits");
    expect(html).toContain("¥10");
    expect(html).toContain("¥50");
    expect(html).toContain("¥100");
    expect(html).toContain("starter.audience");
    expect(html).toContain("standard.audience");
    expect(html).toContain("large.audience");
    expect(html).toContain("20 Seedream images");
    expect(html).toContain("Not enough for a default video");
    expect(html).toContain("3 Fast 720p 5s videos");
    expect(html).toContain("faqTitle");
    expect(html).not.toContain("rateTitle");
    expect(html).not.toContain("rates.videoFast720p5");
    expect(html).not.toContain("Generation rates");
  });
});
