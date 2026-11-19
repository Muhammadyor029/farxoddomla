import { useEffect, useState } from "react";
import { Presentation, Sparkles, FileCheck2, Gamepad2, ArrowRight, Lock } from "lucide-react";
import type { AccessRequestStatus, GameDefinition, PresentationDeck, QuizInfo } from "../../shared/types";
import { apiRequest } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { PresentationStudio } from "../components/presentations/PresentationStudio";
import { AnimatedProcessDiagram, VisualDiagram } from "../components/diagrams/LegalDiagrams";
import { LegalGamesArena } from "../components/games/LegalGamesArena";
import { QuizRunner } from "../components/quizzes/QuizRunner";
import { AccessRequestButton, type AccessListMeta } from "../components/AccessRequestButton";

/* ==================== PRESENTATIONS LIBRARY + STUDIO ==================== */
export function PresentationsLibraryPage({ onOpenAuth }: { onOpenAuth?: () => void }) {
  const [grade, setGrade] = useState<number>(9);
  const [list, setList] = useState<
    Array<{ id: number; lessonId: number; gradeNumber: number; title: string; slideCount: number }>
  >([]);
  const [activeDeck, setActiveDeck] = useState<PresentationDeck | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [locked, setLocked] = useState(false);
  const [requestStatus, setRequestStatus] = useState<AccessRequestStatus>("none");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMsg(null);
    apiRequest<
      AccessListMeta & {
        presentations?: Array<{ id: number; lessonId: number; gradeNumber: number; title: string; slideCount: number }>;
      }
    >(`/api/presentations?grade=${grade}`)
      .then(async (res) => {
        if (!active) return;
        const isLocked = Boolean(res?.locked);
        setLocked(isLocked);
        setRequestStatus(res?.requestStatus || "none");
        const items = Array.isArray(res?.presentations) ? res.presentations : [];
        setList(items);
        if (!isLocked && items[0]) {
          const detail = await apiRequest<{ presentation?: PresentationDeck }>(`/api/presentations/${items[0].id}`);
          if (active) setActiveDeck(detail?.presentation || null);
        } else {
          setActiveDeck(null);
        }
      })
      .catch((err) => {
        if (!active) return;
        setList([]);
        setActiveDeck(null);
        setErrorMsg(err instanceof Error ? err.message : "Prezentatsiyalarni yuklashda xatolik yuz berdi.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [grade, reloadTick]);

  async function selectDeck(id: number) {
    try {
      setErrorMsg(null);
      const res = await apiRequest<{ presentation?: PresentationDeck }>(`/api/presentations/${id}`);
      if (res?.presentation) setActiveDeck(res.presentation);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Prezentatsiyani ochishda xatolik.");
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-24 pb-16 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Slaydlar va Tahrirlash Studiyasi
          </span>
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground mt-1">Prezentatsiyalar markazi</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[8, 9, 10, 11].map((g) => (
            <Button key={g} size="sm" variant={grade === g ? "default" : "secondary"} onClick={() => setGrade(g)}>
              {g}-sinf
            </Button>
          ))}
          {locked && (
            <AccessRequestButton
              resourceType="presentations"
              resourceId={0}
              requestStatus={requestStatus}
              onOpenAuth={onOpenAuth}
            />
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs sm:text-sm text-red-200 flex flex-wrap items-center justify-between gap-3 no-print">
          <span>{errorMsg}</span>
          <Button size="sm" variant="secondary" onClick={() => setReloadTick((t) => t + 1)}>
            Qayta yuklash
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 rounded-2xl border border-border bg-card p-4 max-h-[680px] overflow-y-auto space-y-2 no-print">
          <div className="text-xs font-semibold text-muted-foreground px-2 pb-2 border-b border-border">
            {grade}-sinf prezentatsiyalari ({list.length} ta)
          </div>
          {loading ? (
            <div className="h-40 rounded-xl bg-secondary/40 animate-pulse" />
          ) : list.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Prezentatsiyalar topilmadi.</div>
          ) : (
            list.map((item) =>
              locked ? (
                <div
                  key={item.id}
                  className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-left text-xs flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0 text-muted-foreground">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate font-medium">Qulflangan</span>
                  </div>
                  <span className="text-[11px] tabular-nums shrink-0">—</span>
                </div>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectDeck(item.id)}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-left text-xs transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    activeDeck?.id === item.id
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border bg-background/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Presentation className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate font-medium">{item.title}</span>
                  </div>
                  <span className="text-[11px] tabular-nums shrink-0">{item.slideCount} slayd</span>
                </button>
              )
            )
          )}
        </div>

        <div className="lg:col-span-8">
          {activeDeck ? (
            <PresentationStudio deck={activeDeck} onDeckUpdated={setActiveDeck} />
          ) : loading ? (
            <div className="h-96 rounded-2xl border border-border bg-card/50 animate-pulse" />
          ) : (
            <div className="h-64 rounded-2xl border border-border bg-card/50 flex items-center justify-center text-sm text-muted-foreground">
              Prezentatsiya tanlanmadi.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==================== INTERACTIVE VISUAL LESSONS ==================== */
export function InteractiveLessonsPage({ onSelectLesson }: { onSelectLesson: (id: number) => void }) {
  const { unlocked } = useAuth();
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-24 pb-16 space-y-8">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          Vizual va Animatsion Modellar
        </span>
        <h1 className="text-2xl sm:text-4xl font-bold text-foreground mt-1">Interaktiv darslar laboratoriyasi</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Qonunlar iyerarxiyasi, davlat hokimiyati bo&apos;linishi, huquqiy munosabat uchligi va sud bosqichlarini interaktiv o&apos;rganing.
        </p>
      </div>

      <VisualDiagram
        kind="law_pyramid"
        title="1. O'zbekiston Respublikasi qonunchilik hujjatlari iyerarxiyasi (8–9-sinf)"
        caption="Har bir pog'onani bosib uning yuridik kuchi va Konstitutsiyadagi o'rnini ko'ring"
        nodes={[
          { id: "ip1", level: 1, label: "O'zbekiston Respublikasi Konstitutsiyasi", detail: "Oliy yuridik kuchga ega Asosiy Qonun (155 modda, 2023-yil tahriri)", articleRef: "15-modda" },
          { id: "ip2", level: 2, label: "Konstitutsiyaviy qonunlar va Kodekslar", detail: "Fuqarolik, Oila, Mehnat, Jinoyat va Ma'muriy kodekslar", articleRef: "8-sinf 41-bet" },
          { id: "ip3", level: 3, label: "O'zbekiston Respublikasi Qonunlari", detail: "Oliy Majlis qabul qiladigan umumiy majburiy qonunlar", articleRef: "91-modda" },
          { id: "ip4", level: 4, label: "Prezident Farmon va Qarorlari", detail: "Davlat boshlig'i tomonidan qabul qilinadigan normativ hujjatlar", articleRef: "110-modda" },
          { id: "ip5", level: 5, label: "Vazirlar Mahkamasi va mahalliy Kengash hujjatlari", detail: "Ijro etuvchi hokimiyat va hududiy vakillik organlari qarorlari", articleRef: "115, 120-moddalar" },
        ]}
      />

      <AnimatedProcessDiagram
        title="2. Jinoyat va ma'muriy ish yuritishda inson huquqlari kafolatlari (9–11-sinf)"
        steps={[
          {
            stepNumber: 1,
            title: "Ushlash va Miranda qoidasi",
            description: "Shaxs ushlangan ilk lahzada unga sukut saqlash va advokat olish huquqlari tushunarli tilda aytilishi shart.",
            highlight: "Konstitutsiya 27-modda",
          },
          {
            stepNumber: 2,
            title: "48 soatlik chegara va Xabeas korpus",
            description: "Sud qarorisiz 48 soatdan ortiq ushlab turish taqiqlanadi; qamoq va tintuvga faqat sud sanksiya beradi.",
            highlight: "Konstitutsiya 27, 31-m.",
          },
          {
            stepNumber: 3,
            title: "Aybsizlik prezumpsiyasi",
            description: "Sud hukmi qonuniy kuchga kirmaguncha shaxs aybsiz; barcha shubhalar gumonlanuvchi foydasiga hal qilinadi.",
            highlight: "Konstitutsiya 28-modda",
          },
          {
            stepNumber: 4,
            title: "Ochiq va mustaqil sud",
            description: "Sudyalar faqat Konstitutsiya va qonunga bo'ysunadi, noqonuniy olingan dalillar kuchga ega emas.",
            highlight: "Konstitutsiya 136-m.",
          },
        ]}
      />

      <VisualDiagram
        kind="labor_protection"
        title="3. Voyaga yetmaganlar va yosh mutaxassislar mehnat kafolatlari (8 va 11-sinf)"
        caption="Mehnat kodeksi asosidagi yosh chegaralari va himoya choralari"
        nodes={[
          { id: "il1", label: "Ishga qabul yoshi: 16 yosh", detail: "15 yoshdan ota-onaning yozma roziligi bilan o'qishdan bo'sh vaqtda yengil mehnatga ruxsat beriladi.", articleRef: "MK 118-modda" },
          { id: "il2", label: "Qisqartirilgan ish vaqti", detail: "16–18 yosh: haftasiga 36 soatgacha; 15–16 yosh: 24 soatgacha (kattalar uchun 40 soat).", articleRef: "8-sinf 117-bet" },
          { id: "il3", label: "Tungi va og'ir ishlar taqiqi", detail: "18 yoshgacha xodimlarni tunda (22:00–06:00), bayram kunlari va zararli ishlarga jalb qilish taqiqlanadi.", articleRef: "MK 417-modda" },
          { id: "il4", label: "Ta'til va haq to'lash", detail: "Voyaga yetmaganlarga kamida 30 kalendar kun yillik ta'til (kattalarga kamida 21 kun) beriladi.", articleRef: "11-sinf 20-bet" },
        ]}
      />

      <div className="rounded-2xl border border-primary/30 bg-primary/10 p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-primary shrink-0" />
          <div>
            <h3 className="text-base font-bold text-foreground">To&apos;liq darslarga o&apos;tishga tayyormisiz?</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Har bir mavzu ichida o&apos;zining maxsus vizual sxemasi va animatsion diagrammasi mavjud.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onSelectLesson(8008)} className="gap-1.5 text-xs">
            {!unlocked && <Lock className="w-3.5 h-3.5" />}
            8-sinf darsi <ArrowRight className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onSelectLesson(9001)} className="gap-1.5 text-xs">
            {!unlocked && <Lock className="w-3.5 h-3.5" />}
            9-sinf darsi <ArrowRight className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onSelectLesson(11003)} className="gap-1.5 text-xs">
            {!unlocked && <Lock className="w-3.5 h-3.5" />}
            11-sinf darsi <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ==================== GAMES PAGE ==================== */
export function GamesPage({ games }: { games: GameDefinition[] }) {
  const { user, refreshUser } = useAuth();
  const initialGrade =
    user?.gradeNumber === 8 || user?.gradeNumber === 9 || user?.gradeNumber === 10 || user?.gradeNumber === 11
      ? user.gradeNumber
      : 9;
  const [selectedGrade, setSelectedGrade] = useState<8 | 9 | 10 | 11>(initialGrade);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-24 pb-16 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary flex items-center gap-1.5">
            <Gamepad2 className="w-4 h-4" /> O&apos;yin orqali huquqiy ta&apos;lim
          </span>
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground mt-1">
            Huquqiy o&apos;yinlar markazi ({selectedGrade}-sinf · 10 xil o&apos;yin)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Har bir sinf uchun alohida darslik bazasi, har o&apos;yinda tasodifiy savollar va qiyin chalg&apos;ituvchi variantlar.
          </p>
        </div>
      </div>

      <LegalGamesArena
        games={games}
        gradeNumber={selectedGrade}
        onGradeChange={setSelectedGrade}
        onScoreSaved={refreshUser}
      />
    </div>
  );
}

/* ==================== TEST CENTER PAGE ==================== */
export function TestCenterPage() {
  const { refreshUser } = useAuth();
  const [grade, setGrade] = useState(9);
  const [quizzes, setQuizzes] = useState<Array<{ id: number; title: string; questionCount: number }>>([]);
  const [activeQuiz, setActiveQuiz] = useState<QuizInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMsg(null);
    apiRequest<{ quizzes?: Array<{ id: number; title: string; questionCount: number }> }>(`/api/quizzes?grade=${grade}`)
      .then(async (res) => {
        if (!active) return;
        const items = Array.isArray(res?.quizzes) ? res.quizzes : [];
        setQuizzes(items);
        if (items[0]) {
          const detail = await apiRequest<{ quiz?: QuizInfo }>(`/api/quizzes/${items[0].id}`);
          if (active) setActiveQuiz(detail?.quiz || null);
        } else {
          setActiveQuiz(null);
        }
      })
      .catch((err) => {
        if (!active) return;
        setQuizzes([]);
        setActiveQuiz(null);
        setErrorMsg(err instanceof Error ? err.message : "Testlarni yuklashda xatolik yuz berdi.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [grade, reloadTick]);

  async function pickQuiz(id: number) {
    try {
      setErrorMsg(null);
      const res = await apiRequest<{ quiz?: QuizInfo }>(`/api/quizzes/${id}`);
      if (res?.quiz) setActiveQuiz(res.quiz);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Testni ochishda xatolik.");
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-24 pb-16 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary flex items-center gap-1.5">
            <FileCheck2 className="w-4 h-4" /> Bilimni baholash tizimi
          </span>
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground mt-1">Test markazi</h1>
        </div>
        <div className="flex gap-2">
          {[8, 9, 10, 11].map((g) => (
            <Button key={g} size="sm" variant={grade === g ? "default" : "secondary"} onClick={() => setGrade(g)}>
              {g}-sinf
            </Button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs sm:text-sm text-red-200 flex flex-wrap items-center justify-between gap-3 no-print">
          <span>{errorMsg}</span>
          <Button size="sm" variant="secondary" onClick={() => setReloadTick((t) => t + 1)}>
            Qayta yuklash
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 rounded-2xl border border-border bg-card p-4 max-h-[680px] overflow-y-auto space-y-2 no-print">
          <div className="text-xs font-semibold text-muted-foreground px-2 pb-2 border-b border-border">
            {grade}-sinf testlari ({quizzes.length} ta)
          </div>
          {loading ? (
            <div className="h-40 rounded-xl bg-secondary/40 animate-pulse" />
          ) : quizzes.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Testlar topilmadi.</div>
          ) : (
            quizzes.map((qz) => (
              <button
                key={qz.id}
                type="button"
                onClick={() => pickQuiz(qz.id)}
                className={`w-full rounded-xl border px-3.5 py-2.5 text-left text-xs transition-all cursor-pointer flex items-center justify-between gap-2 ${
                  activeQuiz?.id === qz.id
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-background/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="line-clamp-2 font-medium">{qz.title}</span>
                <span className="text-[11px] tabular-nums shrink-0 text-primary">{qz.questionCount} savol</span>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-8">
          {activeQuiz ? (
            <QuizRunner quiz={activeQuiz} onAttemptSaved={refreshUser} />
          ) : loading ? (
            <div className="h-96 rounded-2xl border border-border bg-card/50 animate-pulse" />
          ) : (
            <div className="h-64 rounded-2xl border border-border bg-card/50 flex items-center justify-center text-sm text-muted-foreground">
              Test tanlanmadi.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
