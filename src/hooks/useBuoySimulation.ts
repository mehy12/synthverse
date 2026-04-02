"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Waypoint {
  lat: number;
  lng: number;
  label: string;
}

export interface ZoneProfile {
  /** Lat/lng center of the zone */
  lat: number;
  lng: number;
  /** Radius of influence in degrees (~0.05 ≈ 5 km) */
  radius: number;
  label: string;
  /** Sensor baselines for this zone */
  pH: [number, number];
  turbidity: [number, number];
  dissolvedO2: [number, number];
  conductivity: [number, number];
  temperature: [number, number];
}

export interface SensorReading {
  pH: number;
  turbidity: number;
  dissolvedO2: number;
  conductivity: number;
  temperature: number;
  healthScore: number;
}

export interface TrailPoint {
  lat: number;
  lng: number;
  healthScore: number;
  timestamp: number;
}

export interface BuoyState {
  id: string;
  name: string;
  lat: number;
  lng: number;
  currentZoneLabel: string;
  sensors: SensorReading;
  sensorHistory: SensorReading[];
  trail: TrailPoint[];
  lastSync: number;
  inDangerZone: boolean;
}

export interface BuoyConfig {
  id?: string;
  name?: string;
  waypoints?: Waypoint[];
  zones?: ZoneProfile[];
  /** Total loop time in ms (default 480000 = 8 min) */
  loopDurationMs?: number;
  /** Optional starting progress offset (0-1) so multiple buoys aren't in sync */
  startOffset?: number;
}

// ─── Defaults (Buoy Alpha — Kochi Coastal Patrol) ──────────────────────────

export const BUOY_ALPHA_WAYPOINTS: Waypoint[] = [
  { lat: 9.85, lng: 76.20, label: "Chellanam Coast" },
  { lat: 9.88, lng: 76.18, label: "Moving northwest" },
  { lat: 9.92, lng: 76.16, label: "Approaching Vypeen" },
  { lat: 9.96, lng: 76.14, label: "Fort Kochi Harbor" },
  { lat: 10.02, lng: 76.15, label: "Heading north" },
  { lat: 10.08, lng: 76.16, label: "Vypeen Island" },
  { lat: 10.12, lng: 76.17, label: "Puthuvype" },
  { lat: 10.10, lng: 76.19, label: "Turning back east" },
  { lat: 9.98, lng: 76.21, label: "Mid coast" },
  // Loop closure — back to start
];

