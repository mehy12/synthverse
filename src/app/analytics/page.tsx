"use client";

import { useState, useEffect, useCallback } from "react";
import districtData from "@/data/species-graph.json";
import styles from "@/components/biodiversity/Biodiversity.module.css";
import { AlertTriangle, Activity, TrendingDown, Clock, Zap, MapPin } from "lucide-react";
import type { PredictionResult, SpeciesForecast } from "@/lib/prediction-model";
import MobileApp from "@/components/mobile/MobileApp";

const FLOOD_TYPES = [
  { value: "flash_flood", label: "Flash Flood" },
  { value: "river_overflow", label: "River Overflow" },
  { value: "storm_surge", label: "Storm Surge" },
  { value: "drainage_failure", label: "Urban Drainage Failure" },
  { value: "dam_release", label: "Dam Release Surge" },
  { value: "monsoon_surge", label: "Monsoon Surge" },
  { value: "coastal_erosion", label: "Coastal Erosion" },
];

const STATUS_COLORS: Record<string, string> = {
  stable: "var(--safe)",
  declining: "var(--warning)",
  critical: "var(--danger)",
  collapsed: "#991B1B",
};

export default function AnalyticsPage() {
  const [floodType, setFloodType] = useState("flash_flood");
  const [severity, setSeverity] = useState(3);
  const [surfaceArea, setSurfaceArea] = useState(2);
  const [durationDays, setDurationDays] = useState(1);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);



  const runPrediction = useCallback(async () => {
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ severity, pollutionType: floodType, surfaceAreaKm2: surfaceArea, durationDays }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      
      const data = await res.json();
      setPrediction(data);
    } catch (err) {
      console.error("Prediction failed", err);
      setPrediction(null); // Clear to show fallback
    } finally {
      setLoading(false);
    }
  }, [severity, floodType, surfaceArea, durationDays]);

  // Disabled auto-fetch on mount to prevent network timeouts from blocking render
  // useEffect(() => {
  //   runPrediction();
  // }, [runPrediction]);

  useEffect(() => {
    const interval = setInterval(() => {
      runPrediction();
    }, 30000); // 30 second refresh
    return () => clearInterval(interval);
  }, [runPrediction]);

  return (
    <>
    <div className={`desktop-only ${styles.container}`}>
      <header className={styles.header}>
        <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "16px" }}>
          <div className="badge badge-teal">
            <Zap size={12} strokeWidth={1.5} /> AI Forecasting Engine
          </div>
          <div className="badge badge-teal">
            <MapPin size={12} strokeWidth={1.5} /> Kochi Urban Districts
          </div>
        </div>
        <h2 style={{ fontSize: "2.5rem", marginBottom: "8px", fontWeight: 700, color: "var(--teal)" }}>Cascade Forecast</h2>
        <p className={styles.subtitle}>
          Predicting 30/60/90 day flood cascade impacts across Kochi&apos;s urban districts and infrastructure.
        </p>
      </header>

      <div className={styles.content}>
        {/* Left Column - Controls */}
        <div className={styles.sidebar}>
          
          <div className={`card animate-slide-up`}>
            <h3 style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px", fontSize: "1rem", fontWeight: 600 }}>
              <Activity size={18} strokeWidth={1.5} style={{ color: "var(--teal)" }} /> Flood Parameters
            </h3>

            <p className={styles.label}>Flood Category</p>
            <select
              value={floodType}
              onChange={(e) => setFloodType(e.target.value)}
              className={styles.select}
            >
              {FLOOD_TYPES.map(ft => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>

            <p className={styles.label}>Severity (Impact Index)</p>
            <input type="range" className={styles.slider} min="1" max="5"
              value={severity} onChange={(e) => setSeverity(Number(e.target.value))} />
            <div className={styles.sliderReadout}>
              <span>Minimal</span>
              <span style={{ fontWeight: 800, color: "var(--teal)", fontSize: "1.1rem" }}>L-{severity}</span>
              <span>Extreme</span>
            </div>

            <p className={styles.label}>Affected Area (km²)</p>
            <input type="range" className={styles.slider} min="0.5" max="20" step="0.5"
              value={surfaceArea} onChange={(e) => setSurfaceArea(Number(e.target.value))} />
            <div className={styles.sliderReadout}>
              <span>0.5 km²</span>
              <span style={{ fontWeight: 800 }}>{surfaceArea} km²</span>
              <span>20 km²</span>
            </div>

            <p className={styles.label}>Active Duration (Days)</p>
            <input type="range" className={styles.slider} min="1" max="90"
              value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} />
            <div className={styles.sliderReadout}>
              <span>1 day</span>
              <span style={{ fontWeight: 800 }}>{durationDays} days</span>
              <span>90 days</span>
            </div>

            <button className="btn btn-primary" onClick={runPrediction}
              disabled={loading} style={{ width: "100%", padding: "12px", marginTop: "8px", borderRadius: "var(--radius-lg)", fontWeight: 600 }}>
              {loading ? "Simulating..." : "Recalculate Forecast"}
            </button>
          </div>

          {/* Cascade Timeline */}
          {prediction && (
            <div className={`card animate-slide-up`} style={{ animationDelay: "0.2s" }}>
              <h3 style={{ marginBottom: "16px", fontSize: "1rem", fontWeight: 600 }}>Trigger Timeline</h3>
              <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                {districtData.cascadeRules.map((rule, idx) => (
                  <li key={idx} style={{ 
                    padding: "12px", 
                    borderRadius: "var(--radius-lg)", 
                    borderLeft: "4px solid var(--danger)",
                    background: "var(--off-white)"
                  }}>
                    <div style={{ marginBottom: "6px" }}>
                      <span className="badge badge-danger" style={{ fontSize: "0.6rem" }}>T+{rule.delay}d Trigger</span>
                    </div>
                    <p style={{ fontSize: "0.78rem", margin: 0, lineHeight: 1.5, fontWeight: 600, color: "var(--text-primary)" }}>{rule.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right Column - Results */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {prediction ? (
            <>
              {/* Summary Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                {[
                  { label: "Infrastructure Loss (30d)", value: `₹${prediction.totalEconomicLoss30Crore} Cr`, color: "var(--warning)", desc: "Drainage & Roads" },
                  { label: "District Risk (60d)", value: `₹${prediction.totalEconomicLoss60Crore} Cr`, color: "var(--danger)", desc: "Residential Damage" },
                  { label: "Cascade Total (90d)", value: `₹${prediction.totalEconomicLoss90Crore} Cr`, color: "#991B1B", desc: "Full Urban Impact" },
                ].map((s) => (
                  <div key={s.label} className="card" style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px", fontWeight: 700 }}>{s.label}</div>
                    <div style={{ fontSize: "1.875rem", fontWeight: 700, color: s.color, marginBottom: "6px" }}>{s.value}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 500 }}>{s.desc}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "16px" }}>
                {/* District Table */}
                <div className="card" style={{ padding: "24px" }}>
                  <h3 style={{ fontSize: "1.1rem", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px", fontWeight: 700 }}>
                    <TrendingDown size={18} strokeWidth={1.5} style={{ color: "var(--danger)" }} /> District Cascade Forecast
                  </h3>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                          <th style={{ padding: "10px 8px", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>District</th>
                          <th style={{ padding: "10px 8px", textAlign: "center", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Current</th>
                          <th style={{ padding: "10px 8px", textAlign: "center", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>30d</th>
                          <th style={{ padding: "10px 8px", textAlign: "center", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>60d</th>
                          <th style={{ padding: "10px 8px", textAlign: "center", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>90d</th>
                          <th style={{ padding: "10px 8px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Econ-Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prediction.forecasts.map((f: SpeciesForecast) => (
                          <tr key={f.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "12px 8px", fontWeight: 600, color: "var(--text-heading)" }}>
                              <span style={{ marginRight: "8px" }}>{f.icon}</span>{f.name}
                            </td>
                            <td style={{ padding: "12px 8px", textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                              {f.baselinePopulation}%
                            </td>
                            <td style={{ padding: "12px 8px", textAlign: "center", fontFamily: "var(--font-mono)", color: STATUS_COLORS[f.status30], fontWeight: 700 }}>
                              {f.day30}%
                            </td>
                            <td style={{ padding: "12px 8px", textAlign: "center", fontFamily: "var(--font-mono)", color: STATUS_COLORS[f.status60], fontWeight: 700 }}>
                              {f.day60}%
                            </td>
                            <td style={{ padding: "12px 8px", textAlign: "center", fontFamily: "var(--font-mono)", color: STATUS_COLORS[f.status90], fontWeight: 900 }}>
                              {f.day90}%
                            </td>
                            <td style={{ padding: "12px 8px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--danger)", fontWeight: 700 }}>
                              ₹{f.economicLoss90 > 100000 ? `${(f.economicLoss90 / 100000).toFixed(1)}L` : f.economicLoss90.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Primary Risk Card */}
                  <div className="card" style={{ border: "1px solid var(--warning)", background: "rgba(249, 115, 22, 0.03)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--warning)", marginBottom: "14px" }}>
                      <AlertTriangle size={20} strokeWidth={1.5} />
                      <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--warning)" }}>Primary Risk</h4>
                    </div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--danger)", marginBottom: "8px" }}>{prediction.mostVulnerable}</div>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      Under current severity levels, {prediction.mostVulnerable} shows the highest rate of flood escalation, triggering potential complete inundation within the cascade forecast window.
                    </p>
                  </div>

                  {/* Intervention Card */}
                  <div className="card" style={{ border: "1px solid var(--teal)" }}>
                    <h4 style={{ fontSize: "1rem", marginBottom: "14px", display: "flex", alignItems: "center", gap: "10px", fontWeight: 700 }}>
                      <Clock size={18} strokeWidth={1.5} style={{ color: "var(--teal)" }} /> Intervention Window
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      <div>
                        <span className="badge badge-safe" style={{ fontSize: "0.6rem", marginBottom: "6px" }}>IMMEDIATE</span>
                        <div style={{ fontSize: "0.82rem", fontWeight: 600, marginTop: "4px", color: "var(--text-primary)" }}>{prediction.interventionBenefit.ifNow}</div>
                      </div>
                      <div style={{ opacity: 0.7 }}>
                        <span className="badge badge-danger" style={{ fontSize: "0.6rem", marginBottom: "6px" }}>DELAYED</span>
                        <div style={{ fontSize: "0.82rem", fontWeight: 600, marginTop: "4px", color: "var(--text-primary)" }}>{prediction.interventionBenefit.if60Days}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Model Info */}
              <div className="card" style={{ padding: "16px 24px", fontSize: "0.78rem", color: "var(--text-secondary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>Prediction Model:</strong> Exponential Risk Escalation (Kochi-Urban Calibrated) • 
                  <strong> Data:</strong> IMD Kerala Rainfall, CWC River Gauges, KSEB Dam Levels
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <span className="badge badge-teal">Kochi Metro</span>
                  <span className="badge badge-teal">Periyar Basin</span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }} className="card">
               <div style={{ textAlign: "center" }}>
                 <h3 style={{ opacity: 0.3 }}>Initializing Cascade Forecast Engine...</h3>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
    <div className="mobile-only">
      <MobileApp initialTab="analytics" />
    </div>
    </>
  );
}
