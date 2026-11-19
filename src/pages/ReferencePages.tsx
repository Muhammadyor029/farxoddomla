import { useEffect, useState } from "react";
import { Scale, BookMarked, Landmark, Search, Printer, FileDown, CheckCircle2, XCircle } from "lucide-react";
import type { AccessRequestStatus, LegalScenario, LegalTerm, LegislationArticle, ScenarioCategory } from "../../shared/types";
import { apiRequest } from "../lib/api";
import { exportGlossaryPdf, exportScenariosPdf } from "../lib/pdfExport";
import { useAuth } from "../contexts/AuthContext";
import { AccessRequestButton, type AccessListMeta } from "../components/AccessRequestButton";
import { Button } from "../components/ui/button";

const SCENARIO_CATEGORIES: Array<"all" | ScenarioCategory> = [
  "all",
  "Huquq buzilishi",
  "Mehnat huquqi",
  "Oila huquqi",
  "Fuqarolik huquqi",
  "Voyaga yetmaganlar",
  "Ma'muriy huquq",
  "Jinoyat huquqi",
  "Iste'molchi huquqi",
  "Konstitutsiyaviy huquq",
];

/* ==================== PRACTICAL SCENARIOS PAGE ==================== */
export function ScenariosPage({ onOpenAuth }: { onOpenAuth?: () => void }) {
  const { user } = useAuth();
  const [category, setCategory] = useState<"all" | ScenarioCategory>("all");
  const [grade, setGrade] = useState<number>(0);
  const [scenarios, setScenarios] = useState<LegalScenario[]>([]);
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [requestStatus, setRequestStatus] = useState<AccessRequestStatus>("none");

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (grade) params.set("grade", String(grade));
    if (category !== "all") params.set("category", category);
    apiRequest<AccessListMeta & { scenarios?: LegalScenario[] }>(`/api/scenarios?${params.toString()}`)
      .then((res) => {
        if (active) {
          setScenarios(Array.isArray(res?.scenarios) ? res.scenarios : []);
          setLocked(Boolean(res?.locked));
          setRequestStatus(res?.requestStatus || "none");
        }
      })
      .catch(() => {
        if (active) setScenarios([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [grade, category, user?.id]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-24 pb-16 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary flex items-center gap-1.5">
            <Scale className="w-4 h-4" /> Real kazuslar laboratoriyasi
          </span>
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground mt-1">Amaliy vaziyatlar (9 ta huquq sohasi)</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {locked && (
            <AccessRequestButton
              resourceType="scenarios"
              resourceId={0}
              requestStatus={requestStatus}
              onOpenAuth={onOpenAuth}
            />
          )}
          <Button size="sm" variant="secondary" onClick={() => window.print()} className="gap-1.5 text-xs">
            <Printer className="w-3.5 h-3.5" /> Chop etish
          </Button>
          <Button size="sm" variant="secondary" onClick={() => exportScenariosPdf(scenarios)} className="gap-1.5 text-xs">
            <FileDown className="w-3.5 h-3.5" /> PDF yuklash
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 no-print">
        <div className="flex flex-wrap gap-1.5">
          {[0, 8, 9, 10, 11].map((g) => (
            <Button key={g} size="sm" variant={grade === g ? "default" : "secondary"} onClick={() => setGrade(g)}>
              {g === 0 ? "Barcha sinflar" : `${g}-sinf`}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SCENARIO_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                category === cat
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat === "all" ? "Barcha sohalar" : cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 rounded-2xl border border-border bg-card/50 animate-pulse" />
      ) : (
        <div className="space-y-5">
          {locked && (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
              Bo&apos;lim qulflangan. Ruxsat olish uchun so&apos;rov yuboring.
            </div>
          )}
          {scenarios.map((sc) => {
            const chosenId = picked[sc.id];
            const chosenChoice = sc.choices.find((c) => c.id === chosenId);
            return (
              <div key={sc.id} className="rounded-2xl border border-border bg-card p-6 space-y-4 print-section">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-primary">
                    {sc.category} · {sc.gradeNumber}-sinf
                  </span>
                  <span className="text-muted-foreground">{sc.relatedConcepts.join(" · ")}</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-foreground">{sc.title}</h3>
                <p className="text-sm text-foreground/90 leading-relaxed">{sc.eventDescription}</p>
                <div className="text-xs font-semibold text-emerald">Huquqiy muammo: {sc.legalProblem}</div>

                <div className="space-y-2 pt-2">
                  <div className="text-xs text-muted-foreground font-medium">Qaror tanlang:</div>
                  {sc.choices.map((ch) => {
                    const active = chosenId === ch.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setPicked((prev) => ({ ...prev, [sc.id]: ch.id }))}
                        className={`w-full rounded-xl border px-4 py-3 text-left text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          active
                            ? ch.isCorrect
                              ? "border-primary bg-primary/15 text-foreground"
                              : "border-red-500/60 bg-red-500/10 text-red-200"
                            : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span>{ch.label}</span>
                        {active &&
                          (ch.isCorrect ? (
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                          ))}
                      </button>
                    );
                  })}
                </div>

                {chosenChoice && (
                  <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 space-y-1.5 text-xs sm:text-sm">
                    <div className="font-semibold text-foreground">{chosenChoice.feedback}</div>
                    <div className="text-foreground/90">
                      <strong>Qonuniy yechim:</strong> {sc.solutionSummary}
                    </div>
                    <div className="text-emerald font-medium">Huquqiy asos: {sc.legalBasis}</div>
                    <div className="text-muted-foreground">Tahlil: {sc.analysisNote}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ==================== GLOSSARY PAGE ==================== */
export function GlossaryPage({ onOpenAuth }: { onOpenAuth?: () => void }) {
  const { user } = useAuth();
  const [grade, setGrade] = useState(0);
  const [q, setQ] = useState("");
  const [terms, setTerms] = useState<LegalTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [requestStatus, setRequestStatus] = useState<AccessRequestStatus>("none");

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (grade) params.set("grade", String(grade));
    if (q.trim()) params.set("q", q.trim());
    apiRequest<AccessListMeta & { terms?: LegalTerm[] }>(`/api/glossary?${params.toString()}`)
      .then((res) => {
        if (active) {
          setTerms(Array.isArray(res?.terms) ? res.terms : []);
          setLocked(Boolean(res?.locked));
          setRequestStatus(res?.requestStatus || "none");
        }
      })
      .catch(() => {
        if (active) setTerms([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [grade, q, user?.id]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-24 pb-16 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary flex items-center gap-1.5">
            <BookMarked className="w-4 h-4" /> Alifbo tartibidagi izohli lug&apos;at
          </span>
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground mt-1">Huquqiy lug&apos;at</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {locked && (
            <AccessRequestButton
              resourceType="glossary"
              resourceId={0}
              requestStatus={requestStatus}
              onOpenAuth={onOpenAuth}
            />
          )}
          <Button size="sm" variant="secondary" onClick={() => window.print()} className="gap-1.5 text-xs">
            <Printer className="w-3.5 h-3.5" /> Chop etish
          </Button>
          <Button size="sm" variant="secondary" onClick={() => exportGlossaryPdf(terms)} className="gap-1.5 text-xs">
            <FileDown className="w-3.5 h-3.5" /> PDF yuklash
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 no-print">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Atama yoki ta'rif bo'yicha qidirish..."
            className="w-full rounded-xl border border-input bg-card pl-10 pr-4 py-2.5 text-sm text-foreground"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[0, 8, 9, 10, 11].map((g) => (
            <Button key={g} size="sm" variant={grade === g ? "default" : "secondary"} onClick={() => setGrade(g)}>
              {g === 0 ? "Barchasi" : `${g}-sinf`}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 rounded-xl bg-card/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {locked && (
            <div className="md:col-span-2 rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
              Bo&apos;lim qulflangan. Ruxsat olish uchun so&apos;rov yuboring.
            </div>
          )}
          {terms.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-card p-5 space-y-2 print-section">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base sm:text-lg font-bold text-primary">{t.term}</h3>
                <span className="text-xs text-muted-foreground tabular-nums">{t.gradeNumber}-sinf</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{t.shortDefinition}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{t.extendedNote}</p>
              <div className="pt-2 border-t border-border/60 text-xs text-emerald">
                <strong>Hayotiy misol:</strong> {t.lifeExample}
              </div>
              <div className="text-[11px] text-muted-foreground">Manba: {t.sourcePage}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==================== UZBEKISTAN LEGISLATION EXPLORER ==================== */
export function LegislationPage({ onOpenAuth }: { onOpenAuth?: () => void }) {
  const { user } = useAuth();
  const [codeFilter, setCodeFilter] = useState("all");
  const [q, setQ] = useState("");
  const [articles, setArticles] = useState<LegislationArticle[]>([]);
  const [locked, setLocked] = useState(false);
  const [requestStatus, setRequestStatus] = useState<AccessRequestStatus>("none");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (codeFilter !== "all") params.set("code", codeFilter);
    if (q.trim()) params.set("q", q.trim());
    apiRequest<AccessListMeta & { articles?: LegislationArticle[] }>(`/api/legislation?${params.toString()}`)
      .then((res) => {
        if (active) {
          setArticles(Array.isArray(res?.articles) ? res.articles : []);
          setLocked(Boolean(res?.locked));
          setRequestStatus(res?.requestStatus || "none");
        }
      })
      .catch(() => {
        if (active) setArticles([]);
      });
    return () => {
      active = false;
    };
  }, [codeFilter, q, user?.id]);

  const codeOptions = [
    "all",
    "O'zbekiston Respublikasi Konstitutsiyasi",
    "O'zbekiston Respublikasi Fuqarolik kodeksi",
    "O'zbekiston Respublikasi Oila kodeksi",
    "O'zbekiston Respublikasi Mehnat kodeksi",
    "Ma'muriy javobgarlik to'g'risidagi kodeks (MJTK)",
    "O'zbekiston Respublikasi Jinoyat kodeksi",
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-24 pb-16 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary flex items-center gap-1.5">
            <Landmark className="w-4 h-4" /> Darslik moddalari ma&apos;lumotnomasi
          </span>
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground mt-1">O&apos;zbekiston qonunchiligi</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {locked && (
            <AccessRequestButton
              resourceType="legislation"
              resourceId={0}
              requestStatus={requestStatus}
              onOpenAuth={onOpenAuth}
            />
          )}
          <Button size="sm" variant="secondary" onClick={() => window.print()} className="gap-1.5 text-xs">
            <Printer className="w-3.5 h-3.5" /> Chop etish
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 no-print">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Modda raqami yoki kalit so'z (masalan: 27-modda, aliment, 106)..."
            className="w-full rounded-xl border border-input bg-card pl-10 pr-4 py-2.5 text-sm text-foreground"
          />
        </div>
        <select
          value={codeFilter}
          onChange={(e) => setCodeFilter(e.target.value)}
          className="rounded-xl border border-input bg-card px-4 py-2.5 text-sm text-foreground"
        >
          {codeOptions.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "Barcha kodeks va Konstitutsiya" : c}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {locked && (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
            Bo&apos;lim qulflangan. Ruxsat olish uchun so&apos;rov yuboring.
          </div>
        )}
        {articles.map((art) => (
          <div key={art.id} className="rounded-2xl border border-border bg-card p-6 space-y-2.5 print-section">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-primary">
                {art.codeName} · {art.articleNumber}
              </span>
              <span className="text-muted-foreground">{art.sourcePage}</span>
            </div>
            <h3 className="text-lg font-bold text-foreground">{art.title}</h3>
            <p className="text-sm text-foreground/90 leading-relaxed">{art.summaryText}</p>
            <div className="rounded-lg border border-border bg-background/60 p-3 text-xs text-emerald">
              <strong>Amaliy ahamiyati:</strong> {art.practicalMeaning}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
