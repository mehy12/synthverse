"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, MapPin, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";

type FeedReport = {
  id: string;
  latitude: number;
  longitude: number;
  type: string;
  severity: number | null;
  title: string | null;
  description: string | null;
  imageBase64: string | null;
  verificationScore: number | null;
  verificationStatus: string | null;
  aiConfidence: number | null;
  timestamp: string;
};

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function severityLabel(level: number | null) {
  if (!level) return "N/A";
  if (level >= 5) return "Critical";
  if (level >= 4) return "High";
  if (level >= 3) return "Moderate";
  if (level >= 2) return "Low";
  return "Info";
}

export default function LiveFeedPage() {
  const [reports, setReports] = useState<FeedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      setError(null);
      const response = await fetch("/api/reports", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load live feed at the moment.");
      }
      const data = (await response.json()) as FeedReport[];
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load reports.";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadReports();

    const interval = window.setInterval(() => {
      void loadReports(true);
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  const totals = useMemo(() => {
    const critical = reports.filter((report) => (report.severity ?? 0) >= 5).length;
    const high = reports.filter((report) => (report.severity ?? 0) === 4).length;
    return { total: reports.length, critical, high };
  }, [reports]);

  return (
    <main style={{ minHeight: "calc(100vh - var(--nav-height))", background: "#f4f8f9", padding: "20px" }}>
      <section style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="badge badge-teal" style={{ marginBottom: 8 }}>
              <Activity size={12} strokeWidth={1.5} /> PUBLIC LIVE FEED
            </div>
            <h1 style={{ margin: 0, fontSize: "1.9rem", color: "var(--text-heading)" }}>Reporting Ledger</h1>
            <p style={{ margin: "8px 0 0", color: "var(--text-secondary)" }}>
              Open public stream of all submitted flood reports.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => void loadReports(true)} disabled={refreshing}>
              <RefreshCw size={16} strokeWidth={1.6} className={refreshing ? "animate-pulse" : undefined} />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
            <Link href="/reporting" className="btn btn-teal">Open Reporting Desk</Link>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total Reports</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: 6 }}>{totals.total}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Critical</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: 6, color: "var(--danger)" }}>{totals.critical}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>High Risk</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: 6, color: "var(--warning)" }}>{totals.high}</div>
          </div>
        </div>

        {error ? (
          <div className="card" style={{ marginTop: 14, border: "1px solid rgba(239,68,68,0.28)", background: "rgba(254,242,242,0.9)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#991b1b", fontWeight: 700 }}>
              <TriangleAlert size={16} strokeWidth={1.8} /> Live feed unavailable
            </div>
            <p style={{ margin: "8px 0 0", color: "#7f1d1d" }}>{error}</p>
          </div>
        ) : null}

        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          {loading ? (
            <div className="card" style={{ padding: 18, color: "var(--text-secondary)" }}>Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="card" style={{ padding: 18, color: "var(--text-secondary)" }}>No reports yet.</div>
          ) : (
            reports.map((report) => (
              <article key={report.id} className="card" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, padding: 12 }}>
                <div style={{ borderRadius: 12, overflow: "hidden", minHeight: 130, background: "#0f172a" }}>
                  {report.imageBase64 ? (
                    <img src={report.imageBase64} alt={report.title ?? "Report image"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#cbd5e1" }}>
                      No image
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0, color: "var(--text-heading)" }}>{report.title || `${report.type} report`}</h3>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span className="badge badge-danger">{severityLabel(report.severity)}</span>
                      <span className="badge badge-teal">{report.type}</span>
                    </div>
                  </div>

                  <p style={{ margin: "8px 0", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {report.description || "No additional description."}
                  </p>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <MapPin size={14} strokeWidth={1.7} /> {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                    </span>
                    <span>{formatTime(report.timestamp)}</span>
                    <span>AI Confidence: {report.aiConfidence ?? 0}%</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <ShieldCheck size={14} strokeWidth={1.7} /> Verify: {report.verificationScore ?? 0}
                    </span>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
