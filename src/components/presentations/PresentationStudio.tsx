import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Printer,
  FileDown,
  Edit3,
  Eye,
  Check,
} from "lucide-react";
import type { DiagramKind, PresentationDeck, PresentationSlide, SlideLayout } from "../../../shared/types";
import { apiRequest } from "../../lib/api";
import { exportPresentationPdf } from "../../lib/pdfExport";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/button";
import { VisualDiagram } from "../diagrams/LegalDiagrams";

interface PresentationStudioProps {
  deck: PresentationDeck;
  onDeckUpdated?: (deck: PresentationDeck) => void;
}

const LAYOUT_OPTIONS: Array<{ value: SlideLayout; label: string }> = [
  { value: "title", label: "Sarlavha slaydi" },
  { value: "objectives", label: "Maqsad va natijalar" },
  { value: "terms", label: "Tayanch atamalar" },
  { value: "pyramid", label: "Piramida sxemasi" },
  { value: "flowchart", label: "Jarayon sxemasi" },
  { value: "comparison", label: "Qiyosiy jadval" },
  { value: "case_study", label: "Huquqiy vaziyat" },
  { value: "quiz", label: "Tezkor savollar" },
  { value: "image", label: "Rasm va izoh" },
  { value: "summary", label: "Yakuniy xulosa" },
];

const TONE_CLASSES: Record<PresentationSlide["backgroundTone"], string> = {
  obsidian: "bg-gradient-to-br from-[#080B09] via-[#111713] to-[#1A211C]",
  emerald: "bg-gradient-to-br from-[#08120D] via-[#0F2419] to-[#122D20]",
  slate: "bg-gradient-to-br from-[#111713] via-[#18221C] to-[#1E2B23]",
  contrast: "bg-gradient-to-br from-[#0B0F0D] via-[#17211B] to-[#0D1A12]",
};

