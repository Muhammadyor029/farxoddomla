import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Shuffle,
  Printer,
  FileDown,
  ArrowUp,
  ArrowDown,
  Award,
  RotateCcw,
} from "lucide-react";
import type { QuizInfo, QuizQuestion } from "../../../shared/types";
import { apiRequest } from "../../lib/api";
import { exportQuizPdf } from "../../lib/pdfExport";
import { Button } from "../ui/button";
import { VisualDiagram } from "../diagrams/LegalDiagrams";

interface QuizRunnerProps {
  quiz: QuizInfo;
  onAttemptSaved?: () => void;
}

interface QuizResult {
  score: number;
  maxScore: number;
  percentage: number;
  elapsedSeconds: number;
  correctCount: number;
  totalQuestions: number;
  recommendations: string[];
  xpEarned: number;
  breakdown: Array<{ questionId: string; prompt: string; isCorrect: boolean; explanation: string }>;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function QuizRunner({ quiz, onAttemptSaved }: QuizRunnerProps) {
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orderedQuestions = useMemo(() => {
    const qs = shuffleArray(quiz.questions);
    return qs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.id, shuffleSeed]);

  useEffect(() => {
    // Initialize ordering questions with shuffled order so student must arrange them
    const init: Record<string, unknown> = {};
    orderedQuestions.forEach((q) => {
      if (q.type === "ordering") {
        init[q.id] = shuffleArray(q.options);
      }
    });
    setAnswers(init);
    setResult(null);
    setElapsedSeconds(0);
    setError(null);
  }, [orderedQuestions]);

  useEffect(() => {
    if (result) return;
    const t = window.setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [result]);

  function toggleMultiOption(qId: string, optionIdx: number) {
    setAnswers((prev) => {
      const current = Array.isArray(prev[qId]) ? (prev[qId] as number[]) : [];
      const next = current.includes(optionIdx)
        ? current.filter((i) => i !== optionIdx)
        : [...current, optionIdx];
      return { ...prev, [qId]: next };
    });
  }

  function moveOrderItem(qId: string, index: number, dir: -1 | 1, fallbackList: string[]) {
    const current = Array.isArray(answers[qId]) ? [...(answers[qId] as string[])] : [...fallbackList];
    const target = index + dir;
    if (target < 0 || target >= current.length) return;
    [current[index], current[target]] = [current[target], current[index]];
    setAnswers((prev) => ({ ...prev, [qId]: current }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiRequest<{ attempt: QuizResult }>("/api/quiz-attempts", {
        method: "POST",
        body: JSON.stringify({
          quizId: quiz.id,
          answers,
          elapsedSeconds,
        }),
      });
      setResult(res.attempt);
      onAttemptSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Testni tekshirishda xatolik yuz berdi.");
    } finally {
      setSubmitting(false);
    }
  }

  const formatClock = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-5">
      {/* Quiz Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 no-print">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-foreground">{quiz.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
            {orderedQuestions.length} ta savol · Tavsiya etilgan vaqt: {quiz.timeLimitMinutes} daq · Amaldagi vaqt:{" "}
            <strong className="text-primary">{formatClock(elapsedSeconds)}</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShuffleSeed((s) => s + 1)}
            className="gap-1.5 text-xs"
          >
            <Shuffle className="w-3.5 h-3.5" /> Savollarni aralashtirish
          </Button>
          <Button size="sm" variant="secondary" onClick={() => window.print()} className="gap-1.5 text-xs">
            <Printer className="w-3.5 h-3.5" /> Chop etish
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => exportQuizPdf(quiz, Boolean(result))}
            className="gap-1.5 text-xs"
          >
            <FileDown className="w-3.5 h-3.5" /> PDF ({result ? "Kalit bilan" : "Savollar"})
          </Button>
        </div>
      </div>

      {/* Results View */}
      {result && (
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-6 space-y-5 print-section">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/50 flex items-center justify-center">
                <Award className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="text-xs text-primary font-semibold uppercase tracking-wider">Test natijasi</div>
                <h4 className="text-2xl font-bold text-foreground tabular-nums">
                  {result.score} / {result.maxScore} ball ({result.percentage}%)
                </h4>
              </div>
            </div>
            <div className="flex items-center gap-5 text-xs sm:text-sm">
              <span className="tabular-nums">
                To'g'ri: <strong className="text-primary">{result.correctCount}</strong> / {result.totalQuestions}
              </span>
              <span className="flex items-center gap-1 tabular-nums text-muted-foreground">
                <Clock className="w-3.5 h-3.5" /> {formatClock(result.elapsedSeconds)}
              </span>
              {result.xpEarned > 0 && (
                <span className="font-bold text-emerald tabular-nums">+{result.xpEarned} XP</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/80 p-4 space-y-2">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider">Tavsiyalar</div>
            <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-foreground/90">
              {result.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2.5">
            {result.breakdown.map((b, i) => (
              <div
                key={b.questionId}
                className={`rounded-xl border p-3.5 text-xs sm:text-sm ${
                  b.isCorrect ? "border-primary/40 bg-primary/5" : "border-red-500/40 bg-red-500/5"
                }`}
              >
                <div className="flex items-start gap-2 font-medium text-foreground">
                  {b.isCorrect ? (
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <span>
                    {i + 1}. {b.prompt}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1.5 pl-6">{b.explanation}</p>
              </div>
            ))}
          </div>

          <Button onClick={() => setShuffleSeed((s) => s + 1)} className="gap-2 no-print">
            <RotateCcw className="w-4 h-4" /> Qayta topshirish
          </Button>
        </div>
      )}

      {/* Questions List */}
      {!result && (
        <div className="space-y-4">
          {orderedQuestions.map((q: QuizQuestion, qIdx: number) => (
            <div key={q.id} className="rounded-xl border border-border bg-card p-5 space-y-3 print-section">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-primary tabular-nums">
                  {qIdx + 1}-savol ·{" "}
                  {q.type === "single"
                    ? "Bitta tanlov"
                    : q.type === "multiple"
                    ? "Ko'p tanlov"
                    : q.type === "true_false"
                    ? "To'g'ri / Noto'g'ri"
                    : q.type === "matching"
                    ? "Moslashtirish"
                    : q.type === "ordering"
                    ? "Ketma-ketlik"
                    : q.type === "visual"
                    ? "Vizual sxema testi"
                    : "Vaziyatli test"}
                </span>
                <span className="tabular-nums">{q.points} ball</span>
              </div>

              <p className="text-sm sm:text-base font-medium text-foreground">{q.prompt}</p>

              {q.type === "visual" && q.diagramKind && (
                <VisualDiagram
                  kind={q.diagramKind}
                  title="Test uchun vizual sxema"
                  caption="Sxema elementlariga qarab savolga javob bering"
                  nodes={[
                    { id: "v1", level: 1, label: "Asosiy pog'ona", detail: "Qonunchilik va huquqiy himoya asosi" },
                    { id: "v2", level: 2, label: "Ijro va Kafolat", detail: "Huquqlarning amaliy bajarilishi" },
                  ]}
                />
              )}

              {(q.type === "single" || q.type === "true_false" || q.type === "case" || q.type === "visual") && (
                <div className="space-y-2">
                  {q.options.map((opt, oIdx) => {
                    const checked = answers[q.id] === oIdx;
                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: oIdx }))}
                        className={`w-full rounded-lg border px-4 py-2.5 text-left text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-3 ${
                          checked
                            ? "border-primary bg-primary/15 text-foreground"
                            : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-primary/40"
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full border flex items-center justify-center text-[11px] font-bold shrink-0 ${
                            checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                          }`}
                        >
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === "multiple" && (
                <div className="space-y-2">
                  {q.options.map((opt, oIdx) => {
                    const list = Array.isArray(answers[q.id]) ? (answers[q.id] as number[]) : [];
                    const checked = list.includes(oIdx);
                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => toggleMultiOption(q.id, oIdx)}
                        className={`w-full rounded-lg border px-4 py-2.5 text-left text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-3 ${
                          checked
                            ? "border-primary bg-primary/15 text-foreground"
                            : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center text-[11px] shrink-0 ${
                            checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                          }`}
                        >
                          {checked ? "✓" : ""}
                        </span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === "matching" && q.matchPairs && (
                <div className="space-y-2">
                  {q.matchPairs.map((pair, pIdx) => {
                    const currentMap = (answers[q.id] as Record<string, string> | undefined) || {};
                    return (
                      <div
                        key={pIdx}
                        className="grid grid-cols-1 md:grid-cols-2 gap-2.5 items-center rounded-lg border border-border bg-background/60 p-3"
                      >
                        <span className="text-xs sm:text-sm font-medium text-foreground">{pair.left}</span>
                        <select
                          value={currentMap[pair.left] || ""}
                          onChange={(e) =>
                            setAnswers((prev) => ({
                              ...prev,
                              [q.id]: { ...currentMap, [pair.left]: e.target.value },
                            }))
                          }
                          className="rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground"
                        >
                          <option value="">Mosini tanlang...</option>
                          {q.options.map((opt, oIdx) => (
                            <option key={oIdx} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}

              {q.type === "ordering" && (
                <div className="space-y-2">
                  {(Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : q.options).map((item, idx) => (
                    <div
                      key={item}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/70 px-3.5 py-2.5 text-xs sm:text-sm"
                    >
                      <span>
                        <strong className="text-primary mr-2 tabular-nums">{idx + 1}.</strong>
                        {item}
                      </span>
                      <div className="flex items-center gap-1 no-print">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveOrderItem(q.id, idx, -1, q.options)}
                          disabled={idx === 0}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveOrderItem(q.id, idx, 1, q.options)}
                          disabled={idx === q.options.length - 1}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {error && <div className="text-xs text-red-400">{error}</div>}

          <div className="flex justify-end no-print">
            <Button size="lg" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Tekshirilmoqda..." : "Testni yakunlash va natijani ko'rish"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
