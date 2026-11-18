import { describe, expect, it } from "vitest";
import {
  GRADE_GAMES_BANK,
  buildCrosswordLetterTiles,
  getGradeGamesBank,
  normalizeUzbekAnswer,
  shuffleCaseAnalyzerScenario,
  shuffleChoiceRound,
  shuffleLabyrinthScenario,
} from "../src/data/gamesBank";
import { GAME_DEFINITIONS } from "../src/data/glossaryAndLaws";
import type { GradeLevel } from "../src/data/gamesTypes";

const GRADES: GradeLevel[] = [8, 9, 10, 11];

function assertBalancedOptions(label: string, options: string[], correctIndex: number) {
  expect(options.length, `${label}: must have >= 3 options`).toBeGreaterThanOrEqual(3);
  expect(correctIndex, `${label}: invalid correctIndex`).toBeGreaterThanOrEqual(0);
  expect(correctIndex, `${label}: correctIndex out of range`).toBeLessThan(options.length);

  const unique = new Set(options.map((o) => o.trim()));
  expect(unique.size, `${label}: duplicate options detected`).toBe(options.length);

  const lengths = options.map((o) => o.trim().length);
  const correctLen = lengths[correctIndex];
  const wrongLengths = lengths.filter((_, i) => i !== correctIndex);
  const avgWrongLen = wrongLengths.reduce((acc, n) => acc + n, 0) / wrongLengths.length;
  const minLen = Math.min(...lengths);
  const maxLen = Math.max(...lengths);

  expect(
    correctLen,
    `${label}: correct option (${correctLen} chars) is trivially longer than wrong avg (${avgWrongLen.toFixed(1)} chars)`
  ).toBeLessThanOrEqual(avgWrongLen * 1.45);

  expect(
    maxLen,
    `${label}: option lengths overly skewed (min=${minLen}, max=${maxLen})`
  ).toBeLessThanOrEqual(minLen * 1.65);
}

