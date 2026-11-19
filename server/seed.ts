import type { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
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

const BUILTIN_OWNER_LOGIN = "qonun";
const BUILTIN_OWNER_PASSWORD = "qonun1991";
let warnedAboutBuiltinOwner = false;

export function ensureOwnerAccount(db: DatabaseSync): void {
  // Never overwrite an already created administrator account on subsequent startups.
  const existingAdmin = db
    .prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
    .get() as { id: number } | undefined;

  if (existingAdmin) {
    db.prepare("INSERT OR IGNORE INTO teacher_profiles (user_id) VALUES (?)").run(existingAdmin.id);
    return;
  }

  // Environment variables take precedence; the built-in account is only a first-boot fallback.
  const envLogin = process.env.OWNER_LOGIN?.trim().toLowerCase();
  const envPassword = process.env.OWNER_PASSWORD;
  const hasEnvCredentials = Boolean(envLogin && envPassword && envPassword.length >= 8);
  if (!hasEnvCredentials && !warnedAboutBuiltinOwner) {
    warnedAboutBuiltinOwner = true;
    console.warn(
      `Ogohlantirish: OWNER_LOGIN/OWNER_PASSWORD (kamida 8 belgi) berilmadi — ichki "${BUILTIN_OWNER_LOGIN}" / "${BUILTIN_OWNER_PASSWORD}" admin akkaunti ishlatilmoqda. Production muhitida env o'zgaruvchilarini o'rnating.`
    );
  }
  const ownerLogin = hasEnvCredentials ? envLogin! : BUILTIN_OWNER_LOGIN;
  const ownerPassword = hasEnvCredentials ? envPassword! : BUILTIN_OWNER_PASSWORD;

  const existingByLogin = db
    .prepare("SELECT id FROM users WHERE LOWER(email) = ?")
    .get(ownerLogin) as { id: number } | undefined;

  const ownerHash = bcrypt.hashSync(ownerPassword, 10);
  let ownerId: number;
  if (existingByLogin) {
    ownerId = existingByLogin.id;
    db.prepare(
      `UPDATE users
       SET password_hash = ?, role = 'admin', status = 'active', grade_number = 11, class_name = 'Boshqaruv', school_name = 'Huquq Olami'
       WHERE id = ?`
    ).run(ownerHash, ownerId);
  } else {
    const res = db
      .prepare(
        `INSERT INTO users (email, password_hash, full_name, role, grade_number, class_name, school_name, xp, level, streak_days, token_version)
         VALUES (?, ?, 'Platforma Egasi', 'admin', 11, 'Boshqaruv', 'Huquq Olami', 1650, 9, 12, 1)`
      )
      .run(ownerLogin, ownerHash);
    ownerId = Number(res.lastInsertRowid);
  }

  db.prepare("INSERT OR IGNORE INTO teacher_profiles (user_id) VALUES (?)").run(ownerId);
}

function upsertGradesAndResources(db: DatabaseSync, insertResources: boolean): void {
  const upsertGrade = db.prepare(`
    INSERT INTO grades (id, grade_number, title, subtitle, description, textbook_title, textbook_year, textbook_authors, pdf_path, total_pages)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      grade_number = excluded.grade_number,
      title = excluded.title,
      subtitle = excluded.subtitle,
      description = excluded.description,
      textbook_title = excluded.textbook_title,
      textbook_year = excluded.textbook_year,
      textbook_authors = excluded.textbook_authors,
      pdf_path = excluded.pdf_path,
      total_pages = excluded.total_pages
  `);
  const insertResource = db.prepare(
    "INSERT INTO resources (title, resource_type, grade_number, file_url, description) VALUES (?, 'pdf_textbook', ?, ?, ?)"
  );
  const updateResource = db.prepare(
    "UPDATE resources SET title = ?, file_url = ?, description = ? WHERE resource_type = 'pdf_textbook' AND grade_number = ?"
  );

  for (const g of ALL_GRADES) {
    upsertGrade.run(
      g.id,
      g.gradeNumber,
      g.title,
      g.subtitle,
      g.description,
      g.textbookTitle,
      g.textbookYear,
      g.textbookAuthors,
      g.pdfPath,
      g.totalPages
    );
    if (insertResources) {
      insertResource.run(g.textbookTitle, g.gradeNumber, g.pdfPath, g.description);
    } else {
      const updated = updateResource.run(g.textbookTitle, g.pdfPath, g.description, g.gradeNumber);
      if (Number(updated.changes) === 0) {
        insertResource.run(g.textbookTitle, g.gradeNumber, g.pdfPath, g.description);
      }
    }
  }
}

function upsertChapters(db: DatabaseSync): void {
  const upsertChapter = db.prepare(`
    INSERT INTO chapters (id, grade_number, chapter_number, roman_numeral, title, description, page_range)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      grade_number = excluded.grade_number,
      chapter_number = excluded.chapter_number,
      roman_numeral = excluded.roman_numeral,
      title = excluded.title,
      description = excluded.description,
      page_range = excluded.page_range
  `);
  for (const c of ALL_CHAPTERS) {
    upsertChapter.run(c.id, c.gradeNumber, c.chapterNumber, c.romanNumeral, c.title, c.description, c.pageRange);
  }
}

function insertCurriculumRecords(db: DatabaseSync): void {
  const insertLesson = db.prepare(`
    INSERT INTO lessons (id, slug, grade_number, chapter_id, chapter_title, lesson_number_label, order_index, title, summary, page_number, estimated_minutes, status, presentation_id, quiz_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertLessonContent = db.prepare(`
    INSERT INTO lesson_contents (lesson_id, content_json) VALUES (?, ?)
  `);
  for (const l of ALL_LESSONS) {
    insertLesson.run(
      l.id,
      l.slug,
      l.gradeNumber,
      l.chapterId,
      l.chapterTitle,
      l.lessonNumberLabel,
      l.orderIndex,
      l.title,
      l.summary,
      l.pageNumber,
      l.estimatedMinutes,
      l.status,
      l.presentationId,
      l.quizId
    );
    insertLessonContent.run(l.id, JSON.stringify(l.content));
  }

  const insertDeck = db.prepare(`
    INSERT INTO presentations (id, lesson_id, grade_number, title, template_name, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSlide = db.prepare(`
    INSERT INTO presentation_slides (id, presentation_id, slide_order, layout, title, subtitle, slide_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const deck of ALL_PRESENTATIONS) {
    insertDeck.run(
      deck.id,
      deck.lessonId,
      deck.gradeNumber,
      deck.title,
      deck.templateName,
      deck.status,
      deck.updatedAt
    );
    for (const s of deck.slides) {
      insertSlide.run(s.id, deck.id, s.order, s.layout, s.title, s.subtitle || "", JSON.stringify(s));
    }
  }

  const insertQuiz = db.prepare(`
    INSERT INTO quizzes (id, lesson_id, grade_number, title, time_limit_minutes, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertQuestion = db.prepare(`
    INSERT INTO questions (id, quiz_id, question_order, question_type, prompt, question_json, points)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertOption = db.prepare(`
    INSERT INTO answer_options (question_id, option_order, option_text, is_correct)
    VALUES (?, ?, ?, ?)
  `);
  for (const qz of ALL_QUIZZES) {
    insertQuiz.run(qz.id, qz.lessonId, qz.gradeNumber, qz.title, qz.timeLimitMinutes, qz.status);
    qz.questions.forEach((q, idx) => {
      insertQuestion.run(q.id, qz.id, idx + 1, q.type, q.prompt, JSON.stringify(q), q.points);
      q.options.forEach((opt, oIdx) => {
        const isCorr =
          typeof q.correctAnswer === "number"
            ? q.correctAnswer === oIdx
            : Array.isArray(q.correctAnswer) && typeof q.correctAnswer[0] === "number"
            ? (q.correctAnswer as number[]).includes(oIdx)
            : false;
        insertOption.run(q.id, oIdx + 1, opt, isCorr ? 1 : 0);
      });
    });
  }
}

function syncCurriculumIfOutdated(db: DatabaseSync): void {
  const expectedSignature = ALL_LESSONS.map(
    (l) => `${l.id}:${l.slug}:${l.lessonNumberLabel}:${l.title}`
  ).join("|");
  const currentLessons = db
    .prepare("SELECT id, slug, lesson_number_label, title FROM lessons WHERE id < 12000 ORDER BY id ASC")
    .all() as Array<{ id: number; slug: string; lesson_number_label: string; title: string }>;
  const currentSignature = currentLessons
    .map((l) => `${l.id}:${l.slug}:${l.lesson_number_label}:${l.title}`)
    .join("|");
  const currentPresCount = (
    db.prepare("SELECT COUNT(*) as c FROM presentations WHERE id < 12000").get() as { c: number }
  ).c;
  const currentQuizCount = (
    db.prepare("SELECT COUNT(*) as c FROM quizzes WHERE id < 12000").get() as { c: number }
  ).c;

  if (
    currentSignature === expectedSignature &&
    currentPresCount === ALL_PRESENTATIONS.length &&
    currentQuizCount === ALL_QUIZZES.length
  ) {
    return;
  }

  db.exec("BEGIN TRANSACTION;");
  try {
    upsertGradesAndResources(db, false);
    upsertChapters(db);
    db.exec("DELETE FROM lessons WHERE id < 12000;");
    db.exec("DELETE FROM presentations WHERE id < 12000;");
    db.exec("DELETE FROM quizzes WHERE id < 12000;");
    insertCurriculumRecords(db);

    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

export function seedDatabase(db: DatabaseSync): void {
  const existingGrades = db.prepare("SELECT COUNT(*) as cnt FROM grades").get() as { cnt: number };
  if (existingGrades.cnt > 0) {
    ensureOwnerAccount(db);
    syncCurriculumIfOutdated(db);
    return;
  }

  db.exec("BEGIN TRANSACTION;");
  try {
    db.prepare(
      "INSERT OR IGNORE INTO subjects (id, name, code, description) VALUES (1, ?, ?, ?)"
    ).run(
      "Davlat va huquq asoslari",
      "DHA-8-11",
      "O'zbekiston umumiy o'rta ta'lim maktablarining 8–11-sinflari uchun huquqiy ta'lim fani."
    );

    upsertGradesAndResources(db, true);
    upsertChapters(db);
    insertCurriculumRecords(db);

    const insertTerm = db.prepare(`
      INSERT INTO legal_terms (id, term, grade_number, lesson_id, short_definition, extended_note, life_example, source_page)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const t of LEGAL_TERMS_LIST) {
      insertTerm.run(
        t.id,
        t.term,
        t.gradeNumber,
        t.lessonId ?? null,
        t.shortDefinition,
        t.extendedNote,
        t.lifeExample,
        t.sourcePage
      );
    }

    const insertScenario = db.prepare(`
      INSERT INTO legal_scenarios (id, grade_number, category, title, scenario_json)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const sc of LEGAL_SCENARIOS) {
      insertScenario.run(sc.id, sc.gradeNumber, sc.category, sc.title, JSON.stringify(sc));
    }

    const insertLeg = db.prepare(`
      INSERT INTO legislation_articles (id, code_name, article_number, title, grade_number, summary_text, practical_meaning, source_page)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const art of LEGISLATION_ARTICLES) {
      insertLeg.run(
        art.id,
        art.codeName,
        art.articleNumber,
        art.title,
        art.gradeNumber,
        art.summaryText,
        art.practicalMeaning,
        art.sourcePage
      );
    }

    const insertGame = db.prepare(`
      INSERT INTO games (id, slug, title, subtitle, rules, educational_goal, is_simulation, xp_reward, difficulty)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const gm of GAME_DEFINITIONS) {
      insertGame.run(
        gm.id,
        gm.slug,
        gm.title,
        gm.subtitle,
        gm.rules,
        gm.educationalGoal,
        gm.isSimulation ? 1 : 0,
        gm.xpReward,
        gm.difficulty
      );
    }

    const insertAch = db.prepare(`
      INSERT INTO achievements (id, title, description, xp_threshold, badge_type)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const a of ACHIEVEMENT_DEFINITIONS) {
      insertAch.run(a.id, a.title, a.description, a.xpThreshold, a.badgeType);
    }

    db.prepare(`
      INSERT OR IGNORE INTO ai_settings (id, model_name, pedagogical_tone, strict_grounding, enabled)
      VALUES (1, 'gemini-4-hydrogen', 'Sodda, darslikka asoslangan va hayotiy misollar bilan', 1, 1)
    `).run();

    ensureOwnerAccount(db);

    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}
