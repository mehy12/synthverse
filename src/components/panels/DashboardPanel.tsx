"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
import {
  Droplets,
  Gauge,
  ShieldAlert,
  X,
  Users,
  TrendingUp,
  Activity,
} from "lucide-react";
import { DistrictFeature, riskToLabel } from "@/data/odisha-geo";

interface DashboardPanelProps {
  selectedDistrict: DistrictFeature | null;
  onClose: () => void;
  timeHour: number;
  allDistricts: DistrictFeature[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const riskBadgeColors: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: {
    bg: "rgba(220, 38, 38, 0.15)",
    text: "#fca5a5",
    border: "rgba(220, 38, 38, 0.4)",
  },
  HIGH: {
    bg: "rgba(249, 115, 22, 0.15)",
    text: "#fdba74",
    border: "rgba(249, 115, 22, 0.4)",
  },
  MEDIUM: {
    bg: "rgba(234, 179, 8, 0.15)",
    text: "#fde047",
    border: "rgba(234, 179, 8, 0.4)",
  },
  LOW: {
    bg: "rgba(34, 197, 94, 0.15)",
    text: "#86efac",
    border: "rgba(34, 197, 94, 0.4)",
  },
};

// Custom Recharts tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.98)",
        border: "1px solid rgba(203, 213, 225, 1)",
        borderRadius: 3,
        padding: "8px 12px",
        fontSize: "0.72rem",
        color: "#1f2937",
        backdropFilter: "blur(10px)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color, display: "flex", gap: 6 }}>
          <span>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPanel({
  selectedDistrict,
  onClose,
  timeHour,
  allDistricts,
}: DashboardPanelProps) {
  // Summary stats
  const stats = useMemo(() => {
    const critical = allDistricts.filter((d) => d.riskScore >= 0.8).length;
    const high = allDistricts.filter(
      (d) => d.riskScore >= 0.6 && d.riskScore < 0.8
    ).length;
    const totalPop = allDistricts.reduce((s, d) => s + d.population, 0);
    const affectedPop = allDistricts
      .filter((d) => d.riskScore >= 0.6)
      .reduce((s, d) => s + d.population, 0);
    return { critical, high, totalPop, affectedPop };
  }, [allDistricts]);

  const rainfallData = useMemo(() => {
    if (!selectedDistrict) return [];
    return selectedDistrict.rainfall7d.map((val, idx) => ({
      day: DAYS[idx],
      rainfall: val,
    }));
  }, [selectedDistrict]);

  const waterLevelData = useMemo(() => {
    if (!selectedDistrict) return [];
    // Generate synthetic 24h water level data
    const base = selectedDistrict.waterLevel;
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, "0")}:00`,
      level: Math.max(
        0,
        base + Math.sin((i / 24) * Math.PI * 2) * 1.2 + (Math.random() - 0.5) * 0.3
      ),
      danger: selectedDistrict.dangerMark,
    }));
  }, [selectedDistrict]);

  const riskLabel = selectedDistrict
    ? riskToLabel(selectedDistrict.riskScore)
    : "";
  const riskBadge = riskBadgeColors[riskLabel] || riskBadgeColors.LOW;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "rgba(255, 255, 255, 0.98)",
        borderLeft: "1px solid rgba(226, 232, 240, 1)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(226, 232, 240, 1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(249, 250, 251, 0.95)",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.6rem",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "#6b7280",
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            INTELLIGENCE PANEL
          </div>
          <div
            style={{
              fontSize: "0.88rem",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Flood Operations Dashboard
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.65rem",
            color: "#10b981",
            fontWeight: 700,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#10b981",
              animation: "pulse 2s ease-in-out infinite",
            }}
          />{" "}
          LIVE
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1,
          background: "rgba(226, 232, 240, 1)",
          borderBottom: "1px solid rgba(226, 232, 240, 1)",
        }}
      >
        {[
          { label: "CRITICAL", value: stats.critical, color: "#ef4444" },
          { label: "HIGH RISK", value: stats.high, color: "#f59e0b" },
          {
            label: "AFFECTED",
            value: `${(stats.affectedPop / 1e6).toFixed(1)}M`,
            color: "#38bdf8",
          },
          {
            label: "SIM TIME",
            value: `T+${timeHour}h`,
            color: timeHour > 0 ? "#22d3ee" : "#64748b",
          },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              padding: "12px",
              background: "rgba(255, 255, 255, 1)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "0.55rem",
                color: "#6b7280",
                fontWeight: 700,
                letterSpacing: "0.08em",
                marginBottom: 4,
              }}
            >
              {stat.label}
            </div>
            <div
              style={{
                fontSize: "1.1rem",
                fontWeight: 800,
                color: stat.color,
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <AnimatePresence mode="wait">
          {selectedDistrict ? (
            <motion.div
              key={selectedDistrict.name}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* District Detail Card */}
              <div
                style={{
                  borderRadius: 4,
                  border: "1px solid rgba(226, 232, 240, 1)",
                  background: "rgba(255, 255, 255, 0.98)",
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "1rem",
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      {selectedDistrict.name}
                    </h3>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 4,
                      }}
                    >
                      <Users size={12} color="#64748b" />
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "#64748b",
                        }}
                      >
                        {selectedDistrict.population.toLocaleString()} pop.
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 3,
                        background: riskBadge.bg,
                        color: riskBadge.text,
                        border: `1px solid ${riskBadge.border}`,
                        fontSize: "0.65rem",
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                      }}
                    >
                      {riskLabel}
                    </span>
                    <button
                      onClick={onClose}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 24,
                        height: 24,
                        borderRadius: 3,
                        background: "rgba(241, 245, 249, 1)",
                        border: "none",
                        cursor: "pointer",
                        color: "#6b7280",
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>

                {/* Risk + water mini stats */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 3,
                      background: "rgba(248, 250, 252, 1)",
                      border: "1px solid rgba(226, 232, 240, 1)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <ShieldAlert size={12} color="#ef4444" />
                      <span
                        style={{ fontSize: "0.6rem", color: "#6b7280", fontWeight: 700 }}
                      >
                        RISK SCORE
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "1.3rem",
                        fontWeight: 800,
                        color: riskBadge.text,
                        fontFamily: "var(--font-mono, monospace)",
                      }}
                    >
                      {(selectedDistrict.riskScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 3,
                      background: "rgba(248, 250, 252, 1)",
                      border: "1px solid rgba(226, 232, 240, 1)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <Gauge size={12} color="#38bdf8" />
                      <span
                        style={{ fontSize: "0.6rem", color: "#6b7280", fontWeight: 700 }}
                      >
                        WATER LEVEL
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "1.3rem",
                        fontWeight: 800,
                        color:
                          selectedDistrict.waterLevel >= selectedDistrict.dangerMark
                            ? "#ef4444"
                            : "#38bdf8",
                        fontFamily: "var(--font-mono, monospace)",
                      }}
                    >
                      {selectedDistrict.waterLevel.toFixed(1)}m
                    </span>
                    <span
                      style={{
                        fontSize: "0.6rem",
                        color: "#6b7280",
                        marginLeft: 4,
                      }}
                    >
                      / {selectedDistrict.dangerMark}m
                    </span>
                  </div>
                </div>
              </div>

              {/* Rainfall Chart */}
              <div
                style={{
                  borderRadius: 4,
                  border: "1px solid rgba(226, 232, 240, 1)",
                  background: "rgba(255, 255, 255, 0.98)",
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <Droplets size={14} color="#38bdf8" />
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    7-Day Rainfall (mm)
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={rainfallData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(51, 65, 85, 0.3)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      axisLine={{ stroke: "rgba(51, 65, 85, 0.3)" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="rainfall"
                      name="Rainfall"
                      fill="#38bdf8"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Water Level Chart */}
              <div
                style={{
                  borderRadius: 4,
                  border: "1px solid rgba(226, 232, 240, 1)",
                  background: "rgba(255, 255, 255, 0.98)",
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <TrendingUp size={14} color="#22d3ee" />
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    24h Water Level
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={waterLevelData}>
                    <defs>
                      <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(51, 65, 85, 0.3)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 9, fill: "#64748b" }}
                      axisLine={{ stroke: "rgba(51, 65, 85, 0.3)" }}
                      tickLine={false}
                      interval={5}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine
                      y={selectedDistrict.dangerMark}
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: "Danger Mark",
                        position: "right",
                        fill: "#ef4444",
                        fontSize: 9,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="level"
                      name="Water Level"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      fill="url(#waterGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px 20px",
                textAlign: "center",
                flex: 1,
              }}
            >
              <Activity size={32} color="#334155" style={{ marginBottom: 16 }} />
              <p
                style={{
                  fontSize: "0.82rem",
                  color: "#475569",
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                Click a district on the map
              </p>
              <p style={{ fontSize: "0.72rem", color: "#334155" }}>
                View detailed rainfall, water levels, and risk analysis
              </p>

              {/* District risk ranking */}
              <div
                style={{
                  width: "100%",
                  marginTop: 24,
                  borderRadius: 4,
                  border: "1px solid rgba(226, 232, 240, 1)",
                  background: "rgba(255, 255, 255, 0.98)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid rgba(226, 232, 240, 1)",
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    textAlign: "left",
                  }}
                >
                  District Risk Ranking
                </div>
                {allDistricts
                  .sort((a, b) => b.riskScore - a.riskScore)
                  .slice(0, 8)
                  .map((d, i) => {
                    const label = riskToLabel(d.riskScore);
                    const badge = riskBadgeColors[label];
                    return (
                      <div
                        key={d.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 14px",
                          borderBottom:
                            i < 7
                              ? "1px solid rgba(226, 232, 240, 1)"
                              : "none",
                          fontSize: "0.72rem",
                        }}
                      >
                        <span
                          style={{
                            width: 18,
                            color: "#64748b",
                            fontWeight: 700,
                            fontFamily: "var(--font-mono, monospace)",
                            fontSize: "0.65rem",
                          }}
                        >
                          {i + 1}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            color: "#1f2937",
                            fontWeight: 500,
                          }}
                        >
                          {d.name}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono, monospace)",
                            color: badge.text,
                            fontWeight: 700,
                            fontSize: "0.68rem",
                          }}
                        >
                          {(d.riskScore * 100).toFixed(0)}%
                        </span>
                        <span
                          style={{
                            padding: "2px 6px",
                            borderRadius: 2,
                            background: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`,
                            fontSize: "0.55rem",
                            fontWeight: 800,
                          }}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "10px 16px",
          borderTop: "1px solid rgba(226, 232, 240, 1)",
          background: "rgba(255, 255, 255, 0.98)",
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.6rem",
          color: "#64748b",
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        <span>HiveMind FLOOD-INTEL v2.0</span>
        <span>COORDS: 20.296Â°N, 85.824Â°E</span>
      </div>
    </div>
  );
}

