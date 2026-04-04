import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  countNearbyReports,
  countReportsByReporterInLast24Hours,
  createReport,
  deleteReport,
  listReports,
} from "@/lib/db";

type DisasterScanResult = {
  disasterDetected: boolean;
  disasterType: string;
  confidence: number;
  severityHint: number;
  summary: string;
};

const MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash-8b",
];
const DAILY_REPORT_LIMIT = 2;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeReporterKey(input: unknown, request: NextRequest): string {
  if (typeof input === "string" && input.trim()) {
    return input.trim().slice(0, 128);
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) return `ip:${forwardedFor}`;

  return "anonymous";
}

function parseImageDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    throw new Error("Invalid image format. Send a base64 data URL from live capture.");
  }

  return { mimeType: match[1], data: match[2].replace(/\s/g, "") };
}

function parseJsonResult(text: string): DisasterScanResult {
  const fencedMatch = text.match(/\{[\s\S]*\}/);
  const jsonText = fencedMatch ? fencedMatch[0] : text;
  const parsed = JSON.parse(jsonText) as Partial<DisasterScanResult>;

  return {
    disasterDetected: Boolean(parsed.disasterDetected),
    disasterType: String(parsed.disasterType || "unknown").slice(0, 80),
    confidence: clamp(Number(parsed.confidence) || 0, 0, 100),
    severityHint: clamp(Number(parsed.severityHint) || 1, 1, 5),
    summary: String(parsed.summary || "").slice(0, 500),
  };
}

function isModelNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("404") ||
    message.includes("not found") ||
    message.includes("is not supported for generateContent")
  );
}

async function scanDisasterImage(
  imageBase64: string,
  metadata: { type?: string; description?: string; title?: string }
): Promise<DisasterScanResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. AI disaster scanning is unavailable.");
  }

  const { mimeType, data } = parseImageDataUrl(imageBase64);
  const genAI = new GoogleGenerativeAI(apiKey);

  const prompt = `You are a disaster-image verifier for civic flood reporting.
Analyze this image and decide whether it actually contains a real disaster scene.

Return ONLY valid JSON with these exact keys:
{
  "disasterDetected": boolean,
  "disasterType": string,
  "confidence": number,
  "severityHint": number,
  "summary": string
}

Rules:
- disasterDetected should be true only if the image likely shows flood or another real disaster condition.
- If uncertain, set disasterDetected false and confidence below 60.
- severityHint must be an integer from 1 to 5.
- Keep summary under 40 words.

Context from reporter:
- type: ${metadata.type ?? "unknown"}
- title: ${metadata.title ?? "none"}
- description: ${metadata.description ?? "none"}`;

  let lastError: unknown;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        {
          inlineData: {
            data,
            mimeType,
          },
        },
        prompt,
      ]);

      const text = result.response.text();
      return parseJsonResult(text);
    } catch (error) {
      lastError = error;
      if (!isModelNotFoundError(error)) {
        throw error;
      }
    }
  }

  throw new Error(
    `No supported Gemini model found for generateContent. Tried: ${MODEL_CANDIDATES.join(", ")}. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

export async function GET() {
  try {
    const reports = await listReports(150);
    return NextResponse.json(reports, { status: 200 });
  } catch (error) {
    console.error("GET /api/reports failed", error);
    return NextResponse.json({ error: "Failed to load reports" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      latitude,
      longitude,
      reporterKey,
      type,
      severity,
      title,
      description,
      imageBase64,
      captureMethod,
      capturedAt,
      locationAccuracyMeters,
      verificationScore,
      verificationStatus,
      verificationNotes,
      timestamp,
      isUserReport,
    } = body || {};

    if (typeof latitude !== "number" || typeof longitude !== "number" || !type || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const normalizedReporterKey = normalizeReporterKey(reporterKey, request);
    const reportsInLast24Hours = await countReportsByReporterInLast24Hours(normalizedReporterKey);
    if (reportsInLast24Hours >= DAILY_REPORT_LIMIT) {
      return NextResponse.json(
        {
          error: "DAILY_LIMIT_REACHED",
          message: `You can submit at most ${DAILY_REPORT_LIMIT} reports in 24 hours.`,
          limit: DAILY_REPORT_LIMIT,
          used: reportsInLast24Hours,
        },
        { status: 429 }
      );
    }

    const scan = await scanDisasterImage(imageBase64, { type, description, title });
    if (!scan.disasterDetected || scan.confidence < 55) {
      return NextResponse.json(
        {
          error: "NOT_A_DISASTER",
          message: "AI scan did not detect a clear flood/disaster in this image. Report was not stored.",
          ai: scan,
        },
        { status: 422 }
      );
    }

    const nearbyReports = await countNearbyReports(latitude, longitude, 500, 24);
    const nearbyIncludingThisReport = nearbyReports + 1;
    const severityFromCluster = clamp(Math.ceil(nearbyIncludingThisReport / 2), 1, 5);
    const finalSeverity = clamp(Math.max(Number(severity) || 1, scan.severityHint, severityFromCluster), 1, 5);
    const coordinateFlagged = nearbyIncludingThisReport >= 2;
    const flagReason = coordinateFlagged
      ? `${nearbyIncludingThisReport} reports within 500m in 24h`
      : undefined;

    const record = await createReport({
      latitude,
      longitude,
      reporterKey: normalizedReporterKey,
      type,
      severity: finalSeverity,
      title,
      description,
      imageBase64,
      captureMethod,
      capturedAt,
      locationAccuracyMeters,
      verificationScore,
      verificationStatus,
      verificationNotes,
      aiDisasterDetected: true,
      aiDisasterType: scan.disasterType,
      aiConfidence: scan.confidence,
      aiSummary: scan.summary,
      nearbyReportCount: nearbyIncludingThisReport,
      clusterSeverity: severityFromCluster,
      coordinateFlagged,
      flagReason,
      timestamp,
      isUserReport,
    });

    return NextResponse.json(
      {
        ...record,
        aiScan: scan,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("POST /api/reports failed:", error);
    // Return the actual error message in development for easier debugging
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      {
        error: "Failed to create report",
        message: errorMessage
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await deleteReport(id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/reports failed", error);
    return NextResponse.json({ error: "Failed to delete report" }, { status: 500 });
  }
}
