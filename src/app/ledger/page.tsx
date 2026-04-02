"use client";

import { useState } from "react";
import { FiBookOpen, FiShield, FiCheck, FiAlertTriangle, FiClock, FiSearch, FiCode } from "react-icons/fi";
import auditLog from "@/data/audit-log.json";

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  resolved: { label: "Resolved", color: "var(--emerald)", bg: "rgba(16, 185, 129, 0.12)" },
  investigating: { label: "Investigating", color: "var(--amber)", bg: "rgba(245, 158, 11, 0.12)" },
  authority_notified: { label: "Authority Notified", color: "var(--blue)", bg: "rgba(59, 130, 246, 0.12)" },
};

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  report_filed: { label: "Pollution Report", icon: "🛡" },
  compliance_verified: { label: "Compliance Verified", icon: "✅" },
  cleanup_event: { label: "Cleanup Event", icon: "🧹" },
  biodiversity_alert: { label: "Biodiversity Alert", icon: "🌊" },
  buoy_alert: { label: "IoT Buoy Alert", icon: "📡" },
};

export default function LedgerPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showEmbed, setShowEmbed] = useState(false);

  const filtered = auditLog.filter((entry) => {
    const matchesSearch = search === "" || entry.title.toLowerCase().includes(search.toLowerCase()) || entry.hash.includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: auditLog.length,
    active: auditLog.filter((e) => e.status === "investigating" || e.status === "authority_notified").length,
    resolved: auditLog.filter((e) => e.status === "resolved").length,
    credits: auditLog.reduce((sum, e) => sum + e.actions.filter((a) => a.type === "credits_issued").length * 50, 0),
  };

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 20px 80px" }}>
      {/* Header */}
      <header style={{ textAlign: "center", marginBottom: "32px" }}>
        <div className="badge badge-blue" style={{ marginBottom: "16px" }}>
          <FiBookOpen /> Public Transparency Layer
        </div>
        <h1 className="text-gradient">Public Audit Ledger</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "8px", maxWidth: "600px", margin: "8px auto 0" }}>
          Immutable record of every report, trace, credit, and authority action. Transparent but anonymous — authorities cannot suppress reports.
        </p>
      </header>

      {/* Stats Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Total Entries", value: stats.total, color: "var(--text-primary)" },
          { label: "Active Investigations", value: stats.active, color: "var(--amber)" },
          { label: "Resolved", value: stats.resolved, color: "var(--emerald)" },
          { label: "Credits Issued", value: `${stats.credits}+`, color: "var(--guardian-gold)" },
        ].map((s) => (
          <div key={s.label} className="glass" style={{ padding: "16px", textAlign: "center" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 900, fontFamily: "var(--font-mono)", color: s.color }}>{s.value}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "2px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-strong" style={{ padding: "16px 20px", marginBottom: "20px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "200px" }}>
          <FiSearch style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Search by title or hash..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: "0.9rem", width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {["all", "investigating", "authority_notified", "resolved"].map((s) => (
            <button
              key={s}
              className={statusFilter === s ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
              onClick={() => setStatusFilter(s)}
              style={{ fontSize: "0.7rem", padding: "4px 10px" }}
            >
              {s === "all" ? "All" : (STATUS_STYLES[s]?.label || s)}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowEmbed(!showEmbed)} style={{ fontSize: "0.7rem" }}>
          <FiCode /> Embed
        </button>
      </div>

      {showEmbed && (
        <div className="glass animate-slide-up" style={{ padding: "16px 20px", marginBottom: "20px", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--teal)", wordBreak: "break-all" }}>
          {`<iframe src="${typeof window !== 'undefined' ? window.location.origin : ''}/ledger" width="100%" height="600" frameborder="0" />`}
        </div>
      )}

      {/* Ledger Entries */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filtered.map((entry) => {
          const statusStyle = STATUS_STYLES[entry.status] || STATUS_STYLES.investigating;
          const typeInfo = TYPE_LABELS[entry.type] || { label: entry.type, icon: "📋" };

          return (
            <div key={entry.id} className="glass-strong animate-slide-up" style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "12px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "1.1rem" }}>{typeInfo.icon}</span>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 600 }}>{entry.title}</h3>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span className="badge" style={{ background: typeInfo.icon === "📡" ? "rgba(59,130,246,0.12)" : "rgba(20,184,166,0.12)", color: "var(--teal)", fontSize: "0.65rem" }}>{typeInfo.label}</span>
                    <span className="badge" style={{ background: statusStyle.bg, color: statusStyle.color, fontSize: "0.65rem" }}>{statusStyle.label}</span>
                    {entry.severity > 0 && (
                      <span className="badge" style={{ background: `rgba(${entry.severity >= 4 ? '239,68,68' : entry.severity >= 3 ? '245,158,11' : '16,185,129'},0.12)`, color: entry.severity >= 4 ? "var(--red)" : entry.severity >= 3 ? "var(--amber)" : "var(--emerald)", fontSize: "0.65rem" }}>
                        Severity {entry.severity}/5
                      </span>
                    )}
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{entry.zone}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div className="zk-hash" style={{ fontSize: "0.6rem", marginBottom: "4px" }}>0x{entry.hash}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                    <FiClock /> {new Date(entry.timestamp).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Action Timeline */}
              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
                {entry.actions.map((action, i) => (
                  <div key={i} style={{ display: "flex", gap: "10px", padding: "6px 0", alignItems: "flex-start" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", marginTop: "6px", flexShrink: 0, background: action.type === "resolved" ? "var(--emerald)" : action.type === "authority_notified" ? "var(--blue)" : action.type === "credits_issued" ? "var(--guardian-gold)" : "var(--teal)" }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>{action.detail}</p>
                      <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>{new Date(action.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid var(--border-subtle)" }}>
                <FiShield style={{ color: "var(--teal)", fontSize: "0.75rem" }} />
                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                  Guardian: <span className="zk-hash" style={{ fontSize: "0.6rem" }}>{entry.guardianId}</span>
                </span>
                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                  {entry.latitude.toFixed(2)}°N, {entry.longitude.toFixed(2)}°E
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="glass" style={{ padding: "14px 20px", marginTop: "20px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", fontSize: "0.75rem", color: "var(--text-muted)", flexWrap: "wrap" }}>
          <span><FiShield style={{ verticalAlign: "middle", color: "var(--teal)" }} /> Immutable Audit Ledger</span>
          <span>•</span>
          <span>Public Read-Only API</span>
          <span>•</span>
          <span>Embeddable Widget</span>
          <span>•</span>
          <span><FiAlertTriangle style={{ verticalAlign: "middle", color: "var(--amber)" }} /> Authorities cannot suppress entries</span>
        </div>
      </div>
    </div>
  );
}
