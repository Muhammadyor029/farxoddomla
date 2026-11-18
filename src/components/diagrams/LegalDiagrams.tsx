import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, ChevronRight } from "lucide-react";
import type { DiagramKind, DiagramNode } from "../../../shared/types";
import { Button } from "../ui/button";

interface VisualDiagramProps {
  kind: DiagramKind;
  title: string;
  caption: string;
  nodes: DiagramNode[];
}

export function VisualDiagram({ kind, title, caption, nodes }: VisualDiagramProps) {
  const [selectedId, setSelectedId] = useState<string>(nodes[0]?.id || "");
  const activeNode = nodes.find((n) => n.id === selectedId) || nodes[0];

  useEffect(() => {
    if (nodes[0]) setSelectedId(nodes[0].id);
  }, [title, nodes]);

  return (
    <div className="rounded-xl border border-border bg-card/80 p-5 print-section">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-foreground">{title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{caption}</p>
        </div>
        <span className="text-xs font-medium text-primary">Interaktiv sxema · Elementni bosing</span>
      </div>

      {kind === "law_pyramid" ? (
        <div className="flex flex-col items-center gap-2 my-4">
          {nodes.map((node, idx) => {
            const widthPct = Math.min(100, 46 + idx * 13);
            const active = node.id === activeNode?.id;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedId(node.id)}
                style={{ width: `${widthPct}%` }}
                className={`rounded-lg border px-4 py-2.5 text-center transition-all cursor-pointer ${
                  active
                    ? "border-primary bg-primary/20 text-foreground shadow-[0_0_24px_rgba(57,255,85,0.2)]"
                    : "border-border bg-secondary/70 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                <div className="text-xs sm:text-sm font-semibold">{node.label}</div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 my-4">
          {nodes.map((node, idx) => {
            const active = node.id === activeNode?.id;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedId(node.id)}
                className={`relative rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                  active
                    ? "border-primary bg-primary/15 text-foreground shadow-[0_0_20px_rgba(57,255,85,0.16)]"
                    : "border-border bg-secondary/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-primary tabular-nums">0{idx + 1}</span>
                  {node.articleRef && (
                    <span className="text-[11px] text-emerald font-medium">{node.articleRef}</span>
                  )}
                </div>
                <div className="text-sm font-semibold text-foreground">{node.label}</div>
                {idx < nodes.length - 1 && (
                  <ChevronRight className="hidden lg:block w-4 h-4 text-primary/60 absolute -right-2.5 top-1/2 -translate-y-1/2 z-10" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {activeNode && (
        <div className="mt-4 rounded-lg border border-primary/30 bg-background/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-primary">{activeNode.label}</span>
            {activeNode.articleRef && (
              <span className="text-xs text-muted-foreground">Manba: {activeNode.articleRef}</span>
            )}
          </div>
          <p className="text-sm text-foreground/90 mt-1.5 leading-relaxed">{activeNode.detail}</p>
        </div>
      )}
    </div>
  );
}

interface AnimatedStep {
  stepNumber: number;
  title: string;
  description: string;
  highlight: string;
}

export function AnimatedProcessDiagram({ title, steps }: { title: string; steps: AnimatedStep[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || steps.length === 0) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % steps.length);
    }, 2400);
    return () => window.clearInterval(timer);
  }, [playing, steps.length]);

  const current = steps[activeIndex] || steps[0];
  if (!current) return null;

  return (
    <div className="rounded-xl border border-border bg-card/80 p-5 print-section">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h4 className="text-base font-semibold text-foreground">{title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Animatsion jarayon: bosqichlarni avtomatik yoki qo'lda kuzating
          </p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPlaying((p) => !p)}
            className="gap-1.5 border-primary/40 hover:border-primary text-xs"
          >
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {playing ? "To'xtatish" : "Animatsiyani yoqish"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setPlaying(false);
              setActiveIndex(0);
            }}
            className="text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
        {steps.map((step, i) => {
          const isCurrent = i === activeIndex;
          const isPassed = i < activeIndex;
          return (
            <button
              key={step.stepNumber}
              type="button"
              onClick={() => {
                setPlaying(false);
                setActiveIndex(i);
              }}
              className={`rounded-lg border p-3 text-left transition-all duration-300 cursor-pointer ${
                isCurrent
                  ? "border-primary bg-primary/15 scale-[1.01] shadow-[0_0_20px_rgba(57,255,85,0.2)]"
                  : isPassed
                  ? "border-emerald/40 bg-emerald/10 text-foreground"
                  : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-primary tabular-nums">{step.stepNumber}-bosqich</span>
                <span className="text-[11px] text-muted-foreground">{step.highlight}</span>
              </div>
              <div className="text-xs sm:text-sm font-medium text-foreground line-clamp-2">{step.title}</div>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-hero-bg/80 p-4 transition-all">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-semibold text-primary">
            {current.stepNumber}-bosqich: {current.title}
          </span>
          <span className="text-xs text-emerald">{current.highlight}</span>
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed">{current.description}</p>
      </div>
    </div>
  );
}
