import type {
  ChapterInfo,
  DiagramKind,
  DiagramNode,
  GradeInfo,
  LessonContent16,
  LessonInfo,
  PresentationDeck,
  PresentationSlide,
  QuizInfo,
  QuizQuestion,
} from "../../shared/types";
import { GRADE_8_CHAPTERS, GRADE_8_INFO, GRADE_8_LESSONS, type LessonSeedSpec } from "./grade8";
import { GRADE_9_CHAPTERS, GRADE_9_INFO, GRADE_9_LESSONS } from "./grade9";
import { GRADE_10_CHAPTERS, GRADE_10_INFO, GRADE_10_LESSONS } from "./grade10";
import { GRADE_11_CHAPTERS, GRADE_11_INFO, GRADE_11_LESSONS } from "./grade11";
import { ALL_LESSON_SPLITS, applyLessonSplits } from "./lessonSplits";

export const ALL_GRADES: GradeInfo[] = [GRADE_8_INFO, GRADE_9_INFO, GRADE_10_INFO, GRADE_11_INFO];

export const ALL_CHAPTERS: ChapterInfo[] = [
  ...GRADE_8_CHAPTERS,
  ...GRADE_9_CHAPTERS,
  ...GRADE_10_CHAPTERS,
  ...GRADE_11_CHAPTERS,
];

