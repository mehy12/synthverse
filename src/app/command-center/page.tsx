"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Suspense, useState } from "react";
import { Activity, Camera, Shield, MapPin, ChevronDown } from "lucide-react";
import MobileApp from "@/components/mobile/MobileApp";

const DeckMapView = dynamic(() => import("@/components/map/DeckMapView"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8f9fa",
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
  const [plannerScenario, setPlannerScenario] = useState<
    "blackout" | "flood_blackout" | "cyclone" | "earthquake" | "strike"
  >("blackout");
  const [summary, setSummary] = useState<{
    generatedAt: string;
    source: string;
    feedItems: FeedItem[];
    liveUpdatedAt: string;
  } | null>(null);

  return (
    <>
    <div className="desktop-only" style={{ height: "calc(100vh - var(--nav-height))", position: "relative", display: "flex" }}>
      {/* ── Left Panel ─────────────────────────────────────── */}
      <div
        style={{
          width: 400,
          minWidth: 400,
          height: "100%",
          background: "var(--white)",
          borderRight: "1px solid var(--border)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          zIndex: 1200,
        }}
      >
        {/* Top context section */}
        <div
          style={{ padding: "20px", borderBottom: "1px solid var(--border)" }}
        >
          <div
            style={{
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--text-muted)",
              fontWeight: 700,
              marginBottom: "12px",
            }}
          >
            COMMAND CENTER
          </div>

          <div style={{ marginBottom: "12px" }}>
            <span className="badge badge-teal" style={{ marginRight: 6 }}>
              📍 Odisha Corridor
            </span>
          </div>

          <h2
            style={{
              fontSize: "1.1rem",
              margin: 0,
              fontWeight: 700,
              color: "var(--text-heading)",
              marginBottom: "8px",
            }}
          >
            FloodMind Odisha Water Intelligence
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "0.82rem",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            Flood sensor data, evacuation zones, water infrastructure, and
            citizen anomaly reports in a single operational view.
          </p>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Link
              href="/live-feed"
              className="btn btn-primary btn-sm"
              style={{ flex: 1, justifyContent: "center" }}
            >
              <Activity size={14} strokeWidth={1.5} /> Open Live Feed
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

          <Link
            href="/map?safeZones=1"
            className="btn btn-teal btn-sm"
            style={{ marginTop: 8, width: "100%", justifyContent: "center", display: "inline-flex", gap: 8 }}
          >
            <Shield size={14} strokeWidth={1.6} /> Open Safe Zone Routing
          </Link>

          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-full)",
                background: "var(--teal-50)",
                color: "var(--teal-700)",
                fontSize: "0.7rem",
                fontWeight: 600,
              }}
            >
              Evacuation Zones: 5
            </span>
            <span
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-full)",
                background: "var(--teal-50)",
                color: "var(--teal-700)",
                fontSize: "0.7rem",
                fontWeight: 600,
              }}
            >
              Sensor Reports: Live
            </span>
          </div>
        </div>

        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-xl)",
              padding: "14px",
              background: "var(--off-white)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Camera size={14} strokeWidth={1.6} color="var(--teal)" />
              <strong style={{ fontSize: "0.84rem", color: "var(--text-heading)" }}>Reporting Moved To Dedicated Route</strong>
            </div>
            <p style={{ margin: 0, fontSize: "0.8rem", lineHeight: 1.5, color: "var(--text-secondary)" }}>
              Live camera + GPS field reporting now runs on a separate page for cleaner command center operations.
            </p>
            <Link
              href="/reporting"
              className="btn btn-teal btn-sm"
              style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
            >
              Open Reporting Desk
            </Link>
          </div>
        </div>

        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div
            style={{
              border: "1px solid #dce5ef",
              borderRadius: "18px",
              padding: "14px",
              background: "#ffffff",
              boxShadow: "0 12px 30px rgba(13, 38, 76, 0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: "#22c55e" }} />
              <strong style={{ fontSize: "0.95rem", color: "#0f172a", letterSpacing: "0.02em" }}>
                EMERGENCY ROUTE PLANNER
              </strong>
            </div>

            <button
              type="button"
              className="btn btn-sm"
              style={{
                width: "100%",
                justifyContent: "center",
                background: "#eff6ff",
                color: "#1d4ed8",
                border: "1px solid #93c5fd",
                marginBottom: 12,
              }}
            >
              <MapPin size={14} strokeWidth={1.7} /> Find My Location (Route From Here)
            </button>

            <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, letterSpacing: "0.08em" }}>
              INCIDENT EPICENTER (SUBSTATION)
            </div>
            <button
              type="button"
              style={{
                marginTop: 6,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #dbe4ef",
                background: "#ffffff",
                color: "#0f172a",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <span>Narendrapur (Berhampur)</span>
              <ChevronDown size={16} strokeWidth={1.8} color="#64748b" />
            </button>

            <div
              style={{
                marginTop: 12,
                fontSize: "0.72rem",
                color: "#64748b",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              SCENARIO
            </div>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { key: "blackout", label: "⚡ Grid Blackout", active: "#ef4444" },
                { key: "flood_blackout", label: "🌊 Flood + Blackout", active: "#2563eb" },
                { key: "cyclone", label: "🌀 Cyclone", active: "#7c3aed" },
                { key: "earthquake", label: "🏚 Earthquake", active: "#f97316" },
                { key: "strike", label: "💥 Strike / Attack", active: "#db2777" },
              ].map((scenario) => {
                const isActive = plannerScenario === scenario.key;
                return (
                  <button
                    key={scenario.key}
                    type="button"
                    onClick={() =>
                      setPlannerScenario(
                        scenario.key as
                          | "blackout"
                          | "flood_blackout"
                          | "cyclone"
                          | "earthquake"
                          | "strike",
                      )
                    }
                    style={{
                      gridColumn: scenario.key === "strike" ? "span 2" : "span 1",
                      padding: "10px 8px",
                      borderRadius: 12,
                      border: `1px solid ${isActive ? scenario.active : "#dbe4ef"}`,
                      background: isActive ? "#f8fafc" : "#ffffff",
                      color: isActive ? scenario.active : "#475569",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    {scenario.label}
                  </button>
                );
              })}
            </div>

            <Link
              href="/map?safeZones=1"
              className="btn btn-sm"
              style={{
                marginTop: 12,
                width: "100%",
                justifyContent: "center",
                background: "linear-gradient(135deg, #ef4444, #f97316)",
                color: "#ffffff",
                border: "none",
                fontWeight: 800,
              }}
            >
              🚨 Simulate & Find Nearest Shelter
            </Link>

            <button
              type="button"
              style={{
                marginTop: 8,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #dbe4ef",
                background: "#ffffff",
                color: "#4f46e5",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ➕ Add New Threat & Re-route
            </button>

            <button
              type="button"
              style={{
                marginTop: 8,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #dbe4ef",
                background: "#ffffff",
                color: "#334155",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              🚨 Debris Rescue Callout
            </button>

            <div style={{ marginTop: 14, borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
              <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, letterSpacing: "0.08em" }}>
                ROUTES (FROM EPICENTER)
              </div>

              <div
                style={{
                  marginTop: 10,
                  padding: "12px",
                  borderRadius: 14,
                  border: "1px solid #86efac",
                  background: "#f0fdf4",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, color: "#16a34a" }}>
                  <span>🟢 Primary Route</span>
                  <span>SELECTED ✓</span>
                </div>
                <div style={{ marginTop: 4, fontWeight: 800, color: "#14532d" }}>🏛 Berhampur Multi-Purpose Shelter</div>
                <div style={{ marginTop: 4, color: "#166534", fontSize: "0.8rem" }}>📏 70.0km · ⏱ ~59 min by road</div>
              </div>

              <div
                style={{
                  marginTop: 8,
                  padding: "12px",
                  borderRadius: 14,
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                }}
              >
                <div style={{ fontWeight: 800, color: "#2563eb" }}>🔵 Alternative 1</div>
                <div style={{ marginTop: 4, fontWeight: 700, color: "#1e3a8a" }}>🏢 Chilika Lakeside Emergency Camp</div>
                <div style={{ marginTop: 4, color: "#1d4ed8", fontSize: "0.8rem" }}>📏 80.8km · ⏱ ~1.1 hr by road</div>
              </div>

              <div
                style={{
                  marginTop: 8,
                  padding: "12px",
                  borderRadius: 14,
                  border: "1px solid #fde68a",
                  background: "#fffbeb",
                }}
              >
                <div style={{ fontWeight: 800, color: "#ca8a04" }}>🟡 Alternative 2</div>
                <div style={{ marginTop: 4, fontWeight: 700, color: "#854d0e" }}>🏫 Puri Government High School</div>
                <div style={{ marginTop: 4, color: "#a16207", fontSize: "0.8rem" }}>📏 166.4km · ⏱ ~2.3 hr by road</div>
              </div>

              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#ef4444", lineHeight: 1 }}>1</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Red Zones</div>
                </div>
                <div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#16a34a", lineHeight: 1 }}>20</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Safe Shelters</div>
                </div>
                <div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#ca8a04", lineHeight: 1 }}>0</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Re-routes</div>
                </div>
              </div>

              <button
                type="button"
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #facc15",
                  background: "#ffffff",
                  color: "#854d0e",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                🏛 Government Portal (Officials Only)
              </button>
            </div>
          </div>
        </div>

        {/* Live Feed section */}
        <div style={{ padding: "16px 20px", flex: 1 }}>
          <div
            style={{
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--text-muted)",
              fontWeight: 700,
              marginBottom: "12px",
            }}
          >
            LIVE FEED
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(summary?.feedItems || []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("neptune:focus-feed", { detail: item }),
                  )
                }
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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <strong
                    style={{
                      fontSize: "0.84rem",
                      color: "var(--text-heading)",
                    }}
                  >
                    {item.title}
                  </strong>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.meta}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: "0.78rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.45,
                  }}
                >
                  {item.detail}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: "0.72rem",
                    color: "var(--teal)",
                    fontWeight: 600,
                  }}
                >
                  Click to learn more
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom status */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            fontSize: "0.68rem",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "var(--radius-full)",
              background: "var(--safe)",
            }}
          />
          <span>
            Flood sensor feed • refreshing every 5 minutes •{" "}
            {summary?.source ?? "API status: Healthy"}
          </span>
        </div>
      </div>

      {/* ── Center Map ─────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative" }}>
        <Suspense fallback={<div>Loading Map...</div>}>
          <DeckMapView refreshKey={refreshKey} onSummaryChange={setSummary} />
        </Suspense>
      </div>
    </div>
    <div className="mobile-only">
      <MobileApp initialTab="map" />
    </div>
    </>
  );
}
