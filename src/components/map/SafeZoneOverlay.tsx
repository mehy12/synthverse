/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Circle, CircleMarker, Polyline, Popup, Tooltip, useMapEvents } from "react-leaflet";
import {
  buildSafeZonePlan,
  filterSafeShelters,
  kMeansCentroids,
  fetchOSRMRoute,
  computeImpactZones,
  type ScenarioType,
  type SafeZonePlan,
  type Shelter,
  type Substation,
} from "@/lib/safe-zone-engine";
import rawShelters from "@/data/shelters.json";
import powerGridNodes from "@/data/power-grid-locations.json";

const GOV_PIN = "GOV2024";

const SCENARIO_LABELS: Record<ScenarioType, string> = {
  blackout: "⚡ Grid Blackout",
  flood_blackout: "🌊 Flood + Blackout",
  cyclone: "🌀 Cyclone",
  strike: "💥 Strike / Attack",
};

const SHELTER_TYPE_ICONS: Record<string, string> = {
  cyclone_shelter: "🏛️",
  school: "🏫",
  hospital: "🏥",
  government_building: "🏢",
};

// Click interceptor to add threats on map
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

interface SafeZoneOverlayProps {
  visible: boolean;
}

export default function SafeZoneOverlay({ visible }: SafeZoneOverlayProps) {
  const [scenario, setScenario] = useState<ScenarioType>("blackout");
  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [plan, setPlan] = useState<SafeZonePlan | null>(null);
  const [extraThreats, setExtraThreats] = useState<{ lat: number; lng: number }[]>([]);
  const [addingThreat, setAddingThreat] = useState(false);
  const [status, setStatus] = useState<"idle" | "calculating" | "active" | "rerouting">("idle");
  const [rerouteCount, setRerouteCount] = useState(0);
  const [rerouteFlash, setRerouteFlash] = useState(false);

  // Government portal
  const [showGovModal, setShowGovModal] = useState(false);
  const [govPin, setGovPin] = useState("");
  const [govUnlocked, setGovUnlocked] = useState(false);
  const [addingShelter, setAddingShelter] = useState(false);
  const [pendingShelterPos, setPendingShelterPos] = useState<{ lat: number; lng: number } | null>(null);
  const [customShelters, setCustomShelters] = useState<Shelter[]>([]);
  const [newShelterForm, setNewShelterForm] = useState({ name: "", capacity: "500", type: "cyclone_shelter" });
  const [govError, setGovError] = useState("");

  // Load custom shelters from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("gov_shelters") || "[]");
      setCustomShelters(stored);
    } catch { /* empty */ }
  }, []);

  const allShelters: Shelter[] = [...(rawShelters as Shelter[]), ...customShelters];
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
  const epicenterId = useRef<string>("");

  const runSimulation = useCallback(async (threats: { lat: number; lng: number }[] = extraThreats) => {
    if (!selectedStation) return;
    setStatus("calculating");

    try {
      const result = await buildSafeZonePlan(
        {
          lat: selectedStation.lat,
          lng: selectedStation.lng,
          name: selectedStation.name,
          circle: selectedStation.circle,
          division: selectedStation.division,
        },
        scenario,
        allStations,
        allShelters,
        threats,
      );
      setPlan(result);
      setStatus("active");
    } catch {
      setStatus("idle");
    }
  }, [selectedStation, scenario, allStations, allShelters, extraThreats]);

  const handleAddThreat = useCallback(async (lat: number, lng: number) => {
    setAddingThreat(false);
    const newThreats = [...extraThreats, { lat, lng }];
    setExtraThreats(newThreats);

    // Trigger re-routing
    if (!selectedStation || !plan) return;
    setStatus("rerouting");
    setRerouteFlash(true);
    setTimeout(() => setRerouteFlash(false), 2500);

    const newThreatZone = { lat, lng, radiusKm: 12, severity: "red" as const, label: "New Threat" };
    const allZones = [...plan.redZones, ...plan.yellowZones, newThreatZone];

    const safeShelters = filterSafeShelters(allShelters, allZones);
    const targets = kMeansCentroids(safeShelters, 3);

    const from = { lat: selectedStation.lat, lng: selectedStation.lng };
    const routes = await Promise.all(targets.map((s) => fetchOSRMRoute(from, s)));

    setPlan((prev) =>
      prev
        ? {
            ...prev,
            redZones: [...prev.redZones, newThreatZone],
            safeShelters,
            targetShelters: targets,
            routes,
            rerouteCount: prev.rerouteCount + 1,
            status: "active",
          }
        : prev
    );
    setRerouteCount((c) => c + 1);
    setStatus("active");
  }, [extraThreats, selectedStation, plan, allShelters]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (addingThreat) {
      handleAddThreat(lat, lng);
    } else if (addingShelter && govUnlocked) {
      setPendingShelterPos({ lat, lng });
      setAddingShelter(false);
    }
  }, [addingThreat, addingShelter, govUnlocked, handleAddThreat]);

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

  const routeColors = ["#00FF88", "#00DDFF", "#FFDD00"];
  const routeLabels = ["Primary Route", "Alternative 1", "Alternative 2"];

  return (
    <>
      {/* Map interaction handler */}
      <MapClickHandler
        active={addingThreat || addingShelter}
        onMapClick={handleMapClick}
      />

      {/* Red Zones */}
      {plan?.redZones.map((zone, i) => (
        <Circle
          key={`red-${i}`}
          center={[zone.lat, zone.lng]}
          radius={zone.radiusKm * 1000}
          pathOptions={{
            color: "#EF4444",
            fillColor: "#EF4444",
            fillOpacity: 0.18,
            weight: 2.5,
            dashArray: "6 4",
            className: "zone-red-pulse",
          }}
        >
          <Tooltip sticky className="custom-popup">
            <div style={{ fontWeight: 700, color: "#EF4444" }}>🔴 DANGER ZONE</div>
            <div style={{ fontSize: "0.75rem" }}>{zone.label}</div>
            <div style={{ fontSize: "0.7rem" }}>Radius: {zone.radiusKm}km</div>
          </Tooltip>
        </Circle>
      ))}

      {/* Yellow Warning Zones */}
      {plan?.yellowZones.map((zone, i) => (
        <Circle
          key={`yellow-${i}`}
          center={[zone.lat, zone.lng]}
          radius={zone.radiusKm * 1000}
          pathOptions={{
            color: "#F59E0B",
            fillColor: "#F59E0B",
            fillOpacity: 0.10,
            weight: 1.5,
            dashArray: "4 6",
          }}
        >
          <Tooltip sticky className="custom-popup">
            <div style={{ fontWeight: 700, color: "#F59E0B" }}>⚠️ WARNING ZONE</div>
            <div style={{ fontSize: "0.75rem" }}>{zone.label}</div>
          </Tooltip>
        </Circle>
      ))}

      {/* Safe Shelter Markers */}
      {plan?.safeShelters.map((shelter) => {
        const isTarget = plan.targetShelters.some((t) => t.id === shelter.id);
        return (
          <CircleMarker
            key={`shelter-${shelter.id}`}
            center={[shelter.lat, shelter.lng]}
            radius={isTarget ? 10 : 5}
            pathOptions={{
              color: isTarget ? "#00FF88" : "#10B981",
              fillColor: isTarget ? "#00FF88" : "#10B981",
              fillOpacity: isTarget ? 0.9 : 0.6,
              weight: isTarget ? 3 : 1.5,
              className: isTarget ? "shelter-target-pulse" : undefined,
            }}
          >
            <Tooltip className="custom-popup">
              <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                {SHELTER_TYPE_ICONS[shelter.type] || "🏠"} {shelter.name}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#10B981" }}>
                {isTarget ? "✅ PRIMARY TARGET" : "Safe Zone"}
              </div>
              <div style={{ fontSize: "0.7rem" }}>Capacity: {shelter.capacity.toLocaleString()}</div>
            </Tooltip>
            <Popup className="custom-popup">
              <div style={{ minWidth: "180px", padding: "6px" }}>
                <div style={{ fontWeight: 700 }}>{SHELTER_TYPE_ICONS[shelter.type]} {shelter.name}</div>
                <div style={{ fontSize: "0.75rem", margin: "4px 0", color: "#10B981", fontWeight: 600 }}>
                  {isTarget ? "🎯 Routed Destination" : "Safe Shelter"}
                </div>
                <div style={{ fontSize: "0.75rem" }}>District: {shelter.district}</div>
                <div style={{ fontSize: "0.75rem" }}>Capacity: {shelter.capacity.toLocaleString()} people</div>
                <div style={{ fontSize: "0.75rem" }}>Elevation: {shelter.elevation}</div>
                {shelter.governmentVerified && (
                  <div style={{ marginTop: 6, fontSize: "0.7rem", color: "#F59E0B", fontWeight: 700 }}>
                    🏛️ Government Verified
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {/* OSRM Road Routes */}
      {plan?.routes.map((route, i) => (
        <Polyline
          key={`route-${i}-${rerouteCount}`}
          positions={route as [number, number][]}
          pathOptions={{
            color: routeColors[i] ?? "#00FF88",
            weight: 3.5,
            opacity: 0.85,
            dashArray: "8 6",
            className: "route-flow-anim",
          }}
        >
          <Tooltip sticky className="custom-popup">
            <div style={{ fontWeight: 700, color: routeColors[i] }}>{routeLabels[i]}</div>
            <div style={{ fontSize: "0.72rem" }}>
              → {plan.targetShelters[i]?.name || "Shelter"}
            </div>
          </Tooltip>
        </Polyline>
      ))}

      {/* Pending custom shelter marker */}
      {pendingShelterPos && (
        <CircleMarker
          center={[pendingShelterPos.lat, pendingShelterPos.lng]}
          radius={10}
          pathOptions={{ color: "#F59E0B", fillColor: "#F59E0B", fillOpacity: 0.7, weight: 2 }}
        >
          <Popup className="custom-popup">
            <div style={{ minWidth: "220px", padding: "8px" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>🏛️ Add Government Shelter</div>
              <input
                placeholder="Shelter name"
                value={newShelterForm.name}
                onChange={(e) => setNewShelterForm((f) => ({ ...f, name: e.target.value }))}
                style={{ width: "100%", marginBottom: 6, padding: "4px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: "0.8rem" }}
              />
              <input
                type="number"
                placeholder="Capacity"
                value={newShelterForm.capacity}
                onChange={(e) => setNewShelterForm((f) => ({ ...f, capacity: e.target.value }))}
                style={{ width: "100%", marginBottom: 6, padding: "4px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: "0.8rem" }}
              />
              <select
                value={newShelterForm.type}
                onChange={(e) => setNewShelterForm((f) => ({ ...f, type: e.target.value }))}
                style={{ width: "100%", marginBottom: 8, padding: "4px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: "0.8rem" }}
              >
                <option value="cyclone_shelter">Cyclone Shelter</option>
                <option value="school">School</option>
                <option value="hospital">Hospital</option>
                <option value="government_building">Gov. Building</option>
              </select>
              <button
                onClick={handleSaveShelter}
                style={{ width: "100%", padding: "6px", background: "#10B981", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: "0.8rem" }}
              >
                ✅ Save Shelter
              </button>
            </div>
          </Popup>
        </CircleMarker>
      )}

      {/* Custom gov shelters (pre-existing) */}
      {customShelters.map((sh) => (
        <CircleMarker
          key={`custom-${sh.id}`}
          center={[sh.lat, sh.lng]}
          radius={7}
          pathOptions={{ color: "#F59E0B", fillColor: "#FBBF24", fillOpacity: 0.8, weight: 2 }}
        >
          <Tooltip className="custom-popup">
            <div style={{ fontWeight: 700 }}>🏛️ {sh.name}</div>
            <div style={{ fontSize: "0.7rem", color: "#F59E0B" }}>Government Certified Shelter</div>
          </Tooltip>
        </CircleMarker>
      ))}

      {/* ── Simulator Panel ─────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 2000,
          width: 300,
          background: "rgba(15, 23, 42, 0.94)",
          border: "1px solid rgba(239,68,68,0.4)",
          borderRadius: 16,
          padding: 16,
          color: "white",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          fontFamily: "inherit",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div
            style={{
              width: 8, height: 8, borderRadius: "50%",
              background: status === "active" ? "#00FF88" : status === "calculating" || status === "rerouting" ? "#F59E0B" : "#6B7280",
              boxShadow: status === "active" ? "0 0 8px #00FF88" : "none",
              animation: status === "calculating" || status === "rerouting" ? "pulse 1s infinite" : "none",
            }}
          />
          <span style={{ fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94A3B8" }}>
            Safe Zone Simulator
          </span>
        </div>

        {/* Re-routing banner */}
        {rerouteFlash && (
          <div style={{
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.5)",
            borderRadius: 8,
            padding: "8px 10px",
            marginBottom: 10,
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "#EF4444",
            animation: "pulse 0.5s infinite",
          }}>
            ⚠️ ZONE COMPROMISED — RE-ROUTING… ({rerouteCount}x)
          </div>
        )}

        {/* Station selector */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: "0.65rem", color: "#94A3B8", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
            Select Station (Epicenter)
          </label>
          <select
            value={selectedStationId}
            onChange={(e) => setSelectedStationId(e.target.value)}
            style={{ width: "100%", background: "rgba(30,41,59,0.8)", border: "1px solid rgba(100,116,139,0.4)", borderRadius: 8, color: "white", padding: "7px 10px", fontSize: "0.8rem" }}
          >
            <option value="">— Choose a substation —</option>
            {allStations.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.circle})</option>
            ))}
          </select>
        </div>

        {/* Scenario selector */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: "0.65rem", color: "#94A3B8", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
            Scenario Type
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {(Object.entries(SCENARIO_LABELS) as [ScenarioType, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setScenario(key)}
                style={{
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: scenario === key ? "1px solid #EF4444" : "1px solid rgba(100,116,139,0.3)",
                  background: scenario === key ? "rgba(239,68,68,0.15)" : "rgba(30,41,59,0.5)",
                  color: scenario === key ? "#EF4444" : "#94A3B8",
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  textAlign: "left",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Simulate button */}
        <button
          onClick={() => runSimulation()}
          disabled={!selectedStationId || status === "calculating"}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: 10,
            border: "none",
            background: selectedStationId ? "linear-gradient(135deg, #EF4444, #F97316)" : "rgba(100,116,139,0.2)",
            color: selectedStationId ? "white" : "#64748B",
            cursor: selectedStationId ? "pointer" : "not-allowed",
            fontWeight: 700,
            fontSize: "0.82rem",
            marginBottom: 8,
          }}
        >
          {status === "calculating" ? "⏳ Calculating Routes…" : status === "rerouting" ? "🔄 Re-routing…" : "🚨 Simulate Impact & Route"}
        </button>

        {/* Add threat button */}
        {status === "active" && (
          <button
            onClick={() => setAddingThreat(true)}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: 10,
              border: addingThreat ? "1px solid #EF4444" : "1px solid rgba(239,68,68,0.4)",
              background: addingThreat ? "rgba(239,68,68,0.2)" : "rgba(30,41,59,0.5)",
              color: addingThreat ? "#EF4444" : "#94A3B8",
              cursor: "pointer",
              fontSize: "0.78rem",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            {addingThreat ? "📍 Click on map to place threat…" : "➕ Add New Threat Zone"}
          </button>
        )}

        {/* Status summary */}
        {plan && status === "active" && (
          <div style={{ fontSize: "0.7rem", color: "#64748B", borderTop: "1px solid rgba(100,116,139,0.2)", paddingTop: 8, marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span>🔴 Red Zones</span><strong style={{ color: "#EF4444" }}>{plan.redZones.length}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span>🟡 Yellow Zones</span><strong style={{ color: "#F59E0B" }}>{plan.yellowZones.length}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span>🟢 Safe Shelters</span><strong style={{ color: "#10B981" }}>{plan.safeShelters.length}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>🔄 Re-routes</span><strong style={{ color: "#94A3B8" }}>{rerouteCount}</strong>
            </div>
          </div>
        )}

        {/* Gov portal button */}
        <div style={{ borderTop: "1px solid rgba(100,116,139,0.2)", marginTop: 10, paddingTop: 10 }}>
          <button
            onClick={() => setShowGovModal(true)}
            style={{
              width: "100%",
              padding: "7px",
              borderRadius: 8,
              border: "1px solid rgba(245,158,11,0.4)",
              background: govUnlocked ? "rgba(245,158,11,0.15)" : "rgba(30,41,59,0.5)",
              color: govUnlocked ? "#F59E0B" : "#94A3B8",
              cursor: "pointer",
              fontSize: "0.74rem",
              fontWeight: 600,
            }}
          >
            🏛️ {govUnlocked ? "Gov. Shelter Management (Unlocked)" : "Gov. Shelter Portal"}
          </button>
          {govUnlocked && (
            <button
              onClick={() => setAddingShelter(true)}
              style={{
                width: "100%",
                marginTop: 4,
                padding: "7px",
                borderRadius: 8,
                border: addingShelter ? "1px solid #F59E0B" : "1px solid rgba(245,158,11,0.3)",
                background: addingShelter ? "rgba(245,158,11,0.2)" : "rgba(30,41,59,0.3)",
                color: "#F59E0B",
                cursor: "pointer",
                fontSize: "0.74rem",
                fontWeight: 600,
              }}
            >
              {addingShelter ? "📍 Click map to place shelter…" : "📍 Add Shelter on Map"}
            </button>
          )}
        </div>
      </div>

      {/* Gov PIN Modal */}
      {showGovModal && (
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "rgba(15,23,42,0.98)",
              border: "1px solid rgba(245,158,11,0.4)",
              borderRadius: 16,
              padding: 28,
              width: 340,
              color: "white",
              backdropFilter: "blur(16px)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 4 }}>🏛️ Government Portal</div>
            <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginBottom: 16 }}>
              Authorized government officials only. Enter your access PIN to manage shelter locations.
            </div>

            <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: "0.72rem", color: "#F59E0B" }}>
              <strong>Demo PIN:</strong> GOV2024
            </div>

            <input
              type="password"
              placeholder="Enter access PIN"
              value={govPin}
              onChange={(e) => { setGovPin(e.target.value); setGovError(""); }}
              style={{ width: "100%", background: "rgba(30,41,59,0.8)", border: "1px solid rgba(100,116,139,0.4)", borderRadius: 8, color: "white", padding: "9px 12px", fontSize: "0.85rem", boxSizing: "border-box" }}
            />
            {govError && <div style={{ color: "#EF4444", fontSize: "0.72rem", marginTop: 4 }}>{govError}</div>}

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                onClick={() => {
                  if (govPin === GOV_PIN) {
                    setGovUnlocked(true);
                    setShowGovModal(false);
                    setGovPin("");
                  } else {
                    setGovError("❌ Incorrect PIN. Access denied.");
                  }
                }}
                style={{ flex: 1, padding: "9px", background: "linear-gradient(135deg, #F59E0B, #EF4444)", border: "none", borderRadius: 9, color: "white", fontWeight: 700, cursor: "pointer" }}
              >
                Authenticate
              </button>
              <button
                onClick={() => { setShowGovModal(false); setGovPin(""); }}
                style={{ flex: 1, padding: "9px", background: "rgba(100,116,139,0.15)", border: "1px solid rgba(100,116,139,0.3)", borderRadius: 9, color: "#94A3B8", cursor: "pointer" }}
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
