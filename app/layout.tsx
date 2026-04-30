// @ts-ignore
import "./globals.css";

import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { zhCN, enUS } from "@clerk/localizations";
import { Toaster } from "sonner";
import { DesignStoreProvider } from "@/components/providers/DesignStoreProvider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ReactQueryProvider } from "@/components/providers/query-provider";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();

  if (locale === "zh") {
    return {
      title: {
        template: "%s - AI壁纸生成器 | AI壁纸商店",
        default: "AI壁纸生成器 | AI壁纸商店",
      },
      description:
        "AI壁纸商店是一个AI壁纸生成工具，使用人工智能为您生成精美的壁纸。",
      keywords:
        "AI壁纸, AI壁纸商店, AI壁纸生成器, AI生成壁纸, AI绘画, AI Wallpaper",
    };
  }

  return {
    title: {
      template: "%s by AI Wallpaper Generator | AI Wallpaper Shop",
      default: "AI Wallpaper Generator | AI Wallpaper Shop",
    },
    description:
      "AI Wallpaper Shop is an AI Wallpaper Generator, used to generate beautiful wallpapers with AI.",
    keywords:
      "AI Wallpaper, AI Wallpaper Shop, AI Wallpaper Generator, AI Wallpaper image",
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <ClerkProvider localization={(locale === "zh" ? zhCN : enUS) as any}>
      <html lang={locale} suppressHydrationWarning>
        <body>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
          >
            <NextIntlClientProvider messages={messages}>
              <ReactQueryProvider>
                <DesignStoreProvider>
                  <Toaster
                    position="top-center"
                    richColors
                    toastOptions={{
                      style: {
                        minHeight: "40px",
                        height: "auto",
                        padding: "8px 16px",
                      },
                    }}
                  />
                  {children}
                </DesignStoreProvider>
              </ReactQueryProvider>
            </NextIntlClientProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