function buildDiagramNodes(kind: DiagramKind, spec: LessonSeedSpec): {
  title: string;
  caption: string;
  nodes: DiagramNode[];
} {
  switch (kind) {
    case "law_pyramid":
      return {
        title: "Normativ-huquqiy hujjatlar iyerarxiyasi piramidasi",
        caption: "Quyi hujjatlar yuqori yuridik kuchga ega hujjatlarga zid bo'lishi mumkin emas (Konstitutsiya 15-modda).",
        nodes: [
          { id: "p1", level: 1, label: "1. O'zbekiston Respublikasi Konstitutsiyasi", detail: "Oliy yuridik kuchga ega Asosiy Qonun (155 modda)", articleRef: "15-modda" },
          { id: "p2", level: 2, label: "2. Konstitutsiyaviy qonunlar va Kodekslar", detail: "Mehnat, Fuqarolik, Oila, Jinoyat kodekslari", articleRef: "8-sinf 41-bet" },
          { id: "p3", level: 3, label: "3. O'zbekiston Respublikasi Qonunlari", detail: "Oliy Majlis qabul qiladigan umumiy majburiy hujjatlar", articleRef: "91-modda" },
          { id: "p4", level: 4, label: "4. Prezident Farmon va Qarorlari", detail: "Davlat boshlig'ining normativ hujjatlari", articleRef: "110-modda" },
          { id: "p5", level: 5, label: "5. Vazirlar Mahkamasi va mahalliy Kengash qarorlari", detail: "Qonunlarni ijro etishga qaratilgan qonunosti hujjatlari", articleRef: "115-modda" },
        ],
      };
    case "legal_triad":
      return {
        title: `${spec.title} — Uchlik huquqiy tuzilma`,
        caption: "Huquqiy munosabat va normaning uch asosiy ustuni o'zaro bog'liqligi.",
        nodes: [
          { id: "t1", level: 1, label: "Subyektlar (Ishtirokchilar)", detail: "Jismoniy shaxslar, yuridik shaxslar va davlat organlari", articleRef: spec.legalArticles[0] || "Darslik" },
          { id: "t2", level: 2, label: "Obyekt (Predmet)", detail: "Moddiy boyliklar, xizmatlar, nomoddiy ne'matlar (sha'n, intellektual mulk)" },
          { id: "t3", level: 3, label: "Mazmun (Huquq va Burch)", detail: "Tomonlarning qonun bilan himoyalangan huquqlari va majburiyatlari" },
        ],
      };
    case "court_stages":
      return {
        title: "Huquqiy himoya va sudlov bosqichlari",
        caption: "Qonunbuzilishini aniqlashdan adolatli qaror qabul qilishgacha bo'lgan ketma-ketlik.",
        nodes: [
          { id: "c1", level: 1, label: "1. Yuridik fakt / Murojaat", detail: "Huquq buzilishi yoki nizo yuzaga kelishi va vakolatli organga xabar" },
          { id: "c2", level: 2, label: "2. Dalillarni qonuniy to'plash", detail: "Advokat ishtiroki, aybsizlik prezumpsiyasi va Xabeas korpus kafolati" },
          { id: "c3", level: 3, label: "3. Ochiq sud muhokamasi", detail: "Tomonlarning tengligi va tortishuv prinsipi asosida ko'rib chiqish" },
          { id: "c4", level: 4, label: "4. Qonuniy qaror va ijro", detail: "Buzilgan huquqni tiklash, zararni qoplash yoki adolatli jazo" },
        ],
      };
    case "state_branches":
      return {
        title: "Davlat hokimiyatining bo'linish tizimi",
        caption: "Konstitutsiya 11-modda: O'zaro tiyib turish va manfaatlar muvozanati.",
        nodes: [
          { id: "s1", level: 1, label: "Qonun chiqaruvchi: Oliy Majlis", detail: "Qonunchilik palatasi (150 deputat) va Senat (65 senator)", articleRef: "91-modda" },
          { id: "s2", level: 2, label: "Ijro etuvchi: Vazirlar Mahkamasi", detail: "Bosh vazir va vazirliklar qonunlar ijrosi va budjetni ta'minlaydi", articleRef: "114-modda" },
          { id: "s3", level: 3, label: "Sud hokimiyati: Mustaqil sudlar", detail: "Konstitutsiyaviy sud, Oliy sud, fuqarolik, jinoyat, iqtisodiy va ma'muriy sudlar", articleRef: "130-modda" },
          { id: "s4", level: 4, label: "Kafil: O'zbekiston Respublikasi Prezidenti", detail: "Hokimiyat tarmoqlarining kelishilgan faoliyatini ta'minlaydi", articleRef: "105-modda" },
        ],
      };
    case "labor_protection":
      return {
        title: "Mehnat huquqi va xodim kafolatlari",
        caption: "O'zbekiston Respublikasi Mehnat kodeksi asosidagi asosiy standartlar.",
        nodes: [
          { id: "l1", level: 1, label: "Yozma shartnoma (106-modda)", detail: "2 nusxada va my.mehnat.uz elektron tizimida qayd etiladi" },
          { id: "l2", level: 2, label: "Ish vaqti chegarasi", detail: "Normal: 40 soat/hafta; 16–18 yosh: 36 soat; 15–16 yosh: 24 soat" },
          { id: "l3", level: 3, label: "Yillik mehnat ta'tili", detail: "Kamida 21 kalendar kun (voyaga yetmaganlarga 30 kalendar kun)" },
          { id: "l4", level: 4, label: "Xavfsizlik va nizo himoyasi", detail: "Majburiy mehnat taqiqi va Mehnat inspeksiyasi/Sud himoyasi" },
        ],
      };
    case "eco_balance":
      return {
        title: "Ekologik huquq va mas'uliyat zanjiri",
        caption: "Tabiiy boyliklar — umummilliy boylik (Konstitutsiya 49, 62, 68-moddalar).",
        nodes: [
          { id: "e1", level: 1, label: "Ekologik huquq (49-modda)", detail: "Toza havo, suv va ishonchli ekologik axborot olish" },
          { id: "e2", level: 2, label: "Davlat muhofazasi (68-modda)", detail: "Qizil kitob, qo'riqxonalar, 'Yashil makon' loyihasi" },
          { id: "e3", level: 3, label: "Fuqaro burchi (62-modda)", detail: "Daraxtlarni asrash, suvni tejash, chiqindi tashlamaslik" },
          { id: "e4", level: 4, label: "Zararni qoplash (49/52-m.)", detail: "Jarima to'lash ekologik zararni tiklashdan ozod etmaydi" },
        ],
      };
    case "rights_duties":
    default:
      return {
        title: "Huquqlar va Konstitutsiyaviy burchlar muvozanati",
        caption: "Har bir huquq boshqa shaxs huquqini hurmat qilish majburiyati bilan chambarchas bog'liq.",
        nodes: [
          { id: "r1", level: 1, label: "Shaxsiy va Fuqarolik huquqlari", detail: "Yashash, sha'n, daxlsizlik, erkin fikr (25–35-moddalar)" },
          { id: "r2", level: 2, label: "Ijtimoiy-iqtisodiy huquqlar", detail: "Bepul ta'lim, tibbiyot, mulk, munosib mehnat (41–52-moddalar)" },
          { id: "r3", level: 3, label: "Kafolat mexanizmlari", detail: "Sud himoyasi, Advokatura, Ombudsman, Bolalar ombudsmani" },
          { id: "r4", level: 4, label: "Konstitutsiyaviy burchlar", detail: "Qonunga rioya, meros va tabiatni asrash, soliq to'lash (59–64-moddalar)" },
        ],
      };
  }
}

