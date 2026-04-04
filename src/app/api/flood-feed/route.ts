import currentVectors from "@/data/current-vectors.json";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EVACUATION_ZONES = [
  { name: "Chellanam Coast", lat: 9.81, lng: 76.27, floodReadiness: 45 },
  { name: "Fort Kochi", lat: 9.965, lng: 76.2415, floodReadiness: 72 },
  { name: "Munambam", lat: 10.16, lng: 76.18, floodReadiness: 58 },
  { name: "Vypeen Island", lat: 10.03, lng: 76.23, floodReadiness: 68 },
  { name: "Puthuvype", lat: 10.01, lng: 76.22, floodReadiness: 52 },
];

function scoreFromWaterFlow(baseReadiness: number, flowVelocity: number): number {
  const penalty = Math.round(flowVelocity * 18);
  return Math.max(20, Math.min(100, baseReadiness + 10 - penalty));
}

function labelFromScore(score: number): string {
  if (score >= 70) return "Safe";
  if (score >= 50) return "Warning";
  return "Critical";
}

function fallbackZones() {
  return EVACUATION_ZONES.map((zone) => ({
    ...zone,
    currentVelocity: 0,
    currentDirection: 0,
    liveUpdatedAt: currentVectors.metadata.date,
    qualityScore: zone.floodReadiness,
    qualityLabel: labelFromScore(zone.floodReadiness),
    source: "Cached baseline",
  }));
}

export async function GET() {
  try {
    const zones = await Promise.all(
      EVACUATION_ZONES.map(async (zone) => {
        const url = new URL("https://marine-api.open-meteo.com/v1/marine");
        url.searchParams.set("latitude", String(zone.lat));
        url.searchParams.set("longitude", String(zone.lng));
        url.searchParams.set("current", "ocean_current_velocity,ocean_current_direction");
        url.searchParams.set("timezone", "auto");
        url.searchParams.set("cell_selection", "sea");

        const response = await fetch(url.toString(), { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`Open-Meteo returned ${response.status} for ${zone.name}`);
        }

        const payload = await response.json();
        const current = payload.current ?? {};
        const currentVelocity = Number(current.ocean_current_velocity ?? 0);
        const currentDirection = Number(current.ocean_current_direction ?? 0);
        const qualityScore = scoreFromWaterFlow(zone.floodReadiness, currentVelocity);

        return {
          ...zone,
          currentVelocity,
          currentDirection,
          liveUpdatedAt: current.time ?? new Date().toISOString(),
          qualityScore,
          qualityLabel: labelFromScore(qualityScore),
          source: "Open-Meteo Marine API",
        };
      })
    );

    return Response.json(
      {
        generatedAt: new Date().toISOString(),
        source: "Open-Meteo Marine API",
        zones,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    return Response.json(
      {
        generatedAt: new Date().toISOString(),
        source: "Cached baseline",
        zones: fallbackZones(),
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}