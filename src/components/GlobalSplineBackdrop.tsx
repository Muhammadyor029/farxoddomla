import React, { Component, Suspense } from "react";
import type { ThemeMode } from "../../shared/types";

const Spline = React.lazy(() => import("@splinetool/react-spline"));
const SPLINE_SCENE_URL = "https://prod.spline.design/Slk6b8kz3LRlKiyk/scene.splinecode";

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
}

export function GlobalSplineBackdrop({ theme, dimmed }: GlobalSplineBackdropProps) {
  const isDay = theme === "day";

  return (
    <div className="no-print fixed inset-0 z-0 overflow-hidden bg-hero-bg">
      {/* Persistent interactive Spline 3D scene across all sections */}
      <div className="absolute inset-0">
        <SplineErrorBoundary>
          <Suspense fallback={<div className="w-full h-full bg-hero-bg" />}>
            <Spline scene={SPLINE_SCENE_URL} className="w-full h-full" />
          </Suspense>
        </SplineErrorBoundary>
      </div>

      {/* Day Mode: Uzbekistan Flag-inspired Tricolor Light (Top: Sky Blue, Middle: White with crimson hairline, Bottom: Green) */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
          isDay ? "opacity-100" : "opacity-0"
        }`}
        style={{
          mixBlendMode: "screen",
          background: `
            linear-gradient(
              180deg,
              rgba(0, 168, 224, 0.52) 0%,
              rgba(0, 153, 181, 0.36) 29%,
              rgba(206, 17, 38, 0.24) 33%,
              rgba(255, 255, 255, 0.30) 36%,
              rgba(255, 255, 255, 0.26) 63%,
              rgba(206, 17, 38, 0.24) 66%,
              rgba(30, 181, 58, 0.40) 70%,
              rgba(5, 234, 0, 0.48) 100%
            )
          `,
        }}
      />

      {/* Ambient radial light boost in Day Mode so Uzbekistan flag glow stays bright on 3D blocks */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
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

      {/* Uzbekistan Flag Crescent Moon & 12 Stars (3-4-5 formation) in Top-Left Blue Band (Day Mode) */}
      <div
        className={`absolute top-20 left-6 sm:left-8 lg:left-16 pointer-events-none transition-all duration-700 ${
          isDay ? "opacity-85 translate-y-0" : "opacity-0 -translate-y-2"
        }`}
        aria-hidden="true"
      >
        <svg
          width="220"
          height="92"
          viewBox="0 0 220 92"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ filter: "drop-shadow(0 0 14px rgba(255, 255, 255, 0.5))" }}
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

          {/* Crescent Moon facing right */}
          <rect width="80" height="92" fill="rgba(255,255,255,0.94)" mask="url(#uz-crescent-mask)" />

          {/* Top row: 3 stars (right-aligned) */}
          <use href="#uz-star" x="128" y="20" />
          <use href="#uz-star" x="156" y="20" />
          <use href="#uz-star" x="184" y="20" />

          {/* Middle row: 4 stars */}
          <use href="#uz-star" x="100" y="46" />
          <use href="#uz-star" x="128" y="46" />
          <use href="#uz-star" x="156" y="46" />
          <use href="#uz-star" x="184" y="46" />

          {/* Bottom row: 5 stars */}
          <use href="#uz-star" x="72" y="72" />
          <use href="#uz-star" x="100" y="72" />
          <use href="#uz-star" x="128" y="72" />
          <use href="#uz-star" x="156" y="72" />
          <use href="#uz-star" x="184" y="72" />
        </svg>
      </div>

      {/* Base contrast overlay + Sub-section Dim/Soft-Blur Veil */}
      <div
        className={`absolute inset-0 pointer-events-none transition-all duration-500 ${
          dimmed
            ? isDay
              ? "bg-black/68 backdrop-blur-[3px]"
              : "bg-black/74 backdrop-blur-[3px]"
            : isDay
            ? "bg-black/22"
            : "bg-black/30"
        }`}
      />
    </div>
  );
}
