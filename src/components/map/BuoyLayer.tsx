"use client";

import { useEffect, useRef, useMemo } from "react";
import { Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { BuoyState } from "@/hooks/useBuoySimulation";

// ─── Buoy boat icon: glowing dot + pulse ring ──────────────────────────────

function makeBuoyIcon(selected: boolean) {
  const coreColor = selected ? "#0ea5e9" : "#64748b";
  const glowColor = selected ? "rgba(14,165,233,0.7)" : "rgba(100,116,139,0.4)";
  const pulseColor = selected ? "rgba(14,165,233,0.25)" : "rgba(100,116,139,0.15)";
  return L.divIcon({
    html: `
      <div style="position:relative;width:24px;height:24px;cursor:pointer;">
        <div style="
          position:absolute;inset:0;
          border-radius:50%;
          background:${pulseColor};
          animation:buoyPulse 2s ease-out infinite;
        "></div>
        <div style="
          position:absolute;top:6px;left:6px;
          width:12px;height:12px;
          border-radius:50%;
          background:${coreColor};
          border:2px solid #ffffff;
          box-shadow:0 0 12px ${glowColor};
        "></div>
      </div>
    `,
    className: "transparent-icon",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// ─── Trail color by health score ────────────────────────────────────────────

function healthColor(score: number): string {
  if (score >= 70) return "#10B981";   // green
  if (score >= 50) return "#F59E0B";   // amber
  return "#DC2626";                     // red
}

// ─── Component ──────────────────────────────────────────────────────────────

interface BuoyLayerProps {
  buoy: BuoyState;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export default function BuoyLayer({ buoy, selected = false, onSelect }: BuoyLayerProps) {
  const markerRef = useRef<L.Marker | null>(null);
  const initialPos = useRef<[number, number]>([buoy.lat, buoy.lng]);

  const icon = useMemo(() => makeBuoyIcon(selected), [selected]);

  // Smoothly move existing marker instead of re-rendering properties 60fps
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng([buoy.lat, buoy.lng]);
    }
  }, [buoy.lat, buoy.lng]);

  // Build trail segments (each segment colored by health)
  const trailSegments: { positions: [number, number][]; color: string }[] = [];
  if (selected && buoy.trail.length >= 2) {
    for (let i = 0; i < buoy.trail.length - 1; i++) {
      const p1 = buoy.trail[i];
      const p2 = buoy.trail[i + 1];
      const avgScore = (p1.healthScore + p2.healthScore) / 2;
      trailSegments.push({
        positions: [
          [p1.lat, p1.lng],
          [p2.lat, p2.lng],
        ],
        color: healthColor(avgScore),
      });
    }
  }

  // Fade opacity: older segments are more transparent
  const now = Date.now();
  const trailDuration = 10 * 60 * 1000;

  return (
    <>
      {/* Color-coded dotted trail — only when selected */}
      {trailSegments.map((seg, i) => {
        const age = now - buoy.trail[i].timestamp;
        const opacity = Math.max(0.2, 1 - age / trailDuration);
        return (
          <Polyline
            key={`trail-${buoy.id}-${i}`}
            positions={seg.positions}
            pathOptions={{
              color: seg.color,
              weight: 3,
              opacity,
              dashArray: "6 8",
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        );
      })}

      {/* Buoy marker */}
      <Marker
        position={initialPos.current}
        icon={icon}
        ref={markerRef}
        eventHandlers={{
          click: () => onSelect?.(buoy.id),
        }}
      >
        <Tooltip
          direction="top"
          offset={[0, -14]}
          opacity={1}
          className="buoy-tooltip"
          sticky
        >
          <div style={{
            background: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(12px) saturate(180%)",
            padding: "12px 14px",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.4)",
            color: "#1e293b",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            minWidth: "190px",
            fontFamily: "'Inter', sans-serif",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "#0f172a", letterSpacing: "-0.01em" }}>
                {buoy.name}
              </span>
              <div style={{ 
                background: buoy.sensors.healthScore < 70 ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                color: healthColor(buoy.sensors.healthScore),
                padding: "2px 6px",
                borderRadius: "4px",
                fontSize: "0.65rem",
                fontWeight: 700,
                border: `1px solid ${healthColor(buoy.sensors.healthScore)}33`
              }}>
                {buoy.sensors.healthScore < 70 ? "POLLUTED" : "HEALTHY"}
              </div>
            </div>

            <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: "10px", display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ opacity: 0.8 }}>📍</span> {buoy.currentZoneLabel}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "4px" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.6rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>pH Level</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>{buoy.sensors.pH}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.6rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Dissolved O₂</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>{buoy.sensors.dissolvedO2}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.6rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Turbidity</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>{buoy.sensors.turbidity} <span style={{fontSize: "0.6rem", fontWeight: 500}}>NTU</span></span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.6rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Temp</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>{buoy.sensors.temperature}°C</span>
              </div>
            </div>

            {!selected && (
              <div style={{ 
                marginTop: "10px", 
                fontSize: "0.68rem", 
                textAlign: "center", 
                color: "#14b8a6", 
                fontWeight: 600,
                paddingTop: "8px",
                borderTop: "1px solid rgba(0,0,0,0.05)"
              }}>
                Tap to view analytics →
              </div>
            )}
          </div>
        </Tooltip>
      </Marker>
    </>
  );
}
