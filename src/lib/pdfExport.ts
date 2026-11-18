import { jsPDF } from "jspdf";
import type {
  LegalScenario,
  LegalTerm,
  LessonInfo,
  PresentationDeck,
  QuizInfo,
} from "../../shared/types";

interface PdfSectionBlock {
  heading?: string;
  body?: string[];
  accent?: boolean;
}

/**
 * Renders structured Uzbek text onto high-DPI offscreen canvases and compiles a clean multi-page PDF.
 * This guarantees crisp rendering of all Uzbek Latin apostrophes (o‘, g‘, ’) without font glyph errors.
 */
export function exportDocumentAsPdf(params: {
  filename: string;
  docTitle: string;
  docSubtitle: string;
  blocks: PdfSectionBlock[];
}) {
  const pageWidthPx = 1240;
  const pageHeightPx = 1754; // A4 ratio at 150 DPI
  const marginX = 84;
  const maxContentW = pageWidthPx - marginX * 2;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pages: HTMLCanvasElement[] = [];

  function createPageCanvas(pageNum: number) {
    const canvas = document.createElement("canvas");
    canvas.width = pageWidthPx;
    canvas.height = pageHeightPx;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageWidthPx, pageHeightPx);

    // Top green accent bar
    ctx.fillStyle = "#00C875";
    ctx.fillRect(0, 0, pageWidthPx, 10);

    // Header brand & page number
    ctx.fillStyle = "#080B09";
    ctx.font = "bold 20px Sora, Arial, sans-serif";
    ctx.fillText("HUQUQ OLAMI — Davlat va huquq asoslari", marginX, 54);

    ctx.fillStyle = "#64748b";
    ctx.font = "18px Sora, Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${pageNum}-sahifa`, pageWidthPx - marginX, 54);
    ctx.textAlign = "left";

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(marginX, 72);
    ctx.lineTo(pageWidthPx - marginX, 72);
    ctx.stroke();

    return { canvas, ctx };
  }

  let pageNum = 1;
  let { canvas, ctx } = createPageCanvas(pageNum);
  pages.push(canvas);
  let y = 115;

  function ensureSpace(neededHeight: number) {
    if (y + neededHeight > pageHeightPx - 85) {
      pageNum += 1;
      const next = createPageCanvas(pageNum);
      canvas = next.canvas;
      ctx = next.ctx;
      pages.push(canvas);
      y = 110;
    }
  }

  function wrapLines(text: string, font: string, maxW: number): string[] {
    ctx.font = font;
    const words = String(text || "").split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      if (ctx.measureText(test).width > maxW && current) {
        lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  // Document Main Title
  const titleLines = wrapLines(params.docTitle, "bold 34px Sora, Arial, sans-serif", maxContentW);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 34px Sora, Arial, sans-serif";
  for (const line of titleLines) {
    ctx.fillText(line, marginX, y);
    y += 44;
  }

  const subLines = wrapLines(params.docSubtitle, "500 22px Sora, Arial, sans-serif", maxContentW);
  ctx.fillStyle = "#059669";
  ctx.font = "500 22px Sora, Arial, sans-serif";
  for (const line of subLines) {
    ctx.fillText(line, marginX, y);
    y += 32;
  }
  y += 18;

  for (const block of params.blocks) {
    if (block.heading) {
      ensureSpace(75);
      if (block.accent) {
        ctx.fillStyle = "#ecfdf5";
        ctx.fillRect(marginX - 10, y - 28, maxContentW + 20, 42);
      }
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 24px Sora, Arial, sans-serif";
      const hLines = wrapLines(block.heading, "bold 24px Sora, Arial, sans-serif", maxContentW);
      for (const hl of hLines) {
        ctx.fillText(hl, marginX, y);
        y += 34;
      }
      y += 6;
    }

    if (block.body && block.body.length > 0) {
      for (const paragraph of block.body) {
        const pLines = wrapLines(paragraph, "20px Sora, Arial, sans-serif", maxContentW - 12);
        ensureSpace(pLines.length * 30 + 16);
        ctx.fillStyle = "#1e293b";
        ctx.font = "20px Sora, Arial, sans-serif";
        for (const pl of pLines) {
          ctx.fillText(pl, marginX + 6, y);
          y += 30;
        }
        y += 10;
      }
    }
    y += 14;
  }

  pages.forEach((pg, idx) => {
    if (idx > 0) pdf.addPage();
    const imgData = pg.toDataURL("image/jpeg", 0.9);
    pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
  });

  pdf.save(params.filename.endsWith(".pdf") ? params.filename : `${params.filename}.pdf`);
}

export function exportLessonPdf(lesson: LessonInfo) {
  const c = lesson.content;
  exportDocumentAsPdf({
    filename: `huquq-olami-${lesson.gradeNumber}-sinf-${lesson.id}`,
    docTitle: c.title,
    docSubtitle: `${lesson.gradeNumber}-sinf · ${lesson.chapterTitle} · ${lesson.pageNumber}-bet`,
    blocks: [
      { heading: "1. Dars maqsadi", body: [c.objective], accent: true },
      { heading: "2. Kutilayotgan natijalar", body: c.expectedOutcomes.map((o) => `• ${o}`) },
      { heading: "3. Tayanch tushunchalar", body: c.keyTerms.map((k) => `• ${k.term}: ${k.shortDef}`) },
      {
        heading: "4. Nazariy qism va qonuniy asoslar",
        body: c.theorySections.map((t) => `${t.heading}: ${t.textbookFact} (${t.legalArticles.join(", ")})`),
      },
      { heading: "5. Oddiy tilda tushuntirish", body: c.plainExplanations.map((p) => `${p.concept}: ${p.simpleText}`) },
      {
        heading: "6. Hayotiy misollar va Huquqiy vaziyatlar",
        body: [
          ...c.lifeExamples.map((e) => `Misol (${e.title}): ${e.situation} — Xulosa: ${e.takeaway}`),
          ...c.legalCases.map(
            (lc) => `Vaziyat (${lc.caseTitle}): ${lc.facts} Yechim: ${lc.legalResolution} [${lc.legalBasis}]`
          ),
        ],
      },
      { heading: "7. Mustahkamlash savollari", body: c.reinforcementQuestions.map((r, i) => `${i + 1}. ${r.question}`) },
      { heading: "8. Xulosa va Manbalar", body: [c.conclusion, ...c.sources.map((s) => `Manba: ${s.title} (${s.pages})`)] },
    ],
  });
}

export function exportPresentationPdf(deck: PresentationDeck) {
  exportDocumentAsPdf({
    filename: `prezentatsiya-${deck.gradeNumber}-sinf-${deck.id}`,
    docTitle: deck.title,
    docSubtitle: `${deck.gradeNumber}-sinf · ${deck.slides.length} ta slayd · ${deck.templateName}`,
    blocks: deck.slides.map((s, idx) => ({
      heading: `Slayd ${idx + 1}: ${s.title}`,
      accent: true,
      body: [
        ...(s.subtitle ? [s.subtitle] : []),
        ...s.bullets.map((b) => `• ${b}`),
        ...(s.tableRows ? s.tableRows.map((r) => `${r.left}  |  ${r.right}`) : []),
        ...(s.speakerNotes ? [`O'qituvchi eslatmasi: ${s.speakerNotes}`] : []),
      ],
    })),
  });
}

export function exportQuizPdf(quiz: QuizInfo, includeAnswers: boolean) {
  exportDocumentAsPdf({
    filename: `test-${quiz.gradeNumber}-sinf-${quiz.id}`,
    docTitle: quiz.title,
    docSubtitle: `${quiz.gradeNumber}-sinf · ${quiz.questions.length} ta savol · Vaqt: ${quiz.timeLimitMinutes} daqiqa`,
    blocks: [
      ...quiz.questions.map((q, idx) => ({
        heading: `${idx + 1}-savol (${q.points} ball)`,
        body: [
          q.prompt,
          ...q.options.map((o, oIdx) => `   ${String.fromCharCode(65 + oIdx)}) ${o}`),
          ...(includeAnswers ? [`Javob izohi: ${q.explanation}`] : []),
        ],
      })),
    ],
  });
}

export function exportScenariosPdf(scenarios: LegalScenario[]) {
  exportDocumentAsPdf({
    filename: "amaliy-vaziyatlar-toplami",
    docTitle: "Amaliy huquqiy vaziyatlar to'plami",
    docSubtitle: "8–11-sinflar uchun huquqiy kazuslar va yechimlar",
    blocks: scenarios.map((sc, i) => ({
      heading: `${i + 1}. ${sc.title} (${sc.category}, ${sc.gradeNumber}-sinf)`,
      accent: true,
      body: [
        `Voqea: ${sc.eventDescription}`,
        `Muammo: ${sc.legalProblem}`,
        `Qonuniy yechim: ${sc.solutionSummary}`,
        `Huquqiy asos: ${sc.legalBasis}`,
      ],
    })),
  });
}

export function exportGlossaryPdf(terms: LegalTerm[]) {
  exportDocumentAsPdf({
    filename: "huquqiy-lugat",
    docTitle: "Huquqiy atamalar izohli lug'ati",
    docSubtitle: `8–11-sinf darsliklari asosida (${terms.length} ta atama)`,
    blocks: terms.map((t) => ({
      heading: `${t.term} (${t.gradeNumber}-sinf)`,
      body: [t.shortDefinition, t.extendedNote, `Misol: ${t.lifeExample}`, `Manba: ${t.sourcePage}`],
    })),
  });
}
