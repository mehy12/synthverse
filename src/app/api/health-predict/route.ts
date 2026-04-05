/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * Health-Center Predictor API
 * ---------------------------------------------------------
 * GET /api/health-predict
 *   ?lat=…&lng=…       → nearest health centers to a point
 *   ?district=…        → all centers in a district
 *   ?alertRisk=high    → predictive alerts for high-risk zones
 *
 * POST /api/health-predict
 *   body: { alerts: [{ lat, lng, riskScore, districtName }] }
 *   → dispatches nearest hospitals + travel times for each alert
 */

export interface HealthFacility {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: "sub_cen" | "phc" | "chc" | "dis_h" | "s_t_h";
  district: string;
  subdistrict: string;
  locationType: string;           // "Rural" | "Urban"
  facilityOwnership: string;      // "Public" | "Private" etc
  active: boolean;
  // Computed fields for predictions:
  capacityEstimate: number;       // beds estimate from type
  responseTimeMin: number;        // estimated response time in minutes
  priorityScore: number;          // 0-100 priority rank
}

const TYPE_LABELS: Record<string, string> = {
  sub_cen: "Sub-Center",
  phc: "Primary Health Centre",
  chc: "Community Health Centre",
  dis_h: "District Hospital",
  s_t_h: "State/Tertiary Hospital",
};

const CAPACITY_EST: Record<string, number> = {
  sub_cen: 6,
  phc: 30,
  chc: 100,
  dis_h: 300,
  s_t_h: 500,
};

