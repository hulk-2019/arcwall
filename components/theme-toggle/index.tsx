'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from "next-themes";
import { useEffect, useState } from 'react';

const ThemeToggle = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine current active theme, defaulting to undefined during SSR
  const currentTheme = mounted ? (theme === 'system' ? resolvedTheme : theme) : undefined;

  return (
    <div className="flex h-9 items-center rounded-full border border-white/20 bg-white/70 p-1 text-xs font-semibold text-gray-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/80">
      <button
        type="button"
        aria-label="Switch to light theme"
        disabled={!mounted}
        onClick={() => setTheme('light')}
        className={`flex items-center justify-center min-w-[36px] rounded-full px-2 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          currentTheme === 'light'
            ? 'bg-primary text-primary-foreground shadow'
            : 'text-gray-500 dark:text-white/60'
        }`}
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Switch to dark theme"
        disabled={!mounted}
        onClick={() => setTheme('dark')}
        className={`flex items-center justify-center min-w-[36px] rounded-full px-2 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          currentTheme === 'dark'
            ? 'bg-primary text-primary-foreground shadow'
            : 'text-gray-500 dark:text-white/60'
        }`}
      >
        <Moon className="h-4 w-4" />
      </button>
      {!mounted && (
        <span className="sr-only">initializing theme switcher</span>
      )}
    </div>
  );
};

export default ThemeToggle;
