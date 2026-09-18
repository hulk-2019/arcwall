"use client";

import Link from "next/link";
import { Globe, Heart, ImageIcon, LayoutDashboard, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/my-works", key: "creations", icon: ImageIcon },
  { href: "/published", key: "published", icon: Globe },
  { href: "/favorites", key: "favorites", icon: Heart },
  { href: "/trash", key: "trash", icon: Trash2 },
] as const;

interface SidebarProps {
  pathname: string;
}

export function Sidebar({ pathname }: SidebarProps) {
  const t = useTranslations("myWorks.sidebar");

  return (
    <aside className="flex shrink-0 flex-col border-b border-border bg-muted/40 md:h-full md:w-56 md:border-b-0 md:border-r">
      <div className="hidden px-4 pb-3 pt-5 md:block">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <LayoutDashboard className="h-4 w-4 text-muted-foreground" aria-hidden />
          {t("title")}
        </p>
      </div>

      <nav aria-label={t("title")} className="px-2 py-2 md:flex-1 md:px-2.5">
        <div className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {t(item.key)}
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
