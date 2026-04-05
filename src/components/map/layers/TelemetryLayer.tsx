"use client";

import { Marker, Popup, CircleMarker, Tooltip } from "react-leaflet";
import L from "leaflet";

interface TelemetryLayerProps {
  showEvacZones: boolean;
  liveZones: any[];
  probeSnapshot: { lat: number; lng: number; data: any } | null;
  enableProbe: boolean;
  onFocusTarget: (target: { lat: number; lng: number; zoom?: number }) => void;
}

function getFloodReadinessColor(score: number): string {
  if (score >= 70) return "#10B981";
  if (score >= 50) return "#F97316";
  return "#EF4444";
}

function getFloodReadinessStatus(score: number): string {
  if (score >= 70) return "Safe";
  if (score >= 50) return "Warning";
  return "Critical";
}

export default function TelemetryLayer({
  showEvacZones,
  liveZones,
  probeSnapshot,
  enableProbe,
  onFocusTarget,
}: TelemetryLayerProps) {
  
  const probeIcon = L.divIcon({
    html: '<div style="width:14px;height:14px;border-radius:50%;background:#0EA5E9;border:2px solid white;box-shadow:0 0 0 4px rgba(14,165,233,0.35);"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    className: "transparent-icon",
  });

  return (
    <>
      {/* Water Health Probe Marker */}
      {enableProbe && probeSnapshot && (
        <Marker position={[probeSnapshot.lat, probeSnapshot.lng]} icon={probeIcon}>
          <Popup className="custom-popup">
            <div style={{ minWidth: "220px", padding: "8px" }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                Local water health
              </h4>
              <p style={{ margin: "0 0 6px 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Estimated status: <strong>{probeSnapshot.data.label}</strong> ({probeSnapshot.data.score}/100)
              </p>
              <p style={{ margin: "0 0 4px 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Distance from coast: {probeSnapshot.data.coastalDistanceKm.toFixed(1)} km
              </p>
              {probeSnapshot.data.nearestRiver && (
                <p style={{ margin: "0 0 4px 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  Nearest river mouth: <strong>{probeSnapshot.data.nearestRiver.name}</strong> ({probeSnapshot.data.nearestRiver.severity}) · {probeSnapshot.data.nearestRiver.distanceKm.toFixed(1)} km away
                </p>
              )}
              {probeSnapshot.data.nearestZone && (
                <p style={{ margin: "0 0 4px 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  Nearest fishing zone: <strong>{probeSnapshot.data.nearestZone.name}</strong> · {probeSnapshot.data.nearestZone.qualityScore}/100 quality
                </p>
              )}
              {probeSnapshot.data.current && (
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  Currents: {probeSnapshot.data.current.speed.toFixed(2)} km/h · {probeSnapshot.data.current.dir.toFixed(0)}°
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      )}

      {/* Evacuation Zones / Live Telemetry */}
      {showEvacZones &&
        liveZones.map((zone) => (
          <CircleMarker
            key={`evac-${zone.name}-${zone.lat}`}
            center={[zone.lat, zone.lng]}
            radius={8}
            pathOptions={{
              color: getFloodReadinessColor(zone.qualityScore),
              fillColor: getFloodReadinessColor(zone.qualityScore),
              fillOpacity: 0.6,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1} className="custom-popup">
              <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {zone.name}
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: 2 }}>
                Status: {getFloodReadinessStatus(zone.qualityScore)} ({Math.round(zone.qualityScore)}%)
              </div>
            </Tooltip>
            <Popup className="custom-popup">
              <div style={{ minWidth: "200px", padding: "8px" }}>
                <h4 style={{ margin: "0 0 6px 0", fontSize: "0.92rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {zone.name}
                </h4>
                <div style={{ marginBottom: "8px" }}>
                  <span
                    className="badge"
                    style={{
                      background: getFloodReadinessColor(zone.qualityScore),
                      color: "#fff",
                      fontSize: "0.65rem",
                    }}
                  >
                    Telemetry: {getFloodReadinessStatus(zone.qualityScore)}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    Readiness: <strong>{Math.round(zone.qualityScore)}%</strong>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    Velocity: <strong>{zone.currentVelocity.toFixed(2)} cm/h</strong>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    Direction: <strong>{zone.currentDirection.toFixed(0)}°</strong>
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: 4 }}>
                    Last updated: {new Date(zone.liveUpdatedAt).toLocaleTimeString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onFocusTarget({ lat: zone.lat, lng: zone.lng, zoom: 14 })}
                  className="btn btn-teal btn-sm"
                  style={{ width: "100%", marginTop: "12px", justifyContent: "center" }}
                >
                  Focus Sensor
                </button>
              </div>
            </Popup>
          </CircleMarker>
        ))}
    </>
  );
}
