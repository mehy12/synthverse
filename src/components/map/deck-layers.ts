/**
 * Deck.gl Layer Factories — ALL infrastructure layers for the Flood Digital Twin
 * Includes: Flood zones, rivers, heatmap, power grid, sewage grid,
 *           waterways (basins, pipelines, irrigation), shelters, ARO agents
 */

import { GeoJsonLayer, ScatterplotLayer, PathLayer, PolygonLayer, TextLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import {
  ODISHA_DISTRICTS,
  ODISHA_RIVERS,
  districtsToGeoJSON,
  riskToColor,
} from "@/data/odisha-geo";
import powerGridNodes from "@/data/power-grid-locations.json";
import sewageGridNodes from "@/data/sewage-grid-locations.json";
import waterData from "@/data/water-infrastructure.json";
import sheltersData from "@/data/shelters.json";

// ── Flood Zone Polygons ──────────────────────────────────────────
export function createFloodZoneLayer(
  timeHour: number,
  onHover: (info: any) => void,
  onClick: (info: any) => void
) {
  const geojson = districtsToGeoJSON(ODISHA_DISTRICTS, timeHour);
  return new GeoJsonLayer({
    id: "flood-zones",
    data: geojson as any,
    pickable: true, stroked: true, filled: true, extruded: false,
    lineWidthMinPixels: 1,
    getFillColor: (f: any) => riskToColor(f.properties?.riskScore ?? 0, 120),
    getLineColor: (f: any) => riskToColor(f.properties?.riskScore ?? 0, 200),
    getLineWidth: 1,
    onHover, onClick,
    updateTriggers: { getFillColor: [timeHour], getLineColor: [timeHour] },
    transitions: { getFillColor: 600, getLineColor: 600 },
  });
}

// ── District Boundaries ──────────────────────────────────────────
export function createDistrictOutlineLayer(timeHour: number) {
  const geojson = districtsToGeoJSON(ODISHA_DISTRICTS, timeHour);
  return new GeoJsonLayer({
    id: "district-outlines",
    data: geojson as any,
    pickable: false, stroked: true, filled: false,
    lineWidthMinPixels: 1,
    getLineColor: [148, 163, 184, 60],
    getLineWidth: 0.5,
  });
}

// ── River Paths ──────────────────────────────────────────────────
export function createRiverLayer() {
  return new PathLayer({
    id: "rivers",
    data: ODISHA_RIVERS,
    pickable: true, widthScale: 1, widthMinPixels: 2,
    getPath: (d: any) => d.coordinates,
    getColor: (d: any) => {
      const hex = d.color || "#38bdf8";
      return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 180];
    },
    getWidth: (d: any) => d.width || 3,
    capRounded: true, jointRounded: true,
  });
}

// ── Risk Heatmap ─────────────────────────────────────────────────
export function createRiskHeatmapLayer(points: Array<{ lat: number; lng: number; weight: number }>) {
  if (!points.length) return null;
  return new HeatmapLayer({
    id: "risk-heatmap",
    data: points,
    getPosition: (d: any) => [d.lng, d.lat],
    getWeight: (d: any) => d.weight,
    radiusPixels: 50, intensity: 1.5, threshold: 0.1,
    colorRange: [
      [34,197,94,0],[34,197,94,120],[234,179,8,160],
      [249,115,22,200],[220,38,38,240],[153,27,27,255],
    ],
  });
}

// ── Hotspot Alert Markers ────────────────────────────────────────
export function createHotspotLayer(hotspots: Array<{ lat: number; lng: number; district?: string; score?: number }>) {
  return new ScatterplotLayer({
    id: "hotspot-alerts",
    data: hotspots,
    pickable: true, opacity: 0.8, stroked: true, filled: true,
    radiusScale: 1, radiusMinPixels: 6, radiusMaxPixels: 18,
    getPosition: (d: any) => [d.lng, d.lat],
    getRadius: (d: any) => Math.max(800, (d.score || 50) * 40),
    getFillColor: [239, 68, 68, 140],
    getLineColor: [239, 68, 68, 255],
    getLineWidth: 2,
  });
}

