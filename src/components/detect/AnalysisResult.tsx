"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiInfo, FiMapPin, FiRefreshCw, FiAward, FiShield, FiActivity, FiTrendingUp } from "react-icons/fi";
import styles from "./Detect.module.css";
import { earnCredits, getCreditBalance, REPORT_REWARD, VERIFIED_BONUS } from "@/lib/guardian";
import Link from "next/link";

const LocationPickerMap = dynamic(() => import("./LocationPickerMap"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Loading map...</div>,
});

interface Location {
  lat: number;
  lng: number;
}

interface Props {
  result: {
    pollution_type: string;
    severity: number;
    description: string;
    recommended_action: string;
    affected_area: string;
    confidence: number;
    is_pollution: boolean;
  };
  imageBase64: string;
  selectedLocation: Location | null;
  onLocationChange: (location: Location) => void;
  onClear: () => void;
}

export default function AnalysisResult({ result, imageBase64, selectedLocation, onLocationChange, onClear }: Props) {
  const [locating, setLocating] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);

  useEffect(() => {
    setCreditBalance(getCreditBalance());
  }, []);

  const getBadgeClass = (severity: number) => {
    if (severity >= 4) return "badge-coral";
    if (severity === 3) return "badge-amber";
    return "badge-teal";
  };

  const getIcon = (severity: number) => {
    if (severity >= 4) return <FiAlertCircle style={{ color: "var(--red)" }} />;
    return <FiInfo style={{ color: "var(--amber)" }} />;
  };

  const handleAddToMap = async () => {
    if (!selectedLocation) {
      alert("Select a location first: use current location or drop a pin on the map.");
      return;
    }

    const payload = {
      latitude: selectedLocation.lat,
      longitude: selectedLocation.lng,
      type: result.pollution_type.replace("_", " ").toUpperCase(),
      severity: result.severity,
      title: "FIELD REPORT: CITIZEN DETECTION",
      description: result.description,
      imageBase64,
      timestamp: new Date().toISOString(),
      isUserReport: true,
    };

    try {
      // Optimistically update localStorage so offline users still see their own reports
      const userReports = JSON.parse(localStorage.getItem("neptune_user_reports") || "[]");
      const localReport = { id: `user-${Date.now()}`, ...payload, isLive: false };
      localStorage.setItem("neptune_user_reports", JSON.stringify([localReport, ...userReports]));

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error("Failed to sync report to NeonDB", await res.text());
      }

      const updatedProfile = earnCredits(`AI-verified report: ${result.pollution_type}`, REPORT_REWARD, "report");
      earnCredits("AI verification bonus — Gemini Vision confirmed", VERIFIED_BONUS, "trace_bonus");
      setCreditBalance(updatedProfile.creditBalance + VERIFIED_BONUS);

      alert(`✓ Report submitted as anonymous Guardian! You earned ${REPORT_REWARD + VERIFIED_BONUS} Guardian Credits.`);
    } catch (error) {
      console.error(error);
      alert("Report saved locally, but syncing to the server failed.");
    }
  };

  const useCurrentLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      alert("Geolocation is not supported in this browser.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocationChange({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        alert("Unable to fetch your current location. You can drop a pin manually on the map.");
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
      }
    );
  };

  if (!result.is_pollution) {
    return (
      <div className={`${styles.resultCard} glass-strong`}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", color: "var(--emerald)" }}>
          <FiCheckCircle size={32} />
          <h2 style={{ margin: 0 }}>No Pollution Detected</h2>
        </div>
        <div className={styles.imagePreviewSmall}>
          <img src={imageBase64} alt="Analyzed" />
        </div>
        <p style={{ color: "var(--text-secondary)", marginTop: "20px" }}>{result.description}</p>
        <button className="btn btn-secondary" onClick={onClear} style={{ marginTop: "24px", width: "100%" }}>
          Scan Another Image
        </button>
      </div>
    );
  }

  return (
    <div className={styles.resultGrid}>
      <div className={`${styles.imagePreview} glass-strong`}>
        <img src={imageBase64} alt="Analyzed" />
        <div className={styles.confidenceOverlay}>
          AI Confidence: {(result.confidence * 100).toFixed(1)}%
        </div>
      </div>

      <div className={`${styles.resultDetails} glass`}>
        <div className={styles.resultHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {getIcon(result.severity)}
            <span className={`badge ${getBadgeClass(result.severity)}`}>
              Severity {result.severity}/5
            </span>
          </div>
          <h2 style={{ marginTop: "12px", textTransform: "capitalize" }}>
            {result.pollution_type.replace("_", " ")} Detected
          </h2>
        </div>

        <div className={styles.detailSection}>
          <h4>Description</h4>
          <p>{result.description}</p>
        </div>

        <div className={styles.detailSection}>
          <h4>Estimated Area</h4>
          <div className="mono" style={{ background: "var(--bg-card)", padding: "8px 12px", borderRadius: "var(--radius-sm)", display: "inline-block" }}>
            {result.affected_area}
          </div>
        </div>

        <div className={styles.detailSection}>
          <h4>Recommended Action</h4>
          <p style={{ color: "var(--slate-600)" }}>{result.recommended_action}</p>
        </div>

        <div className={styles.detailSection}>
          <h4>Incident Location</h4>
          <p className={styles.locationHint}>Use your current location or click the map to place a pin.</p>
          <div className={styles.locationActions}>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
            >
              <FiMapPin /> {locating ? "Locating..." : "Use Current Location"}
            </button>
          </div>
          <div className={styles.locationMapWrap}>
            <LocationPickerMap value={selectedLocation} onChange={onLocationChange} />
          </div>
          <p className={styles.locationCoords}>
            {selectedLocation
              ? `Pinned at ${selectedLocation.lat.toFixed(5)}, ${selectedLocation.lng.toFixed(5)}`
              : "No location selected yet."}
          </p>
        </div>

        <div style={{ background: "rgba(20, 184, 166, 0.1)", border: "1px solid rgba(20, 184, 166, 0.3)", padding: "12px", borderRadius: "var(--radius-md)", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--teal-light)", fontWeight: "600", marginBottom: "4px" }}>
            <FiAward size={18} />
            Guardian Credits
          </div>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-primary)" }}>
            Submit report to earn <strong>{REPORT_REWARD + VERIFIED_BONUS}</strong> Guardian Credits
          </p>
          <p style={{ margin: "6px 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Current balance: <strong className="credit-badge">{creditBalance}</strong> credits
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          <Link href="/tracer" className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
            <FiTrendingUp /> Run Reverse Trace
          </Link>
          <Link href="/biodiversity" className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
            <FiActivity /> Predict Biodiversity Impact
          </Link>
        </div>

        <div className={styles.actions}>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={handleAddToMap}
          >
            <FiShield /> Submit Anonymous Report
          </button>
          <button className="btn btn-secondary" onClick={onClear}>
            <FiRefreshCw /> Scan Next
          </button>
        </div>
      </div>
    </div>
  );
}
