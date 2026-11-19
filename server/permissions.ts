import type { DatabaseSync } from "node:sqlite";
import type { Response } from "express";
import type { AuthenticatedRequest } from "./auth";
import type {
  AccessRequestRecord,
  AccessRequestStatus,
  AccessResourceType,
} from "../shared/types";

const RESOURCE_TYPES: ReadonlySet<string> = new Set([
  "chapters",
  "lessons",
  "presentations",
  "glossary",
  "legislation",
  "scenarios",
]);

const STATUS_PRIORITY: Record<Exclude<AccessRequestStatus, "none">, number> = {
  approved: 3,
  pending: 2,
  rejected: 1,
};

export interface AccessRequestDbRow {
  id: number;
  user_id: number;
  resource_type: AccessResourceType;
  resource_id: number;
  status: Exclude<AccessRequestStatus, "none">;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: number | null;
}

export interface AccessDecision {
  allowed: boolean;
  requestStatus: AccessRequestStatus;
}

export interface ListAccessDecision extends AccessDecision {
  approvedResourceIds: Set<number>;
  canViewResource: (resourceId: number) => boolean;
}

export function isAccessResourceType(value: unknown): value is AccessResourceType {
  return typeof value === "string" && RESOURCE_TYPES.has(value);
}

export function mapAccessRequest(row: AccessRequestDbRow): AccessRequestRecord {
  return {
    id: row.id,
    userId: row.user_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? null,
    reviewedBy: row.reviewed_by ?? null,
  };
}

export function getAccessRequestStatus(
  db: DatabaseSync,
  userId: number | undefined,
  resourceType: AccessResourceType,
  resourceId: number
): AccessRequestStatus {
  if (!userId) {
    return "none";
  }
  const rows = db
    .prepare(
      `SELECT resource_id, status FROM access_requests
       WHERE user_id = ? AND resource_type = ? AND resource_id IN (?, 0)`
    )
    .all(userId, resourceType, resourceId) as Array<{
    resource_id: number;
    status: Exclude<AccessRequestStatus, "none">;
  }>;

  let status: AccessRequestStatus = "none";
  let bestPriority = 0;
  for (const row of rows) {
    const priority = STATUS_PRIORITY[row.status] ?? 0;
    if (priority > bestPriority) {
      bestPriority = priority;
      status = row.status;
    }
  }
  return status;
}

function getHighestRequestStatus(
  db: DatabaseSync,
  userId: number | undefined,
  resourceType: AccessResourceType
): AccessRequestStatus {
  if (!userId) {
    return "none";
  }
  const rows = db
    .prepare("SELECT status FROM access_requests WHERE user_id = ? AND resource_type = ?")
    .all(userId, resourceType) as Array<{ status: Exclude<AccessRequestStatus, "none"> }>;
  let status: AccessRequestStatus = "none";
  let bestPriority = 0;
  for (const row of rows) {
    const priority = STATUS_PRIORITY[row.status] ?? 0;
    if (priority > bestPriority) {
      bestPriority = priority;
      status = row.status;
    }
  }
  return status;
}

export function getApprovedResourceIds(
  db: DatabaseSync,
  userId: number | undefined,
  resourceType: AccessResourceType
): Set<number> {
  if (!userId) {
    return new Set<number>();
  }
  const rows = db
    .prepare("SELECT resource_id FROM access_requests WHERE user_id = ? AND resource_type = ? AND status = 'approved'")
    .all(userId, resourceType) as Array<{ resource_id: number }>;
  return new Set(rows.map((row) => row.resource_id));
}

export function hasFullContentAccess(user: AuthenticatedRequest["user"]): boolean {
  if (!user || (user.status ?? "active") !== "active") {
    return false;
  }
  return user.role === "admin" || user.role === "teacher";
}

export function checkListAccess(
  db: DatabaseSync,
  req: AuthenticatedRequest,
  resourceType: AccessResourceType
): ListAccessDecision {
  const approvedResourceIds = getApprovedResourceIds(db, req.user?.id, resourceType);
  const fullAccess = hasFullContentAccess(req.user);
  const sectionApproved = approvedResourceIds.has(0);
  const allowed = fullAccess || sectionApproved;
  return {
    allowed,
    requestStatus: getHighestRequestStatus(db, req.user?.id, resourceType),
    approvedResourceIds,
    canViewResource: (resourceId: number) =>
      fullAccess || sectionApproved || approvedResourceIds.has(resourceId),
  };
}

export function checkContentAccess(
  db: DatabaseSync,
  req: AuthenticatedRequest,
  resourceType: AccessResourceType,
  resourceId = 0
): AccessDecision {
  const requestStatus = getAccessRequestStatus(db, req.user?.id, resourceType, resourceId);
  return {
    allowed: hasFullContentAccess(req.user) || requestStatus === "approved",
    requestStatus,
  };
}

export function listAccessFields(req: AuthenticatedRequest, decision: AccessDecision) {
  return {
    locked: !decision.allowed,
    requestable: true,
    ...(req.user ? { requestStatus: decision.requestStatus } : {}),
  };
}

export function denyContentAccess(res: Response, requestStatus: AccessRequestStatus): void {
  res.status(403).json({
    locked: true,
    error: "Ruxsat so'rash talab etiladi.",
    requestStatus,
  });
}