function buildLessonContent16(
  spec: LessonSeedSpec,
  gradeNum: 8 | 9 | 10 | 11,
  quizId: number
): LessonContent16 {
  const diagram = buildDiagramNodes(spec.diagramKind, spec);
  const gradeTitle = ALL_GRADES.find((g) => g.gradeNumber === gradeNum)?.textbookTitle ?? `${gradeNum}-sinf darsligi`;

  return {
    title: `${spec.lessonNumberLabel}: ${spec.title}`,
    objective: spec.objective,
    expectedOutcomes: spec.expectedOutcomes,
    keyTerms: spec.keyTerms,
    theorySections: [
      {
        heading: "Asosiy nazariy qoidalar (Darslik mazmuni)",
        textbookFact: spec.textbookFacts[0] || spec.summary,
        legalArticles: spec.legalArticles,
      },
      {
        heading: "Huquqiy tahlil va amaliy ahamiyati",
        textbookFact:
          spec.textbookFacts[1] ||
          "Ushbu mavzu o'quvchilarga kundalik ijtimoiy munosabatlarda qonuniy yo'l tutish hamda o'z huquq va majburiyatlarini aniq ajratish ko'nikmasini beradi.",
        legalArticles: spec.legalArticles,
      },
    ],
    plainExplanations: [
      {
        concept: spec.title,
        simpleText: spec.plainExplanation,
      },
      {
        concept: spec.keyTerms[0]?.term || "Asosiy tushuncha",
        simpleText:
          spec.keyTerms[0]?.shortDef +
          " Kundalik hayotda bu qoida har birimizning xavfsizligi va teng huquqliligini ta'minlash uchun ishlaydi.",
      },
    ],
    lifeExamples: [
      spec.lifeExample,
      {
        title: "Maktab va oila hayotidagi tatbiqi",
        situation: `${gradeNum}-sinf o'quvchilari '${spec.title}' mavzusida o'zaro hurmat, qonunlarga itoatkorlik va mas'uliyat prinsiplarini amalda muhokama qildilar.`,
        takeaway: "Nazariy bilim hayotiy qaror qabul qilishda tayanch bo'ladi.",
      },
    ],
    legalCases: [spec.legalCase],
    visualDiagram: {
      kind: spec.diagramKind,
      title: diagram.title,
      caption: diagram.caption,
      nodes: diagram.nodes,
    },
    animatedDiagram: {
      title: `${spec.title}: Bosqichma-bosqich harakat algoritmi`,
      steps: diagram.nodes.map((n, idx) => ({
        stepNumber: idx + 1,
        title: n.label,
        description: n.detail,
        highlight: n.articleRef || `${gradeNum}-sinf · ${spec.pageNumber}-bet`,
      })),
    },
    interactiveTasks: [
      {
        id: `task-${quizId}-1`,
        type: "decision",
        prompt: `Vaziyatni baholang: "${spec.legalCase.facts}" — qonuniy yechim qaysi?`,
        items: [
          spec.legalCase.legalResolution,
          "Hech qanday huquqiy chora ko'rilmaydi, chunki bu shaxsiy masala.",
          "Muammoni qonuniy asoslarsiz og'zaki hal qilish shart.",
        ],
        correctAnswer: spec.legalCase.legalResolution,
        explanation: `${spec.legalCase.legalResolution} (Huquqiy asos: ${spec.legalCase.legalBasis})`,
      },
      {
        id: `task-${quizId}-2`,
        type: "classification",
        prompt: `"${spec.title}" mavzusiga tegishli asosiy huquqiy manba yoki tamoyilni tanlang:`,
        items: [
          spec.legalArticles[0] || "O'zbekiston Respublikasi Konstitutsiyasi",
          spec.keyTerms[0]?.term || spec.title,
          "Mavzuga aloqador bo'lmagan taxminiy qoida",
        ],
        correctAnswer: [
          spec.legalArticles[0] || "O'zbekiston Respublikasi Konstitutsiyasi",
          spec.keyTerms[0]?.term || spec.title,
        ],
        explanation: "Darslikdagi tasdiqlangan manbalar va tayanch tushunchalarga tayanish zarur.",
      },
    ],
    miniGame: {
      gameType: spec.miniGameType,
      title: `Mini-o'yin: ${spec.title}`,
      prompt: "Mavzuga oid qisqa interaktiv raundlarni yeching:",
      rounds: [
        {
          clue: spec.keyTerms[0]?.shortDef || spec.summary,
          options: [
            spec.keyTerms[0]?.term || spec.title,
            "Tasodifiy ma'muriy buyruq",
            "Hech qanday huquqiy oqibatsiz harakat",
          ],
          correctIndex: 0,
          explanation: `To'g'ri! Bu ta'rif "${spec.keyTerms[0]?.term || spec.title}" tushunchasiga tegishli.`,
        },
        {
          clue: spec.legalCase.question,
          options: [
            "Qonuniy asos mavjud emas",
            spec.legalCase.legalResolution,
            "Faqat axloqiy tanbeh bilan cheklaniladi",
          ],
          correctIndex: 1,
          explanation: `Asos: ${spec.legalCase.legalBasis}`,
        },
      ],
    },
    quizId,
    reinforcementQuestions: [
      {
        question: `${spec.title} mavzusining asosiy mazmunini 2–3 gap bilan tushuntirib bering.`,
        hint: spec.plainExplanation,
      },
      {
        question: `Ushbu mavzuda qaysi qonuniy hujjatlar yoki moddalar asosiy rol o'ynaydi?`,
        hint: spec.legalArticles.join(", "),
      },
      {
        question: spec.legalCase.question,
        hint: spec.legalCase.legalResolution,
      },
      {
        question: `Kundalik maktab yoki oila hayotingizda '${spec.title}' qoidalari qayerda uchraydi?`,
        hint: spec.lifeExample.situation,
      },
      {
        question: `Tayanch atamalardan biri — '${spec.keyTerms[0]?.term || spec.title}' nimani anglatadi?`,
        hint: spec.keyTerms[0]?.shortDef || spec.summary,
      },
    ],
    conclusion: `Xulosa qilib aytganda, "${spec.title}" mavzusi ${gradeNum}-sinf o'quvchilariga (${spec.legalArticles.join(", ")}) asosida ongli fuqarolik pozitsiyasini shakllantirish, huquqlardan to'g'ri foydalanish va majburiyatlarni mas'uliyat bilan bajarish imkonini beradi.`,
    sources: [
      {
        title: gradeTitle,
        pages: `${spec.pageNumber}-bet va keyingi sahifalar`,
        factNote: "Asosiy bob, mavzu tartibi va tayanch tushunchalar rasmiy PDF darslikdan olingan (Verified).",
      },
      {
        title: "Huquqiy manbalar",
        pages: spec.legalArticles.join("; "),
        factNote: "O'zbekiston Respublikasi qonunchilik hujjatlariga havola.",
      },
    ],
    errorAnalysis: [
      {
        misconception: `"${spec.title}" mavzusini faqat yodlash uchun mo'ljallangan nazariya deb hisoblash.`,
        correction: spec.plainExplanation,
        legalBasis: spec.legalArticles.join(", "),
      },
      {
        misconception: `"${spec.keyTerms[0]?.term || spec.title}" va "${spec.keyTerms[1]?.term || spec.keyTerms[0]?.term || "huquq normasi"}" tushunchalarini aralashtirish.`,
        correction: `${spec.keyTerms[0]?.term || spec.title}: ${spec.keyTerms[0]?.shortDef || spec.summary} Asosiy huquqiy yechim: ${spec.legalCase.legalResolution}`,
        legalBasis: spec.legalCase.legalBasis,
      },
    ],
    selfAssessment: [
      `"${spec.title}" mavzusining maqsadini o'z so'zim bilan tushuntira olaman.`,
      `${spec.keyTerms[0]?.term || spec.title} tushunchasini hayotiy misol bilan bog'lay olaman.`,
      `${spec.legalArticles[0] || "O'zbekiston Respublikasi Konstitutsiyasi"} asosida qonuniy yechim topa olaman.`,
      `${spec.legalCase.caseTitle} vaziyatida buzilgan huquqni aniqlay olaman.`,
    ],
  };
}

