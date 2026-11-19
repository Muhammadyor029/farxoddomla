import { useEffect, useState } from "react";
import { Bell, ChevronDown, LogOut, Sun, Moon, Menu, X, PauseCircle, PlayCircle } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import {
  apiRequest,
  NOTIFICATIONS_UPDATED_EVENT,
  type AdminNotificationData,
} from "../lib/api";
import { Button } from "./ui/button";

export type RouteKey =
  | "home"
  | "grades"
  | "topics"
  | "lesson"
  | "presentations"
  | "interactive"
  | "games"
  | "tests"
  | "scenarios"
  | "glossary"
  | "legislation"
  | "student"
  | "teacher"
  | "admin";

interface NavbarProps {
  activeRoute: RouteKey;
  onNavigate: (route: RouteKey, param?: number) => void;
  onOpenAuth: () => void;
}

const PRIMARY_LINKS: Array<{ route: RouteKey; label: string }> = [
  { route: "grades", label: "Sinflar" },
  { route: "topics", label: "Mavzular" },
  { route: "presentations", label: "Prezentatsiya" },
  { route: "games", label: "O'yinlar" },
  { route: "tests", label: "Testlar" },
];

const BASE_MORE_SECTIONS: Array<{ route: RouteKey; label: string; desc: string }> = [
  { route: "interactive", label: "Interaktiv darslar", desc: "Animatsion sxema va jarayonlar" },
  { route: "scenarios", label: "Amaliy vaziyatlar", desc: "9 soha bo'yicha real kazuslar" },
  { route: "glossary", label: "Huquqiy lug'at", desc: "8–11-sinflar izohli lug'ati" },
  { route: "legislation", label: "O'zbekiston qonunchiligi", desc: "Konstitutsiya va kodekslar" },
  { route: "student", label: "Shaxsiy kabinet", desc: "Yakunlangan darslar, yutuqlar va natijalar" },
];

const OWNER_SECTIONS: Array<{ route: RouteKey; label: string; desc: string }> = [
  { route: "teacher", label: "Dars va test studiyasi", desc: "Dars, test va topshiriqlar qo'shish" },
  { route: "admin", label: "Boshqaruv paneli", desc: "To'liq tizim va AI sozlamalari" },
];

