"use client";

import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Circle, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./MapView.module.css";
import cachedCurrentVectors from "@/data/current-vectors.json";
import HeatmapLayer from "./HeatmapLayer";
import { useBuoyFleet, BUOY_ALPHA_ZONES } from "@/hooks/useBuoySimulation";
import type { BuoyConfig } from "@/hooks/useBuoySimulation";
import BuoyLayer from "./BuoyLayer";
import BuoyPanel from "./BuoyPanel";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// River mouth pollution channels (Kochi-specific)
const RIVER_MOUTHS = [
  { name: "Periyar River Mouth", lat: 10.10, lng: 76.22, severity: "critical", color: "#DC2626" },
  { name: "Muvattupuzha Outlet", lat: 9.93, lng: 76.27, severity: "high", color: "#EA580C" },
  { name: "Edapally Canal", lat: 10.02, lng: 76.23, severity: "high", color: "#EA580C" },
  { name: "Chitrapuzha River", lat: 10.06, lng: 76.22, severity: "medium", color: "#F59E0B" },
  { name: "Vembanad Outlet", lat: 9.88, lng: 76.32, severity: "medium", color: "#F59E0B" },
];

// Fishing zones with water quality (Kochi)
const FISHING_ZONES = [
  { name: "Chellanam Coast", lat: 9.81, lng: 76.27, waterQuality: 45 },
  { name: "Fort Kochi", lat: 9.965, lng: 76.2415, waterQuality: 72 },
  { name: "Munambam", lat: 10.16, lng: 76.18, waterQuality: 58 },
  { name: "Vypeen Island", lat: 10.03, lng: 76.23, waterQuality: 68 },
  { name: "Puthuvype", lat: 10.01, lng: 76.22, waterQuality: 52 },
];

const LIVE_CURRENT_DATA = cachedCurrentVectors as {
  metadata: { source: string; region: string; date: string };
  vectors: Array<{ lat: number; lon: number; speed: number; dir: number }>;
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

interface MapViewProps {
  refreshKey?: number;
  onSummaryChange?: (summary: {
    generatedAt: string;
    source: string;
    liveUpdatedAt: string;
    feedItems: FeedItem[];
  }) => void;
}

// Bounds enforcer for Kochi
function BoundsEnforcer() {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([[9.6, 75.8], [10.3, 76.6]]);
    map.setMaxBounds(bounds);
    map.on("drag", () => {
      map.panInsideBounds(bounds, { animate: false });
    });
  }, [map]);
  return null;
}

// Water quality color scale
function getWaterQualityColor(score: number): string {
  if (score >= 70) return "#10B981";
  if (score >= 50) return "#F59E0B";
  return "#DC2626";
}

