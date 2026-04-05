/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Circle,
  CircleMarker,
  Polyline,
  Popup,
  Tooltip,
  useMapEvents,
  useMap,
} from "react-leaflet";
import {
  filterSafeShelters,
  fetchOSRMRoute,
  computeImpactZones,
  haversineKm,
  findNearestShelter,
  findNearestStation,
  type ScenarioType,
  type Shelter,
  type Substation,
  type ImpactZone,
} from "@/lib/safe-zone-engine";
import rawShelters from "@/data/shelters.json";
import powerGridNodes from "@/data/power-grid-locations.json";

const GOV_PIN = "GOV2024";

const SCENARIO_LABELS: Record<ScenarioType, string> = {
  blackout: "⚡ Grid Blackout",
  flood_blackout: "🌊 Flood + Blackout",
  cyclone: "🌀 Cyclone",
  earthquake: "🌋 Earthquake",
  strike: "💥 Strike / Attack",
};

const SHELTER_TYPE_ICONS: Record<string, string> = {
  cyclone_shelter: "🏛️",
  school: "🏫",
  hospital: "🏥",
  government_building: "🏢",
};

interface RouteInfo {
  shelter: Shelter;
  coords: [number, number][];
  distanceM: number;
  durationS: number;
  rank: number; // 0 = primary, 1 = alt1, 2 = alt2
}

interface ActivePlan {
  redZones: ImpactZone[];
  yellowZones: ImpactZone[];
  safeShelters: Shelter[];
  routes: RouteInfo[];
}

