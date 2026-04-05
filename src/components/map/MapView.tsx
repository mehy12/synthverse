/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element, @typescript-eslint/no-unused-vars */
"use client";

import { Fragment, useState, useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  CircleMarker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./MapView.module.css";
import cachedCurrentVectors from "@/data/current-vectors.json";
import { Maximize2, Minimize2 } from "lucide-react";
import HeatmapLayer from "./HeatmapLayer";
import Digital3DTwin from "./Digital3DTwin";
import powerGridNodes from "@/data/power-grid-locations.json";
import sewageGridNodes from "@/data/sewage-grid-locations.json";
import SafeZoneOverlay from "./SafeZoneOverlay";

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

const FLOOD_CHANNELS = [
  {
    name: "Mahanadi Backflow",
    lat: 20.46,
    lng: 85.88,
    severity: "medium",
    color: "#F97316",
  },
  {
    name: "Chilika Inlet Surge",
    lat: 19.72,
    lng: 85.48,
    severity: "high",
    color: "#EF4444",
  },
];

// Evacuation zones with flood readiness scores
const EVACUATION_ZONES = [
  { name: "Bhubaneswar East", lat: 20.2961, lng: 85.8245, waterQuality: 62 },
  { name: "Cuttack Riverside", lat: 20.4625, lng: 85.8828, waterQuality: 54 },
  { name: "Puri Coast", lat: 19.8135, lng: 85.8312, waterQuality: 68 },
  { name: "Sambalpur Basin", lat: 21.4704, lng: 83.9758, waterQuality: 74 },
  { name: "Paradeep Port", lat: 20.3164, lng: 86.6104, waterQuality: 49 },
];

const IMAGINARY_WATER_PIPELINES = [
  {
    name: "Mahanadi Trunk Line",
    description:
      "A fictional inland supply corridor linking the Mahanadi basin to central Odisha.",
    color: "#0EA5E9",
    path: [
      [21.5167, 83.873],
      [21.4704, 83.9758],
      [20.4625, 85.8828],
      [20.2961, 85.8245],
    ] as [number, number][],
  },
  {
    name: "Coastal Relief Main",
    description:
      "An imaginary coastal transfer line tracing the Bay-facing evacuation belt.",
    color: "#14B8A6",
    path: [
      [19.8135, 85.8312],
      [19.703, 85.522],
      [20.3164, 86.6104],
    ] as [number, number][],
  },
  {
    name: "Eastern Water Ring",
    description:
      "A made-up support loop feeding flood response hubs across the eastern corridor.",
    color: "#3B82F6",
    path: [
      [20.2961, 85.8245],
      [20.4625, 85.8828],
      [20.3164, 86.6104],
      [19.8135, 85.8312],
    ] as [number, number][],
  },
];

const ODISHA_WATERWAYS = [
  {
    name: "Mahanadi River",
    kind: "river",
    color: "#38BDF8",
    line: [
      [21.5167, 83.873],
      [21.2, 84.3],
      [20.89, 84.83],
      [20.4625, 85.8828],
    ] as [number, number][],
    description: "Main river corridor through central Odisha.",
  },
  {
    name: "Brahmani River",
    kind: "river",
    color: "#22D3EE",
    line: [
      [22.12, 85.24],
      [21.74, 85.34],
      [21.24, 85.8],
      [20.98, 86.1],
    ] as [number, number][],
    description: "Industrial river corridor feeding the eastern delta.",
  },
  {
    name: "Baitarani River",
    kind: "river",
    color: "#06B6D4",
    line: [
      [21.98, 86.66],
      [21.49, 86.43],
      [21.07, 86.05],
      [20.98, 86.1],
    ] as [number, number][],
    description: "Northern Odisha river belt highlighted for flood routing.",
  },
  {
    name: "Subarnarekha River",
    kind: "river",
    color: "#67E8F9",
    line: [
      [22.1, 86.65],
      [21.7, 86.92],
      [21.04, 87.32],
    ] as [number, number][],
    description: "Northern coastal river frontage near the Odisha border.",
  },
  {
    name: "Rushikulya River",
    kind: "river",
    color: "#0EA5E9",
    line: [
      [19.46, 84.89],
      [19.3, 84.7941],
      [19.02, 84.93],
    ] as [number, number][],
    description: "Southern coastal river highlighted around Ganjam.",
  },
  {
    name: "Chilika Lake",
    kind: "lake",
    color: "#0F766E",
    polygon: [
      [19.98, 85.3],
      [19.9, 85.56],
      [19.66, 85.57],
      [19.47, 85.35],
      [19.55, 85.12],
      [19.8, 85.16],
    ] as [number, number][],
    description: "Highlighted lagoon and wetland complex.",
  },
  {
    name: "Bay of Bengal Coastline",
    kind: "coast",
    color: "#60A5FA",
    line: [
      [18.0, 86.2],
      [18.45, 86.05],
      [19.05, 86.12],
      [19.65, 86.24],
      [20.25, 86.56],
      [20.85, 86.98],
    ] as [number, number][],
    description: "Coastal water edge highlighted for orientation.",
  },
];

// Extended water bodies - basins, channels, wetlands
const ODISHA_WATER_BASINS = [
  {
    name: "Mahanadi Basin",
    kind: "basin",
    color: "#1E40AF",
    polygon: [
      [21.8, 83.5],
      [22.0, 84.0],
      [21.5, 85.5],
      [20.5, 85.5],
      [20.0, 84.5],
      [20.5, 83.5],
    ] as [number, number][],
    description: "Primary floodplain and water collection basin",
  },
  {
    name: "Brahmani-Baitarani Basin",
    kind: "basin",
    color: "#0C4A6E",
    polygon: [
      [21.5, 85.5],
      [22.5, 86.0],
      [22.0, 87.0],
      [21.0, 86.5],
      [20.5, 85.8],
    ] as [number, number][],
    description: "Eastern delta basin and confluence zone",
  },
  {
    name: "Subarnarekha Wetlands",
    kind: "wetland",
    color: "#164E63",
    polygon: [
      [22.0, 86.5],
      [22.3, 87.0],
      [22.1, 87.5],
      [21.8, 87.2],
    ] as [number, number][],
    description: "Northern wetland preservation zone",
  },
];

// Irrigation and drainage channels
const ODISHA_IRRIGATION_CHANNELS = [
  {
    name: "Upper Mahanadi Canal",
    color: "#3B82F6",
    opacity: 0.6,
    line: [
      [21.8, 83.8],
      [21.5, 84.5],
      [21.2, 85.0],
      [20.9, 85.3],
    ] as [number, number][],
  },
  {
    name: "Lower Mahanadi Canal",
    color: "#2563EB",
    opacity: 0.6,
    line: [
      [20.9, 85.3],
      [20.6, 85.8],
      [20.4, 86.2],
      [20.2, 86.5],
    ] as [number, number][],
  },
  {
    name: "Brahmani Irrigation Network",
    color: "#1D4ED8",
    opacity: 0.6,
    line: [
      [22.0, 85.5],
      [21.5, 85.8],
      [21.0, 86.2],
      [20.8, 86.5],
    ] as [number, number][],
  },
  {
    name: "Eastern Drainage Main",
    color: "#1E40AF",
    opacity: 0.5,
    line: [
      [21.5, 86.0],
      [21.2, 86.5],
      [20.9, 87.0],
      [20.6, 87.3],
    ] as [number, number][],
  },
];

// Sewage grid network generation based on real geocoded nodes
const SEWAGE_NETWORK = (() => {
  // Use a smaller subset for the "visual" web to ensure high performance
  const connections: any[] = [];
  const nodes = sewageGridNodes as any[];
  const distThreshold = 0.012; // ~1.2km approx in degrees

  for (let i = 0; i < nodes.length; i += 2) { 
    const a = nodes[i];
    let found = 0;
    for (let j = i + 1; j < nodes.length && found < 2; j++) {
      const b = nodes[j];
      const dLat = Math.abs(a.lat - b.lat);
      const dLon = Math.abs(a.lon - b.lon);
      
      if (dLat < distThreshold && dLon < distThreshold) {
        connections.push({
          id: `sewage-${a.id}-${b.id}`,
          from: a,
          to: b
        });
        found++;
      }
    }
  }
  return connections;
})();

// Power grid network generation based on geocoded data
const GRID_NETWORK = (() => {
  const circles: Record<string, any[]> = {};
  powerGridNodes.forEach((node) => {
    if (!circles[node.circle]) circles[node.circle] = [];
    circles[node.circle].push(node);
  });

  const connections: any[] = [];
  Object.entries(circles).forEach(([circleName, nodes]) => {
    // Sort nodes to create a "serial" path within each circle
    const sorted = [...nodes].sort((a, b) => a.lng - b.lng);
    for (let i = 0; i < sorted.length - 1; i++) {
      connections.push({
        id: `link-${circleName}-${i}`,
        from: sorted[i],
        to: sorted[i + 1],
        color: "#FCD34D", // Gold/Amber for power flow
        width: 2,
      });
    }
    
    // Cross-connecting divisions to create "spiderweb" effect
    const divisions: Record<string, any[]> = {};
    nodes.forEach(n => {
      if (!divisions[n.division]) divisions[n.division] = [];
      divisions[n.division].push(n);
    });
    
    const divCenters = Object.values(divisions).map(d => d[0]);
    if (divCenters.length > 1) {
      for (let i = 0; i < divCenters.length - 1; i++) {
        connections.push({
          id: `trunk-${circleName}-${i}`,
          from: divCenters[i],
          to: divCenters[i+1],
          color: "#F59E0B", // Deeper orange for trunk
          width: 3,
        });
      }
    }
  });

  return connections;
})();

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

type ScenarioChance = {
  severePct: number;
  highPct: number;
  moderatePct: number;
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

// Water quality color scale
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getWaterQualityFromCurrentVelocity(
  baseQuality: number,
  currentVelocity: number,
): number {
  const currentPenalty = Math.round(currentVelocity * 18);
  return Math.max(20, Math.min(100, baseQuality + 10 - currentPenalty));
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function formatRelativeTime(timestamp: string): string {
  const diffMinutes = Math.max(
    0,
    Math.round((Date.now() - new Date(timestamp).getTime()) / 60000),
  );
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.round(diffMinutes / 60);
  return `${hours}h ago`;
}

function nearestCityLabel(
  lat: number,
  lng: number,
): { name: string; lat: number; lng: number } {
  const cities = [
    { name: "Bhubaneswar", lat: 20.2961, lng: 85.8245 },
    { name: "Cuttack", lat: 20.4625, lng: 85.8828 },
    { name: "Puri", lat: 19.8135, lng: 85.8312 },
    { name: "Sambalpur", lat: 21.4704, lng: 83.9758 },
    { name: "Berhampur", lat: 19.3149, lng: 84.7941 },
    { name: "Paradeep", lat: 20.3164, lng: 86.6104 },
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

function ZoomWatcher({
  onZoomChange,
}: {
  onZoomChange: (zoom: number) => void;
}) {
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

function sampleNearestCurrent(
  lat: number,
  lng: number,
): { speed: number; dir: number } | undefined {
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
  const coastLng = 85.82;
  const coastalDistanceKm = haversineKm(lat, lng, lat, coastLng);
  const coastalBand = Math.exp(-coastalDistanceKm / 10);

  let nearestRiver: WaterHealthSnapshot["nearestRiver"];
  let riverPressure = 0;
  for (const river of FLOOD_CHANNELS) {
    const d = haversineKm(lat, lng, river.lat, river.lng);
    const severityWeight =
      river.severity === "critical"
        ? 1
        : river.severity === "high"
          ? 0.75
          : 0.55;
    const influence = Math.max(0, 1 - d / 25) * severityWeight;
    if (!nearestRiver || d < nearestRiver.distanceKm) {
      nearestRiver = {
        name: river.name,
        distanceKm: d,
        severity: river.severity,
      };
    }
    riverPressure = Math.max(riverPressure, influence);
  }

  let nearestZone: WaterHealthSnapshot["nearestZone"];
  let zoneQualityBoost = 0;
  for (const zone of EVACUATION_ZONES) {
    const d = haversineKm(lat, lng, zone.lat, zone.lng);
    if (!nearestZone || d < nearestZone.distanceKm) {
      nearestZone = {
        name: zone.name,
        distanceKm: d,
        qualityScore: zone.waterQuality,
      };
    }
    const distanceFactor = Math.max(0, 1 - d / 35);
    zoneQualityBoost = Math.max(
      zoneQualityBoost,
      (zone.waterQuality / 100) * distanceFactor,
    );
  }

  const current = sampleNearestCurrent(lat, lng);
  const currentPenalty = current ? clamp(current.speed * 12, 0, 25) : 8;

  const coastalPressure = coastalBand * 70;
  const riverPenalty = riverPressure * 35;
  const baseScore = clamp(
    75 -
      coastalPressure -
      riverPenalty +
      zoneQualityBoost * 20 -
      currentPenalty,
    10,
    95,
  );

  const label =
    baseScore >= 70 ? "Good" : baseScore >= 50 ? "Moderate" : "Stressed";

  return {
    score: Math.round(baseScore),
    label,
    coastalDistanceKm,
    nearestRiver,
    nearestZone,
    current,
  };
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
    html: '<div style="width:14px;height:14px;border-radius:50%;background:#0EA5E9;border:2px solid white;box-shadow:0 0 0 4px rgba(14,165,233,0.35);"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    className: "transparent-icon",
  });

  return (
    <Marker position={[lat, lng]} icon={icon}>
      <Popup className="custom-popup">
        <div style={{ minWidth: "220px", padding: "8px" }}>
          <h4
            style={{
              margin: "0 0 8px 0",
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Local water health
          </h4>
          <p
            style={{
              margin: "0 0 6px 0",
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
            }}
          >
            Estimated status: <strong>{data.label}</strong> ({data.score}/100)
          </p>
          <p
            style={{
              margin: "0 0 4px 0",
              fontSize: "0.78rem",
              color: "var(--text-secondary)",
            }}
          >
            Distance from coast: {data.coastalDistanceKm.toFixed(1)} km
          </p>
          {data.nearestRiver && (
            <p
              style={{
                margin: "0 0 4px 0",
                fontSize: "0.78rem",
                color: "var(--text-secondary)",
              }}
            >
              Nearest river mouth: <strong>{data.nearestRiver.name}</strong> (
              {data.nearestRiver.severity}) ·{" "}
              {data.nearestRiver.distanceKm.toFixed(1)} km away
            </p>
          )}
          {data.nearestZone && (
            <p
              style={{
                margin: "0 0 4px 0",
                fontSize: "0.78rem",
                color: "var(--text-secondary)",
              }}
            >
              Nearest fishing zone: <strong>{data.nearestZone.name}</strong> ·{" "}
              {data.nearestZone.qualityScore}/100 quality
            </p>
          )}
          {data.current && (
            <p
              style={{
                margin: 0,
                fontSize: "0.78rem",
                color: "var(--text-secondary)",
              }}
            >
              Currents: {data.current.speed.toFixed(2)} km/h ·{" "}
              {data.current.dir.toFixed(0)}°
            </p>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

// Heatmap logic removed as per request to replace with dynamic boat-driven zones

export default function MapView({
  refreshKey = 0,
  onSummaryChange,
}: MapViewProps) {
  const [baseLayer, setBaseLayer] = useState<BaseLayer>("light");
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [show3DTwin, setShow3DTwin] = useState(false);
  const [showAllPaths, setShowAllPaths] = useState(false);
  const [showWaterways, setShowWaterways] = useState(true);
  const [showFloodChannels, setShowFloodChannels] = useState(true);
  const [showEvacZones, setShowEvacZones] = useState(true);
  const [showWaterBasins, setShowWaterBasins] = useState(true);
  const [showIrrigationChannels, setShowIrrigationChannels] = useState(true);
  const [showSewageLines, setShowSewageLines] = useState(false);
  const [showPowerGrid, setShowPowerGrid] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [enableProbe, setEnableProbe] = useState(false);
  const [probeSnapshot, setProbeSnapshot] = useState<any | null>(null);
  const zoom = 12;
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
  const [scenarioChance, setScenarioChance] = useState<
    Record<RainScenario, ScenarioChance>
  >({
    normal: { severePct: 0, highPct: 0, moderatePct: 0 },
    rain: { severePct: 0, highPct: 0, moderatePct: 0 },
    heavy_rain: { severePct: 0, highPct: 0, moderatePct: 0 },
  });
  const hazardSummary = useMemo(() => {
    const total = heatmapPoints.length || 1;
    const toScore = (point: HeatPoint) => (typeof point.riskScore === "number" ? point.riskScore : point.weight * 100);
    const severe = heatmapPoints.filter((point) => toScore(point) >= 70).length;
    const high = heatmapPoints.filter((point) => {
      const score = toScore(point);
      return score >= 50 && score < 70;
    }).length;
    const moderate = heatmapPoints.filter((point) => {
      const score = toScore(point);
      return score >= 35 && score < 50;
    }).length;

    return {
      severePct: Math.round((severe / total) * 100),
      highPct: Math.round((high / total) * 100),
      moderatePct: Math.round((moderate / total) * 100),
    };
  }, [heatmapPoints]);
  const [focusTarget, setFocusTarget] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
  } | null>(null);

  const [isLayerPanelCollapsed, setIsLayerPanelCollapsed] = useState(false);
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);

  // satelliteDate is fixed to today for UI
  const satelliteDate = new Date().toISOString().split("T")[0];

  // Load reports and flood feed on mount, refresh button, and polling interval.
  useEffect(() => {
    let isCancelled = false;

    const loadReports = async () => {
      let merged: any[] = [];

      if (typeof window !== "undefined") {
        const saved = JSON.parse(
          localStorage.getItem("neptune_user_reports") || "[]",
        );
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

    const loadFloodFeed = async () => {
      try {
        const response = await fetch("/api/flood-feed", { cache: "no-store" });
        if (!response.ok)
          throw new Error(`Flood feed request failed: ${response.status}`);

        const payload = await response.json();
        if (isCancelled) return;

        setLiveZones(payload.zones);
        setLiveSource(payload.source);
        setLiveUpdatedAt(payload.generatedAt);
      } catch {
        if (isCancelled) return;

        setLiveZones(
          EVACUATION_ZONES.map((zone) => ({
            ...zone,
            currentVelocity: 0,
            currentDirection: 0,
            qualityScore: zone.waterQuality,
            liveUpdatedAt: LIVE_CURRENT_DATA.metadata.date,
          })),
        );
        setLiveSource(LIVE_CURRENT_DATA.metadata.source);
        setLiveUpdatedAt(LIVE_CURRENT_DATA.metadata.date);
      }
    };

    const loadHeatmap = async () => {
      try {
        const params = new URLSearchParams();
        params.set("hazard", hazardMode);
        if (hazardMode === "flood") {
          params.set("scenario", rainScenario);
        }

        const response = await fetch(
          `/api/odisha-heatmap?${params.toString()}`,
          {
            cache: "no-store",
          },
        );
        if (!response.ok)
          throw new Error(`Heatmap request failed: ${response.status}`);

        const payload = await response.json();
        if (isCancelled) return;

        setHeatmapPoints(Array.isArray(payload.points) ? payload.points : []);
        setHotspotPoints(
          Array.isArray(payload.hotspots) ? payload.hotspots : [],
        );
        if (payload?.chanceByScenario) {
          setScenarioChance(payload.chanceByScenario);
        }
      } catch (error) {
        if (isCancelled) return;
        console.error("Failed to load Odisha heatmap", error);
        setHeatmapPoints([]);
        setHotspotPoints([]);
      }
    };

    loadReports();
    loadFloodFeed();
    loadHeatmap();

    const reportInterval = setInterval(loadReports, 5000);
    const floodInterval = setInterval(loadFloodFeed, 5 * 60 * 1000);

    return () => {
      isCancelled = true;
      clearInterval(reportInterval);
      clearInterval(floodInterval);
    };
  }, [refreshKey, rainScenario, hazardMode]);

  useEffect(() => {
    if (typeof onSummaryChange !== "function") return;

    const todayStart = new Date();
    todayStart.setHours(6, 0, 0, 0);

    const sortedReports = [...userReports].sort(
      (left, right) =>
        new Date(right.timestamp).getTime() -
        new Date(left.timestamp).getTime(),
    );
    const reportsSinceMorning = sortedReports.filter(
      (report) => new Date(report.timestamp).getTime() >= todayStart.getTime(),
    );
    const latestReport = sortedReports[0];
    const latestCity = latestReport
      ? nearestCityLabel(
          Number(latestReport.latitude),
          Number(latestReport.longitude),
        )
      : null;
    const latestCityName = latestCity?.name || "Bhubaneswar";

    const feedItems: FeedItem[] = [];

    if (latestReport) {
      feedItems.push({
        id: `report-${latestReport.id}`,
        title: `Flood risk reported near ${latestCityName}`,
        detail: `${String(latestReport.type || "incident").replace(/_/g, " ")} detected at ${formatRelativeTime(latestReport.timestamp)}. ${String(latestReport.description || "").slice(0, 88)}`,
        meta: latestReport.severity
          ? `Severity ${latestReport.severity}/5`
          : "New report",
        latitude: Number(latestReport.latitude),
        longitude: Number(latestReport.longitude),
      });
    } else {
      feedItems.push({
        id: "report-empty",
        title: "No flood reports yet",
        detail:
          "New flood sensor readings and citizen reports will appear here as they arrive.",
        meta: "Waiting",
        latitude: 20.2961,
        longitude: 85.8245,
      });
    }

    feedItems.push({
      id: "coastal-count",
      title: `${reportsSinceMorning.length} new reports across Odisha since morning`,
      detail: `The highest activity is around ${latestCityName}. Tap this card to focus the map there and inspect the newest markers.`,
      meta: "Today",
      latitude: latestReport ? Number(latestReport.latitude) : 20.2961,
      longitude: latestReport ? Number(latestReport.longitude) : 85.8245,
    });

    const mostActiveZone = [...liveZones].sort(
      (left, right) => left.qualityScore - right.qualityScore,
    )[0];
    if (mostActiveZone) {
      feedItems.push({
        id: "flood-feed",
        title: `${mostActiveZone.name} telemetry updated`,
        detail: `${getFloodReadinessStatus(mostActiveZone.qualityScore)} readiness, water level rising at ${mostActiveZone.currentVelocity.toFixed(2)} cm/h.`,
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
        setFocusTarget({
          lat: detail.latitude,
          lng: detail.longitude,
          zoom: 12,
        });
      }
    };

    window.addEventListener("neptune:focus-feed", listener);
    return () => window.removeEventListener("neptune:focus-feed", listener);
  }, []);

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
      await fetch(`/api/reports?id=${encodeURIComponent(String(reportId))}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("Failed to delete report from server", error);
    }
  };

  return (
    <div className={styles.mapWrapper}>
      <MapContainer
        center={ODISHA_CENTER}
        zoom={7}
        minZoom={6}
        maxZoom={18}
        maxBounds={ODISHA_BOUNDS}
        style={{ width: "100%", height: "100%", background: "#f8fafc" }}
        zoomControl={false}
      >
        <BaseMapLayer baseLayer={baseLayer} />

        <BoundsEnforcer />
        <MapFocusController focusTarget={focusTarget} />

        {show3DTwin && (
          <Digital3DTwin
            data={heatmapPoints.map((p) => ({
              lat: p.lat,
              lng: p.lng,
              height: Math.max(40, Math.min(100, (p.riskScore || 0) * 100)),
              severity:
                (p.riskScore || 0) > 0.8
                  ? "critical"
                  : (p.riskScore || 0) > 0.6
                    ? "high"
                    : (p.riskScore || 0) > 0.4
                      ? "medium"
                      : "low",
              label: p.district || "Hotspot",
              riskScore: p.riskScore || 0,
            }))}
          />
        )}

        <HeatmapLayer points={heatmapPoints} visible={showHeatmap} theme={hazardMode} />

        {/* Safe Zone Intelligence Overlay */}
        <SafeZoneOverlay visible={showSafeZones} />

        {showHeatmap &&
          hotspotPoints.map((hotspot, index) => (
            <CircleMarker
              key={`hotspot-${hotspot.lat}-${hotspot.lng}-${index}`}
              center={[hotspot.lat, hotspot.lng]}
              radius={8}
              pathOptions={{
                color: "#EF4444",
                fillColor: "#F97316",
                fillOpacity: 0.7,
                weight: 2,
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -6]}
                opacity={1}
                className="custom-popup"
              >
                <div
                  style={{
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {hazardMode === "flood"
                    ? `Hotspot${hotspot.district ? `: ${hotspot.district}` : ""}`
                    : hazardMode === "cyclone"
                      ? `Cyclone hotspot${hotspot.district ? `: ${hotspot.district}` : ""}`
                      : `Earthquake hotspot${hotspot.district ? `: ${hotspot.district}` : ""}`}
                </div>
              </Tooltip>
              <Popup className="custom-popup">
                <div style={{ minWidth: "210px", padding: "8px" }}>
                  <h4
                    style={{
                      margin: "0 0 6px 0",
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                    }}
                  >
                    {hotspot.district || "Odisha hotspot"}
                  </h4>
                  <p
                    style={{
                      margin: "0 0 4px 0",
                      fontSize: "0.8rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {hazardMode === "flood"
                      ? "High water concentration zone from ML heatmap."
                      : hazardMode === "cyclone"
                        ? "Cyclone-prone corridor from storm-track heatmap."
                        : "Earthquake-prone corridor from seismic heatmap."}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.76rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Score:{" "}
                    {typeof hotspot.score === "number" ? hotspot.score : "N/A"}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}

        <WaterHealthProbe
          enabled={enableProbe}
          snapshot={probeSnapshot}
          onProbe={handleProbe}
        />

        {/* Odisha rivers and water bodies */}
        {showWaterways &&
          ODISHA_WATERWAYS.map((waterway) => {
            if (waterway.kind === "lake" && waterway.polygon) {
              return (
                <Polygon
                  key={waterway.name}
                  positions={waterway.polygon}
                  pathOptions={{
                    color: waterway.color,
                    weight: 3,
                    opacity: 0.95,
                    fillColor: "#14B8A6",
                    fillOpacity: 0.22,
                  }}
                >
                  <Tooltip
                    direction="top"
                    offset={[0, -8]}
                    opacity={1}
                    sticky
                    className="custom-popup"
                  >
                    <div style={{ minWidth: "180px", padding: "2px 0" }}>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        {waterway.name}
                      </div>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          color: "var(--text-secondary)",
                          marginTop: 2,
                        }}
                      >
                        Highlighted water body
                      </div>
                    </div>
                  </Tooltip>
                  <Popup className="custom-popup">
                    <div style={{ minWidth: "220px", padding: "8px" }}>
                      <h4
                        style={{
                          margin: "0 0 6px 0",
                          fontSize: "0.92rem",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        {waterway.name}
                      </h4>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.82rem",
                          color: "var(--text-secondary)",
                          lineHeight: 1.5,
                        }}
                      >
                        {waterway.description}
                      </p>
                    </div>
                  </Popup>
                </Polygon>
              );
            }

            return (
              <Polyline
                key={waterway.name}
                positions={waterway.line!}
                pathOptions={{
                  color: waterway.color,
                  weight: 11,
                  opacity: 0.18,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              >
                <Polyline
                  positions={waterway.line!}
                  pathOptions={{
                    color: waterway.color,
                    weight: 4,
                    opacity: 0.96,
                    dashArray: waterway.kind === "coast" ? "8 10" : undefined,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                />
                <Tooltip
                  direction="top"
                  offset={[0, -8]}
                  opacity={1}
                  sticky
                  className="custom-popup"
                >
                  <div style={{ minWidth: "180px", padding: "2px 0" }}>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {waterway.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-secondary)",
                        marginTop: 2,
                      }}
                    >
                      Highlighted {waterway.kind}
                    </div>
                  </div>
                </Tooltip>
                <Popup className="custom-popup">
                  <div style={{ minWidth: "220px", padding: "8px" }}>
                    <h4
                      style={{
                        margin: "0 0 6px 0",
                        fontSize: "0.92rem",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {waterway.name}
                    </h4>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.82rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {waterway.description}
                    </p>
                  </div>
                </Popup>
              </Polyline>
            );
          })}

        {/* Imaginary water pipelines for Odisha */}
        {IMAGINARY_WATER_PIPELINES.map((pipeline) => (
          <Polyline
            key={pipeline.name}
            positions={pipeline.path}
            pathOptions={{
              color: pipeline.color,
              weight: 5,
              opacity: 0.9,
              dashArray: "10 12",
              lineCap: "round",
              lineJoin: "round",
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -8]}
              opacity={1}
              sticky
              className="custom-popup"
            >
              <div style={{ minWidth: "180px", padding: "2px 0" }}>
                <div
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {pipeline.name}
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--text-secondary)",
                    marginTop: 2,
                  }}
                >
                  Imaginary water pipeline
                </div>
              </div>
            </Tooltip>
            <Popup className="custom-popup">
              <div style={{ minWidth: "220px", padding: "8px" }}>
                <h4
                  style={{
                    margin: "0 0 6px 0",
                    fontSize: "0.92rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {pipeline.name}
                </h4>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  {pipeline.description}
                </p>
              </div>
            </Popup>
          </Polyline>
        ))}

        {/* Water Basins and Wetlands */}
        {showWaterBasins &&
          ODISHA_WATER_BASINS.map((basin) => (
            <Polygon
              key={basin.name}
              positions={basin.polygon}
              pathOptions={{
                color: basin.color,
                weight: 2,
                opacity: 0.7,
                fillColor: basin.color,
                fillOpacity: 0.08,
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -8]}
                opacity={1}
                sticky
                className="custom-popup"
              >
                <div style={{ minWidth: "160px", padding: "2px 0" }}>
                  <div
                    style={{
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                    }}
                  >
                    {basin.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.68rem",
                      color: "var(--text-secondary)",
                      marginTop: 2,
                    }}
                  >
                    {basin.kind}
                  </div>
                </div>
              </Tooltip>
              <Popup className="custom-popup">
                <div style={{ minWidth: "200px", padding: "8px" }}>
                  <h4
                    style={{
                      margin: "0 0 6px 0",
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                    }}
                  >
                    {basin.name}
                  </h4>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.8rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {basin.description}
                  </p>
                </div>
              </Popup>
            </Polygon>
          ))}

        {/* Irrigation Channels */}
        {showIrrigationChannels &&
          ODISHA_IRRIGATION_CHANNELS.map((channel) => (
            <Polyline
              key={channel.name}
              positions={channel.line}
              pathOptions={{
                color: channel.color,
                weight: 3,
                opacity: channel.opacity,
                dashArray: "6 4",
                lineCap: "round",
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -8]}
                opacity={1}
                sticky
                className="custom-popup"
              >
                <div style={{ minWidth: "170px", padding: "2px 0" }}>
                  <div
                    style={{
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                    }}
                  >
                    {channel.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.68rem",
                      color: "var(--text-secondary)",
                      marginTop: 2,
                    }}
                  >
                    Irrigation / Drainage
                  </div>
                </div>
              </Tooltip>
              <Popup className="custom-popup">
                <div style={{ minWidth: "200px", padding: "8px" }}>
                  <h4
                    style={{
                      margin: "0 0 6px 0",
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                    }}
                  >
                    {channel.name}
                  </h4>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.8rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Water distribution and drainage infrastructure
                  </p>
                </div>
              </Popup>
            </Polyline>
          ))}

        {/* Sewage Grid Network */}
        {showSewageLines && (
          <Fragment>
            {/* Lines */}
            {SEWAGE_NETWORK.map((link) => (
              <Polyline
                key={link.id}
                positions={[
                  [link.from.lat, link.from.lon],
                  [link.to.lat, link.to.lon],
                ]}
                pathOptions={{
                  color: "#0891B2",
                  weight: 1.5,
                  opacity: 0.5,
                  className: "sewage-line-flow",
                }}
              />
            ))}
            
            {/* Nodes (Only at high zoom) */}
            {zoom > 10 && sewageGridNodes.slice(0, 1000).map((node: any) => (
              <CircleMarker
                key={`sg-${node.id}`}
                center={[node.lat, node.lon]}
                radius={2}
                pathOptions={{
                  color: "#0E7490",
                  fillColor: "#22D3EE",
                  fillOpacity: 1,
                  weight: 1,
                  className: "sewage-node-marker"
                }}
              >
                <Tooltip direction="top" offset={[0, -2]} className="custom-popup">
                  <div style={{ fontSize: "0.7rem", fontWeight: 700 }}>
                    {node.name || `Drain Node ${node.id.slice(-4)}`}
                  </div>
                  <div style={{ fontSize: "0.6rem" }}>Kind: {node.kind}</div>
                </Tooltip>
              </CircleMarker>
            ))}
          </Fragment>
        )}

        {/* Power Grid Visualization */}
        {showPowerGrid && (
          <Fragment>
            {/* Connections (Spiderweb) */}
            {GRID_NETWORK.map((link) => (
              <Polyline
                key={link.id}
                positions={[
                  [link.from.lat, link.from.lng],
                  [link.to.lat, link.to.lng],
                ]}
                pathOptions={{
                  color: link.color,
                  weight: link.width,
                  opacity: 0.6,
                  className: "power-line-flow",
                }}
              />
            ))}

            {/* Substations (Nodes) */}
            {powerGridNodes.map((node: any) => (
              <CircleMarker
                key={`ss-${node.id}`}
                center={[node.lat, node.lng]}
                radius={6}
                pathOptions={{
                  color: "#FFFFFF",
                  fillColor: "#F59E0B",
                  fillOpacity: 1,
                  weight: 2,
                  className: "power-node-pulse",
                }}
              >
                <Tooltip
                  direction="top"
                  offset={[0, -8]}
                  className="custom-popup"
                >
                  <div style={{ fontWeight: 700 }}>{node.name}</div>
                  <div style={{ fontSize: "0.7rem" }}>{node.kv} · {node.capacity} MVA</div>
                </Tooltip>
                <Popup className="custom-popup">
                  <div style={{ minWidth: "200px", padding: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#F59E0B" }} />
                      <span style={{ fontWeight: 700 }}>{node.name} Substation</span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      <p><strong>Circle:</strong> {node.circle}</p>
                      <p><strong>Voltage:</strong> {node.kv}</p>
                      <p><strong>Capacity:</strong> {node.capacity} MVA</p>
                      <p><strong>Loading:</strong> {node.loading}</p>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </Fragment>
        )}

        {/* River mouth pollution channels */}
        {showFloodChannels &&
          FLOOD_CHANNELS.map((river) => (
            <Marker
              key={river.name}
              position={[river.lat, river.lng]}
              icon={createSeverityIcon(river.color)}
            >
              <Tooltip
                direction="top"
                offset={[0, -6]}
                opacity={1}
                permanent={false}
                className="custom-popup"
                sticky
              >
                <NodeThumbnail
                  title={river.name}
                  lat={river.lat}
                  lng={river.lng}
                  userReports={userReports}
                  recentPhotos={recentNodePhotos}
                />
              </Tooltip>
              <Popup className="custom-popup">
                <div style={{ minWidth: "200px", padding: "8px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "10px",
                    }}
                  >
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
                    <span
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: "600",
                        color: "var(--text-primary)",
                      }}
                    >
                      {river.name}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: "0.85rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Flood Channel
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
        {showEvacZones &&
          liveZones.map((zone) => {
            const liveQuality = zone.qualityScore;
            const qualityColor = getFloodReadinessColor(liveQuality);
            const qualityStatus = getFloodReadinessStatus(liveQuality);
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
                <Tooltip
                  direction="top"
                  offset={[0, -6]}
                  opacity={1}
                  permanent={false}
                  className="custom-popup"
                  sticky
                >
                  <NodeThumbnail
                    title={zone.name}
                    lat={zone.lat}
                    lng={zone.lng}
                    userReports={userReports}
                    recentPhotos={recentNodePhotos}
                  />
                </Tooltip>
                <Popup className="custom-popup">
                  <div style={{ minWidth: "220px", padding: "8px" }}>
                    <h4
                      style={{
                        margin: "0 0 10px 0",
                        fontSize: "0.95rem",
                        fontWeight: "600",
                        color: "var(--text-primary)",
                      }}
                    >
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
                      Flood Readiness: {qualityStatus}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <p style={{ margin: "0 0 4px 0" }}>
                        <strong>Score:</strong> {liveQuality}/100
                      </p>
                      <p style={{ margin: "0 0 4px 0" }}>
                        <strong>Current velocity:</strong>{" "}
                        {zone.currentVelocity.toFixed(2)} km/h
                      </p>
                      <p style={{ margin: "0 0 4px 0" }}>
                        <strong>Direction:</strong>{" "}
                        {zone.currentDirection.toFixed(0)}°
                      </p>
                      <p style={{ margin: "0 0 4px 0" }}>
                        <strong>Zone:</strong> Evacuation Area
                      </p>
                      <p style={{ margin: 0 }}>
                        <strong>Coord:</strong> {zone.lat.toFixed(4)},{" "}
                        {zone.lng.toFixed(4)}
                      </p>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

        {/* Citizen reports */}
        {userReports.map((report) => (
          <Fragment key={report.id}>
            {report.coordinateFlagged && (
              <CircleMarker
                center={[report.latitude, report.longitude]}
                radius={18}
                pathOptions={{
                  color: "#EF4444",
                  weight: 3,
                  opacity: 0.92,
                  fillOpacity: 0,
                }}
              />
            )}
            <Marker position={[report.latitude, report.longitude]}>
              <Tooltip
                direction="top"
                offset={[0, -6]}
                opacity={1}
                permanent={false}
                className="custom-popup"
                sticky
              >
                <div
                  style={{
                    width: "176px",
                    background: "#fff",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={
                      report.imageBase64 ||
                      getNodeThumbnailUrl(report.latitude, report.longitude)
                    }
                    alt={report.type}
                    style={{
                      display: "block",
                      width: "100%",
                      height: "98px",
                      objectFit: "cover",
                    }}
                  />
                  <div
                    style={{
                      padding: "8px 10px",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {report.type}
                  </div>
                </div>
              </Tooltip>
              <Popup className="custom-popup">
                <div
                  style={{
                    minWidth: "220px",
                    padding: "8px",
                    background: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <span
                      className="badge"
                      style={{
                        background: "var(--teal)",
                        color: "white",
                        fontSize: "0.7rem",
                      }}
                    >
                      CITIZEN REPORT
                    </span>
                    <span
                      style={{ fontSize: "0.7rem", color: "var(--slate-400)" }}
                    >
                      {new Date(report.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {report.imageBase64 && (
                    <div
                      style={{
                        marginBottom: "8px",
                        border: "1px solid var(--slate-200)",
                        borderRadius: "4px",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={report.imageBase64}
                        alt="Report evidence"
                        style={{
                          width: "100%",
                          maxHeight: "120px",
                          objectFit: "cover",
                        }}
                      />
                    </div>
                  )}
                  <h4
                    style={{
                      margin: "0 0 4px 0",
                      color: "var(--text-primary)",
                      fontSize: "0.9rem",
                      fontWeight: "600",
                    }}
                  >
                    {report.type}
                  </h4>
                  <p
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: "0.8rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {report.description}
                  </p>
                  {(report.aiDisasterType ||
                    report.aiConfidence ||
                    report.nearbyReportCount ||
                    report.clusterSeverity) && (
                    <div
                      style={{
                        marginBottom: 8,
                        padding: "8px",
                        border: "1px solid var(--slate-200)",
                        borderRadius: "8px",
                        background: "var(--slate-50)",
                        fontSize: "0.74rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {report.aiDisasterType && (
                        <div>
                          <strong>AI disaster type:</strong>{" "}
                          {report.aiDisasterType}
                        </div>
                      )}
                      {typeof report.aiConfidence === "number" && (
                        <div>
                          <strong>AI confidence:</strong> {report.aiConfidence}%
                        </div>
                      )}
                      {typeof report.nearbyReportCount === "number" && (
                        <div>
                          <strong>Nearby reports (500m / 24h):</strong>{" "}
                          {report.nearbyReportCount}
                        </div>
                      )}
                      {typeof report.clusterSeverity === "number" && (
                        <div>
                          <strong>Cluster severity:</strong>{" "}
                          {report.clusterSeverity}/5
                        </div>
                      )}
                      {report.flagReason && (
                        <div>
                          <strong>Coordinate flag:</strong> {report.flagReason}
                        </div>
                      )}
                    </div>
                  )}
                  {report.verificationStatus && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          background:
                            report.verificationStatus ===
                            "VERIFIED_LIVE_CAPTURE"
                              ? "rgba(16, 185, 129, 0.14)"
                              : "rgba(245, 158, 11, 0.14)",
                          color:
                            report.verificationStatus ===
                            "VERIFIED_LIVE_CAPTURE"
                              ? "#047857"
                              : "#B45309",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                        }}
                      >
                        {String(report.verificationStatus).replace(/_/g, " ")}
                      </span>
                      {typeof report.verificationScore === "number" && (
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: "rgba(14, 165, 233, 0.12)",
                            color: "#075985",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                          }}
                        >
                          Score {report.verificationScore}/100
                        </span>
                      )}
                      {report.captureMethod && (
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: "rgba(15, 23, 42, 0.08)",
                            color: "var(--text-secondary)",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                          }}
                        >
                          {report.captureMethod}
                        </span>
                      )}
                    </div>
                  )}
                  <div
                    style={{
                      padding: "6px",
                      background: "var(--slate-50)",
                      border: "1px solid var(--slate-100)",
                      fontSize: "0.75rem",
                      borderRadius: "3px",
                      marginBottom: "8px",
                    }}
                  >
                    Verified by: <strong>FloodMind AI</strong>
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
          </Fragment>
        ))}
      </MapContainer>

      {/* Layer toggle */}
      <div
        className={`${styles.layerPanel} ${isLayerPanelCollapsed ? styles.minimized : ""}`}
      >
        <div
          className={styles.panelHeader}
          onClick={() => setIsLayerPanelCollapsed(!isLayerPanelCollapsed)}
          style={{ marginBottom: isLayerPanelCollapsed ? 0 : 20 }}
        >
          <h3 className={styles.panelTitle} style={{ marginBottom: 0 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--teal)",
                boxShadow: "0 0 8px var(--teal)",
              }}
            />
            Map Layers
          </h3>
          <div className={styles.toggleBtn}>
            {isLayerPanelCollapsed ? (
              <Maximize2 size={12} strokeWidth={1.5} />
            ) : (
              <Minimize2 size={12} strokeWidth={1.5} />
            )}
          </div>
        </div>

        <div
          className={`${styles.panelContent} ${isLayerPanelCollapsed ? styles.collapsedContent : ""}`}
        >
          {/* Replaced Fleet Status with overall flood stats */}
          <div
            style={{
              marginBottom: 16,
              padding: "12px",
              background: "var(--teal-50)",
              border: "1px solid var(--teal-100)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <p
              style={{
                fontSize: "0.65rem",
                color: "var(--teal)",
                fontWeight: 700,
                margin: "0 0 4px 0",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              System Status
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 800,
                    color: "var(--teal)",
                  }}
                >
                  {EVACUATION_ZONES.length}
                </div>
                <div
                  style={{
                    fontSize: "0.6rem",
                    color: "var(--text-muted)",
                    fontWeight: 600,
                  }}
                >
                  ZONES MONITORED
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 800,
                    color: "var(--warning)",
                  }}
                >
                  2
                </div>
                <div
                  style={{
                    fontSize: "0.6rem",
                    color: "var(--text-muted)",
                    fontWeight: 600,
                  }}
                >
                  WARNINGS
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-secondary)",
                margin: "0 0 8px 0",
                fontWeight: "600",
              }}
            >
              BASE MAP
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {(
                [
                  ["light", "Light"],
                  ["satellite", "Satellite"],
                  ["terrain", "Terrain"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBaseLayer(key)}
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: 10,
                    border:
                      key === baseLayer
                        ? "1px solid var(--teal)"
                        : "1px solid var(--border-subtle)",
                    background:
                      key === baseLayer ? "rgba(0, 210, 211, 0.09)" : "#fff",
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
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-secondary)",
                margin: "0 0 8px 0",
                fontWeight: "600",
              }}
            >
              OVERLAYS
            </p>
            <label className={styles.layerToggle} style={{ marginBottom: 0 }}>
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
              />
              <span className={styles.checkmark}></span>
              <span className={styles.label}>Hazard Heatmap</span>
            </label>
            <label
              className={styles.layerToggle}
              style={{ marginTop: 4, marginBottom: 0 }}
            >
              <input
                type="checkbox"
                checked={show3DTwin}
                onChange={(e) => setShow3DTwin(e.target.checked)}
              />
              <span className={styles.checkmark}></span>
              <span className={styles.label}>3D Digital Twin</span>
            </label>
            <div style={{ marginTop: 8, marginBottom: 2 }}>
              <label
                htmlFor="hazard-mode"
                style={{
                  display: "block",
                  fontSize: "0.72rem",
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                }}
              >
                HEATMAP MODE
              </label>
              <select
                id="hazard-mode"
                value={hazardMode}
                onChange={(event) => setHazardMode(event.target.value as HazardMode)}
                style={{
                  width: "100%",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 10,
                  background: "#fff",
                  color: "var(--text-primary)",
                  padding: "8px 10px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                }}
              >
                <option value="flood">Flood / water stress</option>
                <option value="cyclone">Cyclone prone zones</option>
                <option value="earthquake">Earthquake prone zones</option>
              </select>
            </div>
            {hazardMode === "flood" && (
              <div style={{ marginTop: 8, marginBottom: 2 }}>
                <label
                  htmlFor="rain-scenario"
                  style={{
                    display: "block",
                    fontSize: "0.72rem",
                    color: "var(--text-secondary)",
                    marginBottom: 6,
                    fontWeight: 700,
                    letterSpacing: "0.03em",
                  }}
                >
                  RAIN SCENARIO
                </label>
                <select
                  id="rain-scenario"
                  value={rainScenario}
                  onChange={(event) =>
                    setRainScenario(event.target.value as RainScenario)
                  }
                  style={{
                    width: "100%",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 10,
                    background: "#fff",
                    color: "var(--text-primary)",
                    padding: "8px 10px",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                  }}
                >
                  <option value="normal">Normal rainfall</option>
                  <option value="rain">Rain alert</option>
                  <option value="heavy_rain">Heavy rain / cloudburst</option>
                </select>
              </div>
            )}
            {hazardMode !== "flood" && (
              <div style={{
                marginTop: 8,
                padding: "8px 10px",
                borderRadius: 10,
                background: "rgba(15, 23, 42, 0.04)",
                border: "1px solid rgba(148, 163, 184, 0.24)",
                fontSize: "0.76rem",
                color: "var(--text-secondary)",
                lineHeight: 1.45,
              }}>
                {hazardMode === "cyclone"
                  ? "Cyclone heatmap uses storm-track intensity, wind, landfall proximity, and shelter access."
                  : "Earthquake heatmap uses epicenter distance, depth, and district exposure."
                }
              </div>
            )}
            <label
              className={styles.layerToggle}
              style={{ marginTop: 4, marginBottom: 0 }}
            >
              <input
                type="checkbox"
                checked={showFloodChannels}
                onChange={(e) => setShowFloodChannels(e.target.checked)}
              />
              <span className={styles.checkmark}></span>
              <span className={styles.label}>Flood Channels</span>
            </label>
            <label
              className={styles.layerToggle}
              style={{ marginTop: 4, marginBottom: 0 }}
            >
              <input
                type="checkbox"
                checked={showWaterways}
                onChange={(e) => setShowWaterways(e.target.checked)}
              />
              <span className={styles.checkmark}></span>
              <span className={styles.label}>
                Highlighted Rivers & Water Bodies
              </span>
            </label>
            <label
              className={styles.layerToggle}
              style={{ marginTop: 4, marginBottom: 0 }}
            >
              <input
                type="checkbox"
                checked={showEvacZones}
                onChange={(e) => setShowEvacZones(e.target.checked)}
              />
              <span className={styles.checkmark}></span>
              <span className={styles.label}>Evacuation Zones</span>
            </label>
            <label
              className={styles.layerToggle}
              style={{ marginTop: 4, marginBottom: 0 }}
            >
              <input
                type="checkbox"
                checked={showAllPaths}
                onChange={(e) => setShowAllPaths(e.target.checked)}
              />
              <span className={styles.checkmark}></span>
              <span className={styles.label}>Show All Fleet Paths</span>
            </label>
            <label
              className={styles.layerToggle}
              style={{ marginTop: 4, marginBottom: 0 }}
            >
              <input
                type="checkbox"
                checked={showWaterBasins}
                onChange={(e) => setShowWaterBasins(e.target.checked)}
              />
              <span className={styles.checkmark}></span>
              <span className={styles.label}>Water Basins & Wetlands</span>
            </label>
            <label
              className={styles.layerToggle}
              style={{ marginTop: 4, marginBottom: 0 }}
            >
              <input
                type="checkbox"
                checked={showIrrigationChannels}
                onChange={(e) => setShowIrrigationChannels(e.target.checked)}
              />
              <span className={styles.checkmark}></span>
              <span className={styles.label}>Irrigation & Drainage</span>
            </label>
            <label
              className={styles.layerToggle}
              style={{ marginTop: 4, marginBottom: 0 }}
            >
              <input
                type="checkbox"
                checked={showSewageLines}
                onChange={(e) => setShowSewageLines(e.target.checked)}
              />
              <span className={styles.checkmark}></span>
              <span className={styles.label}>Sewage Lines (Spider Web)</span>
            </label>
            <label
              className={styles.layerToggle}
              style={{ marginTop: 4, marginBottom: 0 }}
            >
              <input
                type="checkbox"
                checked={showPowerGrid}
                onChange={(e) => setShowPowerGrid(e.target.checked)}
              />
              <span className={styles.checkmark}></span>
              <span className={styles.label}>Power Grid (Spider Web)</span>
            </label>
            <label
              className={styles.layerToggle}
              style={{ marginTop: 4, marginBottom: 0 }}
            >
              <input
                type="checkbox"
                checked={showSafeZones}
                onChange={(e) => setShowSafeZones(e.target.checked)}
              />
              <span className={styles.checkmark}></span>
              <span className={styles.label} style={{ color: showSafeZones ? "#EF4444" : undefined }}>
                {showSafeZones ? "🚨" : ""} Safe Zone Simulator
              </span>
            </label>
            <label className={styles.layerToggle} style={{ marginTop: 4 }}>
              <input
                type="checkbox"
                checked={enableProbe}
                onChange={(e) => setEnableProbe(e.target.checked)}
              />
              <span className={styles.checkmark}></span>
              <span className={styles.label}>Water health probe</span>
            </label>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div
        className={`${styles.legend} ${isLegendCollapsed ? styles.minimized : ""}`}
      >
        <div
          className={styles.panelHeader}
          onClick={() => setIsLegendCollapsed(!isLegendCollapsed)}
          style={{ marginBottom: isLegendCollapsed ? 0 : 12 }}
        >
          <h4
            style={{
              margin: 0,
              fontSize: "0.9rem",
              fontWeight: "600",
              color: "var(--text-primary)",
            }}
          >
            Legend
          </h4>
          <div className={styles.toggleBtn}>
            {isLegendCollapsed ? (
              <Maximize2 size={12} strokeWidth={1.5} />
            ) : (
              <Minimize2 size={12} strokeWidth={1.5} />
            )}
          </div>
        </div>

        <div
          className={`${styles.panelContent} ${isLegendCollapsed ? styles.collapsedContent : ""}`}
          style={{ marginTop: 0 }}
        >
          <div
            style={{
              marginBottom: "16px",
              borderBottom: "1px solid rgba(0,0,0,0.05)",
              paddingBottom: "12px",
            }}
          >
            <p
              style={{
                margin: "0 0 10px 0",
                fontSize: "0.75rem",
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Flood Channels
            </p>
            <div className={styles.legendItem}>
              <span
                className={styles.legendIndicator}
                style={{ color: "#DC2626" }}
              />
              Critical Level
            </div>
            <div className={styles.legendItem}>
              <span
                className={styles.legendIndicator}
                style={{ color: "#EA580C" }}
              />
              High Pollution
            </div>
            <div className={styles.legendItem}>
              <span
                className={styles.legendIndicator}
                style={{ color: "#F59E0B" }}
              />
              Medium Impact
            </div>
          </div>

          <div>
            <p
              style={{
                margin: "0 0 10px 0",
                fontSize: "0.75rem",
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Sensor Status
            </p>
            <div className={styles.legendItem}>
              <span
                className={styles.legendIndicator}
                style={{ color: "#10B981" }}
              />
              Safe Zone
            </div>
            <div className={styles.legendItem}>
              <span
                className={styles.legendIndicator}
                style={{ color: "#F59E0B" }}
              />
              Warning Zone
            </div>
            <div className={styles.legendItem}>
              <span
                className={styles.legendIndicator}
                style={{ color: "#DC2626" }}
              />
              Flood Risk Detected
            </div>
            <div
              style={{
                marginTop: "12px",
                fontSize: "0.65rem",
                color: "#94a3b8",
                lineHeight: 1.4,
              }}
            >
              System updates every 5s • Processing 9 nodes.
            </div>
          </div>

          {/* Power Grid Legend */}
          <div style={{ marginTop: 16, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: "12px" }}>
            <p
              style={{
                margin: "0 0 10px 0",
                fontSize: "0.75rem",
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Power Grid
            </p>
            <div className={styles.legendItem}>
              <span
                className={styles.legendIndicator}
                style={{ color: "#F59E0B" }}
              />
              Substation Node
            </div>
            <div className={styles.legendItem}>
              <span
                className={styles.legendIndicator}
                style={{ color: "#FCD34D", borderRadius: "1px", height: "2px", width: "12px" }}
              />
              Power Flow Line
            </div>
          </div>

          {/* Sewage Grid Legend */}
          <div style={{ marginTop: 16, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: "12px" }}>
            <p
              style={{
                margin: "0 0 10px 0",
                fontSize: "0.75rem",
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Sewage Grid
            </p>
            <div className={styles.legendItem}>
              <span
                className={styles.legendIndicator}
                style={{ color: "#22D3EE" }}
              />
              Drain/Node
            </div>
            <div className={styles.legendItem}>
              <span
                className={styles.legendIndicator}
                style={{ color: "#0891B2", borderRadius: "1px", height: "2px", width: "12px" }}
              />
              Drainage Flow
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <p
              style={{
                margin: "0 0 10px 0",
                fontSize: "0.75rem",
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {hazardMode === "flood" ? "Flood Chance By Rain" : "Hazard Intensity"}
            </p>
            {hazardMode === "flood" ? (
              <>
                <div className={styles.legendItem}>
                  Severe chance
                  <strong style={{ marginLeft: "auto", color: "#DC2626" }}>
                    {scenarioChance[rainScenario].severePct}%
                  </strong>
                </div>
                <div className={styles.legendItem}>
                  High chance
                  <strong style={{ marginLeft: "auto", color: "#EA580C" }}>
                    {scenarioChance[rainScenario].highPct}%
                  </strong>
                </div>
                <div className={styles.legendItem}>
                  Moderate chance
                  <strong style={{ marginLeft: "auto", color: "#F59E0B" }}>
                    {scenarioChance[rainScenario].moderatePct}%
                  </strong>
                </div>
              </>
            ) : (
              <>
                <div className={styles.legendItem}>
                  Severe zones
                  <strong style={{ marginLeft: "auto", color: "#DC2626" }}>
                    {hazardSummary.severePct}%
                  </strong>
                </div>
                <div className={styles.legendItem}>
                  High zones
                  <strong style={{ marginLeft: "auto", color: "#EA580C" }}>
                    {hazardSummary.highPct}%
                  </strong>
                </div>
                <div className={styles.legendItem}>
                  Moderate zones
                  <strong style={{ marginLeft: "auto", color: "#F59E0B" }}>
                    {hazardSummary.moderatePct}%
                  </strong>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
