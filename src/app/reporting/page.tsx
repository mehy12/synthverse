"use client";

import Link from "next/link";
import { Camera, Map, ShieldCheck } from "lucide-react";
import LiveReportPanel from "@/components/reporting/LiveReportPanel";
import MobileApp from "@/components/mobile/MobileApp";

export default function ReportingPage() {
  return (
    <>
      <div
        className="desktop-only"
        style={{
          minHeight: "calc(100vh - var(--nav-height))",
          background: "linear-gradient(180deg, #f8fbfb 0%, #f3f7f8 100%)",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 1320, margin: "0 auto", display: "grid", gridTemplateColumns: "360px 1fr", gap: 18 }}>
          <aside className="card" style={{ height: "fit-content" }}>
            <div className="badge badge-teal" style={{ marginBottom: 12 }}>
              <Camera size={12} strokeWidth={1.6} /> LIVE REPORTING
            </div>
            <h2 style={{ marginBottom: 10 }}>Field Reporting Desk</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: 1.6, marginBottom: 14 }}>
              Capture ground truth reports with camera evidence and live GPS to strengthen flood response quality.
            </p>

            <div style={{ display: "grid", gap: 10 }}>
              <div className="card-muted" style={{ padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <ShieldCheck size={14} strokeWidth={1.7} color="var(--safe)" />
                  <strong style={{ fontSize: "0.83rem" }}>Authenticity Checks</strong>
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>GPS + camera metadata verification before dispatch.</span>
              </div>

              <div className="card-muted" style={{ padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Map size={14} strokeWidth={1.7} color="var(--teal)" />
                  <strong style={{ fontSize: "0.83rem" }}>Command Center Sync</strong>
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Each verified report appears immediately in the command center feed.</span>
              </div>
            </div>

            <Link href="/command-center" className="btn btn-secondary" style={{ marginTop: 14, width: "100%", justifyContent: "center" }}>
              Back To Command Center
            </Link>
          </aside>

          <section className="card" style={{ padding: 0, overflow: "hidden" }}>
            <LiveReportPanel />
          </section>
        </div>
      </div>

      <div className="mobile-only">
        <MobileApp initialTab="report" />
      </div>
    </>
  );
}
