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

const OWNER_EMAIL = "qonun";
const LEGACY_OWNER_EMAIL = "fahodjon123";
const OWNER_PASSWORD = "qonun1991";
const OWNER_NAME = "Nargiza Ismatova";

export function ensureOwnerAccount(db: DatabaseSync): void {
  const ownerHash = bcrypt.hashSync(OWNER_PASSWORD, 8);
  const legacyOwner = db
    .prepare("SELECT id FROM users WHERE LOWER(email) = ?")
    .get(LEGACY_OWNER_EMAIL) as { id: number } | undefined;

  if (legacyOwner) {
    const conflictingOwner = db
      .prepare("SELECT id FROM users WHERE LOWER(email) = ? AND id != ?")
      .get(OWNER_EMAIL, legacyOwner.id) as { id: number } | undefined;
    if (conflictingOwner) {
      db.prepare("UPDATE users SET email = ? WHERE id = ?").run(`qonun-${conflictingOwner.id}`, conflictingOwner.id);
    }
    db.prepare("UPDATE users SET email = ? WHERE id = ?").run(OWNER_EMAIL, legacyOwner.id);
  }

  const existingOwner = db
    .prepare("SELECT id FROM users WHERE LOWER(email) = ?")
    .get(OWNER_EMAIL) as { id: number } | undefined;

  let ownerId: number;
  if (existingOwner) {
    ownerId = existingOwner.id;
    db.prepare(
      `UPDATE users
       SET email = ?, password_hash = ?, full_name = ?, role = 'admin',
           grade_number = 11, class_name = 'Boshqaruv', school_name = 'Huquq Olami'
       WHERE id = ?`
    ).run(OWNER_EMAIL, ownerHash, OWNER_NAME, ownerId);
  } else {
    const res = db
      .prepare(
        `INSERT INTO users (email, password_hash, full_name, role, grade_number, class_name, school_name, xp, level, streak_days)
         VALUES (?, ?, ?, 'admin', 11, 'Boshqaruv', 'Huquq Olami', 1650, 9, 12)`
      )
      .run(OWNER_EMAIL, ownerHash, OWNER_NAME);
    ownerId = Number(res.lastInsertRowid);
  }

  db.prepare("INSERT OR IGNORE INTO teacher_profiles (user_id) VALUES (?)").run(ownerId);
  db.prepare("UPDATE users SET role = 'student' WHERE LOWER(email) != ?").run(OWNER_EMAIL);
}

