"use client";

import { Moon, Sun } from "lucide-react";

/**
 * Light/dark toggle. Persists to localStorage (htj.theme); the root layout's
 * boot script applies it before paint. Two themes, forever (AMANAH §12.7).
 *
 * Stateless by design: both icons render and the `dark:` variant (keyed to
 * [data-theme]) shows the right one — no hydration mismatch, no effect.
 */
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const el = document.documentElement;
    const next = el.dataset.theme === "dark" ? "light" : "dark";
    el.dataset.theme = next;
    try {
      localStorage.setItem("htj.theme", next);
    } catch {
      // storage unavailable — theme still applies for this session
    }
  }

  return (
    <button
      onClick={toggle}
      title="Toggle light/dark theme"
      aria-label="Toggle light/dark theme"
      className={className}
    >
      <Sun className="hidden h-4 w-4 dark:block" />
      <Moon className="h-4 w-4 dark:hidden" />
    </button>
  );
}
