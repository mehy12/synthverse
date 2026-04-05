"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle, User } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/map");

  useEffect(() => {
    const nextPathParam = new URLSearchParams(window.location.search).get("next");
    if (nextPathParam && nextPathParam.startsWith("/") && !nextPathParam.startsWith("//")) {
      setNextPath(nextPathParam);
    }
  }, []);

  return (
    <div style={{ minHeight: "calc(100vh - var(--nav-height))", background: "var(--off-white)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ maxWidth: "640px", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }} className="animate-slide-up">
          <div className="badge badge-teal" style={{ marginBottom: "16px" }}>OPEN ACCESS</div>
          <h2 style={{ fontSize: "2rem", marginBottom: "12px", color: "var(--text-heading)" }}>No Sign-In Required</h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "500px", margin: "0 auto", fontSize: "0.9rem" }}>
            Authentication is disabled. Continue directly to the HiveMind operational view.
          </p>
        </div>

        <div className="card animate-slide-up" style={{ padding: "28px", marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
            <div
              style={{
                width: "46px",
                height: "46px",
                borderRadius: "var(--radius-lg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--safe)",
                color: "#ffffff",
              }}
            >
              <User size={24} strokeWidth={1.6} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.08rem", fontWeight: 700 }}>Urban Resident</h3>
              <p style={{ margin: "4px 0 0", fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                Report flooding, view district risk, and monitor alerts without login barriers.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "18px" }}>
            {[
              "Routes are publicly accessible",
              "No access code required",
              "Direct entry to map and command center",
            ].map((benefit) => (
              <div
                key={benefit}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                }}
              >
                <CheckCircle size={14} strokeWidth={1.5} style={{ color: "var(--safe)" }} />
                {benefit}
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: "center" }} className="animate-fade-in">
          <button
            onClick={() => router.replace(nextPath)}
            className="btn btn-primary btn-lg"
            style={{
              padding: "14px 40px",
              fontSize: "1rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            Continue To HiveMind <ArrowRight size={18} strokeWidth={1.5} />
          </button>
          <div style={{ marginTop: "20px" }}>
            <Link href="/" style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600 }}>
              &larr; Return to homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


