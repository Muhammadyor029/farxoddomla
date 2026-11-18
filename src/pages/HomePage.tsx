import {
  ArrowRight,
  BookOpen,
  Gamepad2,
  Presentation,
  Scale,
  FileCheck2,
  BookMarked,
  Landmark,
  GraduationCap,
  Sparkles,
  FileDown,
} from "lucide-react";
import type { GradeInfo } from "../../shared/types";
import { Button } from "../components/ui/button";
import type { RouteKey } from "../components/Navbar";

interface HomePageProps {
  grades: GradeInfo[];
  totalLessons: number;
  onNavigate: (route: RouteKey, param?: number) => void;
  onOpenAuth: () => void;
}

export function HomePage({ grades, totalLessons, onNavigate, onOpenAuth }: HomePageProps) {
  return (
    <div className="min-h-screen">
      {/* SENTINEL HERO SECTION — transparent so global Spline 3D backdrop shines through */}
      <section className="relative min-h-screen flex items-end overflow-hidden pointer-events-none">
        <div className="relative z-10 pointer-events-none w-full max-w-[90%] sm:max-w-md lg:max-w-2xl px-6 md:px-10 pb-10 md:pb-10 pt-32">
          <h1
            className="opacity-0 animate-fade-up text-[clamp(3rem,8vw,6rem)] font-bold leading-[1.05] tracking-[-0.05em] text-foreground mb-2 md:mb-4 uppercase"
            style={{ animationDelay: "0.2s" }}
          >
            HUQUQ<span className="text-primary"> OLAMI</span>
          </h1>

          <p
            className="opacity-0 animate-fade-up text-foreground/80 text-[clamp(1.125rem,2.5vw,1.875rem)] font-light mb-3 md:mb-6"
            style={{ animationDelay: "0.4s" }}
          >
            Davlat va huquq asoslarini to&apos;g&apos;ri o&apos;rganamiz.
          </p>

          <p
            className="opacity-0 animate-fade-up text-muted-foreground text-[clamp(0.875rem,1.5vw,1.25rem)] font-light mb-4 md:mb-8"
            style={{ animationDelay: "0.55s" }}
          >
            8-, 9-, 10- va 11-sinf darsliklari asosida yaratilgan interaktiv ta&apos;lim
            tizimi. 16 qismli darslar, prezentatsiya studiyasi, 10 xil huquqiy o&apos;yin
            va test markazi bitta platformada.
          </p>

          <div
            className="opacity-0 animate-fade-up flex flex-wrap gap-3 font-bold"
            style={{ animationDelay: "0.7s" }}
          >
            <button
              type="button"
              onClick={() => onNavigate("grades")}
              className="pointer-events-auto bg-primary text-primary-foreground px-6 py-3 md:px-8 md:py-4 text-sm rounded-sm cursor-pointer hover:brightness-110 transition-all active:scale-[0.97]"
            >
              Darslarni boshlash
            </button>
            <button
              type="button"
              onClick={onOpenAuth}
              className="pointer-events-auto bg-white text-background px-6 py-3 md:px-8 md:py-4 text-sm rounded-sm cursor-pointer hover:brightness-90 transition-all active:scale-[0.97]"
            >
              Kabinetga kirish
            </button>
          </div>

          <p
            className="opacity-0 animate-fade-up text-muted-foreground/60 text-xs font-light mt-4 md:mt-6"
            style={{ animationDelay: "0.85s" }}
          >
            O&apos;zbekiston umumta&apos;lim maktablari uchun. 8–11-sinf. {totalLessons} ta mavzu joylangan.
          </p>
        </div>
      </section>

      {/* BELOW THE FOLD: Dimmed translucent section over moving 3D background */}
      <div className="pointer-events-auto bg-black/70 backdrop-blur-[2px] border-t border-border/60">
        <section id="sinflar" className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-16 py-16 space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
            <div>
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
                Rasmiy darsliklar bazasi
              </span>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mt-1">
                Sinfni tanlang (8–11-sinf)
              </h2>
            </div>
            <Button variant="navCta" onClick={() => onNavigate("topics")} className="gap-2 text-xs rounded-sm">
              <span>Barcha mavzular</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {grades.map((g) => (
              <div
                key={g.gradeNumber}
                className="rounded-sm border border-border bg-card/90 p-6 flex flex-col justify-between hover:border-primary/60 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-semibold text-primary tabular-nums">{g.gradeNumber}-sinf</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{g.textbookYear}</span>
                  </div>
                  <h3 className="text-base font-semibold text-foreground leading-snug">{g.subtitle}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{g.description}</p>
                  <div className="pt-2 text-xs text-foreground/80 font-medium tabular-nums">
                    {g.chaptersCount} bob · {g.lessonsCount} mavzu · {g.totalPages} bet
                  </div>
                </div>

                <div className="pt-5 mt-5 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="hero"
                    onClick={() => onNavigate("grades", g.gradeNumber)}
                    className="flex-1 gap-1.5 text-xs uppercase tracking-wider"
                  >
                    <span>Ochish</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                  <a
                    href={g.pdfPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-sm border border-border bg-secondary p-2 text-muted-foreground hover:text-primary hover:border-primary/50"
                    title="Rasmiy PDF darslikni yuklash"
                  >
                    <FileDown className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="bolimlar" className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-16 pb-20 space-y-8">
          <div className="border-b border-border pb-5">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Bo&apos;limlar</span>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mt-1">
              Platformaning asosiy imkoniyatlari
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                route: "presentations" as RouteKey,
                icon: Presentation,
                title: "Prezentatsiyalar studiyasi",
                desc: "Slayd ko'rish, to'liq ekran, muharrir va PDF/Chop etish.",
              },
              {
                route: "interactive" as RouteKey,
                icon: Sparkles,
                title: "Interaktiv darslar",
                desc: "Qonunlar piramidasi, sud bosqichlari va animatsion modellar.",
              },
              {
                route: "games" as RouteKey,
                icon: Gamepad2,
                title: "Huquqiy o'yinlar (10 xil)",
                desc: "Detektiv, Sud Zali, Domino, Krossvord va Tezkor qaror.",
              },
              {
                route: "tests" as RouteKey,
                icon: FileCheck2,
                title: "Test markazi",
                desc: "7 xil turdagi testlar, taymer, tahlil va javoblar varaqasi.",
              },
              {
                route: "scenarios" as RouteKey,
                icon: Scale,
                title: "Amaliy vaziyatlar",
                desc: "9 huquq sohasi bo'yicha real kazus va yechimlar.",
              },
              {
                route: "glossary" as RouteKey,
                icon: BookMarked,
                title: "Huquqiy lug'at",
                desc: "8–11-sinf atamalarining sodda va aniq izohlari.",
              },
              {
                route: "legislation" as RouteKey,
                icon: Landmark,
                title: "O'zbekiston qonunchiligi",
                desc: "2023-yil Konstitutsiyasi va kodekslar moddalari sharhi.",
              },
              {
                route: "student" as RouteKey,
                icon: GraduationCap,
                title: "Shaxsiy kabinet",
                desc: "XP reytingi, natijalar, yutuqlar va shaxsiy profil.",
              },
            ].map((mod) => {
              const Icon = mod.icon;
              return (
                <button
                  key={mod.route}
                  type="button"
                  onClick={() => onNavigate(mod.route)}
                  className="rounded-sm border border-border bg-card/90 p-5 text-left hover:border-primary/60 hover:bg-secondary/60 transition-colors cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-sm bg-primary/10 border border-primary/30 flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-foreground">{mod.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{mod.desc}</p>
                  <div className="mt-4 text-xs font-medium text-primary flex items-center gap-1">
                    <span>Ochish</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              );
            })}
          </div>

          <footer className="border-t border-border pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary shrink-0" />
              <span>
                Barcha materiallar 8–11-sinf &laquo;Davlat va huquq asoslari&raquo; darsliklariga asoslangan.
              </span>
            </div>
            <span>Ta&apos;limiy platforma · Rasmiy yuridik maslahat o&apos;rnini bosmaydi</span>
          </footer>
        </section>
      </div>
    </div>
  );
}
