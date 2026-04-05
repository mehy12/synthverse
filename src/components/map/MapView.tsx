import { Fragment, useState, useEffect, useMemo, useCallback } from "react";
import {
  MapContainer,
  CircleMarker,
  Marker,
  Tooltip,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { 
  Layers, 
  Map as MapIcon, 
  Droplet, 
  Zap, 
  Wind, 
  Flame, 
  Shield, 
  Activity, 
  ChevronDown, 
  ChevronUp,
  MapPin,
  Info
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./MapView.module.css";
import cachedCurrentVectors from "@/data/current-vectors.json";
import HeatmapLayer from "./HeatmapLayer";
import Digital3DTwin from "./Digital3DTwin";
import SafeZoneOverlay from "./SafeZoneOverlay";

// New Modular Layers
import WaterwayLayer from "./layers/WaterwayLayer";
import InfrastructureLayer from "./layers/InfrastructureLayer";
import TelemetryLayer from "./layers/TelemetryLayer";
import AgentsLayer from "./layers/AgentsLayer";

// AI Response Orchestrator
import CommandPanel from "../panels/CommandPanel";
import { useARO } from "@/hooks/useARO";
import { getSyntheticPopulation, ResponseTarget } from "@/lib/response-orchestrator";

// Utilities and Data
import { haversineKm, formatRelativeTime, nearestCityLabel, evaluateWaterHealth } from "@/lib/map-utils";

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// ── Odisha Flood Logic & Fallback Data ──
const ODISHA_BOUNDS: [[number, number], [number, number]] = [
  [17.6, 81.6],
  [22.9, 87.7],
];
const ODISHA_CENTER: [number, number] = [20.2961, 85.8245];

const LIVE_CURRENT_DATA = cachedCurrentVectors as {
  metadata: { source: string; region: string; date: string };
  vectors: Array<{ lat: number; lon: number; u: number; v: number; speed: number; dir: number }>;
};

type BaseLayer = "light" | "satellite" | "terrain";

type FeedItem = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  latitude?: number;
  longitude?: number;
};
type HeatPoint = {
  lat: number;
  lng: number;
  weight: number;
  district?: string;
  riskScore?: number;
};
type HotspotPoint = {
  lat: number;
  lng: number;
  district?: string;
  score?: number;
};
type RainScenario = "normal" | "rain" | "heavy_rain";
type HazardMode = "flood" | "cyclone" | "earthquake";

// Internal evacuation zones (Telemetry)
const EVACUATION_ZONES = [
  { name: "Chilika Basin South", lat: 19.645, lng: 85.22, waterQuality: 78 },
  { name: "Mahanadi Delta East", lat: 20.32, lng: 86.41, waterQuality: 42 },
  { name: "Brahmani Mouth", lat: 20.81, lng: 86.85, waterQuality: 31 },
  { name: "Hirakud Reservoir Area", lat: 21.53, lng: 83.87, waterQuality: 92 },
  { name: "Gopalpur Coast", lat: 19.25, lng: 84.9, waterQuality: 65 },
];

interface MapViewProps {
  refreshKey?: number;
  onSummaryChange?: (summary: {
    generatedAt: string;
    source: string;
    liveUpdatedAt: string;
    feedItems: FeedItem[];
  }) => void;
}

// Bounds enforcer for Odisha
function BoundsEnforcer() {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds(ODISHA_BOUNDS);
    map.setMaxBounds(bounds);
    map.on("drag", () => {
      map.panInsideBounds(bounds, { animate: false });
    });
  }, [map]);
  return null;
}

