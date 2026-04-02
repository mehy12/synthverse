"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import speciesData from "@/data/species-graph.json";
import styles from "@/components/biodiversity/Biodiversity.module.css";
import { FiAlertTriangle, FiActivity, FiTrendingDown, FiClock, FiDollarSign } from "react-icons/fi";
import type { PredictionResult, SpeciesForecast } from "@/lib/prediction-model";

const SpeciesGraph = dynamic(() => import("@/components/biodiversity/SpeciesGraph"), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ width: "100%", height: "400px" }}></div>,
});

const POLLUTION_TYPES = [
  { value: "oil", label: "Oil Spill" },
  { value: "chemical", label: "Chemical Discharge" },
  { value: "sewage", label: "Sewage / Effluent" },
  { value: "plastic", label: "Plastic Debris" },
  { value: "agricultural", label: "Agricultural Runoff" },
  { value: "shipping", label: "Shipping Violation" },
  { value: "ghost_gear", label: "Ghost Gear / Nets" },
];

const STATUS_COLORS: Record<string, string> = {
  stable: "var(--emerald)",
  declining: "var(--amber)",
  critical: "var(--coral)",
  collapsed: "var(--red)",
};

export default function BiodiversityPage() {
  const [coralCover, setCoralCover] = useState(100);
  const [pollutionType, setPollutionType] = useState("oil");
  const [severity, setSeverity] = useState(3);
  const [surfaceArea, setSurfaceArea] = useState(2);
  const [durationDays, setDurationDays] = useState(1);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"graph" | "forecast">("graph");

  const getImpact = (cover: number) => {
    const scenario = speciesData.economicImpact.scenarios.reduce((prev, curr) =>
      Math.abs(curr.coralCover - cover) < Math.abs(prev.coralCover - cover) ? curr : prev
    );
    return scenario;
  };

  const currentImpact = getImpact(coralCover);

  const getCollapsed = () => {
    const collapsed = new Set<string>();
    const coralNode = speciesData.nodes.find(n => n.id === "coral");
    if (coralNode && coralCover <= coralNode.threshold) collapsed.add("coral");
    speciesData.cascadeRules.forEach(rule => {
      if (rule.trigger === "coral" && coralCover <= rule.threshold) {
        rule.affects.forEach(id => collapsed.add(id));
      } else if (collapsed.has(rule.trigger)) {
        rule.affects.forEach(id => collapsed.add(id));
      }
    });
    return Array.from(collapsed);
  };

  const collapsedIds = getCollapsed();

  const runPrediction = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ severity, pollutionType, surfaceAreaKm2: surfaceArea, durationDays }),
      });
      const data = await res.json();
      setPrediction(data);
      setViewMode("forecast");
    } catch (err) {
      console.error("Prediction failed", err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run prediction on parameter change with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (viewMode === "forecast") {
        runPrediction();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [severity, pollutionType, surfaceArea, durationDays]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="badge badge-purple" style={{ marginBottom: "12px" }}>
          <FiActivity /> Pillar 3 — Biodiversity Forecasting Engine
        </div>
        <h1 className="text-gradient">Biodiversity Cascade Predictor</h1>
        <p className={styles.subtitle}>
          Gulf of Mannar Species Dependency Map — 30/60/90 day forecasts using exponential decay models
        </p>
      </header>

      <div className={styles.content}>
        {/* Left Column - Controls */}
        <div className={styles.sidebar}>
          {/* View Toggle */}
          <div style={{ display: "flex", gap: "1px", border: "1px solid var(--border-subtle)" }}>
            <button
              className={viewMode === "graph" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
              style={{ flex: 1, borderRadius: 0 }}
              onClick={() => setViewMode("graph")}
            >
              Species Graph
            </button>
            <button
              className={viewMode === "forecast" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
              style={{ flex: 1, borderRadius: 0 }}
              onClick={() => { setViewMode("forecast"); runPrediction(); }}
            >
              AI Forecast
            </button>
          </div>

          {/* Coral Slider */}
          <div className={`${styles.card} glass`}>
            <h3>Interactive Stressor</h3>
            <p className={styles.label}>Coral Reef Cover (%)</p>
            <input type="range" className={styles.slider} min="0" max="100"
              value={coralCover} onChange={(e) => setCoralCover(Number(e.target.value))} />
            <div className={styles.sliderReadout}>
              <span>0% (Dead)</span>
              <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: coralCover < 60 ? "var(--coral)" : "var(--teal)" }}>
                {coralCover}%
              </span>
              <span>100% (Healthy)</span>
            </div>
            <div style={{ marginTop: "16px", padding: "12px", background: "rgba(220,38,38,0.05)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--red)", marginBottom: "8px" }}>
                <FiAlertTriangle /> <strong>Economic Impact</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Daily Loss:</span>
                <span className={styles.counter} style={{ color: coralCover < 60 ? "var(--coral)" : "var(--emerald)" }}>
                  ₹{currentImpact.totalDailyLoss.toLocaleString()}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "4px" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Fisheries:</span>
                <span style={{ fontWeight: "bold" }}>400 families</span>
              </div>
            </div>
          </div>

          {/* Prediction Parameters */}
          {viewMode === "forecast" && (
            <div className={`${styles.card} glass-strong animate-slide-up`}>
              <h3 style={{ marginBottom: "12px" }}>Prediction Parameters</h3>

              <p className={styles.label}>Pollution Type</p>
              <select
                value={pollutionType}
                onChange={(e) => setPollutionType(e.target.value)}
                style={{ width: "100%", padding: "8px", background: "#ffffff", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", fontSize: "0.85rem", marginBottom: "12px" }}
              >
                {POLLUTION_TYPES.map(pt => (
                  <option key={pt.value} value={pt.value}>{pt.label}</option>
                ))}
              </select>

              <p className={styles.label}>Severity (1–5)</p>
              <input type="range" className={styles.slider} min="1" max="5"
                value={severity} onChange={(e) => setSeverity(Number(e.target.value))} />
              <div className={styles.sliderReadout}>
                <span>Minimal</span>
                <span style={{ fontWeight: "bold", color: severity >= 4 ? "var(--red)" : "var(--text-primary)" }}>{severity}</span>
                <span>Catastrophic</span>
              </div>

              <p className={styles.label} style={{ marginTop: "12px" }}>Surface Area (km²)</p>
              <input type="range" className={styles.slider} min="0.5" max="20" step="0.5"
                value={surfaceArea} onChange={(e) => setSurfaceArea(Number(e.target.value))} />
              <div className={styles.sliderReadout}>
                <span>0.5 km²</span>
                <span style={{ fontWeight: "bold" }}>{surfaceArea} km²</span>
                <span>20 km²</span>
              </div>

              <p className={styles.label} style={{ marginTop: "12px" }}>Duration (days active)</p>
              <input type="range" className={styles.slider} min="1" max="90"
                value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} />
              <div className={styles.sliderReadout}>
                <span>1 day</span>
                <span style={{ fontWeight: "bold" }}>{durationDays} days</span>
                <span>90 days</span>
              </div>

              <button className="btn btn-primary" onClick={runPrediction}
                disabled={loading} style={{ width: "100%", marginTop: "16px" }}>
                {loading ? "Computing..." : "Run Prediction Model"}
              </button>
            </div>
          )}

          {/* Cascade Timeline */}
          <div className={`${styles.card} glass-strong animate-slide-up`} style={{ animationDelay: "0.2s" }}>
            <h3>Cascade Timeline</h3>
            {collapsedIds.length === 0 ? (
              <p style={{ color: "var(--emerald)" }}>Ecosystem stable at this coral cover level.</p>
            ) : (
              <ul className={styles.warningList}>
                {speciesData.cascadeRules.filter(r =>
                  (r.trigger === "coral" && coralCover <= r.threshold) ||
                  collapsedIds.includes(r.trigger)
                ).map((rule, idx) => (
                  <li key={idx}>
                    <span className={styles.delayBadge}>T+{rule.delay}d</span>
                    <p>{rule.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {viewMode === "graph" ? (
            <div className={`${styles.graphWrapper} glass-strong`}>
              <SpeciesGraph coralCover={coralCover} collapsedIds={collapsedIds} />
            </div>
          ) : prediction ? (
            <>
              {/* Summary Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", border: "1px solid var(--border-subtle)", background: "var(--border-subtle)" }}>
                {[
                  { label: "30-Day Loss", value: `₹${prediction.totalEconomicLoss30Crore} Cr`, color: "var(--amber)" },
                  { label: "60-Day Loss", value: `₹${prediction.totalEconomicLoss60Crore} Cr`, color: "var(--coral)" },
                  { label: "90-Day Loss", value: `₹${prediction.totalEconomicLoss90Crore} Cr`, color: "var(--red)" },
                ].map((s) => (
                  <div key={s.label} style={{ background: "#ffffff", padding: "16px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 900, fontFamily: "var(--font-mono)", color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Most Vulnerable + Cascade */}
              <div className="glass-strong" style={{ padding: "16px 20px", display: "flex", gap: "20px", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Most Vulnerable</div>
                  <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--red)" }}>{prediction.mostVulnerable}</div>
                </div>
                <div style={{ flex: 2 }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Species at Risk (90-day)</div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {prediction.cascadeChain.map(name => (
                      <span key={name} className="badge badge-coral">{name}</span>
                    ))}
                    {prediction.cascadeChain.length === 0 && <span className="badge badge-teal">All species stable</span>}
                  </div>
                </div>
              </div>

              {/* Intervention Benefit */}
              <div className="glass" style={{ padding: "16px 20px" }}>
                <h4 style={{ fontSize: "0.85rem", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <FiClock style={{ color: "var(--teal)" }} /> Intervention Impact
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "0.65rem", color: "var(--emerald)", fontWeight: 700, textTransform: "uppercase", marginBottom: "4px" }}>If Act Now</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{prediction.interventionBenefit.ifNow}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.65rem", color: "var(--amber)", fontWeight: 700, textTransform: "uppercase", marginBottom: "4px" }}>If Wait 30d</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{prediction.interventionBenefit.if30Days}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.65rem", color: "var(--red)", fontWeight: 700, textTransform: "uppercase", marginBottom: "4px" }}>If Wait 60d</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{prediction.interventionBenefit.if60Days}</div>
                  </div>
                </div>
              </div>

              {/* Species Table */}
              <div className="glass-strong" style={{ padding: "20px" }}>
                <h3 style={{ fontSize: "1rem", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <FiTrendingDown style={{ color: "var(--coral)" }} /> Species Forecast Table
                </h3>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--border-strong)", textAlign: "left" }}>
                        <th style={{ padding: "8px 6px", color: "var(--text-muted)", fontWeight: 600 }}>Species</th>
                        <th style={{ padding: "8px 6px", textAlign: "center", color: "var(--text-muted)" }}>Now</th>
                        <th style={{ padding: "8px 6px", textAlign: "center", color: "var(--text-muted)" }}>30d</th>
                        <th style={{ padding: "8px 6px", textAlign: "center", color: "var(--text-muted)" }}>60d</th>
                        <th style={{ padding: "8px 6px", textAlign: "center", color: "var(--text-muted)" }}>90d</th>
                        <th style={{ padding: "8px 6px", textAlign: "right", color: "var(--text-muted)" }}>Loss ₹</th>
                        <th style={{ padding: "8px 6px", textAlign: "right", color: "var(--text-muted)" }}>Recovery</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prediction.forecasts.map((f: SpeciesForecast) => (
                        <tr key={f.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "8px 6px", fontWeight: 600 }}>
                            <span style={{ marginRight: "6px" }}>{f.icon}</span>{f.name}
                          </td>
                          <td style={{ padding: "8px 6px", textAlign: "center", fontFamily: "var(--font-mono)" }}>
                            {f.baselinePopulation}%
                          </td>
                          <td style={{ padding: "8px 6px", textAlign: "center", fontFamily: "var(--font-mono)", color: STATUS_COLORS[f.status30] }}>
                            {f.day30}%
                          </td>
                          <td style={{ padding: "8px 6px", textAlign: "center", fontFamily: "var(--font-mono)", color: STATUS_COLORS[f.status60] }}>
                            {f.day60}%
                          </td>
                          <td style={{ padding: "8px 6px", textAlign: "center", fontFamily: "var(--font-mono)", color: STATUS_COLORS[f.status90], fontWeight: 700 }}>
                            {f.day90}%
                          </td>
                          <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--red)" }}>
                            {f.economicLoss90 > 100000 ? `₹${(f.economicLoss90 / 100000).toFixed(1)}L` : `₹${f.economicLoss90.toLocaleString()}`}
                          </td>
                          <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                            {f.recoveryTimeDays >= 3650 ? "Years" : `${f.recoveryTimeDays}d`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Population Bar Chart (inline SVG) */}
              <div className="glass-strong" style={{ padding: "20px" }}>
                <h3 style={{ fontSize: "1rem", marginBottom: "16px" }}>Population Decline Visualization</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {prediction.forecasts.map((f: SpeciesForecast) => (
                    <div key={f.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ width: "120px", fontSize: "0.75rem", fontWeight: 600, flexShrink: 0 }}>
                        {f.icon} {f.name.split(" ")[0]}
                      </span>
                      <div style={{ flex: 1, height: "20px", background: "var(--slate-100)", position: "relative", overflow: "hidden" }}>
                        {/* Baseline (100%) */}
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${f.day30}%`, background: "var(--amber)", opacity: 0.3 }} />
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${f.day60}%`, background: "var(--coral)", opacity: 0.3 }} />
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${f.day90}%`, background: STATUS_COLORS[f.status90], transition: "width 0.5s ease" }} />
                        <span style={{ position: "absolute", right: "4px", top: "2px", fontSize: "0.65rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: f.day90 < 50 ? "#fff" : "var(--text-primary)" }}>
                          {f.day90}%
                        </span>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: "16px", marginTop: "4px", fontSize: "0.65rem", color: "var(--text-muted)" }}>
                    <span>■ 90-day projection</span>
                    <span style={{ opacity: 0.5 }}>■ 60-day</span>
                    <span style={{ opacity: 0.3 }}>■ 30-day</span>
                  </div>
                </div>
              </div>

              {/* Model Info */}
              <div className="glass" style={{ padding: "12px 16px", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                <strong>Model:</strong> Species-specific exponential decay (λ) with cascade multipliers •
                <strong> Calibration:</strong> IUCN Red List LD50 data, GBIF Gulf of Mannar occurrences •
                <strong> Formula:</strong> P(t) = baseline × e^(-λ × pollution_index × t) •
                <strong> Datasets:</strong> CalCOFI (Kaggle), GBIF, Marine Litter DB
              </div>
            </>
          ) : (
            <div className={`${styles.graphWrapper} glass-strong`} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
                <FiActivity style={{ fontSize: "2rem", marginBottom: "12px" }} />
                <p>Click <strong>Run Prediction Model</strong> to generate 30/60/90 day forecasts</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
