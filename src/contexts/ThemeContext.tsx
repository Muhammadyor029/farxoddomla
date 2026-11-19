import React, { createContext, useContext, useEffect, useState } from "react";
import type { ThemeMode } from "../../shared/types";

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  reducedMotion: boolean;
  toggleReducedMotion: () => void;
  setReducedMotion: (enabled: boolean) => void;
  background3d: boolean;
  toggleBackground3d: () => void;
  setBackground3d: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "huquq_olami_theme";
const MOTION_KEY = "huquq_olami_reduced_motion";
const BACKGROUND_KEY = "huquq_olami_background_3d";

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

export function resolveInitialBackground3d(): boolean {
  try {
    const saved = localStorage.getItem(BACKGROUND_KEY);
    if (saved === "true") return true;
    if (saved === "false") return false;
  } catch {
    // ignore
  }
  if (typeof window === "undefined") return true;
  const narrowScreen = window.innerWidth < 768;
  const lowCores = typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4;
  const navMem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  const lowMem = typeof navMem === "number" && navMem <= 4;
  return !(narrowScreen || lowCores || lowMem || resolveInitialReducedMotion());
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
  const [background3d, setBackground3dState] = useState<boolean>(() => resolveInitialBackground3d());

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

  useEffect(() => {
    try {
      localStorage.setItem(BACKGROUND_KEY, background3d ? "true" : "false");
    } catch {
      // ignore
    }
  }, [background3d]);

  const setTheme = (mode: ThemeMode) => setThemeState(mode);
  const toggleTheme = () => setThemeState((prev) => (prev === "night" ? "day" : "night"));
  const setReducedMotion = (enabled: boolean) => setReducedMotionState(enabled);
  const toggleReducedMotion = () => setReducedMotionState((prev) => !prev);
  const setBackground3d = (enabled: boolean) => setBackground3dState(enabled);
  const toggleBackground3d = () => setBackground3dState((prev) => !prev);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        reducedMotion,
        toggleReducedMotion,
        setReducedMotion,
        background3d,
        toggleBackground3d,
        setBackground3d,
      }}
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
