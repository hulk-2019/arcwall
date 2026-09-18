"use client";

import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import LanguageToggle from "@/components/language-toggle";
import Link from "next/link";
import ThemeToggle from "@/components/theme-toggle";
import User from "@/components/user";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Home, LayoutDashboard, Menu, Sparkles, X } from "lucide-react";
import { Loading } from "@/components/ui/loading";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  isHeaderNavActive,
  resolveHeaderNavHref,
  type HeaderNavItem,
} from "./nav";

const NAV_ICONS = {
  home: Home,
  canvas: Sparkles,
  workbench: LayoutDashboard,
} as const;

export default function Header() {
  const { user } = useAppStore();
  const t = useTranslations("header");
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const nav = t.raw("nav") as HeaderNavItem[];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="grid h-16 w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-4 md:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
            A
          </span>
          <span className="text-lg font-semibold tracking-tight">{t("brand")}</span>
        </Link>

        <nav aria-label={t("navAria")} className="hidden justify-self-center md:block">
          <div className="flex items-center gap-0.5 rounded-full border border-border/70 bg-muted/50 p-1 shadow-sm">
            {nav.map((item) => (
              <HeaderNavLink
                key={item.key}
                item={item}
                pathname={pathname}
                user={user}
                variant="desktop"
              />
            ))}
          </div>
        </nav>

        <div className="flex shrink-0 items-center justify-self-end gap-2">
          <div className="hidden items-center gap-3 md:flex">
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
            <div className="h-6 w-px bg-border" />
            <HeaderAccount user={user} loginLabel={t("login")} />
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-nav"
            aria-label={isMobileMenuOpen ? t("closeMenu") : t("openMenu")}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div
          id="mobile-nav"
          className="border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden"
        >
          <nav aria-label={t("navAria")} className="space-y-1 px-4 py-3">
            {nav.map((item) => (
              <HeaderNavLink
                key={item.key}
                item={item}
                pathname={pathname}
                user={user}
                variant="mobile"
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
            ))}
          </nav>
          <div className="border-t border-border/60 px-4 py-4">
            <div className="mb-4 flex items-center justify-end gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
            <HeaderAccount
              user={user}
              loginLabel={t("login")}
              onLogin={() => setIsMobileMenuOpen(false)}
              mobile
            />
          </div>
        </div>
      )}
    </header>
  );
}

function HeaderNavLink({
  item,
  pathname,
  user,
  variant,
  onNavigate,
}: {
  item: HeaderNavItem;
  pathname: string;
  user: unknown;
  variant: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  const active = isHeaderNavActive(pathname, item);
  const Icon = NAV_ICONS[item.key as keyof typeof NAV_ICONS];

  return (
    <Link
      href={resolveHeaderNavHref(item, user)}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "inline-flex items-center gap-2 font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant === "desktop" &&
          "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        variant === "desktop" &&
          (active
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"),
        variant === "mobile" && "min-h-11 w-full rounded-xl px-3 text-base",
        variant === "mobile" &&
          (active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"),
      )}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {item.title}
    </Link>
  );
}

function HeaderAccount({
  user,
  loginLabel,
  onLogin,
  mobile = false,
}: {
  user: ReturnType<typeof useAppStore.getState>["user"];
  loginLabel: string;
  onLogin?: () => void;
  mobile?: boolean;
}) {
  if (user === undefined) {
    return mobile ? (
      <div className="flex items-center gap-3">
        <Loading variant="skeleton" className="h-9 w-9 rounded-full" />
        <Loading variant="skeleton" className="h-4 w-32" />
      </div>
    ) : (
      <Loading variant="skeleton" className="h-9 w-9 rounded-full" />
    );
  }

  if (!user) {
    return (
      <Link href="/sign-in" onClick={onLogin}>
        <Button
          variant={mobile ? "outline" : "ghost"}
          className={cn("rounded-full font-medium", mobile && "w-full")}
        >
          {loginLabel}
        </Button>
      </Link>
    );
  }

  if (mobile) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <User user={user} />
          <span className="max-w-[150px] truncate text-sm font-medium">{user.email}</span>
        </div>
        {user.credits && (
          <span className="text-sm text-muted-foreground">⚡ {user.credits.left_credits}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {user.credits && (
        <span className="text-sm font-medium text-muted-foreground">
          ⚡ {user.credits.left_credits}
        </span>
      )}
      <User user={user} />
    </div>
  );
}
