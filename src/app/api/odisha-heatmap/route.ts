import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

type HeatPoint = {
    lat: number;
    lng: number;
    weight: number;
    district?: string;
    riskScore?: number;
};

type ScenarioKey = "normal" | "rain" | "heavy_rain";

const SCENARIO_TO_FILE: Record<ScenarioKey, string> = {
    normal: "odisha_predictions_normal.csv",
    rain: "odisha_predictions_rain.csv",
    heavy_rain: "odisha_predictions_heavy_rain.csv",
};

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function safeNum(value: string | undefined): number | null {
    if (value == null) return null;
    const parsed = Number(String(value).trim());
    return Number.isFinite(parsed) ? parsed : null;
}

function splitCsvLine(line: string): string[] {
    const out: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (ch === "," && !inQuotes) {
            out.push(current);
            current = "";
            continue;
        }
        current += ch;
    }

    out.push(current);
    return out.map((cell) => cell.trim());
}

function parseHeatCsv(csvText: string): HeatPoint[] {
    const lines = csvText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length < 2) return [];

    const headers = splitCsvLine(lines[0]);
    const idx = (name: string) => headers.findIndex((header) => header.toLowerCase() === name.toLowerCase());

    const latIdx = idx("latitude");
    const lngIdx = idx("longitude");
    const districtIdx = idx("district");
    const predictedIdx = idx("predicted_flood_risk_score");
    const fallbackRiskIdx = idx("flood_risk_score");
    const waterBodiesIdx = idx("water_bodies_count");

    if (latIdx < 0 || lngIdx < 0) {
        return [];
    }

    const parsed: HeatPoint[] = [];
    for (const line of lines.slice(1)) {
        const cells = splitCsvLine(line);

        const lat = safeNum(cells[latIdx]);
        const lng = safeNum(cells[lngIdx]);
        if (lat == null || lng == null) continue;

        const predictedScore = predictedIdx >= 0 ? safeNum(cells[predictedIdx]) : null;
        const fallbackRisk = fallbackRiskIdx >= 0 ? safeNum(cells[fallbackRiskIdx]) : null;
        const riskScore = predictedScore ?? fallbackRisk;

        const waterBodiesCount = waterBodiesIdx >= 0 ? safeNum(cells[waterBodiesIdx]) : null;

        let weight = 0.4;
        if (riskScore != null) {
            weight = clamp(riskScore / 100, 0.1, 1);
        } else if (waterBodiesCount != null) {
            // Log scaled fallback when explicit risk score is absent.
            weight = clamp(Math.log10(Math.max(1, waterBodiesCount)) / 5, 0.1, 1);
        }

        parsed.push({
            lat,
            lng,
            weight,
            district: districtIdx >= 0 ? cells[districtIdx] : undefined,
            riskScore: riskScore ?? undefined,
        });
    }

    return parsed;
}

function toScenario(value: string | null): ScenarioKey {
    if (value === "rain" || value === "heavy_rain") return value;
    return "normal";
}

function summarizeFloodChance(points: HeatPoint[]) {
    const total = points.length || 1;
    const severe = points.filter((point) => (point.riskScore ?? point.weight * 100) >= 50).length;
    const high = points.filter((point) => {
        const score = point.riskScore ?? point.weight * 100;
        return score >= 42 && score < 50;
    }).length;
    const moderate = points.filter((point) => {
        const score = point.riskScore ?? point.weight * 100;
        return score >= 34 && score < 42;
    }).length;

    return {
        severePct: Math.round((severe / total) * 100),
        highPct: Math.round((high / total) * 100),
        moderatePct: Math.round((moderate / total) * 100),
    };
}

async function readScenarioPoints(scenario: ScenarioKey): Promise<HeatPoint[]> {
    const fileName = SCENARIO_TO_FILE[scenario];
    const csvPath = path.join(process.cwd(), "scripts", "ml", "data", fileName);
    const csvText = await fs.readFile(csvPath, "utf-8");
    return parseHeatCsv(csvText);
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scenario = toScenario(searchParams.get("scenario"));

        const points = await readScenarioPoints(scenario);

        const hotspots = [...points]
            .sort((a, b) => (b.riskScore ?? b.weight * 100) - (a.riskScore ?? a.weight * 100))
            .slice(0, 8)
            .map((point) => ({
                lat: point.lat,
                lng: point.lng,
                district: point.district,
                score: point.riskScore ?? Math.round(point.weight * 100),
            }));

        const [normalPoints, rainPoints, heavyRainPoints] = await Promise.all([
            readScenarioPoints("normal").catch(() => []),
            readScenarioPoints("rain").catch(() => []),
            readScenarioPoints("heavy_rain").catch(() => []),
        ]);

        const chanceByScenario = {
            normal: summarizeFloodChance(normalPoints),
            rain: summarizeFloodChance(rainPoints),
            heavy_rain: summarizeFloodChance(heavyRainPoints),
        };

        return NextResponse.json(
            {
                points,
                hotspots,
                scenario,
                chanceByScenario,
                source: `scripts/ml/data/${SCENARIO_TO_FILE[scenario]}`,
                generatedAt: new Date().toISOString(),
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("GET /api/odisha-heatmap failed", error);
        return NextResponse.json(
            {
                points: [],
                hotspots: [],
                scenario: "normal",
                chanceByScenario: {
                    normal: { severePct: 0, highPct: 0, moderatePct: 0 },
                    rain: { severePct: 0, highPct: 0, moderatePct: 0 },
                    heavy_rain: { severePct: 0, highPct: 0, moderatePct: 0 },
                },
                source: "unavailable",
                generatedAt: new Date().toISOString(),
                error: "Heatmap data not available. Generate and predict scenario datasets first.",
            },
            { status: 200 },
        );
    }
}
