/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Activity,
  MapPin,
  AlertTriangle,
  Clock,
  Users,
  Heart,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface HealthFacilityResult {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  typeLabel: string;
  district: string;
  capacityEstimate: number;
  priorityScore: number;
  distanceKm: number;
  etaMinutes: number;
}

interface DispatchResult {
  alert: { lat: number; lng: number; riskScore: number; districtName: string };
  severity: "critical" | "high" | "medium";
  predictedCasualties: number;
  nearestFacilities: HealthFacilityResult[];
  dispatchStatus: string;
  advisories: string[];
}

interface HealthPredictionPanelProps {
  visible: boolean;
  isDark: boolean;
  markedPoint: { lat: number; lng: number } | null;
  riskZones?: Array<{ lat: number; lng: number; riskScore: number; name: string }>;
  onFlyTo?: (lat: number, lng: number) => void;
}

const TYPE_ICONS: Record<string, string> = {
  "Sub-Center": "🏠",
  "Primary Health Centre": "🏥",
  "Community Health Centre": "🏨",
  "District Hospital": "🏛️",
  "State/Tertiary Hospital": "⭐",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#22c55e",
};

export default function HealthPredictionPanel({
  visible,
  isDark,
  markedPoint,
  riskZones = [],
  onFlyTo,
}: HealthPredictionPanelProps) {
  const [nearestFacilities, setNearestFacilities] = useState<HealthFacilityResult[]>([]);
  const [dispatches, setDispatches] = useState<DispatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"nearest" | "alerts">("nearest");
  const [stats, setStats] = useState<any>(null);
  const [expanded, setExpanded] = useState(true);

  // Colors
  const bg = isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.97)";
  const border = isDark ? "rgba(51, 65, 85, 0.4)" : "rgba(229, 231, 235, 1)";
  const text = isDark ? "#e2e8f0" : "#374151";
  const muted = isDark ? "#64748b" : "#9ca3af";
  const cardBg = isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(249, 250, 251, 1)";
  const accent = isDark ? "#38bdf8" : "#0ea5e9";

  // ── Fetch nearest facilities when marked point changes ─────────
  const fetchNearest = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/health-predict?lat=${lat}&lng=${lng}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setNearestFacilities(data.nearest || []);
        setStats(data.stats);
      }
    } catch (e) {
      console.error("Health predict error:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (markedPoint) {
      fetchNearest(markedPoint.lat, markedPoint.lng);
    }
  }, [markedPoint, fetchNearest]);

  // ── Run predictive dispatch for current risk zones ─────────────
  const runPredictiveDispatch = useCallback(async () => {
    if (!riskZones.length) return;
    setLoading(true);
    try {
      const alerts = riskZones
        .filter((z) => z.riskScore > 0.5)
        .slice(0, 10)
        .map((z) => ({
          lat: z.lat,
          lng: z.lng,
          riskScore: z.riskScore,
          districtName: z.name,
        }));

      const res = await fetch("/api/health-predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alerts }),
      });
      if (res.ok) {
        const data = await res.json();
        setDispatches(data.dispatches || []);
      }
    } catch (e) {
      console.error("Dispatch error:", e);
    }
    setLoading(false);
  }, [riskZones]);

  // Auto-run dispatch on mount if risizones exist
  useEffect(() => {
    if (riskZones.length > 0) {
      runPredictiveDispatch();
    }
  }, [riskZones.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        right: 16,
        zIndex: 100,
        width: 340,
        maxHeight: expanded ? 520 : 46,
        overflow: "hidden",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 14,
        backdropFilter: "blur(16px)",
        boxShadow: isDark
          ? "0 8px 32px rgba(0,0,0,0.5)"
          : "0 4px 20px rgba(0,0,0,0.1)",
        transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          cursor: "pointer",
          userSelect: "none",
          borderBottom: expanded ? `1px solid ${border}` : "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "0.68rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: muted,
          }}
        >
          <Heart size={14} color="#ef4444" />
          HEALTH PREDICTION ENGINE
          {loading && (
            <span style={{ color: accent, animation: "pulse 1s infinite" }}>
              ●
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown size={14} color={muted} />
        ) : (
          <ChevronUp size={14} color={muted} />
        )}
      </div>

      {/* Tabs */}
      {expanded && (
        <div style={{ padding: "8px 16px 0" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {(
              [
                ["nearest", "Nearest Center"],
                ["alerts", `Alerts (${dispatches.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  flex: 1,
                  padding: "6px",
                  borderRadius: 8,
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  background: activeTab === key ? accent : cardBg,
                  color: activeTab === key ? "#fff" : muted,
                  border: `1px solid ${border}`,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {expanded && (
        <div
          style={{
            padding: "12px 16px",
            overflowY: "auto",
            maxHeight: 400,
          }}
        >
          {/* ── NEAREST TAB ─────────────────────────────────── */}
          {activeTab === "nearest" && (
            <>
              {!markedPoint && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px 0",
                    color: muted,
                    fontSize: "0.8rem",
                  }}
                >
                  <MapPin
                    size={24}
                    style={{ margin: "0 auto 8px", display: "block" }}
                  />
                  Click the map to find the nearest health centers
                </div>
              )}

              {markedPoint && nearestFacilities.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {/* Stats bar */}
                  {stats && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        background: cardBg,
                        borderRadius: 8,
                        fontSize: "0.65rem",
                        color: muted,
                        marginBottom: 4,
                      }}
                    >
                      <span>
                        <strong style={{ color: text }}>
                          {stats.total?.toLocaleString()}
                        </strong>{" "}
                        facilities
                      </span>
                      <span>📍 {markedPoint.lat.toFixed(3)}, {markedPoint.lng.toFixed(3)}</span>
                    </div>
                  )}

                  {nearestFacilities.map((f, i) => (
                    <div
                      key={f.id}
                      onClick={() => onFlyTo?.(f.lat, f.lng)}
                      style={{
                        padding: "10px 12px",
                        background: i === 0
                          ? isDark
                            ? "rgba(16, 185, 129, 0.08)"
                            : "rgba(16, 185, 129, 0.05)"
                          : cardBg,
                        border: `1px solid ${i === 0 ? "rgba(16, 185, 129, 0.3)" : border}`,
                        borderRadius: 10,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 4,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              color: text,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            {TYPE_ICONS[f.typeLabel] || "🏥"} {f.name}
                          </div>
                          <div
                            style={{
                              fontSize: "0.65rem",
                              color: muted,
                              marginTop: 2,
                            }}
                          >
                            {f.typeLabel} · {f.district}
                          </div>
                        </div>
                        {i === 0 && (
                          <span
                            style={{
                              fontSize: "0.58rem",
                              fontWeight: 800,
                              color: "#10b981",
                              background: "rgba(16,185,129,0.1)",
                              padding: "2px 6px",
                              borderRadius: 4,
                              flexShrink: 0,
                            }}
                          >
                            CLOSEST
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          fontSize: "0.68rem",
                          color: muted,
                          marginTop: 4,
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <MapPin size={10} /> {f.distanceKm.toFixed(1)} km
                        </span>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Clock size={10} /> ~{f.etaMinutes} min
                        </span>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Users size={10} /> {f.capacityEstimate} beds
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── ALERTS TAB ──────────────────────────────────── */}
          {activeTab === "alerts" && (
            <>
              <button
                onClick={runPredictiveDispatch}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: 8,
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  background: loading ? muted : "#dc2626",
                  color: "#fff",
                  border: "none",
                  cursor: loading ? "wait" : "pointer",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Zap size={12} />{" "}
                {loading
                  ? "Analyzing..."
                  : "Run Predictive Health Dispatch"}
              </button>

              {dispatches.length === 0 && !loading && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "16px 0",
                    color: muted,
                    fontSize: "0.78rem",
                  }}
                >
                  <AlertTriangle
                    size={20}
                    style={{ margin: "0 auto 6px", display: "block" }}
                  />
                  No active dispatches. Run prediction to analyze risk zones.
                </div>
              )}

              {dispatches.map((d, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 12px",
                    background: cardBg,
                    border: `1px solid ${d.severity === "critical"
                        ? "rgba(239,68,68,0.3)"
                        : d.severity === "high"
                          ? "rgba(245,158,11,0.3)"
                          : border
                    }`,
                    borderRadius: 10,
                    marginBottom: 8,
                  }}
                >
                  {/* Severity header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.62rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: SEVERITY_COLORS[d.severity],
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Activity size={10} />
                      {d.severity} · {d.alert.districtName}
                    </span>
                    <span
                      style={{
                        fontSize: "0.58rem",
                        fontWeight: 700,
                        color: d.dispatchStatus === "auto_dispatched"
                          ? "#ef4444"
                          : "#f59e0b",
                        background:
                          d.dispatchStatus === "auto_dispatched"
                            ? "rgba(239,68,68,0.1)"
                            : "rgba(245,158,11,0.1)",
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {d.dispatchStatus === "auto_dispatched"
                        ? "🚨 DISPATCHED"
                        : "⏳ PENDING"}
                    </span>
                  </div>

                  {/* Predicted casualties */}
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: text,
                      fontWeight: 600,
                      marginBottom: 6,
                    }}
                  >
                    Predicted impact: ~{d.predictedCasualties} individuals
                  </div>

                  {/* Advisories */}
                  {d.advisories.map((adv, j) => (
                    <div
                      key={j}
                      style={{
                        fontSize: "0.68rem",
                        color: muted,
                        marginBottom: 3,
                        lineHeight: 1.4,
                        paddingLeft: 8,
                        borderLeft: `2px solid ${SEVERITY_COLORS[d.severity]}30`,
                      }}
                    >
                      {adv}
                    </div>
                  ))}

                  {/* Nearest facility */}
                  {d.nearestFacilities[0] && (
                    <div
                      onClick={() =>
                        onFlyTo?.(
                          d.nearestFacilities[0].lat,
                          d.nearestFacilities[0].lng,
                        )
                      }
                      style={{
                        marginTop: 8,
                        padding: "6px 8px",
                        background: isDark
                          ? "rgba(56,189,248,0.06)"
                          : "rgba(14,165,233,0.05)",
                        borderRadius: 6,
                        border: `1px solid ${isDark ? "rgba(56,189,248,0.2)" : "rgba(14,165,233,0.15)"}`,
                        cursor: "pointer",
                        fontSize: "0.68rem",
                        color: text,
                      }}
                    >
                      <strong>{d.nearestFacilities[0].name}</strong>
                      <span style={{ color: muted }}>
                        {" "}
                        · {d.nearestFacilities[0].distanceKm.toFixed(1)}km ·
                        ETA {d.nearestFacilities[0].etaMinutes}min
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