function buildPresentationDeck(
  deckId: number,
  lessonId: number,
  gradeNum: 8 | 9 | 10 | 11,
  spec: LessonSeedSpec,
  content: LessonContent16
): PresentationDeck {
  const diagram = content.visualDiagram;
  const slides: PresentationSlide[] = [
    {
      id: `s-${deckId}-1`,
      order: 1,
      layout: "title",
      title: spec.title,
      subtitle: `${gradeNum}-sinf · Davlat va huquq asoslari · ${spec.lessonNumberLabel}`,
      bullets: [
        `Darslik sahifasi: ${spec.pageNumber}-bet`,
        `Huquqiy asoslar: ${spec.legalArticles.slice(0, 2).join(" · ")}`,
      ],
      accentColor: "#39FF55",
      backgroundTone: "obsidian",
      speakerNotes: `O'qituvchi kirish so'zi: Bugungi darsimizda "${spec.title}" mavzusini o'rganamiz.`,
    },
    {
      id: `s-${deckId}-2`,
      order: 2,
      layout: "objectives",
      title: "Dars maqsadi va kutilayotgan natijalar",
      subtitle: spec.objective,
      bullets: spec.expectedOutcomes,
      accentColor: "#00C875",
      backgroundTone: "slate",
      speakerNotes: "O'quvchilarga dars oxirida qanday ko'nikmalarga ega bo'lishlarini e'lon qiling.",
    },
    {
      id: `s-${deckId}-3`,
      order: 3,
      layout: "terms",
      title: "Tayanch tushunchalar",
      subtitle: "Mavzuni tushunish uchun kalit atamalar",
      bullets: spec.keyTerms.map((k) => `${k.term} — ${k.shortDef}`),
      accentColor: "#39FF55",
      backgroundTone: "obsidian",
      speakerNotes: "Har bir atamaga hayotiy misol so'rang.",
    },
    {
      id: `s-${deckId}-4`,
      order: 4,
      layout: spec.diagramKind === "law_pyramid" ? "pyramid" : "flowchart",
      title: diagram.title,
      subtitle: diagram.caption,
      bullets: diagram.nodes.map((n) => `${n.label}: ${n.detail}`),
      diagramKind: spec.diagramKind,
      accentColor: "#00C875",
      backgroundTone: "emerald",
      speakerNotes: "Vizual sxema orqali tizimli bog'liqlikni tushuntiring.",
    },
    {
      id: `s-${deckId}-5`,
      order: 5,
      layout: "comparison",
      title: "Nazariya va Oddiy tushuntirish",
      subtitle: "Darslik fakti bilan sodda hayotiy qiyos",
      bullets: [spec.textbookFacts[0] || spec.summary, spec.plainExplanation],
      tableRows: [
        { left: "Darslik va Qonun tili", right: "Oddiy hayotiy talqin" },
        { left: spec.textbookFacts[0] || spec.summary, right: spec.plainExplanation },
        { left: spec.legalArticles[0] || "Konstitutsiya", right: spec.lifeExample.takeaway },
      ],
      accentColor: "#39FF55",
      backgroundTone: "slate",
      speakerNotes: "Jadval yordamida nazariyani o'quvchilar hayotiga bog'lang.",
    },
    {
      id: `s-${deckId}-6`,
      order: 6,
      layout: "case_study",
      title: `Amaliy vaziyat: ${spec.legalCase.caseTitle}`,
      subtitle: spec.legalCase.legalBasis,
      bullets: [
        `Voqea: ${spec.legalCase.facts}`,
        `Savol: ${spec.legalCase.question}`,
        `Yechim: ${spec.legalCase.legalResolution}`,
      ],
      accentColor: "#00C875",
      backgroundTone: "contrast",
      speakerNotes: "Avval o'quvchilarning javobini tinglang, so'ng qonuniy yechimni ko'rsating.",
    },
    {
      id: `s-${deckId}-7`,
      order: 7,
      layout: "quiz",
      title: "Tezkor bilim tekshiruvi",
      subtitle: "Sinf bilan birga javob bering",
      bullets: [
        `1. ${content.reinforcementQuestions[0]?.question || spec.legalCase.question}`,
        `2. ${content.reinforcementQuestions[1]?.question || spec.objective}`,
        `3. ${spec.lifeExample.title}: ${spec.lifeExample.situation}`,
      ],
      accentColor: "#39FF55",
      backgroundTone: "obsidian",
      speakerNotes: "Faol o'quvchilarni rag'batlantiring.",
    },
    {
      id: `s-${deckId}-8`,
      order: 8,
      layout: "summary",
      title: "Dars xulosasi va manbalar",
      subtitle: `${gradeNum}-sinf · ${spec.pageNumber}-bet`,
      bullets: [
        content.conclusion,
        `Foydalanilgan manba: ${content.sources[0]?.title} (${spec.pageNumber}-bet)`,
      ],
      accentColor: "#00C875",
      backgroundTone: "emerald",
      speakerNotes: "Uyga vazifa sifatida Test markazidagi 10 ta savolni yechishni topshiring.",
    },
  ];

  return {
    id: deckId,
    lessonId,
    gradeNumber: gradeNum,
    title: `${spec.lessonNumberLabel}. ${spec.title}`,
    templateName: "Huquq Olami Neon-Grafit",
    status: "verified",
    updatedAt: "2026-01-15T10:00:00.000Z",
    slides,
  };
}