// ── ARO Agents ───────────────────────────────────────────────────
export function createAgentLayer(agents: Array<any>) {
  const activeAgents = agents.filter((a: any) => a.status !== "idle");
  return new ScatterplotLayer({
    id: "aro-agents",
    data: activeAgents,
    pickable: true, opacity: 1, stroked: true, filled: true,
    radiusMinPixels: 5, radiusMaxPixels: 12,
    getPosition: (d: any) => [d.position[1], d.position[0]],
    getRadius: 500,
    getFillColor: (d: any) => {
      switch (d.status) {
        case "en_route": return [56,189,248,220];
        case "rescuing": return [251,191,36,220];
        case "returning": return [16,185,129,220];
        default: return [100,116,139,100];
      }
    },
    getLineColor: [255,255,255,180],
    getLineWidth: 2,
  });
}


// ══════════════════════════════════════════════════════════════════
//  INFRASTRUCTURE LAYERS (RESTORED)
// ══════════════════════════════════════════════════════════════════

// ── Power Grid Network ───────────────────────────────────────────
const GRID_NETWORK = (() => {
  const circles: Record<string, any[]> = {};
  (powerGridNodes as any[]).forEach((node) => {
    if (!circles[node.circle]) circles[node.circle] = [];
    circles[node.circle].push(node);
  });
  const connections: any[] = [];
  Object.entries(circles).forEach(([circleName, nodes]) => {
    const sorted = [...nodes].sort((a, b) => a.lng - b.lng);
    for (let i = 0; i < sorted.length - 1; i++) {
      connections.push({
        from: [sorted[i].lng, sorted[i].lat],
        to: [sorted[i + 1].lng, sorted[i + 1].lat],
        color: [252, 211, 77],
        width: 2,
      });
    }
    const divisions: Record<string, any[]> = {};
    nodes.forEach((n) => { if (!divisions[n.division]) divisions[n.division] = []; divisions[n.division].push(n); });
    const divCenters = Object.values(divisions).map((d) => d[0]);
    if (divCenters.length > 1) {
      for (let i = 0; i < divCenters.length - 1; i++) {
        connections.push({
          from: [divCenters[i].lng, divCenters[i].lat],
          to: [divCenters[i + 1].lng, divCenters[i + 1].lat],
          color: [245, 158, 11],
          width: 3,
        });
      }
    }
  });
  return connections;
})();

export function createPowerGridLinesLayer() {
  return new PathLayer({
    id: "power-grid-lines",
    data: GRID_NETWORK,
    getPath: (d: any) => [d.from, d.to],
    getColor: (d: any) => [...d.color, 180],
    getWidth: (d: any) => d.width,
    widthMinPixels: 1,
    capRounded: true,
    getDashArray: [4, 8],
    dashJustified: true,
    extensions: [],
  });
}

export function createPowerGridNodesLayer() {
  return new ScatterplotLayer({
    id: "power-grid-nodes",
    data: powerGridNodes as any[],
    pickable: true, stroked: true, filled: true,
    radiusMinPixels: 3, radiusMaxPixels: 8,
    getPosition: (d: any) => [d.lng, d.lat],
    getRadius: 300,
    getFillColor: [252, 211, 77, 255],
    getLineColor: [245, 158, 11, 255],
    getLineWidth: 1.5,
  });
}

export function createPowerGridLabelsLayer() {
  return new TextLayer({
    id: "power-grid-labels",
    data: (powerGridNodes as any[]).filter((_: any, i: number) => i % 3 === 0),
    getPosition: (d: any) => [d.lng, d.lat],
    getText: (d: any) => d.name,
    getSize: 11,
    getColor: [252, 211, 77, 200],
    getAngle: 0,
    getTextAnchor: "start" as const,
    getAlignmentBaseline: "center" as const,
    getPixelOffset: [8, 0],
    fontFamily: "Inter, sans-serif",
    fontWeight: 600,
    billboard: false,
  });
}

// ── Sewage Grid ──────────────────────────────────────────────────
const SEWAGE_NETWORK = (() => {
  const connections: any[] = [];
  const nodes = sewageGridNodes as any[];
  const distThreshold = 0.012;
  for (let i = 0; i < nodes.length; i += 2) {
    const a = nodes[i];
    let found = 0;
    for (let j = i + 1; j < nodes.length && found < 2; j++) {
      const b = nodes[j];
      if (Math.abs(a.lat - b.lat) < distThreshold && Math.abs(a.lon - b.lon) < distThreshold) {
        connections.push({ from: [a.lon, a.lat], to: [b.lon, b.lat] });
        found++;
      }
    }
  }
  return connections;
})();

