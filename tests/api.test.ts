import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { DatabaseSync } from "node:sqlite";
import { createDatabase } from "../server/db";
import { createApp } from "../server/app";
import { ALL_QUIZZES } from "../src/data/curriculumBuilder";
import type { QuizQuestion } from "../shared/types";

const TEST_OWNER_LOGIN = "audit_owner_account";
const TEST_OWNER_PASSWORD = "AuditOwner#2026!Secure";

const STUDENT_A = {
  email: "audit.student.a@huquqolami.uz",
  password: "StudentA#2026!Secure",
  fullName: "Audit Student A",
  gradeNumber: 8,
};
const STUDENT_B = {
  email: "audit.student.b@huquqolami.uz",
  password: "StudentB#2026!Secure",
  fullName: "Audit Student B",
  gradeNumber: 9,
};
const STUDENT_C = {
  email: "audit.student.c@huquqolami.uz",
  password: "StudentC#2026!Secure",
  fullName: "Audit Student C",
  gradeNumber: 11,
};
const LOGOUT_STUDENT = {
  email: "audit.logout.student@huquqolami.uz",
  password: "LogoutStudent#2026!Secure",
  fullName: "Audit Logout Student",
  gradeNumber: 10,
};
const ESCALATION_STUDENT = {
  email: "audit.escalation.student@huquqolami.uz",
  password: "Escalation#2026!Secure",
  fullName: "Audit Escalation Student",
  gradeNumber: 9,
};
const PENDING_TEACHER = {
  email: "audit.teacher.pending@huquqolami.uz",
  password: "PendingTeacher#2026!Secure",
  fullName: "Audit Pending Teacher",
  gradeNumber: 10,
};
const REJECTED_TEACHER = {
  email: "audit.teacher.rejected@huquqolami.uz",
  password: "RejectedTeacher#2026!Secure",
  fullName: "Audit Rejected Teacher",
  gradeNumber: 10,
};

interface TestUser {
  id: number;
  email: string;
  fullName: string;
  gradeNumber: number;
  className: string;
  token: string;
}

let server: http.Server;
let baseUrl: string;
let db: DatabaseSync;
let ownerToken: string;
let ownerId: number;
let studentA: TestUser;
let studentB: TestUser;
let studentC: TestUser;
let logoutStudent: TestUser;
let escalationStudent: TestUser;
let pendingTeacherId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-only-ephemeral-signing-key-64-chars-long-0123456789abcdef";
  process.env.OWNER_LOGIN = TEST_OWNER_LOGIN;
  process.env.OWNER_PASSWORD = TEST_OWNER_PASSWORD;
  delete process.env.DEMO_STUDENT_PASSWORD;
  delete process.env.GEMINI_API_KEY;

  const created = createApp(createDatabase(":memory:"), {
    authRateLimitMax: 100,
    authRateLimitWindowMs: 60_000,
  });
  db = created.db;
  const createdServer = http.createServer(created.app);
  await new Promise<void>((resolve) => {
    createdServer.listen(0, "127.0.0.1", () => resolve());
  });
  server = createdServer;
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const ownerLogin = await apiJson<{ token: string; user: { id: number } }>("/api/auth/login", {
    method: "POST",
    body: { email: TEST_OWNER_LOGIN, password: TEST_OWNER_PASSWORD },
  });
  if (ownerLogin.status !== 200) throw new Error("Unable to log in the seeded owner account");
  ownerToken = ownerLogin.data.token;
  ownerId = ownerLogin.data.user.id;

  async function registerStudent(
    account: { email: string; password: string; fullName: string; gradeNumber: number },
    role?: string
  ): Promise<TestUser> {
    const res = await apiJson<{
      token: string;
      user: { id: number; email: string; fullName: string; gradeNumber?: number; className?: string };
    }>("/api/auth/register", {
      method: "POST",
      body: { ...account, role, className: `${account.gradeNumber}-A` },
    });
    if (res.status !== 201 || !res.data.token) {
      throw new Error(`Unable to register ${account.email}: ${res.status} ${JSON.stringify(res.data)}`);
    }
    return {
      id: res.data.user.id,
      email: res.data.user.email,
      fullName: res.data.user.fullName,
      gradeNumber: account.gradeNumber,
      className: res.data.user.className || `${account.gradeNumber}-A`,
      token: res.data.token,
    };
  }

  studentA = await registerStudent(STUDENT_A);
  studentB = await registerStudent(STUDENT_B);
  studentC = await registerStudent(STUDENT_C);
  logoutStudent = await registerStudent(LOGOUT_STUDENT);
  escalationStudent = await registerStudent(ESCALATION_STUDENT, "admin");

  const teacherReg = await apiJson<{ user: { id: number } }>("/api/auth/register", {
    method: "POST",
    body: { ...PENDING_TEACHER, role: "teacher" },
  });
  if (teacherReg.status !== 201) throw new Error("Unable to register the pending teacher account");
  pendingTeacherId = teacherReg.data.user.id;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