function getNodeThumbnailUrl(lat: number, lng: number): string {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=14&size=240x140&maptype=mapnik&markers=${lat},${lng},red-pushpin`;
}

function getStoredNodePhotos() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(
      localStorage.getItem("neptune_recent_node_photos") || "[]",
    );
  } catch {
    return [];
  }
}

function getNodeImageSource(
  lat: number,
  lng: number,
  userReports: any[],
  recentPhotos: any[],
): { src: string; label: string } {
  const nearbyImageHits = [...recentPhotos, ...userReports]
    .filter(
      (report) =>
        report?.imageBase64 &&
        report?.latitude != null &&
        report?.longitude != null &&
        report?.timestamp,
    )
    .map((report) => ({
      report,
      distanceKm: haversineKm(
        lat,
        lng,
        Number(report.latitude),
        Number(report.longitude),
      ),
      ageMs: Date.now() - new Date(report.timestamp).getTime(),
    }))
    .filter(
      ({ distanceKm, ageMs }) =>
        distanceKm <= 5 && ageMs >= 0 && ageMs <= 24 * 60 * 60 * 1000,
    )
    .sort((left, right) => {
      if (left.ageMs !== right.ageMs) return left.ageMs - right.ageMs;
      return left.distanceKm - right.distanceKm;
    })[0];

  if (nearbyImageHits) {
    return {
      src: nearbyImageHits.report.imageBase64,
      label:
        nearbyImageHits.report.source === "analyzed_upload"
          ? "Recent analyzed upload"
          : "Recent nearby user photo",
    };
  }

  return { src: getNodeThumbnailUrl(lat, lng), label: "Place thumbnail" };
}

function NodeThumbnail({
  title,
  lat,
  lng,
  userReports,
  recentPhotos,
}: {
  title: string;
  lat: number;
  lng: number;
  userReports: any[];
  recentPhotos: any[];
}) {
  const image = getNodeImageSource(lat, lng, userReports, recentPhotos);

  return (
    <div
      style={{
        width: "176px",
        background: "#fff",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <img
        src={image.src}
        alt={title}
        style={{
          display: "block",
          width: "100%",
          height: "98px",
          objectFit: "cover",
        }}
      />
      <div
        style={{
          padding: "8px 10px 2px",
          fontSize: "0.78rem",
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </div>
      <div
        style={{
          padding: "0 10px 10px",
          fontSize: "0.68rem",
          color: "var(--text-secondary)",
        }}
      >
        {image.label}
      </div>
    </div>
  );
}

function BaseMapLayer({ baseLayer }: { baseLayer: BaseLayer }) {
  const { TileLayer } = require("react-leaflet"); 
  if (baseLayer === "satellite") {
    return (
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri"
        maxZoom={19}
      />
    );
  }
  if (baseLayer === "terrain") {
    return (
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri"
        maxZoom={19}
      />
    );
  }
  return (
    <TileLayer
      url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      maxZoom={20}
      zIndex={1}
    />
  );
}

function MapFocusController({
  focusTarget,
}: {
  focusTarget: { lat: number; lng: number; zoom?: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!focusTarget) return;
    map.flyTo([focusTarget.lat, focusTarget.lng], focusTarget.zoom ?? 12, {
      duration: 1.2,
    });
  }, [focusTarget, map]);
  return null;
}

function MapClickHandler({ onMark }: { onMark: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMark(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapView({
  refreshKey = 0,
  onSummaryChange,
}: MapViewProps) {
  const [baseLayer, setBaseLayer] = useState<BaseLayer>("light");
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [show3DTwin, setShow3DTwin] = useState(false);
  const [showWaterways, setShowWaterways] = useState(true);
  const [showFloodChannels, setShowFloodChannels] = useState(true);
  const [showEvacZones, setShowEvacZones] = useState(true);
  const [showWaterBasins, setShowWaterBasins] = useState(true);
  const [showIrrigationChannels, setShowIrrigationChannels] = useState(true);
  const [showSewageLines, setShowSewageLines] = useState(false);
  const [showPowerGrid, setShowPowerGrid] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [showARO, setShowARO] = useState(false);
  const [enableProbe, setEnableProbe] = useState(false);
  const [probeSnapshot, setProbeSnapshot] = useState<any | null>(null);
  const [userReports, setUserReports] = useState<any[]>([]);
  const [recentNodePhotos, setRecentNodePhotos] = useState<any[]>([]);
  const [liveZones, setLiveZones] = useState<any[]>(
    EVACUATION_ZONES.map((zone) => ({
      ...zone,
      currentVelocity: 0,
      currentDirection: 0,
      qualityScore: zone.waterQuality,
      liveUpdatedAt: LIVE_CURRENT_DATA.metadata.date,
    })),
  );
  const [liveSource, setLiveSource] = useState("Open-Meteo Marine API");
  const [liveUpdatedAt, setLiveUpdatedAt] = useState(
    LIVE_CURRENT_DATA.metadata.date,
  );
  const [hazardMode, setHazardMode] = useState<HazardMode>("flood");
  const [rainScenario, setRainScenario] = useState<RainScenario>("normal");
  const [heatmapPoints, setHeatmapPoints] = useState<HeatPoint[]>([]);
  const [hotspotPoints, setHotspotPoints] = useState<HotspotPoint[]>([]);
  const [focusTarget, setFocusTarget] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
  } | null>(null);
  const [markedPoint, setMarkedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [isLayerPanelMinimized, setIsLayerPanelMinimized] = useState(false);

  const handleMapMark = useCallback((lat: number, lng: number) => {
    setMarkedPoint({ lat, lng });
    // Emit event for reporting panel
    window.dispatchEvent(new CustomEvent("floodmind:map-mark", { 
      detail: { lat, lng } 
    }));
  }, []);

  const responseTargets = useMemo((): ResponseTarget[] => {
    return heatmapPoints.filter(p => (p.riskScore || 0) > 0.4).map((p, i) => ({
      id: `cluster-${i}`,
      lat: p.lat,
      lng: p.lng,
      riskScore: p.riskScore || 0,
      population: getSyntheticPopulation(p.lat, p.lng),
      type: "hazard",
      severity: ((p.riskScore || 0) > 0.8 ? "critical" : (p.riskScore || 0) > 0.6 ? "high" : "medium") as ResponseTarget["severity"]
    }));
  }, [heatmapPoints]);

  useARO(showARO, responseTargets);

  // Load reports and flood feed on mount
  useEffect(() => {
    let isCancelled = false;

    const loadReports = async () => {
      let merged: any[] = [];
      if (typeof window !== "undefined") {
        merged = JSON.parse(localStorage.getItem("neptune_user_reports") || "[]");
        setRecentNodePhotos(getStoredNodePhotos());
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
            setLiveZones(payload.zones);
            setLiveSource(payload.source);
            setLiveUpdatedAt(payload.generatedAt);
          }
        }
      } catch { /* Fallback handled in initial state */ }
    };

    const loadHeatmap = async () => {
      try {
        const params = new URLSearchParams({ hazard: hazardMode });
        if (hazardMode === "flood") params.set("scenario", rainScenario);
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
    return () => {
      isCancelled = true;
      clearInterval(reportInterval);
    };
  }, [refreshKey, rainScenario, hazardMode]);

  useEffect(() => {
    if (typeof onSummaryChange !== "function") return;
    const sortedReports = [...userReports].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const latestReport = sortedReports[0];
    const latestCity = latestReport ? nearestCityLabel(Number(latestReport.latitude), Number(latestReport.longitude)) : null;
    const latestCityName = latestCity?.name || "Bhubaneswar";

    const feedItems: FeedItem[] = latestReport ? [{
      id: `report-${latestReport.id}`,
      title: `Flood risk reported near ${latestCityName}`,
      detail: `${String(latestReport.type || "incident").replace(/_/g, " ")} detected at ${formatRelativeTime(latestReport.timestamp)}.`,
      meta: latestReport.severity ? `Severity ${latestReport.severity}/5` : "New report",
      latitude: Number(latestReport.latitude),
      longitude: Number(latestReport.longitude),
    }] : [];

    onSummaryChange({
      generatedAt: new Date().toISOString(),
      source: liveSource,
      liveUpdatedAt,
      feedItems,
    });
  }, [liveSource, liveUpdatedAt, liveZones, onSummaryChange, userReports]);

  const deleteCitizenReport = async (reportId: string) => {
    const remaining = userReports.filter((r) => r.id !== reportId);
    setUserReports(remaining);
    localStorage.setItem("neptune_user_reports", JSON.stringify(remaining));
    await fetch(`/api/reports?id=${encodeURIComponent(String(reportId))}`, { method: "DELETE" });
  };

  return (
    <div className={styles.mainContainer}>
      <div className={styles.mapWrapper}>
        <div 
          className={`${styles.aroToggle} ${showARO ? styles.aroActive : ""}`} 
          onClick={() => setShowARO(!showARO)}
        >
          {showARO ? "📡 ARO SYSTEM ACTIVE" : "📡 ACTIVATE ARO"}
        </div>

        <MapContainer
          center={ODISHA_CENTER}
          zoom={7}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <BoundsEnforcer />
          <BaseMapLayer baseLayer={baseLayer} />
          <MapFocusController focusTarget={focusTarget} />
          <MapClickHandler onMark={handleMapMark} />

          {markedPoint && (
            <Marker 
              position={[markedPoint.lat, markedPoint.lng]}
              icon={L.divIcon({
                className: "custom-div-icon",
                html: `<div style="background: var(--danger); width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px var(--danger); animation: pulse 1.5s infinite;"></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              })}
            >
              <Popup className="custom-popup">
                <div style={{ padding: "8px" }}>
                  <strong style={{ display: "block", marginBottom: "4px" }}>Pinned Hazard Location</strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {markedPoint.lat.toFixed(5)}, {markedPoint.lng.toFixed(5)}
                  </span>
                  <p style={{ fontSize: "0.75rem", margin: "8px 0" }}>
                    Details captured in reporting panel.
                  </p>
                  <button 
                    onClick={() => setMarkedPoint(null)}
                    style={{ 
                      width: "100%", 
                      padding: "6px", 
                      background: "var(--off-white)", 
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      fontSize: "0.7rem",
                      cursor: "pointer"
                    }}
                  >
                    Clear Pin
                  </button>
                </div>
              </Popup>
            </Marker>
          )}

          {show3DTwin && (
            <Digital3DTwin
              data={heatmapPoints.map((p) => ({
                lat: p.lat, lng: p.lng,
                height: Math.max(40, Math.min(100, (p.riskScore || 0) * 100)),
                severity: (p.riskScore || 0) > 0.8 ? "critical" : "medium",
                label: p.district || "Hotspot",
                riskScore: p.riskScore || 0,
              }))}
            />
          )}

          <HeatmapLayer points={heatmapPoints} visible={showHeatmap} theme={hazardMode} />
          <SafeZoneOverlay visible={showSafeZones} />

          {showHeatmap && hotspotPoints.map((hotspot, index) => (
            <CircleMarker
              key={`hotspot-${index}`}
              center={[hotspot.lat, hotspot.lng]}
              radius={8}
              pathOptions={{ color: "#EF4444", fillColor: "#F97316", fillOpacity: 0.7, weight: 2 }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={1} className="custom-popup">
                <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {hazardMode.toUpperCase()} HOTSPOT
                </div>
              </Tooltip>
            </CircleMarker>
          ))}

          <WaterwayLayer
            showWaterways={showWaterways}
            showBasins={showWaterBasins}
            showPipelines={showFloodChannels}
            showIrrigation={showIrrigationChannels}
          />

          <InfrastructureLayer
            showPowerGrid={showPowerGrid}
            showSewageLines={showSewageLines}
          />

          <TelemetryLayer
            showEvacZones={showEvacZones}
            liveZones={liveZones}
            probeSnapshot={probeSnapshot}
            enableProbe={enableProbe}
            onFocusTarget={setFocusTarget}
          />

          {showARO && <AgentsLayer />}

          {userReports.map((report) => (
            <Fragment key={report.id}>
              <Marker position={[report.latitude, report.longitude]}>
                <Tooltip direction="top" offset={[0, -6]} opacity={1} className="custom-popup" sticky>
                  <NodeThumbnail
                    title={report.type}
                    lat={report.latitude}
                    lng={report.longitude}
                    userReports={userReports}
                    recentPhotos={recentNodePhotos}
                  />
                </Tooltip>
                <Popup className="custom-popup">
                  <div style={{ minWidth: "220px", padding: "8px" }}>
                    <h4 style={{ margin: "0 0 4px 0", color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: "600" }}>
                      {report.type}
                    </h4>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{report.description}</p>
                    {report.isUserReport && (
                      <button
                        onClick={() => deleteCitizenReport(report.id)}
                        className={styles.deleteButton}
                      >
                        Delete Report
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            </Fragment>
          ))}
        </MapContainer>

        {/* ── Layer Manager Panel ────────────────────────────────── */}
        <div className={`${styles.layerPanel} ${isLayerPanelMinimized ? styles.minimized : ""}`}>
          <div className={styles.panelHeader} onClick={() => setIsLayerPanelMinimized(!isLayerPanelMinimized)}>
            <div className={styles.panelTitle}>
              <Layers size={14} /> {isLayerPanelMinimized ? "LAYERS" : "INTELLIGENCE LAYERS"}
            </div>
            <div className={styles.toggleBtn}>
              {isLayerPanelMinimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </div>
          </div>

          <div className={`${styles.panelContent} ${isLayerPanelMinimized ? styles.collapsedContent : ""}`}>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginBottom: "8px", fontWeight: 700 }}>SIMULATION MODE</div>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {(["flood", "cyclone", "earthquake"] as HazardMode[]).map(mode => (
                  <button 
                    key={mode}
                    onClick={() => setHazardMode(mode)}
                    style={{
                      flex: 1, padding: "6px", borderRadius: "6px", fontSize: "0.7rem", textTransform: "capitalize",
                      background: hazardMode === mode ? "var(--teal)" : "var(--off-white)",
                      color: hazardMode === mode ? "#fff" : "var(--text-secondary)",
                      border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.2s"
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginBottom: "8px", fontWeight: 700 }}>RAIN INTENSITY</div>
              <div style={{ display: "flex", gap: "4px" }}>
                {(["normal", "rain", "heavy_rain"] as RainScenario[]).map(scen => (
                  <button 
                    key={scen}
                    onClick={() => setRainScenario(scen)}
                    style={{
                      flex: 1, padding: "6px", borderRadius: "6px", fontSize: "0.7rem", textTransform: "capitalize",
                      background: rainScenario === scen ? "var(--warning)" : "var(--off-white)",
                      color: rainScenario === scen ? "#fff" : "var(--text-secondary)",
                      border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.2s"
                    }}
                  >
                    {scen.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {[
                { label: "Heatmap View", state: showHeatmap, toggle: setShowHeatmap, icon: <Activity size={14} color="#f97316" /> },
                { label: "3D Digital Twin", state: show3DTwin, toggle: setShow3DTwin, icon: <MapIcon size={14} color="#0ea5e9" /> },
                { label: "Waterways", state: showWaterways, toggle: setShowWaterways, icon: <Droplet size={14} color="#3b82f6" /> },
                { label: "Flood Channels", state: showFloodChannels, toggle: setShowFloodChannels, icon: <Droplet size={14} color="#60a5fa" /> },
                { label: "Evacuation Zones", state: showEvacZones, toggle: setShowEvacZones, icon: <Shield size={14} color="#10b981" /> },
                { label: "Power Grid", state: showPowerGrid, toggle: setShowPowerGrid, icon: <Zap size={14} color="#eab308" /> },
                { label: "Sewage Lines", state: showSewageLines, toggle: setShowSewageLines, icon: <Info size={14} color="#94a3b8" /> },
                { label: "Safe Zones", state: showSafeZones, toggle: setShowSafeZones, icon: <Shield size={14} color="#059669" /> },
              ].map((layer, idx) => (
                <label key={idx} className={styles.layerToggle}>
                  <input type="checkbox" checked={layer.state} onChange={() => layer.toggle(!layer.state)} />
                  <div className={styles.checkmark}></div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                    {layer.icon}
                    <span className={styles.label}>{layer.label}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ── Legend ─────────────────────────────────────────── */}
        <div className={styles.legend}>
          <div className={styles.panelTitle} style={{ marginBottom: "12px" }}>
            <Activity size={14} /> LIVE RISK LEGEND
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendIndicator} style={{ background: "#EF4444" }} />
            <span>Critical Risk (&gt;0.8)</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendIndicator} style={{ background: "#F97316" }} />
            <span>High Risk (0.6 - 0.8)</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendIndicator} style={{ background: "#FBBF24" }} />
            <span>Medium Risk (0.4 - 0.6)</span>
          </div>
          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)", fontSize: "0.65rem", color: "var(--text-muted)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <MapPin size={10} /> Click map to mark hazard
            </div>
          </div>
        </div>

        <div className={`${styles.aroToggle} ${showARO ? styles.aroActive : ""}`} 
           onClick={() => setShowARO(!showARO)}
           style={{ top: "auto", bottom: "16px", left: "270px" }}
        >
          {showARO ? "📡 ARO SYSTEM ACTIVE" : "📡 ACTIVATE ARO"}
        </div>
      </div>
      
      {showARO && <CommandPanel />}
    </div>
  );
}

