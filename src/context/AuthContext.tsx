"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type UserRole = "responder" | "coordinator" | "resident" | null;

interface UserProfile {
  name: string;
  role: UserRole;
  avatar: string;
}

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  login: (role: UserRole) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_DATA: Record<string, UserProfile> = {
  responder: { name: "Arun K.", role: "responder", avatar: "ðŸš’" },
  coordinator: { name: "Inspector Nair", role: "coordinator", avatar: "ðŸ‘®" },
  resident: { name: "Meera Ravi", role: "resident", avatar: "ðŸ‘©" },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedRole = localStorage.getItem("HiveMind_role");
    if (storedRole && ROLE_DATA[storedRole]) {
      setUser(ROLE_DATA[storedRole]);
    }
    setIsLoading(false);
  }, []);

  const login = (role: UserRole) => {
    if (role && ROLE_DATA[role]) {
      const profile = ROLE_DATA[role];
      setUser(profile);
      localStorage.setItem("HiveMind_role", role);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("HiveMind_role");
  };

  return (
    <AuthContext.Provider value={{ user, role: user?.role || null, login, logout, isLoading }}>
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

