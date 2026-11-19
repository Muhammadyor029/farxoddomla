import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { UserAccount, UserRole, UserStatus } from "../shared/types";

let cachedRuntimeSecret: string | null = null;

function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) {
    return fromEnv;
  }

  if (cachedRuntimeSecret) {
    return cachedRuntimeSecret;
  }

  if (process.env.NODE_ENV === "production") {
    console.warn(
      "Ogohlantirish: Production muhitida JWT_SECRET env o'zgaruvchisi topilmadi — lokal ./data/.jwt_secret kaliti ishlatilmoqda."
    );
  }

  // Persist a locally generated random secret under ./data/.jwt_secret so sessions survive restarts
  // without storing any hardcoded secret in source code.
  try {
    const dataDir = path.resolve(process.cwd(), "data");
    const secretFile = path.join(dataDir, ".jwt_secret");
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, "utf8").trim();
      if (existing.length >= 32) {
        cachedRuntimeSecret = existing;
        return cachedRuntimeSecret;
      }
    }
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const generated = crypto.randomBytes(48).toString("hex");
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    cachedRuntimeSecret = generated;
    return cachedRuntimeSecret;
  } catch {
    cachedRuntimeSecret = crypto.randomBytes(48).toString("hex");
    return cachedRuntimeSecret;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: UserAccount;
  tokenVersion?: number;
}

export interface DbUserRow {
  id: number;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  status?: UserStatus;
  grade_number: number;
  class_name: string;
  school_name: string;
  xp: number;
  level: number;
  streak_days: number;
  token_version?: number;
  created_at: string;
}

export function mapUserRow(row: DbUserRow): UserAccount {
  const user = {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    status: row.status ?? "active",
    canUnlockTopics: row.role === "admin",
    gradeNumber: row.grade_number,
    className: row.class_name,
    schoolName: row.school_name,
    xp: 0,
    level: 1,
    streakDays: row.streak_days,
    createdAt: row.created_at,
  };
  return user as UserAccount;
}

export function signToken(user: UserAccount, tokenVersion = 1): string {
  return jwt.sign(
    { sub: user.id, role: user.role, tv: tokenVersion },
    resolveJwtSecret(),
    { algorithm: "HS256", expiresIn: "2h" }
  );
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function revokeUserTokens(db: DatabaseSync, userId: number): number {
  db.prepare("UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE id = ?").run(userId);
  const row = db.prepare("SELECT token_version FROM users WHERE id = ?").get(userId) as
    | { token_version: number }
    | undefined;
  return row?.token_version ?? 1;
}

export function attachOptionalUser(db: DatabaseSync) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      try {
        const decoded = jwt.verify(token, resolveJwtSecret(), {
          algorithms: ["HS256"],
        }) as unknown as { sub: number; tv?: number };
        const userId = Number(decoded.sub);
        if (!Number.isInteger(userId) || userId <= 0) {
          next();
          return;
        }
        const row = db
          .prepare("SELECT * FROM users WHERE id = ?")
          .get(userId) as DbUserRow | undefined;
        if (
          row &&
          (row.status ?? "active") === "active" &&
          (decoded.tv ?? 1) === (row.token_version ?? 1)
        ) {
          req.user = mapUserRow(row);
          req.tokenVersion = row.token_version ?? 1;
        }
      } catch {
        // Invalid, expired, or revoked token: proceed anonymously
      }
    }
    next();
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Tizimga kirish talab etiladi." });
    return;
  }
  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Tizimga kirish talab etiladi." });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Ushbu amal uchun ruxsatingiz yetarli emas." });
      return;
    }
    next();
  };
}
