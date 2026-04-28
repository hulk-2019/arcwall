"use client";

import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import LanguageToggle from "@/components/language-toggle";
import Link from "next/link";
import ThemeToggle from "@/components/theme-toggle";
import User from "@/components/user";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Loading } from "@/components/ui/loading";
import { useTranslations } from "next-intl";

export default function Header() {
  const { user } = useAppStore();
  const t = useTranslations("header");
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const nav = t.raw("nav") as { key: string; title: string; url: string }[];

  return (
    <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md shadow-sm">
      <div className="flex h-16 w-full items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight">ArcWall</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {nav.map((tab) => {
            const active = pathname === tab.url || (tab.url !== "/" && pathname.startsWith(tab.url));
            return (
              <Link
                key={tab.key}
                href={tab.url}
                className={`text-sm font-medium transition-colors hover:text-primary ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                {tab.title}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Right Section */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2 pr-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>

          <div className="h-6 w-px bg-border mx-1"></div>

          {user === undefined ? (
            <Loading variant="skeleton" className="h-9 w-9 rounded-full" />
          ) : user ? (
            <div className="flex items-center gap-3">
              {user.credits && (
                <span className="text-sm font-medium text-muted-foreground">
                  ⚡ {user.credits.left_credits}
                </span>
              )}
              <User user={user} />
            </div>
          ) : (
            <Link href="/sign-in">
              <Button variant="ghost" className="rounded-full font-medium">
                {t("login")}
              </Button>
            </Link>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 text-muted-foreground hover:text-foreground"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-b border-border bg-background shadow-md">
          {nav.length > 0 && (
            <div className="space-y-1 px-4 pb-3 pt-2">
              {nav.map((tab) => {
                const active = pathname === tab.url;
                return (
                  <Link
                    key={tab.key}
                    href={tab.url}
                    className={`block rounded-md px-3 py-2 text-base font-medium ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {tab.title}
                  </Link>
                );
              })}
            </div>
          )}
          <div className={`px-4 py-4 ${nav.length > 0 ? "border-t border-border" : ""}`}>
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-medium text-muted-foreground" />
              <div className="flex items-center gap-2">
                <LanguageToggle />
                <ThemeToggle />
              </div>
            </div>
            {user === undefined ? (
              <div className="flex items-center gap-3">
                <Loading variant="skeleton" className="h-9 w-9 rounded-full" />
                <Loading variant="skeleton" className="h-4 w-32" />
              </div>
            ) : user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <User user={user} />
                  <span className="text-sm font-medium truncate max-w-[150px]">{user.email}</span>
                </div>
                {user.credits && (
                  <span className="text-sm text-muted-foreground">⚡ {user.credits.left_credits}</span>
                )}
              </div>
            ) : (
              <Link href="/sign-in" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full rounded-full">
                  {t("login")}
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
