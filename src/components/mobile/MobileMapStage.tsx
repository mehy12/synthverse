"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import styles from "./MobileApp.module.css";
import "leaflet/dist/leaflet.css";
import HeatmapLayer from "@/components/map/HeatmapLayer";
import powerGridNodes from "@/data/power-grid-locations.json";

type MapLayerMode = "light" | "dark";
type HazardMode = "flood" | "cyclone" | "earthquake";
type RainScenario = "normal" | "rain" | "heavy_rain";

type LayerVisibility = {
  heatmap: boolean;
  hotspots: boolean;
  floodChannels: boolean;
  safeZones: boolean;
  powerGrid: boolean;
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

type ScenarioSummary = {
  severePct: number;
  highPct: number;
  moderatePct: number;
};

type MapSnapshot = {
  hazard: HazardMode;
  scenario: RainScenario;
  source: string;
  generatedAt: string;
  hotspotCount: number;
  severePct: number;
  topHotspots: HotspotPoint[];
};

type PowerNode = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

interface MobileMapStageProps {
  layerMode: MapLayerMode;
  zoomSignal: number;
  focusTarget: { lat: number; lng: number } | null;
  hazardMode: HazardMode;
  rainScenario: RainScenario;
  layers: LayerVisibility;
  onSnapshotChange?: (snapshot: MapSnapshot) => void;
}

function MapEffects({ zoomSignal, focusTarget }: Pick<MobileMapStageProps, "zoomSignal" | "focusTarget">) {
  const map = useMap();
  const previousZoomSignal = useRef(zoomSignal);

  useEffect(() => {
    if (zoomSignal === previousZoomSignal.current) {
      return;
    }

    previousZoomSignal.current = zoomSignal;
    map.zoomIn();
  }, [map, zoomSignal]);

  useEffect(() => {
    if (!focusTarget) {
      return;
    }

    map.flyTo([focusTarget.lat, focusTarget.lng], Math.max(map.getZoom(), 13), {
      animate: true,
      duration: 0.8,
    });
  }, [focusTarget, map]);

  return null;
}

export default function MobileMapStage({
  layerMode,
  zoomSignal,
  focusTarget,
  hazardMode,
  rainScenario,
  layers,
  onSnapshotChange,
}: MobileMapStageProps) {
  const [points, setPoints] = useState<HeatPoint[]>([]);
  const [hotspots, setHotspots] = useState<HotspotPoint[]>([]);
  const [source, setSource] = useState("/api/odisha-heatmap");
  const [generatedAt, setGeneratedAt] = useState("");
  const [chanceByScenario, setChanceByScenario] = useState<Record<string, ScenarioSummary>>({});

  const safeZones: Array<{ name: string; lat: number; lng: number; radius: number }> = [
    { name: "Chilika Basin South", lat: 19.645, lng: 85.22, radius: 1600 },
    { name: "Mahanadi Delta East", lat: 20.32, lng: 86.41, radius: 1400 },
    { name: "Brahmani Mouth", lat: 20.81, lng: 86.85, radius: 1250 },
  ];

  const flowLines: Array<Array<[number, number]>> = [
    [
      [20.42, 85.94],
      [20.35, 85.88],
      [20.28, 85.84],
      [20.21, 85.8],
    ],
    [
      [20.39, 85.86],
      [20.3, 85.83],
      [20.23, 85.76],
    ],
  ];

  const powerNodes = useMemo(
    () =>
      (powerGridNodes as PowerNode[])
        .filter((node) => Number.isFinite(node.lat) && Number.isFinite(node.lng))
        .slice(0, 20),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const loadHeatmap = async () => {
      try {
        const params = new URLSearchParams({ hazard: hazardMode });
        if (hazardMode === "flood") {
          params.set("scenario", rainScenario);
        }

        const response = await fetch(`/api/odisha-heatmap?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (cancelled) return;

        const nextPoints = Array.isArray(data?.points) ? data.points : [];
        const nextHotspots = Array.isArray(data?.hotspots) ? data.hotspots : [];
        const nextChance = data?.chanceByScenario && typeof data.chanceByScenario === "object"
          ? data.chanceByScenario
          : {};

        setPoints(nextPoints);
        setHotspots(nextHotspots);
        setSource(typeof data?.source === "string" ? data.source : "/api/odisha-heatmap");
        setGeneratedAt(typeof data?.generatedAt === "string" ? data.generatedAt : "");
        setChanceByScenario(nextChance);

        if (typeof onSnapshotChange === "function") {
          const active = (nextChance[hazardMode === "flood" ? rainScenario : "normal"] ??
            nextChance.normal ??
            { severePct: 0, highPct: 0, moderatePct: 0 }) as ScenarioSummary;

          onSnapshotChange({
            hazard: hazardMode,
            scenario: rainScenario,
            source: typeof data?.source === "string" ? data.source : "/api/odisha-heatmap",
            generatedAt: typeof data?.generatedAt === "string" ? data.generatedAt : "",
            hotspotCount: nextHotspots.length,
            severePct: Number(active.severePct ?? 0),
            topHotspots: nextHotspots.slice(0, 3),
          });
        }
      } catch {
        if (cancelled) return;
        setPoints([]);
        setHotspots([]);
      }
    };

    void loadHeatmap();

    return () => {
      cancelled = true;
    };
  }, [hazardMode, rainScenario, onSnapshotChange]);

  const tileUrl = layerMode === "light"
    ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

  const criticalZone = hotspots.slice(0, 3).map((h) => [h.lat, h.lng] as [number, number]);
  const warningZone = hotspots.slice(3, 6).map((h) => [h.lat, h.lng] as [number, number]);

  return (
    <MapContainer center={[20.2961, 85.8245]} zoom={11} scrollWheelZoom={false} zoomControl={false} className={styles.mapContainer}>
      <TileLayer key={layerMode} url={tileUrl} attribution="" />
      <MapEffects zoomSignal={zoomSignal} focusTarget={focusTarget} />

      <HeatmapLayer points={points} visible={layers.heatmap} theme={hazardMode} />

      {criticalZone.length >= 3 && (
        <Polygon
          positions={criticalZone}
          pathOptions={{
            color: "#dc2626",
            weight: 1.5,
            fillColor: "#ef4444",
            fillOpacity: 0.2,
            dashArray: "4 6",
          }}
        />
      )}
      {warningZone.length >= 3 && (
        <Polygon
          positions={warningZone}
          pathOptions={{
            color: "#f59e0b",
            weight: 1.4,
            fillColor: "#facc15",
            fillOpacity: 0.15,
            dashArray: "5 6",
          }}
        />
      )}

      {layers.floodChannels &&
        flowLines.map((line, index) => (
          <Polyline
            key={`flow-${index}`}
            positions={line}
            pathOptions={{
              color: "#38bdf8",
              weight: 2,
              opacity: 0.75,
            }}
          />
        ))}

      {layers.safeZones &&
        safeZones.map((zone) => (
          <Circle
            key={zone.name}
            center={[zone.lat, zone.lng]}
            radius={zone.radius}
            pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.08, weight: 1 }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700 }}>{zone.name}</div>
            </Tooltip>
          </Circle>
        ))}

      {layers.hotspots &&
        hotspots.slice(0, 10).map((hotspot, index) => (
          <CircleMarker
            key={`hotspot-${hotspot.lat}-${hotspot.lng}-${index}`}
            center={[hotspot.lat, hotspot.lng]}
            radius={7}
            pathOptions={{
              color: "#ef4444",
              fillColor: "#f97316",
              fillOpacity: 0.75,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                {(hotspot.district || "Risk hotspot")} ({Math.round(hotspot.score ?? 0)})
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

      {layers.powerGrid &&
        powerNodes.map((node) => (
          <CircleMarker
            key={`grid-${node.id}`}
            center={[node.lat, node.lng]}
            radius={4}
            pathOptions={{
              color: "#f59e0b",
              fillColor: "#fbbf24",
              fillOpacity: 0.85,
              weight: 1.5,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700 }}>{node.name}</div>
            </Tooltip>
          </CircleMarker>
        ))}
    </MapContainer>
  );
}