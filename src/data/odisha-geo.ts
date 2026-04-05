/**
 * Odisha Flood Digital Twin — Mock Geospatial Data
 * Simplified district polygons, river paths, rainfall, and water levels
 */

// ── District boundaries (simplified polygons) ──────────────────────
export interface DistrictFeature {
  name: string;
  population: number;
  riskScore: number;        // 0.0 - 1.0
  riskLevel: "critical" | "high" | "medium" | "low";
  rainfall7d: number[];     // mm per day, last 7 days
  waterLevel: number;       // current river water level in meters
  dangerMark: number;       // danger mark level in meters
  coordinates: number[][][]; // GeoJSON Polygon coordinates [lng, lat]
}

export const ODISHA_DISTRICTS: DistrictFeature[] = [
  {
    name: "Kendrapara",
    population: 1440361,
    riskScore: 0.92,
    riskLevel: "critical",
    rainfall7d: [12, 45, 78, 120, 95, 88, 110],
    waterLevel: 8.2,
    dangerMark: 7.5,
    coordinates: [[[86.5, 20.3], [86.9, 20.3], [86.9, 20.7], [86.5, 20.7], [86.5, 20.3]]],
  },
  {
    name: "Jagatsinghpur",
    population: 1136971,
    riskScore: 0.88,
    riskLevel: "critical",
    rainfall7d: [8, 35, 68, 105, 112, 78, 95],
    waterLevel: 7.8,
    dangerMark: 7.2,
    coordinates: [[[86.0, 20.0], [86.5, 20.0], [86.5, 20.4], [86.0, 20.4], [86.0, 20.0]]],
  },
  {
    name: "Puri",
    population: 1698730,
    riskScore: 0.78,
    riskLevel: "high",
    rainfall7d: [5, 28, 55, 90, 85, 65, 72],
    waterLevel: 6.5,
    dangerMark: 7.0,
    coordinates: [[[85.5, 19.6], [86.1, 19.6], [86.1, 20.0], [85.5, 20.0], [85.5, 19.6]]],
  },
  {
    name: "Cuttack",
    population: 2624470,
    riskScore: 0.82,
    riskLevel: "critical",
    rainfall7d: [10, 40, 72, 98, 88, 75, 82],
    waterLevel: 7.9,
    dangerMark: 7.8,
    coordinates: [[[85.6, 20.3], [86.1, 20.3], [86.1, 20.7], [85.6, 20.7], [85.6, 20.3]]],
  },
  {
    name: "Khurda",
    population: 2246341,
    riskScore: 0.65,
    riskLevel: "high",
    rainfall7d: [6, 22, 48, 72, 68, 55, 60],
    waterLevel: 5.8,
    dangerMark: 7.0,
    coordinates: [[[85.4, 19.9], [85.9, 19.9], [85.9, 20.4], [85.4, 20.4], [85.4, 19.9]]],
  },
  {
    name: "Bhadrak",
    population: 1506522,
    riskScore: 0.75,
    riskLevel: "high",
    rainfall7d: [8, 32, 62, 88, 92, 70, 78],
    waterLevel: 6.8,
    dangerMark: 7.2,
    coordinates: [[[86.3, 20.8], [86.8, 20.8], [86.8, 21.2], [86.3, 21.2], [86.3, 20.8]]],
  },
  {
    name: "Jajpur",
    population: 1827192,
    riskScore: 0.72,
    riskLevel: "high",
    rainfall7d: [7, 28, 55, 80, 75, 62, 70],
    waterLevel: 6.4,
    dangerMark: 7.0,
    coordinates: [[[85.9, 20.6], [86.5, 20.6], [86.5, 21.0], [85.9, 21.0], [85.9, 20.6]]],
  },
  {
    name: "Balasore",
    population: 2320529,
    riskScore: 0.68,
    riskLevel: "high",
    rainfall7d: [6, 25, 50, 75, 70, 58, 65],
    waterLevel: 5.5,
    dangerMark: 6.8,
    coordinates: [[[86.5, 21.2], [87.1, 21.2], [87.1, 21.7], [86.5, 21.7], [86.5, 21.2]]],
  },
  {
    name: "Ganjam",
    population: 3529031,
    riskScore: 0.55,
    riskLevel: "medium",
    rainfall7d: [4, 18, 35, 55, 48, 40, 45],
    waterLevel: 4.8,
    dangerMark: 6.5,
    coordinates: [[[84.2, 19.0], [85.1, 19.0], [85.1, 19.7], [84.2, 19.7], [84.2, 19.0]]],
  },
  {
    name: "Mayurbhanj",
    population: 2519738,
    riskScore: 0.45,
    riskLevel: "medium",
    rainfall7d: [3, 15, 28, 45, 40, 35, 38],
    waterLevel: 3.8,
    dangerMark: 6.0,
    coordinates: [[[86.0, 21.5], [86.8, 21.5], [86.8, 22.2], [86.0, 22.2], [86.0, 21.5]]],
  },
  {
    name: "Sambalpur",
    population: 1044862,
    riskScore: 0.35,
    riskLevel: "low",
    rainfall7d: [2, 10, 22, 35, 30, 25, 28],
    waterLevel: 3.2,
    dangerMark: 6.0,
    coordinates: [[[83.4, 21.2], [84.2, 21.2], [84.2, 21.8], [83.4, 21.8], [83.4, 21.2]]],
  },
  {
    name: "Sundargarh",
    population: 2093437,
    riskScore: 0.28,
    riskLevel: "low",
    rainfall7d: [2, 8, 18, 28, 25, 20, 22],
    waterLevel: 2.8,
    dangerMark: 5.5,
    coordinates: [[[83.8, 21.7], [84.8, 21.7], [84.8, 22.4], [83.8, 22.4], [83.8, 21.7]]],
  },
  {
    name: "Angul",
    population: 1273821,
    riskScore: 0.32,
    riskLevel: "low",
    rainfall7d: [2, 12, 25, 38, 32, 28, 30],
    waterLevel: 3.5,
    dangerMark: 6.0,
    coordinates: [[[84.6, 20.6], [85.3, 20.6], [85.3, 21.2], [84.6, 21.2], [84.6, 20.6]]],
  },
  {
    name: "Dhenkanal",
    population: 1192948,
    riskScore: 0.48,
    riskLevel: "medium",
    rainfall7d: [4, 16, 32, 50, 45, 38, 42],
    waterLevel: 4.5,
    dangerMark: 6.2,
    coordinates: [[[85.3, 20.5], [85.9, 20.5], [85.9, 21.0], [85.3, 21.0], [85.3, 20.5]]],
  },
  {
    name: "Nayagarh",
    population: 962789,
    riskScore: 0.42,
    riskLevel: "medium",
    rainfall7d: [3, 14, 30, 48, 42, 35, 38],
    waterLevel: 4.2,
    dangerMark: 6.0,
    coordinates: [[[84.8, 19.8], [85.5, 19.8], [85.5, 20.4], [84.8, 20.4], [84.8, 19.8]]],
  },
  {
    name: "Koraput",
    population: 1379647,
    riskScore: 0.22,
    riskLevel: "low",
    rainfall7d: [1, 6, 15, 22, 18, 15, 17],
    waterLevel: 2.2,
    dangerMark: 5.0,
    coordinates: [[[82.5, 18.5], [83.5, 18.5], [83.5, 19.3], [82.5, 19.3], [82.5, 18.5]]],
  },
  {
    name: "Kalahandi",
    population: 1576869,
    riskScore: 0.25,
    riskLevel: "low",
    rainfall7d: [2, 8, 18, 25, 22, 18, 20],
    waterLevel: 2.5,
    dangerMark: 5.5,
    coordinates: [[[82.8, 19.5], [83.8, 19.5], [83.8, 20.3], [82.8, 20.3], [82.8, 19.5]]],
  },
  {
    name: "Bolangir",
    population: 1648997,
    riskScore: 0.30,
    riskLevel: "low",
    rainfall7d: [2, 9, 20, 30, 26, 22, 25],
    waterLevel: 2.8,
    dangerMark: 5.5,
    coordinates: [[[82.8, 20.3], [83.6, 20.3], [83.6, 21.0], [82.8, 21.0], [82.8, 20.3]]],
  },
];