export function Navbar({ activeRoute, onNavigate, onOpenAuth }: NavbarProps) {
  const { theme, toggleTheme, reducedMotion, toggleReducedMotion } = useTheme();
  const { user, unlocked, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) {
      setNotificationCount(0);
      return;
    }
    let active = true;
    const loadCount = () => {
      apiRequest<AdminNotificationData>("/api/admin/notifications")
        .then((data) => {
          if (active) {
            setNotificationCount(data.teacherRequests.length + data.accessRequests.length);
          }
        })
        .catch(() => {
          if (active) setNotificationCount(0);
        });
    };
    loadCount();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, loadCount);
    const intervalId = window.setInterval(loadCount, 60_000);
    return () => {
      active = false;
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, loadCount);
      window.clearInterval(intervalId);
    };
  }, [isAdmin, user?.id]);

  const moreSections = unlocked ? [...BASE_MORE_SECTIONS, ...OWNER_SECTIONS] : BASE_MORE_SECTIONS;

  const handleGo = (route: RouteKey, param?: number) => {
    setMoreOpen(false);
    setMobileOpen(false);
    onNavigate(route, param);
  };

  return (
    <header
      className={`no-print fixed top-0 left-0 right-0 z-50 ${
        activeRoute === "home" && !mobileOpen ? "bg-transparent" : "bg-hero-bg/95 border-b border-border/60"
      }`}
    >
      <nav className="flex items-center justify-between px-5 sm:px-8 lg:px-16 py-4 sm:py-5">
        {/* Left: Logo */}
        <button
          type="button"
          onClick={() => handleGo("home")}
          className="text-foreground text-lg sm:text-xl font-semibold tracking-tight whitespace-nowrap shrink-0 cursor-pointer"
        >
          HUQUQ OLAMI
        </button>

        {/* Center: Nav Links */}
        <div className="hidden md:flex items-center gap-6 lg:gap-8">
          {PRIMARY_LINKS.map((item) => {
            const active = activeRoute === item.route;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => handleGo(item.route)}
                className={`text-sm transition-colors uppercase tracking-widest whitespace-nowrap shrink-0 cursor-pointer ${
                  active ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            );
          })}

          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Bo&apos;limlar</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
            </button>

            {moreOpen && (
              <div className="absolute right-0 mt-3 w-72 rounded-lg border border-border bg-card p-2 shadow-2xl z-50">
                {moreSections.map((sec) => (
                  <button
                    key={sec.route}
                    type="button"
                    onClick={() => handleGo(sec.route)}
                    className={`w-full rounded-md px-3 py-2 text-left transition-colors cursor-pointer ${
                      activeRoute === sec.route ? "bg-primary/15 text-primary" : "hover:bg-secondary text-foreground"
                    }`}
                  >
                    <div className="text-xs font-semibold">{sec.label}</div>
                    <div className="text-[11px] text-muted-foreground">{sec.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: CTA, Theme, Reduced Motion & Mobile Menu Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {isAdmin && (
            <button
              type="button"
              onClick={() => handleGo("admin")}
              className="relative hidden md:inline-flex w-10 h-10 rounded-lg bg-nav-button/80 items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Bildirishnomalar"
              aria-label={`Bildirishnomalar (${notificationCount})`}
            >
              <Bell className="w-4 h-4 text-primary" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {notificationCount}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={toggleReducedMotion}
            className={`hidden md:inline-flex w-10 h-10 rounded-lg items-center justify-center transition-colors cursor-pointer ${
              reducedMotion
                ? "bg-primary/20 text-primary border border-primary/40"
                : "bg-nav-button/80 text-muted-foreground hover:text-foreground"
            }`}
            title={reducedMotion ? "Harakatni yoqish" : "Harakatni kamaytirish"}
            aria-label={reducedMotion ? "Harakatni yoqish" : "Harakatni kamaytirish"}
          >
            {reducedMotion ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="hidden md:inline-flex w-10 h-10 rounded-lg bg-nav-button/80 items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title={theme === "night" ? "Kunduzgi rejim" : "Tungi rejim"}
            aria-label={theme === "night" ? "Kunduzgi rejim" : "Tungi rejim"}
          >
            {theme === "night" ? <Sun className="w-4 h-4 text-primary" /> : <Moon className="w-4 h-4 text-primary" />}
          </button>

          {user ? (
            <div className="hidden md:inline-flex items-center gap-2">
              <Button
                size="lg"
                variant="navCta"
                onClick={() => handleGo(unlocked ? "admin" : "student")}
                className="hidden md:inline-flex rounded-lg uppercase text-xs tracking-widest px-6"
              >
                {user.fullName.split(" ")[0]}
              </Button>
              <button
                type="button"
                onClick={logout}
                className="w-10 h-10 rounded-lg bg-nav-button flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                title="Chiqish"
                aria-label="Chiqish"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Button
              size="lg"
              variant="navCta"
              onClick={onOpenAuth}
              className="hidden md:inline-flex rounded-lg uppercase text-xs tracking-widest px-6"
            >
              Kirish
            </Button>
          )}

          {/* Mobile Menu Trigger */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden w-10 h-10 rounded-lg bg-nav-button/90 flex items-center justify-center text-foreground cursor-pointer"
            aria-label={mobileOpen ? "Menyuni yopish" : "Menyuni ochish"}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card/98 px-5 py-4 space-y-4 max-h-[80vh] overflow-y-auto shadow-2xl">
          <div className="grid grid-cols-2 gap-2">
            {PRIMARY_LINKS.map((item) => (
              <button
                key={item.route}
                type="button"
                onClick={() => handleGo(item.route)}
                className={`rounded-lg border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer ${
                  activeRoute === item.route
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-background/60 text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border">
            {moreSections.map((sec) => (
              <button
                key={sec.route}
                type="button"
                onClick={() => handleGo(sec.route)}
                className={`w-full rounded-lg px-3 py-2 text-left text-xs cursor-pointer ${
                  activeRoute === sec.route ? "bg-primary/15 text-primary" : "bg-background/40 text-foreground"
                }`}
              >
                <div className="font-semibold">{sec.label}</div>
                <div className="text-[11px] text-muted-foreground">{sec.desc}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
            <Button size="sm" variant="secondary" onClick={toggleTheme} className="gap-1.5 text-xs flex-1">
              {theme === "night" ? <Sun className="w-3.5 h-3.5 text-primary" /> : <Moon className="w-3.5 h-3.5 text-primary" />}
              {theme === "night" ? "Kunduzgi" : "Tungi"}
            </Button>
            <Button size="sm" variant="secondary" onClick={toggleReducedMotion} className="gap-1.5 text-xs flex-1">
              {reducedMotion ? <PauseCircle className="w-3.5 h-3.5 text-primary" /> : <PlayCircle className="w-3.5 h-3.5" />}
              {reducedMotion ? "Harakat: Past" : "Harakat: Faol"}
            </Button>
          </div>

          {isAdmin && (
            <div className="pt-1">
              <Button size="sm" variant="secondary" onClick={() => handleGo("admin")} className="w-full gap-1.5 text-xs">
                <Bell className="w-3.5 h-3.5 text-primary" />
                Bildirishnomalar ({notificationCount})
              </Button>
            </div>
          )}

          <div className="pt-1">
            {user ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleGo(unlocked ? "admin" : "student")}
                  className="flex-1 text-xs"
                >
                  {user.fullName}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    logout();
                    setMobileOpen(false);
                  }}
                >
                  Chiqish
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  setMobileOpen(false);
                  onOpenAuth();
                }}
                className="w-full text-xs uppercase tracking-wider"
              >
                Kirish / Ro&apos;yxatdan o&apos;tish
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