export function createSewageLinesLayer() {
  return new PathLayer({
    id: "sewage-lines",
    data: SEWAGE_NETWORK,
    getPath: (d: any) => [d.from, d.to],
    getColor: [16, 185, 129, 130],
    getWidth: 2,
    widthMinPixels: 1,
    capRounded: true,
    getDashArray: [3, 5],
    dashJustified: true,
    extensions: [],
  });
}

export function createSewageNodesLayer() {
  return new ScatterplotLayer({
    id: "sewage-nodes",
    data: (sewageGridNodes as any[]).filter((_: any, i: number) => i % 4 === 0),
    pickable: true, stroked: true, filled: true, opacity: 0.8,
    radiusMinPixels: 2, radiusMaxPixels: 5,
    getPosition: (d: any) => [d.lon, d.lat],
    getRadius: 200,
    getFillColor: [16, 185, 129, 200],
    getLineColor: [5, 150, 105, 255],
    getLineWidth: 1,
  });
}

// ── Water Infrastructure (Basins, Pipelines, Waterways, Irrigation) ──

export function createWaterwayLinesLayer() {
  const lines = (waterData.waterways as any[]).filter((w: any) => w.line);
  return new PathLayer({
    id: "waterway-lines",
    data: lines,
    pickable: true,
    getPath: (d: any) => d.line.map((p: number[]) => [p[1], p[0]]),
    getColor: (d: any) => {
      const hex = d.color || "#38BDF8";
      return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16), 200];
    },
    getWidth: (d: any) => d.kind === "coast" ? 3 : 4,
    widthMinPixels: 2,
    capRounded: true, jointRounded: true,
  });
}

export function createBasinsLayer() {
  return new PolygonLayer({
    id: "water-basins",
    data: waterData.basins as any[],
    pickable: true, stroked: true, filled: true, extruded: false,
    getPolygon: (d: any) => d.polygon.map((p: number[]) => [p[1], p[0]]),
    getFillColor: (d: any) => {
      const hex = d.color || "#1E40AF";
      return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16), 20];
    },
    getLineColor: (d: any) => {
      const hex = d.color || "#1E40AF";
      return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16), 120];
    },
    getLineWidth: 2,
    lineWidthMinPixels: 1,
  });
}

export function createPipelinesLayer() {
  return new PathLayer({
    id: "water-pipelines",
    data: waterData.pipelines as any[],
    pickable: true,
    getPath: (d: any) => d.path.map((p: number[]) => [p[1], p[0]]),
    getColor: (d: any) => {
      const hex = d.color || "#0EA5E9";
      return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16), 160];
    },
    getWidth: 5,
    widthMinPixels: 2,
    capRounded: true,
    getDashArray: [10, 12],
    dashJustified: true,
    extensions: [],
  });
}

export function createIrrigationLayer() {
  return new PathLayer({
    id: "irrigation-canals",
    data: waterData.irrigation as any[],
    pickable: true,
    getPath: (d: any) => d.line.map((p: number[]) => [p[1], p[0]]),
    getColor: (d: any) => {
      const hex = d.color || "#3B82F6";
      return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16), 140];
    },
    getWidth: 3,
    widthMinPixels: 1,
    capRounded: true, jointRounded: true,
  });
}

// ── Shelter Markers ──────────────────────────────────────────────
export function createShelterLayer() {
  return new ScatterplotLayer({
    id: "shelters",
    data: sheltersData as any[],
    pickable: true, stroked: true, filled: true,
    radiusMinPixels: 5, radiusMaxPixels: 12,
    getPosition: (d: any) => [d.lng, d.lat],
    getRadius: 500,
    getFillColor: (d: any) => {
      switch (d.type) {
        case "hospital": return [239, 68, 68, 220];
        case "cyclone_shelter": return [29, 185, 84, 220];
        case "school": return [59, 130, 246, 220];
        default: return [245, 158, 11, 220];
      }
    },
    getLineColor: [255, 255, 255, 200],
    getLineWidth: 2,
  });
}
