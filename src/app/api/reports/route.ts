import { NextRequest, NextResponse } from "next/server";
import { createReport, deleteReport, listReports, findNearbyReport } from "@/lib/db";

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
      type,
      severity,
      title,
      description,
      imageBase64,
      timestamp,
      isUserReport,
    } = body || {};

    if (typeof latitude !== "number" || typeof longitude !== "number" || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ── Duplicate detection ─────────────────────────────────
    // Reject reports within 500m of an existing report filed in the last 24h.
    // This prevents spam while still allowing follow-up reports at the same
    // location after the cooldown window expires.
    const duplicate = await findNearbyReport(latitude, longitude, 500);
    if (duplicate) {
      return NextResponse.json(
        {
          error: "DUPLICATE_LOCATION",
          message: `A report already exists within 500m of this location (filed ${new Date(
            duplicate.timestamp
          ).toLocaleString()}). Wait 24 hours or choose a different location.`,
          existingReportId: duplicate.id,
        },
        { status: 409 }
      );
    }

    const record = await createReport({
      latitude,
      longitude,
      type,
      severity,
      title,
      description,
      imageBase64,
      timestamp,
      isUserReport,
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("POST /api/reports failed", error);
    return NextResponse.json({ error: "Failed to create report" }, { status: 500 });
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
