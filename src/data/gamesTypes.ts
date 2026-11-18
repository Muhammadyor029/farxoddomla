import type { GameType } from "../../shared/types";

export type GradeLevel = 8 | 9 | 10 | 11;

export interface ChoiceRoundItem {
  id: string;
  prompt: string;
  clues?: string[];
  /** Options must always be balanced in length and legally plausible */
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface DominoChainItem {
  id: string;
  term: string;
  /** The prompt/definition linking to this tile */
  clue: string;
  articleHint: string;
}

export interface MatchPairItem {
  id: string;
  left: string;
  right: string;
}

export interface CrosswordItem {
  id: string;
  clue: string;
  answer: string;
  category: string;
}

export interface LabyrinthOption {
  label: string;
  isCorrect: boolean;
  feedback: string;
}

export interface LabyrinthStep {
  stage: string;
  question: string;
  options: LabyrinthOption[];
}

export interface LabyrinthScenario {
  id: string;
  title: string;
  steps: LabyrinthStep[];
}

export interface CaseAnalyzerStep {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface CaseAnalyzerScenario {
  id: string;
  title: string;
  story: string;
  steps: CaseAnalyzerStep[];
}

export interface GradeGamesBank {
  gradeNumber: GradeLevel;
  gradeLabel: string;
  curriculumFocus: string;
  huquqiy_detektiv: ChoiceRoundItem[];
  sud_zali: ChoiceRoundItem[];
  huquqiy_domino: DominoChainItem[];
  mosini_top: MatchPairItem[];
  qonuniy_yoki_noqonuniy: ChoiceRoundItem[];
  huquqiy_krossvord: CrosswordItem[];
  tezkor_qaror: ChoiceRoundItem[];
  huquqiy_labirint: LabyrinthScenario[];
  xatoni_top: ChoiceRoundItem[];
  voqeani_tahlil_qil: CaseAnalyzerScenario[];
}

export type GameSlugCheck = GameType;
