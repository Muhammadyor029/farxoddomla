import { useState } from "react";
import { ChevronDown, LogOut, Sun, Moon } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
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
  { route: "student", label: "Shaxsiy kabinet", desc: "XP, daraja, yutuqlar va natijalar" },
];

const OWNER_SECTIONS: Array<{ route: RouteKey; label: string; desc: string }> = [
  { route: "teacher", label: "Dars va test studiyasi", desc: "Dars, test va topshiriqlar qo'shish" },
  { route: "admin", label: "Boshqaruv paneli", desc: "To'liq tizim va AI sozlamalari" },
];

export function Navbar({ activeRoute, onNavigate, onOpenAuth }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, unlocked, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreSections = unlocked ? [...BASE_MORE_SECTIONS, ...OWNER_SECTIONS] : BASE_MORE_SECTIONS;

  const handleGo = (route: RouteKey, param?: number) => {
    setMoreOpen(false);
    onNavigate(route, param);
  };

  return (
    <header
      className={`no-print fixed top-0 left-0 right-0 z-50 ${
        activeRoute === "home" ? "bg-transparent" : "bg-hero-bg/95 border-b border-border/60"
      }`}
    >
      <nav className="flex items-center justify-between px-8 lg:px-16 py-5">
        {/* Left: Logo */}
        <button
          type="button"
          onClick={() => handleGo("home")}
          className="text-foreground text-xl font-semibold tracking-tight whitespace-nowrap shrink-0 cursor-pointer"
        >
          HUQUQ OLAMI
        </button>

        {/* Center: Nav Links */}
        <div className="hidden md:flex items-center gap-8">
          {PRIMARY_LINKS.map((item) => {
            const active = activeRoute === item.route;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => handleGo(item.route)}
                className={`text-sm transition-colors uppercase tracking-widest whitespace-nowrap shrink-0 cursor-pointer ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
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

        {/* Right: CTA & Theme */}
        <div className="flex items-center gap-3 shrink-0">
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
        </div>
      </nav>
    </header>
  );
}
