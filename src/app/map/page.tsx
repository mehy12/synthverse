"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Suspense, useState } from "react";
import { Activity } from "lucide-react";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "calc(100vh - var(--nav-height))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <div className="skeleton" style={{ width: "100%", height: "100%" }} />
      <span
        style={{
          position: "absolute",
          color: "var(--teal)",
          fontWeight: "bold",
          fontSize: "0.9rem",
        }}
        className="animate-pulse"
      >
        Initializing Command Center...
      </span>
    </div>
  ),
});

type FeedItem = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  latitude?: number;
  longitude?: number;
};

export default function MapPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [summary, setSummary] = useState<{
    generatedAt: string;
    source: string;
    feedItems: FeedItem[];
    liveUpdatedAt: string;
  } | null>(null);


  return (
    <div style={{ height: "calc(100vh - var(--nav-height))", position: "relative", display: "flex" }}>
      {/* ── Left Panel ─────────────────────────────────────── */}
      <div style={{
        width: 400,
        minWidth: 400,
        height: "100%",
        background: "var(--white)",
        borderRight: "1px solid var(--border)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        zIndex: 1200,
      }}>
        {/* Top context section */}
        <div style={{ padding: "20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{
            fontSize: "0.65rem",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--text-muted)",
            fontWeight: 700,
            marginBottom: "12px",
          }}>
            COMMAND CENTER
          </div>

          <div style={{ marginBottom: "12px" }}>
            <span className="badge badge-teal" style={{ marginRight: 6 }}>📍 Kochi Metro</span>
          </div>

          <h2 style={{ fontSize: "1.1rem", margin: 0, fontWeight: 700, color: "var(--text-heading)", marginBottom: "8px" }}>
            FloodMind Urban Intelligence
          </h2>
          <p style={{
            margin: 0,
            fontSize: "0.82rem",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}>
            Flood sensor data, evacuation zones, and citizen anomaly reports in a single operational view.
          </p>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Link href="/analytics" className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }}>
              <Activity size={14} strokeWidth={1.5} /> Trigger Simulation
            </Link>
            <button
              type="button"
              className="btn btn-teal btn-sm"
              onClick={() => setRefreshKey((v) => v + 1)}
              style={{ flex: 1, justifyContent: "center" }}
            >
              Scan Flood Zone
            </button>
          </div>

          <div style={{
            display: "flex",
            gap: 6,
            marginTop: 12,
            flexWrap: "wrap",
          }}>
            <span style={{
              padding: "4px 10px",
              borderRadius: "var(--radius-full)",
              background: "var(--teal-50)",
              color: "var(--teal-700)",
              fontSize: "0.7rem",
              fontWeight: 600,
            }}>
              Evacuation Zones: 5
            </span>
            <span style={{
              padding: "4px 10px",
              borderRadius: "var(--radius-full)",
              background: "var(--teal-50)",
              color: "var(--teal-700)",
              fontSize: "0.7rem",
              fontWeight: 600,
            }}>
              Sensor Reports: Live
            </span>
          </div>
        </div>

        {/* Live Feed section */}
        <div style={{ padding: "16px 20px", flex: 1 }}>
          <div style={{
            fontSize: "0.65rem",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--text-muted)",
            fontWeight: 700,
            marginBottom: "12px",
          }}>
            LIVE FEED
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(summary?.feedItems || []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("neptune:focus-feed", { detail: item }))}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 14px",
                  borderRadius: "var(--radius-xl)",
                  background: "var(--white)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  transition: "border-color 0.2s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <strong style={{ fontSize: "0.84rem", color: "var(--text-heading)" }}>{item.title}</strong>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{item.meta}</span>
                </div>
                <div style={{ marginTop: 4, fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                  {item.detail}
                </div>
                <div style={{ marginTop: 6, fontSize: "0.72rem", color: "var(--teal)", fontWeight: 600 }}>
                  Click to learn more
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom status */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--border)",
          fontSize: "0.68rem",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: "var(--radius-full)",
            background: "var(--safe)",
          }} />
          <span>Flood sensor feed • refreshing every 5 minutes • {summary?.source ?? "API status: Healthy"}</span>
        </div>
      </div>

      {/* ── Center Map ─────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative" }}>
        <Suspense fallback={<div>Loading Map...</div>}>
          <MapView refreshKey={refreshKey} onSummaryChange={setSummary} />
        </Suspense>
      </div>
    </div>
  );
}
