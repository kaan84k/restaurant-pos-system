// src/app/auth.tsx
import React, { createContext, useContext, useMemo, useState } from "react";
import { loginByPin as apiLoginByPin, type AuthUser } from "../services/auth.service";

type Role = "CASHIER" | "MANAGER" | "ADMIN";

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  /** Preferred */
  loginByPin: (pin: string) => Promise<void>;
  /** Alias to support components calling `login` */
  login: (pin: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  token: null,
  loginByPin: async () => {},
  login: async () => {},
  logout: () => {},
});

// Helpers to be compatible with either key set
function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("auth_token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("auth_token") ||
    null
  );
}
function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw =
    localStorage.getItem("user") ||
    localStorage.getItem("auth_user") ||
    sessionStorage.getItem("user") ||
    sessionStorage.getItem("auth_user");
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthUser; } catch { return null; }
}
function persistAuth(token: string, user: AuthUser) {
  // Write to BOTH sets of keys so any api.ts variant picks it up
  localStorage.setItem("token", token);
  localStorage.setItem("auth_token", token);
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("auth_user", JSON.stringify(user));
}
function clearPersistedAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("auth_token");
  localStorage.removeItem("user");
  localStorage.removeItem("auth_user");
}

export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getStoredToken());

  const loginByPin = async (pin: string) => {
    const { token, user } = await apiLoginByPin(pin); // POST /auth/login
    persistAuth(token, user);
    setUser(user);
    setToken(token);
  };

  // alias; some UIs use `login`
  const login = loginByPin;

  const logout = () => {
    clearPersistedAuth();
    setUser(null);
    setToken(null);
  };

  const value = useMemo(
    () => ({ user, token, loginByPin, login, logout }),
    [user, token]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
