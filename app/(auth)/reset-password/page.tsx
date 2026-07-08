"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatedBackground } from "@/components/ui/animated-background";
import ThemeToggle from "@/components/theme-toggle";
import LanguageToggle from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPassword } from "@/services/api";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export default function Page() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPassword({ token, password });
      toast.success(t("passwordUpdated"));
      router.push("/sign-in");
    } catch (error: any) {
      toast.error(error?.message || t("resetPasswordFailed"));
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
            <h1 className="text-2xl font-semibold">{t("resetPasswordTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("resetPasswordSubtitle")}</p>
          </div>
          <div className="space-y-4">
            <Input
              placeholder={t("resetToken")}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
            <Input
              type="password"
              autoComplete="new-password"
              placeholder={t("newPassword")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("updating") : t("updatePassword")}
            </Button>
          </div>
          <Link href="/sign-in" className="mt-4 block text-center text-sm text-primary hover:underline">
            {t("backToSignIn")}
          </Link>
        </form>
      </div>
    </AnimatedBackground>
  );
}
