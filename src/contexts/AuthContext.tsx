import React, { createContext, useContext, useEffect, useState } from "react";
import { isOwnerAccount, type UserAccount } from "../../shared/types";
import { apiRequest, getAuthToken, setAuthToken } from "../lib/api";

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  gradeNumber: number;
  className?: string;
  schoolName?: string;
  role?: "student" | "teacher";
}

export interface RegisterResult {
  user: UserAccount | null;
  message?: string;
}

interface AuthContextValue {
  user: UserAccount | null;
  unlocked: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserAccount>;
  register: (payload: RegisterPayload) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<{ user: UserAccount }>("/api/auth/me");
      setUser(data.user);
    } catch {
      setAuthToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiRequest<{ token: string; user: UserAccount }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload: RegisterPayload): Promise<RegisterResult> => {
    const data = await apiRequest<{ token?: string | null; user: UserAccount; message?: string }>(
      "/api/auth/register",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    if (!data.token) {
      return { user: null, message: data.message };
    }
    setAuthToken(data.token);
    setUser(data.user);
    return { user: data.user, message: data.message };
  };

  const logout = async () => {
    const token = getAuthToken();
    if (token) {
      await apiRequest("/api/auth/logout", { method: "POST" }).catch(() => {});
    }
    setAuthToken(null);
    setUser(null);
  };

  const unlocked = isOwnerAccount(user);

  return (
    <AuthContext.Provider value={{ user, unlocked, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
