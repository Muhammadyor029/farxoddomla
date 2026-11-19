import { GoogleGenAI } from "@google/genai";
import type { DatabaseSync } from "node:sqlite";

const DEFAULT_MODEL = "gemini-4-hydrogen";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function getAiConfig(db: DatabaseSync) {
  const row = db
    .prepare("SELECT model_name, pedagogical_tone, strict_grounding, enabled FROM ai_settings WHERE id = 1")
    .get() as
    | { model_name: string; pedagogical_tone: string; strict_grounding: number; enabled: number }
    | undefined;
  return {
    modelName: row?.model_name || DEFAULT_MODEL,
    tone: row?.pedagogical_tone || "Sodda, darslikka asoslangan va hayotiy misollar bilan",
    strictGrounding: row ? row.strict_grounding === 1 : true,
    enabled: row ? row.enabled === 1 : true,
  };
}

export async function runLegalAiTask(
  db: DatabaseSync,
  params: {
    task: "chat" | "explain" | "define" | "generate_quiz" | "analyze_case" | "generate_slides";
    prompt: string;
    gradeNumber?: number;
    lessonId?: number;
  }
): Promise<{ text: string; disclaimer: string; model: string }> {
  const config = getAiConfig(db);
  if (!config.enabled) {
    throw new Error("AI yordamchi administrator tomonidan vaqtincha o'chirilgan.");
  }

  const client = getClient();
  if (!client) {
    throw new Error(
      "Serverda GEMINI_API_KEY sozlanmagan. Iltimos, Secrets bo'limidan haqiqiy GEMINI_API_KEY kiriting."
    );
  }

  let lessonContext = "";
  if (params.lessonId) {
    const lessonRow = db
      .prepare(
        `SELECT l.title, l.grade_number, l.lesson_number_label, l.page_number, lc.content_json
         FROM lessons l JOIN lesson_contents lc ON l.id = lc.lesson_id
         WHERE l.id = ?`
      )
      .get(params.lessonId) as
      | {
          title: string;
          grade_number: number;
          lesson_number_label: string;
          page_number: number;
          content_json: string;
        }
      | undefined;
    if (lessonRow) {
      try {
        const parsed = JSON.parse(lessonRow.content_json);
        lessonContext = `
Kontekst dars: ${lessonRow.grade_number}-sinf, ${lessonRow.lesson_number_label} — "${lessonRow.title}" (${lessonRow.page_number}-bet).
Asosiy faktlar: ${(parsed.theorySections || []).map((s: { textbookFact: string }) => s.textbookFact).join(" | ")}
Qonuniy manbalar: ${(parsed.sources || []).map((s: { pages: string }) => s.pages).join(", ")}
        `.trim();
      } catch {
        lessonContext = `Kontekst dars: ${lessonRow.grade_number}-sinf, ${lessonRow.lesson_number_label} — "${lessonRow.title}" (${lessonRow.page_number}-bet).`;
      }
    }
  }

  const taskInstructionMap: Record<typeof params.task, string> = {
    chat: "O'quvchining huquqiy savoliga aniq, do'stona va O'zbekiston maktab darsliklari asosida o'zbek tilida javob bering.",
    explain: "Ushbu mavzu yoki moddani 8–11-sinf o'quvchisi oson tushunadigan sodda til va 2 ta hayotiy misol bilan tushuntiring.",
    define: "Huquqiy atamaga qisqa ta'rif, darslikdagi mazmuni va 1 ta kundalik hayotiy misol keltiring.",
    generate_quiz:
      "Mavzu bo'yicha 3 ta o'zbekcha test savolini (savol, 4 ta variant A/B/C/D, to'g'ri javob va qisqa izoh bilan) tuzib bering.",
    analyze_case:
      "Berilgan amaliy vaziyatni 4 qismda tahlil qiling: 1) Huquq sohasi; 2) Buzilgan huquq yoki qoida; 3) O'zbekiston qonunchiligi asosi; 4) Qonuniy yechim.",
    generate_slides:
      "Mavzu yuzasidan 5 ta ixcham prezentatsiya slaydi tuzilmasini (Sarlavha + 3 ta qisqa band + vizual sxema g'oyasi) yozib bering.",
  };

  const strictRule = config.strictGrounding
    ? "3. QAT'IY MANBA NAZORATI: Agar savol bo'yicha aniq modda raqami yoki darslik fakti ishonchli tarzda ma'lum bo'lmasa, hech qachon taxminiy modda raqami yozmang — 'Bu savol bo'yicha aniq modda raqami yoki darslik iqtibosi haqida ishonchli ma'lumot topilmadi' deb ochiq ayting."
    : "3. Darslikdagi umumiy huquqiy prinsiplarga tayaning va modda raqamini o'ylab topmang.";

  const systemInstruction = `
Siz "HUQUQ OLAMI" platformasining O'zbekiston umumta'lim maktablari (8–11-sinf, "Davlat va huquq asoslari") bo'yicha sun'iy intellekt o'qituvchisisiz.
Qoidalar:
1. Faqat O'zbekiston Respublikasi Konstitutsiyasi (2023 yangi tahrir), Mehnat, Oila, Fuqarolik, Jinoyat, Ma'muriy javobgarlik kodekslari va 8–11-sinf darsliklariga tayaning.
2. Hech qachon mavjud bo'lmagan qonun moddasini yoki qonun hujjatini o'ylab topmang (to'qimang).
${strictRule}
4. Javob ohangi: ${config.tone}.
5. Vazifa: ${taskInstructionMap[params.task]}
6. Faqat o'zbek tilida (lotin alifbosida) javob yozing.
  `.trim();

  const trimmedPrompt = params.prompt.trim().slice(0, 2000);
  const fullPrompt = [
    params.gradeNumber ? `Sinf: ${params.gradeNumber}-sinf` : "",
    lessonContext,
    `So'rov: ${trimmedPrompt}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await client.models.generateContent({
    model: config.modelName || DEFAULT_MODEL,
    contents: fullPrompt,
    config: {
      systemInstruction,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error("AI modelidan bo'sh javob qaytdi.");
  }

  return {
    text,
    model: config.modelName || DEFAULT_MODEL,
    disclaimer:
      "Eslatma: Ushbu javob o'quv-ta'limiy tushuntirish bo'lib, rasmiy advokat yoki yuridik maslahat o'rnini bosmaydi.",
  };
}
