"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatedBackground } from "@/components/ui/animated-background";
import ThemeToggle from "@/components/theme-toggle";
import LanguageToggle from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login, setAuthToken } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export default function Page() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") || "/my-works";
  const { fetchUserInfo } = useAppStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res: any = await login({ email, password });
      const token = res?.data?.accessToken;
      if (!token) throw new Error(res?.message || t("signInFailed"));
      setAuthToken(token);
      await fetchUserInfo(true, true);
      router.push(redirectUrl);
    } catch (error: any) {
      toast.error(error?.message || t("signInFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatedBackground>
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <div className="flex min-h-screen items-center justify-center px-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-lg border border-border bg-background/90 p-6 shadow-xl backdrop-blur"
        >
          <div className="mb-6 space-y-1 text-center">
            <h1 className="text-2xl font-semibold">{t("signInTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("signInSubtitle")}</p>
          </div>
          <div className="space-y-4">
            <Input
              type="email"
              autoComplete="email"
              placeholder={t("email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              autoComplete="current-password"
              placeholder={t("password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("signingIn") : t("signInAction")}
            </Button>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="text-primary hover:underline">
              {t("forgotPasswordLink")}
            </Link>
            <Link href="/sign-up" className="text-primary hover:underline">
              {t("createAccountLink")}
            </Link>
          </div>
        </form>
      </div>
    </AnimatedBackground>
  );
}
