"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, CheckCircle, KeyRound, User } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const [accessCode, setAccessCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nextPath, setNextPath] = useState("/map");

  useEffect(() => {
    const nextPathParam = new URLSearchParams(window.location.search).get("next");
    if (nextPathParam && nextPathParam.startsWith("/") && !nextPathParam.startsWith("//")) {
      setNextPath(nextPathParam);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(nextPath);
    }
  }, [isLoading, user, router, nextPath]);

  if (isLoading || user) {
    return null;
  }

  const handleLogin = async () => {
    if (!accessCode.trim()) {
      setErrorMessage("Access code is required.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const success = await login("resident", accessCode);
      if (success) {
        router.replace(nextPath);
        return;
      }

      setErrorMessage("Invalid access code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "calc(100vh - var(--nav-height))", background: "var(--off-white)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ maxWidth: "680px", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }} className="animate-slide-up">
          <div className="badge badge-teal" style={{ marginBottom: "16px" }}>SECURE ACCESS</div>
          <h2 style={{ fontSize: "2rem", marginBottom: "12px", color: "var(--text-heading)" }}>Urban Resident Sign In</h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "500px", margin: "0 auto", fontSize: "0.9rem" }}>
            Access is limited to Urban Resident accounts with a verified access code.
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
                Report flooding, view district risk, and receive verified civic alerts.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "18px" }}>
            {[
              "Resident-only secure entry",
              "Server-verified session cookie",
              "Session expiry + renewal support",
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

          <label
            htmlFor="resident-access-code"
            style={{
              display: "block",
              fontSize: "0.78rem",
              fontWeight: 700,
              color: "var(--text-muted)",
              marginBottom: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Access Code
          </label>
          <div style={{ position: "relative" }}>
            <KeyRound
              size={16}
              strokeWidth={1.8}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              id="resident-access-code"
              type="password"
              value={accessCode}
              onChange={(event) => {
                setAccessCode(event.target.value);
                if (errorMessage) {
                  setErrorMessage(null);
                }
              }}
              placeholder="Enter resident access code"
              style={{
                width: "100%",
                height: 46,
                borderRadius: 12,
                border: "1px solid var(--border)",
                padding: "0 12px 0 38px",
                fontSize: "0.9rem",
                outline: "none",
                background: "#ffffff",
              }}
            />
          </div>
          {errorMessage ? (
            <div style={{ color: "var(--danger)", marginTop: 10, fontSize: "0.8rem", fontWeight: 600 }}>
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div style={{ textAlign: "center" }} className="animate-fade-in">
          <button
            onClick={() => {
              void handleLogin();
            }}
            disabled={!accessCode.trim() || submitting}
            className="btn btn-primary btn-lg"
            style={{
              padding: "14px 40px",
              fontSize: "1rem",
              opacity: accessCode.trim() && !submitting ? 1 : 0.5,
              cursor: accessCode.trim() && !submitting ? "pointer" : "not-allowed",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {submitting ? "Verifying..." : "Enter HiveMind"} <ArrowRight size={18} strokeWidth={1.5} />
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


