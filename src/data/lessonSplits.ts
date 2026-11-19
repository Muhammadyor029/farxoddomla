import type { LessonSeedSpec } from "./grade8";
import { GRADE_9_SPLITS } from "./splitGrade9";
import { GRADE_10_SPLITS } from "./splitGrade10";
import { GRADE_11_SPLITS } from "./splitGrade11";

export type LessonSplitSpec = Omit<
  LessonSeedSpec,
  "pageNumber" | "chapterNumber" | "diagramKind" | "miniGameType"
> & { pageOffset?: number };

export function applyLessonSplits(
  lessons: LessonSeedSpec[],
  splits: Record<string, LessonSplitSpec[]>
): LessonSeedSpec[] {
  return lessons.flatMap((lesson) => {
    const topics = splits[lesson.title];
    if (!topics) return [lesson];
    return topics.map(({ pageOffset, ...topic }, index) => ({
      ...lesson,
      ...topic,
      pageNumber: lesson.pageNumber + (pageOffset ?? index),
      chapterNumber: lesson.chapterNumber,
      diagramKind: lesson.diagramKind,
      miniGameType: lesson.miniGameType,
    }));
  });
}

export const ALL_LESSON_SPLITS: Record<number, Record<string, LessonSplitSpec[]>> = {
  9: GRADE_9_SPLITS,
  10: GRADE_10_SPLITS,
  11: GRADE_11_SPLITS,
};
