export type UserRole = "student" | "teacher" | "admin";
export type UserStatus = "active" | "pending" | "rejected";
export type AccessRequestStatus = "none" | "pending" | "approved" | "rejected";
export type AccessResourceType =
  | "chapters"
  | "lessons"
  | "presentations"
  | "glossary"
  | "legislation"
  | "scenarios";
export type ContentStatus = "verified" | "draft";
export type ThemeMode = "night" | "day";

export interface UserAccount {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  status?: UserStatus;
  canUnlockTopics?: boolean;
  gradeNumber?: number;
  className?: string;
  schoolName?: string;
  xp: number;
  level: number;
  streakDays: number;
  createdAt: string;
}

export function isOwnerAccount(user?: { role?: string; canUnlockTopics?: boolean } | null): boolean {
  return Boolean(user && (user.role === "admin" || user.canUnlockTopics));
}

export interface AccessRequestRecord {
  id: number;
  userId: number;
  resourceType: AccessResourceType;
  resourceId: number;
  status: Exclude<AccessRequestStatus, "none">;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: number | null;
}

export interface GradeInfo {
  id: number;
  gradeNumber: 8 | 9 | 10 | 11;
  title: string;
  subtitle: string;
  description: string;
  textbookTitle: string;
  textbookYear: string;
  textbookAuthors: string;
  pdfPath: string;
  totalPages: number;
  chaptersCount: number;
  lessonsCount: number;
}

export interface ChapterInfo {
  id: number;
  gradeNumber: 8 | 9 | 10 | 11;
  chapterNumber: number;
  romanNumeral: string;
  title: string;
  description: string;
  pageRange: string;
  locked?: boolean;
}

export type DiagramKind =
  | "law_pyramid"
  | "legal_triad"
  | "court_stages"
  | "state_branches"
  | "rights_duties"
  | "labor_protection"
  | "eco_balance";

export interface DiagramNode {
  id: string;
  label: string;
  detail: string;
  articleRef?: string;
  level?: number;
}

export interface InteractiveTaskItem {
  id: string;
  type: "classification" | "decision" | "sequence" | "reflection";
  prompt: string;
  items: string[];
  correctAnswer: string | string[];
  explanation: string;
}

export type GameType =
  | "huquqiy_detektiv"
  | "sud_zali"
  | "huquqiy_domino"
  | "mosini_top"
  | "qonuniy_yoki_noqonuniy"
  | "huquqiy_krossvord"
  | "tezkor_qaror"
  | "huquqiy_labirint"
  | "xatoni_top"
  | "voqeani_tahlil_qil";

export interface LessonContent16 {
  /** 1. Mavzu nomi */
  title: string;
  /** 2. Dars maqsadi */
  objective: string;
  /** 3. Kutilayotgan natijalar */
  expectedOutcomes: string[];
  /** 4. Tayanch tushunchalar */
  keyTerms: Array<{ term: string; shortDef: string }>;
  /** 5. Nazariy qism (darslik faktlari + huquqiy asoslar) */
  theorySections: Array<{
    heading: string;
    textbookFact: string;
    legalArticles: string[];
  }>;
  /** 6. Oddiy tilda tushuntirish */
  plainExplanations: Array<{
    concept: string;
    simpleText: string;
  }>;
  /** 7. Hayotiy misollar */
  lifeExamples: Array<{
    title: string;
    situation: string;
    takeaway: string;
  }>;
  /** 8. Huquqiy vaziyatlar */
  legalCases: Array<{
    caseTitle: string;
    facts: string;
    question: string;
    legalResolution: string;
    legalBasis: string;
  }>;
  /** 9. Vizual sxema (grafik / jadval / piramida) */
  visualDiagram: {
    kind: DiagramKind;
    title: string;
    caption: string;
    nodes: DiagramNode[];
  };
  /** 10. Animatsion diagramma */
  animatedDiagram: {
    title: string;
    steps: Array<{
      stepNumber: number;
      title: string;
      description: string;
      highlight: string;
    }>;
  };
  /** 11. Interaktiv topshiriqlar */
  interactiveTasks: InteractiveTaskItem[];
  /** 12. Mini-o'yin */
  miniGame: {
    gameType: GameType;
    title: string;
    prompt: string;
    rounds: Array<{
      clue: string;
      options: string[];
      correctIndex: number;
      explanation: string;
    }>;
  };
  /** 13. Test savollari soni (bog'langan Quiz orqali to'liq) */
  quizId: number;
  /** 14. Mustahkamlash savollari */
  reinforcementQuestions: Array<{
    question: string;
    hint: string;
  }>;
  /** 15. Xatolar tahlili (ko'p uchraydigan xato tushunchalar) */
  errorAnalysis?: Array<{
    misconception: string;
    correction: string;
    legalBasis: string;
  }>;
  /** 16. Xulosa */
  conclusion: string;
  /** Foydalanilgan darslik manbalari */
  sources: Array<{
    title: string;
    pages: string;
    factNote: string;
  }>;
  /** O'z bilimini baholash cheklisti */
  selfAssessment?: string[];
}