async function requestJson<T = Record<string, unknown>>(
  origin: string,
  reqPath: string,
  options: ApiOptions = {}
): Promise<{ status: number; data: T; headers: Headers }> {
  const res = await fetch(`${origin}${reqPath}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = (await res.json()) as T;
  return { status: res.status, data, headers: res.headers };
}

async function apiJson<T = Record<string, unknown>>(
  reqPath: string,
  options: ApiOptions = {}
): Promise<{ status: number; data: T; headers: Headers }> {
  return requestJson<T>(baseUrl, reqPath, options);
}

async function apiJsonAt<T = Record<string, unknown>>(
  port: number,
  reqPath: string,
  options: ApiOptions = {}
): Promise<{ status: number; data: T; headers: Headers }> {
  return requestJson<T>(`http://127.0.0.1:${port}`, reqPath, options);
}

function countFrom(table: string): number {
  return (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
}

describe("HUQUQ OLAMI Express + SQLite API & Security Audit", () => {
  it("reports healthy seeded database (114 lessons across 4 grades) and hardened security headers", async () => {
    const health = await apiJson<{ status: string; gradesCount: number; lessonsCount: number }>("/api/health");
    expect(health.status).toBe(200);
    expect(health.data.status).toBe("ok");
    expect(health.data.gradesCount).toBe(4);
    expect(health.data.lessonsCount).toBe(114);
    expect(health.headers.get("x-powered-by")).toBeNull();
    expect(health.headers.get("x-content-type-options")).toBe("nosniff");
    expect(health.headers.get("x-frame-options")).toBe("SAMEORIGIN");

    const grades = await apiJson<{ grades: Array<{ gradeNumber: number; lessonsCount: number }> }>("/api/grades");
    expect(grades.status).toBe(200);
    expect(grades.data.grades.map((g) => g.gradeNumber)).toEqual([8, 9, 10, 11]);
    expect(grades.data.grades.map((g) => g.lessonsCount)).toEqual([23, 33, 30, 28]);
    expect(grades.data.grades.reduce((acc, g) => acc + g.lessonsCount, 0)).toBe(114);
  });

  it("contains only the single owner and no demo people, fake activity, or fake approvals on a fresh database", () => {
    const freshDb = createDatabase(":memory:");
    try {
      createApp(freshDb);

      const users = freshDb.prepare("SELECT id, email, role FROM users ORDER BY id ASC").all() as Array<{
        id: number;
        email: string;
        role: string;
      }>;
      expect(users).toEqual([expect.objectContaining({ email: TEST_OWNER_LOGIN, role: "admin" })]);
      expect(users.filter((u) => u.role === "admin")).toHaveLength(1);

      const fakeEmails = ["oquvchi@huquqolami.uz", "dilnoza@huquqolami.uz", "jasur@huquqolami.uz"];
      for (const email of fakeEmails) {
        expect(users.some((u) => u.email === email)).toBe(false);
      }

      for (const table of [
        "student_profiles",
        "student_progress",
        "quiz_attempts",
        "game_attempts",
        "assignments",
        "assignment_submissions",
        "access_requests",
      ]) {
        expect((freshDb.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c).toBe(0);
      }

      expect((freshDb.prepare("SELECT COUNT(*) as c FROM lessons").get() as { c: number }).c).toBe(114);
      expect((freshDb.prepare("SELECT COUNT(*) as c FROM achievements").get() as { c: number }).c).toBe(5);
      expect((freshDb.prepare("SELECT COUNT(*) as c FROM ai_settings").get() as { c: number }).c).toBe(1);
    } finally {
      freshDb.close();
    }
  });

  it("enforces password length, single-sided registration, owner RBAC, and topic lock on backend", async () => {
    const unauth = await apiJson("/api/student/dashboard");
    expect(unauth.status).toBe(401);

    const weakReg = await apiJson<{ error: string }>("/api/auth/register", {
      method: "POST",
      body: {
        email: "weak.student@huquqolami.uz",
        password: "short",
        fullName: "Short Pass",
      },
    });
    expect(weakReg.status).toBe(400);

    const guestLessons = await apiJson<{
      locked: boolean;
      requestable: boolean;
      requestStatus?: string;
      lessons: Array<{ title: string; locked: boolean }>;
    }>("/api/lessons?grade=9");
    expect(guestLessons.status).toBe(200);
    expect(guestLessons.data.locked).toBe(true);
    expect(guestLessons.data.requestable).toBe(true);
    expect(guestLessons.data.requestStatus).toBeUndefined();
    expect(guestLessons.data.lessons.length).toBeGreaterThanOrEqual(20);
    expect(guestLessons.data.lessons[0].locked).toBe(true);
    expect(guestLessons.data.lessons[0].title).toBe("");

    const guestDetail = await apiJson<{ locked: boolean; error: string; requestStatus: string }>("/api/lessons/9001");
    expect(guestDetail.status).toBe(403);
    expect(guestDetail.data.locked).toBe(true);
    expect(guestDetail.data.error).toBe("Ruxsat so'rash talab etiladi.");
    expect(guestDetail.data.requestStatus).toBe("none");

    expect(escalationStudent.token).toBeTruthy();
    const me = await apiJson<{ user: { email: string; role: string; status?: string; canUnlockTopics?: boolean } }>(
      "/api/auth/me",
      { token: escalationStudent.token }
    );
    expect(me.data.user.role).toBe("student");
    expect(me.data.user.status).toBe("active");
    expect(me.data.user.canUnlockTopics).toBe(false);

    expect((await apiJson("/api/teacher/dashboard", { token: escalationStudent.token })).status).toBe(403);
    expect((await apiJson("/api/admin/dashboard", { token: escalationStudent.token })).status).toBe(403);
    expect((await apiJson("/api/lessons/9001", { token: escalationStudent.token })).status).toBe(403);
    expect(
      (
        await apiJson("/api/presentations/9001", {
          method: "PUT",
          token: escalationStudent.token,
          body: { title: "Tamper", templateName: "t", slides: [{ title: "s" }] },
        })
      ).status
    ).toBe(403);

    const ownerMe = await apiJson<{ user: { email: string; role: string; canUnlockTopics?: boolean } }>(
      "/api/auth/me",
      { token: ownerToken }
    );
    expect(ownerMe.data.user.email).toBe(TEST_OWNER_LOGIN);
    expect(ownerMe.data.user.role).toBe("admin");
    expect(ownerMe.data.user.canUnlockTopics).toBe(true);

    const ownerLessons = await apiJson<{ locked: boolean; lessons: Array<{ title: string; locked: boolean }> }>(
      "/api/lessons?grade=9",
      { token: ownerToken }
    );
    expect(ownerLessons.status).toBe(200);
    expect(ownerLessons.data.locked).toBe(false);
    expect(ownerLessons.data.lessons[0].title.length).toBeGreaterThan(0);

    const ownerLessonDetail = await apiJson<{ lesson: { id: number; title: string } }>("/api/lessons/9001", {
      token: ownerToken,
    });
    expect(ownerLessonDetail.status).toBe(200);
    expect(ownerLessonDetail.data.lesson.id).toBe(9001);
  });

  it("requires admin approval for teacher registration and blocks pending/rejected logins", async () => {
    const pendingLogin = await apiJson<{ error: string }>("/api/auth/login", {
      method: "POST",
      body: { email: PENDING_TEACHER.email, password: PENDING_TEACHER.password },
    });
    expect(pendingLogin.status).toBe(403);
    expect(pendingLogin.data.error).toContain("tasdiqlanishini kutmoqda");

    const notifications = await apiJson<{
      teacherRequests: Array<{ id: number; email: string; fullName: string; gradeNumber: number; createdAt: string }>;
    }>("/api/admin/notifications", { token: ownerToken });
    expect(notifications.status).toBe(200);
    expect(notifications.data.teacherRequests).toEqual([
      expect.objectContaining({
        id: pendingTeacherId,
        email: PENDING_TEACHER.email,
        fullName: PENDING_TEACHER.fullName,
      }),
    ]);

    const approve = await apiJson<{ success: boolean; status: string }>(
      `/api/admin/teacher-requests/${pendingTeacherId}/approve`,
      { method: "POST", token: ownerToken }
    );
    expect(approve.status).toBe(200);
    expect(approve.data.status).toBe("active");

    const approvedLogin = await apiJson<{ token: string; user: { id: number; role: string; status?: string } }>(
      "/api/auth/login",
      { method: "POST", body: { email: PENDING_TEACHER.email, password: PENDING_TEACHER.password } }
    );
    expect(approvedLogin.status).toBe(200);
    expect(approvedLogin.data.user.role).toBe("teacher");
    expect(approvedLogin.data.user.status).toBe("active");
    expect((await apiJson("/api/admin/dashboard", { token: approvedLogin.data.token })).status).toBe(403);
    expect((await apiJson("/api/lessons/9001", { token: approvedLogin.data.token })).status).toBe(200);

    const rejectedReg = await apiJson<{ user: { id: number } }>("/api/auth/register", {
      method: "POST",
      body: { ...REJECTED_TEACHER, role: "teacher" },
    });
    expect(rejectedReg.status).toBe(201);
    const reject = await apiJson<{ success: boolean; status: string }>(
      `/api/admin/teacher-requests/${rejectedReg.data.user.id}/reject`,
      { method: "POST", token: ownerToken }
    );
    expect(reject.data.status).toBe("rejected");
    const rejectedLogin = await apiJson<{ error: string }>("/api/auth/login", {
      method: "POST",
      body: { email: REJECTED_TEACHER.email, password: REJECTED_TEACHER.password },
    });
    expect(rejectedLogin.status).toBe(403);
    expect(rejectedLogin.data.error).toContain("rad etilgan");
  });

  it("gates content behind approved access requests and deduplicates pending requests", async () => {
    const studentToken = studentA.token;

    for (const route of [
      "/api/chapters",
      "/api/lessons",
      "/api/presentations",
      "/api/glossary",
      "/api/legislation",
      "/api/scenarios",
    ]) {
      const lockedList = await apiJson<{
        locked: boolean;
        requestable: boolean;
        requestStatus?: string;
      }>(route, { token: studentToken });
      expect(lockedList.status).toBe(200);
      expect(lockedList.data.locked).toBe(true);
      expect(lockedList.data.requestable).toBe(true);
      expect(lockedList.data.requestStatus).toBe("none");
    }
    const lockedGlossary = await apiJson<{ terms: unknown[] }>("/api/glossary", { token: studentToken });
    expect(lockedGlossary.data.terms).toEqual([]);
    const lockedLegislation = await apiJson<{ articles: unknown[] }>("/api/legislation", { token: studentToken });
    expect(lockedLegislation.data.articles).toEqual([]);
    const lockedScenarios = await apiJson<{ scenarios: unknown[] }>("/api/scenarios", { token: studentToken });
    expect(lockedScenarios.data.scenarios).toEqual([]);

    const badType = await apiJson("/api/access-requests", {
      method: "POST",
      token: studentToken,
      body: { resourceType: "admin", resourceId: 9001 },
    });
    expect(badType.status).toBe(400);

    const created = await apiJson<{
      id: number;
      request: { id: number; userId: number; status: string };
      message?: string;
    }>("/api/access-requests", {
      method: "POST",
      token: studentToken,
      body: { resourceType: "lessons", resourceId: 9001 },
    });
    expect(created.status).toBe(201);
    expect(created.data.request.status).toBe("pending");
    expect(created.data.request.userId).toBe(studentA.id);
    expect(created.data.id).toBe(created.data.request.id);

    const duplicate = await apiJson<{
      id: number;
      duplicate: boolean;
      request: { id: number; status: string };
    }>("/api/access-requests", {
      method: "POST",
      token: studentToken,
      body: { resourceType: "lessons", resourceId: 9001 },
    });
    expect(duplicate.status).toBe(201);
    expect(duplicate.data.duplicate).toBe(true);
    expect(duplicate.data.id).toBe(created.data.id);

    const mine = await apiJson<{ requests: Array<{ id: number; status: string }> }>("/api/access-requests/mine", {
      token: studentToken,
    });
    expect(mine.status).toBe(200);
    expect(mine.data.requests).toHaveLength(1);
    expect(mine.data.requests[0].status).toBe("pending");

    expect((await apiJson("/api/admin/notifications", { token: studentToken })).status).toBe(403);
    const adminNotifications = await apiJson<{
      accessRequests: Array<{ id: number; email: string; fullName: string; status: string }>;
    }>("/api/admin/notifications", { token: ownerToken });
    expect(adminNotifications.data.accessRequests).toEqual([
      expect.objectContaining({
        id: created.data.id,
        email: STUDENT_A.email,
        fullName: STUDENT_A.fullName,
        status: "pending",
      }),
    ]);

    const lockedDetail = await apiJson<{ locked: boolean; requestStatus: string }>("/api/lessons/9001", {
      token: studentToken,
    });
    expect(lockedDetail.status).toBe(403);
    expect(lockedDetail.data.locked).toBe(true);
    expect(lockedDetail.data.requestStatus).toBe("pending");

    const approve = await apiJson<{ success: boolean; request: { status: string; reviewedBy: number | null } }>(
      `/api/admin/access-requests/${created.data.id}`,
      { method: "PATCH", token: ownerToken, body: { action: "approve" } }
    );
    expect(approve.status).toBe(200);
    expect(approve.data.request.status).toBe("approved");
    expect(approve.data.request.reviewedBy).toBe(ownerId);

    const unlockedDetail = await apiJson<{ lesson: { id: number; title: string } }>("/api/lessons/9001", {
      token: studentToken,
    });
    expect(unlockedDetail.status).toBe(200);
    expect(unlockedDetail.data.lesson.title.length).toBeGreaterThan(0);

    const lessonsAfter = await apiJson<{
      requestStatus: string;
      lessons: Array<{ id: number; title: string; locked: boolean }>;
    }>("/api/lessons", { token: studentToken });
    expect(lessonsAfter.data.requestStatus).toBe("approved");
    expect(lessonsAfter.data.lessons.find((l) => l.id === 9001)?.title.length).toBeGreaterThan(0);
    expect(lessonsAfter.data.lessons.find((l) => l.id === 9002)?.title).toBe("");

    expect((await apiJson("/api/presentations/9001", { token: studentToken })).status).toBe(403);
    expect((await apiJson("/api/glossary", { token: studentToken })).data).toEqual(
      expect.objectContaining({ locked: true, requestable: true })
    );

    const sectionRequest = await apiJson<{ request: { id: number } }>("/api/access-requests", {
      method: "POST",
      token: studentToken,
      body: { resourceType: "presentations", resourceId: 0 },
    });
    expect(sectionRequest.status).toBe(201);
    const sectionApprove = await apiJson(`/api/admin/access-requests/${sectionRequest.data.request.id}`, {
      method: "PATCH",
      token: ownerToken,
      body: { action: "approve" },
    });
    expect(sectionApprove.status).toBe(200);
    const presentationDetail = await apiJson<{ presentation: { id: number; slides: unknown[] } }>(
      "/api/presentations/9001",
      { token: studentToken }
    );
    expect(presentationDetail.status).toBe(200);
    expect(presentationDetail.data.presentation.slides.length).toBeGreaterThan(0);
    const presentationsAfter = await apiJson<{
      locked: boolean;
      presentations: Array<{ id: number; slideCount: number }>;
    }>("/api/presentations", { token: studentToken });
    expect(presentationsAfter.data.locked).toBe(false);
    expect(presentationsAfter.data.presentations[0].slideCount).toBeGreaterThan(0);
  });

  it("falls back to the built-in qonun admin when owner env credentials are absent", async () => {
    const prevLogin = process.env.OWNER_LOGIN;
    const prevPassword = process.env.OWNER_PASSWORD;
    delete process.env.OWNER_LOGIN;
    delete process.env.OWNER_PASSWORD;

    try {
      const db = createDatabase(":memory:");
      const { app } = createApp(db);
      const srv = http.createServer(app);
      await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", () => resolve()));
      const port = (srv.address() as AddressInfo).port;

      try {
        const builtInLogin = await apiJsonAt(port, "/api/auth/login", {
          method: "POST",
          body: { email: "qonun", password: "qonun1991" },
        });
        expect(builtInLogin.status).toBe(200);
        expect((builtInLogin.data as { user: { role: string } }).user.role).toBe("admin");

        const wrongPassword = await apiJsonAt(port, "/api/auth/login", {
          method: "POST",
          body: { email: "qonun", password: "not-the-password" },
        });
        expect(wrongPassword.status).toBe(401);
      } finally {
        await new Promise<void>((resolve, reject) => srv.close((e) => (e ? reject(e) : resolve())));
        db.close();
      }
    } finally {
      if (prevLogin === undefined) delete process.env.OWNER_LOGIN;
      else process.env.OWNER_LOGIN = prevLogin;
      if (prevPassword === undefined) delete process.env.OWNER_PASSWORD;
      else process.env.OWNER_PASSWORD = prevPassword;
    }
  });

  it("supports JWT token refresh and immediate server-side revocation on logout", async () => {
    const oldToken = logoutStudent.token;

    const refreshed = await apiJson<{ token: string; user: { email: string } }>("/api/auth/refresh", {
      method: "POST",
      token: oldToken,
    });
    expect(refreshed.status).toBe(200);
    expect(refreshed.data.user.email).toBe(LOGOUT_STUDENT.email);

    const logoutRes = await apiJson<{ success: boolean }>("/api/auth/logout", {
      method: "POST",
      token: refreshed.data.token,
    });
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.data.success).toBe(true);

    const afterLogoutOld = await apiJson("/api/auth/me", { token: oldToken });
    const afterLogoutNew = await apiJson("/api/auth/me", { token: refreshed.data.token });
    expect(afterLogoutOld.status).toBe(401);
    expect(afterLogoutNew.status).toBe(401);
  });

  it("enforces auth rate limiting (HTTP 429 + Retry-After) on brute-force attempts", async () => {
    const isolatedDb = createDatabase(":memory:");
    const { app } = createApp(isolatedDb, { authRateLimitMax: 3, authRateLimitWindowMs: 60_000 });
    const rateServer = http.createServer(app);
    await new Promise<void>((resolve) => rateServer.listen(0, "127.0.0.1", () => resolve()));
    const port = (rateServer.address() as AddressInfo).port;

    try {
      for (let i = 0; i < 3; i++) {
        const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "nobody@example.com", password: "wrongpassword" }),
        });
        expect(res.status).toBe(401);
      }

      const blocked = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nobody@example.com", password: "wrongpassword" }),
      });
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("retry-after")).toBeTruthy();
    } finally {
      await new Promise<void>((resolve, reject) => rateServer.close((e) => (e ? reject(e) : resolve())));
    }
  });

  it("strips quiz answer keys for students and never returns XP for quiz attempts", async () => {
    const token = studentA.token;

    const publicQuizRes = await apiJson<{
      quiz: { id: number; questions: Array<QuizQuestion & { correctAnswer?: unknown; explanation?: unknown }> };
    }>("/api/quizzes/9001", { token });
    expect(publicQuizRes.status).toBe(200);
    expect(publicQuizRes.data.quiz.questions.length).toBe(10);
    expect(publicQuizRes.data.quiz.questions[0].correctAnswer).toBeUndefined();
    expect(publicQuizRes.data.quiz.questions[0].explanation).toBeUndefined();

    const canonicalQuiz = ALL_QUIZZES.find((q) => q.id === 9001)!;
    const answers: Record<string, unknown> = {};
    for (const q of canonicalQuiz.questions) {
      answers[q.id] = q.correctAnswer;
    }

    const submit = await apiJson<{
      attempt: {
        percentage: number;
        correctCount: number;
        totalQuestions: number;
        xpEarned?: number;
      };
    }>("/api/quiz-attempts", {
      method: "POST",
      token,
      body: { quizId: 9001, answers, elapsedSeconds: 95 },
    });

    expect(submit.status).toBe(201);
    expect(submit.data.attempt.percentage).toBe(100);
    expect(submit.data.attempt.correctCount).toBe(10);
    expect(submit.data.attempt).not.toHaveProperty("xpEarned");

    const repeatSubmit = await apiJson<{ attempt: { xpEarned?: number } }>("/api/quiz-attempts", {
      method: "POST",
      token,
      body: { quizId: 9001, answers, elapsedSeconds: 12 },
    });
    expect(repeatSubmit.status).toBe(201);
    expect(repeatSubmit.data.attempt).not.toHaveProperty("xpEarned");

    const me = await apiJson<{ user: { xp: number; level: number } }>("/api/auth/me", { token });
    expect(me.data.user.xp).toBe(0);
    expect(me.data.user.level).toBe(1);
    expect((db.prepare("SELECT xp, level FROM users WHERE id = ?").get(studentA.id) as { xp: number; level: number })).toEqual({
      xp: 0,
      level: 1,
    });
  });

  it("clamps game scores, never grants XP, and marks lessons as completed idempotently", async () => {
    const token = studentB.token;

    const spoofAttempt = await apiJson<{ attempt: { score: number; maxScore: number; xpEarned?: number } }>(
      "/api/game-attempts",
      {
        method: "POST",
        token,
        body: {
          gameSlug: "sud_zali",
          gameTitle: "Sud Zali",
          gradeNumber: 9,
          score: 999999,
          maxScore: 999999,
        },
      }
    );
    expect(spoofAttempt.status).toBe(201);
    expect(spoofAttempt.data.attempt.maxScore).toBeLessThanOrEqual(500);
    expect(spoofAttempt.data.attempt.score).toBeLessThanOrEqual(500);
    expect(spoofAttempt.data.attempt).not.toHaveProperty("xpEarned");

    const missingLesson = await apiJson("/api/student/progress", {
      method: "POST",
      token,
      body: { lessonId: 999999, completed: true },
    });
    expect(missingLesson.status).toBe(404);

    const dashBefore = await apiJson<{ completedLessons: number }>("/api/student/dashboard", { token });
    expect(dashBefore.data.completedLessons).toBe(0);

    const firstComplete = await apiJson<{ completed: boolean; completedLessons: number }>("/api/student/progress", {
      method: "POST",
      token,
      body: { lessonId: 10001, completed: true },
    });
    expect(firstComplete.status).toBe(200);
    expect(firstComplete.data).toEqual({ completed: true, completedLessons: 1 });

    const progressRow = db
      .prepare("SELECT completed FROM student_progress WHERE user_id = ? AND lesson_id = ?")
      .get(studentB.id, 10001) as { completed: number } | undefined;
    expect(progressRow?.completed).toBe(1);

    const repeatComplete = await apiJson<{ completed: boolean; completedLessons: number }>("/api/student/progress", {
      method: "POST",
      token,
      body: { lessonId: 10001, completed: true },
    });
    expect(repeatComplete.status).toBe(200);
    expect(repeatComplete.data).toEqual({ completed: true, completedLessons: 1 });
    expect(countFrom("student_progress")).toBe(2);

    const me = await apiJson<{ user: { xp: number; level: number } }>("/api/auth/me", { token });
    expect(me.data.user.xp).toBe(0);
    expect(me.data.user.level).toBe(1);
  });

  it("exposes completion-based student dashboards with milestones and no XP leaderboard", async () => {
    const dash = await apiJson<{
      user: { id: number };
      completedLessons: number;
      totalLessons: number;
      milestones: Array<{ id: string; title: string; description: string; requiredCount: number; achieved: boolean }>;
      leaderboard: Array<{ id: number; full_name: string; grade_number: number; class_name: string; completed_lessons: number }>;
      achievements: Array<{ id: string; requiredCount: number; achieved: boolean; unlocked: boolean; xpThreshold?: number }>;
      gameAttempts: Array<{ gameTitle: string; xpEarned?: number }>;
    }>("/api/student/dashboard", { token: studentB.token });

    expect(dash.status).toBe(200);
    expect(dash.data.user.id).toBe(studentB.id);
    expect(dash.data.completedLessons).toBe(1);
    expect(dash.data.totalLessons).toBe(114);
    expect(dash.data.milestones).toHaveLength(5);
    expect(dash.data.milestones[0]).toEqual({
      id: "first_step",
      title: "Ilk Huquqiy Qadam",
      description: "Birinchi darsni yakunlang.",
      requiredCount: 1,
      achieved: true,
    });
    expect(dash.data.milestones[1].achieved).toBe(false);
    for (const milestone of dash.data.milestones) {
      expect(Object.keys(milestone).sort()).toEqual(["achieved", "description", "id", "requiredCount", "title"]);
    }

    expect(dash.data.leaderboard.length).toBeGreaterThanOrEqual(1);
    for (const entry of dash.data.leaderboard) {
      expect(Object.keys(entry).sort()).toEqual(["class_name", "completed_lessons", "full_name", "grade_number", "id"]);
      expect(entry).not.toHaveProperty("xp");
      expect(entry).not.toHaveProperty("level");
    }
    expect(dash.data.leaderboard).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: studentB.id,
          full_name: STUDENT_B.fullName,
          grade_number: STUDENT_B.gradeNumber,
          class_name: "9-A",
          completed_lessons: 1,
        }),
      ])
    );

    for (const achievement of dash.data.achievements) {
      expect(achievement.unlocked).toBe(achievement.achieved);
      expect(achievement).not.toHaveProperty("xpThreshold");
    }
    for (const gameAttempt of dash.data.gameAttempts) {
      expect(gameAttempt).not.toHaveProperty("xpEarned");
    }
  });

  it("reports completion counts instead of XP on teacher and admin dashboards", async () => {
    const teacherDash = await apiJson<{
      students: Array<Record<string, unknown>>;
    }>("/api/teacher/dashboard", { token: ownerToken });
    expect(teacherDash.status).toBe(200);
    expect(teacherDash.data.students.length).toBeGreaterThan(0);
    for (const student of teacherDash.data.students) {
      expect(student).not.toHaveProperty("xp");
      expect(student).not.toHaveProperty("level");
      expect(typeof student.completed_lessons).toBe("number");
    }
    expect(teacherDash.data.students).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: studentA.id, completed_lessons: 1 }),
        expect.objectContaining({ id: studentB.id, completed_lessons: 1 }),
      ])
    );

    const adminDash = await apiJson<{
      users: Array<Record<string, unknown>>;
      stats: { usersCount: number };
    }>("/api/admin/dashboard", { token: ownerToken });
    expect(adminDash.status).toBe(200);
    expect(adminDash.data.stats.usersCount).toBe(adminDash.data.users.length);
    expect(adminDash.data.users.filter((u) => u.role === "admin")).toHaveLength(1);
    for (const user of adminDash.data.users) {
      expect(user).not.toHaveProperty("xp");
      expect(user).not.toHaveProperty("level");
    }
  });

  it("persists presentation edits to SQLite and prevents self-demotion of the last admin", async () => {
    const selfDemote = await apiJson(`/api/admin/users/${ownerId}/role`, {
      method: "PATCH",
      token: ownerToken,
      body: { role: "student" },
    });
    expect(selfDemote.status).toBe(400);

    const deckBefore = await apiJson<{
      presentation: { id: number; title: string; templateName: string; slides: Array<{ title: string }> };
    }>("/api/presentations/9001", { token: ownerToken });
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
      token: ownerToken,
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
    }>("/api/presentations/9001", { token: ownerToken });
    expect(deckAfter.data.presentation.title).toBe("Konstitutsiya (Tahrirlangan)");
    expect(deckAfter.data.presentation.slides.length).toBe(updatedSlides.length);
  });

  it("supports lesson/assignment lifecycle and enforces AI input validation & toggle", async () => {
    const badAi = await apiJson("/api/ai/task", {
      method: "POST",
      body: { taskType: "explain", prompt: "   " },
    });
    expect(badAi.status).toBe(400);

    const missingKeyAi = await apiJson<{ error: string }>("/api/ai/task", {
      method: "POST",
      body: { taskType: "explain", prompt: "Konstitutsiya nima?" },
    });
    expect(missingKeyAi.status).toBe(503);

    const aiDisable = await apiJson<{ success: boolean }>("/api/admin/ai-settings", {
      method: "PUT",
      token: ownerToken,
      body: {
        modelName: "gemini-4-hydrogen",
        pedagogicalTone: "Akademik",
        strictGrounding: true,
        enabled: false,
      },
    });
    expect(aiDisable.status).toBe(200);

    const disabledAiRes = await apiJson<{ error: string }>("/api/ai/task", {
      method: "POST",
      body: { taskType: "explain", prompt: "Konstitutsiya nima?" },
    });
    expect(disabledAiRes.status).toBe(503);

    await apiJson("/api/admin/ai-settings", {
      method: "PUT",
      token: ownerToken,
      body: {
        modelName: "gemini-4-hydrogen",
        pedagogicalTone: "Akademik",
        strictGrounding: true,
        enabled: true,
      },
    });

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

    const submitAssign = await apiJson<{ success: boolean }>(
      `/api/student/assignments/${assignCreate.data.id}/submit`,
      {
        method: "POST",
        token: studentA.token,
        body: { answerText: "1-modda va 15-modda misollari yozildi." },
      }
    );
    expect(submitAssign.status).toBe(200);
    expect(submitAssign.data).toEqual({ success: true });

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
  });

  it("persists state durably across file-backed SQLite reopen without overwriting existing admin", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "huquq-olami-test-"));
    const dbFile = path.join(tmpDir, "audit.db");

    try {
      const db1 = createDatabase(dbFile);
      createApp(db1);
      db1.prepare("UPDATE presentations SET title = ? WHERE id = 8001").run("Durable Presentation Title");
      db1.close();

      const prevPwd = process.env.OWNER_PASSWORD;
      process.env.OWNER_PASSWORD = "CompletelyDifferentPassword99!";
      const db2 = createDatabase(dbFile);
      const { app: app2 } = createApp(db2);
      const srv2 = http.createServer(app2);
      await new Promise<void>((resolve) => srv2.listen(0, "127.0.0.1", () => resolve()));

      try {
        const port2 = (srv2.address() as AddressInfo).port;

        const loginRes = await fetch(`http://127.0.0.1:${port2}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: TEST_OWNER_LOGIN, password: TEST_OWNER_PASSWORD }),
        });
        expect(loginRes.status).toBe(200);
        const ownerToken2 = ((await loginRes.json()) as { token: string }).token;

        const deckRes = await apiJsonAt<{ presentation: { title: string } }>(port2, "/api/presentations/8001", {
          token: ownerToken2,
        });
        expect(deckRes.data.presentation.title).toBe("Durable Presentation Title");
      } finally {
        process.env.OWNER_PASSWORD = prevPwd;
        await new Promise<void>((resolve, reject) => srv2.close((e) => (e ? reject(e) : resolve())));
        db2.close();
      }

      const dbOutdated = createDatabase(dbFile);
      dbOutdated.exec("DELETE FROM lessons WHERE id > 9020 AND id < 12000;");
      dbOutdated.exec("DELETE FROM presentations WHERE id > 9020 AND id < 12000;");
      dbOutdated.exec(
        "INSERT INTO lessons (id, slug, grade_number, chapter_id, chapter_title, lesson_number_label, order_index, title, summary, page_number, estimated_minutes, status, presentation_id, quiz_id) VALUES (12001, 'custom-teacher-lesson', 10, 1001, 'Custom', 'Custom', 99, 'Maxsus ustoz darsi', 'Custom summary', 10, 45, 'verified', 12001, 12001)"
      );
      dbOutdated.close();

      const dbUpgraded = createDatabase(dbFile);
      const { app: appUpgraded } = createApp(dbUpgraded);
      const srvUpgraded = http.createServer(appUpgraded);
      await new Promise<void>((resolve) => srvUpgraded.listen(0, "127.0.0.1", () => resolve()));

      try {
        const port3 = (srvUpgraded.address() as AddressInfo).port;
        const healthUp = (await (await fetch(`http://127.0.0.1:${port3}/api/health`)).json()) as {
          lessonsCount: number;
        };
        expect(healthUp.lessonsCount).toBe(115);

        const ownerLogin = await apiJsonAt<{ token: string }>(port3, "/api/auth/login", {
          method: "POST",
          body: { email: TEST_OWNER_LOGIN, password: TEST_OWNER_PASSWORD },
        });
        expect(ownerLogin.status).toBe(200);
        const ownerTokenUp = ownerLogin.data.token;

        const presRes = await apiJsonAt<{ presentations: Array<{ id: number; slideCount: number }> }>(
          port3,
          "/api/presentations",
          { token: ownerTokenUp }
        );
        expect(presRes.data.presentations.length).toBe(114);
        expect(presRes.data.presentations.every((p) => p.slideCount === 8)).toBe(true);

        const newDeckRes = await apiJsonAt<{ presentation: { id: number; slides: unknown[] } }>(
          port3,
          "/api/presentations/9033",
          { token: ownerTokenUp }
        );
        expect(newDeckRes.data.presentation.id).toBe(9033);
        expect(newDeckRes.data.presentation.slides.length).toBe(8);

        const customStillExists = dbUpgraded
          .prepare("SELECT id, title FROM lessons WHERE id = 12001")
          .get() as { id: number; title: string } | undefined;
        expect(customStillExists?.title).toBe("Maxsus ustoz darsi");
      } finally {
        await new Promise<void>((resolve, reject) => srvUpgraded.close((e) => (e ? reject(e) : resolve())));
        dbUpgraded.close();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("blocks malformed JSON stack leaks, zero-score XP-free games, FK 500s, and revokes tokens on role change", async () => {
    const badJsonRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad_json",
    });
    expect(badJsonRes.status).toBe(400);
    const badJsonBody = (await badJsonRes.json()) as { error: string };
    expect(badJsonBody.error).toBeTruthy();

    const zeroGame = await apiJson<{ attempt: { score: number; xpEarned?: number } }>("/api/game-attempts", {
      method: "POST",
      token: studentC.token,
      body: { gameSlug: "sud_zali", gameTitle: "Sud Zali", gradeNumber: 11, score: 0, maxScore: 100 },
    });
    expect(zeroGame.status).toBe(201);
    expect(zeroGame.data.attempt.score).toBe(0);
    expect(zeroGame.data.attempt).not.toHaveProperty("xpEarned");

    const badLessonId = await apiJson("/api/lessons/abc", { token: ownerToken });
    expect(badLessonId.status).toBe(400);

    const badChapterLesson = await apiJson("/api/teacher/lessons", {
      method: "POST",
      token: ownerToken,
      body: { gradeNumber: 9, chapterId: 999999, title: "Invalid FK Lesson" },
    });
    expect(badChapterLesson.status).toBe(400);

    const badQuestionIdx = await apiJson("/api/teacher/quizzes/9001/questions", {
      method: "POST",
      token: ownerToken,
      body: { prompt: "Test savol", options: ["A", "B"], correctIndex: 99 },
    });
    expect(badQuestionIdx.status).toBe(400);

    const rolePatch = await apiJson(`/api/admin/users/${studentC.id}/role`, {
      method: "PATCH",
      token: ownerToken,
      body: { role: "teacher" },
    });
    expect(rolePatch.status).toBe(200);
    const oldTokenCheck = await apiJson("/api/auth/me", { token: studentC.token });
    expect(oldTokenCheck.status).toBe(401);
  });

  it("auto-configures TRUST_PROXY and AI Studio dev/shared CORS origins from APP_URL while blocking untrusted origins", async () => {
    const prevAppUrl = process.env.APP_URL;
    const prevTrustProxy = process.env.TRUST_PROXY;
    process.env.APP_URL = "https://ais-dev-example.asia-southeast1.run.app";
    delete process.env.TRUST_PROXY;

    const envDb = createDatabase(":memory:");
    const { app } = createApp(envDb);
    expect(app.get("trust proxy")).toBe(1);

    const srv = http.createServer(app);
    await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", () => resolve()));
    const port = (srv.address() as AddressInfo).port;

    try {
      const sharedRes = await fetch(`http://127.0.0.1:${port}/api/health`, {
        headers: { Origin: "https://ais-pre-example.asia-southeast1.run.app" },
      });
      expect(sharedRes.headers.get("access-control-allow-origin")).toBe(
        "https://ais-pre-example.asia-southeast1.run.app"
      );

      const evilRes = await fetch(`http://127.0.0.1:${port}/api/health`, {
        headers: { Origin: "https://evil.example.com" },
      });
      expect(evilRes.headers.get("access-control-allow-origin")).toBeNull();
    } finally {
      if (prevAppUrl === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = prevAppUrl;
      if (prevTrustProxy === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = prevTrustProxy;
      await new Promise<void>((resolve, reject) => srv.close((e) => (e ? reject(e) : resolve())));
      envDb.close();
    }
  });
});
