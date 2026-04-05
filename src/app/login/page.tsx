"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, UserRole } from "@/context/AuthContext";
import { Shield, Radio, User, ArrowRight, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);

  useEffect(() => {
    if (user) {
      router.push("/map");
    }
  }, [user, router]);

  if (user) {
    return null;
  }

  const handleLogin = () => {
    if (selectedRole) {
      login(selectedRole);
      router.push("/map");
    }
  };

  const roles = [
    {
      id: "responder",
      title: "First Responder",
      desc: "Access live flood data and coordinate emergency deployment across districts.",
      icon: <Radio size={24} strokeWidth={1.5} />,
      color: "var(--teal)",
      benefits: ["Priority alerts", "Evacuation tools", "Response Credits"]
    },
    {
      id: "coordinator",
      title: "District Coordinator",
      desc: "Monitor district-level telemetry and manage flood mitigation resources.",
      icon: <Shield size={24} strokeWidth={1.5} />,
      color: "var(--warning)",
      benefits: ["Threat monitoring", "Sensor oversight", "AI cascade reports"]
    },
    {
      id: "resident",
      title: "Urban Resident",
      desc: "Report flooding, track your district risk, and earn civic response credits.",
      icon: <User size={24} strokeWidth={1.5} />,
      color: "var(--safe)",
      benefits: ["Community rank", "Civic awards", "Priority evacuation"]
    },
  ];

  return (
    <div style={{ minHeight: "calc(100vh - var(--nav-height))", background: "var(--off-white)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ maxWidth: "900px", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }} className="animate-slide-up">
          <div className="badge badge-teal" style={{ marginBottom: "16px" }}>SECURE ACCESS</div>
          <h2 style={{ fontSize: "2rem", marginBottom: "12px", color: "var(--text-heading)" }}>Choose Your Perspective</h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "500px", margin: "0 auto", fontSize: "0.9rem" }}>
            Select your role to access role-specific tools and the HiveMind command center.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "40px" }}>
          {roles.map((role, idx) => (
            <div
              key={role.id}
              onClick={() => setSelectedRole(role.id as UserRole)}
              className="card animate-slide-up stagger-item"
              style={{
                padding: "28px",
                cursor: "pointer",
                border: selectedRole === role.id ? `2px solid ${role.color}` : "1px solid var(--border)",
                transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                animationDelay: `${idx * 0.1}s`,
              }}
            >
              <div style={{ 
                width: "44px", 
                height: "44px", 
                borderRadius: "var(--radius-lg)", 
                background: selectedRole === role.id ? role.color : "var(--off-white)", 
                color: selectedRole === role.id ? "#fff" : role.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
                transition: "all 0.3s"
              }}>
                {role.icon}
              </div>
              <h3 style={{ marginBottom: "6px", fontSize: "1rem", fontWeight: 600, color: selectedRole === role.id ? role.color : "var(--text-heading)" }}>{role.title}</h3>
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "16px", lineHeight: 1.5 }}>{role.desc}</p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {role.benefits.map(benefit => (
                  <div key={benefit} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)" }}>
                    <CheckCircle size={14} strokeWidth={1.5} style={{ color: selectedRole === role.id ? role.color : "var(--text-muted)" }} />
                    {benefit}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center" }} className="animate-fade-in">
          <button
            onClick={handleLogin}
            disabled={!selectedRole}
            className="btn btn-primary btn-lg"
            style={{ 
              padding: "14px 40px", 
              fontSize: "1rem", 
              opacity: selectedRole ? 1 : 0.5,
              cursor: selectedRole ? "pointer" : "not-allowed",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            Enter HiveMind <ArrowRight size={18} strokeWidth={1.5} />
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


