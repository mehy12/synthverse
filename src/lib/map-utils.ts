"use client";

import cachedCurrentVectors from "@/data/current-vectors.json";
import waterData from "@/data/water-infrastructure.json";

const LIVE_CURRENT_DATA = cachedCurrentVectors as {
  metadata: { source: string; region: string; date: string };
  vectors: Array<{ lat: number; lon: number; speed: number; dir: number }>;
};

export function haversineKm(
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

export function formatRelativeTime(timestamp: string): string {
  if (!timestamp) return "unknown";
  const diffMinutes = Math.max(
    0,
    Math.round((Date.now() - new Date(timestamp).getTime()) / 60000),
  );
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.round(diffMinutes / 60);
  return `${hours}h ago`;
}

export function nearestCityLabel(
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

export function evaluateWaterHealth(lat: number, lng: number) {
  const coastLng = 85.82;
  const coastalDistanceKm = haversineKm(lat, lng, lat, coastLng);
  const coastalBand = Math.exp(-coastalDistanceKm / 10);

  let nearestRiver: any;
  let riverPressure = 0;
  for (const river of waterData.flood_channels) {
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

  let nearestZone: any;
  let zoneQualityBoost = 0;
  for (const zone of waterData.evacuation_zones) {
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
  const currentPenalty = current ? Math.max(0, Math.min(25, current.speed * 12)) : 8;

  const coastalPressure = coastalBand * 70;
  const riverPenalty = riverPressure * 35;
  const baseScore = Math.max(
    10,
    Math.min(
      95,
      75 - coastalPressure - riverPenalty + zoneQualityBoost * 20 - currentPenalty,
    ),
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