// ── River paths (polylines) ──────────────────────────────────────
export interface RiverPath {
  name: string;
  color: string;
  width: number;
  coordinates: [number, number][]; // [lng, lat]
}

export const ODISHA_RIVERS: RiverPath[] = [
  {
    name: "Mahanadi",
    color: "#38bdf8",
    width: 4,
    coordinates: [
      [83.87, 21.53], [84.15, 21.35], [84.45, 21.10], [84.75, 20.90],
      [85.10, 20.72], [85.40, 20.55], [85.70, 20.42], [85.90, 20.35],
      [86.10, 20.30], [86.35, 20.25], [86.55, 20.20], [86.75, 20.15],
    ],
  },
  {
    name: "Brahmani",
    color: "#60a5fa",
    width: 3,
    coordinates: [
      [84.80, 21.80], [85.05, 21.50], [85.30, 21.20], [85.55, 20.95],
      [85.80, 20.85], [86.10, 20.75], [86.40, 20.65], [86.70, 20.55],
      [86.85, 20.50],
    ],
  },
  {
    name: "Baitarani",
    color: "#818cf8",
    width: 3,
    coordinates: [
      [85.40, 21.50], [85.65, 21.30], [85.90, 21.10], [86.15, 20.95],
      [86.40, 20.85], [86.65, 20.78], [86.80, 20.72],
    ],
  },
  {
    name: "Subarnarekha",
    color: "#a78bfa",
    width: 2,
    coordinates: [
      [86.20, 22.10], [86.45, 21.85], [86.65, 21.65], [86.85, 21.50],
      [87.00, 21.40],
    ],
  },
  {
    name: "Rushikulya",
    color: "#67e8f9",
    width: 2,
    coordinates: [
      [84.20, 19.80], [84.45, 19.55], [84.70, 19.35], [84.90, 19.20],
    ],
  },
];

