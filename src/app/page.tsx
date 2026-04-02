import Link from "next/link";
import { FiArrowRight, FiMap, FiCamera, FiTrendingUp, FiActivity, FiShield, FiAward, FiBookOpen, FiCheck, FiX } from "react-icons/fi";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      {/* ── Hero Section ─────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={`badge badge-teal animate-slide-up`} style={{ marginBottom: "1.25rem" }}>
            <span>🛡 ADVAYA 2.0 Finalist</span>
          </div>
          <h1 className={`${styles.title} animate-slide-up`} style={{ animationDelay: "0.1s" }}>
            Marine Pollution Isn't A <br />
            <span className="text-gradient">Reporting Problem</span>
          </h1>
          <p className={`${styles.subtitle} animate-slide-up`} style={{ animationDelay: "0.2s" }}>
            It's a tracing problem. Anyone can say "the water is dirty." Nobody can prove who
            caused it, predict what dies next, or reward the people who protect it.{" "}
            <strong style={{ color: "var(--teal-light)" }}>OceanSentinel does all three.</strong>
          </p>
          <div className={`${styles.ctaGroup} animate-slide-up`} style={{ animationDelay: "0.3s" }}>
            <Link href="/report" className="btn btn-primary btn-lg">
              <FiShield /> File Anonymous Report
            </Link>
            <Link href="/map" className="btn btn-secondary btn-lg">
              Open Live Map <FiArrowRight />
            </Link>
          </div>
        </div>

        {/* ── Live Stats Bar ──────────────────────────────────── */}
        <div className={`${styles.statsGrid} animate-fade-in`} style={{ animationDelay: "0.5s" }}>
          <div className={`${styles.statCard} glass`}>
            <h3 style={{ color: "var(--red)" }}>12</h3>
            <p>Active Threat Zones</p>
          </div>
          <div className={`${styles.statCard} glass`}>
            <h3 style={{ color: "var(--amber-light)" }}>847</h3>
            <p>Guardian Credits This Week</p>
          </div>
          <div className={`${styles.statCard} glass`}>
            <h3 style={{ color: "var(--teal-light)" }}>94.2%</h3>
            <p>AI Trace Accuracy</p>
          </div>
          <div className={`${styles.statCard} glass`}>
            <h3 style={{ color: "var(--coral)" }}>6</h3>
            <p>Species At Risk</p>
          </div>
        </div>
      </section>

      {/* ── The Loop ──────────────────────────────────────────── */}
      <section className={styles.loopSection}>
        <h2 className="text-gradient" style={{ textAlign: "center", marginBottom: "0.5rem" }}>The Closed Loop</h2>
        <p style={{ textAlign: "center", color: "var(--text-secondary)", marginBottom: "2.5rem", maxWidth: "600px", margin: "0 auto 2.5rem auto" }}>
          Every part of this loop was broken before OceanSentinel. Now it's closed.
        </p>
        <div className={styles.loopGrid}>
          {[
            { step: "01", label: "Report", desc: "Anonymous, encrypted, zero-knowledge", icon: <FiShield />, color: "var(--teal)" },
            { step: "02", label: "Trace", desc: "AI reverses ocean currents to find the source", icon: <FiTrendingUp />, color: "var(--blue)" },
            { step: "03", label: "Predict", desc: "30/60/90 day species loss forecast", icon: <FiActivity />, color: "var(--purple)" },
            { step: "04", label: "Reward", desc: "Guardian Credits redeemable for govt benefits", icon: <FiAward />, color: "var(--guardian-gold)" },
          ].map((item) => (
            <div key={item.step} className={`${styles.loopCard} glass animate-slide-up stagger-item`}>
              <div className={styles.stepNumber} style={{ color: item.color }}>{item.step}</div>
              <div className={styles.loopIcon} style={{ color: item.color }}>{item.icon}</div>
              <h3>{item.label}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4 Moats — Why We Win ──────────────────────────────── */}
      <section className={styles.moatsSection}>
        <h2 className="text-gradient" style={{ textAlign: "center", marginBottom: "2.5rem" }}>Why OceanSentinel Wins</h2>
        <div className={styles.moatsGrid}>
          {[
            { bad: "Report pollution → nothing happens", good: "Report → AI traces source → authority notified + reporter rewarded" },
            { bad: "Show current pollution levels", good: "Predict which species die in 30/60/90 days if nothing changes" },
            { bad: "Fear of reporting — identity exposed", good: "Zero-knowledge anonymous reports — cryptographically safe" },
            { bad: "Fishermen have no incentive to engage", good: "Govt scheme credits for verified reports + clean-zone fishing licenses" },
          ].map((moat, i) => (
            <div key={i} className={`${styles.moatCard} glass-strong animate-slide-up stagger-item`}>
              <div className={styles.moatBad}>
                <FiX style={{ color: "var(--red)", flexShrink: 0 }} />
                <span>{moat.bad}</span>
              </div>
              <div className={styles.moatArrow}>→</div>
              <div className={styles.moatGood}>
                <FiCheck style={{ color: "var(--emerald)", flexShrink: 0 }} />
                <span>{moat.good}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4 Pillar Feature Cards ────────────────────────────── */}
      <section className={styles.features}>
        <h2 className="text-gradient" style={{ textAlign: "center", marginBottom: "2.5rem" }}>The 4 Pillars</h2>
        <div className={styles.featureGrid}>
          <Link href="/report" className={`${styles.featureCard} glass-strong animate-slide-up stagger-item`}>
            <div className={styles.iconWrapper} style={{ background: "rgba(20, 184, 166, 0.15)", color: "var(--teal-light)" }}>
              <FiShield className="icon" />
            </div>
            <h3>Anonymous Reporting</h3>
            <p>Zero-knowledge proof identity. End-to-end encrypted media. Persistent Guardian ID without exposure. Even we can't identify you.</p>
            <span className={styles.cardCta}>File Report <FiArrowRight /></span>
          </Link>

          <Link href="/tracer" className={`${styles.featureCard} glass-strong animate-slide-up stagger-item`}>
            <div className={styles.iconWrapper} style={{ background: "rgba(59, 130, 246, 0.15)", color: "var(--ocean-300)" }}>
              <FiTrendingUp className="icon" />
            </div>
            <h3>Root Cause AI</h3>
            <p>Reverse-current dispersion model traces pollution to its source. Cross-references discharge permits, AIS vessel logs, and historical data.</p>
            <span className={styles.cardCta}>Run Trace <FiArrowRight /></span>
          </Link>

          <Link href="/biodiversity" className={`${styles.featureCard} glass-strong animate-slide-up stagger-item`}>
            <div className={styles.iconWrapper} style={{ background: "rgba(139, 92, 246, 0.15)", color: "var(--purple-light)" }}>
              <FiActivity className="icon" />
            </div>
            <h3>Biodiversity Forecast</h3>
            <p>30/60/90 day species loss prediction. Interactive dependency graph shows cascade timeline — and the economic cost in ₹ crore.</p>
            <span className={styles.cardCta}>View Forecast <FiArrowRight /></span>
          </Link>

          <Link href="/dashboard" className={`${styles.featureCard} glass-strong animate-slide-up stagger-item`}>
            <div className={styles.iconWrapper} style={{ background: "rgba(245, 166, 35, 0.15)", color: "var(--guardian-gold)" }}>
              <FiAward className="icon" />
            </div>
            <h3>Guardian Credits</h3>
            <p>Government-backed rewards. Fishermen earn fishing licenses. Industries earn green ratings. Citizens earn Swachh Bharat points.</p>
            <span className={styles.cardCta}>Open Dashboard <FiArrowRight /></span>
          </Link>
        </div>
      </section>

      {/* ── Closing Pitch ─────────────────────────────────────── */}
      <section className={styles.closingSection}>
        <div className={`${styles.closingCard} glass-strong animate-fade-in`}>
          <blockquote className={styles.closingQuote}>
            "We turned the person who knows the most about ocean health — the fisherman who watches it die every day — into the person most financially incentivized to protect it."
          </blockquote>
          <div style={{ display: "flex", gap: "12px", marginTop: "2rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/map" className="btn btn-primary btn-lg">
              <FiMap /> Explore Live Map
            </Link>
            <Link href="/ledger" className="btn btn-secondary btn-lg">
              <FiBookOpen /> View Public Ledger
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
