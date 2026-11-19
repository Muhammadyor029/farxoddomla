import type { AccessRequestRecord } from "../../shared/types";

const TOKEN_KEY = "huquq_olami_token";
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || "").replace(/\/$/, "");

export const NOTIFICATIONS_UPDATED_EVENT = "huquq_olami_notifications_updated";

export interface AdminNotificationData {
  teacherRequests: Array<{
    id: number;
    email: string;
    fullName: string;
    gradeNumber: number;
    createdAt: string;
  }>;
  accessRequests: Array<AccessRequestRecord & { email: string; fullName: string }>;
}

export function notifyNotificationsUpdated(): void {
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}

export class ApiRequestError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.data = data;
  }
}

export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(resolveApiUrl(path), {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errData = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiRequestError(errData?.error || `Server xatoligi (${res.status})`, res.status, errData);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Serverdan kutilgan JSON javob olinmadi.");
  }

  return (await res.json()) as T;
}
