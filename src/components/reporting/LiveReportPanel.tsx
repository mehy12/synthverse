"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGeolocated } from "react-geolocated";
import {
  Camera,
  Crosshair,
  MapPin,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type ReportStatus =
  | "VERIFIED_LIVE_CAPTURE"
  | "LIKELY_LIVE_CAPTURE"
  | "NEEDS_REVIEW";

type VerificationSummary = {
  score: number;
  status: ReportStatus;
  notes: string;
};

interface LiveReportPanelProps {
  onSubmitted?: () => void;
}

const REPORT_TYPES = [
  "Flooding",
  "Blocked Drain",
  "Standing Water",
  "River Surge",
  "Road Washout",
  "Silt Build-up",
];

const SEVERITIES = [1, 2, 3, 4, 5];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatCoord(value: number) {
  return value.toFixed(5);
}

function buildVerificationSummary(params: {
  capturedImage: string | null;
  coords?: GeolocationCoordinates;
  geoTimestamp?: number;
  positionError?: GeolocationPositionError;
  captureTimestamp?: string | null;
}): VerificationSummary {
  const notes: string[] = [];
  let score = 0;

  if (params.capturedImage) {
    score += 40;
    notes.push("photo captured from the live camera stream");
  } else {
    notes.push("no camera capture yet");
  }

  if (params.coords) {
    score += 30;
    notes.push(
      `live geolocation fixed at ${formatCoord(params.coords.latitude)}, ${formatCoord(params.coords.longitude)}`,
    );

    const accuracy = params.coords.accuracy ?? Number.POSITIVE_INFINITY;
    if (accuracy <= 25) {
      score += 20;
    } else if (accuracy <= 50) {
      score += 15;
    } else if (accuracy <= 100) {
      score += 8;
    }
    if (Number.isFinite(accuracy)) {
      notes.push(`location accuracy about ${Math.round(accuracy)}m`);
    }
  } else {
    notes.push("geolocation pending");
  }

  if (typeof params.geoTimestamp === "number") {
    const geoAgeMinutes = (Date.now() - params.geoTimestamp) / 60000;
    if (geoAgeMinutes <= 5) score += 5;
  }

  if (params.captureTimestamp) {
    const captureAgeMinutes =
      (Date.now() - new Date(params.captureTimestamp).getTime()) / 60000;
    if (captureAgeMinutes <= 5) score += 5;
    notes.push(
      `photo captured ${Math.max(0, Math.round(captureAgeMinutes))}m ago`,
    );
  }

  if (params.positionError) {
    score -= 15;
    notes.push("location permission or lookup error detected");
  }

  score = clamp(score, 0, 100);

  const status: ReportStatus =
    score >= 80
      ? "VERIFIED_LIVE_CAPTURE"
      : score >= 60
        ? "LIKELY_LIVE_CAPTURE"
        : "NEEDS_REVIEW";

  return { score, status, notes: notes.join(" • ") };
}

export default function LiveReportPanel({ onSubmitted }: LiveReportPanelProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [captureTimestamp, setCaptureTimestamp] = useState<string | null>(null);
  const [reportType, setReportType] = useState(REPORT_TYPES[0]);
  const [severity, setSeverity] = useState(3);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const {
    coords,
    timestamp,
    isGeolocationAvailable,
    isGeolocationEnabled,
    positionError,
    getPosition,
  } = useGeolocated({
    positionOptions: {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    },
    watchPosition: true,
    userDecisionTimeout: 10000,
    suppressLocationOnMount: false,
    isOptimisticGeolocationEnabled: false,
  });

  useEffect(() => {
    let isMounted = true;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera access is not supported in this browser.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to open camera.";
        setCameraError(message);
      }
    }

    void startCamera();

    return () => {
      isMounted = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const verification = useMemo(
    () =>
      buildVerificationSummary({
        capturedImage,
        coords: coords ?? undefined,
        geoTimestamp: typeof timestamp === "number" ? timestamp : undefined,
        positionError: positionError ?? undefined,
        captureTimestamp,
      }),
    [capturedImage, coords, timestamp, positionError, captureTimestamp],
  );

  const reporterKey = useMemo(() => {
    if (typeof window === "undefined") {
      return user ? `${user.role}:${user.name}` : "anonymous";
    }

    const existing = localStorage.getItem("floodmind_reporter_key");
    if (existing) return existing;

    const generated = user
      ? `${user.role}:${user.name}`
      : `device:${crypto.randomUUID().slice(0, 12)}`;
    localStorage.setItem("floodmind_reporter_key", generated);
    return generated;
  }, [user]);

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !cameraReady) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Unable to render camera frame.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedImage(canvas.toDataURL("image/jpeg", 0.92));
    setCaptureTimestamp(new Date().toISOString());
    setSubmitMessage("Live camera frame captured.");
  };

  const resetCapture = (notice?: string) => {
    setCapturedImage(null);
    setCaptureTimestamp(null);
    if (notice) {
      setSubmitMessage(notice);
    }
  };

  const submitReport = async () => {
    if (!coords || !capturedImage) {
      setSubmitMessage(
        "Capture a live camera image and allow location access before submitting.",
      );
      return;
    }

    setSubmitting(true);
    setSubmitMessage(null);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
          reporterKey,
          type: reportType,
          severity,
          title: title.trim() || `${reportType} report`,
          description:
            description.trim() ||
            `Live report submitted from ${reportType.toLowerCase()}.`,
          imageBase64: capturedImage,
          captureMethod: "camera-live-geolocated",
          capturedAt: captureTimestamp ?? new Date().toISOString(),
          locationAccuracyMeters: coords.accuracy ?? null,
          verificationScore: verification.score,
          verificationStatus: verification.status,
          verificationNotes: verification.notes,
          timestamp: captureTimestamp ?? new Date().toISOString(),
          isUserReport: true,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
          error?: string;
        } | null;
        throw new Error(
          payload?.message || payload?.error || "Failed to submit report.",
        );
      }

      setTitle("");
      setDescription("");
      setReportType(REPORT_TYPES[0]);
      setSeverity(3);
      resetCapture(
        "Report submitted. The map will refresh with the new live marker.",
      );
      onSubmitted?.();
    } catch (error) {
      setSubmitMessage(
        error instanceof Error ? error.message : "Failed to submit report.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const locationLabel = coords
    ? `${formatCoord(coords.latitude)}, ${formatCoord(coords.longitude)}`
    : "Waiting for live GPS fix";

  return (
    <section
      style={{
        margin: "16px 20px",
        padding: 16,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl)",
        background:
          "linear-gradient(180deg, rgba(14, 165, 233, 0.08) 0%, rgba(255, 255, 255, 1) 45%)",
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--text-muted)",
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Live Reporting
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: "0.98rem",
              color: "var(--text-heading)",
            }}
          >
            Camera-first flood report
          </h3>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 999,
            background:
              verification.status === "VERIFIED_LIVE_CAPTURE"
                ? "rgba(16, 185, 129, 0.12)"
                : "rgba(245, 158, 11, 0.12)",
            color:
              verification.status === "VERIFIED_LIVE_CAPTURE"
                ? "#047857"
                : "#B45309",
            fontSize: "0.72rem",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          <ShieldCheck size={14} />
          {verification.status.replace(/_/g, " ")}
        </span>
      </div>

      <p
        style={{
          margin: "8px 0 0",
          fontSize: "0.82rem",
          color: "var(--text-secondary)",
          lineHeight: 1.5,
        }}
      >
        This panel only captures from the live camera stream and pairs the image
        with a fresh GPS fix. It is a strong authenticity check, not a forensic
        guarantee.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.15fr 0.85fr",
          gap: 14,
          marginTop: 14,
        }}
      >
        <div
          style={{
            position: "relative",
            borderRadius: 18,
            overflow: "hidden",
            minHeight: 260,
            background: "#0f172a",
            border: "1px solid rgba(148, 163, 184, 0.28)",
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            onLoadedMetadata={() => setCameraReady(true)}
            style={{
              width: "100%",
              height: 260,
              objectFit: "cover",
              display: "block",
            }}
          />
          {!cameraReady && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                background:
                  "linear-gradient(180deg, rgba(15, 23, 42, 0.72), rgba(15, 23, 42, 0.45))",
                textAlign: "center",
                padding: 20,
              }}
            >
              <div>
                <Camera size={24} style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  Opening live camera
                </div>
                <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>
                  Allow camera access to capture a fresh image.
                </div>
              </div>
            </div>
          )}
          {cameraError && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                background: "rgba(127, 29, 29, 0.84)",
                textAlign: "center",
                padding: 20,
              }}
            >
              <div>
                <TriangleAlert size={24} style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  Camera unavailable
                </div>
                <div style={{ fontSize: "0.8rem", opacity: 0.9 }}>
                  {cameraError}
                </div>
              </div>
            </div>
          )}

          {capturedImage && (
            <img
              src={capturedImage}
              alt="Captured live report"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 12,
              background: "var(--white)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <MapPin size={16} color="var(--teal)" />
              <strong
                style={{ fontSize: "0.82rem", color: "var(--text-heading)" }}
              >
                Live location
              </strong>
            </div>
            <div
              style={{
                fontSize: "0.82rem",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}
            >
              <div>{locationLabel}</div>
              <div>
                Accuracy:{" "}
                {coords?.accuracy != null
                  ? `${Math.round(coords.accuracy)}m`
                  : "waiting"}
              </div>
              <div>
                Status:{" "}
                {isGeolocationAvailable
                  ? isGeolocationEnabled
                    ? "enabled"
                    : "permission needed"
                  : "unsupported"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => getPosition()}
                className="btn btn-teal btn-sm"
                style={{ flex: 1, justifyContent: "center" }}
              >
                <Crosshair size={14} /> Refresh GPS
              </button>
            </div>
          </div>

          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 12,
              background: "var(--white)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <ShieldCheck size={16} color="var(--teal)" />
              <strong
                style={{ fontSize: "0.82rem", color: "var(--text-heading)" }}
              >
                Authenticity score
              </strong>
            </div>
            <div
              style={{
                fontSize: "1.8rem",
                fontWeight: 800,
                color: "var(--teal)",
                lineHeight: 1,
              }}
            >
              {verification.score}/100
            </div>
            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--text-secondary)",
                marginTop: 6,
                lineHeight: 1.5,
              }}
            >
              {verification.notes}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={capturePhoto}
              className="btn btn-primary btn-sm"
              style={{ flex: 1, justifyContent: "center" }}
              disabled={!cameraReady || Boolean(cameraError)}
            >
              <Camera size={14} /> Capture frame
            </button>
            <button
              type="button"
              onClick={resetCapture}
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, justifyContent: "center" }}
              disabled={!capturedImage}
            >
              <RefreshCw size={14} /> Retake
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
          marginTop: 14,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "var(--text-muted)",
            }}
          >
            Report type
          </span>
          <select
            value={reportType}
            onChange={(event) => setReportType(event.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--white)",
              color: "var(--text-primary)",
            }}
          >
            {REPORT_TYPES.map((typeOption) => (
              <option key={typeOption} value={typeOption}>
                {typeOption}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "var(--text-muted)",
            }}
          >
            Severity
          </span>
          <select
            value={severity}
            onChange={(event) => setSeverity(Number(event.target.value))}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--white)",
              color: "var(--text-primary)",
            }}
          >
            {SEVERITIES.map((level) => (
              <option key={level} value={level}>
                Severity {level}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "var(--text-muted)",
            }}
          >
            Headline
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Short incident title"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--white)",
              color: "var(--text-primary)",
            }}
          />
        </label>
      </div>

      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginTop: 10,
        }}
      >
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "var(--text-muted)",
          }}
        >
          Description
        </span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What is happening at the scene?"
          rows={3}
          style={{
            resize: "vertical",
            padding: "12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--white)",
            color: "var(--text-primary)",
          }}
        />
      </label>

      {capturedImage && (
        <div
          style={{
            marginTop: 12,
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid var(--border)",
            background: "var(--white)",
          }}
        >
          <img
            src={capturedImage}
            alt="Captured report preview"
            style={{
              width: "100%",
              maxHeight: 180,
              objectFit: "cover",
              display: "block",
            }}
          />
          <div
            style={{
              padding: 10,
              fontSize: "0.74rem",
              color: "var(--text-secondary)",
            }}
          >
            Live capture saved at{" "}
            {captureTimestamp
              ? new Date(captureTimestamp).toLocaleTimeString()
              : "now"}
            .
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 14,
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={submitReport}
          className="btn btn-primary"
          style={{ padding: "10px 14px" }}
          disabled={submitting || !capturedImage || !coords}
        >
          {submitting ? "Submitting..." : "Submit live report"}
        </button>
        <span
          style={{
            fontSize: "0.78rem",
            color: "var(--text-secondary)",
            lineHeight: 1.4,
          }}
        >
          Gallery uploads are intentionally disabled. Capture from the camera
          stream, then submit.
        </span>
      </div>

      {submitMessage && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            background: submitMessage.toLowerCase().includes("fail")
              ? "rgba(239, 68, 68, 0.09)"
              : "rgba(16, 185, 129, 0.08)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            fontSize: "0.82rem",
          }}
        >
          {submitMessage}
        </div>
      )}

      {positionError && (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 14,
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            color: "#92400e",
            fontSize: "0.8rem",
          }}
        >
          GPS lookup failed. Check location permissions and try again.
        </div>
      )}
    </section>
  );
}
