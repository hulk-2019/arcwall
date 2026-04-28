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
    <div className="w-full md:w-64 border-r border-border p-4 space-y-4 flex-shrink-0">
      <div className="space-y-1">
        <h3 className="font-semibold text-lg px-2 mb-4">
          {t("title")}
        </h3>

        <div className="flex flex-col gap-1">
          <Button
            variant={pathname === "/my-works" ? "secondary" : "ghost"}
            className="justify-start w-full"
            onClick={() => router.push("/my-works")}
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            {t("creations")}
          </Button>
          <Button
            variant={pathname === "/published" ? "secondary" : "ghost"}
            className="justify-start w-full"
            onClick={() => router.push("/published")}
          >
            <Globe className="w-4 h-4 mr-2" />
            {t("published")}
          </Button>
          <Button
            variant={pathname === "/favorites" ? "secondary" : "ghost"}
            className="justify-start w-full"
            onClick={() => router.push("/favorites")}
          >
            <Heart className="w-4 h-4 mr-2" />
            {t("favorites")}
          </Button>
          <Button
            variant={pathname === "/trash" ? "secondary" : "ghost"}
            className="justify-start w-full text-muted-foreground"
            onClick={() => router.push("/trash")}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t("trash")}
          </Button>
        </div>
      </div>
    </div>
  );
}
