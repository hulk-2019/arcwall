import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const designState = {
  prompt: "a city",
  model: "gpt-image-2",
  aspectRatio: "16:9",
  resolution: "2k",
  imgUrl: null as string | null,
  imgPath: null as string[] | null,
  setPrompt: vi.fn(),
  setModel: vi.fn(),
  setAspectRatio: vi.fn(),
  setResolution: vi.fn(),
  setImgUrl: vi.fn(),
  setImgPath: vi.fn(),
};

vi.mock("@/store/useDesignStore", () => ({
  useDesignStore: () => designState,
}));

vi.mock("@/store/useAppStore", () => ({
  useAppStore: () => ({ fetchUserCredits: vi.fn() }),
}));

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isSignedIn: true }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
  useTranslations: () => {
    const t = (key: string) => key;
    (t as typeof t & { raw: () => string[] }).raw = () => ["placeholder"];
    return t;
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQuery: () => ({
    isLoading: false,
    data: {
      data: [
        { category: "model", key: "gpt-image-2", label_zh: "GPT Image 2", label_en: "GPT Image 2" },
        { category: "aspect_ratio", key: "16:9" },
      ],
    },
  }),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div>skeleton</div>,
}));

import { GeneratePanel } from "./index";

describe("GeneratePanel size picker", () => {
  it("lets users pick 1K or 2K size", () => {
    const html = renderToStaticMarkup(<GeneratePanel />);
    expect(html).toContain(">2K<");
    expect(html).toContain(">1K<");
  });
});
