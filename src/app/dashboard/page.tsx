"use client";

import { useState } from "react";
import { FiAward, FiShield, FiStar, FiTrendingUp, FiCheck, FiLock, FiGift } from "react-icons/fi";
import guardianData from "@/data/guardian-profiles.json";

type ProfileId = "fisherman" | "industry" | "citizen";

const TIER_COLORS: Record<string, string> = {
  "Gold Guardian": "var(--guardian-gold)",
  "Silver Guardian": "var(--guardian-silver)",
  "Bronze Guardian": "var(--guardian-bronze)",
};

const TYPE_ICONS: Record<string, string> = {
  report: "📋",
  trace_bonus: "🔍",
  clean_zone: "🌊",
  weekly_bonus: "📅",
  corroboration: "🤝",
  compliance: "✅",
  transparency: "📊",
  sponsorship: "💰",
  cleanup: "🧹",
  referral: "👥",
};

export default function DashboardPage() {
  const [activeProfile, setActiveProfile] = useState<ProfileId>("fisherman");

  const profile = guardianData.profiles.find((p) => p.id === activeProfile)!;
  const tierColor = TIER_COLORS[profile.tier] || "var(--teal)";

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 20px 80px" }}>
      {/* Header */}
      <header style={{ textAlign: "center", marginBottom: "32px" }}>
        <div className="badge badge-amber" style={{ marginBottom: "16px" }}>
          <FiAward /> Pillar 4 — Guardian Credits Dashboard
        </div>
        <h1 className="text-gradient">Guardian Earning Dashboard</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "8px", maxWidth: "600px", margin: "8px auto 0" }}>
          Government-backed credits redeemable for real benefits. Non-transferable, AI-verified, tamper-proof.
        </p>
      </header>

      {/* Profile Switcher */}
      <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "28px", flexWrap: "wrap" }}>
        {guardianData.profiles.map((p) => (
          <button
            key={p.id}
            className={activeProfile === p.id ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
            onClick={() => setActiveProfile(p.id as ProfileId)}
          >
            {p.avatar} {p.role}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: "20px", alignItems: "start" }}>
        {/* Left Column — Profile Card */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Profile Info */}
          <div className="glass-strong animate-slide-up" style={{ padding: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
              <div style={{ fontSize: "2.5rem" }}>{profile.avatar}</div>
              <div>
                <h3 style={{ fontSize: "1.15rem", marginBottom: "2px" }}>{profile.name}</h3>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{profile.role}</p>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{profile.location}</p>
              </div>
            </div>

            <div className="guardian-card" style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Guardian ID</span>
                <FiLock style={{ color: "var(--emerald)", fontSize: "0.8rem" }} />
              </div>
              <div className="zk-hash" style={{ display: "inline-block" }}>{profile.guardianId}</div>
            </div>

            {/* Credit Balance */}
            <div style={{ textAlign: "center", padding: "20px 0", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", marginBottom: "16px" }}>
              <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6px" }}>Guardian Credits</p>
              <h2 style={{ fontSize: "2.8rem", fontWeight: 900, fontFamily: "var(--font-mono)", color: "var(--guardian-gold)" }}>
                {profile.creditBalance.toLocaleString()}
              </h2>
              <div className="credit-badge" style={{ marginTop: "8px" }}>
                <FiStar /> {profile.tier}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "0.8rem" }}>
              <div className="glass" style={{ padding: "12px", textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: "1.2rem" }}>{profile.totalReports}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Total Reports</div>
              </div>
              <div className="glass" style={{ padding: "12px", textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: "1.2rem", color: "var(--emerald)" }}>{profile.verifiedReports}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Verified</div>
              </div>
            </div>

            <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "12px", textAlign: "center" }}>
              Member since {new Date(profile.memberSince).toLocaleDateString()}
            </p>
          </div>

          {/* Leaderboard */}
          <div className="glass animate-slide-up" style={{ padding: "20px", animationDelay: "0.1s" }}>
            <h4 style={{ fontSize: "0.9rem", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <FiTrendingUp style={{ color: "var(--teal)" }} /> Guardian Leaderboard
            </h4>
            {guardianData.leaderboard.map((entry) => (
              <div key={entry.rank} style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "8px 0",
                borderBottom: "1px solid var(--border-subtle)",
                opacity: profile.guardianId === entry.guardianId ? 1 : 0.7,
              }}>
                <span style={{ width: "24px", fontWeight: 800, fontSize: "0.85rem", color: entry.rank <= 3 ? "var(--guardian-gold)" : "var(--text-muted)" }}>
                  #{entry.rank}
                </span>
                <span className="zk-hash" style={{ fontSize: "0.65rem" }}>{entry.guardianId}</span>
                <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: "0.85rem", fontFamily: "var(--font-mono)", color: "var(--guardian-gold)" }}>
                  {entry.credits}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column — History + Redemptions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Redemptions */}
          <div className="glass-strong animate-slide-up" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "1rem", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <FiGift style={{ color: "var(--guardian-gold)" }} /> Redemption Marketplace
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {profile.redemptions.map((r) => (
                <div key={r.id} className="glass" style={{ padding: "16px", position: "relative", opacity: r.status === "locked" ? 0.5 : 1 }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>{r.icon}</div>
                  <h4 style={{ fontSize: "0.85rem", marginBottom: "4px" }}>{r.title}</h4>
                  <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "10px" }}>{r.category}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="credit-badge" style={{ fontSize: "0.65rem" }}>{r.cost} credits</span>
                    {r.status === "redeemed" ? (
                      <span className="badge badge-emerald"><FiCheck /> Redeemed</span>
                    ) : r.status === "locked" ? (
                      <span className="badge" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>🔒 Locked</span>
                    ) : (
                      <button className="btn btn-primary btn-sm" style={{ fontSize: "0.7rem", padding: "4px 10px" }}>Redeem</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Earning History */}
          <div className="glass-strong animate-slide-up" style={{ padding: "24px", animationDelay: "0.1s" }}>
            <h3 style={{ fontSize: "1rem", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <FiAward style={{ color: "var(--teal)" }} /> Earning History
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {profile.earningHistory.map((entry) => (
                <div key={entry.id} className="glass" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "1.2rem" }}>{TYPE_ICONS[entry.type] || "📋"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.85rem", fontWeight: 500, lineHeight: 1.3 }}>{entry.action}</p>
                    <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>
                      {new Date(entry.date).toLocaleDateString()} · {new Date(entry.date).toLocaleTimeString()}
                    </p>
                  </div>
                  <span style={{ fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--emerald)", fontSize: "0.95rem", flexShrink: 0 }}>
                    +{entry.credits}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Verification Banner */}
          <div className="glass animate-fade-in" style={{ padding: "14px 20px", textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", fontSize: "0.75rem", color: "var(--text-muted)", flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><FiShield style={{ color: "var(--teal)" }} /> Issued by OceanSentinel AI</span>
              <span>•</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><FiCheck style={{ color: "var(--emerald)" }} /> Verified</span>
              <span>•</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><FiLock style={{ color: "var(--blue)" }} /> Non-Transferable</span>
              <span>•</span>
              <span>Tamper-Proof</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
