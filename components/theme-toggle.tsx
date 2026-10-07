"use client";

import { useSyncExternalStore } from "react";

/**
 * The theme lives on <html class="dark">, so it is read as external state:
 * mutations (our toggle, or a system preference change) invalidate the snapshot.
 */
function subscribeToTheme(callback: () => void) {
  const root = document.documentElement;
  const observer = new MutationObserver(callback);
  observer.observe(root, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function readIsDark() {
  return document.documentElement.classList.contains("dark");
}

function readIsDarkOnServer() {
  return false;
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribeToTheme, readIsDark, readIsDarkOnServer);

  function toggle() {
    const next = !readIsDark();
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("gentry-theme", next ? "dark" : "light");
    } catch {
      /* storage blocked — theme still applies for this visit */
    }
  }

  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border text-foreground"
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
