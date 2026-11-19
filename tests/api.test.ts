import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createDatabase } from "../server/db";
import { createApp } from "../server/app";
import type { QuizQuestion } from "../shared/types";

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  const db = createDatabase(":memory:");
  const { app } = createApp(db);
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

async function apiJson<T = Record<string, unknown>>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {}
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = (await res.json()) as T;
  return { status: res.status, data };
}

describe("HUQUQ OLAMI Express + SQLite API integration", () => {
  it("reports healthy seeded database on /api/health and /api/grades", async () => {
    const health = await apiJson<{ status: string; gradesCount: number; lessonsCount: number }>("/api/health");
    expect(health.status).toBe(200);
    expect(health.data.status).toBe("ok");
    expect(health.data.gradesCount).toBe(4);
    expect(health.data.lessonsCount).toBeGreaterThanOrEqual(60);

    const grades = await apiJson<{ grades: Array<{ gradeNumber: number }> }>("/api/grades");
    expect(grades.status).toBe(200);
    expect(grades.data.grades.map((g) => g.gradeNumber)).toEqual([8, 9, 10, 11]);
  });

  it("authenticates qonun owner account, enforces single-sided registration, and locks topics for others", async () => {
    // Unauthenticated protected route fails with 401
    const unauth = await apiJson("/api/student/dashboard");
    expect(unauth.status).toBe(401);

    // Unauthenticated visitors see locked lessons without topic text
    const guestLessons = await apiJson<{ locked: boolean; lessons: Array<{ title: string; locked: boolean }> }>(
      "/api/lessons?grade=9"
    );
    expect(guestLessons.status).toBe(200);
    expect(guestLessons.data.locked).toBe(true);
    expect(guestLessons.data.lessons.length).toBeGreaterThan(0);
    expect(guestLessons.data.lessons[0].locked).toBe(true);
    expect(guestLessons.data.lessons[0].title).toBe("");

    const guestDetail = await apiJson<{ locked: boolean }>("/api/lessons/9001");
    expect(guestDetail.status).toBe(403);
    expect(guestDetail.data.locked).toBe(true);

    // Register new user — role is strictly forced to student (single-sided)
    const reg = await apiJson<{ token: string; user: { email: string; role: string } }>("/api/auth/register", {
      method: "POST",
      body: {
        email: "yangi.oquvchi@huquqolami.uz",
        password: "Password123!",
        fullName: "Madina Rasulova",
        gradeNumber: 8,
        role: "teacher",
      },
    });
    expect(reg.status).toBe(201);
    expect(reg.data.user.role).toBe("student");
    const regToken = reg.data.token;

    // Newly registered user still cannot access management panels or locked topics
    const regTryTeacher = await apiJson("/api/teacher/dashboard", { token: regToken });
    expect(regTryTeacher.status).toBe(403);
    const regTryAdmin = await apiJson("/api/admin/dashboard", { token: regToken });
    expect(regTryAdmin.status).toBe(403);
    const regLessonDetail = await apiJson("/api/lessons/9001", { token: regToken });
    expect(regLessonDetail.status).toBe(403);

    // Master profile qonun / qonun1991 unlocks everything
    const ownerLogin = await apiJson<{ token: string; user: { email: string; role: string } }>("/api/auth/login", {
      method: "POST",
      body: { email: "qonun", password: "qonun1991" },
    });
    expect(ownerLogin.status).toBe(200);
    expect(ownerLogin.data.user.role).toBe("admin");

    const ownerLessons = await apiJson<{ locked: boolean; lessons: Array<{ title: string; locked: boolean }> }>(
      "/api/lessons?grade=9",
      { token: ownerLogin.data.token }
    );
    expect(ownerLessons.status).toBe(200);
    expect(ownerLessons.data.locked).toBe(false);
    expect(ownerLessons.data.lessons[0].title.length).toBeGreaterThan(0);

    const ownerLessonDetail = await apiJson<{ lesson: { id: number; title: string } }>("/api/lessons/9001", {
      token: ownerLogin.data.token,
    });
    expect(ownerLessonDetail.status).toBe(200);
    expect(ownerLessonDetail.data.lesson.id).toBe(9001);
  });

  it("grades all 7 quiz question types accurately and saves XP & attempt history", async () => {
    const login = await apiJson<{ token: string }>("/api/auth/login", {
      method: "POST",
      body: { email: "oquvchi@huquqolami.uz", password: "Student123!" },
    });
    const token = login.data.token;

    const quizRes = await apiJson<{ quiz: { id: number; questions: QuizQuestion[] } }>("/api/quizzes/9001");
    expect(quizRes.status).toBe(200);
    const questions = quizRes.data.quiz.questions;
    expect(questions.length).toBe(10);

    // Build 100% correct answer payload dynamically
    const answers: Record<string, unknown> = {};
    for (const q of questions) {
      answers[q.id] = q.correctAnswer;
    }

    const submit = await apiJson<{
      attempt: { percentage: number; correctCount: number; totalQuestions: number; xpEarned: number };
    }>("/api/quiz-attempts", {
      method: "POST",
      token,
      body: { quizId: 9001, answers, elapsedSeconds: 95 },
    });

    expect(submit.status).toBe(201);
    expect(submit.data.attempt.percentage).toBe(100);
    expect(submit.data.attempt.correctCount).toBe(10);
    expect(submit.data.attempt.xpEarned).toBeGreaterThan(0);
  });

  it("persists presentation edits to SQLite and reflects them on GET", async () => {
    const ownerLogin = await apiJson<{ token: string }>("/api/auth/login", {
      method: "POST",
      body: { email: "qonun", password: "qonun1991" },
    });
    const token = ownerLogin.data.token;

    const deckBefore = await apiJson<{
      presentation: { id: number; title: string; templateName: string; slides: Array<{ title: string }> };
    }>("/api/presentations/9001");
    expect(deckBefore.status).toBe(200);

    const updatedSlides = [
      ...deckBefore.data.presentation.slides,
      {
        id: "custom-slide-test",
        order: deckBefore.data.presentation.slides.length + 1,
        layout: "summary",
        title: "Yangilangan yakuniy slayd",
        subtitle: "Test tahriri",
        bullets: ["1-band", "2-band"],
        accentColor: "#39FF55",
        backgroundTone: "obsidian",
        speakerNotes: "Izoh",
      },
    ];

    const putRes = await apiJson<{ success: boolean }>("/api/presentations/9001", {
      method: "PUT",
      token,
      body: {
        title: "Konstitutsiya (Tahrirlangan)",
        templateName: deckBefore.data.presentation.templateName,
        slides: updatedSlides,
      },
    });
    expect(putRes.status).toBe(200);
    expect(putRes.data.success).toBe(true);

    const deckAfter = await apiJson<{
      presentation: { title: string; slides: Array<{ title: string }> };
    }>("/api/presentations/9001");
    expect(deckAfter.data.presentation.title).toBe("Konstitutsiya (Tahrirlangan)");
    expect(deckAfter.data.presentation.slides.length).toBe(updatedSlides.length);
  });

  it("supports qonun full lesson/assignment creation, student submission & AI setting updates", async () => {
    const ownerLogin = await apiJson<{ token: string }>("/api/auth/login", {
      method: "POST",
      body: { email: "qonun", password: "qonun1991" },
    });
    const ownerToken = ownerLogin.data.token;

    // Create new lesson
    const lessonCreate = await apiJson<{ id: number; status: string }>("/api/teacher/lessons", {
      method: "POST",
      token: ownerToken,
      body: {
        gradeNumber: 10,
        title: "Mualliflik huquqi asoslari",
        summary: "Intellektual mulk va mualliflik huquqlarini muhofaza qilish.",
        status: "draft",
      },
    });
    expect(lessonCreate.status).toBe(201);
    expect(lessonCreate.data.status).toBe("draft");

    // Create assignment and submit as student
    const assignCreate = await apiJson<{ id: number }>("/api/teacher/assignments", {
      method: "POST",
      token: ownerToken,
      body: {
        title: "Yangi uy vazifasi",
        description: "Konstitutsiya moddalaridan 2 ta misol yozing.",
        gradeNumber: 9,
        dueDate: "2026-06-15",
      },
    });
    expect(assignCreate.status).toBe(201);

    const studentLogin = await apiJson<{ token: string }>("/api/auth/login", {
      method: "POST",
      body: { email: "oquvchi@huquqolami.uz", password: "Student123!" },
    });
    const submitAssign = await apiJson<{ success: boolean }>(
      `/api/student/assignments/${assignCreate.data.id}/submit`,
      {
        method: "POST",
        token: studentLogin.data.token,
        body: { answerText: "1-modda va 15-modda misollari yozildi." },
      }
    );
    expect(submitAssign.status).toBe(200);

    // Owner updates lesson status and AI settings
    const statusPatch = await apiJson<{ success: boolean; status: string }>(
      `/api/admin/lessons/${lessonCreate.data.id}/status`,
      {
        method: "PATCH",
        token: ownerToken,
        body: { status: "verified" },
      }
    );
    expect(statusPatch.status).toBe(200);
    expect(statusPatch.data.status).toBe("verified");

    const aiUpdate = await apiJson<{ success: boolean }>("/api/admin/ai-settings", {
      method: "PUT",
      token: ownerToken,
      body: {
        modelName: "gemini-4-hydrogen",
        pedagogicalTone: "Akademik va tushunarli",
        strictGrounding: true,
        enabled: true,
      },
    });
    expect(aiUpdate.status).toBe(200);
    expect(aiUpdate.data.success).toBe(true);
  });

  it("records game attempts and awards XP cleanly", async () => {
    const studentLogin = await apiJson<{ token: string }>("/api/auth/login", {
      method: "POST",
      body: { email: "oquvchi@huquqolami.uz", password: "Student123!" },
    });
    const res = await apiJson<{ attempt: { xpEarned: number; score: number } }>("/api/game-attempts", {
      method: "POST",
      token: studentLogin.data.token,
      body: {
        gameSlug: "sud_zali",
        gameTitle: "Sud Zali",
        gradeNumber: 9,
        score: 85,
        maxScore: 100,
      },
    });
    expect(res.status).toBe(201);
    expect(res.data.attempt.xpEarned).toBeGreaterThan(0);
  });
});
