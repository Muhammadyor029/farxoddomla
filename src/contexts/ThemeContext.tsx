import React, { createContext, useContext, useEffect, useState } from "react";
import type { ThemeMode } from "../../shared/types";

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  reducedMotion: boolean;
  toggleReducedMotion: () => void;
  setReducedMotion: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "huquq_olami_theme";
const MOTION_KEY = "huquq_olami_reduced_motion";

export function resolveInitialReducedMotion(): boolean {
  try {
    const saved = localStorage.getItem(MOTION_KEY);
    if (saved === "true") return true;
    if (saved === "false") return false;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "day" || saved === "night") return saved;
    } catch {
      // ignore
    }
    return "night";
  });

  const [reducedMotion, setReducedMotionState] = useState<boolean>(() => resolveInitialReducedMotion());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reducedMotion ? "true" : "false";
    try {
      localStorage.setItem(MOTION_KEY, reducedMotion ? "true" : "false");
    } catch {
      // ignore
    }
  }, [reducedMotion]);

  const setTheme = (mode: ThemeMode) => setThemeState(mode);
  const toggleTheme = () => setThemeState((prev) => (prev === "night" ? "day" : "night"));
  const setReducedMotion = (enabled: boolean) => setReducedMotionState(enabled);
  const toggleReducedMotion = () => setReducedMotionState((prev) => !prev);

  return (
    <ThemeContext.Provider
      value={{ theme, toggleTheme, setTheme, reducedMotion, toggleReducedMotion, setReducedMotion }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
