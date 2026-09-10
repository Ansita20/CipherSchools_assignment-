import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as api from "../api/client";
import type { Learner } from "../types";

interface AuthContextValue {
  user: Learner | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Learner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getCurrentUser()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    setUser(await api.login(email, password));
  }

  async function signup(email: string, password: string) {
    setUser(await api.signup(email, password));
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, signup, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
