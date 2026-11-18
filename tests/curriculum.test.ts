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

describe("HUQUQ OLAMI curriculum integrity", () => {
  it("contains all 4 grades (8, 9, 10, 11) linked to local official PDF textbooks", () => {
    expect(ALL_GRADES.map((g) => g.gradeNumber)).toEqual([8, 9, 10, 11]);
    for (const grade of ALL_GRADES) {
      expect(grade.pdfPath).toMatch(/^\/assets\/aistudio\/.+\.pdf$/);
      expect(grade.chaptersCount).toBeGreaterThanOrEqual(4);
      expect(grade.lessonsCount).toBeGreaterThanOrEqual(10);
    }
  });

  it("includes chapters and 16-part lessons for every grade", () => {
    expect(ALL_CHAPTERS.length).toBe(16);
    expect(ALL_LESSONS.length).toBeGreaterThanOrEqual(60);

    for (const lesson of ALL_LESSONS) {
      expect(lesson.status).toBe("verified");
      expect(lesson.content.title).toBeTruthy();
      expect(lesson.content.objective).toBeTruthy();
      expect(lesson.content.expectedOutcomes.length).toBeGreaterThan(0);
      expect(lesson.content.keyTerms.length).toBeGreaterThan(0);
      expect(lesson.content.theorySections.length).toBeGreaterThan(0);
      expect(lesson.content.plainExplanations.length).toBeGreaterThan(0);
      expect(lesson.content.lifeExamples.length).toBeGreaterThan(0);
      expect(lesson.content.legalCases.length).toBeGreaterThan(0);
      expect(lesson.content.visualDiagram.nodes.length).toBeGreaterThan(0);
      expect(lesson.content.animatedDiagram.steps.length).toBeGreaterThan(0);
      expect(lesson.content.interactiveTasks.length).toBeGreaterThan(0);
      expect(lesson.content.miniGame.rounds.length).toBeGreaterThan(0);
      expect(lesson.content.reinforcementQuestions.length).toBeGreaterThan(0);
      expect(lesson.content.conclusion).toBeTruthy();
      expect(lesson.content.sources.length).toBeGreaterThan(0);
    }
  });

  it("provides multi-slide presentations and 10-question multi-type quizzes for every lesson", () => {
    expect(ALL_PRESENTATIONS.length).toBe(ALL_LESSONS.length);
    expect(ALL_QUIZZES.length).toBe(ALL_LESSONS.length);

    const sampleQuiz = ALL_QUIZZES[0];
    expect(sampleQuiz.questions.length).toBe(10);
    const questionTypes = new Set(sampleQuiz.questions.map((q) => q.type));
    expect(questionTypes.has("single")).toBe(true);
    expect(questionTypes.has("multiple")).toBe(true);
    expect(questionTypes.has("true_false")).toBe(true);
    expect(questionTypes.has("matching")).toBe(true);
    expect(questionTypes.has("ordering")).toBe(true);
    expect(questionTypes.has("case")).toBe(true);
    expect(questionTypes.has("visual")).toBe(true);

    const sampleDeck = ALL_PRESENTATIONS[0];
    expect(sampleDeck.slides.length).toBe(8);
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