function buildLessonQuiz(
  quizId: number,
  lessonId: number,
  gradeNum: 8 | 9 | 10 | 11,
  spec: LessonSeedSpec,
  content: LessonContent16
): QuizInfo {
  const mainTerm = spec.keyTerms[0] || { term: spec.title, shortDef: spec.summary };
  const secondTerm = spec.keyTerms[1] || { term: "Qonun ustuvorligi", shortDef: "Barchaning qonunga qat'iy bo'ysunishi." };
  const mainArticle = spec.legalArticles[0] || "O'zbekiston Respublikasi Konstitutsiyasi";
  const diagram = content.visualDiagram;

  const questions: QuizQuestion[] = [
    {
      id: `q-${quizId}-1`,
      type: "single",
      prompt: `"${spec.title}" mavzusidagi "${mainTerm.term}" tushunchasining to'g'ri ta'rifini toping:`,
      options: [
        mainTerm.shortDef,
        "Faqat xalqaro tashkilotlar tomonidan chiqariladigan norasmiy tavsiya.",
        "Hech qanday yuridik oqibatga ega bo'lmagan shaxsiy istak.",
        "Faqat sudyalar uchun mo'ljallangan ichki tartib qoidasi.",
      ],
      correctAnswer: 0,
      explanation: `Darslikka ko'ra: ${mainTerm.term} — ${mainTerm.shortDef}`,
      points: 10,
    },
    {
      id: `q-${quizId}-2`,
      type: "true_false",
      prompt: `To'g'rimi yoki noto'g'ri? "${spec.title}": ${spec.textbookFacts[0] || spec.summary}`,
      options: ["To'g'ri", "Noto'g'ri"],
      correctAnswer: 0,
      explanation: `Bu qoida ${gradeNum}-sinf darsligining ${spec.pageNumber}-betida tasdiqlangan.`,
      points: 10,
    },
    {
      id: `q-${quizId}-3`,
      type: "case",
      prompt: `Huquqiy vaziyat (${spec.title}): ${spec.legalCase.facts} Savol: ${spec.legalCase.question}`,
      options: [
        spec.legalCase.legalResolution,
        "Qonunchilik bu holatni tartibga solmaydi.",
        "Tomonlar kelishmasa ham harakat qonuniy deb topiladi.",
        "Faqat og'zaki ogohlantirish bilan cheklanish majburiy.",
      ],
      correctAnswer: 0,
      explanation: `To'g'ri yechim: ${spec.legalCase.legalResolution} (Asos: ${spec.legalCase.legalBasis}).`,
      points: 15,
    },
    {
      id: `q-${quizId}-4`,
      type: "multiple",
      prompt: `"${spec.title}" mavzusida o'quvchi egallashi lozim bo'lgan natijalarni belgilang (bir nechta):`,
      options: [
        spec.expectedOutcomes[0] || spec.title,
        spec.expectedOutcomes[1] || mainArticle,
        "Qonunlarni o'qimasdan taxminiy qaror chiqarish",
        "Boshqa fuqarolar huquqlarini inkor etish",
      ],
      correctAnswer: [0, 1],
      explanation: "Mavzuning asosiy maqsadi — nazariy bilimlarni va qonuniy manbalarni aniq qo'llashdir.",
      points: 15,
    },
    {
      id: `q-${quizId}-5`,
      type: "single",
      prompt: `"${spec.title}" mavzusi qaysi asosiy huquqiy hujjatga tayanadi?`,
      options: [
        mainArticle,
        "Faqat o'rta asr urf-odatlariga",
        "Noma'lum xorijiy kompaniya nizomiga",
        "Hech qanday normativ hujjatga tayanmaydi",
      ],
      correctAnswer: 0,
      explanation: `Ushbu mavzuning huquqiy asosi: ${spec.legalArticles.join(", ")}.`,
      points: 10,
    },
    {
      id: `q-${quizId}-6`,
      type: "matching",
      prompt: `"${spec.title}" mavzusidagi tushuncha va uning mazmunini moslashtiring:`,
      options: [mainTerm.shortDef, secondTerm.shortDef, spec.lifeExample.takeaway],
      matchPairs: [
        { left: mainTerm.term, right: mainTerm.shortDef },
        { left: secondTerm.term, right: secondTerm.shortDef },
        { left: spec.lifeExample.title, right: spec.lifeExample.takeaway },
      ],
      correctAnswer: {
        [mainTerm.term]: mainTerm.shortDef,
        [secondTerm.term]: secondTerm.shortDef,
        [spec.lifeExample.title]: spec.lifeExample.takeaway,
      },
      explanation: "Har bir atama o'z ta'rifi bilan aniq mos kelishi kerak.",
      points: 15,
    },
    {
      id: `q-${quizId}-7`,
      type: "ordering",
      prompt: `Sxemadagi bosqichlarni to'g'ri mantiqiy ketma-ketlikda joylashtiring (${spec.title} — ${diagram.title}):`,
      options: diagram.nodes.slice(0, 3).map((n) => n.label),
      correctAnswer: diagram.nodes.slice(0, 3).map((n) => n.label),
      explanation: "Huquqiy jarayon va iyerarxiya yuqoridan pastga yoki boshlanishidan natijagacha qat'iy tartibda kechadi.",
      points: 15,
    },
    {
      id: `q-${quizId}-8`,
      type: "visual",
      diagramKind: spec.diagramKind,
      prompt: `Vizual sxemaga qarang: "${diagram.nodes[0]?.label}" (${spec.title}) nimani anglatadi?`,
      options: [
        diagram.nodes[0]?.detail || spec.summary,
        "Hech qanday huquqiy ahamiyati yo'q",
        "Faqat statistik ma'lumot",
        "Majburiy bo'lmagan maslahat",
      ],
      correctAnswer: 0,
      explanation: `${diagram.nodes[0]?.label} — ${diagram.nodes[0]?.detail}.`,
      points: 10,
    },
    {
      id: `q-${quizId}-9`,
      type: "true_false",
      prompt: `To'g'rimi yoki noto'g'ri? "${spec.title} mavzusida qonuniy hujjatlar va moddalarni bilish shaxs huquqini himoya qilishda yordam bermaydi."`,
      options: ["To'g'ri", "Noto'g'ri"],
      correctAnswer: 1,
      explanation: "Noto'g'ri! Qonuniy hujjatlarni bilish o'z huquqingizni sud va vakolatli organlarda himoya qilishning asosiy vositasidir.",
      points: 10,
    },
    {
      id: `q-${quizId}-10`,
      type: "single",
      prompt: `"${spec.lifeExample.title}" hayotiy misolidan (${spec.title}) qanday xulosa chiqadi?`,
      options: [
        spec.lifeExample.takeaway,
        "Qoidalar faqat nazariya uchun yoziladi",
        "Mas'uliyat faqat kattalarga tegishli",
        "Murojaat qilish foydasiz",
      ],
      correctAnswer: 0,
      explanation: spec.lifeExample.takeaway,
      points: 10,
    },
  ];

  return {
    id: quizId,
    lessonId,
    gradeNumber: gradeNum,
    title: `${spec.lessonNumberLabel}: ${spec.title} — Yakuniy test`,
    timeLimitMinutes: 12,
    status: "verified",
    questions,
  };
}