export function PresentationStudio({ deck: initialDeck, onDeckUpdated }: PresentationStudioProps) {
  const { user } = useAuth();
  const [deck, setDeck] = useState<PresentationDeck>(initialDeck);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [fullscreen, setFullscreen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setDeck(initialDeck);
    setCurrentIdx(0);
  }, [initialDeck]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode === "edit") return;
      if (e.key === "ArrowRight") setCurrentIdx((i) => Math.min(deck.slides.length - 1, i + 1));
      if (e.key === "ArrowLeft") setCurrentIdx((i) => Math.max(0, i - 1));
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deck.slides.length, mode]);

  const currentSlide = deck.slides[currentIdx] || deck.slides[0];

  function updateSlide(patch: Partial<PresentationSlide>) {
    setDeck((prev) => ({
      ...prev,
      slides: prev.slides.map((s, idx) => (idx === currentIdx ? { ...s, ...patch } : s)),
    }));
  }

  function addSlide() {
    const newSlide: PresentationSlide = {
      id: `s-${deck.id}-${Date.now()}`,
      order: deck.slides.length + 1,
      layout: "terms",
      title: "Yangi slayd sarlavhasi",
      subtitle: "Qo'shimcha izoh yoki qonuniy asos",
      bullets: ["Asosiy fikr 1", "Hayotiy misol 2", "Huquqiy xulosa 3"],
      accentColor: "#39FF55",
      backgroundTone: "obsidian",
      speakerNotes: "O'qituvchi uchun nutq matni",
    };
    setDeck((prev) => ({ ...prev, slides: [...prev.slides, newSlide] }));
    setCurrentIdx(deck.slides.length);
  }

  function deleteCurrentSlide() {
    if (deck.slides.length <= 1) return;
    setDeck((prev) => ({
      ...prev,
      slides: prev.slides.filter((_, idx) => idx !== currentIdx).map((s, idx) => ({ ...s, order: idx + 1 })),
    }));
    setCurrentIdx((i) => Math.max(0, i - 1));
  }

  function moveSlide(direction: -1 | 1) {
    const target = currentIdx + direction;
    if (target < 0 || target >= deck.slides.length) return;
    const copy = [...deck.slides];
    const [removed] = copy.splice(currentIdx, 1);
    copy.splice(target, 0, removed);
    setDeck((prev) => ({
      ...prev,
      slides: copy.map((s, idx) => ({ ...s, order: idx + 1 })),
    }));
    setCurrentIdx(target);
  }

  async function saveChanges() {
    if (!user) {
      setSaveMessage("Saqlash uchun tizimga kiring (O'qituvchi yoki O'quvchi).");
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      await apiRequest(`/api/presentations/${deck.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: deck.title,
          templateName: deck.templateName,
          slides: deck.slides,
        }),
      });
      setSaveMessage("Prezentatsiya ma'lumotlar bazasiga saqlandi!");
      onDeckUpdated?.(deck);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Saqlashda xatolik yuz berdi.");
    } finally {
      setSaving(false);
    }
  }

  if (!currentSlide) return null;

  return (
    <div className={fullscreen ? "fixed inset-0 z-50 bg-hero-bg p-4 sm:p-8 flex flex-col overflow-y-auto" : "space-y-4"}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 no-print">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={mode === "view" ? "default" : "secondary"}
            onClick={() => setMode("view")}
            className="gap-1.5 text-xs"
          >
            <Eye className="w-3.5 h-3.5" /> Ko'rish
          </Button>
          <Button
            size="sm"
            variant={mode === "edit" ? "default" : "secondary"}
            onClick={() => setMode("edit")}
            className="gap-1.5 text-xs"
          >
            <Edit3 className="w-3.5 h-3.5" /> Tahrirlash
          </Button>
          <Button size="sm" variant="outline" onClick={addSlide} className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" /> Slayd qo'shish
          </Button>
          {mode === "edit" && (
            <Button size="sm" onClick={saveChanges} disabled={saving} className="gap-1.5 text-xs">
              <Save className="w-3.5 h-3.5" /> {saving ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={() => window.print()} className="gap-1.5 text-xs">
            <Printer className="w-3.5 h-3.5" /> Chop etish
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => exportPresentationPdf(deck)}
            className="gap-1.5 text-xs"
          >
            <FileDown className="w-3.5 h-3.5" /> PDF yuklab olish
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFullscreen((f) => !f)}
            className="gap-1.5 text-xs"
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {fullscreen ? "Yopish" : "To'liq ekran"}
          </Button>
        </div>
      </div>

      {saveMessage && (
        <div className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-xs text-primary flex items-center gap-2 no-print">
          <Check className="w-4 h-4" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Main Viewer + Optional Editor Split */}
      <div className={`grid gap-5 ${mode === "edit" ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1"}`}>
        {/* Active Slide Stage */}
        <div className={mode === "edit" ? "lg:col-span-7" : ""}>
          <div
            className={`relative rounded-2xl border border-border overflow-hidden p-6 sm:p-10 min-h-[420px] flex flex-col justify-between shadow-[0_24px_60px_rgba(0,0,0,0.45)] ${
              TONE_CLASSES[currentSlide.backgroundTone]
            }`}
          >
            <div
              className="absolute top-0 left-0 right-0 h-1.5"
              style={{ backgroundColor: currentSlide.accentColor || "#39FF55" }}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
              <span className="uppercase tracking-widest font-semibold" style={{ color: currentSlide.accentColor }}>
                HUQUQ OLAMI · {deck.gradeNumber}-SINF
              </span>
              <span className="tabular-nums">
                Slayd {currentIdx + 1} / {deck.slides.length}
              </span>
            </div>

            <div className="my-auto space-y-5">
              <div>
                <h3 className="text-2xl sm:text-3xl font-bold text-soft-white text-foreground leading-tight">
                  {currentSlide.title}
                </h3>
                {currentSlide.subtitle && (
                  <p className="text-sm sm:text-base text-muted-foreground mt-2">{currentSlide.subtitle}</p>
                )}
              </div>

              {currentSlide.layout === "image" && currentSlide.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-border max-h-56">
                  <img
                    src={currentSlide.imageUrl}
                    alt={currentSlide.title}
                    className="w-full h-56 object-cover"
                  />
                </div>
              )}

              {(currentSlide.layout === "pyramid" || currentSlide.layout === "flowchart") && currentSlide.diagramKind ? (
                <VisualDiagram
                  kind={currentSlide.diagramKind}
                  title={currentSlide.title}
                  caption={currentSlide.subtitle || ""}
                  nodes={currentSlide.bullets.map((b, idx) => {
                    const [lbl, ...rest] = b.split(":");
                    return {
                      id: `sl-n-${idx}`,
                      level: idx + 1,
                      label: lbl,
                      detail: rest.join(":").trim() || lbl,
                    };
                  })}
                />
              ) : currentSlide.layout === "comparison" && currentSlide.tableRows?.length ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <tbody>
                      {currentSlide.tableRows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={rIdx === 0 ? "bg-primary/15 font-semibold text-foreground" : "border-t border-border bg-card/40"}
                        >
                          <td className="p-3 border-r border-border w-1/2">{row.left}</td>
                          <td className="p-3 w-1/2">{row.right}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <ul className="space-y-3">
                  {currentSlide.bullets.map((b, bIdx) => (
                    <li
                      key={bIdx}
                      className="flex items-start gap-3 rounded-xl border border-border/70 bg-black/25 px-4 py-3 text-sm sm:text-base text-foreground/95"
                    >
                      <span
                        className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: currentSlide.accentColor || "#39FF55" }}
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {currentSlide.speakerNotes && (
              <div className="mt-6 pt-3 border-t border-border/60 text-xs text-muted-foreground">
                <strong className="text-foreground">Izoh:</strong> {currentSlide.speakerNotes}
              </div>
            )}
          </div>

          {/* Slide Navigation Controls */}
          <div className="mt-3 flex items-center justify-between gap-3 no-print">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Oldingi
            </Button>

            <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
              {deck.slides.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCurrentIdx(idx)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium tabular-nums transition-colors cursor-pointer ${
                    idx === currentIdx
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentIdx((i) => Math.min(deck.slides.length - 1, i + 1))}
              disabled={currentIdx === deck.slides.length - 1}
              className="gap-1"
            >
              Keyingi <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Interactive Presentation Editor Panel */}
        {mode === "edit" && (
          <div className="lg:col-span-5 rounded-2xl border border-border bg-card p-5 space-y-4 no-print">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">
                Slayd #{currentIdx + 1} tahrirlash
              </h4>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => moveSlide(-1)} disabled={currentIdx === 0} title="Oldinga">
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => moveSlide(1)}
                  disabled={currentIdx === deck.slides.length - 1}
                  title="Keyinga"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={deleteCurrentSlide}
                  disabled={deck.slides.length <= 1}
                  className="text-red-400 hover:text-red-300"
                  title="O'chirish"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1">Prezentatsiya sarlavhasi</label>
                <input
                  type="text"
                  value={deck.title}
                  onChange={(e) => setDeck((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-muted-foreground mb-1">Slayd maketi</label>
                  <select
                    value={currentSlide.layout}
                    onChange={(e) => updateSlide({ layout: e.target.value as SlideLayout })}
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-foreground"
                  >
                    {LAYOUT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Fon uslubi</label>
                  <select
                    value={currentSlide.backgroundTone}
                    onChange={(e) =>
                      updateSlide({ backgroundTone: e.target.value as PresentationSlide["backgroundTone"] })
                    }
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-foreground"
                  >
                    <option value="obsidian">Chuqur grafit</option>
                    <option value="emerald">Zumrad nur</option>
                    <option value="slate">Mineral tosh</option>
                    <option value="contrast">Yuqori kontrast</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-muted-foreground mb-1">Urg'u rangi</label>
                  <div className="flex items-center gap-2">
                    {["#39FF55", "#00C875", "#38BDF8", "#FACC15"].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => updateSlide({ accentColor: col })}
                        style={{ backgroundColor: col }}
                        className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                          currentSlide.accentColor === col ? "border-white scale-110" : "border-transparent"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {(currentSlide.layout === "pyramid" || currentSlide.layout === "flowchart") && (
                  <div>
                    <label className="block text-muted-foreground mb-1">Diagramma turi</label>
                    <select
                      value={currentSlide.diagramKind || "law_pyramid"}
                      onChange={(e) => updateSlide({ diagramKind: e.target.value as DiagramKind })}
                      className="w-full rounded-lg border border-input bg-background px-2 py-2 text-foreground"
                    >
                      <option value="law_pyramid">Qonunlar piramidasi</option>
                      <option value="legal_triad">Huquqiy uchlik</option>
                      <option value="court_stages">Sud bosqichlari</option>
                      <option value="state_branches">Hokimiyat tarmoqlari</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Slayd sarlavhasi</label>
                <input
                  type="text"
                  value={currentSlide.title}
                  onChange={(e) => updateSlide({ title: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Ost-sarlavha</label>
                <input
                  type="text"
                  value={currentSlide.subtitle || ""}
                  onChange={(e) => updateSlide({ subtitle: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
                />
              </div>

              {currentSlide.layout === "image" && (
                <div>
                  <label className="block text-muted-foreground mb-1">Rasm havolasi (URL)</label>
                  <input
                    type="text"
                    value={currentSlide.imageUrl || ""}
                    onChange={(e) => updateSlide({ imageUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
              )}

              <div>
                <label className="block text-muted-foreground mb-1">Slayd bandlari (har bir band yangi qatorda)</label>
                <textarea
                  rows={4}
                  value={currentSlide.bullets.join("\n")}
                  onChange={(e) => updateSlide({ bullets: e.target.value.split("\n").filter(Boolean) })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">O'qituvchi eslatmasi</label>
                <input
                  type="text"
                  value={currentSlide.speakerNotes}
                  onChange={(e) => updateSlide({ speakerNotes: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden Print-Only Full Slide Deck */}
      <div className="hidden print-only space-y-6">
        {deck.slides.map((s, idx) => (
          <div key={s.id} className="print-slide rounded-lg">
            <div className="text-xs font-bold mb-2">
              HUQUQ OLAMI · {deck.gradeNumber}-sinf · Slayd {idx + 1}/{deck.slides.length}
            </div>
            <h2 className="text-xl font-bold mb-2">{s.title}</h2>
            {s.subtitle && <p className="text-sm mb-4">{s.subtitle}</p>}
            <ul className="list-disc pl-5 space-y-2 text-sm">
              {s.bullets.map((b, bIdx) => (
                <li key={bIdx}>{b}</li>
              ))}
            </ul>
            {s.speakerNotes && <p className="mt-6 text-xs italic">Eslatma: {s.speakerNotes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