export const BUOY_ALPHA_ZONES: ZoneProfile[] = [
  // Polluted zone — Chellanam / Periyar mouth
  {
    lat: 9.86,
    lng: 76.21,
    radius: 0.06,
    label: "Periyar Mouth (Polluted)",
    pH: [6.8, 7.2],
    turbidity: [45, 75],
    dissolvedO2: [3.5, 5.0],
    conductivity: [48000, 55000],
    temperature: [30, 32],
  },
  // Clean zone — Fort Kochi / open sea
  {
    lat: 9.96,
    lng: 76.14,
    radius: 0.08,
    label: "Fort Kochi (Clean)",
    pH: [7.8, 8.2],
    turbidity: [5, 15],
    dissolvedO2: [6.5, 8.5],
    conductivity: [35000, 40000],
    temperature: [27, 29],
  },
  // Cleanest zone — Munambam / Puthuvype
  {
    lat: 10.10,
    lng: 76.17,
    radius: 0.07,
    label: "Munambam (Pristine)",
    pH: [8.0, 8.4],
    turbidity: [2, 8],
    dissolvedO2: [7.5, 9.0],
    conductivity: [33000, 37000],
    temperature: [27, 28],
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Compute distance in degrees between two points (fast/flat-earth approx) */
function degDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = lat2 - lat1;
  const dlng = lng2 - lng1;
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

/** Compute total path length in degrees */
function totalPathLength(waypoints: Waypoint[]): number {
  let total = 0;
  for (let i = 0; i < waypoints.length; i++) {
    const next = waypoints[(i + 1) % waypoints.length];
    total += degDist(waypoints[i].lat, waypoints[i].lng, next.lat, next.lng);
  }
  return total;
}

/** Get interpolated position + nearest zone label for a given progress (0..1) along the path.
 *  Adds a gentle sinusoidal drift perpendicular to the travel direction so the
 *  path curves naturally — boats don't travel in perfectly straight lines. */
function getPositionAtProgress(
  waypoints: Waypoint[],
  progress: number
): { lat: number; lng: number; segmentIndex: number; nearestLabel: string } {
  const n = waypoints.length;
  const segments: number[] = [];
  let total = 0;

  for (let i = 0; i < n; i++) {
    const next = waypoints[(i + 1) % n];
    const d = degDist(waypoints[i].lat, waypoints[i].lng, next.lat, next.lng);
    segments.push(d);
    total += d;
  }

  const targetDist = (progress % 1) * total;
  let accumulated = 0;

  for (let i = 0; i < n; i++) {
    if (accumulated + segments[i] >= targetDist) {
      const segProgress = (targetDist - accumulated) / segments[i];
      const next = waypoints[(i + 1) % n];
      let lat = lerp(waypoints[i].lat, next.lat, segProgress);
      let lng = lerp(waypoints[i].lng, next.lng, segProgress);

      // Perpendicular drift: sine wave along the segment for natural curvature
      const dlat = next.lat - waypoints[i].lat;
      const dlng = next.lng - waypoints[i].lng;
      const segLen = Math.sqrt(dlat * dlat + dlng * dlng) || 1;
      // Unit perpendicular vector (rotated 90°)
      const perpLat = -dlng / segLen;
      const perpLng = dlat / segLen;
      // Drift magnitude: ~0.00015 degrees (~15m), varies by segment index
      const driftAmplitude = 0.00015 + (i % 3) * 0.00005;
      // Two overlapping sine waves for a more organic feel
      const wave = Math.sin(segProgress * Math.PI * 2) * driftAmplitude
                 + Math.sin(segProgress * Math.PI * 5 + i * 1.7) * driftAmplitude * 0.3;
      lat += perpLat * wave;
      lng += perpLng * wave;

      return { lat, lng, segmentIndex: i, nearestLabel: waypoints[i].label };
    }
    accumulated += segments[i];
  }

  return { lat: waypoints[0].lat, lng: waypoints[0].lng, segmentIndex: 0, nearestLabel: waypoints[0].label };
}

/** Blend sensor values based on proximity to zones */
function computeSensors(lat: number, lng: number, zones: ZoneProfile[]): SensorReading {
  // Default "open water" baseline
  let pH = 7.9;
  let turbidity = 10;
  let dissolvedO2 = 7.0;
  let conductivity = 37000;
  let temperature = 28;

  // Weight by inverse distance to each zone
  let totalWeight = 0.001; // small epsilon to avoid division by zero
  let wpH = 0, wTurb = 0, wDO = 0, wCond = 0, wTemp = 0;

  for (const zone of zones) {
    const dist = degDist(lat, lng, zone.lat, zone.lng);
    if (dist > zone.radius * 3) continue; // too far, skip
    const weight = Math.max(0, 1 - dist / (zone.radius * 2));
    const w = weight * weight; // squared falloff for smoother blending
    totalWeight += w;
    wpH += lerp(zone.pH[0], zone.pH[1], Math.random()) * w;
    wTurb += lerp(zone.turbidity[0], zone.turbidity[1], Math.random()) * w;
    wDO += lerp(zone.dissolvedO2[0], zone.dissolvedO2[1], Math.random()) * w;
    wCond += lerp(zone.conductivity[0], zone.conductivity[1], Math.random()) * w;
    wTemp += lerp(zone.temperature[0], zone.temperature[1], Math.random()) * w;
  }

  if (totalWeight > 0.01) {
    pH = wpH / totalWeight;
    turbidity = wTurb / totalWeight;
    dissolvedO2 = wDO / totalWeight;
    conductivity = wCond / totalWeight;
    temperature = wTemp / totalWeight;
  }

  // Add ±3% sensor noise
  const noise = () => 1 + (Math.random() - 0.5) * 0.06;
  pH = +(pH * noise()).toFixed(1);
  turbidity = +(turbidity * noise()).toFixed(0);
  dissolvedO2 = +(dissolvedO2 * noise()).toFixed(1);
  conductivity = +(conductivity * noise()).toFixed(0);
  temperature = +(temperature * noise()).toFixed(1);

  // Health score: 0-100
  // Good: high pH (7.8-8.4), low turbidity (<15), high DO (>6.5), normal conductivity, normal temp
  let score = 100;
  if (pH < 7.5) score -= (7.5 - pH) * 30;
  if (pH > 8.4) score -= (pH - 8.4) * 20;
  if (turbidity > 15) score -= Math.min(40, (turbidity - 15) * 0.7);
  if (dissolvedO2 < 6.0) score -= (6.0 - dissolvedO2) * 15;
  if (conductivity > 45000) score -= Math.min(20, (conductivity - 45000) / 1000);
  if (temperature > 30) score -= (temperature - 30) * 8;
  const healthScore = Math.max(0, Math.min(100, Math.round(score)));

  return { pH, turbidity, dissolvedO2, conductivity, temperature, healthScore };
}

function getDangerZoneLabel(lat: number, lng: number, zones: ZoneProfile[]): string {
  let closest = "Open Water";
  let closestDist = Infinity;
  for (const zone of zones) {
    const d = degDist(lat, lng, zone.lat, zone.lng);
    if (d < closestDist) {
      closestDist = d;
      closest = zone.label;
    }
  }
  return closest;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

const TRAIL_DURATION_MS = 20 * 60 * 1000; // 20 minutes of trail for persistent pollution mapping
const SENSOR_UPDATE_MS = 5000; // sensor update every 5s
const HISTORY_MAX = 12; // keep last 12 readings for sparklines (60s at 5s interval)

export function useBuoyFleet(configs: BuoyConfig[]): BuoyState[] {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fleetInfo = useMemo(() => {
    return configs.map((config, idx) => {
      const waypoints = config.waypoints || BUOY_ALPHA_WAYPOINTS;
      const totalDist = totalPathLength(waypoints);
      const loopDurationMs = config.loopDurationMs || Math.max(60000, (totalDist / 0.4) * 180000);
      return {
        ...config,
        id: config.id || `buoy-${idx}`,
        name: config.name || `Buoy Node ${idx}`,
        waypoints,
        zones: config.zones || BUOY_ALPHA_ZONES,
        loopDurationMs,
        startOffset: config.startOffset || 0,
      };
    });
    // We intentionally only run this config compilation once on mount
  }, []);

  const startTimeRef = useRef(Date.now());
  const animFrameRef = useRef<number>(0);
  const sensorIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const [fleetState, setFleetState] = useState<BuoyState[]>(() => {
    return fleetInfo.map((info: any) => {
      // Initialize with startOffset applied! Otherwise they start grouped at progress 0 momentarily
      const pos = getPositionAtProgress(info.waypoints, info.startOffset % 1);
      const sensors = computeSensors(pos.lat, pos.lng, info.zones);
      return {
        id: info.id,
        name: info.name,
        lat: pos.lat,
        lng: pos.lng,
        currentZoneLabel: getDangerZoneLabel(pos.lat, pos.lng, info.zones),
        sensors,
        sensorHistory: [sensors],
        trail: [{ lat: pos.lat, lng: pos.lng, healthScore: sensors.healthScore, timestamp: Date.now() }],
        lastSync: Date.now(),
        inDangerZone: sensors.healthScore < 50,
      };
    });
  });

  // Animate position with a single unified requestAnimationFrame
  useEffect(() => {
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      
      setFleetState((prevFleet) => prevFleet.map((prev, i) => {
        const info = fleetInfo[i];
        const progress = ((elapsed / info.loopDurationMs) + info.startOffset) % 1;
        const pos = getPositionAtProgress(info.waypoints, progress);

        return {
          ...prev,
          lat: pos.lat,
          lng: pos.lng,
          currentZoneLabel: pos.nearestLabel,
          lastSync: Date.now(),
        };
      }));

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [fleetInfo]);

  // Unified Sensor updates + trail recording every 5s
  useEffect(() => {
    sensorIntervalRef.current = setInterval(() => {
      setFleetState((prevFleet) => prevFleet.map((prev, i) => {
        const info = fleetInfo[i];
        const sensors = computeSensors(prev.lat, prev.lng, info.zones);
        const now = Date.now();
        const zoneLabel = getDangerZoneLabel(prev.lat, prev.lng, info.zones);
        const inDanger = sensors.healthScore < 50;

        // Fire danger-zone alert if transitioning into danger
        if (inDanger && !prev.inDangerZone && typeof window !== "undefined") {
          const event = new CustomEvent("neptune-buoy-alert", {
            detail: {
              buoyName: info.name,
              zone: zoneLabel,
              healthScore: sensors.healthScore,
              lat: prev.lat,
              lng: prev.lng,
              timestamp: new Date().toISOString(),
            },
          });
          window.dispatchEvent(event);
        }

        return {
          ...prev,
          sensors,
          sensorHistory: [...prev.sensorHistory.slice(-(HISTORY_MAX - 1)), sensors],
          trail: [
            ...prev.trail.filter((p) => now - p.timestamp < TRAIL_DURATION_MS),
            { lat: prev.lat, lng: prev.lng, healthScore: sensors.healthScore, timestamp: now },
          ],
          inDangerZone: inDanger,
        };
      }));
    }, SENSOR_UPDATE_MS);

    return () => clearInterval(sensorIntervalRef.current);
  }, [fleetInfo]);

  return fleetState;
}
