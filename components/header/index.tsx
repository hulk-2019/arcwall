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
    <header className="sticky top-0 z-40 w-full border-b border-[rgb(229,229,229)] bg-background/95 backdrop-blur dark:border-border">
      <div className="grid h-16 w-full grid-cols-[auto_1fr_auto] items-stretch px-4 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 self-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            A
          </span>
          <span className="text-base font-semibold tracking-tight">{t("brand")}</span>
        </Link>

        <nav
          aria-label={t("navAria")}
          className="hidden h-full items-stretch justify-self-center md:flex"
        >
          {nav.map((item) => (
            <HeaderNavLink
              key={item.key}
              item={item}
              pathname={pathname}
              user={user}
              variant="desktop"
            />
          ))}
        </nav>

        <div className="flex items-center justify-self-end gap-1 self-center md:gap-2">
          <div className="hidden items-center gap-1 md:flex">
            <LanguageToggle />
            <ThemeToggle />
            <div className="mx-1 h-4 w-px bg-border" />
            <HeaderAccount user={user} loginLabel={t("login")} />
          </div>

          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
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
          className="border-t border-border bg-background md:hidden"
        >
          <nav aria-label={t("navAria")} className="flex flex-col px-2 py-2">
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
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <div className="flex items-center gap-1">
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
          "relative h-full px-4 text-sm after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:bg-primary after:opacity-0 after:transition-opacity",
        variant === "desktop" &&
          (active
            ? "text-foreground after:opacity-100"
            : "text-muted-foreground hover:text-foreground hover:after:opacity-40"),
        variant === "mobile" && "min-h-11 w-full rounded-md px-3 text-sm",
        variant === "mobile" &&
          (active
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"),
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
        <Loading variant="skeleton" className="h-8 w-8 rounded-full" />
        <Loading variant="skeleton" className="h-4 w-24" />
      </div>
    ) : (
      <Loading variant="skeleton" className="h-8 w-8 rounded-full" />
    );
  }

  if (!user) {
    return (
      <Link href="/sign-in" onClick={onLogin}>
        <Button
          variant="ghost"
          size="sm"
          className={cn("font-medium", mobile && "h-9")}
        >
          {loginLabel}
        </Button>
      </Link>
    );
  }

  if (mobile) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <User user={user} />
        {user.credits && (
          <span className="text-xs text-muted-foreground">⚡ {user.credits.left_credits}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {user.credits && (
        <span className="text-xs font-medium text-muted-foreground">
          ⚡ {user.credits.left_credits}
        </span>
      )}
      <User user={user} />
    </div>
  );
}
