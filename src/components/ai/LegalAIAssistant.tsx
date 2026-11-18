import { useState } from "react";
import { Sparkles, Send, X, AlertTriangle, Loader2, BookOpen } from "lucide-react";
import { apiRequest } from "../../lib/api";
import { Button } from "../ui/button";

type AiTask = "chat" | "explain" | "define" | "generate_quiz" | "analyze_case" | "generate_slides";

interface LegalAIAssistantProps {
  lessonId?: number;
  lessonTitle?: string;
  gradeNumber?: number;
  embedded?: boolean;
}

const TASK_LABELS: Array<{ id: AiTask; label: string; placeholder: string }> = [
  { id: "chat", label: "Savol-javob", placeholder: "Huquqiy savolingizni yozing..." },
  { id: "explain", label: "Sodda tushuntirish", placeholder: "Qaysi modda yoki mavzuni sodda tushuntirib beray?" },
  { id: "define", label: "Atama izohi", placeholder: "Huquqiy atamani yozing (masalan: Xabeas korpus)..." },
  { id: "analyze_case", label: "Vaziyat tahlili", placeholder: "Hayotiy huquqiy vaziyatni qisqacha yozing..." },
  { id: "generate_quiz", label: "Test tuzish", placeholder: "Qaysi mavzu bo'yicha 3 ta test tuzay?" },
  { id: "generate_slides", label: "Slayd rejasi", placeholder: "Qaysi dars uchun prezentatsiya tuzilmasini tuzay?" },
];

export function LegalAIAssistant({
  lessonId,
  lessonTitle,
  gradeNumber = 9,
  embedded = false,
}: LegalAIAssistantProps) {
  const [open, setOpen] = useState(embedded);
  const [task, setTask] = useState<AiTask>("chat");
  const [prompt, setPrompt] = useState(lessonTitle ? `"${lessonTitle}" mavzusini sodda hayotiy misollar bilan tushuntiring.` : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<
    Array<{ role: "user" | "ai"; task: string; text: string; disclaimer?: string; model?: string }>
  >([]);

  const currentTaskMeta = TASK_LABELS.find((t) => t.id === task) || TASK_LABELS[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = prompt.trim();
    if (!clean || loading) return;

    setError(null);
    setLoading(true);
    setHistory((prev) => [...prev, { role: "user", task: currentTaskMeta.label, text: clean }]);
    try {
      const res = await apiRequest<{ text: string; disclaimer: string; model: string }>("/api/ai/task", {
        method: "POST",
        body: JSON.stringify({ task, prompt: clean, gradeNumber, lessonId }),
      });
      setHistory((prev) => [
        ...prev,
        { role: "ai", task: currentTaskMeta.label, text: res.text, disclaimer: res.disclaimer, model: res.model },
      ]);
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI javobini olishda xatolik.");
    } finally {
      setLoading(false);
    }
  }

  if (!embedded && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="no-print fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-xl border border-primary/50 bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-[0_0_28px_rgba(57,255,85,0.28)] hover:border-primary hover:bg-secondary transition-all cursor-pointer"
      >
        <Sparkles className="w-4 h-4 text-primary" />
        <span>Huquqiy AI Ustoz</span>
      </button>
    );
  }

  return (
    <div
      className={
        embedded
          ? "rounded-xl border border-border bg-card p-5 no-print"
          : "no-print fixed bottom-5 right-5 z-50 w-[94vw] max-w-lg rounded-2xl border border-primary/40 bg-card p-5 shadow-[0_20px_60px_rgba(0,0,0,0.65)]"
      }
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/40 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Huquqiy AI Ustoz</h3>
            <p className="text-[11px] text-muted-foreground">
              8–11-sinf darsliklariga asoslangan server AI yordamchisi
            </p>
          </div>
        </div>
        {!embedded && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
            aria-label="Yopish"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {TASK_LABELS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTask(item.id)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
              task === item.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="max-h-72 overflow-y-auto space-y-3 mb-3 pr-1">
        {history.length === 0 && (
          <div className="rounded-lg border border-border bg-background/60 p-3 text-xs text-muted-foreground space-y-2">
            <div className="flex items-center gap-1.5 text-foreground font-medium">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span>Tezkor savol namunalari:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Miranda qoidasi nima?",
                "16 yoshli o'quvchi necha soat ishlashi mumkin?",
                "Mehnat shartnomasi nima uchun kerak?",
              ].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setPrompt(sample)}
                  className="rounded-md border border-border bg-secondary/70 px-2 py-1 text-[11px] text-foreground hover:border-primary/50 cursor-pointer"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((msg, idx) => (
          <div
            key={idx}
            className={`rounded-lg p-3 text-xs sm:text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-secondary/90 border border-border text-foreground ml-6"
                : "bg-primary/10 border border-primary/30 text-foreground mr-2"
            }`}
          >
            <div className="text-[11px] font-semibold text-primary mb-1">
              {msg.role === "user" ? `Siz (${msg.task})` : `AI Ustoz · ${msg.model || "Gemini"}`}
            </div>
            <div className="whitespace-pre-wrap">{msg.text}</div>
            {msg.disclaimer && (
              <div className="mt-2 pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
                {msg.disclaimer}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={currentTaskMeta.placeholder}
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button type="submit" size="sm" disabled={loading || !prompt.trim()} className="gap-1.5">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span className="hidden sm:inline">Yuborish</span>
        </Button>
      </form>
    </div>
  );
}
