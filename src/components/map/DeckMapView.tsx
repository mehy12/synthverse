/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Map as MapLibreMap } from "react-map-gl/maplibre";
import { DeckGL } from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import "maplibre-gl/dist/maplibre-gl.css";

import {
  Layers,
  Map as MapIcon,
  Droplet,
  Zap,
  Shield,
  Activity,
  ChevronDown,
  ChevronUp,
  MapPin,
  Info,
  Cable,
  Navigation,
  Home,
  Heart,
} from "lucide-react";

import {
  ODISHA_DISTRICTS,
  getTimeMultiplier,
  generateAlerts,
  type DistrictFeature,
} from "@/data/odisha-geo";
import {
  createFloodZoneLayer,
  createDistrictOutlineLayer,
  createRiverLayer,
  createRiskHeatmapLayer,
  createHotspotLayer,
  createAgentLayer,
  createPowerGridLinesLayer,
  createPowerGridNodesLayer,
  createPowerGridLabelsLayer,
  createSewageLinesLayer,
  createSewageNodesLayer,
  createWaterwayLinesLayer,
  createBasinsLayer,
  createPipelinesLayer,
  createIrrigationLayer,
  createShelterLayer,
} from "./deck-layers";

import AlertBanner from "./AlertBanner";
import TimeSlider from "./TimeSlider";
import DashboardPanel from "../panels/DashboardPanel";
import CommandPanel from "../panels/CommandPanel";
import HealthPredictionPanel from "../panels/HealthPredictionPanel";

import { useARO } from "@/hooks/useARO";
import { getSyntheticPopulation, type ResponseTarget } from "@/lib/response-orchestrator";
import { nearestCityLabel, formatRelativeTime } from "@/lib/map-utils";
import { haversineKm } from "@/lib/safe-zone-engine";
import { useSyncExternalStore } from "react";
import { agentStore, type ResponseUnit } from "@/store/agent-store";
import powerGridNodes from "@/data/power-grid-locations.json";

// ── Map styles ──────────────────────────────────────────────────
type BaseLayer = "light" | "dark" | "satellite";

const MAP_STYLES: Record<BaseLayer, string> = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  satellite: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
};

const INITIAL_VIEW_STATE = {
  longitude: 85.8245,
  latitude: 20.2961,
  zoom: 7,
  pitch: 0,
  bearing: 0,
  minZoom: 6,
  maxZoom: 14,
};

type IncidentScenario = "blackout" | "flood_blackout" | "cyclone" | "earthquake" | "strike";
type RainScenario = "normal" | "rain" | "heavy_rain";

type PowerNode = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  circle: string;
  division: string;
};

type HeatPoint = {
  lat: number; lng: number; weight: number;
  district?: string; riskScore?: number;
};
type HotspotPoint = {
  lat: number; lng: number;
  district?: string; score?: number;
};

type FeedItem = {
  id: string; title: string; detail: string; meta: string;
  latitude?: number; longitude?: number;
};

interface DeckMapViewProps {
  refreshKey?: number;
  onSummaryChange?: (summary: {
    generatedAt: string;
    source: string;
    liveUpdatedAt: string;
    feedItems: FeedItem[];
  }) => void;
}