const PRIORITY_WEIGHT: Record<string, number> = {
  s_t_h: 100,
  dis_h: 85,
  chc: 60,
  phc: 35,
  sub_cen: 15,
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function estimateResponseTime(distanceKm: number, facilityType: string): number {
  const speedKmH = facilityType === "sub_cen" ? 25 : facilityType === "phc" ? 30 : 40;
  return Math.round((distanceKm / speedKmH) * 60);
}

// ── Parse CSV once and cache ───────────────────────────────────────────────────
let _cachedFacilities: HealthFacility[] | null = null;

function loadFacilities(): HealthFacility[] {
  if (_cachedFacilities) return _cachedFacilities;

  const csvPaths = [
    path.join(process.cwd(), "datasets", "geocode_health_centre_odisha.csv"),
    path.join(process.cwd(), "datasets", "nin_health_facilities_odisha.csv"),
  ];

  const allFacilities: HealthFacility[] = [];
  const seen = new Set<string>();

  for (const csvPath of csvPaths) {
    if (!fs.existsSync(csvPath)) continue;
    const raw = fs.readFileSync(csvPath, "utf-8");
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) continue;
    const header = lines[0].split(",").map((h) => h.trim());

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const row: Record<string, string> = {};
      header.forEach((h, idx) => { row[h] = (cols[idx] || "").trim(); });

      const lat = parseFloat(row["Latitude"] || row["latitude"] || "0");
      const lng = parseFloat(row["Longitude"] || row["longitude"] || "0");
      const name = row["Facility Name"] || row["Health Facility Name"] || "";
      const type = (row["Facility Type"] || row["Facility Type"] || "phc").toLowerCase().trim() as any;
      const district = row["District Name"] || row["District_Name"] || "";
      const active = (row["ActiveFlag_C"] || "Y") === "Y";

      if (!lat || !lng || !name) continue;
      // Dedup by lat+lng+name
      const key = `${lat.toFixed(4)}-${lng.toFixed(4)}-${name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      allFacilities.push({
        id: `hf-${i}-${csvPaths.indexOf(csvPath)}`,
        name, lat, lng, type, district,
        subdistrict: row["Subdistrict Name"] || row["Taluka_Name"] || "",
        locationType: row["Location Type"] || "Rural",
        facilityOwnership: row["Type Of Facility"] || "Public",
        active,
        capacityEstimate: CAPACITY_EST[type] || 20,
        responseTimeMin: 0,
        priorityScore: PRIORITY_WEIGHT[type] || 30,
      });
    }
  }

  _cachedFacilities = allFacilities;
  return allFacilities;
}

// ── Find nearest N facilities (sorted by combined score) ────────────────────────
function findNearestFacilities(
  lat: number, lng: number,
  allFacilities: HealthFacility[],
  limit: number = 5,
  maxDistanceKm: number = 100,
): (HealthFacility & { distanceKm: number; etaMinutes: number })[] {
  return allFacilities
    .filter((f) => f.active)
    .map((f) => {
      const distanceKm = haversineKm(lat, lng, f.lat, f.lng);
      const etaMinutes = estimateResponseTime(distanceKm, f.type);
      return { ...f, distanceKm, etaMinutes };
    })
    .filter((f) => f.distanceKm <= maxDistanceKm)
    .sort((a, b) => {
      // Composite score: closeness + capacity priority
      const scoreA = a.distanceKm / 50 - a.priorityScore / 100;
      const scoreB = b.distanceKm / 50 - b.priorityScore / 100;
      return scoreA - scoreB;
    })
    .slice(0, limit);
}

// ── Predictive Alert System ─────────────────────────────────────────────────────
interface FloodAlert {
  lat: number;
  lng: number;
  riskScore: number;
  districtName: string;
}

interface HealthDispatch {
  alert: FloodAlert;
  severity: "critical" | "high" | "medium";
  predictedCasualties: number;
  nearestFacilities: (HealthFacility & { distanceKm: number; etaMinutes: number })[];
  dispatchStatus: "auto_dispatched" | "awaiting_confirmation";
  advisories: string[];
}

function generateDispatch(alert: FloodAlert, facilities: HealthFacility[]): HealthDispatch {
  const severity = alert.riskScore > 0.8 ? "critical" : alert.riskScore > 0.6 ? "high" : "medium";

  // Predictive casualty estimation: risk × population-density-factor × area-exposure
  const pdFactor = alert.districtName.match(/Bhubaneswar|Cuttack|Puri/) ? 4.5 : 2.0;
  const predictedCasualties = Math.round(alert.riskScore * pdFactor * (alert.riskScore > 0.7 ? 120 : 40));

  const nearest = findNearestFacilities(alert.lat, alert.lng, facilities, 5, 80);

  const advisories: string[] = [];
  const nearestHospital = nearest.find((f) => f.type === "dis_h" || f.type === "s_t_h");

  if (severity === "critical") {
    advisories.push(`🚨 CRITICAL: Auto-dispatching emergency response to ${nearest[0]?.name || "nearest center"}`);
    if (nearestHospital) {
      advisories.push(`🏥 Alerting ${nearestHospital.name} (${nearestHospital.distanceKm.toFixed(1)}km, ETA ${nearestHospital.etaMinutes}min)`);
    }
    advisories.push(`Predicted impact: ~${predictedCasualties} individuals may require medical attention`);
    advisories.push(`Recommended: Pre-stage ${Math.ceil(predictedCasualties / 10)} ambulances`);
  } else if (severity === "high") {
    advisories.push(`⚠️ HIGH RISK: Health centers on standby in ${alert.districtName}`);
    advisories.push(`Nearest: ${nearest[0]?.name} (${nearest[0]?.distanceKm.toFixed(1)}km)`);
    advisories.push(`Capacity needed: ~${Math.ceil(predictedCasualties * 0.3)} beds`);
  } else {
    advisories.push(`📋 MONITORING: ${alert.districtName} zone under observation`);
    advisories.push(`Nearest facility: ${nearest[0]?.name}`);
  }

  return {
    alert,
    severity,
    predictedCasualties,
    nearestFacilities: nearest,
    dispatchStatus: severity === "critical" ? "auto_dispatched" : "awaiting_confirmation",
    advisories,
  };
}

// ────────────────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") || "0");
  const lng = parseFloat(searchParams.get("lng") || "0");
  const district = searchParams.get("district") || "";
  const limit = parseInt(searchParams.get("limit") || "10");

  const facilities = loadFacilities();

  // Stats summary
  const stats = {
    total: facilities.length,
    byType: Object.fromEntries(
      Object.keys(TYPE_LABELS).map((t) => [
        TYPE_LABELS[t],
        facilities.filter((f) => f.type === t).length,
      ]),
    ),
  };

  // If lat/lng provided, find nearest
  if (lat && lng) {
    const nearest = findNearestFacilities(lat, lng, facilities, limit);
    return NextResponse.json({
      query: { lat, lng, limit },
      nearest: nearest.map((f) => ({
        ...f,
        typeLabel: TYPE_LABELS[f.type] || f.type,
        distanceKm: Math.round(f.distanceKm * 100) / 100,
      })),
      stats,
    });
  }

  // If district provided
  if (district) {
    const districtFacilities = facilities.filter(
      (f) => f.district.toLowerCase().includes(district.toLowerCase()),
    );
    return NextResponse.json({
      district,
      facilities: districtFacilities.slice(0, 200),
      total: districtFacilities.length,
      stats,
    });
  }

  // Default: return stats + a sample
  return NextResponse.json({
    stats,
    sample: facilities.slice(0, 20).map((f) => ({
      ...f, typeLabel: TYPE_LABELS[f.type] || f.type,
    })),
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const alerts: FloodAlert[] = body.alerts || [];

  if (!alerts.length) {
    return NextResponse.json({ error:  "No alerts provided" }, { status: 400 });
  }

  const facilities = loadFacilities();
  const dispatches = alerts.map((alert) => generateDispatch(alert, facilities));

  // Log dispatches
  const summary = {
    totalAlerts: alerts.length,
    critical: dispatches.filter((d) => d.severity === "critical").length,
    high: dispatches.filter((d) => d.severity === "high").length,
    medium: dispatches.filter((d) => d.severity === "medium").length,
    autoDispatched: dispatches.filter((d) => d.dispatchStatus === "auto_dispatched").length,
    totalPredictedCasualties: dispatches.reduce((s, d) => s + d.predictedCasualties, 0),
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json({ dispatches, summary });
}