function formatDist(m: number): string {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}
function formatTime(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${(s / 3600).toFixed(1)} hr`;
}

// ── Map utilities ──────────────────────────────────────────────────────────────
function MapClickHandler({
  active,
  onMapClick,
}: {
  active: boolean;
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (!active) return;
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyToUser({ pos }: { pos: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.flyTo([pos.lat, pos.lng], 13, { duration: 1.5 });
  }, [pos, map]);
  return null;
}

// ── Route colors (Google Maps inspired) ──────────────────────────────────────
const ROUTE_STYLES = [
  { border: "#1a5c27", fill: "#1DB954", label: "🟢 Primary Route" },
  { border: "#0b4f8c", fill: "#1A73E8", label: "🔵 Alternative 1" },
  { border: "#7b3f00", fill: "#F59E0B", label: "🟡 Alternative 2" },
];

// ── Main component ─────────────────────────────────────────────────────────────
interface SafeZoneOverlayProps {
  visible: boolean;
}

export default function SafeZoneOverlay({ visible }: SafeZoneOverlayProps) {
  // Core state
  const [scenario, setScenario] = useState<ScenarioType>("blackout");
  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [status, setStatus] = useState<
    "idle" | "locating" | "calculating" | "active" | "rerouting"
  >("idle");
  const [rerouteCount, setRerouteCount] = useState(0);
  const [rerouteFlash, setRerouteFlash] = useState(false);
  const [routeKey, setRouteKey] = useState(0); // force re-render on reroute

  // Threat zones
  const [extraThreats, setExtraThreats] = useState<
    { lat: number; lng: number }[]
  >([]);
  const [addingThreat, setAddingThreat] = useState(false);
  const [addingDebris, setAddingDebris] = useState(false);

  // User location
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locationError, setLocationError] = useState("");
  const [flyToPos, setFlyToPos] = useState<{ lat: number; lng: number } | null>(
    null,
  );

  // Government portal
  const [showGovModal, setShowGovModal] = useState(false);
  const [govPin, setGovPin] = useState("");
  const [govUnlocked, setGovUnlocked] = useState(false);
  const [addingShelter, setAddingShelter] = useState(false);
  const [pendingShelterPos, setPendingShelterPos] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [customShelters, setCustomShelters] = useState<Shelter[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("gov_shelters") || "[]");
    } catch {
      return [];
    }
  });
  const [newShelterForm, setNewShelterForm] = useState({
    name: "",
    capacity: "500",
    type: "cyclone_shelter",
  });
  const [govError, setGovError] = useState("");
  const [debrisPos, setDebrisPos] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [dispatchNote, setDispatchNote] = useState("");

  // Selected route highlight
  const [activeRouteIdx, setActiveRouteIdx] = useState(0);

  const allShelters: Shelter[] = useMemo(
    () => [...(rawShelters as Shelter[]), ...customShelters],
    [customShelters],
  );
  const allStations: Substation[] = (powerGridNodes as any[]).map((n) => ({
    id: n.id,
    name: n.name,
    lat: n.lat,
    lng: n.lng,
    circle: n.circle,
    division: n.division,
    capacity: n.capacity,
    loading: n.loading,
    kv: n.kv,
  }));

  const selectedStation = allStations.find((s) => s.id === selectedStationId);

  // ── Find user location ────────────────────────────────────────────────────
  const findMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported by your browser.");
      return;
    }
    setStatus("locating");
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(p);
        setFlyToPos(p);
        setStatus("idle");
      },
      () => {
        // If denied in browser, simulate a position in Bhubaneswar area for demo
        const demo = {
          lat: 20.2961 + (Math.random() - 0.5) * 0.1,
          lng: 85.8245 + (Math.random() - 0.5) * 0.1,
        };
        setUserPos(demo);
        setFlyToPos(demo);
        setLocationError(
          "GPS unavailable – using simulated position near Bhubaneswar.",
        );
        setStatus("idle");
      },
      { timeout: 8000, enableHighAccuracy: true },
    );
  }, []);

  // ── Core routing engine ───────────────────────────────────────────────────
  const buildPlan = useCallback(
    async (
      threats: { lat: number; lng: number }[],
      origin: { lat: number; lng: number } | null,
      epicenterOverride?: {
        lat: number;
        lng: number;
        name: string;
        circle: string;
        division: string;
      },
    ) => {
      const activeStation = epicenterOverride ?? selectedStation;
      if (!activeStation) return;

      const epicenter = {
        lat: activeStation.lat,
        lng: activeStation.lng,
        name: activeStation.name,
        circle: activeStation.circle,
        division: activeStation.division,
      };

      const impactZones = computeImpactZones(epicenter, scenario, allStations);

      // Add extra user-placed threats
      for (const t of threats) {
        impactZones.push({
          lat: t.lat,
          lng: t.lng,
          radiusKm: 10,
          severity: "red",
          label: "Added Threat",
        });
      }

      const redZones = impactZones.filter((z) => z.severity === "red");
      const yellowZones = impactZones.filter((z) => z.severity === "yellow");

      // Filter safe shelters
      const safe = filterSafeShelters(allShelters, impactZones);

      // Route origin = user location OR epicenter
      const from = origin ?? epicenter;

      // Sort shelters by distance from origin (closest first), pick top 5 candidates
      const sorted = [...safe].sort(
        (a, b) =>
          haversineKm(from.lat, from.lng, a.lat, a.lng) -
          haversineKm(from.lat, from.lng, b.lat, b.lng),
      );
      const candidates = sorted.slice(0, 5);

      // Fetch routes for top 3 (parallel)
      const routeResults = await Promise.all(
        candidates.slice(0, 3).map(async (shelter, i) => {
          const result = await fetchOSRMRoute(from, shelter);
          return {
            shelter,
            coords: result.coords as [number, number][],
            distanceM: result.distanceM,
            durationS: result.durationS,
            rank: i,
          } as RouteInfo;
        }),
      );

      // Sort by actual road distance (OSRM might give different order)
      routeResults.sort((a, b) => a.distanceM - b.distanceM);
      routeResults.forEach((r, i) => (r.rank = i));

      setPlan({
        redZones,
        yellowZones,
        safeShelters: safe,
        routes: routeResults,
      });
      setActiveRouteIdx(0);
      setRouteKey((k) => k + 1);
    },
    [selectedStation, scenario, allStations, allShelters],
  );

  const runSimulation = useCallback(async () => {
    setStatus("calculating");
    try {
      await buildPlan(extraThreats, userPos);
      setStatus("active");
    } catch {
      setStatus("idle");
    }
  }, [buildPlan, extraThreats, userPos]);

  // ── Add threat + reroute ──────────────────────────────────────────────────
  const handleAddThreat = useCallback(
    async (lat: number, lng: number) => {
      setAddingThreat(false);
      const newThreats = [...extraThreats, { lat, lng }];
      setExtraThreats(newThreats);

      if (!selectedStation || !plan) return;

      setStatus("rerouting");
      setRerouteFlash(true);
      setTimeout(() => setRerouteFlash(false), 3000);

      try {
        await buildPlan(newThreats, userPos);
        setRerouteCount((c) => c + 1);
        setStatus("active");
      } catch {
        setStatus("active");
      }
    },
    [extraThreats, selectedStation, plan, buildPlan, userPos],
  );

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (addingThreat) {
        handleAddThreat(lat, lng);
      } else if (addingDebris) {
        setDebrisPos({ lat, lng });
        setAddingDebris(false);
      } else if (addingShelter && govUnlocked) {
        setPendingShelterPos({ lat, lng });
        setAddingShelter(false);
      }
    },
    [addingThreat, addingDebris, addingShelter, govUnlocked, handleAddThreat],
  );

  const handleDispatchDebrisHelp = useCallback(async () => {
    if (!debrisPos) return;

    const nearestStation = findNearestStation(debrisPos, allStations);
    const nearestShelter = findNearestShelter(debrisPos, allShelters);

    if (!nearestStation) return;

    setSelectedStationId(nearestStation.id);
    setUserPos(debrisPos);
    setFlyToPos(debrisPos);
    setStatus("calculating");

    try {
      await buildPlan([], debrisPos, nearestStation);
      const note = `Help dispatched to ${nearestStation.name}${nearestShelter ? ` with shelter backup at ${nearestShelter.name}` : ""}`;
      setDispatchNote(note);
      if (typeof window !== "undefined") {
        const stored = JSON.parse(
          localStorage.getItem("emergency_help_calls") || "[]",
        );
        stored.push({
          id: `debris-${Date.now()}`,
          lat: debrisPos.lat,
          lng: debrisPos.lng,
          station: nearestStation.name,
          shelter: nearestShelter?.name || null,
          timestamp: new Date().toISOString(),
        });
        localStorage.setItem("emergency_help_calls", JSON.stringify(stored));
      }
      setStatus("active");
    } catch {
      setDispatchNote("Help dispatch failed. Please retry.");
      setStatus("active");
    }
  }, [allShelters, allStations, buildPlan, debrisPos]);

  const handleSaveShelter = () => {
    if (!pendingShelterPos || !newShelterForm.name) return;
    const shelter: Shelter = {
      id: `gov-custom-${Date.now()}`,
      name: newShelterForm.name,
      lat: pendingShelterPos.lat,
      lng: pendingShelterPos.lng,
      capacity: parseInt(newShelterForm.capacity),
      type: newShelterForm.type,
      district: "Custom",
      governmentVerified: true,
      elevation: "medium",
    };
    const updated = [...customShelters, shelter];
    setCustomShelters(updated);
    localStorage.setItem("gov_shelters", JSON.stringify(updated));
    setPendingShelterPos(null);
    setNewShelterForm({ name: "", capacity: "500", type: "cyclone_shelter" });
  };

  if (!visible) return null;

  return (
    <>
      <MapClickHandler
        active={addingThreat || addingShelter}
        onMapClick={handleMapClick}
      />
      <FlyToUser pos={flyToPos} />

      {/* ── User Location Marker ────────────────────────────────────────────── */}
      {userPos && (
        <>
          {/* Outer pulse ring */}
          <Circle
            center={[userPos.lat, userPos.lng]}
            radius={180}
            pathOptions={{
              color: "#1A73E8",
              fillColor: "#1A73E8",
              fillOpacity: 0.15,
              weight: 2,
              dashArray: "4 4",
            }}
          />
          {/* Inner solid dot */}
          <CircleMarker
            center={[userPos.lat, userPos.lng]}
            radius={9}
            pathOptions={{
              color: "white",
              fillColor: "#1A73E8",
              fillOpacity: 1,
              weight: 3,
              className: "user-loc-pulse",
            }}
          >
            <Tooltip
              permanent
              className="custom-popup"
              direction="top"
              offset={[0, -12]}
            >
              <div
                style={{
                  fontWeight: 700,
                  color: "#1A73E8",
                  fontSize: "0.72rem",
                }}
              >
                📍 Your Location
              </div>
            </Tooltip>
          </CircleMarker>
        </>
      )}

      {/* ── Red Danger Zones ────────────────────────────────────────────────── */}
      {plan?.redZones.map((zone, i) => (
        <Circle
          key={`red-${i}`}
          center={[zone.lat, zone.lng]}
          radius={zone.radiusKm * 1000}
          pathOptions={{
            color: "#EF4444",
            fillColor: "#EF4444",
            fillOpacity: 0.14,
            weight: 2.5,
            dashArray: "6 4",
            className: "zone-red-pulse",
          }}
        >
          <Tooltip sticky className="custom-popup">
            <div style={{ fontWeight: 700, color: "#EF4444" }}>
              🔴 DANGER ZONE
            </div>
            <div style={{ fontSize: "0.72rem" }}>
              {zone.label} · {zone.radiusKm}km radius
            </div>
          </Tooltip>
        </Circle>
      ))}

      {/* ── Yellow Warning Zones ────────────────────────────────────────────── */}
      {plan?.yellowZones.map((zone, i) => (
        <Circle
          key={`yellow-${i}`}
          center={[zone.lat, zone.lng]}
          radius={zone.radiusKm * 1000}
          pathOptions={{
            color: "#F59E0B",
            fillColor: "#F59E0B",
            fillOpacity: 0.08,
            weight: 1.5,
            dashArray: "4 6",
          }}
        >
          <Tooltip sticky className="custom-popup">
            <div style={{ fontWeight: 700, color: "#F59E0B" }}>
              ⚠️ WARNING ZONE
            </div>
            <div style={{ fontSize: "0.72rem" }}>{zone.label}</div>
          </Tooltip>
        </Circle>
      ))}

      {/* ── Safe Shelter Markers ────────────────────────────────────────────── */}
      {plan?.safeShelters.map((shelter) => {
        const routeInfo = plan.routes.find((r) => r.shelter.id === shelter.id);
        const isTarget = !!routeInfo;
        const isPrimary = routeInfo?.rank === 0;
        return (
          <CircleMarker
            key={`shelter-${shelter.id}`}
            center={[shelter.lat, shelter.lng]}
            radius={isPrimary ? 12 : isTarget ? 9 : 5}
            pathOptions={{
              color: isPrimary
                ? "#1DB954"
                : isTarget
                  ? (ROUTE_STYLES[routeInfo.rank]?.fill ?? "#10B981")
                  : "#10B981",
              fillColor: isPrimary
                ? "#1DB954"
                : isTarget
                  ? (ROUTE_STYLES[routeInfo.rank]?.fill ?? "#10B981")
                  : "#10B981",
              fillOpacity: isPrimary ? 0.95 : isTarget ? 0.85 : 0.5,
              weight: isPrimary ? 3 : isTarget ? 2 : 1,
              className: isPrimary ? "shelter-target-pulse" : undefined,
            }}
          >
            <Tooltip className="custom-popup">
              <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                {SHELTER_TYPE_ICONS[shelter.type] || "🏠"} {shelter.name}
              </div>
              {routeInfo && (
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: ROUTE_STYLES[routeInfo.rank]?.fill ?? "#10B981",
                    fontWeight: 600,
                  }}
                >
                  {ROUTE_STYLES[routeInfo.rank]?.label} ·{" "}
                  {formatDist(routeInfo.distanceM)} · ~
                  {formatTime(routeInfo.durationS)}
                </div>
              )}
              <div style={{ fontSize: "0.7rem" }}>
                Capacity: {shelter.capacity.toLocaleString()}
              </div>
            </Tooltip>
            <Popup className="custom-popup">
              <div style={{ minWidth: "210px", padding: "8px" }}>
                <div style={{ fontWeight: 700 }}>
                  {SHELTER_TYPE_ICONS[shelter.type]} {shelter.name}
                </div>
                {routeInfo && (
                  <div
                    style={{
                      margin: "6px 0",
                      padding: "6px 8px",
                      background: "rgba(29,185,84,0.08)",
                      borderRadius: 6,
                      border: "1px solid rgba(29,185,84,0.2)",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: ROUTE_STYLES[routeInfo.rank]?.fill,
                        fontSize: "0.78rem",
                      }}
                    >
                      {ROUTE_STYLES[routeInfo.rank]?.label}
                    </div>
                    <div style={{ fontSize: "0.75rem", marginTop: 2 }}>
                      📏 {formatDist(routeInfo.distanceM)} &nbsp;|&nbsp; ⏱ ~
                      {formatTime(routeInfo.durationS)} by road
                    </div>
                  </div>
                )}
                <div style={{ fontSize: "0.75rem" }}>
                  District: {shelter.district}
                </div>
                <div style={{ fontSize: "0.75rem" }}>
                  Capacity: {shelter.capacity.toLocaleString()} people
                </div>
                {shelter.governmentVerified && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: "0.7rem",
                      color: "#F59E0B",
                      fontWeight: 700,
                    }}
                  >
                    🏛️ Government Verified
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {/* ── Debris Rescue Marker ───────────────────────────────────────────── */}
      {debrisPos && (
        <CircleMarker
          center={[debrisPos.lat, debrisPos.lng]}
          radius={11}
          pathOptions={{
            color: "#EF4444",
            fillColor: "#F97316",
            fillOpacity: 0.9,
            weight: 3,
            className: "debris-rescue-pulse",
          }}
        >
          <Tooltip sticky className="custom-popup">
            <div
              style={{ fontWeight: 800, color: "#EF4444", fontSize: "0.82rem" }}
            >
              🚧 Debris Callout
            </div>
            <div style={{ fontSize: "0.72rem" }}>
              Tap dispatch to alert nearest station
            </div>
          </Tooltip>
          <Popup className="custom-popup">
            <div style={{ minWidth: "220px", padding: "8px" }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>
                🚧 Person trapped under debris
              </div>
              <div
                style={{
                  fontSize: "0.76rem",
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                }}
              >
                Location: {debrisPos.lat.toFixed(4)}, {debrisPos.lng.toFixed(4)}
              </div>
              <div style={{ fontSize: "0.76rem", marginBottom: 4 }}>
                Nearest station:{" "}
                <strong>
                  {findNearestStation(debrisPos, allStations)?.name ||
                    "Unknown"}
                </strong>
              </div>
              <div style={{ fontSize: "0.76rem", marginBottom: 8 }}>
                Nearest shelter:{" "}
                <strong>
                  {findNearestShelter(debrisPos, allShelters)?.name ||
                    "Unknown"}
                </strong>
              </div>
              <button
                type="button"
                onClick={handleDispatchDebrisHelp}
                className="btn btn-secondary"
                style={{
                  width: "100%",
                  background: "#DC2626",
                  color: "white",
                  borderColor: "#DC2626",
                }}
              >
                🚨 Dispatch Help Now
              </button>
            </div>
          </Popup>
        </CircleMarker>
      )}

      {/* ── Google Maps–Style Route Lines (white border + colored fill, non-active rendered first) ── */}
      {plan?.routes.map((route, i) => {
        const style = ROUTE_STYLES[route.rank] ?? ROUTE_STYLES[0];
        const isActive = route.rank === activeRouteIdx;
        if (isActive) return null; // render last (on top)
        return (
          <div
            key={`route-inactive-${i}-${routeKey}`}
            onClick={() => setActiveRouteIdx(route.rank)}
            style={{ cursor: "pointer" }}
          >
            {/* Border layer */}
            <Polyline
              positions={route.coords}
              pathOptions={{
                color: style.border,
                weight: 9,
                opacity: 0.55,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            {/* Fill layer */}
            <Polyline
              positions={route.coords}
              pathOptions={{
                color: style.fill,
                weight: 5.5,
                opacity: 0.65,
                lineCap: "round",
                lineJoin: "round",
              }}
            >
              <Tooltip sticky className="custom-popup">
                <div style={{ fontWeight: 700, color: style.fill }}>
                  {style.label}
                </div>
                <div style={{ fontSize: "0.72rem" }}>
                  → {route.shelter.name}
                </div>
                <div style={{ fontSize: "0.7rem" }}>
                  {formatDist(route.distanceM)} · ~{formatTime(route.durationS)}
                </div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "#94A3B8",
                    marginTop: 2,
                  }}
                >
                  Click to select
                </div>
              </Tooltip>
            </Polyline>
          </div>
        );
      })}

      {/* Active (selected) route — rendered on top with animation */}
      {plan?.routes.map((route, i) => {
        const style = ROUTE_STYLES[route.rank] ?? ROUTE_STYLES[0];
        if (route.rank !== activeRouteIdx) return null;
        return (
          <div key={`route-active-${i}-${routeKey}`}>
            {/* White glow border */}
            <Polyline
              positions={route.coords}
              pathOptions={{
                color: "white",
                weight: 13,
                opacity: 0.45,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            {/* Dark border */}
            <Polyline
              positions={route.coords}
              pathOptions={{
                color: style.border,
                weight: 10,
                opacity: 0.9,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            {/* Animated fill */}
            <Polyline
              positions={route.coords}
              pathOptions={{
                color: style.fill,
                weight: 6,
                opacity: 1,
                lineCap: "round",
                lineJoin: "round",
                className: "route-flow-anim",
              }}
            >
              <Tooltip sticky className="custom-popup">
                <div
                  style={{
                    fontWeight: 700,
                    color: style.fill,
                    fontSize: "0.88rem",
                  }}
                >
                  {style.label} ✓
                </div>
                <div style={{ fontSize: "0.78rem" }}>
                  → {route.shelter.name}
                </div>
                <div
                  style={{ fontSize: "0.75rem", fontWeight: 700, marginTop: 3 }}
                >
                  📏 {formatDist(route.distanceM)} &nbsp;|&nbsp; ⏱ ~
                  {formatTime(route.durationS)} by road
                </div>
              </Tooltip>
            </Polyline>
          </div>
        );
      })}

      {/* Origin dot on route start */}
      {plan && (userPos || selectedStation) && (
        <CircleMarker
          center={
            userPos
              ? [userPos.lat, userPos.lng]
              : [selectedStation!.lat, selectedStation!.lng]
          }
          radius={7}
          pathOptions={{
            color: "white",
            fillColor: "#1DB954",
            fillOpacity: 1,
            weight: 3,
          }}
        />
      )}

      {/* Pending custom shelter */}
      {pendingShelterPos && (
        <CircleMarker
          center={[pendingShelterPos.lat, pendingShelterPos.lng]}
          radius={10}
          pathOptions={{
            color: "#F59E0B",
            fillColor: "#F59E0B",
            fillOpacity: 0.7,
            weight: 2,
          }}
        >
          <Popup className="custom-popup">
            <div style={{ minWidth: "220px", padding: "8px" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                🏛️ New Government Shelter
              </div>
              <input
                placeholder="Shelter name"
                value={newShelterForm.name}
                onChange={(e) =>
                  setNewShelterForm((f) => ({ ...f, name: e.target.value }))
                }
                style={{
                  width: "100%",
                  marginBottom: 6,
                  padding: "4px 8px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  fontSize: "0.8rem",
                  boxSizing: "border-box",
                }}
              />
              <input
                type="number"
                placeholder="Capacity"
                value={newShelterForm.capacity}
                onChange={(e) =>
                  setNewShelterForm((f) => ({ ...f, capacity: e.target.value }))
                }
                style={{
                  width: "100%",
                  marginBottom: 6,
                  padding: "4px 8px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  fontSize: "0.8rem",
                  boxSizing: "border-box",
                }}
              />
              <select
                value={newShelterForm.type}
                onChange={(e) =>
                  setNewShelterForm((f) => ({ ...f, type: e.target.value }))
                }
                style={{
                  width: "100%",
                  marginBottom: 8,
                  padding: "4px 8px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  fontSize: "0.8rem",
                }}
              >
                <option value="cyclone_shelter">Cyclone Shelter</option>
                <option value="school">School</option>
                <option value="hospital">Hospital</option>
                <option value="government_building">Gov. Building</option>
              </select>
              <button
                onClick={handleSaveShelter}
                style={{
                  width: "100%",
                  padding: "6px",
                  background: "#10B981",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                }}
              >
                ✅ Save Shelter
              </button>
            </div>
          </Popup>
        </CircleMarker>
      )}

      {/* Custom gov shelters */}
      {customShelters.map((sh) => (
        <CircleMarker
          key={`custom-${sh.id}`}
          center={[sh.lat, sh.lng]}
          radius={7}
          pathOptions={{
            color: "#F59E0B",
            fillColor: "#FBBF24",
            fillOpacity: 0.85,
            weight: 2,
          }}
        >
          <Tooltip className="custom-popup">
            <div style={{ fontWeight: 700 }}>🏛️ {sh.name}</div>
            <div style={{ fontSize: "0.7rem", color: "#F59E0B" }}>
              Gov. Verified Shelter
            </div>
          </Tooltip>
        </CircleMarker>
      ))}

      {/* ─────────────────────────────────────────────────────────────────────
          SIMULATOR PANEL
      ──────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 2000,
          width: 310,
          maxHeight: "calc(100vh - 40px)",
          overflowY: "auto",
          background: "rgba(10, 18, 32, 0.95)",
          border: "1px solid rgba(239,68,68,0.35)",
          borderRadius: 18,
          padding: 16,
          color: "white",
          backdropFilter: "blur(16px)",
          boxShadow:
            "0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
          fontFamily: "inherit",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background:
                status === "active"
                  ? "#1DB954"
                  : status === "locating"
                    ? "#1A73E8"
                    : status === "calculating" || status === "rerouting"
                      ? "#F59E0B"
                      : "#4B5563",
              boxShadow:
                status === "active"
                  ? "0 0 10px #1DB954"
                  : status === "locating"
                    ? "0 0 10px #1A73E8"
                    : "none",
            }}
          />
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#94A3B8",
            }}
          >
            Emergency Route Planner
          </span>
        </div>

        {/* Reroute banner */}
        {rerouteFlash && (
          <div
            style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.45)",
              borderRadius: 10,
              padding: "9px 12px",
              marginBottom: 12,
              fontSize: "0.74rem",
              fontWeight: 700,
              color: "#EF4444",
            }}
          >
            ⚠️ ZONE COMPROMISED — RE-ROUTING ({rerouteCount + 1}×)
          </div>
        )}

        {/* MY LOCATION — Big prominent button */}
        <button
          onClick={findMyLocation}
          style={{
            width: "100%",
            padding: "11px",
            marginBottom: 12,
            borderRadius: 12,
            border: userPos
              ? "1px solid rgba(29,185,84,0.5)"
              : "1px solid rgba(26,115,232,0.5)",
            background: userPos
              ? "linear-gradient(135deg, rgba(29,185,84,0.2), rgba(29,185,84,0.08))"
              : "linear-gradient(135deg, rgba(26,115,232,0.25), rgba(26,115,232,0.1))",
            color: userPos ? "#1DB954" : "#1A73E8",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "0.83rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {status === "locating" ? (
            <>
              <span
                style={{
                  animation: "spin 1s linear infinite",
                  display: "inline-block",
                }}
              >
                ⏳
              </span>{" "}
              Locating…
            </>
          ) : userPos ? (
            <> 📍 Location Found — Tap to Refresh</>
          ) : (
            <> 📍 Find My Location (Route From Here)</>
          )}
        </button>

        {locationError && (
          <div
            style={{
              fontSize: "0.67rem",
              color: "#F59E0B",
              marginBottom: 8,
              lineHeight: 1.4,
            }}
          >
            {locationError}
          </div>
        )}

        {/* Station selector */}
        <div style={{ marginBottom: 10 }}>
          <label
            style={{
              fontSize: "0.63rem",
              color: "#64748B",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              display: "block",
              marginBottom: 4,
            }}
          >
            Incident Epicenter (Substation)
          </label>
          <select
            value={selectedStationId}
            onChange={(e) => setSelectedStationId(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(30,41,59,0.9)",
              border: "1px solid rgba(100,116,139,0.35)",
              borderRadius: 9,
              color: "white",
              padding: "8px 10px",
              fontSize: "0.8rem",
            }}
          >
            <option value="">— Select a substation —</option>
            {allStations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.circle})
              </option>
            ))}
          </select>
        </div>

        {/* Scenario grid */}
        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              fontSize: "0.63rem",
              color: "#64748B",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              display: "block",
              marginBottom: 5,
            }}
          >
            Scenario
          </label>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}
          >
            {(Object.entries(SCENARIO_LABELS) as [ScenarioType, string][]).map(
              ([key, label]) => (
                <button
                  key={key}
                  onClick={() => setScenario(key)}
                  style={{
                    padding: "7px 8px",
                    borderRadius: 9,
                    cursor: "pointer",
                    border:
                      scenario === key
                        ? "1px solid #EF4444"
                        : "1px solid rgba(100,116,139,0.25)",
                    background:
                      scenario === key
                        ? "rgba(239,68,68,0.15)"
                        : "rgba(30,41,59,0.6)",
                    color: scenario === key ? "#EF4444" : "#94A3B8",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    textAlign: "left",
                  }}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Simulate */}
        <button
          onClick={runSimulation}
          disabled={
            !selectedStationId ||
            status === "calculating" ||
            status === "rerouting"
          }
          style={{
            width: "100%",
            padding: "11px",
            borderRadius: 12,
            border: "none",
            background: selectedStationId
              ? "linear-gradient(135deg, #DC2626, #EA580C)"
              : "rgba(100,116,139,0.15)",
            color: selectedStationId ? "white" : "#4B5563",
            cursor: selectedStationId ? "pointer" : "not-allowed",
            fontWeight: 800,
            fontSize: "0.84rem",
            marginBottom: 8,
            boxShadow: selectedStationId
              ? "0 4px 14px rgba(220,38,38,0.35)"
              : "none",
          }}
        >
          {status === "calculating"
            ? "⏳ Fetching Routes via OSRM…"
            : status === "rerouting"
              ? "🔄 Re-routing…"
              : "🚨 Simulate & Find Nearest Shelter"}
        </button>

        {/* Add threat */}
        {status === "active" && (
          <button
            onClick={() => setAddingThreat((v) => !v)}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: 10,
              border: addingThreat
                ? "1px solid #EF4444"
                : "1px solid rgba(239,68,68,0.3)",
              background: addingThreat
                ? "rgba(239,68,68,0.18)"
                : "rgba(30,41,59,0.5)",
              color: addingThreat ? "#EF4444" : "#94A3B8",
              cursor: "pointer",
              fontSize: "0.78rem",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            {addingThreat
              ? "📍 Click map to drop threat zone…"
              : "➕ Add New Threat & Re-route"}
          </button>
        )}

        <button
          onClick={() => setAddingDebris((v) => !v)}
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: 10,
            border: addingDebris
              ? "1px solid #F97316"
              : "1px solid rgba(249,115,22,0.3)",
            background: addingDebris
              ? "rgba(249,115,22,0.18)"
              : "rgba(30,41,59,0.5)",
            color: addingDebris ? "#F97316" : "#94A3B8",
            cursor: "pointer",
            fontSize: "0.78rem",
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          {addingDebris
            ? "🚧 Click map to mark trapped person…"
            : "🚨 Debris Rescue Callout"}
        </button>

        {debrisPos && (
          <div
            style={{
              marginBottom: 8,
              padding: "10px",
              borderRadius: 10,
              background: "rgba(249,115,22,0.12)",
              border: "1px solid rgba(249,115,22,0.3)",
              fontSize: "0.74rem",
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 800, color: "#F97316", marginBottom: 4 }}>
              Debris rescue marked
            </div>
            <div>
              Nearest station:{" "}
              {findNearestStation(debrisPos, allStations)?.name || "Unknown"}
            </div>
            <div>
              Nearest shelter:{" "}
              {findNearestShelter(debrisPos, allShelters)?.name || "Unknown"}
            </div>
            {dispatchNote && (
              <div style={{ marginTop: 6, color: "#F97316", fontWeight: 700 }}>
                {dispatchNote}
              </div>
            )}
            <button
              type="button"
              onClick={handleDispatchDebrisHelp}
              style={{
                marginTop: 8,
                width: "100%",
                padding: "8px",
                borderRadius: 9,
                border: "none",
                background: "linear-gradient(135deg, #F97316, #DC2626)",
                color: "white",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Dispatch nearest station
            </button>
          </div>
        )}

        {/* Route cards */}
        {plan && status === "active" && plan.routes.length > 0 && (
          <div
            style={{
              borderTop: "1px solid rgba(100,116,139,0.15)",
              paddingTop: 12,
              marginTop: 6,
            }}
          >
            <div
              style={{
                fontSize: "0.63rem",
                color: "#64748B",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
              }}
            >
              Routes ({userPos ? "from your location" : "from epicenter"})
            </div>
            {plan.routes.map((r) => {
              const style = ROUTE_STYLES[r.rank];
              const isActive = r.rank === activeRouteIdx;
              return (
                <div
                  key={r.shelter.id}
                  onClick={() => setActiveRouteIdx(r.rank)}
                  style={{
                    marginBottom: 6,
                    padding: "9px 10px",
                    borderRadius: 10,
                    cursor: "pointer",
                    border: isActive
                      ? `1px solid ${style.fill}`
                      : "1px solid rgba(100,116,139,0.2)",
                    background: isActive
                      ? `rgba(${style.fill === "#1DB954" ? "29,185,84" : style.fill === "#1A73E8" ? "26,115,232" : "245,158,11"},0.12)`
                      : "rgba(30,41,59,0.4)",
                    transition: "all 0.15s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: style.fill,
                      }}
                    >
                      {style.label}
                    </span>
                    {isActive && (
                      <span
                        style={{
                          fontSize: "0.6rem",
                          color: style.fill,
                          fontWeight: 700,
                        }}
                      >
                        SELECTED ✓
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      color: "white",
                      marginBottom: 2,
                    }}
                  >
                    {SHELTER_TYPE_ICONS[r.shelter.type]} {r.shelter.name}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      fontSize: "0.7rem",
                      color: "#94A3B8",
                    }}
                  >
                    <span>📏 {formatDist(r.distanceM)}</span>
                    <span>⏱ ~{formatTime(r.durationS)} by road</span>
                  </div>
                </div>
              );
            })}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 6,
                marginTop: 8,
                fontSize: "0.67rem",
                color: "#64748B",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1.1rem",
                    color: "#EF4444",
                    fontWeight: 700,
                  }}
                >
                  {plan.redZones.length}
                </div>
                Red Zones
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1.1rem",
                    color: "#1DB954",
                    fontWeight: 700,
                  }}
                >
                  {plan.safeShelters.length}
                </div>
                Safe Shelters
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1.1rem",
                    color: "#F59E0B",
                    fontWeight: 700,
                  }}
                >
                  {rerouteCount}
                </div>
                Re-routes
              </div>
            </div>
          </div>
        )}

        {/* Gov portal */}
        <div
          style={{
            borderTop: "1px solid rgba(100,116,139,0.15)",
            marginTop: 12,
            paddingTop: 10,
          }}
        >
          <button
            onClick={() => setShowGovModal(true)}
            style={{
              width: "100%",
              padding: "7px",
              borderRadius: 9,
              border: "1px solid rgba(245,158,11,0.35)",
              background: govUnlocked
                ? "rgba(245,158,11,0.12)"
                : "rgba(30,41,59,0.4)",
              color: govUnlocked ? "#F59E0B" : "#64748B",
              cursor: "pointer",
              fontSize: "0.73rem",
              fontWeight: 600,
            }}
          >
            🏛️{" "}
            {govUnlocked
              ? "Gov. Shelter Management (Active)"
              : "Government Portal (Officials Only)"}
          </button>
          {govUnlocked && (
            <button
              onClick={() => setAddingShelter((v) => !v)}
              style={{
                width: "100%",
                marginTop: 4,
                padding: "7px",
                borderRadius: 9,
                border: addingShelter
                  ? "1px solid #F59E0B"
                  : "1px solid rgba(245,158,11,0.25)",
                background: addingShelter
                  ? "rgba(245,158,11,0.18)"
                  : "rgba(30,41,59,0.3)",
                color: "#F59E0B",
                cursor: "pointer",
                fontSize: "0.73rem",
                fontWeight: 600,
              }}
            >
              {addingShelter
                ? "📍 Click map to place…"
                : "📍 Place New Shelter on Map"}
            </button>
          )}
        </div>
      </div>

      {/* ── Gov PIN Modal ──────────────────────────────────────────────────── */}
      {showGovModal && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "rgba(10,18,32,0.98)",
              border: "1px solid rgba(245,158,11,0.4)",
              borderRadius: 18,
              padding: 28,
              width: 340,
              color: "white",
              backdropFilter: "blur(20px)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
            }}
          >
            <div
              style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 4 }}
            >
              🏛️ Government Portal
            </div>
            <div
              style={{
                fontSize: "0.74rem",
                color: "#94A3B8",
                marginBottom: 16,
                lineHeight: 1.5,
              }}
            >
              Authorized officials only. Enter your access PIN to manage and add
              government shelter points.
            </div>
            <div
              style={{
                background: "rgba(245,158,11,0.07)",
                border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: 8,
                padding: "8px 12px",
                marginBottom: 14,
                fontSize: "0.71rem",
                color: "#F59E0B",
              }}
            >
              <strong>Demo PIN:</strong> GOV2024
            </div>
            <input
              type="password"
              placeholder="Enter access PIN"
              value={govPin}
              onChange={(e) => {
                setGovPin(e.target.value);
                setGovError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && govPin === GOV_PIN) {
                  setGovUnlocked(true);
                  setShowGovModal(false);
                  setGovPin("");
                }
              }}
              style={{
                width: "100%",
                background: "rgba(30,41,59,0.9)",
                border: "1px solid rgba(100,116,139,0.4)",
                borderRadius: 9,
                color: "white",
                padding: "9px 12px",
                fontSize: "0.85rem",
                boxSizing: "border-box",
              }}
            />
            {govError && (
              <div
                style={{ color: "#EF4444", fontSize: "0.71rem", marginTop: 4 }}
              >
                {govError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                onClick={() => {
                  if (govPin === GOV_PIN) {
                    setGovUnlocked(true);
                    setShowGovModal(false);
                    setGovPin("");
                  } else setGovError("❌ Incorrect PIN. Access denied.");
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "linear-gradient(135deg, #F59E0B, #EF4444)",
                  border: "none",
                  borderRadius: 10,
                  color: "white",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Authenticate
              </button>
              <button
                onClick={() => {
                  setShowGovModal(false);
                  setGovPin("");
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "rgba(100,116,139,0.15)",
                  border: "1px solid rgba(100,116,139,0.3)",
                  borderRadius: 10,
                  color: "#94A3B8",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