// ── Time simulation multipliers ──────────────────────────────────
// Each entry represents a flood expansion factor at T+Nh
export const TIME_MULTIPLIERS: Record<number, { riskMultiplier: number; label: string }> = {
  0: { riskMultiplier: 1.0, label: "Current State" },
  1: { riskMultiplier: 1.05, label: "T+1h — Rising" },
  2: { riskMultiplier: 1.12, label: "T+2h — Rising" },
  3: { riskMultiplier: 1.20, label: "T+3h — Moderate Rise" },
  4: { riskMultiplier: 1.30, label: "T+4h — Accelerating" },
  6: { riskMultiplier: 1.50, label: "T+6h — Elevated" },
  8: { riskMultiplier: 1.70, label: "T+8h — High" },
  12: { riskMultiplier: 2.0, label: "T+12h — Critical Rise" },
  18: { riskMultiplier: 2.4, label: "T+18h — Near Peak" },
  24: { riskMultiplier: 2.8, label: "T+24h — Peak Flood" },
};

export function getTimeMultiplier(hour: number): { riskMultiplier: number; label: string } {
  const keys = Object.keys(TIME_MULTIPLIERS).map(Number).sort((a, b) => a - b);
  for (let i = keys.length - 1; i >= 0; i--) {
    if (hour >= keys[i]) return TIME_MULTIPLIERS[keys[i]];
  }
  return TIME_MULTIPLIERS[0];
}

// ── Risk color mapping ───────────────────────────────────────────
export function riskToColor(score: number, alpha = 160): [number, number, number, number] {
  if (score >= 0.8) return [220, 38, 38, alpha];   // Red — critical
  if (score >= 0.6) return [249, 115, 22, alpha];   // Orange — high
  if (score >= 0.4) return [234, 179, 8, alpha];    // Yellow — medium
  return [34, 197, 94, alpha];                       // Green — low
}

export function riskToLabel(score: number): string {
  if (score >= 0.8) return "CRITICAL";
  if (score >= 0.6) return "HIGH";
  if (score >= 0.4) return "MEDIUM";
  return "LOW";
}

// ── Convert districts to GeoJSON FeatureCollection ───────────────
export function districtsToGeoJSON(districts: DistrictFeature[], timeHour = 0) {
  const multiplier = getTimeMultiplier(timeHour);
  return {
    type: "FeatureCollection" as const,
    features: districts.map((d) => {
      const adjustedRisk = Math.min(1.0, d.riskScore * multiplier.riskMultiplier);
      return {
        type: "Feature" as const,
        properties: {
          name: d.name,
          population: d.population,
          riskScore: adjustedRisk,
          riskLevel: adjustedRisk >= 0.8 ? "critical" : adjustedRisk >= 0.6 ? "high" : adjustedRisk >= 0.4 ? "medium" : "low",
          rainfall7d: d.rainfall7d,
          waterLevel: d.waterLevel,
          dangerMark: d.dangerMark,
        },
        geometry: {
          type: "Polygon" as const,
          coordinates: d.coordinates,
        },
      };
    }),
  };
}

export function riversToGeoJSON(rivers: RiverPath[]) {
  return {
    type: "FeatureCollection" as const,
    features: rivers.map((r) => ({
      type: "Feature" as const,
      properties: { name: r.name, color: r.color, width: r.width },
      geometry: {
        type: "LineString" as const,
        coordinates: r.coordinates,
      },
    })),
  };
}

// ── Active alerts ────────────────────────────────────────────────
export interface FloodAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  district: string;
  message: string;
  timestamp: string;
}

export function generateAlerts(districts: DistrictFeature[], timeHour: number): FloodAlert[] {
  const mult = getTimeMultiplier(timeHour);
  const alerts: FloodAlert[] = [];

  districts.forEach((d) => {
    const adjustedRisk = Math.min(1.0, d.riskScore * mult.riskMultiplier);
    if (adjustedRisk >= 0.85) {
      alerts.push({
        id: `alert-${d.name}-critical`,
        severity: "critical",
        district: d.name,
        message: `🚨 CRITICAL: Severe flooding expected in ${d.name}. Immediate evacuation advised.`,
        timestamp: new Date().toISOString(),
      });
    } else if (adjustedRisk >= 0.7) {
      alerts.push({
        id: `alert-${d.name}-warning`,
        severity: "warning",
        district: d.name,
        message: `⚠️ WARNING: High flood risk in ${d.name}. Prepare for potential evacuation.`,
        timestamp: new Date().toISOString(),
      });
    } else if (adjustedRisk >= 0.5) {
      alerts.push({
        id: `alert-${d.name}-info`,
        severity: "info",
        district: d.name,
        message: `ℹ️ ADVISORY: Moderate flood risk in ${d.name}. Monitor conditions closely.`,
        timestamp: new Date().toISOString(),
      });
    }
  });

  return alerts.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
}
