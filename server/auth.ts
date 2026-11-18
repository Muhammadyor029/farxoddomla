import type { NextFunction, Request, Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { UserAccount, UserRole } from "../shared/types";

const JWT_SECRET = process.env.JWT_SECRET || "huquq-olami-dev-jwt-secret-key-2026";

export interface AuthenticatedRequest extends Request {
  user?: UserAccount;
}

interface DbUserRow {
  id: number;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  grade_number: number;
  class_name: string;
  school_name: string;
  xp: number;
  level: number;
  streak_days: number;
  created_at: string;
}

export function mapUserRow(row: DbUserRow): UserAccount {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    gradeNumber: row.grade_number,
    className: row.class_name,
    schoolName: row.school_name,
    xp: row.xp,
    level: row.level,
    streakDays: row.streak_days,
    createdAt: row.created_at,
  };
}

export function signToken(user: UserAccount): string {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 8);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function attachOptionalUser(db: DatabaseSync) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as unknown as { sub: number };
        const row = db
          .prepare("SELECT * FROM users WHERE id = ?")
          .get(decoded.sub) as DbUserRow | undefined;
        if (row) {
          req.user = mapUserRow(row);
        }
      } catch {
        // Invalid or expired token: proceed anonymously
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
