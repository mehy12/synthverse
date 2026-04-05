import Link from "next/link";
import { ArrowRight, Map, Activity, Shield, Award, TrendingUp, Zap, Check, X, BarChart3, Radio } from "lucide-react";
import styles from "./page.module.css";
import MobileApp from "@/components/mobile/MobileApp";

export default function Home() {
  return (
    <>
    <div className={`desktop-only ${styles.container}`}>
      {/* ── Hero Section ─────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={`badge badge-teal animate-slide-up`}>
            <Zap size={12} strokeWidth={1.5} />
            <span>HACKATHON 2026</span>
          </div>
          <h1 className={`${styles.title} animate-slide-up`} style={{ animationDelay: "0.1s" }}>
            Urban Flooding Isn't A <br />
            <span className="text-teal">Reporting Problem</span>
          </h1>
          <p className={`${styles.subtitle} animate-slide-up`} style={{ animationDelay: "0.2s" }}>
            It's a prediction problem. Anyone can say "the streets are flooded." Nobody can
            predict which districts drown next, model the cascade, or coordinate the response.{" "}
            <strong style={{ color: "var(--teal)" }}>FloodMind does all three.</strong>
          </p>
          <div className={`${styles.ctaGroup} animate-slide-up`} style={{ animationDelay: "0.3s" }}>
            <Link href="/analytics" className="btn btn-primary btn-lg">
              <Activity size={18} strokeWidth={1.5} />
              Trigger Simulation
            </Link>
            <Link href="/command-center" className="btn btn-secondary btn-lg">
              Open Command Center <ArrowRight size={16} strokeWidth={1.5} />
            </Link>
          </div>
        </div>

        {/* ── Live Stats Bar ──────────────────────────────────── */}
        <div className={`${styles.statsGrid} animate-fade-in`} style={{ animationDelay: "0.5s" }}>
          <div className={styles.statCard}>
            <h3 style={{ color: "var(--danger)" }}>12</h3>
            <p>Active Threat Zones</p>
          </div>
          <div className={styles.statCard}>
            <h3 style={{ color: "var(--teal)" }}>24/7</h3>
            <p>Live Monitoring</p>
          </div>
          <div className={styles.statCard}>
            <h3 style={{ color: "var(--warning)" }}>847</h3>
            <p>Response Credits This Week</p>
          </div>
          <div className={styles.statCard}>
            <h3 style={{ color: "var(--danger)" }}>6</h3>
            <p>Districts At Risk</p>
          </div>
        </div>
      </section>

      {/* ── The Cascade Loop ──────────────────────────────────── */}
      <section className={styles.loopSection}>
        <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>The Cascade Loop</h2>
        <p className={styles.sectionSubtext}>
          Every stage of disaster response was fragmented before FloodMind. Now it's a closed loop.
        </p>
        <div className={styles.loopGrid}>
          {[
            { step: "01", label: "Detect", desc: "Real-time flood sensor data ingestion from across the urban grid", icon: <Radio size={24} strokeWidth={1.5} />, color: "var(--teal)" },
            { step: "02", label: "Predict", desc: "30/60/90 day cascade forecasting with district-level risk scoring", icon: <Activity size={24} strokeWidth={1.5} />, color: "var(--warning)" },
            { step: "03", label: "Respond", desc: "Automated evacuation zone mapping and emergency resource allocation", icon: <Shield size={24} strokeWidth={1.5} />, color: "var(--safe)" },
          ].map((item) => (
            <div key={item.step} className={`${styles.loopCard} animate-slide-up stagger-item`}>
              <div className={styles.stepNumber} style={{ color: item.color }}>{item.step}</div>
              <div className={styles.loopIcon} style={{ color: item.color }}>{item.icon}</div>
              <h3 className={styles.loopTitle}>{item.label}</h3>
              <p className={styles.loopDesc}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comparison: Why We Win ──────────────────────────────── */}
      <section className={styles.moatsSection}>
        <h2 style={{ textAlign: "center", marginBottom: "2rem" }}>Why FloodMind Wins</h2>
        <div className={styles.moatsGrid}>
          {[
            { bad: "Report flooding → nothing happens", good: "Report → emergency teams dispatched + responder rewarded" },
            { bad: "Show current water levels only", good: "Predict which districts flood in 30/60/90 days if nothing changes" },
            { bad: "Siloed sensor data across agencies", good: "Unified digital twin — every sensor, every district, one view" },
            { bad: "Residents have no incentive to report", good: "Response Credits for verified reports + priority evacuation access" },
          ].map((moat, i) => (
            <div key={i} className={`${styles.moatCard} animate-slide-up stagger-item`}>
              <div className={styles.moatBad}>
                <X size={16} strokeWidth={1.5} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }} />
                <span>{moat.bad}</span>
              </div>
              <div className={styles.moatArrow}>→</div>
              <div className={styles.moatGood}>
                <Check size={16} strokeWidth={1.5} style={{ color: "var(--safe)", flexShrink: 0, marginTop: 2 }} />
                <span>{moat.good}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3 Pillar Feature Cards ────────────────────────────── */}
      <section className={styles.features}>
        <h2 style={{ textAlign: "center", marginBottom: "2rem" }}>The 3 Pillars</h2>
        <div className={styles.featureGrid}>
          <Link href="/command-center" className={`${styles.featureCard} animate-slide-up stagger-item`}>
            <div className={styles.iconWrapper} style={{ background: "var(--teal-50)", color: "var(--teal)" }}>
              <Map size={20} strokeWidth={1.5} />
            </div>
            <h3 className={styles.featureTitle}>Command Center</h3>
            <p className={styles.featureDesc}>
              Live flood sensor map with district-level risk visualization. Real-time evacuation zone tracking and emergency resource deployment in a single operational view.
            </p>
            <span className={styles.cardCta}>View <ArrowRight size={14} strokeWidth={1.5} /></span>
          </Link>

          <Link href="/analytics" className={`${styles.featureCard} animate-slide-up stagger-item`}>
            <div className={styles.iconWrapper} style={{ background: "rgba(249, 115, 22, 0.08)", color: "var(--warning)" }}>
              <Activity size={20} strokeWidth={1.5} />
            </div>
            <h3 className={styles.featureTitle}>Cascade Forecast</h3>
            <p className={styles.featureDesc}>
              30/60/90 day district flood prediction. Interactive cascade timeline shows downstream impact propagation — and the economic cost in ₹ crore.
            </p>
            <span className={styles.cardCta}>View <ArrowRight size={14} strokeWidth={1.5} /></span>
          </Link>

          <Link href="/analytics" className={`${styles.featureCard} animate-slide-up stagger-item`}>
            <div className={styles.iconWrapper} style={{ background: "rgba(16, 185, 129, 0.08)", color: "var(--safe)" }}>
              <BarChart3 size={20} strokeWidth={1.5} />
            </div>
            <h3 className={styles.featureTitle}>Response Credits</h3>
            <p className={styles.featureDesc}>
              Government-backed rewards for verified flood reports. Responders earn priority access. Organizations earn resilience ratings. Citizens earn civic points.
            </p>
            <span className={styles.cardCta}>View <ArrowRight size={14} strokeWidth={1.5} /></span>
          </Link>

          <Link href="/command-center" className={`${styles.featureCard} animate-slide-up stagger-item`}>
            <div className={styles.iconWrapper} style={{ background: "var(--teal-50)", color: "var(--teal)" }}>
              <Radio size={20} strokeWidth={1.5} />
            </div>
            <h3 className={styles.featureTitle}>Flood Sensor Zones</h3>
            <p className={styles.featureDesc}>
              IoT-connected water level sensors deployed across critical urban infrastructure. Continuous monitoring of drainage systems, river gauges, and reservoir levels.
            </p>
            <span className={styles.cardCta}>View <ArrowRight size={14} strokeWidth={1.5} /></span>
          </Link>
        </div>
      </section>

      {/* ── Closing Pitch ─────────────────────────────────────── */}
      <section className={styles.closingSection}>
        <div className={styles.closingCard}>
          <blockquote className={styles.closingQuote}>
            "We turned raw sensor streams into a living digital twin — one that doesn't just show you the flood, but tells you where it's going, who's in danger, and what to do about it."
          </blockquote>
          <div style={{ display: "flex", gap: "12px", marginTop: "2rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/command-center" className="btn btn-primary btn-lg">
              <Map size={18} strokeWidth={1.5} /> Open Command Center
            </Link>
            <Link href="/analytics" className="btn btn-secondary btn-lg">
              <TrendingUp size={18} strokeWidth={1.5} /> Run Simulation
            </Link>
          </div>
        </div>
      </section>
    </div>
    <div className="mobile-only">
      <MobileApp initialTab="map" />
    </div>
    </>
  );
}