function compileGrade(
  gradeNum: 8 | 9 | 10 | 11,
  chapters: ChapterInfo[],
  specs: LessonSeedSpec[],
  baseId: number
) {
  const lessons: LessonInfo[] = [];
  const presentations: PresentationDeck[] = [];
  const quizzes: QuizInfo[] = [];

  specs.forEach((spec, index) => {
    const id = baseId + index + 1;
    const chapter = chapters.find((c) => c.chapterNumber === spec.chapterNumber) || chapters[0];
    const content = buildLessonContent16(spec, gradeNum, id);
    const presentation = buildPresentationDeck(id, id, gradeNum, spec, content);
    const quiz = buildLessonQuiz(id, id, gradeNum, spec, content);

    lessons.push({
      id,
      slug: `sinf-${gradeNum}-dars-${id}`,
      gradeNumber: gradeNum,
      chapterId: chapter.id,
      chapterTitle: `${chapter.romanNumeral}. ${chapter.title}`,
      lessonNumberLabel: spec.lessonNumberLabel,
      orderIndex: index + 1,
      title: spec.title,
      summary: spec.summary,
      pageNumber: spec.pageNumber,
      estimatedMinutes: 45,
      status: "verified",
      content,
      presentationId: presentation.id,
      quizId: quiz.id,
    });

    presentations.push(presentation);
    quizzes.push(quiz);
  });

  return { lessons, presentations, quizzes };
}

