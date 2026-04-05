"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface RequireAuthProps {
  children: ReactNode;
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const nextParam = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${nextParam}`);
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  if (isLoading) {
    return (
      <main
        style={{
          minHeight: "calc(100vh - var(--nav-height))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--off-white)",
          color: "var(--text-secondary)",
          fontWeight: 600,
        }}
      >
        Verifying secure session...
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
