import express, { type Express } from "express";
import type { DatabaseSync } from "node:sqlite";
import { createDatabase } from "./db";
import { seedDatabase } from "./seed";
import {
  attachOptionalUser,
  hashPassword,
  mapUserRow,
  requireAuth,
  requireRole,
  signToken,
  verifyPassword,
  type AuthenticatedRequest,
} from "./auth";
import { runLegalAiTask } from "./ai";
import { isOwnerAccount, type PresentationSlide, type QuizQuestion, type UserRole } from "../shared/types";

function recalculateUserLevel(xp: number): number {
  return Math.max(1, Math.floor(xp / 150) + 1);
}

export function createApp(customDb?: DatabaseSync): { app: Express; db: DatabaseSync } {
  const db = customDb || createDatabase();
  seedDatabase(db);

  const app = express();
  app.use(express.json({ limit: "4mb" }));
  app.use(attachOptionalUser(db));

  app.get("/api/health", (_req, res) => {
    const gradesCount = (db.prepare("SELECT COUNT(*) as c FROM grades").get() as { c: number }).c;
    const lessonsCount = (db.prepare("SELECT COUNT(*) as c FROM lessons").get() as { c: number }).c;
    res.json({ status: "ok", gradesCount, lessonsCount });
  });

  // ==================== AUTH ROUTES ====================
  app.post("/api/auth/register", (req, res) => {
    const { email, password, fullName, gradeNumber, className, schoolName } = req.body || {};
    if (!email || !password || !fullName) {
      res.status(400).json({ error: "Ism-familiya, login/email va parol kiritilishi shart." });
      return;
    }
    const cleanEmail = String(email).trim().toLowerCase();
    // Single-sided registration: no role switching allowed
    const safeRole: UserRole = "student";
    const existing = db.prepare("SELECT id FROM users WHERE LOWER(email) = ?").get(cleanEmail);
    if (existing) {
      res.status(409).json({ error: "Ushbu login yoki email allaqachon ro'yxatdan o'tgan." });
      return;
    }

    const passwordHash = hashPassword(String(password));
    const gradeNum = [8, 9, 10, 11].includes(Number(gradeNumber)) ? Number(gradeNumber) : 9;
    const info = db
      .prepare(
        `INSERT INTO users (email, password_hash, full_name, role, grade_number, class_name, school_name, xp, level, streak_days)
         VALUES (?, ?, ?, ?, ?, ?, ?, 50, 1, 1)`
      )
      .run(
        cleanEmail,
        passwordHash,
        String(fullName).trim(),
        safeRole,
        gradeNum,
        String(className || `${gradeNum}-A`),
        String(schoolName || "O'zbekiston umumta'lim maktabi")
      );

    const userId = Number(info.lastInsertRowid);
    db.prepare("INSERT INTO student_profiles (user_id, grade_number) VALUES (?, ?)").run(userId, gradeNum);

    const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as never;
    const user = mapUserRow(userRow);
    const token = signToken(user);
    res.status(201).json({ token, user });
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: "Email va parolni kiriting." });
      return;
    }
    const row = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(String(email).trim().toLowerCase()) as
      | (Parameters<typeof mapUserRow>[0] & { password_hash: string })
      | undefined;

    if (!row || !verifyPassword(String(password), row.password_hash)) {
      res.status(401).json({ error: "Email yoki parol noto'g'ri." });
      return;
    }
    const user = mapUserRow(row);
    const token = signToken(user);
    res.json({ token, user });
  });

  app.get("/api/auth/me", requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  // ==================== CURRICULUM ROUTES ====================
  app.get("/api/grades", (_req, res) => {
    const grades = db.prepare("SELECT * FROM grades ORDER BY grade_number ASC").all() as Array<{
      id: number;
      grade_number: number;
      title: string;
      subtitle: string;
      description: string;
      textbook_title: string;
      textbook_year: string;
      textbook_authors: string;
      pdf_path: string;
      total_pages: number;
    }>;

    const result = grades.map((g) => {
      const chaptersCount = (
        db.prepare("SELECT COUNT(*) as c FROM chapters WHERE grade_number = ?").get(g.grade_number) as { c: number }
      ).c;
      const lessonsCount = (
        db.prepare("SELECT COUNT(*) as c FROM lessons WHERE grade_number = ?").get(g.grade_number) as { c: number }
      ).c;
      return {
        id: g.id,
        gradeNumber: g.grade_number,
        title: g.title,
        subtitle: g.subtitle,
        description: g.description,
        textbookTitle: g.textbook_title,
        textbookYear: g.textbook_year,
        textbookAuthors: g.textbook_authors,
        pdfPath: g.pdf_path,
        totalPages: g.total_pages,
        chaptersCount,
        lessonsCount,
      };
    });
    res.json({ grades: result });
  });

  app.get("/api/chapters", (req: AuthenticatedRequest, res) => {
    const unlocked = isOwnerAccount(req.user);
    const grade = req.query.grade ? Number(req.query.grade) : null;
    const rows = (
      grade
        ? db.prepare("SELECT * FROM chapters WHERE grade_number = ? ORDER BY chapter_number ASC").all(grade)
        : db.prepare("SELECT * FROM chapters ORDER BY grade_number ASC, chapter_number ASC").all()
    ) as Array<{
      id: number;
      grade_number: number;
      chapter_number: number;
      roman_numeral: string;
      title: string;
      description: string;
      page_range: string;
    }>;
    res.json({
      locked: !unlocked,
      chapters: rows.map((c) => ({
        id: c.id,
        gradeNumber: c.grade_number,
        chapterNumber: c.chapter_number,
        romanNumeral: unlocked ? c.roman_numeral : `${c.chapter_number}-qism`,
        title: unlocked ? c.title : "",
        description: unlocked ? c.description : "",
        pageRange: unlocked ? c.page_range : "",
        locked: !unlocked,
      })),
    });
  });

  app.get("/api/lessons", (req: AuthenticatedRequest, res) => {
    const unlocked = isOwnerAccount(req.user);
    const grade = req.query.grade ? Number(req.query.grade) : null;
    const search = req.query.q ? String(req.query.q).trim().toLowerCase() : "";
    const statusFilter = req.query.status ? String(req.query.status) : null;

    const rows = (
      grade
        ? db.prepare("SELECT * FROM lessons WHERE grade_number = ? ORDER BY order_index ASC").all(grade)
        : db.prepare("SELECT * FROM lessons ORDER BY grade_number ASC, order_index ASC").all()
    ) as Array<{
      id: number;
      slug: string;
      grade_number: number;
      chapter_id: number;
      chapter_title: string;
      lesson_number_label: string;
      order_index: number;
      title: string;
      summary: string;
      page_number: number;
      estimated_minutes: number;
      status: string;
      presentation_id: number;
      quiz_id: number;
    }>;

    const filtered = rows
      .filter((r) => (!statusFilter ? true : r.status === statusFilter))
      .filter((r) =>
        !unlocked || !search
          ? true
          : r.title.toLowerCase().includes(search) ||
            r.summary.toLowerCase().includes(search) ||
            r.chapter_title.toLowerCase().includes(search)
      )
      .map((r) =>
        unlocked
          ? {
              id: r.id,
              slug: r.slug,
              gradeNumber: r.grade_number,
              chapterId: r.chapter_id,
              chapterTitle: r.chapter_title,
              lessonNumberLabel: r.lesson_number_label,
              orderIndex: r.order_index,
              title: r.title,
              summary: r.summary,
              pageNumber: r.page_number,
              estimatedMinutes: r.estimated_minutes,
              status: r.status,
              presentationId: r.presentation_id,
              quizId: r.quiz_id,
              locked: false,
            }
          : {
              id: r.id,
              slug: "",
              gradeNumber: r.grade_number,
              chapterId: r.chapter_id,
              chapterTitle: "",
              lessonNumberLabel: "",
              orderIndex: r.order_index,
              title: "",
              summary: "",
              pageNumber: 0,
              estimatedMinutes: 0,
              status: r.status,
              presentationId: 0,
              quizId: 0,
              locked: true,
            }
      );

    res.json({ locked: !unlocked, lessons: filtered });
  });

  app.get("/api/lessons/:id", (req: AuthenticatedRequest, res) => {
    if (!isOwnerAccount(req.user)) {
      res.status(403).json({
        locked: true,
        error: "Mavzular qulflangan. Ochish uchun ruxsat etilgan profil bilan tizimga kiring.",
      });
      return;
    }

    const id = Number(req.params.id);
    const row = db
      .prepare(
        `SELECT l.*, lc.content_json
         FROM lessons l
         LEFT JOIN lesson_contents lc ON l.id = lc.lesson_id
         WHERE l.id = ?`
      )
      .get(id) as
      | {
          id: number;
          slug: string;
          grade_number: number;
          chapter_id: number;
          chapter_title: string;
          lesson_number_label: string;
          order_index: number;
          title: string;
          summary: string;
          page_number: number;
          estimated_minutes: number;
          status: string;
          presentation_id: number;
          quiz_id: number;
          content_json: string | null;
        }
      | undefined;

    if (!row) {
      res.status(404).json({ error: "Dars topilmadi." });
      return;
    }

    res.json({
      lesson: {
        id: row.id,
        slug: row.slug,
        gradeNumber: row.grade_number,
        chapterId: row.chapter_id,
        chapterTitle: row.chapter_title,
        lessonNumberLabel: row.lesson_number_label,
        orderIndex: row.order_index,
        title: row.title,
        summary: row.summary,
        pageNumber: row.page_number,
        estimatedMinutes: row.estimated_minutes,
        status: row.status,
        presentationId: row.presentation_id,
        quizId: row.quiz_id,
        content: row.content_json ? JSON.parse(row.content_json) : null,
      },
    });
  });

  // ==================== PRESENTATIONS ROUTES ====================
  app.get("/api/presentations", (req, res) => {
    const grade = req.query.grade ? Number(req.query.grade) : null;
    const rows = (
      grade
        ? db.prepare("SELECT * FROM presentations WHERE grade_number = ? ORDER BY id ASC").all(grade)
        : db.prepare("SELECT * FROM presentations ORDER BY grade_number ASC, id ASC").all()
    ) as Array<{
      id: number;
      lesson_id: number;
      grade_number: number;
      title: string;
      template_name: string;
      status: string;
      updated_at: string;
    }>;

    const slideCountStmt = db.prepare("SELECT COUNT(*) as c FROM presentation_slides WHERE presentation_id = ?");
    res.json({
      presentations: rows.map((p) => ({
        id: p.id,
        lessonId: p.lesson_id,
        gradeNumber: p.grade_number,
        title: p.title,
        templateName: p.template_name,
        status: p.status,
        updatedAt: p.updated_at,
        slideCount: (slideCountStmt.get(p.id) as { c: number }).c,
      })),
    });
  });

  app.get("/api/presentations/:id", (req, res) => {
    const id = Number(req.params.id);
    const deck = db.prepare("SELECT * FROM presentations WHERE id = ?").get(id) as
      | {
          id: number;
          lesson_id: number;
          grade_number: number;
          title: string;
          template_name: string;
          status: string;
          updated_at: string;
        }
      | undefined;

    if (!deck) {
      res.status(404).json({ error: "Prezentatsiya topilmadi." });
      return;
    }

    const slidesRows = db
      .prepare("SELECT slide_json FROM presentation_slides WHERE presentation_id = ? ORDER BY slide_order ASC")
      .all(id) as Array<{ slide_json: string }>;

    res.json({
      presentation: {
        id: deck.id,
        lessonId: deck.lesson_id,
        gradeNumber: deck.grade_number,
        title: deck.title,
        templateName: deck.template_name,
        status: deck.status,
        updatedAt: deck.updated_at,
        slides: slidesRows.map((s) => JSON.parse(s.slide_json)),
      },
    });
  });

  app.put("/api/presentations/:id", requireAuth, (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const { title, templateName, slides } = req.body || {};
    const existing = db.prepare("SELECT id FROM presentations WHERE id = ?").get(id);
    if (!existing) {
      res.status(404).json({ error: "Prezentatsiya topilmadi." });
      return;
    }
    if (!Array.isArray(slides) || slides.length === 0) {
      res.status(400).json({ error: "Kamida bitta slayd bo'lishi kerak." });
      return;
    }

    const now = new Date().toISOString();
    db.exec("BEGIN TRANSACTION;");
    try {
      db.prepare("UPDATE presentations SET title = ?, template_name = ?, updated_at = ? WHERE id = ?").run(
        String(title || "Prezentatsiya"),
        String(templateName || "Huquq Olami Neon-Grafit"),
        now,
        id
      );
      db.prepare("DELETE FROM presentation_slides WHERE presentation_id = ?").run(id);
      const insertSlide = db.prepare(`
        INSERT INTO presentation_slides (id, presentation_id, slide_order, layout, title, subtitle, slide_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      (slides as PresentationSlide[]).forEach((s, idx) => {
        const cleanSlide: PresentationSlide = {
          ...s,
          id: s.id || `s-${id}-${idx + 1}-${Date.now()}`,
          order: idx + 1,
        };
        insertSlide.run(
          cleanSlide.id,
          id,
          idx + 1,
          cleanSlide.layout,
          cleanSlide.title,
          cleanSlide.subtitle || "",
          JSON.stringify(cleanSlide)
        );
      });
      db.exec("COMMIT;");
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }

    res.json({ success: true, updatedAt: now });
  });

  // ==================== QUIZZES & ATTEMPTS ====================
  app.get("/api/quizzes", (req, res) => {
    const grade = req.query.grade ? Number(req.query.grade) : null;
    const rows = (
      grade
        ? db.prepare("SELECT * FROM quizzes WHERE grade_number = ? ORDER BY id ASC").all(grade)
        : db.prepare("SELECT * FROM quizzes ORDER BY grade_number ASC, id ASC").all()
    ) as Array<{
      id: number;
      lesson_id: number;
      grade_number: number;
      title: string;
      time_limit_minutes: number;
      status: string;
    }>;

    const qCountStmt = db.prepare("SELECT COUNT(*) as c FROM questions WHERE quiz_id = ?");
    res.json({
      quizzes: rows.map((q) => ({
        id: q.id,
        lessonId: q.lesson_id,
        gradeNumber: q.grade_number,
        title: q.title,
        timeLimitMinutes: q.time_limit_minutes,
        status: q.status,
        questionCount: (qCountStmt.get(q.id) as { c: number }).c,
      })),
    });
  });

  app.get("/api/quizzes/:id", (req, res) => {
    const id = Number(req.params.id);
    const quiz = db.prepare("SELECT * FROM quizzes WHERE id = ?").get(id) as
      | {
          id: number;
          lesson_id: number;
          grade_number: number;
          title: string;
          time_limit_minutes: number;
          status: string;
        }
      | undefined;

    if (!quiz) {
      res.status(404).json({ error: "Test topilmadi." });
      return;
    }

    const qRows = db
      .prepare("SELECT question_json FROM questions WHERE quiz_id = ? ORDER BY question_order ASC")
      .all(id) as Array<{ question_json: string }>;

    res.json({
      quiz: {
        id: quiz.id,
        lessonId: quiz.lesson_id,
        gradeNumber: quiz.grade_number,
        title: quiz.title,
        timeLimitMinutes: quiz.time_limit_minutes,
        status: quiz.status,
        questions: qRows.map((r) => JSON.parse(r.question_json)),
      },
    });
  });

  app.post("/api/quiz-attempts", (req: AuthenticatedRequest, res) => {
    const { quizId, answers, elapsedSeconds } = req.body || {};
    const qzId = Number(quizId);
    const quiz = db.prepare("SELECT * FROM quizzes WHERE id = ?").get(qzId) as
      | { id: number; lesson_id: number; grade_number: number; title: string }
      | undefined;
    if (!quiz) {
      res.status(404).json({ error: "Test topilmadi." });
      return;
    }

    const qRows = db
      .prepare("SELECT question_json FROM questions WHERE quiz_id = ? ORDER BY question_order ASC")
      .all(qzId) as Array<{ question_json: string }>;
    const questions = qRows.map((r) => JSON.parse(r.question_json) as QuizQuestion);

    let score = 0;
    let maxScore = 0;
    let correctCount = 0;
    const breakdown: Array<{ questionId: string; isCorrect: boolean; explanation: string; prompt: string }> = [];
    const recommendations: string[] = [];

    for (const q of questions) {
      maxScore += q.points;
      const userAns = answers ? answers[q.id] : undefined;
      let isCorrect = false;

      if (q.type === "multiple" && Array.isArray(q.correctAnswer) && Array.isArray(userAns)) {
        const expected = [...(q.correctAnswer as number[])].sort().join(",");
        const actual = [...(userAns as number[])].sort().join(",");
        isCorrect = expected === actual;
      } else if (q.type === "ordering" && Array.isArray(q.correctAnswer) && Array.isArray(userAns)) {
        isCorrect = JSON.stringify(q.correctAnswer) === JSON.stringify(userAns);
      } else if (
        q.type === "matching" &&
        typeof q.correctAnswer === "object" &&
        !Array.isArray(q.correctAnswer) &&
        userAns &&
        typeof userAns === "object"
      ) {
        const expectedObj = q.correctAnswer as Record<string, string>;
        const userObj = userAns as Record<string, string>;
        isCorrect = Object.keys(expectedObj).every((k) => userObj[k] === expectedObj[k]);
      } else {
        isCorrect = userAns === q.correctAnswer;
      }

      if (isCorrect) {
        score += q.points;
        correctCount += 1;
      } else {
        recommendations.push(q.explanation);
      }

      breakdown.push({
        questionId: q.id,
        prompt: q.prompt,
        isCorrect,
        explanation: q.explanation,
      });
    }

    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0;
    const finalRecs =
      recommendations.length > 0
        ? recommendations.slice(0, 4)
        : ["Ajoyib natija! Keyingi mavzu va amaliy vaziyatlarni o'rganishga o'tishingiz mumkin."];

    const attemptRes = db
      .prepare(
        `INSERT INTO quiz_attempts (user_id, quiz_id, quiz_title, grade_number, score, max_score, percentage, elapsed_seconds, correct_count, total_questions, recommendations_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.user?.id ?? null,
        quiz.id,
        quiz.title,
        quiz.grade_number,
        score,
        maxScore,
        percentage,
        Number(elapsedSeconds || 60),
        correctCount,
        questions.length,
        JSON.stringify(finalRecs)
      );

    let xpEarned = 0;
    if (req.user) {
      xpEarned = Math.max(20, Math.round(score * 0.8));
      const newXp = req.user.xp + xpEarned;
      const newLevel = recalculateUserLevel(newXp);
      db.prepare("UPDATE users SET xp = ?, level = ? WHERE id = ?").run(newXp, newLevel, req.user.id);
      db.prepare(
        `INSERT INTO student_progress (user_id, lesson_id, completed, quiz_best_score)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(user_id, lesson_id) DO UPDATE SET
           completed = 1,
           quiz_best_score = MAX(student_progress.quiz_best_score, excluded.quiz_best_score),
           updated_at = CURRENT_TIMESTAMP`
      ).run(req.user.id, quiz.lesson_id, Math.round(percentage));
    }

    res.status(201).json({
      attempt: {
        id: Number(attemptRes.lastInsertRowid),
        quizId: quiz.id,
        quizTitle: quiz.title,
        gradeNumber: quiz.grade_number,
        score,
        maxScore,
        percentage,
        elapsedSeconds: Number(elapsedSeconds || 60),
        correctCount,
        totalQuestions: questions.length,
        recommendations: finalRecs,
        xpEarned,
        breakdown,
      },
    });
  });

  // ==================== GAMES, SCENARIOS, GLOSSARY, LEGISLATION ====================
  app.get("/api/games", (_req, res) => {
    const rows = db.prepare("SELECT * FROM games ORDER BY id ASC").all() as Array<{
      id: number;
      slug: string;
      title: string;
      subtitle: string;
      rules: string;
      educational_goal: string;
      is_simulation: number;
      xp_reward: number;
      difficulty: string;
    }>;
    res.json({
      games: rows.map((g) => ({
        id: g.id,
        slug: g.slug,
        title: g.title,
        subtitle: g.subtitle,
        rules: g.rules,
        educationalGoal: g.educational_goal,
        isSimulation: g.is_simulation === 1,
        xpReward: g.xp_reward,
        difficulty: g.difficulty,
      })),
    });
  });

  app.post("/api/game-attempts", (req: AuthenticatedRequest, res) => {
    const { gameSlug, gameTitle, gradeNumber, lessonId, score, maxScore } = req.body || {};
    if (!gameSlug || !gameTitle) {
      res.status(400).json({ error: "O'yin ma'lumotlari to'liq emas." });
      return;
    }
    const cleanScore = Math.max(0, Number(score || 0));
    const cleanMax = Math.max(1, Number(maxScore || 100));
    const xpEarned = Math.max(15, Math.round((cleanScore / cleanMax) * 120));

    const info = db
      .prepare(
        `INSERT INTO game_attempts (user_id, game_slug, game_title, grade_number, lesson_id, score, max_score, xp_earned)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.user?.id ?? null,
        String(gameSlug),
        String(gameTitle),
        Number(gradeNumber || 9),
        lessonId ? Number(lessonId) : null,
        cleanScore,
        cleanMax,
        xpEarned
      );

    if (req.user) {
      const newXp = req.user.xp + xpEarned;
      const newLevel = recalculateUserLevel(newXp);
      db.prepare("UPDATE users SET xp = ?, level = ? WHERE id = ?").run(newXp, newLevel, req.user.id);
    }

    res.status(201).json({
      attempt: {
        id: Number(info.lastInsertRowid),
        gameSlug,
        gameTitle,
        score: cleanScore,
        maxScore: cleanMax,
        xpEarned,
      },
    });
  });

  app.get("/api/scenarios", (req, res) => {
    const grade = req.query.grade ? Number(req.query.grade) : null;
    const category = req.query.category ? String(req.query.category) : null;
    const rows = db.prepare("SELECT scenario_json FROM legal_scenarios ORDER BY id ASC").all() as Array<{
      scenario_json: string;
    }>;
    let items = rows.map((r) => JSON.parse(r.scenario_json));
    if (grade) items = items.filter((s) => s.gradeNumber === grade);
    if (category && category !== "all") items = items.filter((s) => s.category === category);
    res.json({ scenarios: items });
  });

  app.get("/api/glossary", (req, res) => {
    const grade = req.query.grade ? Number(req.query.grade) : null;
    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : "";
    const rows = db.prepare("SELECT * FROM legal_terms ORDER BY term ASC").all() as Array<{
      id: number;
      term: string;
      grade_number: number;
      lesson_id: number | null;
      short_definition: string;
      extended_note: string;
      life_example: string;
      source_page: string;
    }>;
    const terms = rows
      .filter((t) => (!grade ? true : t.grade_number === grade))
      .filter((t) =>
        !q
          ? true
          : t.term.toLowerCase().includes(q) ||
            t.short_definition.toLowerCase().includes(q) ||
            t.extended_note.toLowerCase().includes(q)
      )
      .map((t) => ({
        id: t.id,
        term: t.term,
        gradeNumber: t.grade_number,
        lessonId: t.lesson_id ?? undefined,
        shortDefinition: t.short_definition,
        extendedNote: t.extended_note,
        lifeExample: t.life_example,
        sourcePage: t.source_page,
      }));
    res.json({ terms });
  });

  app.get("/api/legislation", (req, res) => {
    const code = req.query.code ? String(req.query.code) : "";
    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : "";
    const rows = db.prepare("SELECT * FROM legislation_articles ORDER BY id ASC").all() as Array<{
      id: number;
      code_name: string;
      article_number: string;
      title: string;
      grade_number: number;
      summary_text: string;
      practical_meaning: string;
      source_page: string;
    }>;
    const articles = rows
      .filter((a) => (!code || code === "all" ? true : a.code_name === code))
      .filter((a) =>
        !q
          ? true
          : a.title.toLowerCase().includes(q) ||
            a.summary_text.toLowerCase().includes(q) ||
            a.article_number.toLowerCase().includes(q) ||
            a.code_name.toLowerCase().includes(q)
      )
      .map((a) => ({
        id: a.id,
        codeName: a.code_name,
        articleNumber: a.article_number,
        title: a.title,
        gradeNumber: a.grade_number,
        summaryText: a.summary_text,
        practicalMeaning: a.practical_meaning,
        sourcePage: a.source_page,
      }));
    res.json({ articles });
  });

  // ==================== STUDENT CABINET ====================
  app.get("/api/student/dashboard", requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as never;
    const freshUser = mapUserRow(userRow);

    const progressRows = db
      .prepare(
        `SELECT sp.lesson_id, sp.completed, sp.quiz_best_score, sp.updated_at, l.title, l.grade_number, l.lesson_number_label
         FROM student_progress sp
         JOIN lessons l ON sp.lesson_id = l.id
         WHERE sp.user_id = ?
         ORDER BY sp.updated_at DESC`
      )
      .all(userId);

    const quizAttempts = db
      .prepare("SELECT * FROM quiz_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 20")
      .all(userId) as Array<{
      id: number;
      quiz_id: number;
      quiz_title: string;
      grade_number: number;
      score: number;
      max_score: number;
      percentage: number;
      elapsed_seconds: number;
      correct_count: number;
      total_questions: number;
      recommendations_json: string;
      created_at: string;
    }>;

    const gameAttempts = db
      .prepare("SELECT * FROM game_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 20")
      .all(userId) as Array<{
      id: number;
      game_slug: string;
      game_title: string;
      grade_number: number;
      lesson_id: number | null;
      score: number;
      max_score: number;
      xp_earned: number;
      created_at: string;
    }>;

    const achievements = db.prepare("SELECT * FROM achievements ORDER BY xp_threshold ASC").all() as Array<{
      id: string;
      title: string;
      description: string;
      xp_threshold: number;
      badge_type: string;
    }>;

    const assignments = db
      .prepare(
        `SELECT a.*, s.answer_text, s.score as submission_score, s.feedback
         FROM assignments a
         LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.student_id = ?
         ORDER BY a.due_date ASC`
      )
      .all(userId) as Array<{
      id: number;
      title: string;
      description: string;
      grade_number: number;
      lesson_id: number | null;
      due_date: string;
      teacher_name: string;
      answer_text: string | null;
      submission_score: number | null;
      feedback: string | null;
    }>;

    const leaderboard = db
      .prepare("SELECT id, full_name, grade_number, class_name, xp, level FROM users WHERE role = 'student' ORDER BY xp DESC LIMIT 10")
      .all();

    res.json({
      user: freshUser,
      progress: progressRows,
      quizAttempts: quizAttempts.map((qa) => ({
        id: qa.id,
        quizId: qa.quiz_id,
        quizTitle: qa.quiz_title,
        gradeNumber: qa.grade_number,
        score: qa.score,
        maxScore: qa.max_score,
        percentage: qa.percentage,
        elapsedSeconds: qa.elapsed_seconds,
        correctCount: qa.correct_count,
        totalQuestions: qa.total_questions,
        recommendations: JSON.parse(qa.recommendations_json),
        createdAt: qa.created_at,
      })),
      gameAttempts: gameAttempts.map((ga) => ({
        id: ga.id,
        gameSlug: ga.game_slug,
        gameTitle: ga.game_title,
        gradeNumber: ga.grade_number,
        lessonId: ga.lesson_id ?? undefined,
        score: ga.score,
        maxScore: ga.max_score,
        xpEarned: ga.xp_earned,
        createdAt: ga.created_at,
      })),
      achievements: achievements.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        xpThreshold: a.xp_threshold,
        badgeType: a.badge_type,
        unlocked: freshUser.xp >= a.xp_threshold,
      })),
      assignments: assignments.map((asg) => ({
        id: asg.id,
        title: asg.title,
        description: asg.description,
        gradeNumber: asg.grade_number,
        lessonId: asg.lesson_id ?? undefined,
        dueDate: asg.due_date,
        teacherName: asg.teacher_name,
        submitted: Boolean(asg.answer_text),
        answerText: asg.answer_text || "",
        score: asg.submission_score,
        feedback: asg.feedback || "",
      })),
      leaderboard,
    });
  });

  app.post("/api/student/progress", requireAuth, (req: AuthenticatedRequest, res) => {
    const lessonId = Number(req.body?.lessonId);
    if (!lessonId) {
      res.status(400).json({ error: "lessonId talab qilinadi." });
      return;
    }
    db.prepare(
      `INSERT INTO student_progress (user_id, lesson_id, completed)
       VALUES (?, ?, 1)
       ON CONFLICT(user_id, lesson_id) DO UPDATE SET completed = 1, updated_at = CURRENT_TIMESTAMP`
    ).run(req.user!.id, lessonId);

    const newXp = req.user!.xp + 30;
    const newLevel = recalculateUserLevel(newXp);
    db.prepare("UPDATE users SET xp = ?, level = ? WHERE id = ?").run(newXp, newLevel, req.user!.id);
    res.json({ success: true, xp: newXp, level: newLevel });
  });

  app.post("/api/student/assignments/:id/submit", requireAuth, (req: AuthenticatedRequest, res) => {
    const assignmentId = Number(req.params.id);
    const answerText = String(req.body?.answerText || "").trim();
    if (!answerText) {
      res.status(400).json({ error: "Javob matnini kiriting." });
      return;
    }
    db.prepare(
      `INSERT INTO assignment_submissions (assignment_id, student_id, answer_text)
       VALUES (?, ?, ?)
       ON CONFLICT(assignment_id, student_id) DO UPDATE SET answer_text = excluded.answer_text, submitted_at = CURRENT_TIMESTAMP`
    ).run(assignmentId, req.user!.id, answerText);

    const newXp = req.user!.xp + 40;
    db.prepare("UPDATE users SET xp = ?, level = ? WHERE id = ?").run(newXp, recalculateUserLevel(newXp), req.user!.id);
    res.json({ success: true, xp: newXp });
  });

  // ==================== TEACHER CABINET ====================
  app.get("/api/teacher/dashboard", requireRole(["teacher", "admin"]), (_req, res) => {
    const students = db
      .prepare(
        `SELECT u.id, u.full_name, u.email, u.grade_number, u.class_name, u.school_name, u.xp, u.level,
                (SELECT COUNT(*) FROM student_progress sp WHERE sp.user_id = u.id) as completed_lessons,
                (SELECT ROUND(AVG(qa.percentage), 1) FROM quiz_attempts qa WHERE qa.user_id = u.id) as avg_quiz_score
         FROM users u WHERE u.role = 'student' ORDER BY u.grade_number ASC, u.xp DESC`
      )
      .all();

    const assignments = db.prepare("SELECT * FROM assignments ORDER BY created_at DESC").all();
    const submissions = db
      .prepare(
        `SELECT s.*, u.full_name as student_name, u.grade_number, a.title as assignment_title
         FROM assignment_submissions s
         JOIN users u ON s.student_id = u.id
         JOIN assignments a ON s.assignment_id = a.id
         ORDER BY s.submitted_at DESC`
      )
      .all();

    res.json({ students, assignments, submissions });
  });

  app.post("/api/teacher/lessons", requireRole(["teacher", "admin"]), (req, res) => {
    const { gradeNumber, chapterId, lessonNumberLabel, title, summary, pageNumber, status, objective, plainExplanation } =
      req.body || {};
    if (!gradeNumber || !title) {
      res.status(400).json({ error: "Sinf va mavzu nomi shart." });
      return;
    }
    const gradeNum = Number(gradeNumber) as 8 | 9 | 10 | 11;
    const chId = Number(chapterId) || gradeNum * 100 + 1;
    const ch = db.prepare("SELECT roman_numeral, title FROM chapters WHERE id = ?").get(chId) as
      | { roman_numeral: string; title: string }
      | undefined;

    const maxRow = db.prepare("SELECT MAX(id) as maxId FROM lessons").get() as { maxId: number | null };
    const newId = Math.max(12000, (maxRow.maxId || 12000) + 1);
    const cleanStatus = status === "verified" ? "verified" : "draft";

    const content = {
      title: `${lessonNumberLabel || "Qo'shimcha dars"}: ${title}`,
      objective: objective || `${title} mavzusining nazariy va amaliy asoslarini o'rgatish.`,
      expectedOutcomes: ["Mavzuning asosiy tushunchalarini biladi", "Hayotiy vaziyatlarda qo'llay oladi"],
      keyTerms: [{ term: title, shortDef: summary || title }],
      theorySections: [
        {
          heading: "O'qituvchi qo'shimcha ma'ruzasi",
          textbookFact: summary || title,
          legalArticles: ["O'zbekiston Respublikasi Konstitutsiyasi"],
        },
      ],
      plainExplanations: [{ concept: title, simpleText: plainExplanation || summary || title }],
      lifeExamples: [{ title: "Amaliy misol", situation: summary || title, takeaway: "Qonunga hurmat — adolat garovi." }],
      legalCases: [
        {
          caseTitle: "Muhokama vaziyati",
          facts: summary || title,
          question: "Bu holatda qanday qonuniy qaror qabul qilinadi?",
          legalResolution: "Qonunchilik normalariga tayangan holda hal qilinadi.",
          legalBasis: "O'zbekiston Respublikasi qonunchiligi",
        },
      ],
      visualDiagram: {
        kind: "legal_triad",
        title: `${title} sxemasi`,
        caption: "O'qituvchi tomonidan yaratilgan dars sxemasi",
        nodes: [
          { id: "n1", level: 1, label: "Asosiy tushuncha", detail: title },
          { id: "n2", level: 2, label: "Huquqiy asos", detail: "Amaldagi qonunchilik" },
          { id: "n3", level: 3, label: "Amaliy natija", detail: objective || "Huquqiy madaniyat" },
        ],
      },
      animatedDiagram: {
        title: `${title} bosqichlari`,
        steps: [
          { stepNumber: 1, title: "Kirish", description: title, highlight: `${gradeNum}-sinf` },
          { stepNumber: 2, title: "Tahlil", description: plainExplanation || summary || title, highlight: "Amaliyot" },
        ],
      },
      interactiveTasks: [],
      miniGame: {
        gameType: "mosini_top",
        title: `Mini-o'yin: ${title}`,
        prompt: "Tayanch savolga javob bering:",
        rounds: [
          {
            clue: summary || title,
            options: [title, "Noto'g'ri variant", "Aloqasiz javob"],
            correctIndex: 0,
            explanation: title,
          },
        ],
      },
      quizId: newId,
      reinforcementQuestions: [{ question: `${title} nimani anglatadi?`, hint: summary || title }],
      conclusion: `${title} bo'yicha o'quvchi bilimlari mustahkamlandi.`,
      sources: [{ title: "O'qituvchi mualliflik materiali", pages: `${pageNumber || 1}-bet`, factNote: `Status: ${cleanStatus}` }],
    };

    db.prepare(
      `INSERT INTO lessons (id, slug, grade_number, chapter_id, chapter_title, lesson_number_label, order_index, title, summary, page_number, estimated_minutes, status, presentation_id, quiz_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 45, ?, ?, ?)`
    ).run(
      newId,
      `custom-${newId}`,
      gradeNum,
      chId,
      ch ? `${ch.roman_numeral}. ${ch.title}` : "Qo'shimcha bob",
      String(lessonNumberLabel || "Qo'shimcha dars"),
      99,
      String(title),
      String(summary || title),
      Number(pageNumber || 1),
      cleanStatus,
      newId,
      newId
    );
    db.prepare("INSERT INTO lesson_contents (lesson_id, content_json) VALUES (?, ?)").run(newId, JSON.stringify(content));

    // Create default presentation & quiz so linked IDs work cleanly
    db.prepare(
      "INSERT INTO presentations (id, lesson_id, grade_number, title, status) VALUES (?, ?, ?, ?, ?)"
    ).run(newId, newId, gradeNum, String(title), cleanStatus);
    db.prepare(
      "INSERT INTO presentation_slides (id, presentation_id, slide_order, layout, title, subtitle, slide_json) VALUES (?, ?, 1, 'title', ?, ?, ?)"
    ).run(
      `s-${newId}-1`,
      newId,
      String(title),
      `${gradeNum}-sinf`,
      JSON.stringify({
        id: `s-${newId}-1`,
        order: 1,
        layout: "title",
        title: String(title),
        subtitle: `${gradeNum}-sinf · Davlat va huquq asoslari`,
        bullets: [String(summary || title)],
        accentColor: "#39FF55",
        backgroundTone: "obsidian",
        speakerNotes: String(objective || ""),
      })
    );

    db.prepare("INSERT INTO quizzes (id, lesson_id, grade_number, title, status) VALUES (?, ?, ?, ?, ?)").run(
      newId,
      newId,
      gradeNum,
      `${title} — Test`,
      cleanStatus
    );
    const defaultQ: QuizQuestion = {
      id: `q-${newId}-1`,
      type: "single",
      prompt: `${title} mavzusining asosiy mazmuni qaysi?`,
      options: [String(summary || title), "Mavzuga aloqasiz javob", "Hech biri"],
      correctAnswer: 0,
      explanation: String(summary || title),
      points: 10,
    };
    db.prepare(
      "INSERT INTO questions (id, quiz_id, question_order, question_type, prompt, question_json, points) VALUES (?, ?, 1, 'single', ?, ?, 10)"
    ).run(defaultQ.id, newId, defaultQ.prompt, JSON.stringify(defaultQ));

    res.status(201).json({ id: newId, status: cleanStatus });
  });

  app.post("/api/teacher/quizzes/:id/questions", requireRole(["teacher", "admin"]), (req, res) => {
    const quizId = Number(req.params.id);
    const { prompt, options, correctIndex, explanation } = req.body || {};
    if (!prompt || !Array.isArray(options) || options.length < 2) {
      res.status(400).json({ error: "Savol matni va kamida 2 ta variant kiriting." });
      return;
    }
    const existingCount = (db.prepare("SELECT COUNT(*) as c FROM questions WHERE quiz_id = ?").get(quizId) as { c: number }).c;
    const qId = `q-${quizId}-custom-${Date.now()}`;
    const qObj: QuizQuestion = {
      id: qId,
      type: "single",
      prompt: String(prompt),
      options: options.map(String),
      correctAnswer: Number(correctIndex || 0),
      explanation: String(explanation || "O'qituvchi tomonidan qo'shilgan savol."),
      points: 10,
    };
    db.prepare(
      "INSERT INTO questions (id, quiz_id, question_order, question_type, prompt, question_json, points) VALUES (?, ?, ?, 'single', ?, ?, 10)"
    ).run(qId, quizId, existingCount + 1, qObj.prompt, JSON.stringify(qObj));

    res.status(201).json({ question: qObj });
  });

  app.post("/api/teacher/assignments", requireRole(["teacher", "admin"]), (req: AuthenticatedRequest, res) => {
    const { title, description, gradeNumber, lessonId, dueDate } = req.body || {};
    if (!title || !description) {
      res.status(400).json({ error: "Vazifa sarlavhasi va tavsifini kiriting." });
      return;
    }
    const info = db
      .prepare(
        `INSERT INTO assignments (title, description, grade_number, lesson_id, due_date, teacher_id, teacher_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        String(title),
        String(description),
        Number(gradeNumber || 9),
        lessonId ? Number(lessonId) : null,
        String(dueDate || "2026-06-01"),
        req.user!.id,
        req.user!.fullName
      );
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });

  app.post("/api/teacher/submissions/:id/grade", requireRole(["teacher", "admin"]), (req, res) => {
    const subId = Number(req.params.id);
    const { score, feedback } = req.body || {};
    db.prepare("UPDATE assignment_submissions SET score = ?, feedback = ? WHERE id = ?").run(
      Number(score || 0),
      String(feedback || ""),
      subId
    );
    res.json({ success: true });
  });

  // ==================== ADMIN PANEL ====================
  app.get("/api/admin/dashboard", requireRole(["admin"]), (_req, res) => {
    const users = db
      .prepare("SELECT id, email, full_name, role, grade_number, class_name, school_name, xp, level, created_at FROM users ORDER BY id ASC")
      .all();
    const stats = {
      usersCount: users.length,
      lessonsCount: (db.prepare("SELECT COUNT(*) as c FROM lessons").get() as { c: number }).c,
      verifiedLessons: (db.prepare("SELECT COUNT(*) as c FROM lessons WHERE status = 'verified'").get() as { c: number }).c,
      draftLessons: (db.prepare("SELECT COUNT(*) as c FROM lessons WHERE status = 'draft'").get() as { c: number }).c,
      quizzesCount: (db.prepare("SELECT COUNT(*) as c FROM quizzes").get() as { c: number }).c,
      quizAttemptsCount: (db.prepare("SELECT COUNT(*) as c FROM quiz_attempts").get() as { c: number }).c,
      gameAttemptsCount: (db.prepare("SELECT COUNT(*) as c FROM game_attempts").get() as { c: number }).c,
      presentationsCount: (db.prepare("SELECT COUNT(*) as c FROM presentations").get() as { c: number }).c,
    };
    const aiSettings = db.prepare("SELECT * FROM ai_settings WHERE id = 1").get();
    res.json({ users, stats, aiSettings });
  });

  app.patch("/api/admin/users/:id/role", requireRole(["admin"]), (req, res) => {
    const targetId = Number(req.params.id);
    const role = req.body?.role;
    if (!["student", "teacher", "admin"].includes(role)) {
      res.status(400).json({ error: "Noto'g'ri rol." });
      return;
    }
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, targetId);
    res.json({ success: true });
  });

  app.patch("/api/admin/lessons/:id/status", requireRole(["admin", "teacher"]), (req, res) => {
    const id = Number(req.params.id);
    const status = req.body?.status === "draft" ? "draft" : "verified";
    db.prepare("UPDATE lessons SET status = ? WHERE id = ?").run(status, id);
    res.json({ success: true, status });
  });

  app.delete("/api/admin/lessons/:id", requireRole(["admin"]), (req, res) => {
    const id = Number(req.params.id);
    db.prepare("DELETE FROM lessons WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.put("/api/admin/ai-settings", requireRole(["admin"]), (req, res) => {
    const { modelName, pedagogicalTone, strictGrounding, enabled } = req.body || {};
    db.prepare(
      `UPDATE ai_settings SET model_name = ?, pedagogical_tone = ?, strict_grounding = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`
    ).run(
      String(modelName || "gemini-4-hydrogen"),
      String(pedagogicalTone || "Sodda, darslikka asoslangan"),
      strictGrounding ? 1 : 0,
      enabled ? 1 : 0
    );
    res.json({ success: true });
  });

  // ==================== GEMINI AI ROUTES (SERVER-SIDE ONLY) ====================
  app.post("/api/ai/task", async (req, res) => {
    const { task, prompt, gradeNumber, lessonId } = req.body || {};
    if (!prompt || String(prompt).trim().length < 2) {
      res.status(400).json({ error: "Savol yoki mavzuni kiriting." });
      return;
    }
    const allowedTasks = ["chat", "explain", "define", "generate_quiz", "analyze_case", "generate_slides"];
    const safeTask = allowedTasks.includes(task) ? task : "chat";
    try {
      const result = await runLegalAiTask(db, {
        task: safeTask,
        prompt: String(prompt),
        gradeNumber: gradeNumber ? Number(gradeNumber) : undefined,
        lessonId: lessonId ? Number(lessonId) : undefined,
      });
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI xizmatida xatolik yuz berdi.";
      res.status(503).json({ error: msg });
    }
  });

  return { app, db };
}
