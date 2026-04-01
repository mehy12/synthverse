"use client";

import { useEffect, useRef, useState } from "react";
import ImageUploader from "@/components/detect/ImageUploader";
import AnalysisResult from "@/components/detect/AnalysisResult";
import styles from "@/components/detect/Detect.module.css";
import { FiCamera } from "react-icons/fi";

export default function DetectPage() {
  const [file, setFile] = useState<File | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const lastAutoPhotoKeyRef = useRef<string | null>(null);

  const readFileAsDataURL = (input: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(input);
    });
  };

  const fileToResizedDataURL = async (file: File): Promise<string> => {
    // Downscale large camera images so mobile uploads don\'t exceed
    // Next.js body limits and analysis stays fast and reliable.
    const base64 = await readFileAsDataURL(file);

    try {
      const img = new Image();
      img.src = base64;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image for resizing"));
      });

      const maxDim = 1280; // keep mobile photos reasonable
      let { width, height } = img;

      if (width <= maxDim && height <= maxDim) {
        return base64;
      }

      const scale = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return base64;

      ctx.drawImage(img, 0, 0, width, height);
      return canvas.toDataURL("image/jpeg", 0.9);
    } catch {
      // Fallback to original if anything goes wrong
      return base64;
    }
  };

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setAnalysisError("Please upload an image file.");
      return;
    }

    setFile(file);
    setAnalyzing(true);
    setResult(null);
    setAnalysisError(null);

    try {
      const resultBase64 = await fileToResizedDataURL(file);
      setBase64(resultBase64);

      // Strip data:image/...;base64,
      const base64Data = resultBase64.split(",")[1];
      const mimeType = file.type;

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Data, mimeType }),
      });

      if (!res.ok) {
        const errorPayload = await res.json().catch(() => null);
        const message =
          errorPayload?.error ||
          errorPayload?.details ||
          `Analysis failed (${res.status})`;
        throw new Error(message);
      }

      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to analyze image.";
      setAnalysisError(message);
    } finally {
      // Keeping analyzing state true briefly for animation effect
      setTimeout(() => setAnalyzing(false), 500);
    }
  };

  useEffect(() => {
    if (!result || analyzing || !base64 || !selectedLocation || typeof window === "undefined") {
      return;
    }

    const autoPhotoKey = [
      selectedLocation.lat.toFixed(4),
      selectedLocation.lng.toFixed(4),
      result.pollution_type,
      result.severity,
      result.confidence.toFixed(3),
      base64.slice(0, 80),
    ].join("|");

    if (lastAutoPhotoKeyRef.current === autoPhotoKey) {
      return;
    }

    lastAutoPhotoKeyRef.current = autoPhotoKey;

    const stored = JSON.parse(localStorage.getItem("neptune_recent_node_photos") || "[]");
    const nextEntry = {
      id: `photo-${Date.now()}`,
      latitude: selectedLocation.lat,
      longitude: selectedLocation.lng,
      imageBase64: base64,
      title: result.pollution_type.replace("_", " ").toUpperCase(),
      description: result.description,
      timestamp: new Date().toISOString(),
      source: "analyzed_upload",
    };

    const pruned = stored.filter((entry: any) => {
      if (!entry?.timestamp) return true;
      return Date.now() - new Date(entry.timestamp).getTime() <= 24 * 60 * 60 * 1000;
    });

    localStorage.setItem("neptune_recent_node_photos", JSON.stringify([nextEntry, ...pruned].slice(0, 20)));
  }, [analyzing, base64, result, selectedLocation]);

  useEffect(() => {
    if (!result) {
      lastAutoPhotoKeyRef.current = null;
    }
  }, [result]);

  const clear = () => {
    setFile(null);
    setBase64(null);
    setResult(null);
    setAnalysisError(null);
    setSelectedLocation(null);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.iconWrapper} style={{ background: "rgba(255, 193, 7, 0.15)", color: "var(--amber)", margin: "0 auto 16px auto", width: "64px", height: "64px", fontSize: "2rem" }}>
          <FiCamera />
        </div>
        <h1 className="text-gradient">AI Pollution Detector</h1>
        <p className={styles.subtitle}>Upload an ocean photo. Gemini Vision will analyze the pollution type, severity, and recommend action.</p>
      </header>

      <div className={styles.content}>
        {!file && <ImageUploader onUpload={handleUpload} />}

        {file && analyzing && (
           <div className={`${styles.analyzingCard} glass animate-pulse`}>
              <div className={styles.imagePreview}>
                {base64 && <img src={base64} alt="Preview" />}
                 <div className={styles.scanningLine}></div>
              </div>
              <h3 style={{ marginTop: "20px", color: "var(--teal)" }}>Gemini Vision analyzing...</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Scanning for anomalies, effluent signatures, and hazardous materials.</p>
           </div>
        )}

        {file && analysisError && !analyzing && (
          <div className={`${styles.resultCard} glass-strong`} style={{ marginTop: "24px" }}>
            <h3 style={{ marginTop: 0, color: "var(--red)" }}>Analysis failed</h3>
            <p style={{ color: "var(--text-secondary)" }}>{analysisError}</p>
            <button className="btn btn-secondary" onClick={clear} style={{ marginTop: "20px" }}>
              Try Another Image
            </button>
          </div>
        )}

        {file && result && !analyzing && base64 && (
          <div className="animate-slide-up">
            <AnalysisResult
              result={result}
              imageBase64={base64}
              selectedLocation={selectedLocation}
              onLocationChange={setSelectedLocation}
              onClear={clear}
            />
          </div>
        )}

        {file && !analyzing && !result && !analysisError && (
          <div className={`${styles.resultCard} glass-strong`} style={{ marginTop: "24px" }}>
            <h3 style={{ marginTop: 0 }}>Waiting for analysis</h3>
            <p style={{ color: "var(--text-secondary)" }}>
              Your image finished uploading, but the analyzer did not return a result yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
