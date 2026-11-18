import { GRADE_8_GAMES_BANK, GRADE_9_GAMES_BANK } from "./gamesGrade8And9";
import { GRADE_10_GAMES_BANK, GRADE_11_GAMES_BANK } from "./gamesGrade10And11";
import type {
  CaseAnalyzerScenario,
  ChoiceRoundItem,
  GradeGamesBank,
  GradeLevel,
  LabyrinthScenario,
} from "./gamesTypes";

export const GRADE_GAMES_BANK: Record<GradeLevel, GradeGamesBank> = {
  8: GRADE_8_GAMES_BANK,
  9: GRADE_9_GAMES_BANK,
  10: GRADE_10_GAMES_BANK,
  11: GRADE_11_GAMES_BANK,
};

export function normalizeGradeLevel(grade?: number): GradeLevel {
  if (grade === 8 || grade === 9 || grade === 10 || grade === 11) {
    return grade;
  }
  return 9;
}

export function getGradeGamesBank(grade?: number): GradeGamesBank {
  return GRADE_GAMES_BANK[normalizeGradeLevel(grade)];
}

/** Fisher-Yates unbiased shuffle */
export function shuffleArray<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Shuffles options inside a choice round while preserving the exact correct answer index.
 * Binary "Qonuniy / Noqonuniy" options keep fixed Left/Right placement for clean UX.
 */
export function shuffleChoiceRound(round: ChoiceRoundItem, keepBinaryOrder = false): ChoiceRoundItem {
  if (keepBinaryOrder && round.options.length === 2) {
    return { ...round, options: [...round.options] };
  }
  const tagged = round.options.map((text, idx) => ({
    text,
    isCorrect: idx === round.correctIndex,
  }));
  const mixed = shuffleArray(tagged);
  const newCorrectIndex = mixed.findIndex((item) => item.isCorrect);
  return {
    ...round,
    options: mixed.map((item) => item.text),
    correctIndex: newCorrectIndex >= 0 ? newCorrectIndex : 0,
  };
}

export function shuffleLabyrinthScenario(scenario: LabyrinthScenario): LabyrinthScenario {
  return {
    ...scenario,
    steps: scenario.steps.map((step) => ({
      ...step,
      options: shuffleArray(step.options),
    })),
  };
}

export function shuffleCaseAnalyzerScenario(scenario: CaseAnalyzerScenario): CaseAnalyzerScenario {
  return {
    ...scenario,
    steps: scenario.steps.map((step) => {
      const tagged = step.options.map((text, idx) => ({
        text,
        isCorrect: idx === step.correctIndex,
      }));
      const mixed = shuffleArray(tagged);
      return {
        ...step,
        options: mixed.map((item) => item.text),
        correctIndex: Math.max(
          0,
          mixed.findIndex((item) => item.isCorrect)
        ),
      };
    }),
  };
}

/** Normalizes Uzbek Latin text (strips apostrophe variants, spaces, hyphens, uppercases) */
export function normalizeUzbekAnswer(input: string): string {
  return input
    .replace(/['‘’`ʼʹ\s-]/g, "")
    .trim()
    .toUpperCase();
}

export interface CrosswordTile {
  id: string;
  char: string;
}

const UZ_DECOY_LETTERS = "ABDEFGHIJKLMNOPQRSTUVXYZ".split("");

/** Generates shuffled clickable letter tiles (exact answer letters + plausible decoy letters) */
export function buildCrosswordLetterTiles(answer: string, decoyCount = 4): CrosswordTile[] {
  const clean = normalizeUzbekAnswer(answer);
  const answerChars = clean.split("");
  const decoys: string[] = [];
  for (let i = 0; i < decoyCount; i += 1) {
    const pick = UZ_DECOY_LETTERS[Math.floor(Math.random() * UZ_DECOY_LETTERS.length)];
    decoys.push(pick);
  }
  const combined = [...answerChars, ...decoys].map((char, idx) => ({
    id: `tile-${idx}-${char}-${Math.random().toString(36).slice(2, 6)}`,
    char,
  }));
  return shuffleArray(combined);
}

