"use client";

import React, { createContext, useContext } from "react";

export type UserRole = "resident" | null;

interface UserProfile {
  name: string;
  role: Exclude<UserRole, null>;
  avatar: string;
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

const OPEN_ACCESS_USER: UserProfile = {
  name: "Urban Resident",
  role: "resident",
  avatar: "UR",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const login = async (role: UserRole, _accessCode: string) => role === "resident";
  const logout = async () => {
    return;
  };
  const renewSession = async () => true;

  return (
    <AuthContext.Provider
      value={{
        user: OPEN_ACCESS_USER,
        role: OPEN_ACCESS_USER.role,
        login,
        logout,
        renewSession,
        isLoading: false,
        isAuthenticated: true,
        sessionExpiresAt: null,
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