describe("4-grade 10-game legal banks integrity & anti-length-cheat rules", () => {
  it("provides dedicated game pools for all 4 grades (8, 9, 10, 11) and all 10 game slugs", () => {
    expect(GAME_DEFINITIONS.length).toBe(10);
    for (const grade of GRADES) {
      const bank = getGradeGamesBank(grade);
      expect(bank.gradeNumber).toBe(grade);
      expect(bank.huquqiy_detektiv.length).toBeGreaterThanOrEqual(6);
      expect(bank.sud_zali.length).toBeGreaterThanOrEqual(6);
      expect(bank.huquqiy_domino.length).toBeGreaterThanOrEqual(6);
      expect(bank.mosini_top.length).toBeGreaterThanOrEqual(6);
      expect(bank.qonuniy_yoki_noqonuniy.length).toBeGreaterThanOrEqual(8);
      expect(bank.huquqiy_krossvord.length).toBeGreaterThanOrEqual(7);
      expect(bank.tezkor_qaror.length).toBeGreaterThanOrEqual(6);
      expect(bank.huquqiy_labirint.length).toBeGreaterThanOrEqual(2);
      expect(bank.xatoni_top.length).toBeGreaterThanOrEqual(6);
      expect(bank.voqeani_tahlil_qil.length).toBeGreaterThanOrEqual(2);
    }
    expect(Object.keys(GRADE_GAMES_BANK).length).toBe(4);
  });

  it("enforces equal-length plausible distractors across every choice game, labyrinth, and case analyzer", () => {
    for (const grade of GRADES) {
      const bank = getGradeGamesBank(grade);

      for (const round of bank.huquqiy_detektiv) {
        assertBalancedOptions(`${grade}-sinf ${round.id}`, round.options, round.correctIndex);
      }
      for (const round of bank.sud_zali) {
        assertBalancedOptions(`${grade}-sinf ${round.id}`, round.options, round.correctIndex);
      }
      for (const round of bank.tezkor_qaror) {
        assertBalancedOptions(`${grade}-sinf ${round.id}`, round.options, round.correctIndex);
      }
      for (const round of bank.xatoni_top) {
        assertBalancedOptions(`${grade}-sinf ${round.id}`, round.options, round.correctIndex);
      }

      for (const round of bank.qonuniy_yoki_noqonuniy) {
        expect(round.options).toEqual(["Qonuniy", "Noqonuniy"]);
        expect([0, 1]).toContain(round.correctIndex);
        expect(round.explanation.length).toBeGreaterThan(15);
      }

      for (const lab of bank.huquqiy_labirint) {
        expect(lab.steps.length).toBe(3);
        for (const step of lab.steps) {
          const correctIdx = step.options.findIndex((o) => o.isCorrect);
          expect(step.options.filter((o) => o.isCorrect).length).toBe(1);
          assertBalancedOptions(
            `${grade}-sinf ${lab.id} ${step.stage}`,
            step.options.map((o) => o.label),
            correctIdx
          );
        }
      }

      for (const dossier of bank.voqeani_tahlil_qil) {
        expect(dossier.steps.length).toBe(3);
        dossier.steps.forEach((step, idx) => {
          assertBalancedOptions(`${grade}-sinf ${dossier.id} step-${idx + 1}`, step.options, step.correctIndex);
        });
      }
    }
  });

  it("shuffles options randomly while preserving the exact right answer and normalizes Uzbek apostrophes", () => {
    const sample = GRADE_GAMES_BANK[9].huquqiy_detektiv[0];
    const expectedText = sample.options[sample.correctIndex];

    const positions = new Set<number>();
    for (let i = 0; i < 30; i += 1) {
      const mixed = shuffleChoiceRound(sample, false);
      expect(mixed.options[mixed.correctIndex]).toBe(expectedText);
      positions.add(mixed.correctIndex);
    }
    expect(positions.size).toBeGreaterThan(1);

    const labSample = GRADE_GAMES_BANK[10].huquqiy_labirint[0];
    const mixedLab = shuffleLabyrinthScenario(labSample);
    expect(mixedLab.steps[0].options.filter((o) => o.isCorrect).length).toBe(1);

    const caseSample = GRADE_GAMES_BANK[11].voqeani_tahlil_qil[0];
    const expectedCaseAnswer = caseSample.steps[0].options[caseSample.steps[0].correctIndex];
    const mixedCase = shuffleCaseAnalyzerScenario(caseSample);
    expect(mixedCase.steps[0].options[mixedCase.steps[0].correctIndex]).toBe(expectedCaseAnswer);

    expect(normalizeUzbekAnswer("O'g'rilik")).toBe("OGRILIK");
    expect(normalizeUzbekAnswer("o‘g‘rilik")).toBe("OGRILIK");
    expect(normalizeUzbekAnswer("Iste’molchi ")).toBe("ISTEMOLCHI");
    expect(normalizeUzbekAnswer("Xabeas korpus")).toBe("XABEASKORPUS");
  });

  it("generates solvable clickable letter-tile pools for every crossword across all 4 grades", () => {
    for (const grade of GRADES) {
      const bank = getGradeGamesBank(grade);
      for (const word of bank.huquqiy_krossvord) {
        const expected = normalizeUzbekAnswer(word.answer);
        const tiles = buildCrosswordLetterTiles(word.answer, 4);
        expect(tiles.length).toBe(expected.length + 4);
        expect(new Set(tiles.map((t) => t.id)).size).toBe(tiles.length);

        // Verify all required letters exist with sufficient multiplicity
        const counts: Record<string, number> = {};
        for (const t of tiles) {
          counts[t.char] = (counts[t.char] || 0) + 1;
        }
        for (const ch of expected) {
          expect(counts[ch] || 0, `${grade}-sinf ${word.answer} missing ${ch}`).toBeGreaterThanOrEqual(1);
          counts[ch] -= 1;
        }
      }
    }
  });
});
