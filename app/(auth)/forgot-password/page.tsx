"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AnimatedBackground } from "@/components/ui/animated-background";
import ThemeToggle from "@/components/theme-toggle";
import LanguageToggle from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPassword } from "@/services/api";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export default function Page() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res: any = await forgotPassword({ email });
      setResetToken(res?.data?.resetToken || "");
      toast.success(t("resetRequestSent"));
    } catch (error: any) {
      toast.error(error?.message || t("resetRequestFailed"));
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
            <h1 className="text-2xl font-semibold">{t("forgotPasswordTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("forgotPasswordSubtitle")}</p>
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("sending") : t("sendResetLink")}
            </Button>
          </div>
          {resetToken && (
            <div className="mt-4 rounded-md border border-border bg-muted p-3 text-xs">
              <p className="mb-2 text-muted-foreground">{t("developmentResetToken")}</p>
              <p className="break-all font-mono">{resetToken}</p>
              <Link
                href={`/reset-password?token=${encodeURIComponent(resetToken)}`}
                className="mt-2 block text-primary hover:underline"
              >
                {t("continueToResetPassword")}
              </Link>
            </div>
          )}
          <Link href="/sign-in" className="mt-4 block text-center text-sm text-primary hover:underline">
            {t("backToSignIn")}
          </Link>
        </form>
      </div>
    </AnimatedBackground>
  );
}
