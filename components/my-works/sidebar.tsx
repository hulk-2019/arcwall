"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ImageIcon, Globe, Heart, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface SidebarProps {
  locale: string;
  pathname: string;
}

export function Sidebar({ locale, pathname }: SidebarProps) {
  const router = useRouter();
  const t = useTranslations("myWorks.sidebar");

  return (
    <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border p-2 md:p-4 flex-shrink-0">
      <div className="flex flex-col h-full">
        <h3 className="hidden md:block font-semibold text-lg px-2 mb-4">
          {t("title")}
        </h3>

        <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-visible gap-1 pb-1 md:pb-0 scrollbar-hide">
          <Button
            variant={pathname === "/my-works" ? "secondary" : "ghost"}
            className="justify-center md:justify-start flex-shrink-0"
            onClick={() => router.push("/my-works")}
          >
            <ImageIcon className="w-4 h-4 mr-2 hidden md:inline-block" />
            {t("creations")}
          </Button>
          <Button
            variant={pathname === "/published" ? "secondary" : "ghost"}
            className="justify-center md:justify-start flex-shrink-0"
            onClick={() => router.push("/published")}
          >
            <Globe className="w-4 h-4 mr-2 hidden md:inline-block" />
            {t("published")}
          </Button>
          <Button
            variant={pathname === "/favorites" ? "secondary" : "ghost"}
            className="justify-center md:justify-start flex-shrink-0"
            onClick={() => router.push("/favorites")}
          >
            <Heart className="w-4 h-4 mr-2 hidden md:inline-block" />
            {t("favorites")}
          </Button>
          <Button
            variant={pathname === "/trash" ? "secondary" : "ghost"}
            className="justify-center md:justify-start flex-shrink-0 text-muted-foreground"
            onClick={() => router.push("/trash")}
          >
            <Trash2 className="w-4 h-4 mr-2 hidden md:inline-block" />
            {t("trash")}
          </Button>
        </div>
      </div>
    </div>
  );
}
