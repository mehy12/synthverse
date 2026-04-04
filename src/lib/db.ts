import { neon } from "@neondatabase/serverless";

if (!process.env.NEON_DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.warn("NEON_DATABASE_URL is not set. Report APIs will be disabled.");
}

const sql = process.env.NEON_DATABASE_URL ? neon(process.env.NEON_DATABASE_URL) : null;

let tableReady = false;

async function ensureTable() {
  if (tableReady || !sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      reporter_key TEXT,
      type TEXT NOT NULL,
      severity INTEGER,
      title TEXT,
      description TEXT,
      image_base64 TEXT,
      capture_method TEXT,
      captured_at TIMESTAMPTZ,
      location_accuracy_meters DOUBLE PRECISION,
      verification_score INTEGER,
      verification_status TEXT,
      verification_notes TEXT,
      ai_disaster_detected BOOLEAN,
      ai_disaster_type TEXT,
      ai_confidence INTEGER,
      ai_summary TEXT,
      nearby_report_count INTEGER,
      cluster_severity INTEGER,
      coordinate_flagged BOOLEAN,
      flag_reason TEXT,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
      is_user_report BOOLEAN NOT NULL DEFAULT true
    );
  `;
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS reporter_key TEXT;`;
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS capture_method TEXT;`;
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;`;
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS location_accuracy_meters DOUBLE PRECISION;`;
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS verification_score INTEGER;`;
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS verification_status TEXT;`;
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS verification_notes TEXT;`;
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS ai_disaster_detected BOOLEAN;`;
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS ai_disaster_type TEXT;`;
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS ai_confidence INTEGER;`;
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS ai_summary TEXT;`;
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS nearby_report_count INTEGER;`;
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS cluster_severity INTEGER;`;
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS coordinate_flagged BOOLEAN;`;
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS flag_reason TEXT;`;
  tableReady = true;
}

export type ReportRecord = {
  id: string;
  latitude: number;
  longitude: number;
  reporterKey: string | null;
  type: string;
  severity: number | null;
  title: string | null;
  description: string | null;
  imageBase64: string | null;
  captureMethod: string | null;
  capturedAt: string | null;
  locationAccuracyMeters: number | null;
  verificationScore: number | null;
  verificationStatus: string | null;
  verificationNotes: string | null;
  aiDisasterDetected: boolean | null;
  aiDisasterType: string | null;
  aiConfidence: number | null;
  aiSummary: string | null;
  nearbyReportCount: number | null;
  clusterSeverity: number | null;
  coordinateFlagged: boolean | null;
  flagReason: string | null;
  timestamp: string;
  isUserReport: boolean;
};

export async function createReport(input: {
  latitude: number;
  longitude: number;
  reporterKey?: string;
  type: string;
  severity?: number;
  title?: string;
  description?: string;
  imageBase64?: string;
  captureMethod?: string;
  capturedAt?: string;
  locationAccuracyMeters?: number;
  verificationScore?: number;
  verificationStatus?: string;
  verificationNotes?: string;
  aiDisasterDetected?: boolean;
  aiDisasterType?: string;
  aiConfidence?: number;
  aiSummary?: string;
  nearbyReportCount?: number;
  clusterSeverity?: number;
  coordinateFlagged?: boolean;
  flagReason?: string;
  timestamp?: string;
  isUserReport?: boolean;
}): Promise<ReportRecord> {
  if (!sql) {
    throw new Error("Neon database is not configured");
  }
  await ensureTable();

  const id = crypto.randomUUID();
  const timestamp = input.timestamp ?? new Date().toISOString();
  const isUserReport = input.isUserReport ?? true;

  const rows = await sql`
    INSERT INTO reports (
      id,
      latitude,
      longitude,
      reporter_key,
      type,
      severity,
      title,
      description,
      image_base64,
      capture_method,
      captured_at,
      location_accuracy_meters,
      verification_score,
      verification_status,
      verification_notes,
      ai_disaster_detected,
      ai_disaster_type,
      ai_confidence,
      ai_summary,
      nearby_report_count,
      cluster_severity,
      coordinate_flagged,
      flag_reason,
      timestamp,
      is_user_report
    )
    VALUES (
      ${id},
      ${input.latitude},
      ${input.longitude},
      ${input.reporterKey ?? null},
      ${input.type},
      ${input.severity ?? null},
      ${input.title ?? null},
      ${input.description ?? null},
      ${input.imageBase64 ?? null},
      ${input.captureMethod ?? null},
      ${input.capturedAt ?? null},
      ${input.locationAccuracyMeters ?? null},
      ${input.verificationScore ?? null},
      ${input.verificationStatus ?? null},
      ${input.verificationNotes ?? null},
      ${input.aiDisasterDetected ?? null},
      ${input.aiDisasterType ?? null},
      ${input.aiConfidence ?? null},
      ${input.aiSummary ?? null},
      ${input.nearbyReportCount ?? null},
      ${input.clusterSeverity ?? null},
      ${input.coordinateFlagged ?? null},
      ${input.flagReason ?? null},
      ${timestamp},
      ${isUserReport}
    )
    RETURNING
      id,
      latitude,
      longitude,
      reporter_key as "reporterKey",
      type,
      severity,
      title,
      description,
        image_base64 as "imageBase64",
        capture_method as "captureMethod",
        captured_at as "capturedAt",
        location_accuracy_meters as "locationAccuracyMeters",
        verification_score as "verificationScore",
        verification_status as "verificationStatus",
        verification_notes as "verificationNotes",
        ai_disaster_detected as "aiDisasterDetected",
        ai_disaster_type as "aiDisasterType",
        ai_confidence as "aiConfidence",
        ai_summary as "aiSummary",
        nearby_report_count as "nearbyReportCount",
        cluster_severity as "clusterSeverity",
        coordinate_flagged as "coordinateFlagged",
        flag_reason as "flagReason",
        timestamp,
        is_user_report as "isUserReport";
      ` as unknown as ReportRecord[];

  return rows[0];
}