function getWaterQualityStatus(score: number): string {
  if (score >= 70) return "Good";
  if (score >= 50) return "Moderate";
  return "Poor";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getWaterQualityFromCurrentVelocity(baseQuality: number, currentVelocity: number): number {
  const currentPenalty = Math.round(currentVelocity * 18);
  return Math.max(20, Math.min(100, baseQuality + 10 - currentPenalty));
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function formatRelativeTime(timestamp: string): string {
  const diffMinutes = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.round(diffMinutes / 60);
  return `${hours}h ago`;
}

function nearestCityLabel(lat: number, lng: number): { name: string; lat: number; lng: number } {
  const cities = [
    { name: "Kochi", lat: 9.9312, lng: 76.2673 },
    { name: "Kozhikode", lat: 11.2588, lng: 75.7804 },
    { name: "Kannur", lat: 11.8745, lng: 75.3704 },
    { name: "Kollam", lat: 8.8932, lng: 76.6141 },
    { name: "Thiruvananthapuram", lat: 8.5241, lng: 76.9366 },
    { name: "Alappuzha", lat: 9.4981, lng: 76.3388 },
  ];

  return cities.reduce((closest, city) => {
    const currentDistance = haversineKm(lat, lng, city.lat, city.lng);
    const closestDistance = haversineKm(lat, lng, closest.lat, closest.lng);
    return currentDistance < closestDistance ? city : closest;
  });
}

function getNodeThumbnailUrl(lat: number, lng: number): string {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=14&size=240x140&maptype=mapnik&markers=${lat},${lng},red-pushpin`;
}

function getStoredNodePhotos() {
  if (typeof window === "undefined") return [];

  try {
    return JSON.parse(localStorage.getItem("neptune_recent_node_photos") || "[]");
  } catch {
    return [];
  }
}

function getNodeImageSource(
  lat: number,
  lng: number,
  userReports: any[],
  recentPhotos: any[]
): { src: string; label: string } {
  const nearbyImageHits = [...recentPhotos, ...userReports]
    .filter((report) => report?.imageBase64 && report?.latitude != null && report?.longitude != null && report?.timestamp)
    .map((report) => ({
      report,
      distanceKm: haversineKm(lat, lng, Number(report.latitude), Number(report.longitude)),
      ageMs: Date.now() - new Date(report.timestamp).getTime(),
    }))
    .filter(({ distanceKm, ageMs }) => distanceKm <= 5 && ageMs >= 0 && ageMs <= 24 * 60 * 60 * 1000)
    .sort((left, right) => {
      if (left.ageMs !== right.ageMs) return left.ageMs - right.ageMs;
      return left.distanceKm - right.distanceKm;
    })[0];

  if (nearbyImageHits) {
    return {
      src: nearbyImageHits.report.imageBase64,
      label: nearbyImageHits.report.source === "analyzed_upload" ? "Recent analyzed upload" : "Recent nearby user photo",
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
    <div style={{ width: "176px", background: "#fff", borderRadius: "8px", overflow: "hidden" }}>
      <img
        src={image.src}
        alt={title}
        style={{ display: "block", width: "100%", height: "98px", objectFit: "cover" }}
      />
      <div style={{ padding: "8px 10px 2px", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)" }}>
        {title}
      </div>
      <div style={{ padding: "0 10px 10px", fontSize: "0.68rem", color: "var(--text-secondary)" }}>
        {image.label}
      </div>
    </div>
  );
}

// Severity dot icon for river mouths
const createSeverityIcon = (color: string) =>
  L.divIcon({
    html: `<div style="background: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px ${color};" />`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    className: "transparent-icon",
  });

function BaseMapLayer({ baseLayer }: { baseLayer: BaseLayer }) {
  if (baseLayer === "satellite") {
    return (
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution='Tiles &copy; Esri'
        maxZoom={19}
      />
    );
  }

  if (baseLayer === "terrain") {
    return (
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
        attribution='Tiles &copy; Esri'
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

function MapFocusController({ focusTarget }: { focusTarget: { lat: number; lng: number; zoom?: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (!focusTarget) return;
    map.flyTo([focusTarget.lat, focusTarget.lng], focusTarget.zoom ?? 12, { duration: 1.2 });
  }, [focusTarget, map]);

  return null;
}

function ZoomWatcher({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();

  useEffect(() => {
    onZoomChange(map.getZoom());
    const handle = () => onZoomChange(map.getZoom());
    map.on("zoomend", handle);
    return () => {
      map.off("zoomend", handle);
    };
  }, [map, onZoomChange]);

  return null;
}

type WaterHealthSnapshot = {
  score: number;
  label: string;
  coastalDistanceKm: number;
  nearestRiver?: { name: string; distanceKm: number; severity: string };
  nearestZone?: { name: string; distanceKm: number; qualityScore: number };
  current?: { speed: number; dir: number };
};

function sampleNearestCurrent(lat: number, lng: number): { speed: number; dir: number } | undefined {
  let best: { speed: number; dir: number } | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const vector of LIVE_CURRENT_DATA.vectors) {
    const d = haversineKm(lat, lng, vector.lat, vector.lon);
    if (d < bestDist) {
      bestDist = d;
      best = { speed: vector.speed, dir: vector.dir };
    }
  }
  return best;
}

function evaluateWaterHealth(lat: number, lng: number): WaterHealthSnapshot {
  const coastLng = 76.24;
  const coastalDistanceKm = haversineKm(lat, lng, lat, coastLng);
  const coastalBand = Math.exp(-coastalDistanceKm / 10);

  let nearestRiver: WaterHealthSnapshot["nearestRiver"];
  let riverPressure = 0;
  for (const river of RIVER_MOUTHS) {
    const d = haversineKm(lat, lng, river.lat, river.lng);
    const severityWeight = river.severity === "critical" ? 1 : river.severity === "high" ? 0.75 : 0.55;
    const influence = Math.max(0, 1 - d / 25) * severityWeight;
    if (!nearestRiver || d < nearestRiver.distanceKm) {
      nearestRiver = { name: river.name, distanceKm: d, severity: river.severity };
    }
    riverPressure = Math.max(riverPressure, influence);
  }

  let nearestZone: WaterHealthSnapshot["nearestZone"];
  let zoneQualityBoost = 0;
  for (const zone of FISHING_ZONES) {
    const d = haversineKm(lat, lng, zone.lat, zone.lng);
    if (!nearestZone || d < nearestZone.distanceKm) {
      nearestZone = { name: zone.name, distanceKm: d, qualityScore: zone.waterQuality };
    }
    const distanceFactor = Math.max(0, 1 - d / 35);
    zoneQualityBoost = Math.max(zoneQualityBoost, (zone.waterQuality / 100) * distanceFactor);
  }

  const current = sampleNearestCurrent(lat, lng);
  const currentPenalty = current ? clamp(current.speed * 12, 0, 25) : 8;

  const coastalPressure = coastalBand * 70;
  const riverPenalty = riverPressure * 35;
  const baseScore = clamp(75 - coastalPressure - riverPenalty + zoneQualityBoost * 20 - currentPenalty, 10, 95);

  const label = baseScore >= 70 ? "Good" : baseScore >= 50 ? "Moderate" : "Stressed";

  return { score: Math.round(baseScore), label, coastalDistanceKm, nearestRiver, nearestZone, current };
}

function WaterHealthProbe(props: {
  enabled: boolean;
  snapshot: { lat: number; lng: number; data: WaterHealthSnapshot } | null;
  onProbe: (lat: number, lng: number) => void;
}) {
  const { enabled, snapshot, onProbe } = props;

  useMapEvents({
    click(e) {
      if (!enabled) return;
      onProbe(e.latlng.lat, e.latlng.lng);
    },
  });

  if (!enabled || !snapshot) return null;

  const { lat, lng, data } = snapshot;

  const icon = L.divIcon({
    html:
      '<div style="width:14px;height:14px;border-radius:50%;background:#0EA5E9;border:2px solid white;box-shadow:0 0 0 4px rgba(14,165,233,0.35);"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    className: "transparent-icon",
  });

  return (
    <Marker position={[lat, lng]} icon={icon}>
      <Popup className="custom-popup">
        <div style={{ minWidth: "220px", padding: "8px" }}>
          <h4 style={{ margin: "0 0 8px 0", fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
            Local water health
          </h4>
          <p style={{ margin: "0 0 6px 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            Estimated status: <strong>{data.label}</strong> ({data.score}/100)
          </p>
          <p style={{ margin: "0 0 4px 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
            Distance from coast: {data.coastalDistanceKm.toFixed(1)} km
          </p>
          {data.nearestRiver && (
            <p style={{ margin: "0 0 4px 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              Nearest river mouth: <strong>{data.nearestRiver.name}</strong> ({data.nearestRiver.severity}) · {data.nearestRiver.distanceKm.toFixed(1)} km away
            </p>
          )}
          {data.nearestZone && (
            <p style={{ margin: "0 0 4px 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              Nearest fishing zone: <strong>{data.nearestZone.name}</strong> · {data.nearestZone.qualityScore}/100 quality
            </p>
          )}
          {data.current && (
            <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              Currents: {data.current.speed.toFixed(2)} km/h · {data.current.dir.toFixed(0)}°
            </p>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

// Heatmap logic removed as per request to replace with dynamic boat-driven zones

export default function MapView({ refreshKey = 0, onSummaryChange }: MapViewProps) {
  const [baseLayer, setBaseLayer] = useState<BaseLayer>("light");
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showAllPaths, setShowAllPaths] = useState(false);
  const [showRiverMouths, setShowRiverMouths] = useState(true);
  const [showCoastalZones, setShowCoastalZones] = useState(true);
  const [enableProbe, setEnableProbe] = useState(false);
  const [probeSnapshot, setProbeSnapshot] = useState<{ lat: number; lng: number; data: WaterHealthSnapshot } | null>(null);
  const [zoom, setZoom] = useState(11);
  const [userReports, setUserReports] = useState<any[]>([]);
  const [recentNodePhotos, setRecentNodePhotos] = useState<any[]>([]);
  const [liveZones, setLiveZones] = useState(
    FISHING_ZONES.map((zone) => ({
      ...zone,
      currentVelocity: 0,
      currentDirection: 0,
      qualityScore: zone.waterQuality,
      liveUpdatedAt: LIVE_CURRENT_DATA.metadata.date,
    }))
  );
  const [liveSource, setLiveSource] = useState("Open-Meteo Marine API");
  const [liveUpdatedAt, setLiveUpdatedAt] = useState(LIVE_CURRENT_DATA.metadata.date);
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  // ── IoT Buoy Fleet ──
  const [selectedBuoyId, setSelectedBuoyId] = useState<string | null>(null);

  const buoyConfigs = useMemo<BuoyConfig[]>(() => [
    { startOffset: 0.0 }, // buoy1 fallback (Alpha)
    {
      id: "harbor-patrol",
      name: "Harbor Patrol Unit",
      waypoints: [
        { lat: 9.940, lng: 76.245, label: "South Terminal" },
        { lat: 9.955, lng: 76.240, label: "Willingdon Port" },
        { lat: 9.970, lng: 76.242, label: "Fort Kochi Outer" },
        { lat: 9.955, lng: 76.240, label: "Willingdon Port" }, // retrace
      ],
      zones: BUOY_ALPHA_ZONES,
      startOffset: 0.35,
    },
    {
      id: "offshore-sentinel",
      name: "Offshore Sentinel",
      waypoints: [
        { lat: 10.040, lng: 76.180, label: "Vypeen Offshore" },
        { lat: 10.020, lng: 76.180, label: "Coastal Corridor" },
        { lat: 10.000, lng: 76.190, label: "Puthuvype Approach" },
        { lat: 10.020, lng: 76.180, label: "Coastal Corridor" }, // retrace
      ],
      zones: BUOY_ALPHA_ZONES,
      startOffset: 0.6,
    },
    {
      id: "backwater-flow",
      name: "Backwater Flow Monitor",
      waypoints: [
        { lat: 9.870, lng: 76.260, label: "South Vembanad" },
        { lat: 9.890, lng: 76.255, label: "Deep Lake Center" },
        { lat: 9.910, lng: 76.250, label: "Aroor Waters" },
        { lat: 9.890, lng: 76.255, label: "Deep Lake Center" }, // retrace
      ],
      zones: BUOY_ALPHA_ZONES,
      startOffset: 0.15,
    },
    {
      id: "vembanad-core",
      name: "Vembanad Core Node",
      waypoints: [
        { lat: 9.820, lng: 76.265, label: "Kumbalam Lake" },
        { lat: 9.840, lng: 76.270, label: "Nettoor Basin" },
        { lat: 9.860, lng: 76.265, label: "Panangad Waters" },
        { lat: 9.840, lng: 76.270, label: "Nettoor Basin" }, // retrace
      ],
      zones: BUOY_ALPHA_ZONES,
      startOffset: 0.8,
    },
    {
      id: "periyar-scout",
      name: "Periyar Estuary Scout",
      waypoints: [
        { lat: 10.070, lng: 76.220, label: "Kadamakkudy Estuary" },
        { lat: 10.090, lng: 76.215, label: "Varapuzha River" },
        { lat: 10.110, lng: 76.210, label: "Periyar Channel" },
        { lat: 10.090, lng: 76.215, label: "Varapuzha River" }, // retrace
      ],
      zones: BUOY_ALPHA_ZONES,
      startOffset: 0.4,
    },
    {
      id: "bolgatty-unit",
      name: "Bolgatty Channel Unit",
      waypoints: [
        { lat: 10.000, lng: 76.235, label: "Bolgatty Palace" },
        { lat: 10.020, lng: 76.230, label: "Chitrapuzha Link" },
        { lat: 10.040, lng: 76.225, label: "High Court Harbor" },
        { lat: 10.020, lng: 76.230, label: "Chitrapuzha Link" }, // retrace
      ],
      zones: BUOY_ALPHA_ZONES,
      startOffset: 0.25,
    },
    {
      id: "edakochi-inland",
      name: "Edakochi Inland Sensor",
      waypoints: [
        { lat: 9.920, lng: 76.245, label: "Thevara Estuary" },
        { lat: 9.930, lng: 76.242, label: "Kundannoor Channel" },
        { lat: 9.940, lng: 76.240, label: "Tripunithura Inlet" },
        { lat: 9.930, lng: 76.242, label: "Kundannoor Channel" }, // retrace
      ],
      zones: BUOY_ALPHA_ZONES,
      startOffset: 0.55,
    },
    {
      id: "deep-sea",
      name: "Deep Sea Transponder",
      waypoints: [
        { lat: 9.950, lng: 76.100, label: "Arabian Sea Flow" },
        { lat: 9.920, lng: 76.100, label: "Deep Shipping Lane" },
        { lat: 9.890, lng: 76.100, label: "Offshore Shelf" },
        { lat: 9.920, lng: 76.100, label: "Deep Shipping Lane" }, // retrace
      ],
      zones: BUOY_ALPHA_ZONES,
      startOffset: 0.05,
    }
  ], []);

  const allBuoys = useBuoyFleet(buoyConfigs);
  const selectedBuoy = allBuoys.find((b) => b.id === selectedBuoyId) || null;

  const fleetStats = useMemo(() => {
    const total = allBuoys.length;
    const polluted = allBuoys.filter(b => b.sensors.healthScore < 70).length;
    return { total, polluted };
  }, [allBuoys]);

  const handleBuoySelect = (id: string) => {
    setSelectedBuoyId((prev) => (prev === id ? null : id));
  };
  const satelliteDate = new Date().toISOString().split("T")[0];

  // Load reports and marine feed on mount, refresh button, and polling interval.
  useEffect(() => {
    let isCancelled = false;

    const loadReports = async () => {
      let merged: any[] = [];

      if (typeof window !== "undefined") {
        const saved = JSON.parse(localStorage.getItem("neptune_user_reports") || "[]");
        merged = saved;
        const recentPhotos = getStoredNodePhotos();
        setRecentNodePhotos(recentPhotos);
      }

      try {
        const res = await fetch("/api/reports", { cache: "no-store" });
        if (res.ok) {
          const remote = await res.json();
          // Prefer server data, with local fallback if empty
          merged = Array.isArray(remote) && remote.length ? remote : merged;
        }
      } catch (error) {
        console.error("Failed to load reports from server", error);
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("neptune_user_reports", JSON.stringify(merged));
      }
      setUserReports(merged);
    };

    const loadMarineFeed = async () => {
      try {
        const response = await fetch("/api/marine-current", { cache: "no-store" });
        if (!response.ok) throw new Error(`Marine feed request failed: ${response.status}`);

        const payload = await response.json();
        if (isCancelled) return;

        setLiveZones(payload.zones);
        setLiveSource(payload.source);
        setLiveUpdatedAt(payload.generatedAt);
      } catch {
        if (isCancelled) return;

        setLiveZones(
          FISHING_ZONES.map((zone) => ({
            ...zone,
            currentVelocity: 0,
            currentDirection: 0,
            qualityScore: zone.waterQuality,
            liveUpdatedAt: LIVE_CURRENT_DATA.metadata.date,
          }))
        );
        setLiveSource(LIVE_CURRENT_DATA.metadata.source);
        setLiveUpdatedAt(LIVE_CURRENT_DATA.metadata.date);
      }
    };

    loadReports();
    loadMarineFeed();

    const reportInterval = setInterval(loadReports, 5000);
    const marineInterval = setInterval(loadMarineFeed, 5 * 60 * 1000);

    return () => {
      isCancelled = true;
      clearInterval(reportInterval);
      clearInterval(marineInterval);
    };
  }, [refreshKey]);

  useEffect(() => {
    if (typeof onSummaryChange !== "function") return;

    const todayStart = new Date();
    todayStart.setHours(6, 0, 0, 0);

    const sortedReports = [...userReports].sort(
      (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
    );
    const reportsSinceMorning = sortedReports.filter((report) => new Date(report.timestamp).getTime() >= todayStart.getTime());
    const latestReport = sortedReports[0];
    const latestCity = latestReport ? nearestCityLabel(Number(latestReport.latitude), Number(latestReport.longitude)) : null;
    const latestCityName = latestCity?.name || "Kochi";

    const feedItems: FeedItem[] = [];

    if (latestReport) {
      feedItems.push({
        id: `report-${latestReport.id}`,
        title: `User reported pollution near ${latestCityName}`,
        detail: `${String(latestReport.type || "incident").replace(/_/g, " ")} detected at ${formatRelativeTime(latestReport.timestamp)}. ${String(latestReport.description || "").slice(0, 88)}`,
        meta: latestReport.severity ? `Severity ${latestReport.severity}/5` : "New report",
        latitude: Number(latestReport.latitude),
        longitude: Number(latestReport.longitude),
      });
    } else {
      feedItems.push({
        id: "report-empty",
        title: "No citizen reports yet",
        detail: "New pollution reports from the detector and map will appear here as they arrive.",
        meta: "Waiting",
        latitude: 9.965,
        longitude: 76.2415,
      });
    }

    feedItems.push({
      id: "coastal-count",
      title: `${reportsSinceMorning.length} new reports on the coastal region since morning`,
      detail: `The highest activity is around ${latestCityName}. Tap this card to focus the map there and inspect the newest markers.`,
      meta: "Today",
      latitude: latestReport ? Number(latestReport.latitude) : 9.98,
      longitude: latestReport ? Number(latestReport.longitude) : 76.22,
    });

    const mostActiveZone = [...liveZones].sort((left, right) => left.qualityScore - right.qualityScore)[0];
    if (mostActiveZone) {
      feedItems.push({
        id: "marine-feed",
        title: `${mostActiveZone.name} marine feed updated`,
        detail: `${getWaterQualityStatus(mostActiveZone.qualityScore)} quality, current ${mostActiveZone.currentVelocity.toFixed(2)} km/h, direction ${mostActiveZone.currentDirection.toFixed(0)}°.`,
        meta: formatRelativeTime(liveUpdatedAt),
        latitude: mostActiveZone.lat,
        longitude: mostActiveZone.lng,
      });
    }

    onSummaryChange({
      generatedAt: new Date().toISOString(),
      source: liveSource,
      liveUpdatedAt,
      feedItems,
    });
  }, [liveSource, liveUpdatedAt, liveZones, onSummaryChange, userReports]);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<FeedItem>).detail;
      if (detail?.latitude != null && detail?.longitude != null) {
        setFocusTarget({ lat: detail.latitude, lng: detail.longitude, zoom: 12 });
      }
    };

    window.addEventListener("neptune:focus-feed", listener);
    return () => window.removeEventListener("neptune:focus-feed", listener);
  }, []);

  const [heatmapTick, setHeatmapTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setHeatmapTick((v) => v + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const heatmapPoints = useMemo(() => {
    const points: Array<{ lat: number; lng: number; weight: number }> = [];
    allBuoys.forEach(buoy => {
      buoy.trail.forEach(t => {
        // Paint blobs anywhere a boat detected health < 70
        if (t.healthScore < 70) {
          let weight = (70 - t.healthScore) / 40; 
          points.push({ lat: t.lat, lng: t.lng, weight: Math.min(1, Math.max(0.1, weight)) });
        }
      });
    });
    return points;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heatmapTick]);

  const heatmapVisible = showHeatmap && heatmapPoints.length > 0;

  const handleProbe = (lat: number, lng: number) => {
    const data = evaluateWaterHealth(lat, lng);
    setProbeSnapshot({ lat, lng, data });
  };

  const deleteCitizenReport = async (reportId: string) => {
    if (typeof window !== "undefined") {
      const remaining = userReports.filter((report) => report.id !== reportId);
      setUserReports(remaining);
      localStorage.setItem("neptune_user_reports", JSON.stringify(remaining));
    }

    try {
      await fetch(`/api/reports?id=${encodeURIComponent(String(reportId))}`, { method: "DELETE" });
    } catch (error) {
      console.error("Failed to delete report from server", error);
    }
  };

  const kochiBounds: [number, number][] = [[9.6, 75.8], [10.3, 76.6]];
  const kochiCenter: [number, number] = [9.98, 76.22];

  return (
    <div className={styles.mapWrapper}>
      <MapContainer
        center={kochiCenter}
        zoom={11}
        minZoom={10}
        maxZoom={18}
        maxBounds={kochiBounds}
        style={{ width: "100%", height: "100%", background: "#f8fafc" }}
        zoomControl={false}
      >
        <BaseMapLayer baseLayer={baseLayer} />

        <BoundsEnforcer />
        <ZoomWatcher onZoomChange={setZoom} />
        <MapFocusController focusTarget={focusTarget} />
        
        {/* Dynamic Boat-Driven Danger Blobs (Heatmap) */}
        {heatmapVisible && <HeatmapLayer points={heatmapPoints} visible={heatmapVisible} />}

        <WaterHealthProbe enabled={enableProbe} snapshot={probeSnapshot} onProbe={handleProbe} />

        {/* River mouth pollution channels */}
        {showRiverMouths && RIVER_MOUTHS.map((river) => (
          <Marker
            key={river.name}
            position={[river.lat, river.lng]}
            icon={createSeverityIcon(river.color)}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1} permanent={false} className="custom-popup" sticky>
              <NodeThumbnail title={river.name} lat={river.lat} lng={river.lng} userReports={userReports} recentPhotos={recentNodePhotos} />
            </Tooltip>
            <Popup className="custom-popup">
              <div style={{ minWidth: "200px", padding: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: river.color,
                      boxShadow: `0 0 8px ${river.color}`,
                    }}
                  />
                  <span style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--text-primary)" }}>
                    {river.name}
                  </span>
                </div>
                <p style={{ margin: "0 0 8px 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Pollution Channel
                </p>
                <div
                  style={{
                    background: "var(--slate-100)",
                    padding: "6px",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    color: "var(--text-primary)",
                  }}
                >
                  Status: <strong>{river.severity.toUpperCase()}</strong>
                  <br />
                  Coord: {river.lat.toFixed(4)}, {river.lng.toFixed(4)}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Fishing zones with live water quality circles */}
        {showCoastalZones && liveZones.map((zone) => {
          const liveQuality = zone.qualityScore;
          const qualityColor = getWaterQualityColor(liveQuality);
          const qualityStatus = getWaterQualityStatus(liveQuality);
          return (
            <CircleMarker
              key={zone.name}
              center={[zone.lat, zone.lng]}
              radius={10}
              pathOptions={{
                color: qualityColor,
                fillColor: qualityColor,
                fillOpacity: 0.55,
                weight: 2,
              }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={1} permanent={false} className="custom-popup" sticky>
                <NodeThumbnail title={zone.name} lat={zone.lat} lng={zone.lng} userReports={userReports} recentPhotos={recentNodePhotos} />
              </Tooltip>
              <Popup className="custom-popup">
                <div style={{ minWidth: "220px", padding: "8px" }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem", fontWeight: "600", color: "var(--text-primary)" }}>
                    {zone.name}
                  </h4>
                  <div
                    style={{
                      background: qualityColor,
                      color: "#ffffff",
                      padding: "8px",
                      borderRadius: "4px",
                      marginBottom: "8px",
                      fontSize: "0.85rem",
                      fontWeight: "600",
                      textAlign: "center",
                    }}
                  >
                    Live marine estimate: {qualityStatus}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    <p style={{ margin: "0 0 4px 0" }}>
                      <strong>Score:</strong> {liveQuality}/100
                    </p>
                    <p style={{ margin: "0 0 4px 0" }}>
                      <strong>Current velocity:</strong> {zone.currentVelocity.toFixed(2)} km/h
                    </p>
                    <p style={{ margin: "0 0 4px 0" }}>
                      <strong>Direction:</strong> {zone.currentDirection.toFixed(0)}°
                    </p>
                    <p style={{ margin: "0 0 4px 0" }}>
                      <strong>Zone:</strong> Fishing Area
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>Coord:</strong> {zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}
                    </p>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Citizen reports */}
        {userReports.map((report) => (
          <Marker key={report.id} position={[report.latitude, report.longitude]}>
            <Tooltip direction="top" offset={[0, -6]} opacity={1} permanent={false} className="custom-popup" sticky>
              <div style={{ width: "176px", background: "#fff", borderRadius: "8px", overflow: "hidden" }}>
                <img
                  src={report.imageBase64 || getNodeThumbnailUrl(report.latitude, report.longitude)}
                  alt={report.type}
                  style={{ display: "block", width: "100%", height: "98px", objectFit: "cover" }}
                />
                <div style={{ padding: "8px 10px", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  {report.type}
                </div>
              </div>
            </Tooltip>
            <Popup className="custom-popup">
              <div style={{ minWidth: "220px", padding: "8px", background: "#ffffff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span className="badge" style={{ background: "var(--teal)", color: "white", fontSize: "0.7rem" }}>
                    CITIZEN REPORT
                  </span>
                  <span style={{ fontSize: "0.7rem", color: "var(--slate-400)" }}>
                    {new Date(report.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {report.imageBase64 && (
                  <div style={{ marginBottom: "8px", border: "1px solid var(--slate-200)", borderRadius: "4px", overflow: "hidden" }}>
                    <img
                      src={report.imageBase64}
                      alt="Report evidence"
                      style={{ width: "100%", maxHeight: "120px", objectFit: "cover" }}
                    />
                  </div>
                )}
                <h4 style={{ margin: "0 0 4px 0", color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: "600" }}>
                  {report.type}
                </h4>
                <p style={{ margin: "0 0 8px 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {report.description}
                </p>
                <div style={{ padding: "6px", background: "var(--slate-50)", border: "1px solid var(--slate-100)", fontSize: "0.75rem", borderRadius: "3px", marginBottom: "8px" }}>
                  Verified by: <strong>OceanSentinel AI</strong>
                </div>
                {report.isUserReport && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Delete this citizen report?")) {
                        deleteCitizenReport(report.id);
                      }
                    }}
                    className="btn btn-secondary"
                    style={{
                      width: "100%",
                      padding: "6px",
                      fontSize: "0.8rem",
                      color: "var(--red)",
                      border: "1px solid var(--red)",
                    }}
                  >
                    Delete Report
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}


        {/* IoT Buoy Fleet — gliding markers + dotted trails when selected */}
        {allBuoys.map((buoy) => (
          <BuoyLayer
            key={buoy.id}
            buoy={buoy}
            selected={showAllPaths || buoy.id === selectedBuoyId}
            onSelect={handleBuoySelect}
          />
        ))}
      </MapContainer>

      {/* Buoy sensor panel — only when a buoy is selected/monitored */}
      {selectedBuoy && (
        <BuoyPanel
          buoy={selectedBuoy}
          onClose={() => setSelectedBuoyId(null)}
        />
      )}

      {/* Layer toggle */}
      <div className={styles.layerPanel}>
        <div style={{ 
          marginBottom: 16, 
          padding: "12px", 
          background: "rgba(14, 165, 233, 0.05)", 
          border: "1px solid rgba(14, 165, 233, 0.2)", 
          borderRadius: "12px" 
        }}>
          <p style={{ fontSize: "0.75rem", color: "#0369a1", fontWeight: 700, margin: "0 0 4px 0", textTransform: "uppercase" }}>
            Fleet Status
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)" }}>{fleetStats.total}</div>
              <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)", fontWeight: 600 }}>NODES ONLINE</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: fleetStats.polluted > 0 ? "var(--red)" : "var(--teal)" }}>
                {fleetStats.polluted}
              </div>
              <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)", fontWeight: 600 }}>IN POLLUTION</div>
            </div>
          </div>
        </div>

        <h3 className={styles.panelTitle}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0ea5e9", boxShadow: "0 0 8px #0ea5e9" }} />
          Map Layers
        </h3>

        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0 0 8px 0", fontWeight: "600" }}>
            BASE MAP
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {([
              ["light", "Light"],
              ["satellite", "Satellite"],
              ["terrain", "Terrain"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setBaseLayer(key)}
                style={{
                  width: "100%",
                  padding: "9px 10px",
                  borderRadius: 10,
                  border: key === baseLayer ? "1px solid var(--teal)" : "1px solid var(--border-subtle)",
                  background: key === baseLayer ? "rgba(0, 210, 211, 0.09)" : "#fff",
                  color: "var(--text-primary)",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0 0 8px 0", fontWeight: "600" }}>
            OVERLAYS
          </p>
          <label className={styles.layerToggle} style={{ marginBottom: 0 }}>
            <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} />
            <span className={styles.checkmark}></span>
            <span className={styles.label}>IoT Hazard Zones</span>
          </label>
          <label className={styles.layerToggle} style={{ marginTop: 4, marginBottom: 0 }}>
            <input type="checkbox" checked={showRiverMouths} onChange={(e) => setShowRiverMouths(e.target.checked)} />
            <span className={styles.checkmark}></span>
            <span className={styles.label}>Pollution Channels</span>
          </label>
          <label className={styles.layerToggle} style={{ marginTop: 4, marginBottom: 0 }}>
            <input type="checkbox" checked={showCoastalZones} onChange={(e) => setShowCoastalZones(e.target.checked)} />
            <span className={styles.checkmark}></span>
            <span className={styles.label}>Coastal & Island Zones</span>
          </label>
          <label className={styles.layerToggle} style={{ marginTop: 4, marginBottom: 0 }}>
            <input type="checkbox" checked={showAllPaths} onChange={(e) => setShowAllPaths(e.target.checked)} />
            <span className={styles.checkmark}></span>
            <span className={styles.label}>Show All Fleet Paths</span>
          </label>
          <label className={styles.layerToggle} style={{ marginTop: 4 }}>
            <input type="checkbox" checked={enableProbe} onChange={(e) => setEnableProbe(e.target.checked)} />
            <span className={styles.checkmark}></span>
            <span className={styles.label}>Water health probe</span>
          </label>
        </div>

      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <h4 style={{ margin: "0 0 12px 0", fontSize: "0.9rem", fontWeight: "600", color: "var(--text-primary)" }}>
          Legend
        </h4>

        <div style={{ marginBottom: "16px", borderBottom: "1px solid rgba(0,0,0,0.05)", paddingBottom: "12px" }}>
          <p style={{ margin: "0 0 10px 0", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            River Mouths
          </p>
          <div className={styles.legendItem}>
            <span className={styles.legendIndicator} style={{ color: "#DC2626" }} />
            Critical Level
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendIndicator} style={{ color: "#EA580C" }} />
            High Pollution
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendIndicator} style={{ color: "#F59E0B" }} />
            Medium Impact
          </div>
        </div>

        <div>
          <p style={{ margin: "0 0 10px 0", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Fleet Indicators
          </p>
          <div className={styles.legendItem}>
            <span className={styles.legendIndicator} style={{ color: "#10B981" }} />
            Healthy Zone
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendIndicator} style={{ color: "#F59E0B" }} />
            Moderate Activity
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendIndicator} style={{ color: "#DC2626" }} />
            Pollution Detected
          </div>
          <div style={{ marginTop: "12px", fontSize: "0.65rem", color: "#94a3b8", lineHeight: 1.4 }}>
            System updates every 5s • Processing 9 high-precision IoT nodes.
          </div>
        </div>
      </div>
    </div>
  );
}
