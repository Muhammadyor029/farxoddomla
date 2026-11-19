import { describe, expect, it } from "vitest";
import {
  ALL_CHAPTERS,
  ALL_GRADES,
  ALL_LESSONS,
  ALL_PRESENTATIONS,
  ALL_QUIZZES,
} from "../src/data/curriculumBuilder";
import {
  ACHIEVEMENT_DEFINITIONS,
  GAME_DEFINITIONS,
  LEGAL_SCENARIOS,
  LEGAL_TERMS_LIST,
  LEGISLATION_ARTICLES,
} from "../src/data/glossaryAndLaws";

describe("HUQUQ OLAMI curriculum integrity & zero-duplication audit", () => {
  it("contains exact 4 grades (8–11) summing to 114 lessons linked to local official PDF textbooks", () => {
    expect(ALL_GRADES.map((g) => g.gradeNumber)).toEqual([8, 9, 10, 11]);
    expect(ALL_GRADES.map((g) => g.lessonsCount)).toEqual([23, 33, 30, 28]);
    for (const grade of ALL_GRADES) {
      expect(grade.pdfPath).toMatch(/^\/assets\/aistudio\/.+\.pdf$/);
      expect(grade.chaptersCount).toBe(4);
      expect(grade.lessonsCount).toBeGreaterThanOrEqual(23);
    }
    expect(ALL_GRADES.reduce((acc, g) => acc + g.lessonsCount, 0)).toBe(114);
  });

  it("includes exactly 16 chapters and 114 unique lessons with all 16 pedagogical sections", () => {
    expect(ALL_CHAPTERS.length).toBe(16);
    expect(ALL_LESSONS.length).toBe(114);

    const uniqueTitles = new Set<string>();
    const uniqueObjectives = new Set<string>();
    const uniqueConclusions = new Set<string>();
    const uniqueSecondTasks = new Set<string>();

    for (const lesson of ALL_LESSONS) {
      expect(lesson.status).toBe("verified");
      expect(lesson.content.title).toBeTruthy();
      expect(lesson.content.objective).toBeTruthy();
      expect(lesson.content.expectedOutcomes.length).toBeGreaterThan(0);
      expect(lesson.content.keyTerms.length).toBeGreaterThanOrEqual(1);
      expect(lesson.content.theorySections.length).toBeGreaterThanOrEqual(2);
      expect(lesson.content.plainExplanations.length).toBeGreaterThanOrEqual(2);
      expect(lesson.content.lifeExamples.length).toBeGreaterThanOrEqual(2);
      expect(lesson.content.legalCases.length).toBeGreaterThanOrEqual(1);
      expect(lesson.content.visualDiagram.nodes.length).toBeGreaterThanOrEqual(3);
      expect(lesson.content.animatedDiagram.steps.length).toBeGreaterThanOrEqual(3);
      expect(lesson.content.interactiveTasks.length).toBeGreaterThanOrEqual(2);
      expect(lesson.content.miniGame.rounds.length).toBeGreaterThanOrEqual(1);
      expect(lesson.content.reinforcementQuestions.length).toBeGreaterThanOrEqual(2);
      expect(lesson.content.errorAnalysis?.length).toBeGreaterThanOrEqual(2);
      expect(lesson.content.conclusion).toBeTruthy();
      expect(lesson.content.sources.length).toBeGreaterThanOrEqual(2);
      expect(lesson.content.selfAssessment?.length).toBeGreaterThanOrEqual(3);

      uniqueTitles.add(lesson.title);
      uniqueObjectives.add(lesson.content.objective);
      uniqueConclusions.add(lesson.content.conclusion);
      uniqueSecondTasks.add(lesson.content.interactiveTasks[1].prompt);
    }

    expect(uniqueTitles.size).toBe(114);
    expect(uniqueObjectives.size).toBe(114);
    expect(uniqueConclusions.size).toBe(114);
    expect(uniqueSecondTasks.size).toBe(114);
  });

  it("provides 114 eight-slide presentations and 114 ten-question quizzes with zero duplicate question prompts", () => {
    expect(ALL_PRESENTATIONS.length).toBe(114);
    expect(ALL_QUIZZES.length).toBe(114);

    const allPrompts: string[] = [];
    for (const quiz of ALL_QUIZZES) {
      expect(quiz.questions.length).toBe(10);
      const questionTypes = new Set(quiz.questions.map((q) => q.type));
      expect(questionTypes.has("single")).toBe(true);
      expect(questionTypes.has("multiple")).toBe(true);
      expect(questionTypes.has("true_false")).toBe(true);
      expect(questionTypes.has("matching")).toBe(true);
      expect(questionTypes.has("ordering")).toBe(true);
      expect(questionTypes.has("case")).toBe(true);
      expect(questionTypes.has("visual")).toBe(true);
      for (const q of quiz.questions) {
        allPrompts.push(q.prompt);
      }
    }

    expect(allPrompts.length).toBe(1140);
    expect(new Set(allPrompts).size).toBe(1140);

    for (const deck of ALL_PRESENTATIONS) {
      expect(deck.slides.length).toBe(8);
    }
  });

  it("includes all 10 games, 9 scenario branches, glossary terms, legislation articles, and badges", () => {
    expect(GAME_DEFINITIONS.length).toBe(10);
    const courtGame = GAME_DEFINITIONS.find((g) => g.slug === "sud_zali");
    expect(courtGame?.isSimulation).toBe(true);

    expect(LEGAL_SCENARIOS.length).toBe(9);
    const categories = new Set(LEGAL_SCENARIOS.map((s) => s.category));
    expect(categories.size).toBe(9);

    expect(LEGAL_TERMS_LIST.length).toBeGreaterThanOrEqual(25);
    expect(LEGISLATION_ARTICLES.length).toBeGreaterThanOrEqual(9);
    expect(ACHIEVEMENT_DEFINITIONS.length).toBe(5);
  });
});
