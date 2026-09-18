"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Globe } from "lucide-react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

const LanguageToggle = () => {
  const t = useTranslations("language");
  const locale = useLocale();
  const router = useRouter();
  const locales = [
    { value: "en", label: t("en") },
    { value: "zh", label: t("zh") },
  ];

  const handleSelect = (value: string) => {
    Cookies.set("arcwall-language", value, { path: "/", expires: 365, sameSite: "Lax" });
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Globe className="h-4 w-4" />
        <span>{locales.find((l) => l.value === locale)?.label ?? "EN"}</span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[100px]">
        {locales.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={`cursor-pointer ${
              locale === option.value ? "bg-primary/10 text-primary font-bold" : ""
            }`}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageToggle;
