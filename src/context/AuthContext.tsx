"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type UserRole = "responder" | "coordinator" | "resident" | null;

type SessionRole = Exclude<UserRole, null>;

interface AuthSession {
  role: SessionRole;
  issuedAt: number;
  expiresAt: number;
  sessionId: string;
}

interface UserProfile {
  name: string;
  role: UserRole;
  avatar: string;
}

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  login: (role: UserRole) => boolean;
  logout: () => void;
  renewSession: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionExpiresAt: number | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_SESSION_KEY = "HiveMind_auth_session_v1";
const LEGACY_ROLE_KEY = "HiveMind_role";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const ROLE_DATA: Record<string, UserProfile> = {
  responder: { name: "Arun K.", role: "responder", avatar: "FR" },
  coordinator: { name: "Inspector Nair", role: "coordinator", avatar: "DC" },
  resident: { name: "Meera Ravi", role: "resident", avatar: "UR" },
};

function clearStoredAuth() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(LEGACY_ROLE_KEY);
}

function buildSession(role: SessionRole): AuthSession {
  const now = Date.now();
  return {
    role,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
    sessionId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${role}-${now}`,
  };
}

function persistSession(session: AuthSession) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function readStoredSession(): AuthSession | null {
  const rawSession = localStorage.getItem(AUTH_SESSION_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession) as Partial<AuthSession>;
    const role = parsed.role;
    if (!role || !(role in ROLE_DATA)) {
      return null;
    }

    if (
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number" ||
      typeof parsed.sessionId !== "string"
    ) {
      return null;
    }

    return {
      role,
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
      sessionId: parsed.sessionId,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedSession = readStoredSession();

    if (storedSession && storedSession.expiresAt > Date.now()) {
      setSession(storedSession);
      setUser(ROLE_DATA[storedSession.role]);
      setIsLoading(false);
      return;
    }

    const legacyRole = localStorage.getItem(LEGACY_ROLE_KEY);
    if (legacyRole && ROLE_DATA[legacyRole]) {
      const migratedSession = buildSession(legacyRole as SessionRole);
      setSession(migratedSession);
      setUser(ROLE_DATA[legacyRole]);
      persistSession(migratedSession);
      setIsLoading(false);
      return;
    }

    clearStoredAuth();
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_SESSION_KEY && event.key !== LEGACY_ROLE_KEY) {
        return;
      }

      const restoredSession = readStoredSession();
      if (restoredSession && restoredSession.expiresAt > Date.now()) {
        setSession(restoredSession);
        setUser(ROLE_DATA[restoredSession.role]);
      } else {
        setSession(null);
        setUser(null);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const login = (role: UserRole) => {
    if (role && ROLE_DATA[role]) {
      const profile = ROLE_DATA[role];
      const nextSession = buildSession(role);
      setUser(profile);
      setSession(nextSession);
      persistSession(nextSession);
      localStorage.setItem(LEGACY_ROLE_KEY, role);
      return true;
    }

    return false;
  };

  const logout = () => {
    setUser(null);
    setSession(null);
    clearStoredAuth();
  };

  const renewSession = () => {
    if (!session || !session.role) {
      return;
    }

    const renewed = buildSession(session.role);
    setSession(renewed);
    persistSession(renewed);
  };

  useEffect(() => {
    if (!session) {
      return;
    }

    const timeoutMs = Math.max(session.expiresAt - Date.now(), 0);
    const timeoutId = window.setTimeout(() => {
      setUser(null);
      setSession(null);
      clearStoredAuth();
    }, timeoutMs);

    return () => window.clearTimeout(timeoutId);
  }, [session]);

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        login,
        logout,
        renewSession,
        isLoading,
        isAuthenticated: Boolean(user),
        sessionExpiresAt: session?.expiresAt ?? null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

