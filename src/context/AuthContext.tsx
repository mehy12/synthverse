"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type UserRole = "resident" | null;

interface UserProfile {
  name: string;
  role: Exclude<UserRole, null>;
  avatar: string;
}

interface AuthSessionResponse {
  user: UserProfile;
  expiresAt: number;
}

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  login: (role: UserRole, accessCode: string) => Promise<boolean>;
  logout: () => Promise<void>;
  renewSession: () => Promise<boolean>;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionExpiresAt: number | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isValidSessionPayload(payload: unknown): payload is AuthSessionResponse {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<AuthSessionResponse>;
  return (
    !!candidate.user &&
    candidate.user.role === "resident" &&
    typeof candidate.user.name === "string" &&
    typeof candidate.user.avatar === "string" &&
    typeof candidate.expiresAt === "number"
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearLocalAuth = useCallback(() => {
    setUser(null);
    setSessionExpiresAt(null);
  }, []);

  const applySession = useCallback((payload: AuthSessionResponse) => {
    setUser(payload.user);
    setSessionExpiresAt(payload.expiresAt);
  }, []);

  const hydrateSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        clearLocalAuth();
        return;
      }

      const payload = (await response.json()) as unknown;
      if (!isValidSessionPayload(payload)) {
        clearLocalAuth();
        return;
      }

      applySession(payload);
    } catch {
      clearLocalAuth();
    } finally {
      setIsLoading(false);
    }
  }, [applySession, clearLocalAuth]);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void hydrateSession();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [hydrateSession]);

  const login = useCallback(
    async (role: UserRole, accessCode: string) => {
      if (role !== "resident" || !accessCode.trim()) {
        return false;
      }

      setIsLoading(true);
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role, accessCode }),
        });

        if (!response.ok) {
          clearLocalAuth();
          return false;
        }

        const payload = (await response.json()) as unknown;
        if (!isValidSessionPayload(payload)) {
          clearLocalAuth();
          return false;
        }

        applySession(payload);
        return true;
      } catch {
        clearLocalAuth();
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [applySession, clearLocalAuth],
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Keep logout resilient even if network fails.
    } finally {
      clearLocalAuth();
      setIsLoading(false);
    }
  }, [clearLocalAuth]);

  const renewSession = useCallback(async () => {
    if (!user) {
      return false;
    }

    try {
      const response = await fetch("/api/auth/renew", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearLocalAuth();
        }
        return false;
      }

      const payload = (await response.json()) as unknown;
      if (!isValidSessionPayload(payload)) {
        clearLocalAuth();
        return false;
      }

      applySession(payload);
      return true;
    } catch {
      return false;
    }
  }, [applySession, clearLocalAuth, user]);

  useEffect(() => {
    if (!sessionExpiresAt) {
      return;
    }

    const msUntilExpiry = sessionExpiresAt - Date.now();
    if (msUntilExpiry <= 0) {
      void logout();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void logout();
    }, msUntilExpiry);

    return () => window.clearTimeout(timeoutId);
  }, [logout, sessionExpiresAt]);

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
        sessionExpiresAt,
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