export default function DeckMapView({ refreshKey = 0, onSummaryChange }: DeckMapViewProps) {
  // ── Map base layer ─────────────────────────────────────────────
  const [baseLayer, setBaseLayer] = useState<BaseLayer>("light");
  const isDark = baseLayer === "dark";

  // ── Layer visibility toggles ───────────────────────────────────
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showFloodZones, setShowFloodZones] = useState(true);
  const [showRivers, setShowRivers] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showDistricts, setShowDistricts] = useState(true);
  // Infrastructure toggles (RESTORED)
  const [showPowerGrid, setShowPowerGrid] = useState(false);
  const [showSewageGrid, setShowSewageGrid] = useState(false);
  const [showWaterways, setShowWaterways] = useState(true);
  const [showBasins, setShowBasins] = useState(false);
  const [showPipelines, setShowPipelines] = useState(false);
  const [showIrrigation, setShowIrrigation] = useState(false);
  const [showShelters, setShowShelters] = useState(false);
  const [showHealthPanel, setShowHealthPanel] = useState(true);

  // ── Simulation controls ────────────────────────────────────────
  const [incidentScenario, setIncidentScenario] = useState<IncidentScenario>("flood_blackout");
  const [rainScenario, setRainScenario] = useState<RainScenario>("normal");

  // ── Panel state ────────────────────────────────────────────────
  const [isLayerPanelMinimized, setIsLayerPanelMinimized] = useState(false);
  const [showARO, setShowARO] = useState(false);

  // ── Time simulation ────────────────────────────────────────────
  const [timeHour, setTimeHour] = useState(0);

  // ── Selection & hover ──────────────────────────────────────────
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictFeature | null>(null);
  const [hoverInfo, setHoverInfo] = useState<any>(null);

  // ── Data from API ──────────────────────────────────────────────
  const [heatmapPoints, setHeatmapPoints] = useState<HeatPoint[]>([]);
  const [hotspotPoints, setHotspotPoints] = useState<HotspotPoint[]>([]);

  // ── User reports & map marking (RESTORED) ──────────────────────
  const [userReports, setUserReports] = useState<any[]>([]);
  const [markedPoint, setMarkedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [liveSource, setLiveSource] = useState("Open-Meteo Marine API");
  const [liveUpdatedAt, setLiveUpdatedAt] = useState("");

  const scenarioRadii = useMemo(
    (): Record<IncidentScenario, { red: number; yellow: number }> => ({
      blackout: { red: 15, yellow: 25 },
      flood_blackout: { red: 20, yellow: 35 },
      cyclone: { red: 30, yellow: 50 },
      earthquake: { red: 22, yellow: 40 },
      strike: { red: 10, yellow: 18 },
    }),
    []
  );

  const scenarioLabels = useMemo(
    (): Record<IncidentScenario, string> => ({
      blackout: "Blackout",
      flood_blackout: "Flood + Blackout",
      cyclone: "Cyclone",
      earthquake: "Earthquake",
      strike: "Strike / Bombing",
    }),
    []
  );

  const allPowerNodes = useMemo(
    () => (powerGridNodes as PowerNode[]).filter((n) => Number.isFinite(n.lat) && Number.isFinite(n.lng)),
    []
  );

  const activeImpact = useMemo(() => {
    if (!markedPoint) return null;
    const radii = scenarioRadii[incidentScenario];
    const inRed = allPowerNodes.filter(
      (n) => haversineKm(markedPoint.lat, markedPoint.lng, n.lat, n.lng) <= radii.red
    );
    const inYellow = allPowerNodes.filter((n) => {
      const d = haversineKm(markedPoint.lat, markedPoint.lng, n.lat, n.lng);
      return d > radii.red && d <= radii.yellow;
    });

    return {
      redKm: radii.red,
      yellowKm: radii.yellow,
      affectedCritical: inRed,
      affectedWarning: inYellow,
    };
  }, [allPowerNodes, incidentScenario, markedPoint, scenarioRadii]);

  // ── View state ─────────────────────────────────────────────────
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  // ── ARO agents ─────────────────────────────────────────────────
  const agents: ResponseUnit[] = useSyncExternalStore(
    (l) => agentStore.subscribe(l),
    () => agentStore.getSnapshot()
  );

  const responseTargets = useMemo((): ResponseTarget[] => {
    return heatmapPoints
      .filter((p) => (p.riskScore || 0) > 0.4)
      .map((p, i) => ({
        id: `cluster-${i}`,
        lat: p.lat, lng: p.lng,
        riskScore: p.riskScore || 0,
        population: getSyntheticPopulation(p.lat, p.lng),
        type: "hazard" as const,
        severity: (
          (p.riskScore || 0) > 0.8 ? "critical" :
          (p.riskScore || 0) > 0.6 ? "high" : "medium"
        ) as ResponseTarget["severity"],
      }));
  }, [heatmapPoints]);

  useARO(showARO, responseTargets);

  // ── Alerts ─────────────────────────────────────────────────────
  const alerts = useMemo(() => generateAlerts(ODISHA_DISTRICTS, timeHour), [timeHour]);
  const timeLabel = useMemo(() => getTimeMultiplier(timeHour).label, [timeHour]);

  // ── Map click handler — mark hazard point ──────────────────────
  const handleMapClick = useCallback((info: any) => {
    // First check if a district polygon was clicked (for panel data)
    if (info.object?.properties) {
      const name = info.object.properties.name;
      const district = ODISHA_DISTRICTS.find((d) => d.name === name);
      if (district) {
        setSelectedDistrict(district);
        return;
      }
    }
    // Otherwise, mark a hazard point on the map
    if (info.coordinate) {
      const [lng, lat] = info.coordinate;
      setMarkedPoint({ lat, lng });
      window.dispatchEvent(
        new CustomEvent("floodmind:map-mark", { detail: { lat, lng } })
      );
    }
  }, []);

  // ── Load reports, flood feed, and heatmap (RESTORED) ───────────
  useEffect(() => {
    let isCancelled = false;

    const loadReports = async () => {
      let merged: any[] = [];
      if (typeof window !== "undefined") {
        merged = JSON.parse(localStorage.getItem("neptune_user_reports") || "[]");
      }
      try {
        const res = await fetch("/api/reports", { cache: "no-store" });
        if (res.ok) {
          const remote = await res.json();
          merged = Array.isArray(remote) && remote.length ? remote : merged;
        }
      } catch (error) { console.error("Failed to load reports", error); }
      if (typeof window !== "undefined") {
        localStorage.setItem("neptune_user_reports", JSON.stringify(merged));
      }
      if (!isCancelled) setUserReports(merged);
    };

    const loadFloodFeed = async () => {
      try {
        const response = await fetch("/api/flood-feed", { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json();
          if (!isCancelled) {
            setLiveSource(payload.source);
            setLiveUpdatedAt(payload.generatedAt);
          }
        }
      } catch { /* Fallback handled in initial state */ }
    };

    const loadHeatmap = async () => {
      try {
        const apiHazard = incidentScenario === "cyclone" || incidentScenario === "earthquake" ? incidentScenario : "flood";
        const params = new URLSearchParams({ hazard: apiHazard });
        if (apiHazard === "flood") params.set("scenario", rainScenario);
        const response = await fetch(`/api/odisha-heatmap?${params.toString()}`, { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json();
          if (!isCancelled) {
            setHeatmapPoints(payload.points || []);
            setHotspotPoints(payload.hotspots || []);
          }
        }
      } catch (error) { console.error("Failed to load heatmap", error); }
    };

    loadReports();
    loadFloodFeed();
    loadHeatmap();

    const reportInterval = setInterval(loadReports, 5000);
    return () => { isCancelled = true; clearInterval(reportInterval); };
  }, [refreshKey, incidentScenario, rainScenario]);

  // ── Push summary to parent (the feed system) ──────────────────
  useEffect(() => {
    if (typeof onSummaryChange !== "function") return;
    const sortedReports = [...userReports].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const latestReport = sortedReports[0];
    const latestCity = latestReport
      ? nearestCityLabel(Number(latestReport.latitude), Number(latestReport.longitude))
      : null;
    const latestCityName = latestCity?.name || "Bhubaneswar";

    const feedItems: FeedItem[] = latestReport
      ? [{
          id: `report-${latestReport.id}`,
          title: `Flood risk reported near ${latestCityName}`,
          detail: `${String(latestReport.type || "incident").replace(/_/g, " ")} detected at ${formatRelativeTime(latestReport.timestamp)}.`,
          meta: latestReport.severity ? `Severity ${latestReport.severity}/5` : "New report",
          latitude: Number(latestReport.latitude),
          longitude: Number(latestReport.longitude),
        }]
      : [];

    onSummaryChange({
      generatedAt: new Date().toISOString(),
      source: liveSource,
      liveUpdatedAt,
      feedItems,
    });
  }, [liveSource, liveUpdatedAt, onSummaryChange, userReports]);

  // ── Delete citizen report ──────────────────────────────────────
  const deleteCitizenReport = useCallback(async (reportId: string) => {
    const remaining = userReports.filter((r) => r.id !== reportId);
    setUserReports(remaining);
    localStorage.setItem("neptune_user_reports", JSON.stringify(remaining));
    await fetch(`/api/reports?id=${encodeURIComponent(String(reportId))}`, { method: "DELETE" });
  }, [userReports]);

  // ── Hover handler ──────────────────────────────────────────────
  const onHover = useCallback((info: any) => {
    if (info.object?.properties) {
      setHoverInfo({
        x: info.x, y: info.y,
        name: info.object.properties.name,
        riskScore: info.object.properties.riskScore,
        riskLevel: info.object.properties.riskLevel,
        rainfall: info.object.properties.rainfall7d?.[6] ?? "--",
      });
    } else {
      setHoverInfo(null);
    }
  }, []);

  // ── Deck.gl Layers ─────────────────────────────────────────────
  const layers = useMemo(() => {
    const list: any[] = [];

    if (showFloodZones) list.push(createFloodZoneLayer(timeHour, onHover, handleMapClick));
    if (showDistricts)  list.push(createDistrictOutlineLayer(timeHour));
    if (showRivers)     list.push(createRiverLayer());

    if (showHeatmap) {
      const hm = createRiskHeatmapLayer(heatmapPoints);
      if (hm) list.push(hm);
    }
    if (showHotspots && hotspotPoints.length > 0) {
      list.push(createHotspotLayer(hotspotPoints));
    }
    if (showARO && agents.length > 0) {
      list.push(createAgentLayer(agents));
    }

    // ── Infrastructure layers (RESTORED) ─────────────────────────
    if (showPowerGrid) {
      list.push(createPowerGridLinesLayer());
      list.push(createPowerGridNodesLayer());
      list.push(createPowerGridLabelsLayer());
    }
    if (showSewageGrid) {
      list.push(createSewageLinesLayer());
      list.push(createSewageNodesLayer());
    }
    if (showWaterways) {
      list.push(createWaterwayLinesLayer());
    }
    if (showBasins) {
      list.push(createBasinsLayer());
    }
    if (showPipelines) {
      list.push(createPipelinesLayer());
    }
    if (showIrrigation) {
      list.push(createIrrigationLayer());
    }
    if (showShelters) {
      list.push(createShelterLayer());
    }

    // ── User report markers ──────────────────────────────────────
    if (userReports.length > 0) {
      list.push(
        new ScatterplotLayer({
          id: "user-reports",
          data: userReports.filter((r) => r.latitude != null && r.longitude != null),
          pickable: true,
          opacity: 0.9,
          stroked: true,
          filled: true,
          radiusMinPixels: 6,
          radiusMaxPixels: 14,
          getPosition: (d: any) => [Number(d.longitude), Number(d.latitude)],
          getRadius: 600,
          getFillColor: [239, 68, 68, 180],
          getLineColor: [255, 255, 255, 220],
          getLineWidth: 2,
        })
      );
    }

    // ── Marked hazard point ──────────────────────────────────────
    if (markedPoint) {
      list.push(
        new ScatterplotLayer({
          id: "marked-point",
          data: [markedPoint],
          pickable: false,
          opacity: 1,
          stroked: true,
          filled: true,
          radiusMinPixels: 10,
          radiusMaxPixels: 16,
          getPosition: (d: any) => [d.lng, d.lat],
          getRadius: 400,
          getFillColor: [220, 38, 38, 200],
          getLineColor: [255, 255, 255, 255],
          getLineWidth: 3,
        })
      );

      if (activeImpact) {
        list.push(
          new ScatterplotLayer({
            id: "impact-zone-yellow",
            data: [{ ...markedPoint, radiusKm: activeImpact.yellowKm }],
            pickable: false,
            opacity: 0.12,
            stroked: true,
            filled: true,
            radiusMinPixels: 0,
            radiusMaxPixels: 2000,
            getPosition: (d: any) => [d.lng, d.lat],
            getRadius: (d: any) => d.radiusKm * 1000,
            getFillColor: [234, 179, 8, 90],
            getLineColor: [234, 179, 8, 210],
            getLineWidth: 2,
          })
        );
        list.push(
          new ScatterplotLayer({
            id: "impact-zone-red",
            data: [{ ...markedPoint, radiusKm: activeImpact.redKm }],
            pickable: false,
            opacity: 0.18,
            stroked: true,
            filled: true,
            radiusMinPixels: 0,
            radiusMaxPixels: 1200,
            getPosition: (d: any) => [d.lng, d.lat],
            getRadius: (d: any) => d.radiusKm * 1000,
            getFillColor: [239, 68, 68, 100],
            getLineColor: [239, 68, 68, 230],
            getLineWidth: 2,
          })
        );
      }
    }

    if (activeImpact && showPowerGrid && activeImpact.affectedCritical.length > 0) {
      list.push(
        new ScatterplotLayer({
          id: "affected-power-critical",
          data: activeImpact.affectedCritical,
          pickable: true,
          opacity: 0.95,
          stroked: true,
          filled: true,
          radiusMinPixels: 8,
          radiusMaxPixels: 18,
          getPosition: (d: any) => [d.lng, d.lat],
          getRadius: 800,
          getFillColor: [220, 38, 38, 220],
          getLineColor: [255, 255, 255, 240],
          getLineWidth: 2,
        })
      );
    }

    if (activeImpact && showPowerGrid && activeImpact.affectedWarning.length > 0) {
      list.push(
        new ScatterplotLayer({
          id: "affected-power-warning",
          data: activeImpact.affectedWarning,
          pickable: true,
          opacity: 0.9,
          stroked: true,
          filled: true,
          radiusMinPixels: 6,
          radiusMaxPixels: 14,
          getPosition: (d: any) => [d.lng, d.lat],
          getRadius: 650,
          getFillColor: [245, 158, 11, 210],
          getLineColor: [255, 255, 255, 220],
          getLineWidth: 2,
        })
      );
    }

    return list;
  }, [timeHour, heatmapPoints, hotspotPoints, showARO, agents, onHover, handleMapClick,
      showFloodZones, showDistricts, showRivers, showHeatmap, showHotspots,
      showPowerGrid, showSewageGrid, showWaterways, showBasins, showPipelines, showIrrigation, showShelters,
      userReports, markedPoint, activeImpact]);

  // ── Panel styling (adapts to theme) ────────────────────────────
  const panelBg = isDark ? "rgba(15, 23, 42, 0.92)" : "rgba(255, 255, 255, 0.95)";
  const panelBorder = isDark ? "rgba(51, 65, 85, 0.4)" : "rgba(229, 231, 235, 1)";
  const panelText = isDark ? "#e2e8f0" : "#374151";
  const panelMuted = isDark ? "#64748b" : "#9ca3af";
  const panelToggleBg = isDark ? "rgba(51, 65, 85, 0.3)" : "rgba(243, 244, 246, 1)";
  const tooltipBg = isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.97)";
  const tooltipBorder = isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(229, 231, 235, 1)";
  const tooltipText = isDark ? "#f1f5f9" : "#111827";
  const tooltipMuted = isDark ? "#64748b" : "#6b7280";
  const accentColor = isDark ? "#38bdf8" : "var(--teal, #00b4b4)";

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: isDark ? "#020617" : "#f8f9fa" }}>
      {/* ── Map Area ──────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <DeckGL
          viewState={viewState}
          onViewStateChange={({ viewState: vs }: any) => setViewState(vs)}
          controller={true}
          layers={layers}
          getCursor={({ isHovering }: any) => (isHovering ? "pointer" : "grab")}
          onClick={(info: any) => {
            // Fallback click for marking when no object hit
            if (!info.object && info.coordinate) {
              const [lng, lat] = info.coordinate;
              setMarkedPoint({ lat, lng });
              window.dispatchEvent(
                new CustomEvent("floodmind:map-mark", { detail: { lat, lng } })
              );
            }
          }}
          style={{ position: "absolute" as const, top: "0px", left: "0px", right: "0px", bottom: "0px" }}
        >
          <MapLibreMap mapStyle={MAP_STYLES[baseLayer]} attributionControl={false} />
        </DeckGL>

        {/* Alert Banner */}
        <AlertBanner alerts={alerts} />

        {/* ARO Toggle */}
        <button
          onClick={() => setShowARO(!showARO)}
          style={{
            position: "absolute", top: 16, left: 16, zIndex: 100,
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 16px", borderRadius: 10,
            background: showARO ? "rgba(14, 165, 233, 0.2)" : isDark ? "rgba(15, 23, 42, 0.8)" : "rgba(255,255,255,0.9)",
            border: `1px solid ${showARO ? "rgba(56, 189, 248, 0.5)" : panelBorder}`,
            backdropFilter: "blur(12px)",
            color: showARO ? "#38bdf8" : panelMuted,
            fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
            transition: "all 0.2s", letterSpacing: "0.05em",
          }}
        >
          📡 {showARO ? "ARO ACTIVE" : "ACTIVATE ARO"}
        </button>

        {/* Marked point clear button */}
        {markedPoint && (
          <button
            onClick={() => setMarkedPoint(null)}
            style={{
              position: "absolute", top: 56, left: 16, zIndex: 100,
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8,
              background: isDark ? "rgba(220, 38, 38, 0.15)" : "rgba(220, 38, 38, 0.1)",
              border: "1px solid rgba(220, 38, 38, 0.3)",
              backdropFilter: "blur(12px)",
              color: "#ef4444", fontSize: "0.68rem", fontWeight: 700,
              cursor: "pointer", transition: "all 0.2s",
            }}
          >
            <MapPin size={12} /> {markedPoint.lat.toFixed(4)}, {markedPoint.lng.toFixed(4)} — Clear Pin
          </button>
        )}

        {/* ── LAYER MANAGER PANEL ─────────────────────────────── */}
        <div style={{
          position: "absolute", top: 16, right: 16, zIndex: 100,
          width: isLayerPanelMinimized ? 170 : 300,
          padding: isLayerPanelMinimized ? "12px 16px" : "20px",
          background: panelBg, border: `1px solid ${panelBorder}`,
          borderRadius: 12, backdropFilter: "blur(16px)",
          transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.08)",
        }}>
          <div
            onClick={() => setIsLayerPanelMinimized(!isLayerPanelMinimized)}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              cursor: "pointer", userSelect: "none",
            }}
          >
            <div style={{
              fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.1em", color: panelMuted,
              display: "flex", alignItems: "center", gap: 8
            }}>
              <Layers size={14} /> {isLayerPanelMinimized ? "LAYERS" : "INTELLIGENCE LAYERS"}
            </div>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 22, height: 22, borderRadius: 6, background: panelToggleBg,
              color: panelMuted, border: `1px solid ${panelBorder}`, cursor: "pointer",
            }}>
              {isLayerPanelMinimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </div>
          </div>

          <div style={{
            maxHeight: isLayerPanelMinimized ? 0 : 1200,
            opacity: isLayerPanelMinimized ? 0 : 1,
            marginTop: isLayerPanelMinimized ? 0 : 12,
            overflow: "hidden",
            transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
            pointerEvents: isLayerPanelMinimized ? "none" : "auto",
          }}>
            {/* Map Style */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: "0.6rem", color: panelMuted, marginBottom: 8, fontWeight: 700 }}>MAP STYLE</div>
              <div style={{ display: "flex", gap: 4 }}>
                {([["light", "Light"], ["dark", "Dark"], ["satellite", "Voyager"]] as [BaseLayer, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => setBaseLayer(key)}
                    style={{
                      flex: 1, padding: "6px", borderRadius: 6, fontSize: "0.7rem", fontWeight: 600,
                      background: baseLayer === key ? accentColor : panelToggleBg,
                      color: baseLayer === key ? "#fff" : panelMuted,
                      border: `1px solid ${panelBorder}`, cursor: "pointer", transition: "all 0.2s",
                    }}
                  >{label}</button>
                ))}
              </div>
            </div>

            {/* Simulation Mode */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: "0.6rem", color: panelMuted, marginBottom: 8, fontWeight: 700 }}>SIMULATION MODE</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {(["flood_blackout", "blackout", "cyclone", "earthquake", "strike"] as IncidentScenario[]).map((mode) => (
                  <button key={mode} onClick={() => setIncidentScenario(mode)}
                    style={{
                      flex: 1, padding: "6px", borderRadius: 6, fontSize: "0.7rem", fontWeight: 600,
                      textTransform: "capitalize",
                      background: incidentScenario === mode ? accentColor : panelToggleBg,
                      color: incidentScenario === mode ? "#fff" : panelMuted,
                      border: `1px solid ${panelBorder}`, cursor: "pointer", transition: "all 0.2s",
                    }}
                  >{scenarioLabels[mode]}</button>
                ))}
              </div>
            </div>

            {/* Rain Intensity */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: "0.6rem", color: panelMuted, marginBottom: 8, fontWeight: 700 }}>RAIN INTENSITY</div>
              <div style={{ display: "flex", gap: 4 }}>
                {(["normal", "rain", "heavy_rain"] as RainScenario[]).map((scen) => (
                  <button key={scen} onClick={() => setRainScenario(scen)}
                    style={{
                      flex: 1, padding: "6px", borderRadius: 6, fontSize: "0.7rem", fontWeight: 600,
                      textTransform: "capitalize",
                      background: rainScenario === scen ? (isDark ? "#f59e0b" : "var(--warning, #F97316)") : panelToggleBg,
                      color: rainScenario === scen ? "#fff" : panelMuted,
                      border: `1px solid ${panelBorder}`, cursor: "pointer", transition: "all 0.2s",
                    }}
                  >{scen.replace("_", " ")}</button>
                ))}
              </div>
            </div>

            {/* Layer Toggles */}
            <div style={{ fontSize: "0.6rem", color: panelMuted, marginBottom: 6, marginTop: 4, fontWeight: 700 }}>ANALYSIS LAYERS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {[
                { label: "Heatmap View", state: showHeatmap, toggle: setShowHeatmap, icon: <Activity size={14} color="#f97316" /> },
                { label: "Flood Zones", state: showFloodZones, toggle: setShowFloodZones, icon: <Droplet size={14} color="#3b82f6" /> },
                { label: "Rivers", state: showRivers, toggle: setShowRivers, icon: <Droplet size={14} color="#60a5fa" /> },
                { label: "District Borders", state: showDistricts, toggle: setShowDistricts, icon: <MapIcon size={14} color="#0ea5e9" /> },
                { label: "Hotspot Alerts", state: showHotspots, toggle: setShowHotspots, icon: <Shield size={14} color="#ef4444" /> },
              ].map((layer, idx) => (
                <label key={`a-${idx}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    cursor: "pointer", userSelect: "none", fontSize: "0.82rem",
                    color: panelText, padding: "5px 10px", borderRadius: 8,
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = panelToggleBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <input type="checkbox" checked={layer.state} onChange={() => layer.toggle(!layer.state)} style={{ display: "none" }} />
                  <div style={{
                    width: 16, height: 16,
                    border: `2px solid ${layer.state ? accentColor : panelBorder}`,
                    background: layer.state ? accentColor : "transparent",
                    borderRadius: 3, flexShrink: 0, position: "relative", transition: "all 0.2s",
                  }}>
                    {layer.state && (
                      <div style={{
                        position: "absolute", top: 1, left: 4, width: 4, height: 7,
                        border: "solid white", borderWidth: "0 2px 2px 0", transform: "rotate(45deg)",
                      }} />
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    {layer.icon}
                    <span style={{ fontWeight: 500, fontSize: "0.78rem" }}>{layer.label}</span>
                  </div>
                </label>
              ))}
            </div>

            {/* Infrastructure Layers */}
            <div style={{ fontSize: "0.6rem", color: panelMuted, marginBottom: 6, marginTop: 12, fontWeight: 700 }}>INFRASTRUCTURE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {[
                { label: "⚡ Power Grid", state: showPowerGrid, toggle: setShowPowerGrid, icon: <Zap size={14} color="#f59e0b" /> },
                { label: "🚰 Sewage Grid", state: showSewageGrid, toggle: setShowSewageGrid, icon: <Cable size={14} color="#10b981" /> },
                { label: "🌊 Waterways", state: showWaterways, toggle: setShowWaterways, icon: <Droplet size={14} color="#06b6d4" /> },
                { label: "🗺️ Basins", state: showBasins, toggle: setShowBasins, icon: <MapIcon size={14} color="#1e40af" /> },
                { label: "🔧 Pipelines", state: showPipelines, toggle: setShowPipelines, icon: <Navigation size={14} color="#0ea5e9" /> },
                { label: "🌾 Irrigation", state: showIrrigation, toggle: setShowIrrigation, icon: <Droplet size={14} color="#2563eb" /> },
                { label: "🏛️ Shelters", state: showShelters, toggle: setShowShelters, icon: <Home size={14} color="#22c55e" /> },
              ].map((layer, idx) => (
                <label key={`i-${idx}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    cursor: "pointer", userSelect: "none", fontSize: "0.82rem",
                    color: panelText, padding: "5px 10px", borderRadius: 8,
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = panelToggleBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <input type="checkbox" checked={layer.state} onChange={() => layer.toggle(!layer.state)} style={{ display: "none" }} />
                  <div style={{
                    width: 16, height: 16,
                    border: `2px solid ${layer.state ? accentColor : panelBorder}`,
                    background: layer.state ? accentColor : "transparent",
                    borderRadius: 3, flexShrink: 0, position: "relative", transition: "all 0.2s",
                  }}>
                    {layer.state && (
                      <div style={{
                        position: "absolute", top: 1, left: 4, width: 4, height: 7,
                        border: "solid white", borderWidth: "0 2px 2px 0", transform: "rotate(45deg)",
                      }} />
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    {layer.icon}
                    <span style={{ fontWeight: 500, fontSize: "0.78rem" }}>{layer.label}</span>
                  </div>
                </label>
              ))}
            </div>

            {/* Systems */}
            <div style={{ fontSize: "0.6rem", color: panelMuted, marginBottom: 6, marginTop: 12, fontWeight: 700 }}>SYSTEMS</div>
            <label
              style={{
                display: "flex", alignItems: "center", gap: 10,
                cursor: "pointer", userSelect: "none", fontSize: "0.82rem",
                color: panelText, padding: "5px 10px", borderRadius: 8,
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = panelToggleBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <input type="checkbox" checked={showHealthPanel} onChange={() => setShowHealthPanel(!showHealthPanel)} style={{ display: "none" }} />
              <div style={{
                width: 16, height: 16,
                border: `2px solid ${showHealthPanel ? "#ef4444" : panelBorder}`,
                background: showHealthPanel ? "#ef4444" : "transparent",
                borderRadius: 3, flexShrink: 0, position: "relative", transition: "all 0.2s",
              }}>
                {showHealthPanel && (
                  <div style={{
                    position: "absolute", top: 1, left: 4, width: 4, height: 7,
                    border: "solid white", borderWidth: "0 2px 2px 0", transform: "rotate(45deg)",
                  }} />
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                <Heart size={14} color="#ef4444" />
                <span style={{ fontWeight: 500, fontSize: "0.78rem" }}>🏥 Health Predictor</span>
              </div>
            </label>
          </div>
        </div>

        {/* ── LEGEND ──────────────────────────────────────────── */}
        <div style={{
          position: "absolute", bottom: 80, left: 16, zIndex: 100,
          padding: 16, borderRadius: 12,
          background: panelBg, border: `1px solid ${panelBorder}`,
          backdropFilter: "blur(16px)", width: 200,
          boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.08)",
        }}>
          <div style={{
            fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.1em", color: panelMuted,
            display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
          }}>
            <Activity size={14} /> RISK LEGEND
          </div>
          {[
            { label: "Critical Risk (>0.8)", color: "#EF4444" },
            { label: "High Risk (0.6–0.8)", color: "#F97316" },
            { label: "Medium Risk (0.4–0.6)", color: "#FBBF24" },
            { label: "Low Risk (<0.4)", color: "#22C55E" },
          ].map((item) => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", gap: 10,
              fontSize: "0.78rem", marginBottom: 6, color: panelText, fontWeight: 500,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
              <span>{item.label}</span>
            </div>
          ))}
          <div style={{
            marginTop: 10, paddingTop: 10,
            borderTop: `1px solid ${panelBorder}`,
            fontSize: "0.65rem", color: panelMuted,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <MapPin size={10} /> Click map to mark hazard
          </div>
          {markedPoint && activeImpact && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: `1px solid ${panelBorder}`,
                fontSize: "0.68rem",
                color: panelText,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <strong style={{ fontSize: "0.65rem", color: panelMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Grid Impact ({scenarioLabels[incidentScenario]})
              </strong>
              <span>Red Zone ({activeImpact.redKm} km): {activeImpact.affectedCritical.length} stations at shutdown risk</span>
              <span>Yellow Zone ({activeImpact.yellowKm} km): {activeImpact.affectedWarning.length} stations degraded</span>
              {!showPowerGrid && (
                <span style={{ color: "#f59e0b" }}>Enable Power Grid layer to see impacted substations.</span>
              )}
            </div>
          )}
        </div>

        {/* Hover Tooltip */}
        {hoverInfo && (
          <div style={{
            position: "absolute", left: hoverInfo.x + 12, top: hoverInfo.y - 12,
            zIndex: 100, pointerEvents: "none",
            padding: "10px 14px", borderRadius: 10,
            background: tooltipBg, border: `1px solid ${tooltipBorder}`,
            backdropFilter: "blur(16px)", minWidth: 160,
          }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: tooltipText, marginBottom: 6 }}>
              {hoverInfo.name}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: "0.68rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: tooltipMuted }}>Risk Level</span>
                <span style={{
                  color: hoverInfo.riskLevel === "critical" ? "#ef4444" :
                         hoverInfo.riskLevel === "high" ? "#f59e0b" :
                         hoverInfo.riskLevel === "medium" ? "#eab308" : "#22c55e",
                  fontWeight: 700, textTransform: "uppercase",
                }}>{hoverInfo.riskLevel}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: tooltipMuted }}>Risk Score</span>
                <span style={{ color: tooltipText, fontWeight: 700, fontFamily: "monospace" }}>
                  {(hoverInfo.riskScore * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: tooltipMuted }}>Today Rainfall</span>
                <span style={{ color: "#38bdf8", fontWeight: 600 }}>{hoverInfo.rainfall}mm</span>
              </div>
            </div>
          </div>
        )}

        {/* Time Slider */}
        <TimeSlider value={timeHour} onChange={setTimeHour} label={timeLabel} />

        {/* Health Prediction Panel */}
        <HealthPredictionPanel
          visible={showHealthPanel}
          isDark={isDark}
          markedPoint={markedPoint}
          riskZones={ODISHA_DISTRICTS.map((d) => {
            // Compute polygon centroid from coordinates
            const ring = d.coordinates[0] || [];
            const avgLng = ring.reduce((s, c) => s + c[0], 0) / (ring.length || 1);
            const avgLat = ring.reduce((s, c) => s + c[1], 0) / (ring.length || 1);
            return { lat: avgLat, lng: avgLng, riskScore: d.riskScore, name: d.name };
          })}
          onFlyTo={(lat, lng) => setViewState((vs) => ({ ...vs, latitude: lat, longitude: lng, zoom: 12 }))}
        />
      </div>

      {/* ── Right Panel ───────────────────────────────────────── */}
      <div style={{ width: 360, minWidth: 360, height: "100%", display: "flex", flexDirection: "column" }}>
        {showARO ? (
          <CommandPanel />
        ) : (
          <DashboardPanel
            selectedDistrict={selectedDistrict}
            onClose={() => setSelectedDistrict(null)}
            timeHour={timeHour}
            allDistricts={ODISHA_DISTRICTS}
          />
        )}
      </div>
    </div>
  );
}
