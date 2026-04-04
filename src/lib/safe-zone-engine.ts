/* eslint-disable @typescript-eslint/no-explicit-any */

export type ScenarioType = "blackout" | "flood_blackout" | "cyclone" | "strike";

export interface Shelter {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  type: string;
  district: string;
  governmentVerified: boolean;
  elevation: string;
}

export interface Substation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  circle: string;
  division: string;
  capacity: string;
  loading: string;
  kv: string;
}

export interface ImpactZone {
  lat: number;
  lng: number;
  radiusKm: number;
  severity: "red" | "yellow";
  label: string;
}

export interface SafeZonePlan {
  redZones: ImpactZone[];
  yellowZones: ImpactZone[];
  safeShelters: Shelter[];
  targetShelters: Shelter[];   // top-3 from k-means
  routes: number[][][];        // each route = array of [lat, lng] from OSRM
  rerouteCount: number;
  status: "idle" | "calculating" | "active" | "rerouting";
}

// ─── Haversine distance in km ─────────────────────────────────────────────────
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ─── K-means clustering (finds k centroid shelters from the safe pool) ────────
export function kMeansCentroids(shelters: Shelter[], k: number): Shelter[] {
  if (shelters.length <= k) return shelters;

  // Initialize: pick k shelters spread across Odisha (by longitude)
  const sorted = [...shelters].sort((a, b) => a.lng - b.lng);
  const step = Math.floor(sorted.length / k);
  let centroids: Shelter[] = Array.from({ length: k }, (_, i) => sorted[i * step]);

  for (let iter = 0; iter < 20; iter++) {
    // Assign each shelter to nearest centroid
    const clusters: Shelter[][] = Array.from({ length: k }, () => []);
    for (const s of shelters) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = haversineKm(s.lat, s.lng, centroids[c].lat, centroids[c].lng);
        if (d < bestDist) { bestDist = d; bestIdx = c; }
      }
      clusters[bestIdx].push(s);
    }

    // Recompute centroid as the shelter closest to mean position
    const newCentroids: Shelter[] = [];
    for (let c = 0; c < k; c++) {
      if (clusters[c].length === 0) { newCentroids.push(centroids[c]); continue; }
      const meanLat = clusters[c].reduce((s, x) => s + x.lat, 0) / clusters[c].length;
      const meanLng = clusters[c].reduce((s, x) => s + x.lng, 0) / clusters[c].length;
      let best = clusters[c][0];
      let bestD = Infinity;
      for (const sh of clusters[c]) {
        const d = haversineKm(sh.lat, sh.lng, meanLat, meanLng);
        if (d < bestD) { bestD = d; best = sh; }
      }
      newCentroids.push(best);
    }
    centroids = newCentroids;
  }

  return centroids;
}

// ─── Compute impact zones from a station blackout ────────────────────────────
export function computeImpactZones(
  epicenter: { lat: number; lng: number; name: string; circle: string; division: string },
  scenario: ScenarioType,
  allStations: Substation[],
): ImpactZone[] {
  const zones: ImpactZone[] = [];

  const radii: Record<ScenarioType, { red: number; yellow: number }> = {
    blackout:       { red: 15, yellow: 25 },
    flood_blackout: { red: 20, yellow: 35 },
    cyclone:        { red: 30, yellow: 50 },
    strike:         { red: 10, yellow: 18 },
  };

  const { red, yellow } = radii[scenario];

  // Primary epicenter
  zones.push({ lat: epicenter.lat, lng: epicenter.lng, radiusKm: red, severity: "red", label: epicenter.name });

  // Cascade to dependent stations in same division / circle
  const dependentStations = allStations.filter(
    (s) =>
      s.id !== String(epicenter) &&
      (s.division === epicenter.division || s.circle === epicenter.circle) &&
      haversineKm(epicenter.lat, epicenter.lng, s.lat, s.lng) < yellow
  );

  for (const dep of dependentStations.slice(0, 6)) {
    zones.push({
      lat: dep.lat,
      lng: dep.lng,
      radiusKm: red * 0.6,
      severity: "yellow",
      label: `${dep.name} (cascade)`,
    });
  }

  return zones;
}

// ─── Filter shelters that are safe (outside all red/yellow zones) ─────────────
export function filterSafeShelters(
  allShelters: Shelter[],
  zones: ImpactZone[],
): Shelter[] {
  return allShelters.filter((shelter) => {
    for (const zone of zones) {
      const dist = haversineKm(shelter.lat, shelter.lng, zone.lat, zone.lng);
      if (dist < zone.radiusKm) return false;
    }
    return true;
  });
}

// ─── Fetch road-following route from OSRM ────────────────────────────────────
export async function fetchOSRMRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<number[][]> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("OSRM error");
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) throw new Error("No route");
    // GeoJSON coords are [lng, lat] → convert to [lat, lng] for Leaflet
    return data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
  } catch {
    // Fallback: return straight line if OSRM fails
    return [[from.lat, from.lng], [to.lat, to.lng]];
  }
}

// ─── Build full safe zone plan ────────────────────────────────────────────────
export async function buildSafeZonePlan(
  epicenter: { lat: number; lng: number; name: string; circle: string; division: string },
  scenario: ScenarioType,
  allStations: Substation[],
  allShelters: Shelter[],
  extraThreats: { lat: number; lng: number }[] = [],
): Promise<SafeZonePlan> {
  const impactZones = computeImpactZones(epicenter, scenario, allStations);

  // Add extra threats (manually added on map)
  for (const threat of extraThreats) {
    impactZones.push({ lat: threat.lat, lng: threat.lng, radiusKm: 12, severity: "red", label: "New Threat" });
  }

  const redZones = impactZones.filter((z) => z.severity === "red");
  const yellowZones = impactZones.filter((z) => z.severity === "yellow");

  const safeShelters = filterSafeShelters(allShelters, impactZones);
  const targetShelters = kMeansCentroids(safeShelters, 3);

  // Fetch OSRM routes for each target shelter in parallel
  const routes = await Promise.all(
    targetShelters.map((shelter) => fetchOSRMRoute(epicenter, shelter))
  );

  return {
    redZones,
    yellowZones,
    safeShelters,
    targetShelters,
    routes,
    rerouteCount: 0,
    status: "active",
  };
}
