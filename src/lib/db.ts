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
      type TEXT NOT NULL,
      severity INTEGER,
      title TEXT,
      description TEXT,
      image_base64 TEXT,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
      is_user_report BOOLEAN NOT NULL DEFAULT true
    );
  `;
  tableReady = true;
}

export type ReportRecord = {
  id: string;
  latitude: number;
  longitude: number;
  type: string;
  severity: number | null;
  title: string | null;
  description: string | null;
  imageBase64: string | null;
  timestamp: string;
  isUserReport: boolean;
};

export async function createReport(input: {
  latitude: number;
  longitude: number;
  type: string;
  severity?: number;
  title?: string;
  description?: string;
  imageBase64?: string;
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
      type,
      severity,
      title,
      description,
      image_base64,
      timestamp,
      is_user_report
    )
    VALUES (
      ${id},
      ${input.latitude},
      ${input.longitude},
      ${input.type},
      ${input.severity ?? null},
      ${input.title ?? null},
      ${input.description ?? null},
      ${input.imageBase64 ?? null},
      ${timestamp},
      ${isUserReport}
    )
    RETURNING
      id,
      latitude,
      longitude,
      type,
      severity,
      title,
      description,
        image_base64 as "imageBase64",
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
      type,
      severity,
      title,
      description,
      image_base64 as "imageBase64",
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
    SELECT
      id, latitude, longitude, type, severity, title, description,
      image_base64 as "imageBase64", timestamp, is_user_report as "isUserReport",
      (
        6371000 * acos(
          cos(radians(${lat})) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(latitude))
        )
      ) AS distance_m
    FROM reports
    WHERE timestamp > now() - interval '24 hours'
    HAVING distance_m < ${radiusMeters}
    ORDER BY distance_m ASC
    LIMIT 1;
  ` as unknown as (ReportRecord & { distance_m: number })[];

  return rows.length > 0 ? rows[0] : null;
}
