import { useEffect, useState } from "react";
import {
  BookOpen,
  FileDown,
  ArrowRight,
  Search,
  Printer,
  CheckCircle2,
  Presentation,
  FileCheck2,
  Gamepad2,
  Sparkles,
  ChevronLeft,
  BookmarkCheck,
} from "lucide-react";
import type {
  AccessRequestStatus,
  ChapterInfo,
  GameDefinition,
  GradeInfo,
  LessonInfo,
  PresentationDeck,
  QuizInfo,
} from "../../shared/types";
import { apiRequest, ApiRequestError } from "../lib/api";
import { exportLessonPdf } from "../lib/pdfExport";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { AnimatedProcessDiagram, VisualDiagram } from "../components/diagrams/LegalDiagrams";
import { PresentationStudio } from "../components/presentations/PresentationStudio";
import { QuizRunner } from "../components/quizzes/QuizRunner";
import { LegalAIAssistant } from "../components/ai/LegalAIAssistant";
import { LockedTopicCard, LockedTopicsVaultScreen } from "../components/LockedTopicDoor";
import { AccessRequestButton, type AccessListMeta } from "../components/AccessRequestButton";
import type { RouteKey } from "../components/Navbar";

function useCompletedLessonIds(): Set<number> {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    let active = true;
    if (!user) {
      setIds(new Set());
      return;
    }
    apiRequest<{ progress?: Array<{ lesson_id: number }>; completedLessonIds?: number[] }>("/api/student/dashboard")
      .then((res) => {
        if (!active) return;
        const list = res?.completedLessonIds ?? res?.progress?.map((p) => p.lesson_id) ?? [];
        setIds(new Set(list.filter((n): n is number => typeof n === "number")));
      })
      .catch(() => {
        if (active) setIds(new Set());
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  return ids;
}

function CompletedMarker() {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-emerald/40 bg-emerald/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald">
      <BookmarkCheck className="w-3 h-3" /> Yakunlandi
    </span>
  );
}

/* ==================== 1. GRADES PORTAL PAGE ==================== */
export function GradesPage({
  grades,
  initialGrade,
  onSelectLesson,
  onOpenAuth,
}: {
  grades: GradeInfo[];
  initialGrade?: number;
  onSelectLesson: (lessonId: number) => void;
  onOpenAuth: () => void;
}) {
  const { user, unlocked } = useAuth();
  const completedIds = useCompletedLessonIds();
  const [selectedGrade, setSelectedGrade] = useState<number>(initialGrade || 8);
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [lessons, setLessons] = useState<LessonInfo[]>([]);
  const [chapterStatus, setChapterStatus] = useState<AccessRequestStatus>("none");
  const [lessonStatus, setLessonStatus] = useState<AccessRequestStatus>("none");
  const [lessonsLocked, setLessonsLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialGrade) setSelectedGrade(initialGrade);
  }, [initialGrade]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      apiRequest<AccessListMeta & { chapters?: ChapterInfo[] }>(`/api/chapters?grade=${selectedGrade}`),
      apiRequest<AccessListMeta & { lessons?: LessonInfo[] }>(`/api/lessons?grade=${selectedGrade}`),
    ])
      .then(([cRes, lRes]) => {
        if (!active) return;
        setChapters(Array.isArray(cRes?.chapters) ? cRes.chapters : []);
        setLessons(Array.isArray(lRes?.lessons) ? lRes.lessons : []);
        setChapterStatus(cRes?.requestStatus || "none");
        setLessonStatus(lRes?.requestStatus || "none");
        setLessonsLocked(Boolean(lRes?.locked));
      })
      .catch(() => {
        if (!active) return;
        setChapters([]);
        setLessons([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedGrade, user?.id, unlocked]);

  const gradeInfo = grades.find((g) => g.gradeNumber === selectedGrade) || grades[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-24 pb-16 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Sinflar kesimida</span>
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground mt-1">
            8–11-sinflar &laquo;Davlat va huquq asoslari&raquo;
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {[8, 9, 10, 11].map((gNum) => (
            <Button
              key={gNum}
              size="sm"
              variant={selectedGrade === gNum ? "default" : "secondary"}
              onClick={() => setSelectedGrade(gNum)}
              className="tabular-nums"
            >
              {gNum}-sinf
            </Button>
          ))}
          {lessonsLocked && (
            <AccessRequestButton
              resourceType="lessons"
              resourceId={0}
              requestStatus={lessonStatus}
              onOpenAuth={onOpenAuth}
            />
          )}
        </div>
      </div>

      {gradeInfo && (
        <div className="rounded-2xl border border-border bg-card p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="text-xs font-semibold text-emerald">{gradeInfo.textbookTitle} ({gradeInfo.textbookYear})</div>
            <h2 className="text-xl font-bold text-foreground">{gradeInfo.subtitle}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">{gradeInfo.description}</p>
            <div className="text-xs text-muted-foreground pt-1">Muallif / Nashr: {gradeInfo.textbookAuthors}</div>
          </div>
          <a
            href={gradeInfo.pdfPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/15 px-4 py-3 text-xs sm:text-sm font-semibold text-primary hover:bg-primary/25 transition-colors"
          >
            <FileDown className="w-4 h-4" /> Rasmiy PDF darslikni ochish ({gradeInfo.totalPages} bet)
          </a>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 rounded-2xl border border-border bg-card/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {chapters.map((ch) => {
            const chLessons = lessons.filter((l) => l.chapterId === ch.id);
            const isChapterLocked = Boolean(ch.locked);
            return (
              <div key={ch.id} className="rounded-2xl border border-border bg-card/70 p-6 space-y-4">
                {isChapterLocked ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">
                        {ch.romanNumeral}
                      </span>
                      <span className="inline-block h-3.5 w-44 rounded-[2px] bg-white/10" aria-hidden="true" />
                    </div>
                    <button
                      type="button"
                      onClick={onOpenAuth}
                      className="text-xs font-medium text-primary hover:underline cursor-pointer"
                    >
                      Ochish uchun kirish
                    </button>
                    <AccessRequestButton
                      resourceType="chapters"
                      resourceId={0}
                      requestStatus={chapterStatus}
                      onOpenAuth={onOpenAuth}
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">{ch.romanNumeral}</span>
                      <h3 className="text-lg sm:text-xl font-bold text-foreground">{ch.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{ch.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{ch.pageRange}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {chLessons.map((lesson) =>
                    lesson.locked ? (
                      <LockedTopicCard key={lesson.id} onClick={onOpenAuth} />
                    ) : (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => onSelectLesson(lesson.id)}
                        className="rounded-xl border border-border bg-background/70 p-4 text-left hover:border-primary/60 hover:bg-secondary/60 transition-all cursor-pointer flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 text-[11px] mb-1.5">
                            <span className="font-semibold text-primary">{lesson.lessonNumberLabel}</span>
                            <span className="flex items-center gap-1.5">
                              {completedIds.has(lesson.id) && <CompletedMarker />}
                              <span className="text-muted-foreground tabular-nums">{lesson.pageNumber}-bet</span>
                            </span>
                          </div>
                          <h4 className="text-sm font-semibold text-foreground leading-snug">{lesson.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{lesson.summary}</p>
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border/50">
                          <span className={lesson.status === "verified" ? "text-emerald" : "text-amber-300"}>
                            {lesson.status === "verified" ? "Tasdiqlangan" : "Qoralama"}
                          </span>
                          <span className="text-primary font-medium flex items-center gap-1">
                            Darsni ochish <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ==================== 2. ALL TOPICS CATALOG PAGE ==================== */
export function AllTopicsPage({
  onSelectLesson,
  onOpenAuth,
}: {
  onSelectLesson: (lessonId: number) => void;
  onOpenAuth: () => void;
}) {
  const { user, unlocked } = useAuth();
  const completedIds = useCompletedLessonIds();
  const [gradeFilter, setGradeFilter] = useState<number>(0);
  const [query, setQuery] = useState("");
  const [lessons, setLessons] = useState<LessonInfo[]>([]);
  const [lessonStatus, setLessonStatus] = useState<AccessRequestStatus>("none");
  const [lessonsLocked, setLessonsLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (gradeFilter) params.set("grade", String(gradeFilter));
    if (unlocked && query.trim()) params.set("q", query.trim());
    apiRequest<AccessListMeta & { lessons?: LessonInfo[] }>(`/api/lessons?${params.toString()}`)
      .then((res) => {
        if (active) {
          setLessons(Array.isArray(res?.lessons) ? res.lessons : []);
          setLessonStatus(res?.requestStatus || "none");
          setLessonsLocked(Boolean(res?.locked));
        }
      })
      .catch(() => {
        if (active) setLessons([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [gradeFilter, query, user?.id, unlocked]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-24 pb-16 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">To&apos;liq darsliklar katalogi</span>
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground mt-1">Barcha mavzular (8–11-sinflar)</h1>
        </div>
        {!unlocked && (
          <Button size="sm" onClick={onOpenAuth} className="rounded-sm text-xs uppercase tracking-wider">
            Qulfni ochish (Kirish)
          </Button>
        )}
        {lessonsLocked && (
          <AccessRequestButton
            resourceType="lessons"
            resourceId={0}
            requestStatus={lessonStatus}
            onOpenAuth={onOpenAuth}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {unlocked && (
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Mavzu, bob yoki kalit so'z bo'yicha qidirish..."
              className="w-full rounded-xl border border-input bg-card pl-10 pr-4 py-2.5 text-sm text-foreground"
            />
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {[0, 8, 9, 10, 11].map((g) => (
            <Button
              key={g}
              size="sm"
              variant={gradeFilter === g ? "default" : "secondary"}
              onClick={() => setGradeFilter(g)}
            >
              {g === 0 ? "Barchasi" : `${g}-sinf`}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-36 rounded-xl border border-border bg-card/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lessons.map((l) =>
            l.locked ? (
              <LockedTopicCard key={l.id} onClick={onOpenAuth} />
            ) : (
              <button
                key={l.id}
                type="button"
                onClick={() => onSelectLesson(l.id)}
                className="rounded-xl border border-border bg-card p-5 text-left hover:border-primary/60 transition-all cursor-pointer flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs mb-2">
                    <span className="font-semibold text-primary">
                      {l.gradeNumber}-sinf · {l.lessonNumberLabel}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {completedIds.has(l.id) && <CompletedMarker />}
                      <span className="text-muted-foreground tabular-nums">{l.pageNumber}-bet</span>
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-foreground">{l.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{l.summary}</p>
                </div>
                <div className="text-[11px] text-emerald font-medium flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="truncate max-w-[200px]">{l.chapterTitle}</span>
                  <span className="text-primary flex items-center gap-1">
                    16 qismli dars <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

/* ==================== 3. FULL 16-PART LESSON WORKSPACE ==================== */
export function LessonWorkspacePage({
  lessonId,
  games: _games,
  onNavigate,
  onOpenAuth,
}: {
  lessonId: number;
  games: GameDefinition[];
  onNavigate: (route: RouteKey, param?: number) => void;
  onOpenAuth: () => void;
}) {
  const { user, unlocked, refreshUser } = useAuth();
  const completedIds = useCompletedLessonIds();
  const [justCompleted, setJustCompleted] = useState(false);
  const [lesson, setLesson] = useState<LessonInfo | null>(null);
  const [deck, setDeck] = useState<PresentationDeck | null>(null);
  const [quiz, setQuiz] = useState<QuizInfo | null>(null);
  const [tab, setTab] = useState<"lesson" | "presentation" | "quiz" | "ai">("lesson");
  const [taskAnswers, setTaskAnswers] = useState<Record<string, string>>({});
  const [miniIdx, setMiniIdx] = useState(0);
  const [miniPicked, setMiniPicked] = useState<number | null>(null);
  const [selfChecks, setSelfChecks] = useState<Record<number, boolean>>({});
  const [completedMsg, setCompletedMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lockedStatus, setLockedStatus] = useState<AccessRequestStatus>("none");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLockedStatus("none");
    setTab("lesson");
    setTaskAnswers({});
    setMiniIdx(0);
    setMiniPicked(null);
    setSelfChecks({});
    setJustCompleted(false);
    setCompletedMsg(null);

    apiRequest<{ lesson?: LessonInfo }>(`/api/lessons/${lessonId}`)
      .then(async (res) => {
        if (!active) return;
        if (!res?.lesson) {
          setLesson(null);
          return;
        }
        setLesson(res.lesson);
        const [pRes, qRes] = await Promise.all([
          apiRequest<{ presentation: PresentationDeck }>(`/api/presentations/${res.lesson.presentationId}`).catch(() => null),
          apiRequest<{ quiz: QuizInfo }>(`/api/quizzes/${res.lesson.quizId}`).catch(() => null),
        ]);
        if (!active) return;
        if (pRes?.presentation) setDeck(pRes.presentation);
        if (qRes?.quiz) setQuiz(qRes.quiz);
      })
      .catch((err) => {
        if (!active) return;
        setLesson(null);
        const data = err instanceof ApiRequestError && err.data && typeof err.data === "object" ? err.data : null;
        if (data && "locked" in data && data.locked === true) {
          const status = "requestStatus" in data ? data.requestStatus : undefined;
          setLockedStatus(typeof status === "string" ? (status as AccessRequestStatus) : "none");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lessonId, unlocked, user?.id]);

  async function markCompleted() {
    if (!user || !lesson) {
      setCompletedMsg("Taraqqiyotni saqlash uchun tizimga kiring.");
      return;
    }
    try {
      await apiRequest<{ completed?: boolean; completedLessons?: number }>("/api/student/progress", {
        method: "POST",
        body: JSON.stringify({ lessonId: lesson.id }),
      });
      setJustCompleted(true);
      setCompletedMsg("Mavzu yakunlandi sifatida belgilandi.");
      refreshUser();
    } catch (err) {
      setCompletedMsg(err instanceof Error ? err.message : "Saqlashda xatolik.");
    }
  }

  if (!loading && !lesson) {
    return (
      <LockedTopicsVaultScreen
        onOpenAuth={onOpenAuth}
        onNavigateGames={() => onNavigate("games")}
        onNavigateTests={() => onNavigate("tests")}
        accessRequest={{
          resourceType: "lessons",
          resourceId: lessonId,
          requestStatus: lockedStatus,
        }}
      />
    );
  }

  if (loading || !lesson) {
    return (
      <div className="max-w-5xl mx-auto px-4 pt-28 pb-16">
        <div className="h-96 rounded-2xl border border-border bg-card/50 animate-pulse" />
      </div>
    );
  }

  const c = lesson.content;
  const currentMiniRound = c.miniGame.rounds[miniIdx];
  const isCompleted = justCompleted || completedIds.has(lesson.id);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-24 pb-16 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <Button variant="ghost" size="sm" onClick={() => onNavigate("grades", lesson.gradeNumber)} className="gap-1.5 text-xs">
          <ChevronLeft className="w-4 h-4" /> {lesson.gradeNumber}-sinf darslariga qaytish
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => window.print()} className="gap-1.5 text-xs">
            <Printer className="w-3.5 h-3.5" /> Chop etish
          </Button>
          <Button size="sm" variant="secondary" onClick={() => exportLessonPdf(lesson)} className="gap-1.5 text-xs">
            <FileDown className="w-3.5 h-3.5" /> PDF yuklash
          </Button>
          <Button size="sm" onClick={markCompleted} className="gap-1.5 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" /> Darsni yakunlash
          </Button>
        </div>
      </div>

      {isCompleted && (
        <div className="flex justify-end no-print">
          <CompletedMarker />
        </div>
      )}

      {completedMsg && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-xs text-primary no-print">
          {completedMsg}
        </div>
      )}

      {/* Title Banner */}
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-3 print-section">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-primary">
            {lesson.gradeNumber}-sinf · {lesson.chapterTitle} · {lesson.lessonNumberLabel}
          </span>
          <span className="text-muted-foreground tabular-nums">
            Darslik: {lesson.pageNumber}-bet · {lesson.status === "verified" ? "Tasdiqlangan" : "Qoralama"}
          </span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-bold text-foreground">{c.title}</h1>
        <p className="text-sm text-muted-foreground">{lesson.summary}</p>

        {/* Sub-navigation Tabs */}
        <div className="pt-4 flex flex-wrap gap-2 border-t border-border no-print">
          <Button size="sm" variant={tab === "lesson" ? "default" : "secondary"} onClick={() => setTab("lesson")} className="gap-1.5 text-xs">
            <BookOpen className="w-3.5 h-3.5" /> 16 qismli dars
          </Button>
          <Button
            size="sm"
            variant={tab === "presentation" ? "default" : "secondary"}
            onClick={() => setTab("presentation")}
            className="gap-1.5 text-xs"
          >
            <Presentation className="w-3.5 h-3.5" /> Prezentatsiya ({deck?.slides.length || 8} slayd)
          </Button>
          <Button size="sm" variant={tab === "quiz" ? "default" : "secondary"} onClick={() => setTab("quiz")} className="gap-1.5 text-xs">
            <FileCheck2 className="w-3.5 h-3.5" /> Mavzu testi ({quiz?.questions.length || 10} savol)
          </Button>
          <Button size="sm" variant={tab === "ai" ? "default" : "secondary"} onClick={() => setTab("ai")} className="gap-1.5 text-xs">
            <Sparkles className="w-3.5 h-3.5" /> AI Ustozdan so&apos;rash
          </Button>
        </div>
      </div>

      {tab === "presentation" && deck && <PresentationStudio deck={deck} onDeckUpdated={setDeck} />}
      {tab === "quiz" && quiz && <QuizRunner quiz={quiz} onAttemptSaved={refreshUser} />}
      {tab === "ai" && (
        <LegalAIAssistant lessonId={lesson.id} lessonTitle={lesson.title} gradeNumber={lesson.gradeNumber} embedded />
      )}

      {tab === "lesson" && (
        <div className="space-y-6">
          {/* 2 & 3: Objective + Expected Outcomes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-xl border border-border bg-card p-5 print-section">
              <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">2. Dars maqsadi</div>
              <p className="text-sm text-foreground/95 leading-relaxed">{c.objective}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 print-section">
              <div className="text-xs font-semibold text-emerald uppercase tracking-wider mb-2">3. Kutilayotgan natijalar</div>
              <ul className="space-y-1.5 text-sm text-foreground/90 list-disc pl-5">
                {c.expectedOutcomes.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* 4: Key Terms */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3 print-section">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider">4. Tayanch tushunchalar</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {c.keyTerms.map((k) => (
                <div key={k.term} className="rounded-lg border border-border bg-background/60 p-3.5">
                  <div className="text-sm font-bold text-primary">{k.term}</div>
                  <p className="text-xs sm:text-sm text-foreground/90 mt-1">{k.shortDef}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 5 & 6: Theory + Plain Language */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 print-section">
              <div className="text-xs font-semibold text-primary uppercase tracking-wider">
                5. Nazariy qism (Darslik va qonun moddalari)
              </div>
              {c.theorySections.map((sec, idx) => (
                <div key={idx} className="space-y-1.5 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                  <h4 className="text-sm font-semibold text-foreground">{sec.heading}</h4>
                  <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">{sec.textbookFact}</p>
                  <div className="text-[11px] text-emerald font-medium">
                    Manba: {sec.legalArticles.join(" · ")}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-4 print-section">
              <div className="text-xs font-semibold text-emerald uppercase tracking-wider">
                6. Oddiy va tushunarli tilda izoh
              </div>
              {c.plainExplanations.map((pe, idx) => (
                <div key={idx} className="rounded-lg border border-primary/25 bg-primary/5 p-3.5">
                  <div className="text-xs font-semibold text-primary mb-1">{pe.concept}</div>
                  <p className="text-xs sm:text-sm text-foreground/95 leading-relaxed">{pe.simpleText}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 7 & 8: Life Examples + Legal Cases */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-xl border border-border bg-card p-5 space-y-3 print-section">
              <div className="text-xs font-semibold text-primary uppercase tracking-wider">7. Hayotiy misollar</div>
              {c.lifeExamples.map((ex, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-background/60 p-4 space-y-1.5">
                  <h4 className="text-sm font-semibold text-foreground">{ex.title}</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{ex.situation}</p>
                  <div className="text-xs text-emerald font-medium">Xulosa: {ex.takeaway}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-3 print-section">
              <div className="text-xs font-semibold text-emerald uppercase tracking-wider">8. Huquqiy vaziyat (Kazus)</div>
              {c.legalCases.map((lc, idx) => (
                <div key={idx} className="rounded-lg border border-primary/30 bg-background/70 p-4 space-y-2">
                  <h4 className="text-sm font-bold text-primary">{lc.caseTitle}</h4>
                  <p className="text-xs sm:text-sm text-foreground/90">{lc.facts}</p>
                  <p className="text-xs font-semibold text-foreground">Savol: {lc.question}</p>
                  <div className="pt-2 border-t border-border/60 text-xs sm:text-sm text-emerald">
                    <strong>Qonuniy yechim:</strong> {lc.legalResolution}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Huquqiy asos: {lc.legalBasis}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 9 & 10: Visual Diagram & Animated Diagram */}
          <VisualDiagram
            kind={c.visualDiagram.kind}
            title={`9. ${c.visualDiagram.title}`}
            caption={c.visualDiagram.caption}
            nodes={c.visualDiagram.nodes}
          />
          <AnimatedProcessDiagram title={`10. ${c.animatedDiagram.title}`} steps={c.animatedDiagram.steps} />

          {/* 11: Interactive Tasks */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 no-print">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider">11. Interaktiv topshiriqlar</div>
            {c.interactiveTasks.map((t) => {
              const picked = taskAnswers[t.id];
              const isCorrect = Array.isArray(t.correctAnswer)
                ? t.correctAnswer.includes(picked)
                : picked === t.correctAnswer;
              return (
                <div key={t.id} className="rounded-lg border border-border bg-background/60 p-4 space-y-2.5">
                  <div className="text-sm font-medium text-foreground">{t.prompt}</div>
                  <div className="space-y-1.5">
                    {t.items.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setTaskAnswers((prev) => ({ ...prev, [t.id]: opt }))}
                        className={`w-full rounded-lg border px-3.5 py-2 text-left text-xs sm:text-sm cursor-pointer ${
                          picked === opt
                            ? isCorrect
                              ? "border-primary bg-primary/15 text-foreground"
                              : "border-red-500/60 bg-red-500/10 text-red-200"
                            : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {picked && (
                    <div className={`text-xs ${isCorrect ? "text-primary" : "text-amber-300"}`}>
                      {isCorrect ? "To'g'ri! " : "Eslatma: "}
                      {t.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 12 & 13: Embedded Mini-Game + Quick Jump to Quiz */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 no-print">
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Gamepad2 className="w-4 h-4" /> 12. Mavzu mini-o&apos;yini
                </div>
                <Button size="sm" variant="link" onClick={() => onNavigate("games")} className="text-xs p-0 h-auto">
                  10 ta katta o&apos;yinga o&apos;tish
                </Button>
              </div>
              {currentMiniRound && (
                <div className="space-y-2.5">
                  <p className="text-sm font-medium text-foreground">{currentMiniRound.clue}</p>
                  <div className="space-y-1.5">
                    {currentMiniRound.options.map((opt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setMiniPicked(idx)}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-xs cursor-pointer ${
                          miniPicked === idx
                            ? idx === currentMiniRound.correctIndex
                              ? "border-primary bg-primary/15 text-foreground"
                              : "border-red-500/50 bg-red-500/10 text-red-200"
                            : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {miniPicked !== null && (
                    <div className="flex items-center justify-between gap-2 text-xs text-emerald pt-1">
                      <span>{currentMiniRound.explanation}</span>
                      {c.miniGame.rounds.length > 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setMiniPicked(null);
                            setMiniIdx((i) => (i + 1) % c.miniGame.rounds.length);
                          }}
                        >
                          Keyingi raund
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-primary/30 bg-primary/10 p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-primary uppercase tracking-wider">13. Mavzu bo&apos;yicha yakuniy test</div>
                <h4 className="text-lg font-bold text-foreground mt-1">Bilimingizni 10 ta savolda sinab ko&apos;ring</h4>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Bitta tanlov, ko&apos;p tanlov, moslashtirish, ketma-ketlik va vaziyatli testlar orqali bilimingizni mustahkamlang.
                </p>
              </div>
              <Button onClick={() => setTab("quiz")} className="w-full gap-2">
                <FileCheck2 className="w-4 h-4" /> Testni boshlash
              </Button>
            </div>
          </div>

          {/* 14 & 15: Reinforcement Questions + Error Analysis */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 print-section">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider">12. Mustahkamlash savollari</div>
            <div className="space-y-2.5">
              {c.reinforcementQuestions.map((rq, idx) => (
                <details key={idx} className="rounded-lg border border-border bg-background/60 p-3">
                  <summary className="text-xs sm:text-sm font-medium text-foreground cursor-pointer">
                    {idx + 1}. {rq.question}
                  </summary>
                  <p className="text-xs text-emerald mt-2 pt-2 border-t border-border/50">Yo&apos;naltiruvchi javob: {rq.hint}</p>
                </details>
              ))}
            </div>
          </div>

          {c.errorAnalysis && c.errorAnalysis.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3 print-section">
              <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                13. Xatolar tahlili (Ko&apos;p uchraydigan yanglishishlar)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {c.errorAnalysis.map((ea, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-background/60 p-3.5 space-y-1.5 text-xs">
                    <div className="text-red-300 font-medium">Xato tushuncha: {ea.misconception}</div>
                    <div className="text-emerald font-medium">To&apos;g&apos;ri yechim: {ea.correction}</div>
                    <div className="text-[11px] text-muted-foreground">Huquqiy asos: {ea.legalBasis}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-xl border border-border bg-card p-5 print-section">
              <div className="text-xs font-semibold text-emerald uppercase tracking-wider mb-2">14. Dars xulosasi</div>
              <p className="text-sm text-foreground/90 leading-relaxed">{c.conclusion}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 print-section">
              <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">15. Foydalanilgan darslik manbalari</div>
              <ul className="space-y-2 text-xs text-muted-foreground">
                {c.sources.map((src, i) => (
                  <li key={i}>
                    <strong className="text-foreground">{src.title}</strong> ({src.pages}) — {src.factNote}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {c.selfAssessment && c.selfAssessment.length > 0 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-3 print-section">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-primary uppercase tracking-wider">
                  16. O&apos;z bilimini baholash
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Object.values(selfChecks).filter(Boolean).length} / {c.selfAssessment.length} bajarildi
                </span>
              </div>
              <div className="space-y-2">
                {c.selfAssessment.map((item, idx) => {
                  const checked = Boolean(selfChecks[idx]);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelfChecks((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                      className={`w-full rounded-lg border px-3.5 py-2.5 text-left text-xs sm:text-sm flex items-center gap-3 transition-colors cursor-pointer ${
                        checked
                          ? "border-primary bg-primary/15 text-foreground"
                          : "border-border bg-background/70 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center text-[11px] shrink-0 ${
                          checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        }`}
                      >
                        {checked ? "✓" : ""}
                      </span>
                      <span>{item}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