export interface LessonInfo {
  id: number;
  slug: string;
  gradeNumber: 8 | 9 | 10 | 11;
  chapterId: number;
  chapterTitle: string;
  lessonNumberLabel: string;
  orderIndex: number;
  title: string;
  summary: string;
  pageNumber: number;
  estimatedMinutes: number;
  status: ContentStatus;
  content: LessonContent16;
  presentationId: number;
  quizId: number;
  locked?: boolean;
}

export type SlideLayout =
  | "title"
  | "objectives"
  | "terms"
  | "pyramid"
  | "flowchart"
  | "comparison"
  | "case_study"
  | "quiz"
  | "summary"
  | "image";

export interface PresentationSlide {
  id: string;
  order: number;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  bullets: string[];
  tableRows?: Array<{ left: string; right: string }>;
  diagramKind?: DiagramKind;
  imageUrl?: string;
  accentColor: string;
  backgroundTone: "obsidian" | "emerald" | "slate" | "contrast";
  speakerNotes: string;
}

export interface PresentationDeck {
  id: number;
  lessonId: number;
  gradeNumber: 8 | 9 | 10 | 11;
  title: string;
  templateName: string;
  status: ContentStatus;
  updatedAt: string;
  slides: PresentationSlide[];
}

export type QuestionType =
  | "single"
  | "multiple"
  | "true_false"
  | "matching"
  | "ordering"
  | "case"
  | "visual";

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  /** Single index, multi index array, ordered strings, or matching pairs */
  correctAnswer: number | number[] | string[] | Record<string, string>;
  matchPairs?: Array<{ left: string; right: string }>;
  diagramKind?: DiagramKind;
  explanation: string;
  points: number;
}

export interface QuizInfo {
  id: number;
  lessonId: number;
  gradeNumber: 8 | 9 | 10 | 11;
  title: string;
  timeLimitMinutes: number;
  status: ContentStatus;
  questions: QuizQuestion[];
}

export interface LegalTerm {
  id: number;
  term: string;
  gradeNumber: 8 | 9 | 10 | 11;
  lessonId?: number;
  shortDefinition: string;
  extendedNote: string;
  lifeExample: string;
  sourcePage: string;
}

export type ScenarioCategory =
  | "Huquq buzilishi"
  | "Mehnat huquqi"
  | "Oila huquqi"
  | "Fuqarolik huquqi"
  | "Voyaga yetmaganlar"
  | "Ma'muriy huquq"
  | "Jinoyat huquqi"
  | "Iste'molchi huquqi"
  | "Konstitutsiyaviy huquq";

export interface LegalScenario {
  id: number;
  gradeNumber: 8 | 9 | 10 | 11;
  category: ScenarioCategory;
  title: string;
  eventDescription: string;
  legalProblem: string;
  relatedConcepts: string[];
  choices: Array<{
    id: string;
    label: string;
    isCorrect: boolean;
    feedback: string;
  }>;
  solutionSummary: string;
  legalBasis: string;
  analysisNote: string;
}

export interface LegislationArticle {
  id: number;
  codeName: string;
  articleNumber: string;
  title: string;
  gradeNumber: 8 | 9 | 10 | 11;
  summaryText: string;
  practicalMeaning: string;
  sourcePage: string;
}

export interface GameDefinition {
  id: number;
  slug: GameType;
  title: string;
  subtitle: string;
  rules: string;
  educationalGoal: string;
  isSimulation?: boolean;
  xpReward: number;
  difficulty: "Oson" | "O'rta" | "Murakkab";
}

export interface QuizAttemptRecord {
  id: number;
  quizId: number;
  quizTitle: string;
  gradeNumber: number;
  score: number;
  maxScore: number;
  percentage: number;
  elapsedSeconds: number;
  correctCount: number;
  totalQuestions: number;
  recommendations: string[];
  createdAt: string;
}

export interface GameAttemptRecord {
  id: number;
  gameSlug: GameType;
  gameTitle: string;
  gradeNumber: number;
  lessonId?: number;
  score: number;
  maxScore: number;
  xpEarned: number;
  createdAt: string;
}

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  xpThreshold: number;
  badgeType: "shield" | "scale" | "book" | "trophy" | "flame" | "gavel";
  unlocked?: boolean;
}

export interface AssignmentItem {
  id: number;
  title: string;
  description: string;
  gradeNumber: number;
  lessonId?: number;
  dueDate: string;
  teacherName: string;
  submitted?: boolean;
  score?: number | null;
}
