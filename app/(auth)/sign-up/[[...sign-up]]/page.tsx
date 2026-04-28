"use client";

import { SignUp } from "@clerk/nextjs";
import { AnimatedBackground } from "@/components/ui/animated-background";
import ThemeToggle from "@/components/theme-toggle";
import LanguageToggle from "@/components/language-toggle";
import { useTheme } from "next-themes";

const darkAppearance = {
  variables: {
    colorBackground: "#1e2235",
    colorInputBackground: "#111827",
    colorText: "#ffffff",
    colorTextSecondary: "#9ca3af",
    colorNeutral: "#374151",
  },
  elements: {
    card: { backgroundColor: "#1e2235", border: "none", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" },
    footer: { backgroundColor: "#1e2235", borderTop: "none", boxShadow: "none" },
    footerAction: { backgroundColor: "#1e2235" },
    footerPages: { backgroundColor: "#1e2235" },
    socialButtonsBlockButton: { backgroundColor: "#2d3748", borderColor: "#4a5568", color: "#ffffff" },
    formFieldInput: { backgroundColor: "#111827", borderColor: "#374151", color: "#ffffff" },
    footerActionText: { color: "#9ca3af" },
    footerActionLink: { color: "#a78bfa" },
  },
};

const lightAppearance = {
  variables: {
    colorBackground: "#ffffff",
    colorInputBackground: "#f8fafc",
    colorText: "#0f172a",
    colorTextSecondary: "#64748b",
    colorNeutral: "#e2e8f0",
  },
  elements: {
    card: { backgroundColor: "#ffffff" },
    footer: { backgroundColor: "#f8fafc", borderTop: "1px solid #e2e8f0", boxShadow: "none" },
    footerAction: { backgroundColor: "#f8fafc" },
    footerPages: { backgroundColor: "#f8fafc" },
    socialButtonsBlockButton: { backgroundColor: "#ffffff", borderColor: "#e2e8f0", color: "#0f172a" },
    formFieldInput: { backgroundColor: "#f8fafc", borderColor: "#e2e8f0", color: "#0f172a" },
  },
};

export default function Page() {
  const { resolvedTheme } = useTheme();

  return (
    <AnimatedBackground>
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <div className="flex justify-center">
        <SignUp appearance={resolvedTheme === "dark" ? darkAppearance : lightAppearance} />
      </div>
    </AnimatedBackground>
  );
}
