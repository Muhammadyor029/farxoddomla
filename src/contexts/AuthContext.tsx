import React, { createContext, useContext, useEffect, useState } from "react";
import { isOwnerAccount, type UserAccount } from "../../shared/types";
import { apiRequest, getAuthToken, setAuthToken } from "../lib/api";

interface AuthContextValue {
  user: UserAccount | null;
  unlocked: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserAccount>;
  register: (payload: {
    fullName: string;
    email: string;
    password: string;
    gradeNumber: number;
    className?: string;
    schoolName?: string;
  }) => Promise<UserAccount>;
  logout: () => void;
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

  const register = async (payload: {
    fullName: string;
    email: string;
    password: string;
    gradeNumber: number;
    className?: string;
    schoolName?: string;
  }) => {
    const data = await apiRequest<{ token: string; user: UserAccount }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setAuthToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
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
