'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from 'react';

type ViewTransitionWithReady = ViewTransition & {
  ready: Promise<void>;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => ViewTransitionWithReady;
};

const ThemeToggle = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isTransitioningRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = mounted ? (theme === 'system' ? resolvedTheme : theme) : undefined;

  const switchThemeWithReveal = async (targetTheme: 'light' | 'dark', event: React.MouseEvent<HTMLButtonElement>) => {
    if (!mounted || currentTheme === targetTheme || isTransitioningRef.current) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setTheme(targetTheme);
      return;
    }

    const x = event.clientX;
    const y = event.clientY;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const doc = document as DocumentWithViewTransition;

    if (!doc.startViewTransition) {
      setTheme(targetTheme);
      return;
    }

    const root = document.documentElement;
    const directionClass = targetTheme === 'dark' ? 'theme-transition-dark' : 'theme-transition-light';

    isTransitioningRef.current = true;
    root.classList.add('theme-transitioning', directionClass);

    try {
      const transition = doc.startViewTransition(() => {
        setTheme(targetTheme);
      });

      await transition.ready;

      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ];

      const animation = document.documentElement.animate(
        {
          clipPath: targetTheme === 'dark' ? clipPath : [...clipPath].reverse(),
        },
        {
          duration: 460,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards',
          pseudoElement: targetTheme === 'dark'
            ? '::view-transition-new(root)'
            : '::view-transition-old(root)',
        },
      );

      await Promise.allSettled([transition.finished, animation.finished]);
    } finally {
      root.classList.remove('theme-transitioning', 'theme-transition-dark', 'theme-transition-light');
      isTransitioningRef.current = false;
    }
  };

  return (
    <>
      <style jsx global>{`
        ::view-transition-old(root),
        ::view-transition-new(root) {
          animation: none;
          mix-blend-mode: normal;
        }

        html.theme-transition-light::view-transition-old(root) {
          z-index: 999;
        }

        html.theme-transition-light::view-transition-new(root) {
          z-index: 1;
        }

        html.theme-transition-dark::view-transition-old(root) {
          z-index: 1;
        }

        html.theme-transition-dark::view-transition-new(root) {
          z-index: 999;
        }
      `}</style>
      <div className="flex h-9 items-center rounded-full border border-white/20 bg-white/70 p-1 text-xs font-semibold text-gray-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/80">
        <button
          type="button"
          aria-label="Switch to light theme"
          disabled={!mounted}
          onClick={(event) => switchThemeWithReveal('light', event)}
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
          onClick={(event) => switchThemeWithReveal('dark', event)}
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
    </>
  );
};

export default ThemeToggle;
