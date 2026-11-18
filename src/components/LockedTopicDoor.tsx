import { Lock } from "lucide-react";
import { Button } from "./ui/button";

export function LockedTopicCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Qulflangan mavzu"
      className="group relative overflow-hidden rounded-sm border border-white/10 bg-[#0d1014]/85 backdrop-blur-md min-h-[164px] p-5 text-left transition-all cursor-pointer select-none hover:border-primary/50 hover:bg-[#12161c]/90 active:scale-[0.99]"
    >
      {/* Architectural rectangular door frame & recessed panels echoing the 3D cube backdrop */}
      <div className="pointer-events-none absolute inset-2 rounded-[2px] border border-white/[0.06]" />
      <div className="pointer-events-none absolute left-2 top-2 bottom-2 w-1.5 border-r border-white/[0.05] bg-white/[0.015]" />
      <div className="pointer-events-none absolute inset-x-6 top-5 bottom-5 flex flex-col justify-between opacity-35">
        <div className="h-3 w-1/3 rounded-[2px] bg-white/[0.06]" />
        <div className="space-y-2">
          <div className="h-3.5 w-4/5 rounded-[2px] bg-white/[0.05]" />
          <div className="h-2.5 w-2/3 rounded-[2px] bg-white/[0.04]" />
        </div>
        <div className="h-2.5 w-1/2 rounded-[2px] bg-white/[0.04]" />
      </div>

      {/* Centered vault door lock plate */}
      <div className="relative z-10 h-full min-h-[124px] flex flex-col items-center justify-center gap-2.5">
        <div className="relative w-12 h-12 rounded-sm border border-white/15 bg-black/75 flex items-center justify-center shadow-inner group-hover:border-primary/60 group-hover:shadow-[0_0_18px_rgba(57,255,85,0.18)] transition-all">
          <Lock className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-3.5 rounded-[1px] bg-white/20 group-hover:bg-primary/60 transition-colors" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground group-hover:text-foreground transition-colors">
          Qulf
        </span>
      </div>
    </button>
  );
}

export function LockedTopicsVaultScreen({
  onOpenAuth,
  onNavigateGames,
  onNavigateTests,
}: {
  onOpenAuth: () => void;
  onNavigateGames?: () => void;
  onNavigateTests?: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-28 pb-16">
      <div className="relative overflow-hidden rounded-sm border border-white/15 bg-[#0c0f13]/90 backdrop-blur-xl p-8 sm:p-12 text-center shadow-2xl">
        {/* Double-door geometric seams */}
        <div className="pointer-events-none absolute inset-3 rounded-[2px] border border-white/[0.06]" />
        <div className="pointer-events-none absolute top-3 bottom-3 left-1/2 -translate-x-1/2 w-px bg-white/[0.06]" />

        <div className="relative z-10 space-y-5">
          <div className="w-16 h-16 rounded-sm border border-white/20 bg-black/80 mx-auto flex items-center justify-center shadow-inner">
            <Lock className="w-7 h-7 text-primary" />
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-primary">
              Qulflangan bo&apos;lim
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Mavzu qulflangan</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Mavzular va dars materiallari yopiq holatda. Ochish uchun ruxsat etilgan profil bilan tizimga kiring.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button onClick={onOpenAuth} className="rounded-sm px-6 uppercase text-xs tracking-wider">
              Tizimga kirish
            </Button>
            {onNavigateGames && (
              <Button variant="secondary" onClick={onNavigateGames} className="rounded-sm text-xs">
                O&apos;yinlarga o&apos;tish
              </Button>
            )}
            {onNavigateTests && (
              <Button variant="secondary" onClick={onNavigateTests} className="rounded-sm text-xs">
                Testlarga o&apos;tish
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
