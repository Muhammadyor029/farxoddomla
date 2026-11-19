import React, { Component, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Application } from "@splinetool/runtime";
import type { ThemeMode } from "../../shared/types";

const Spline = React.lazy(() => import("@splinetool/react-spline"));
const SPLINE_SCENE_URL = "/assets/spline-scene.splinecode";

function detectLowPowerDevice(): boolean {
  if (typeof window === "undefined") return false;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const narrowScreen = window.innerWidth < 768;
  const lowCores = typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4;
  const navMem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  const lowMem = typeof navMem === "number" && navMem <= 4;
  return Boolean(reducedMotion || narrowScreen || lowCores || lowMem);
}

class SplineErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return <div className="w-full h-full bg-hero-bg" />;
    }
    return this.props.children;
  }
}

interface GlobalSplineBackdropProps {
  theme: ThemeMode;
  dimmed: boolean;
  reducedMotion?: boolean;
  background3d?: boolean;
}

export function GlobalSplineBackdrop({
  theme,
  dimmed,
  reducedMotion = false,
  background3d = true,
}: GlobalSplineBackdropProps) {
  const isDay = theme === "day";
  const isLowPower = useMemo(() => detectLowPowerDevice(), []);
  const disableSpline = !background3d;
  const splineRef = useRef<Application | null>(null);
  const loadTimerRef = useRef<number | null>(null);
  const [mountSpline, setMountSpline] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);

  // Defer WebGL initialization slightly so hero text and controls paint immediately
  useEffect(() => {
    if (disableSpline) {
      setMountSpline(false);
      return;
    }
    const timer = window.setTimeout(() => setMountSpline(true), 60);
    return () => window.clearTimeout(timer);
  }, [disableSpline]);

  // Track scroll depth so 3D loop pauses when user scrolls below the hero section
  useEffect(() => {
    if (disableSpline) return;
    let ticking = false;
    let rafId = 0;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      rafId = window.requestAnimationFrame(() => {
        const past = window.scrollY > window.innerHeight * 0.85;
        setScrolledPastHero((prev) => (prev !== past ? past : prev));
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [disableSpline]);

  // Pause WebGL render loop when hidden, scrolled below hero, reducedMotion enabled, or dimmed on low-power devices
  useEffect(() => {
    const syncPlayback = () => {
      const app = splineRef.current;
      if (!app) return;
      const shouldPause =
        reducedMotion ||
        document.hidden ||
        scrolledPastHero ||
        (isLowPower && dimmed);

      try {
        if (shouldPause) {
          if (!app.isStopped) app.stop();
        } else if (app.isStopped) {
          app.play();
        }
      } catch {
        // ignore runtime state transitions
      }
    };

    syncPlayback();
    document.addEventListener("visibilitychange", syncPlayback);
    return () => document.removeEventListener("visibilitychange", syncPlayback);
  }, [dimmed, scrolledPastHero, isLowPower, reducedMotion]);

  useEffect(
    () => () => {
      if (loadTimerRef.current !== null) window.clearTimeout(loadTimerRef.current);
    },
    []
  );

  const handleSplineLoad = (app: Application) => {
    splineRef.current = app;
    if (reducedMotion || document.hidden || scrolledPastHero || (isLowPower && dimmed)) {
      loadTimerRef.current = window.setTimeout(() => {
        try {
          if (splineRef.current && !splineRef.current.isStopped) {
            splineRef.current.stop();
          }
        } catch {
          // ignore
        }
      }, 280);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-0 overflow-hidden bg-hero-bg">
      {/* Persistent interactive Spline 3D scene (downscaled on low-power devices to save GPU fill-rate) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={
            isLowPower
              ? "w-[74%] h-[74%] scale-[1.36] origin-center will-change-transform"
              : "w-full h-full"
          }
        >
          {mountSpline && !disableSpline ? (
            <SplineErrorBoundary>
              <Suspense fallback={<div className="w-full h-full bg-hero-bg" />}>
                <Spline
                  scene={SPLINE_SCENE_URL}
                  renderOnDemand={true}
                  onLoad={handleSplineLoad}
                  className="w-full h-full"
                />
              </Suspense>
            </SplineErrorBoundary>
          ) : (
            <div className="w-full h-full bg-hero-bg" />
          )}
        </div>
      </div>

      {/* Day Mode: Uzbekistan Flag-inspired Tricolor Light (Top: Sky Blue, Middle: White with crimson hairline, Bottom: Green) */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
          isDay ? "opacity-100" : "opacity-0"
        }`}
        style={{
          mixBlendMode: isLowPower ? "normal" : "screen",
          background: `
            linear-gradient(
              180deg,
              rgba(0, 168, 224, ${isLowPower ? "0.40" : "0.52"}) 0%,
              rgba(0, 153, 181, 0.30) 29%,
              rgba(206, 17, 38, 0.22) 33%,
              rgba(255, 255, 255, ${isLowPower ? "0.22" : "0.30"}) 36%,
              rgba(255, 255, 255, 0.20) 63%,
              rgba(206, 17, 38, 0.22) 66%,
              rgba(30, 181, 58, 0.36) 70%,
              rgba(5, 234, 0, ${isLowPower ? "0.38" : "0.48"}) 100%
            )
          `,
        }}
      />

      {/* Ambient radial light boost in Day Mode */}
      {!isLowPower && (
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
            isDay ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background: `
              radial-gradient(ellipse 80% 35% at 50% 15%, rgba(0, 180, 235, 0.22), transparent 70%),
              radial-gradient(ellipse 85% 28% at 50% 50%, rgba(255, 255, 255, 0.14), transparent 72%),
              radial-gradient(ellipse 80% 35% at 50% 85%, rgba(24, 210, 72, 0.24), transparent 70%)
            `,
          }}
        />
      )}

      {/* Uzbekistan Flag Crescent Moon & 12 Stars (3-4-5 formation) in Top-Left Blue Band (Day Mode) */}
      <div
        className={`absolute top-20 left-6 sm:left-8 lg:left-16 pointer-events-none transition-opacity duration-500 ${
          isDay ? "opacity-85" : "opacity-0"
        }`}
        aria-hidden="true"
      >
        <svg
          width="220"
          height="92"
          viewBox="0 0 220 92"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <mask id="uz-crescent-mask">
              <rect width="220" height="92" fill="black" />
              <circle cx="38" cy="46" r="28" fill="white" />
              <circle cx="48" cy="46" r="23" fill="black" />
            </mask>
            <g id="uz-star">
              <polygon
                points="0,-7.5 1.85,-2.35 7.2,-2.35 2.9,0.95 4.45,6.1 0,3.0 -4.45,6.1 -2.9,0.95 -7.2,-2.35 -1.85,-2.35"
                fill="rgba(255,255,255,0.95)"
              />
            </g>
          </defs>

          <rect width="80" height="92" fill="rgba(255,255,255,0.94)" mask="url(#uz-crescent-mask)" />

          <use href="#uz-star" x="128" y="20" />
          <use href="#uz-star" x="156" y="20" />
          <use href="#uz-star" x="184" y="20" />

          <use href="#uz-star" x="100" y="46" />
          <use href="#uz-star" x="128" y="46" />
          <use href="#uz-star" x="156" y="46" />
          <use href="#uz-star" x="184" y="46" />

          <use href="#uz-star" x="72" y="72" />
          <use href="#uz-star" x="100" y="72" />
          <use href="#uz-star" x="128" y="72" />
          <use href="#uz-star" x="156" y="72" />
          <use href="#uz-star" x="184" y="72" />
        </svg>
      </div>

      {/* Base contrast overlay + Sub-section Dim Veil (no full-screen backdrop-blur over WebGL) */}
      <div
        className={`absolute inset-0 pointer-events-none transition-colors duration-300 ${
          dimmed
            ? isDay
              ? "bg-black/74"
              : "bg-black/80"
            : isDay
            ? "bg-black/22"
            : "bg-black/30"
        }`}
      />
    </div>
  );
}
