import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import { createDatabase } from "./db";
import { seedDatabase } from "./seed";
import {
  attachOptionalUser,
  hashPassword,
  mapUserRow,
  requireAuth,
  requireRole,
  revokeUserTokens,
  signToken,
  verifyPassword,
  type AuthenticatedRequest,
  type DbUserRow,
} from "./auth";
import { runLegalAiTask } from "./ai";
import {
  checkContentAccess,
  checkListAccess,
  denyContentAccess,
  isAccessResourceType,
  listAccessFields,
  mapAccessRequest,
  type AccessRequestDbRow,
} from "./permissions";
import type { PresentationSlide, QuizQuestion, UserRole } from "../shared/types";

const MILESTONE_REQUIREMENTS: Record<string, { requiredCount: number; description: string }> = {
  first_step: { requiredCount: 1, description: "Birinchi darsni yakunlang." },
  constitution_guard: { requiredCount: 3, description: "Kamida 3 ta darsni yakunlang." },
  detective_pro: { requiredCount: 5, description: "Kamida 5 ta darsni yakunlang." },
  court_master: { requiredCount: 10, description: "Kamida 10 ta darsni yakunlang." },
  law_expert: { requiredCount: 20, description: "Kamida 20 ta darsni yakunlang." },
};

function parsePositiveInt(val: unknown): number | null {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseResourceId(val: unknown): number | null {
  if (val === undefined || val === null || val === "") {
    return 0;
  }
  const n = Number(val);
  return Number.isInteger(n) && n >= 0 && n <= 2_000_000_000 ? n : null;
}

const VALID_SLIDE_LAYOUTS = new Set([
  "title",
  "objectives",
  "terms",
  "pyramid",
  "flowchart",
  "comparison",
  "case_study",
  "quiz",
  "summary",
]);
const VALID_SLIDE_TONES = new Set(["obsidian", "slate", "emerald", "contrast"]);

function sanitizeSlides(rawSlides: unknown[], deckId: number): PresentationSlide[] {
  return rawSlides.map((raw, idx) => {
    const s = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const layout =
      typeof s.layout === "string" && VALID_SLIDE_LAYOUTS.has(s.layout)
        ? (s.layout as PresentationSlide["layout"])
        : "title";
    const tone =
      typeof s.backgroundTone === "string" && VALID_SLIDE_TONES.has(s.backgroundTone)
        ? (s.backgroundTone as PresentationSlide["backgroundTone"])
        : "obsidian";
    const accentColor =
      typeof s.accentColor === "string" && /^#[0-9a-fA-F]{3,8}$/.test(s.accentColor.trim())
        ? s.accentColor.trim()
        : "#39FF55";
    const bullets = Array.isArray(s.bullets)
      ? s.bullets.slice(0, 20).map((b) => String(b ?? "").slice(0, 500))
      : [];
    const tableRows = Array.isArray(s.tableRows)
      ? s.tableRows.slice(0, 12).map((r) => {
          const row = r && typeof r === "object" ? (r as Record<string, unknown>) : {};
          return {
            left: String(row.left ?? "").slice(0, 300),
            right: String(row.right ?? "").slice(0, 300),
          };
        })
      : undefined;

    const cleanId =
      typeof s.id === "string" && s.id.trim().length > 0 && s.id.length <= 80
        ? s.id.trim()
        : `s-${deckId}-${idx + 1}-${Date.now()}`;

    return {
      id: cleanId,
      order: idx + 1,
      layout,
      title: String(s.title ?? `Slayd ${idx + 1}`).slice(0, 250),
      subtitle: typeof s.subtitle === "string" ? s.subtitle.slice(0, 400) : "",
      bullets,
      tableRows,
      accentColor,
      backgroundTone: tone,
      speakerNotes: typeof s.speakerNotes === "string" ? s.speakerNotes.slice(0, 1500) : "",
    };
  });
}

function createSlidingRateLimiter(
  maxRequests: number,
  windowMs: number,
  keyFn?: (req: Request) => string
) {
  const hits = new Map<string, number[]>();
  const MAX_TRACKED_KEYS = 10_000;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = keyFn ? keyFn(req) : `${ip}:${req.path}`;
    const now = Date.now();

    if (hits.size > MAX_TRACKED_KEYS) {
      for (const [k, timestamps] of hits) {
        if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] >= windowMs) {
          hits.delete(k);
        }
      }
      if (hits.size > MAX_TRACKED_KEYS) {
        hits.clear();
      }
    }

    const recent = (hits.get(key) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxRequests) {
      hits.set(key, recent);
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        error: "Juda ko'p urinish. Iltimos, birozdan so'ng qayta urinib ko'ring.",
        retryAfterSeconds: retryAfterSec,
      });
      return;
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

export interface CreateAppOptions {
  authRateLimitMax?: number;
  authRateLimitWindowMs?: number;
  aiRateLimitMax?: number;
}

function parsePositiveLimit(raw: string | undefined, fallback: number, min: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.max(min, Math.round(n)) : fallback;
}

function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const rawCors = process.env.CORS_ORIGIN || "";
  for (const item of rawCors.split(",")) {
    const clean = item.trim().replace(/\/$/, "");
    if (clean) origins.add(clean);
  }

  const appUrl = (process.env.APP_URL || "").trim().replace(/\/$/, "");
  if (appUrl) {
    origins.add(appUrl);
    if (appUrl.includes("ais-dev-")) {
      origins.add(appUrl.replace("ais-dev-", "ais-pre-"));
    } else if (appUrl.includes("ais-pre-")) {
      origins.add(appUrl.replace("ais-pre-", "ais-dev-"));
    }
  }

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }
  return origins;
}