export function seedDatabase(db: DatabaseSync): void {
  const existingGrades = db.prepare("SELECT COUNT(*) as cnt FROM grades").get() as { cnt: number };
  if (existingGrades.cnt > 0) {
    ensureOwnerAccount(db);
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

    const insertGrade = db.prepare(`
      INSERT INTO grades (id, grade_number, title, subtitle, description, textbook_title, textbook_year, textbook_authors, pdf_path, total_pages)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const g of ALL_GRADES) {
      insertGrade.run(
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
      db.prepare(
        "INSERT INTO resources (title, resource_type, grade_number, file_url, description) VALUES (?, 'pdf_textbook', ?, ?, ?)"
      ).run(g.textbookTitle, g.gradeNumber, g.pdfPath, g.description);
    }

    const insertChapter = db.prepare(`
      INSERT INTO chapters (id, grade_number, chapter_number, roman_numeral, title, description, page_range)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of ALL_CHAPTERS) {
      insertChapter.run(c.id, c.gradeNumber, c.chapterNumber, c.romanNumeral, c.title, c.description, c.pageRange);
    }

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

    // Seed standard student leaderboard profiles + single master owner profile (qonun)
    const studentHash = bcrypt.hashSync("Student123!", 8);

    const insertUser = db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role, grade_number, class_name, school_name, xp, level, streak_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const studentRes = insertUser.run(
      "oquvchi@huquqolami.uz",
      studentHash,
      "Azizbek Toshmatov",
      "student",
      9,
      "9-A",
      "Toshkent sh. 110-umumta'lim maktabi",
      340,
      3,
      5
    );
    const student2Res = insertUser.run(
      "dilnoza@huquqolami.uz",
      studentHash,
      "Dilnoza Alimova",
      "student",
      10,
      "10-A",
      "Toshkent sh. 110-umumta'lim maktabi",
      620,
      5,
      7
    );
    const student3Res = insertUser.run(
      "jasur@huquqolami.uz",
      studentHash,
      "Jasurbek Qodirov",
      "student",
      11,
      "11-A",
      "Toshkent sh. 110-umumta'lim maktabi",
      810,
      6,
      8
    );

    db.prepare("INSERT INTO student_profiles (user_id, grade_number) VALUES (?, ?)").run(Number(studentRes.lastInsertRowid), 9);
    db.prepare("INSERT INTO student_profiles (user_id, grade_number) VALUES (?, ?)").run(Number(student2Res.lastInsertRowid), 10);
    db.prepare("INSERT INTO student_profiles (user_id, grade_number) VALUES (?, ?)").run(Number(student3Res.lastInsertRowid), 11);

    ensureOwnerAccount(db);
    const ownerRow = db.prepare("SELECT id FROM users WHERE LOWER(email) = ?").get(OWNER_EMAIL) as { id: number };

    const demoStudentId = Number(studentRes.lastInsertRowid);
    const demoTeacherId = ownerRow.id;

    // Seed initial progress & attempts for demo student
    db.prepare("INSERT INTO student_progress (user_id, lesson_id, completed, quiz_best_score) VALUES (?, ?, 1, 90)").run(demoStudentId, 9001);
    db.prepare("INSERT INTO student_progress (user_id, lesson_id, completed, quiz_best_score) VALUES (?, ?, 1, 85)").run(demoStudentId, 9002);
    db.prepare("INSERT INTO student_progress (user_id, lesson_id, completed, quiz_best_score) VALUES (?, ?, 1, 100)").run(demoStudentId, 8001);

    db.prepare(`
      INSERT INTO quiz_attempts (user_id, quiz_id, quiz_title, grade_number, score, max_score, percentage, elapsed_seconds, correct_count, total_questions, recommendations_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      demoStudentId,
      9001,
      "1-dars: Konstitutsiya – davlatning asosiy qonuni — Yakuniy test",
      9,
      105,
      120,
      87.5,
      195,
      9,
      10,
      JSON.stringify(["Konstitutsiya 15-moddasi bo'yicha oliy yuridik kuch misollarini ko'rib chiqing."])
    );

    db.prepare(`
      INSERT INTO game_attempts (user_id, game_slug, game_title, grade_number, lesson_id, score, max_score, xp_earned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(demoStudentId, "huquqiy_detektiv", "Huquqiy Detektiv", 9, 9001, 100, 120, 100);

    const insertAssignment = db.prepare(`
      INSERT INTO assignments (title, description, grade_number, lesson_id, due_date, teacher_id, teacher_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertAssignment.run(
      "8-sinf: Voyaga yetmaganlarning mehnat huquqlari tahlili",
      "Mehnat kodeksida 15–18 yoshli xodimlar uchun belgilangan ish vaqti chegaralarini yozma misollar bilan tushuntiring.",
      8,
      8020,
      "2026-05-25",
      demoTeacherId,
      "Nargiza Ismatova"
    );
    insertAssignment.run(
      "9-sinf: Yangi tahrirdagi Konstitutsiyada inson huquqlari",
      "Miranda qoidasi va Aybsizlik prezumpsiyasiga oid 27–28-moddalar asosida 1 ta hayotiy misol yozib yuboring.",
      9,
      9013,
      "2026-05-22",
      demoTeacherId,
      "Nargiza Ismatova"
    );
    insertAssignment.run(
      "10-sinf: Iste'molchi huquqlarini himoya qilish",
      "Nuqsonli tovar sotib olinganda xaridor talab qilishi mumkin bo'lgan 4 ta qonuniy huquqni sanang.",
      10,
      10012,
      "2026-05-28",
      demoTeacherId,
      "Nargiza Ismatova"
    );
    insertAssignment.run(
      "11-sinf: Mehnat shartnomasi va Ekologik javobgarlik",
      "Mehnat kodeksining 106 va 314-moddalariga tayangan holda intizomiy chora qoidalarini yozing.",
      11,
      11003,
      "2026-05-30",
      demoTeacherId,
      "Nargiza Ismatova"
    );

    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}
