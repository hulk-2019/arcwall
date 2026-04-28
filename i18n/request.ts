import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const LOCALES = ["en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get("arcwall-language")?.value ?? "en";
  const locale: Locale = (LOCALES as readonly string[]).includes(raw)
    ? (raw as Locale)
    : "en";

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