const compiled8 = compileGrade(8, GRADE_8_CHAPTERS, applyLessonSplits(GRADE_8_LESSONS, ALL_LESSON_SPLITS[8] ?? {}), 8000);
const compiled9 = compileGrade(9, GRADE_9_CHAPTERS, applyLessonSplits(GRADE_9_LESSONS, ALL_LESSON_SPLITS[9]), 9000);
const compiled10 = compileGrade(10, GRADE_10_CHAPTERS, applyLessonSplits(GRADE_10_LESSONS, ALL_LESSON_SPLITS[10]), 10000);
const compiled11 = compileGrade(11, GRADE_11_CHAPTERS, applyLessonSplits(GRADE_11_LESSONS, ALL_LESSON_SPLITS[11]), 11000);

export const ALL_LESSONS: LessonInfo[] = [
  ...compiled8.lessons,
  ...compiled9.lessons,
  ...compiled10.lessons,
  ...compiled11.lessons,
];

export const ALL_PRESENTATIONS: PresentationDeck[] = [
  ...compiled8.presentations,
  ...compiled9.presentations,
  ...compiled10.presentations,
  ...compiled11.presentations,
];

export const ALL_QUIZZES: QuizInfo[] = [
  ...compiled8.quizzes,
  ...compiled9.quizzes,
  ...compiled10.quizzes,
  ...compiled11.quizzes,
];