export function createApp(
  customDb?: DatabaseSync,
  options: CreateAppOptions = {}
): { app: Express; db: DatabaseSync } {
  const db = customDb || createDatabase();
  seedDatabase(db);

  const app = express();
  app.disable("x-powered-by");

  // Default trust proxy=1 for AI Studio / Cloud Run / reverse proxies unless explicitly disabled
  if (process.env.TRUST_PROXY !== "false") {
    app.set("trust proxy", 1);
  }

  // Security headers + automatic CORS for same-host, AI Studio origins & optional CORS_ORIGIN
  const allowedOrigins = buildAllowedOrigins();

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

    const origin = req.headers.origin;
    const normalizedOrigin = origin ? origin.replace(/\/$/, "") : "";
    const reqHost = req.get("host");
    const sameHostOrigin = reqHost ? `${req.protocol}://${reqHost}` : "";
    if (normalizedOrigin && (allowedOrigins.has(normalizedOrigin) || normalizedOrigin === sameHostOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", origin!);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }
    }
    next();
  });

  app.use(express.json({ limit: "2mb" }));
  app.use(attachOptionalUser(db));

  const authWindowMs = options.authRateLimitWindowMs ?? 60_000;
  const authMax = options.authRateLimitMax ?? parsePositiveLimit(process.env.AUTH_RATE_LIMIT_MAX, 12, 3);
  const authRateLimiter = createSlidingRateLimiter(authMax, authWindowMs);
  const loginAccountLimiter = createSlidingRateLimiter(authMax, authWindowMs, (req) => {
    const loginId = String(req.body?.email || "").trim().toLowerCase().slice(0, 120) || "anon";
    return `acct:${loginId}`;
  });
  const aiRateLimiter = createSlidingRateLimiter(
    options.aiRateLimitMax ?? parsePositiveLimit(process.env.AI_RATE_LIMIT_MAX, 25, 5),
    60_000
  );

  app.get("/api/health", (_req, res) => {
    const gradesCount = (db.prepare("SELECT COUNT(*) as c FROM grades").get() as { c: number }).c;
    const lessonsCount = (db.prepare("SELECT COUNT(*) as c FROM lessons").get() as { c: number }).c;
    res.json({ status: "ok", gradesCount, lessonsCount });
  });

  // ==================== AUTH ROUTES ====================
  app.post("/api/auth/register", authRateLimiter, (req, res) => {
    const { email, password, fullName, gradeNumber, className, schoolName, role } = req.body || {};
    if (!email || !password || !fullName) {
      res.status(400).json({ error: "Ism-familiya, login/email va parol kiritilishi shart." });
      return;
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(fullName).trim();
    const cleanPassword = String(password);

    if (cleanEmail.length < 3 || cleanEmail.length > 120) {
      res.status(400).json({ error: "Login 3 dan 120 belgigacha bo'lishi kerak." });
      return;
    }
    if (cleanPassword.length < 8 || cleanPassword.length > 200) {
      res.status(400).json({ error: "Parol 8 dan 200 belgigacha bo'lishi shart." });
      return;
    }
    if (cleanName.length < 2 || cleanName.length > 140) {
      res.status(400).json({ error: "Ism-familiyani to'g'ri kiriting." });
      return;
    }

    // Only an explicit "teacher" request is honored; "admin" and unknown values fall back to student.
    const requestedRole = String(role ?? "").trim().toLowerCase();
    const safeRole: UserRole = requestedRole === "teacher" ? "teacher" : "student";
    const safeStatus = safeRole === "teacher" ? "pending" : "active";
    const existing = db.prepare("SELECT id FROM users WHERE LOWER(email) = ?").get(cleanEmail);
    if (existing) {
      res.status(409).json({ error: "Ushbu login yoki email allaqachon ro'yxatdan o'tgan." });
      return;
    }

    const passwordHash = hashPassword(cleanPassword);
    const gradeNum = [8, 9, 10, 11].includes(Number(gradeNumber)) ? Number(gradeNumber) : 9;
    const info = db
      .prepare(
         `INSERT INTO users (email, password_hash, full_name, role, status, grade_number, class_name, school_name, xp, level, streak_days, token_version)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 1, 1)`
      )
      .run(
        cleanEmail,
        passwordHash,
        cleanName,
        safeRole,
        safeStatus,
        gradeNum,
        String(className || `${gradeNum}-A`).slice(0, 40),
        String(schoolName || "O'zbekiston umumta'lim maktabi").slice(0, 180)
      );

    const userId = Number(info.lastInsertRowid);
    if (safeRole === "teacher") {
      db.prepare("INSERT INTO teacher_profiles (user_id) VALUES (?)").run(userId);
    } else {
      db.prepare("INSERT INTO student_profiles (user_id, grade_number) VALUES (?, ?)").run(userId, gradeNum);
    }

    const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as unknown as DbUserRow;
    const user = mapUserRow(userRow);
    if (safeRole === "teacher") {
      res.status(201).json({
        user,
        message: "O'qituvchi arizasi yuborildi. Administrator tasdiqlaguningizcha tizimga kira olmaysiz.",
      });
      return;
    }
    const token = signToken(user, userRow.token_version ?? 1);
    res.status(201).json({ token, user });
  });

  app.post("/api/auth/login", authRateLimiter, loginAccountLimiter, (req, res) => {
    const { email, password } = req.body || {};
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "");
    if (!cleanEmail || !cleanPassword || cleanEmail.length > 160 || cleanPassword.length > 200) {
      res.status(400).json({ error: "Login va parolni to'g'ri kiriting." });
      return;
    }
    const row = db
      .prepare("SELECT * FROM users WHERE LOWER(email) = ?")
      .get(cleanEmail) as DbUserRow | undefined;

    if (!row || !verifyPassword(cleanPassword, row.password_hash)) {
      res.status(401).json({ error: "Login yoki parol noto'g'ri." });
      return;
    }
    const accountStatus = row.status ?? "active";
    if (accountStatus === "pending") {
      res.status(403).json({ error: "Hisobingiz administrator tomonidan tasdiqlanishini kutmoqda." });
      return;
    }
    if (accountStatus === "rejected") {
      res.status(403).json({ error: "Hisobingiz rad etilgan. Administrator bilan bog'laning." });
      return;
    }
    const user = mapUserRow(row);
    const token = signToken(user, row.token_version ?? 1);
    res.json({ token, user });
  });

  app.post("/api/auth/refresh", requireAuth, (req: AuthenticatedRequest, res) => {
    const token = signToken(req.user!, req.tokenVersion ?? 1);
    res.json({ token, user: req.user });
  });

  app.post("/api/auth/logout", requireAuth, (req: AuthenticatedRequest, res) => {
    revokeUserTokens(db, req.user!.id);
    res.json({ success: true });
  });

  app.get("/api/auth/me", requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  // ==================== ACCESS REQUEST ROUTES ====================
  app.post("/api/access-requests", requireAuth, (req: AuthenticatedRequest, res) => {
    const { resourceType, resourceId } = req.body || {};
    if (!isAccessResourceType(resourceType)) {
      res.status(400).json({ error: "Noto'g'ri resurs turi." });
      return;
    }
    const cleanResourceId = parseResourceId(resourceId);
    if (cleanResourceId === null) {
      res.status(400).json({ error: "Noto'g'ri resurs ID raqami." });
      return;
    }

    const existing = db
      .prepare(
        `SELECT * FROM access_requests
         WHERE user_id = ? AND resource_type = ? AND resource_id = ? AND status = 'pending'
         ORDER BY id DESC LIMIT 1`
      )
      .get(req.user!.id, resourceType, cleanResourceId) as AccessRequestDbRow | undefined;

    if (existing) {
      const request = mapAccessRequest(existing);
      res.status(201).json({
        request,
        ...request,
        duplicate: true,
        message: "Ushbu resurs uchun so'rovingiz allaqachon ko'rib chiqilishni kutmoqda.",
      });
      return;
    }

    const info = db
      .prepare(
        `INSERT INTO access_requests (user_id, resource_type, resource_id, status)
         VALUES (?, ?, ?, 'pending')`
      )
      .run(req.user!.id, resourceType, cleanResourceId);
    const row = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(Number(info.lastInsertRowid)) as
      | AccessRequestDbRow
      | undefined;
    const request = row ? mapAccessRequest(row) : null;
    res.status(201).json({
      request,
      ...(request ?? {}),
      duplicate: false,
      message: "Ruxsat so'rovi yuborildi. Administrator tasdiqlashini kuting.",
    });
  });

  app.get("/api/access-requests/mine", requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare("SELECT * FROM access_requests WHERE user_id = ? ORDER BY id DESC")
      .all(req.user!.id) as unknown as AccessRequestDbRow[];
    const requests = rows.map(mapAccessRequest);
    res.json({ requests, accessRequests: requests });
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
    const access = checkListAccess(db, req, "chapters");
    const unlocked = access.allowed;
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
      ...listAccessFields(req, access),
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
    const access = checkListAccess(db, req, "lessons");
    const unlocked = access.allowed;
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
        access.canViewResource(r.id)
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

    res.json({ ...listAccessFields(req, access), locked: !unlocked, lessons: filtered });
  });

  app.get("/api/lessons/:id", (req: AuthenticatedRequest, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Noto'g'ri dars ID." });
      return;
    }
    const access = checkContentAccess(db, req, "lessons", id);
    if (!access.allowed) {
      denyContentAccess(res, access.requestStatus);
      return;
    }
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
  app.get("/api/presentations", (req: AuthenticatedRequest, res) => {
    const access = checkListAccess(db, req, "presentations");
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
      ...listAccessFields(req, access),
      locked: !access.allowed,
      presentations: rows.map((p) => {
        if (!access.canViewResource(p.id)) {
          return {
            id: p.id,
            lessonId: p.lesson_id,
            gradeNumber: p.grade_number,
            title: "",
            templateName: "",
            status: p.status,
            updatedAt: p.updated_at,
            slideCount: 0,
            locked: true,
          };
        }
        return {
          id: p.id,
          lessonId: p.lesson_id,
          gradeNumber: p.grade_number,
          title: p.title,
          templateName: p.template_name,
          status: p.status,
          updatedAt: p.updated_at,
          slideCount: (slideCountStmt.get(p.id) as { c: number }).c,
          locked: false,
        };
      }),
    });
  });

  app.get("/api/presentations/:id", (req: AuthenticatedRequest, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Noto'g'ri prezentatsiya ID." });
      return;
    }
    const access = checkContentAccess(db, req, "presentations", id);
    if (!access.allowed) {
      denyContentAccess(res, access.requestStatus);
      return;
    }
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

  app.put("/api/presentations/:id", requireRole(["admin", "teacher"]), (req: AuthenticatedRequest, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Noto'g'ri prezentatsiya ID." });
      return;
    }
    const { title, templateName, slides } = req.body || {};
    const existing = db.prepare("SELECT id FROM presentations WHERE id = ?").get(id);
    if (!existing) {
      res.status(404).json({ error: "Prezentatsiya topilmadi." });
      return;
    }
    if (!Array.isArray(slides) || slides.length === 0 || slides.length > 40) {
      res.status(400).json({ error: "Slaydlar soni 1 dan 40 gacha bo'lishi kerak." });
      return;
    }

    const cleanSlides = sanitizeSlides(slides, id);
    const now = new Date().toISOString();
    db.exec("BEGIN TRANSACTION;");
    try {
      db.prepare("UPDATE presentations SET title = ?, template_name = ?, updated_at = ? WHERE id = ?").run(
        String(title || "Prezentatsiya").slice(0, 250),
        String(templateName || "Huquq Olami Neon-Grafit").slice(0, 120),
        now,
        id
      );
      db.prepare("DELETE FROM presentation_slides WHERE presentation_id = ?").run(id);
      const insertSlide = db.prepare(`
        INSERT INTO presentation_slides (id, presentation_id, slide_order, layout, title, subtitle, slide_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      cleanSlides.forEach((cleanSlide, idx) => {
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

  app.get("/api/quizzes/:id", (req: AuthenticatedRequest, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Noto'g'ri test ID." });
      return;
    }
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

    const canViewAnswerKey = req.user?.role === "admin" || req.user?.role === "teacher";
    const qRows = db
      .prepare("SELECT question_json FROM questions WHERE quiz_id = ? ORDER BY question_order ASC")
      .all(id) as Array<{ question_json: string }>;

    const questions = qRows.map((r) => {
      const parsed = JSON.parse(r.question_json) as QuizQuestion;
      if (canViewAnswerKey) return parsed;
      const { correctAnswer: _hiddenAns, explanation: _hiddenExp, ...publicQuestion } = parsed;
      return publicQuestion;
    });

    res.json({
      quiz: {
        id: quiz.id,
        lessonId: quiz.lesson_id,
        gradeNumber: quiz.grade_number,
        title: quiz.title,
        timeLimitMinutes: quiz.time_limit_minutes,
        status: quiz.status,
        questions,
      },
    });
  });

  app.post("/api/quiz-attempts", (req: AuthenticatedRequest, res) => {
    const { quizId, answers, elapsedSeconds } = req.body || {};
    const qzId = parsePositiveInt(quizId);
    if (!qzId) {
      res.status(400).json({ error: "Noto'g'ri quizId." });
      return;
    }
    const safeAnswers =
      answers && typeof answers === "object" && !Array.isArray(answers)
        ? (answers as Record<string, unknown>)
        : {};
    const rawElapsed = Number(elapsedSeconds || 60);
    const cleanElapsed = Number.isFinite(rawElapsed) ? Math.min(7200, Math.max(0, Math.round(rawElapsed))) : 60;

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
      const userAns = Object.prototype.hasOwnProperty.call(safeAnswers, q.id) ? safeAnswers[q.id] : undefined;
      let isCorrect = false;

      if (q.type === "multiple" && Array.isArray(q.correctAnswer) && Array.isArray(userAns)) {
        const expected = [...new Set((q.correctAnswer as number[]).map(Number))].sort((a, b) => a - b).join(",");
        const actual = [...new Set(userAns.map(Number))].filter(Number.isFinite).sort((a, b) => a - b).join(",");
        isCorrect = expected === actual;
      } else if (q.type === "ordering" && Array.isArray(q.correctAnswer) && Array.isArray(userAns)) {
        isCorrect = JSON.stringify(q.correctAnswer) === JSON.stringify(userAns);
      } else if (
        q.type === "matching" &&
        typeof q.correctAnswer === "object" &&
        !Array.isArray(q.correctAnswer) &&
        userAns &&
        typeof userAns === "object" &&
        !Array.isArray(userAns)
      ) {
        const expectedObj = q.correctAnswer as Record<string, string>;
        const userObj = userAns as Record<string, unknown>;
        isCorrect = Object.keys(expectedObj).every(
          (k) => Object.prototype.hasOwnProperty.call(userObj, k) && userObj[k] === expectedObj[k]
        );
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
    const roundedPct = Math.round(percentage);
    const finalRecs =
      recommendations.length > 0
        ? recommendations.slice(0, 4)
        : ["Ajoyib natija! Keyingi mavzu va amaliy vaziyatlarni o'rganishga o'tishingiz mumkin."];

    let attemptId = 0;

    db.exec("BEGIN IMMEDIATE;");
    try {
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
          cleanElapsed,
          correctCount,
          questions.length,
          JSON.stringify(finalRecs)
        );
      attemptId = Number(attemptRes.lastInsertRowid);

      if (req.user && score > 0) {
        db.prepare(
          `INSERT INTO student_progress (user_id, lesson_id, completed, quiz_best_score)
           VALUES (?, ?, 1, ?)
           ON CONFLICT(user_id, lesson_id) DO UPDATE SET
             completed = 1,
             quiz_best_score = MAX(student_progress.quiz_best_score, excluded.quiz_best_score),
             updated_at = CURRENT_TIMESTAMP`
        ).run(req.user.id, quiz.lesson_id, roundedPct);
      }
      db.exec("COMMIT;");
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }

    res.status(201).json({
      attempt: {
        id: attemptId,
        quizId: quiz.id,
        quizTitle: quiz.title,
        gradeNumber: quiz.grade_number,
        score,
        maxScore,
        percentage,
        elapsedSeconds: cleanElapsed,
        correctCount,
        totalQuestions: questions.length,
        recommendations: finalRecs,
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
    const cleanMax = Math.min(500, Math.max(1, Math.round(Number(maxScore || 100))));
    const rawScore = Number(score || 0);
    const cleanScore = Number.isFinite(rawScore) ? Math.min(cleanMax, Math.max(0, Math.round(rawScore))) : 0;
    const safeLessonId = parsePositiveInt(lessonId);

    let attemptId = 0;
    db.exec("BEGIN IMMEDIATE;");
    try {
      const info = db
        .prepare(
          `INSERT INTO game_attempts (user_id, game_slug, game_title, grade_number, lesson_id, score, max_score, xp_earned)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          req.user?.id ?? null,
          String(gameSlug).slice(0, 80),
          String(gameTitle).slice(0, 120),
          [8, 9, 10, 11].includes(Number(gradeNumber)) ? Number(gradeNumber) : 9,
          safeLessonId,
          cleanScore,
          cleanMax,
          0
        );
      attemptId = Number(info.lastInsertRowid);

      db.exec("COMMIT;");
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }

    res.status(201).json({
      attempt: {
        id: attemptId,
        gameSlug,
        gameTitle,
        score: cleanScore,
        maxScore: cleanMax,
      },
    });
  });

  app.get("/api/scenarios", (req: AuthenticatedRequest, res) => {
    const access = checkListAccess(db, req, "scenarios");
    const grade = req.query.grade ? Number(req.query.grade) : null;
    const category = req.query.category ? String(req.query.category) : null;
    const rows = db.prepare("SELECT scenario_json FROM legal_scenarios ORDER BY id ASC").all() as Array<{
      scenario_json: string;
    }>;
    let items = rows.map((r) => JSON.parse(r.scenario_json));
    if (grade) items = items.filter((s) => s.gradeNumber === grade);
    if (category && category !== "all") items = items.filter((s) => s.category === category);
    res.json({
      ...listAccessFields(req, access),
      locked: !access.allowed,
      scenarios: access.allowed ? items : [],
    });
  });

  app.get("/api/glossary", (req: AuthenticatedRequest, res) => {
    const access = checkListAccess(db, req, "glossary");
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
    res.json({
      ...listAccessFields(req, access),
      locked: !access.allowed,
      terms: access.allowed ? terms : [],
    });
  });

  app.get("/api/legislation", (req: AuthenticatedRequest, res) => {
    const access = checkListAccess(db, req, "legislation");
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
    res.json({
      ...listAccessFields(req, access),
      locked: !access.allowed,
      articles: access.allowed ? articles : [],
    });
  });

  // ==================== STUDENT CABINET ====================
  app.get("/api/student/dashboard", requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as never;
    const freshUser = mapUserRow(userRow);

    const completedLessons = (
      db
        .prepare("SELECT COUNT(*) as c FROM student_progress WHERE user_id = ? AND completed = 1")
        .get(userId) as { c: number }
    ).c;
    const totalLessons = (db.prepare("SELECT COUNT(*) as c FROM lessons").get() as { c: number }).c;

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
      created_at: string;
    }>;

    const achievements = db.prepare("SELECT * FROM achievements ORDER BY xp_threshold ASC").all() as Array<{
      id: string;
      title: string;
      description: string;
      badge_type: string;
    }>;

    const achievementItems = achievements
      .map((a) => {
        const requirement = MILESTONE_REQUIREMENTS[a.id] ?? {
          requiredCount: 1,
          description: "Belgilangan darslar sonini yakunlang.",
        };
        return {
          id: a.id,
          title: a.title,
          description: requirement.description,
          requiredCount: requirement.requiredCount,
          achieved: completedLessons >= requirement.requiredCount,
          badgeType: a.badge_type,
        };
      })
      .sort((a, b) => a.requiredCount - b.requiredCount);

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
      .prepare(
        `SELECT u.id, u.full_name, u.grade_number, u.class_name,
                (SELECT COUNT(*) FROM student_progress sp WHERE sp.user_id = u.id AND sp.completed = 1) as completed_lessons
         FROM users u WHERE u.role = 'student'
         ORDER BY completed_lessons DESC, u.full_name ASC, u.id ASC LIMIT 10`
      )
      .all();

    res.json({
      user: freshUser,
      completedLessons,
      totalLessons,
      milestones: achievementItems.map(({ id, title, description, requiredCount, achieved }) => ({
        id,
        title,
        description,
        requiredCount,
        achieved,
      })),
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
        createdAt: ga.created_at,
      })),
      achievements: achievementItems.map((item) => ({
        ...item,
        unlocked: item.achieved,
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
    const lessonId = parsePositiveInt(req.body?.lessonId);
    if (!lessonId) {
      res.status(400).json({ error: "lessonId talab qilinadi." });
      return;
    }
    const lessonExists = db.prepare("SELECT id FROM lessons WHERE id = ?").get(lessonId);
    if (!lessonExists) {
      res.status(404).json({ error: "Dars topilmadi." });
      return;
    }

    let completedLessons = 0;
    db.exec("BEGIN IMMEDIATE;");
    try {
      db.prepare(
        `INSERT INTO student_progress (user_id, lesson_id, completed)
         VALUES (?, ?, 1)
         ON CONFLICT(user_id, lesson_id) DO UPDATE SET completed = 1, updated_at = CURRENT_TIMESTAMP`
      ).run(req.user!.id, lessonId);

      completedLessons = (
        db
          .prepare("SELECT COUNT(*) as c FROM student_progress WHERE user_id = ? AND completed = 1")
          .get(req.user!.id) as { c: number }
      ).c;
      db.exec("COMMIT;");
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }

    res.json({ completed: true, completedLessons });
  });

  app.post("/api/student/assignments/:id/submit", requireAuth, (req: AuthenticatedRequest, res) => {
    const assignmentId = parsePositiveInt(req.params.id);
    if (!assignmentId) {
      res.status(400).json({ error: "Noto'g'ri topshiriq ID." });
      return;
    }
    const answerText = String(req.body?.answerText || "").trim();
    if (!answerText || answerText.length > 4000) {
      res.status(400).json({ error: "Javob matni 1 dan 4000 belgigacha bo'lishi kerak." });
      return;
    }
    const asgExists = db.prepare("SELECT id FROM assignments WHERE id = ?").get(assignmentId);
    if (!asgExists) {
      res.status(404).json({ error: "Topshiriq topilmadi." });
      return;
    }

    db.exec("BEGIN IMMEDIATE;");
    try {
      db.prepare(
        `INSERT INTO assignment_submissions (assignment_id, student_id, answer_text)
         VALUES (?, ?, ?)
         ON CONFLICT(assignment_id, student_id) DO UPDATE SET answer_text = excluded.answer_text, submitted_at = CURRENT_TIMESTAMP`
      ).run(assignmentId, req.user!.id, answerText);

      db.exec("COMMIT;");
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }
    res.json({ success: true });
  });

  // ==================== TEACHER CABINET ====================
  app.get("/api/teacher/dashboard", requireRole(["teacher", "admin"]), (_req, res) => {
    const students = db
      .prepare(
        `SELECT u.id, u.full_name, u.email, u.grade_number, u.class_name, u.school_name,
                (SELECT COUNT(*) FROM student_progress sp WHERE sp.user_id = u.id AND sp.completed = 1) as completed_lessons,
                (SELECT ROUND(AVG(qa.percentage), 1) FROM quiz_attempts qa WHERE qa.user_id = u.id) as avg_quiz_score
         FROM users u WHERE u.role = 'student' ORDER BY u.grade_number ASC, completed_lessons DESC`
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
    const gradeNum = Number(gradeNumber);
    if (![8, 9, 10, 11].includes(gradeNum) || !title || String(title).trim().length < 2) {
      res.status(400).json({ error: "Sinf (8–11) va mavzu nomi kiritilishi shart." });
      return;
    }
    const cleanTitle = String(title).trim().slice(0, 300);
    const cleanSummary = String(summary || cleanTitle).trim().slice(0, 2000);
    const requestedChId = chapterId !== undefined && chapterId !== null && chapterId !== "" ? parsePositiveInt(chapterId) : null;
    const ch = (
      requestedChId
        ? db.prepare("SELECT id, roman_numeral, title FROM chapters WHERE id = ?").get(requestedChId)
        : db.prepare("SELECT id, roman_numeral, title FROM chapters WHERE grade_number = ? ORDER BY chapter_number ASC LIMIT 1").get(gradeNum)
    ) as { id: number; roman_numeral: string; title: string } | undefined;

    if (!ch) {
      res.status(400).json({ error: "Ko'rsatilgan bob topilmadi." });
      return;
    }
    const chId = ch.id;

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
    const quizId = parsePositiveInt(req.params.id);
    if (!quizId) {
      res.status(400).json({ error: "Noto'g'ri test ID." });
      return;
    }
    const quizExists = db.prepare("SELECT id FROM quizzes WHERE id = ?").get(quizId);
    if (!quizExists) {
      res.status(404).json({ error: "Test topilmadi." });
      return;
    }
    const { prompt, options, correctIndex, explanation } = req.body || {};
    if (!prompt || !Array.isArray(options) || options.length < 2 || options.length > 8) {
      res.status(400).json({ error: "Savol matni va 2–8 ta variant kiriting." });
      return;
    }
    const safeIdx = Number(correctIndex ?? 0);
    if (!Number.isInteger(safeIdx) || safeIdx < 0 || safeIdx >= options.length) {
      res.status(400).json({ error: "To'g'ri javob indeksi variantlar oralig'ida bo'lishi shart." });
      return;
    }

    const existingCount = (db.prepare("SELECT COUNT(*) as c FROM questions WHERE quiz_id = ?").get(quizId) as { c: number }).c;
    const qId = `q-${quizId}-custom-${Date.now()}`;
    const qObj: QuizQuestion = {
      id: qId,
      type: "single",
      prompt: String(prompt).slice(0, 600),
      options: options.map((o) => String(o).slice(0, 400)),
      correctAnswer: safeIdx,
      explanation: String(explanation || "O'qituvchi tomonidan qo'shilgan savol.").slice(0, 800),
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
    const gradeNum = [8, 9, 10, 11].includes(Number(gradeNumber)) ? Number(gradeNumber) : 9;
    const safeLessonId = parsePositiveInt(lessonId);
    const info = db
      .prepare(
        `INSERT INTO assignments (title, description, grade_number, lesson_id, due_date, teacher_id, teacher_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        String(title).slice(0, 250),
        String(description).slice(0, 2000),
        gradeNum,
        safeLessonId,
        String(dueDate || "2026-06-01").slice(0, 30),
        req.user!.id,
        req.user!.fullName
      );
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });

  app.post("/api/teacher/submissions/:id/grade", requireRole(["teacher", "admin"]), (req, res) => {
    const subId = parsePositiveInt(req.params.id);
    if (!subId) {
      res.status(400).json({ error: "Noto'g'ri topshiriq javobi ID." });
      return;
    }
    const existing = db.prepare("SELECT id FROM assignment_submissions WHERE id = ?").get(subId);
    if (!existing) {
      res.status(404).json({ error: "Topshiriq javobi topilmadi." });
      return;
    }
    const { score, feedback } = req.body || {};
    const cleanScore = Math.min(100, Math.max(0, Math.round(Number(score || 0))));
    db.prepare("UPDATE assignment_submissions SET score = ?, feedback = ? WHERE id = ?").run(
      cleanScore,
      String(feedback || "").slice(0, 1000),
      subId
    );
    res.json({ success: true });
  });

  // ==================== ADMIN PANEL ====================
  app.get("/api/admin/dashboard", requireRole(["admin"]), (_req, res) => {
    const users = db
      .prepare("SELECT id, email, full_name, role, status, grade_number, class_name, school_name, created_at FROM users ORDER BY id ASC")
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

  app.get("/api/admin/notifications", requireRole(["admin"]), (_req, res) => {
    const teacherRows = db
      .prepare(
        `SELECT id, email, full_name, grade_number, created_at
         FROM users WHERE role = 'teacher' AND status = 'pending' ORDER BY id ASC`
      )
      .all() as Array<{
      id: number;
      email: string;
      full_name: string;
      grade_number: number;
      created_at: string;
    }>;

    const accessRows = db
      .prepare(
        `SELECT ar.*, u.email, u.full_name
         FROM access_requests ar
         JOIN users u ON u.id = ar.user_id
         WHERE ar.status = 'pending'
         ORDER BY ar.id ASC`
      )
      .all() as unknown as Array<AccessRequestDbRow & { email: string; full_name: string }>;

    res.json({
      teacherRequests: teacherRows.map((t) => ({
        id: t.id,
        email: t.email,
        fullName: t.full_name,
        gradeNumber: t.grade_number,
        createdAt: t.created_at,
      })),
      accessRequests: accessRows.map((row) => ({
        ...mapAccessRequest(row),
        email: row.email,
        fullName: row.full_name,
      })),
    });
  });

  app.post("/api/admin/teacher-requests/:id/approve", requireRole(["admin"]), (req, res) => {
    const targetId = parsePositiveInt(req.params.id);
    if (!targetId) {
      res.status(400).json({ error: "Noto'g'ri foydalanuvchi ID." });
      return;
    }
    const target = db.prepare("SELECT id, role, status FROM users WHERE id = ?").get(targetId) as
      | { id: number; role: UserRole; status?: string }
      | undefined;
    if (!target) {
      res.status(404).json({ error: "Foydalanuvchi topilmadi." });
      return;
    }
    if (target.role !== "teacher" || (target.status ?? "active") !== "pending") {
      res.status(400).json({ error: "Faqat kutayotgan o'qituvchi arizasi tasdiqlanishi mumkin." });
      return;
    }
    db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(targetId);
    res.json({ success: true, status: "active", userId: targetId });
  });

  app.post("/api/admin/teacher-requests/:id/reject", requireRole(["admin"]), (req, res) => {
    const targetId = parsePositiveInt(req.params.id);
    if (!targetId) {
      res.status(400).json({ error: "Noto'g'ri foydalanuvchi ID." });
      return;
    }
    const target = db.prepare("SELECT id, role, status FROM users WHERE id = ?").get(targetId) as
      | { id: number; role: UserRole; status?: string }
      | undefined;
    if (!target) {
      res.status(404).json({ error: "Foydalanuvchi topilmadi." });
      return;
    }
    if (target.role !== "teacher" || (target.status ?? "active") !== "pending") {
      res.status(400).json({ error: "Faqat kutayotgan o'qituvchi arizasi rad etilishi mumkin." });
      return;
    }
    db.prepare("UPDATE users SET status = 'rejected' WHERE id = ?").run(targetId);
    res.json({ success: true, status: "rejected", userId: targetId });
  });

  app.patch("/api/admin/access-requests/:id", requireRole(["admin"]), (req: AuthenticatedRequest, res) => {
    const requestId = parsePositiveInt(req.params.id);
    if (!requestId) {
      res.status(400).json({ error: "Noto'g'ri so'rov ID raqami." });
      return;
    }
    const action = req.body?.action;
    if (action !== "approve" && action !== "reject") {
      res.status(400).json({ error: "Harakat 'approve' yoki 'reject' bo'lishi kerak." });
      return;
    }
    const existing = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(requestId) as
      | AccessRequestDbRow
      | undefined;
    if (!existing) {
      res.status(404).json({ error: "Ruxsat so'rovi topilmadi." });
      return;
    }
    const newStatus = action === "approve" ? "approved" : "rejected";
    const now = new Date().toISOString();
    db.prepare("UPDATE access_requests SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?").run(
      newStatus,
      now,
      req.user!.id,
      requestId
    );
    const updated = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(requestId) as unknown as AccessRequestDbRow;
    res.json({ success: true, status: newStatus, request: mapAccessRequest(updated) });
  });

  app.patch("/api/admin/users/:id/role", requireRole(["admin"]), (req: AuthenticatedRequest, res) => {
    const targetId = parsePositiveInt(req.params.id);
    if (!targetId) {
      res.status(400).json({ error: "Noto'g'ri foydalanuvchi ID." });
      return;
    }
    const role = req.body?.role;
    if (!["student", "teacher", "admin"].includes(role)) {
      res.status(400).json({ error: "Noto'g'ri rol." });
      return;
    }
    const target = db.prepare("SELECT id, role FROM users WHERE id = ?").get(targetId) as
      | { id: number; role: UserRole }
      | undefined;
    if (!target) {
      res.status(404).json({ error: "Foydalanuvchi topilmadi." });
      return;
    }
    if (role === "admin" && target.role !== "admin") {
      res.status(400).json({ error: "Tizimda faqat bitta administrator bo'lishi mumkin." });
      return;
    }
    if (target.role === "admin" && role !== "admin") {
      const adminCount = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get() as { c: number }).c;
      if (adminCount <= 1 || targetId === req.user!.id) {
        res.status(400).json({ error: "Oxirgi administrator rolini olib tashlab bo'lmaydi." });
        return;
      }
    }
    db.prepare("UPDATE users SET role = ?, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?").run(
      role,
      targetId
    );
    res.json({ success: true });
  });

  app.patch("/api/admin/lessons/:id/status", requireRole(["admin", "teacher"]), (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Noto'g'ri dars ID." });
      return;
    }
    const existing = db.prepare("SELECT id FROM lessons WHERE id = ?").get(id);
    if (!existing) {
      res.status(404).json({ error: "Dars topilmadi." });
      return;
    }
    const status = req.body?.status === "draft" ? "draft" : "verified";
    db.prepare("UPDATE lessons SET status = ? WHERE id = ?").run(status, id);
    res.json({ success: true, status });
  });

  app.delete("/api/admin/lessons/:id", requireRole(["admin"]), (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Noto'g'ri dars ID." });
      return;
    }
    const lesson = db.prepare("SELECT id, presentation_id, quiz_id FROM lessons WHERE id = ?").get(id) as
      | { id: number; presentation_id: number | null; quiz_id: number | null }
      | undefined;
    if (!lesson) {
      res.status(404).json({ error: "Dars topilmadi." });
      return;
    }

    db.exec("BEGIN TRANSACTION;");
    try {
      db.prepare("DELETE FROM lessons WHERE id = ?").run(id);
      if (lesson.presentation_id) {
        db.prepare("DELETE FROM presentations WHERE id = ?").run(lesson.presentation_id);
      }
      if (lesson.quiz_id) {
        db.prepare("DELETE FROM quizzes WHERE id = ?").run(lesson.quiz_id);
      }
      db.exec("COMMIT;");
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }
    res.json({ success: true });
  });

  app.put("/api/admin/ai-settings", requireRole(["admin"]), (req, res) => {
    const { modelName, pedagogicalTone, strictGrounding, enabled } = req.body || {};
    db.prepare(
      `UPDATE ai_settings SET model_name = ?, pedagogical_tone = ?, strict_grounding = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`
    ).run(
      String(modelName || "gemini-4-hydrogen").slice(0, 80),
      String(pedagogicalTone || "Sodda, darslikka asoslangan").slice(0, 300),
      strictGrounding ? 1 : 0,
      enabled ? 1 : 0
    );
    res.json({ success: true });
  });

  // ==================== GEMINI AI ROUTES (SERVER-SIDE ONLY) ====================
  app.post("/api/ai/task", aiRateLimiter, async (req, res) => {
    const { task, prompt, gradeNumber, lessonId } = req.body || {};
    if (!prompt || String(prompt).trim().length < 2) {
      res.status(400).json({ error: "Savol yoki mavzuni kiriting." });
      return;
    }
    const allowedTasks = ["chat", "explain", "define", "generate_quiz", "analyze_case", "generate_slides"];
    const safeTask = allowedTasks.includes(task) ? task : "chat";
    const safeGrade = [8, 9, 10, 11].includes(Number(gradeNumber)) ? Number(gradeNumber) : undefined;
    const safeLessonId = parsePositiveInt(lessonId) ?? undefined;
    try {
      const result = await runLegalAiTask(db, {
        task: safeTask,
        prompt: String(prompt).slice(0, 2000),
        gradeNumber: safeGrade,
        lessonId: safeLessonId,
      });
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI xizmatida xatolik yuz berdi.";
      res.status(503).json({ error: msg });
    }
  });

  // Centralized JSON error handler (prevents HTML stack traces or path leakage on malformed JSON/errors)
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err && typeof err === "object" && "type" in err) {
      const eType = (err as { type?: string }).type;
      if (eType === "entity.parse.failed") {
        res.status(400).json({ error: "Yuborilgan JSON formati noto'g'ri." });
        return;
      }
      if (eType === "entity.too.large") {
        res.status(413).json({ error: "So'rov hajmi ruxsat etilgan chegaradan katta." });
        return;
      }
    }
    res.status(500).json({ error: "Server ichki xatoligi yuz berdi." });
  });

  return { app, db };
}
