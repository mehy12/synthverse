"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { FiCamera, FiTrendingUp } from "react-icons/fi";

// Dynamically import the map component with SSR disabled
// as Mapbox/Leaflet depends on window/browser APIs
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
        Initializing Live Map Engine...
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

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth <= 768);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div style={{ height: "calc(100vh - var(--nav-height))", position: "relative" }}>
      <Suspense fallback={<div>Loading Map...</div>}>
        <MapView refreshKey={refreshKey} onSummaryChange={setSummary} />
      </Suspense>

      {/* Top overlays: context card + live feed card */}
      <div
        style={{
          position: "absolute",
          top: isMobile ? 12 : 18,
          left: isMobile ? "50%" : 24,
          transform: isMobile ? "translateX(-50%)" : undefined,
          zIndex: 1200,
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? 10 : 12,
          alignItems: "flex-start",
          maxWidth: isMobile ? "calc(100vw - 24px)" : 440,
          width: isMobile ? "calc(100vw - 24px)" : undefined,
        }}
      >
        {/* Context + primary actions card */}
        <div
          style={{
            width: "100%",
            padding: isMobile ? "12px 14px" : "14px 18px",
            borderRadius: isMobile ? "18px" : "14px",
            background: isMobile ? "rgba(255, 255, 255, 0.88)" : "rgba(255, 255, 255, 0.9)",
            backdropFilter: isMobile ? "blur(18px)" : "blur(14px)",
            border: "1px solid var(--border-strong)",
            color: "var(--text-primary)",
            boxShadow: isMobile ? "0 18px 45px rgba(15,23,42,0.32)" : "0 16px 40px rgba(15,23,42,0.18)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "var(--text-secondary)",
                  marginBottom: 4,
                }}
              >
                Live Surface 
                
                
                
                
                
                

                • Kochi Coast
              </div>
              <h1 style={{ fontSize: "1.05rem", margin: 0, fontWeight: 600 }}>OceanSentinel Marine Intelligence</h1>
              <p
                style={{
                  margin: "6px 0 0 0",
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                River mouth risk, live fishing zones, and citizen anomaly reports streamed into a single operational view.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 150 }}>
              <Link
                href="/report"
                className="btn btn-primary btn-sm"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                }}
              >
                🛡 File Report
              </Link>
              <Link
                href="/detect"
                className="btn btn-secondary btn-sm"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                }}
              >
                <FiCamera /> AI Scan
              </Link>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 10,
              flexWrap: "wrap",
              fontSize: "0.72rem",
            }}
          >
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setRefreshKey((value) => value + 1)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                whiteSpace: "nowrap",
                minWidth: 120,
              }}
            >
              Scan Water
            </button>
            <span
              style={{
                padding: "4px 9px",
                borderRadius: 999,
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px solid rgba(245, 158, 11, 0.5)",
                color: "var(--amber)",
                fontFamily: "var(--font-mono)",
              }}
            >
              Fishing Zones: 5
            </span>
            <span
              style={{
                padding: "4px 9px",
                borderRadius: 999,
                background: "rgba(59, 130, 246, 0.08)",
                border: "1px solid rgba(59, 130, 246, 0.5)",
                color: "var(--blue)",
                fontFamily: "var(--font-mono)",
              }}
            >
              Citizen Reports: Live
            </span>
          </div>
        </div>

        {/* Live feed card just below */}
        <div
          style={{
            width: "100%",
            padding: isMobile ? "10px 14px" : "12px 16px",
            borderRadius: isMobile ? "18px" : "14px",
            background: isMobile ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.96)",
            backdropFilter: isMobile ? "blur(18px)" : "blur(14px)",
            border: "1px solid var(--border-strong)",
            color: "var(--text-primary)",
            boxShadow: isMobile ? "0 18px 45px rgba(15,23,42,0.32)" : "0 16px 40px rgba(15,23,42,0.18)",
          }}
        >
          <div
            style={{
              fontSize: "0.72rem",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--text-secondary)",
              marginBottom: 10,
            }}
          >
            Live Feed
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: isMobile ? 180 : 210, overflowY: "auto" }}>
            {(summary?.feedItems || []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("neptune:focus-feed", { detail: item }))}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.9)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                  boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <strong style={{ fontSize: "0.86rem" }}>{item.title}</strong>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{item.meta}</span>
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
      </div>

      {/* Bottom status strip */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 10,
          transform: "translateX(-50%)",
          zIndex: 1100,
          padding: "6px 14px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.92)",
          color: "var(--text-primary)",
          fontSize: "0.72rem",
          display: "flex",
          gap: 12,
          alignItems: "center",
          boxShadow: "0 10px 25px rgba(15,23,42,0.18)",
          border: "1px solid var(--border-strong)",
          backdropFilter: "blur(10px)",
        }}
      >
        <span style={{ opacity: 0.85 }}>Open‑Meteo marine feed • refreshing every 5 minutes</span>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "#22c55e",
            boxShadow: "0 0 0 4px rgba(34,197,94,0.35)",
          }}
        />
        <span style={{ opacity: 0.78 }}>{summary?.source ?? "API status: Healthy"}</span>
      </div>
    </div>
  );
}
