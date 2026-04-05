"use client";

import type { ReactNode } from "react";

interface RequireAuthProps {
  children: ReactNode;
}

export default function RequireAuth({ children }: RequireAuthProps) {
  return <>{children}</>;
}
