import { NextRequest, NextResponse } from "next/server";
import { predictBiodiversityLoss } from "@/lib/prediction-model";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { severity, pollutionType, surfaceAreaKm2, durationDays } = body || {};

    if (typeof severity !== "number" || !pollutionType) {
      return NextResponse.json({ error: "Missing severity or pollutionType" }, { status: 400 });
    }

    const result = predictBiodiversityLoss({
      severity: Math.max(1, Math.min(5, severity)),
      pollutionType,
      surfaceAreaKm2: surfaceAreaKm2 ?? 2,
      durationDays: durationDays ?? 1,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("POST /api/predict failed", error);
    return NextResponse.json({ error: "Prediction failed" }, { status: 500 });
  }
}