export async function listReports(limit = 100): Promise<ReportRecord[]> {
  if (!sql) return [];
  await ensureTable();

  const rows = await sql`
    SELECT
      id,
      latitude,
      longitude,
      reporter_key as "reporterKey",
      type,
      severity,
      title,
      description,
      image_base64 as "imageBase64",
      capture_method as "captureMethod",
      captured_at as "capturedAt",
      location_accuracy_meters as "locationAccuracyMeters",
      verification_score as "verificationScore",
      verification_status as "verificationStatus",
      verification_notes as "verificationNotes",
      ai_disaster_detected as "aiDisasterDetected",
      ai_disaster_type as "aiDisasterType",
      ai_confidence as "aiConfidence",
      ai_summary as "aiSummary",
      nearby_report_count as "nearbyReportCount",
      cluster_severity as "clusterSeverity",
      coordinate_flagged as "coordinateFlagged",
      flag_reason as "flagReason",
      timestamp,
      is_user_report as "isUserReport"
    FROM reports
    ORDER BY timestamp DESC
    LIMIT ${limit};
  ` as unknown as ReportRecord[];

  return rows;
}

export async function deleteReport(id: string): Promise<void> {
  if (!sql) return;
  await ensureTable();
  await sql`DELETE FROM reports WHERE id = ${id};`;
}

/**
 * Check for existing reports within radiusMeters of (lat, lng) filed in the last 24 hours.
 * Uses the Haversine formula in SQL for distance calculation.
 * Returns the first matching report if one exists, null otherwise.
 */
export async function findNearbyReport(
  lat: number,
  lng: number,
  radiusMeters: number = 500
): Promise<ReportRecord | null> {
  if (!sql) return null;
  await ensureTable();

  const rows = await sql`
    SELECT * FROM (
      SELECT
        id, latitude, longitude, reporter_key as "reporterKey", type, severity, title, description,
        image_base64 as "imageBase64", capture_method as "captureMethod",
        captured_at as "capturedAt",
        location_accuracy_meters as "locationAccuracyMeters",
        verification_score as "verificationScore",
        verification_status as "verificationStatus",
        verification_notes as "verificationNotes",
        ai_disaster_detected as "aiDisasterDetected",
        ai_disaster_type as "aiDisasterType",
        ai_confidence as "aiConfidence",
        ai_summary as "aiSummary",
        nearby_report_count as "nearbyReportCount",
        cluster_severity as "clusterSeverity",
        coordinate_flagged as "coordinateFlagged",
        flag_reason as "flagReason",
        timestamp, is_user_report as "isUserReport",
        (
          6371000 * acos(
            least(1.0, greatest(-1.0, 
              cos(radians(${lat})) * cos(radians(latitude)) *
              cos(radians(longitude) - radians(${lng})) +
              sin(radians(${lat})) * sin(radians(latitude))
            ))
          )
        ) AS distance_m
      FROM reports
      WHERE timestamp > now() - interval '24 hours'
    ) AS sub
    WHERE distance_m < ${radiusMeters}
    ORDER BY distance_m ASC
    LIMIT 1;
  ` as unknown as (ReportRecord & { distance_m: number })[];

  return rows.length > 0 ? rows[0] : null;
}

export async function countReportsByReporterInLast24Hours(reporterKey: string): Promise<number> {
  if (!sql || !reporterKey.trim()) return 0;
  await ensureTable();

  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM reports
    WHERE reporter_key = ${reporterKey}
      AND timestamp > now() - interval '24 hours';
  ` as unknown as Array<{ count: number }>;

  return rows[0]?.count ?? 0;
}

export async function countNearbyReports(
  lat: number,
  lng: number,
  radiusMeters: number = 500,
  sinceHours: number = 24
): Promise<number> {
  if (!sql) return 0;
  await ensureTable();

  const hours = Math.max(1, Math.min(168, Math.floor(sinceHours)));
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT
        (
          6371000 * acos(
            least(1.0, greatest(-1.0,
              cos(radians(${lat})) * cos(radians(latitude)) *
              cos(radians(longitude) - radians(${lng})) +
              sin(radians(${lat})) * sin(radians(latitude))
            ))
          )
        ) AS distance_m,
        timestamp
      FROM reports
      WHERE timestamp > now() - (${hours}::text || ' hours')::interval
    ) AS nearby
    WHERE distance_m <= ${radiusMeters};
  ` as unknown as Array<{ count: number }>;

  return rows[0]?.count ?? 0;
}
