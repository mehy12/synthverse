"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Map, Layers3, Shield } from "lucide-react";
import MobileApp from "@/components/mobile/MobileApp";

const MapView = dynamic(() => import("@/components/map/MapView"), {
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
      }}
    >
      <span className="animate-pulse" style={{ color: "var(--teal)", fontWeight: 700 }}>
        Loading clean map view...
      </span>
    </div>
  ),
});

export default function MapPage() {
  const searchParams = useSearchParams();
  const safeZoneMode = searchParams.get("safeZones") === "1";

  return (
    <>
      <div className="desktop-only" style={{ height: "calc(100vh - var(--nav-height))", position: "relative" }}>
        <MapView initialSafeZones={safeZoneMode} />

        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            background: "rgba(255,255,255,0.96)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "14px 16px",
            maxWidth: 320,
            boxShadow: "0 12px 24px rgba(0,0,0,0.08)",
            zIndex: 1200,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Map size={16} />
            <strong>Clean Map Mode</strong>
          </div>
          <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            This route keeps the map minimal. Open the full dashboard for flood-heavy intelligence panels.
          </p>
          <Link
            href="/map?safeZones=1"
            className="btn btn-teal btn-sm"
            style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "center" }}
          >
            <Shield size={14} strokeWidth={1.6} /> Open Safe Zone Routing
          </Link>
          {safeZoneMode && (
            <p style={{ margin: "10px 0 0", fontSize: "0.78rem", color: "var(--teal)", fontWeight: 700 }}>
              Safe Zone routing is active.
            </p>
          )}
          <Link
            href="/command-center"
            className="btn btn-teal btn-sm"
            style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <Layers3 size={14} /> Open Full Command Center
          </Link>
        </div>
      </div>

      <div className="mobile-only">
        <MobileApp initialTab="map" />
      </div>
    </>
  );
}
