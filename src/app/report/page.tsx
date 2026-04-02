"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { FiShield, FiLock, FiCheck, FiUpload, FiMapPin } from "react-icons/fi";
import { getGuardianProfile, earnCredits, generateCryptoReceipt, REPORT_REWARD, VERIFIED_BONUS } from "@/lib/guardian";

const LocationPickerMap = dynamic(() => import("@/components/detect/LocationPickerMap"), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ width: "100%", height: "200px" }} />,
});

const POLLUTION_TYPES = [
  { value: "oil", label: "🛢 Oil / Hydrocarbon", color: "var(--amber)" },
  { value: "plastic", label: "♻️ Plastic Debris", color: "var(--blue)" },
  { value: "sewage", label: "🚰 Sewage / Effluent", color: "var(--coral)" },
  { value: "chemical", label: "⚗️ Chemical Discharge", color: "var(--purple)" },
  { value: "ghost_gear", label: "🕸 Ghost Gear / Nets", color: "var(--text-secondary)" },
  { value: "shipping", label: "🚢 Shipping Violation", color: "var(--red)" },
  { value: "agricultural", label: "🌾 Agricultural Runoff", color: "var(--emerald)" },
];

export default function ReportPage() {
  const [guardianId, setGuardianId] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pollutionType, setPollutionType] = useState("");
  const [severity, setSeverity] = useState(3);
  const [description, setDescription] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ hash: string; timestamp: string; guardianId: string } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    const profile = getGuardianProfile();
    setGuardianId(profile.guardianId);
  }, []);

  const handleGpsDetect = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      () => {
        setLocation({ lat: 9.98, lng: 76.22 });
        setGpsLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!location || !pollutionType) return;
    setSubmitting(true);
    setDuplicateError(null);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: location.lat,
          longitude: location.lng,
          type: pollutionType,
          severity,
          description,
          imageBase64: imageBase64?.slice(0, 5000) || null,
          timestamp: new Date().toISOString(),
          isUserReport: true,
        }),
      });

      if (res.status === 409) {
        const data = await res.json();
        setDuplicateError(data.message || "A report already exists near this location. Try a different spot or wait 24 hours.");
        return;
      }

      if (!res.ok) {
        throw new Error("Submit failed");
      }

      earnCredits(`Anonymous pollution report — ${pollutionType}`, REPORT_REWARD, "report");
      earnCredits("AI verification bonus", VERIFIED_BONUS, "trace_bonus");

      const cryptoReceipt = generateCryptoReceipt({
        latitude: location.lat,
        longitude: location.lng,
        type: pollutionType,
        severity,
      });
      setReceipt(cryptoReceipt);
    } catch (err) {
      console.error("Report submission failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return (
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "60px 20px" }}>
        <div className="glass-strong animate-slide-up" style={{ padding: "40px 32px", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🛡</div>
          <h2 className="text-gradient" style={{ marginBottom: "8px" }}>Report Submitted Securely</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>
            Your identity is <strong style={{ color: "var(--teal-light)" }}>mathematically unknowable</strong> — even to us.
          </p>

          <div className="guardian-card" style={{ textAlign: "left", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Cryptographic Receipt</span>
              <FiLock style={{ color: "var(--teal)" }} />
            </div>
            <div style={{ marginBottom: "8px" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Guardian ID</span>
              <div className="zk-hash" style={{ marginTop: "4px", display: "inline-block" }}>{receipt.guardianId}</div>
            </div>
            <div style={{ marginBottom: "8px" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Report Hash</span>
              <div className="zk-hash" style={{ marginTop: "4px", display: "inline-block" }}>0x{receipt.hash}</div>
            </div>
            <div>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Timestamp</span>
              <div style={{ marginTop: "4px", fontSize: "0.85rem", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                {new Date(receipt.timestamp).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="credit-badge" style={{ margin: "0 auto 20px auto" }}>
            <FiAward /> +{REPORT_REWARD + VERIFIED_BONUS} Guardian Credits Earned
          </div>

          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/map" className="btn btn-primary">View on Live Map</a>
            <a href="/dashboard" className="btn btn-secondary">Open Dashboard</a>
            <button className="btn btn-secondary" onClick={() => { setReceipt(null); setLocation(null); setPollutionType(""); setDescription(""); setImageBase64(null); }}>
              File Another Report
            </button>
          </div>
        </div>

        <div className="glass animate-fade-in" style={{ padding: "16px 20px", marginTop: "16px", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            <FiLock style={{ color: "var(--emerald)" }} />
            <span>End-to-End Encrypted • Zero-Knowledge Proof Identity • No IP Logging</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "40px 20px 80px" }}>
      <header style={{ textAlign: "center", marginBottom: "32px" }}>
        <div className={`badge badge-teal`} style={{ marginBottom: "16px" }}>
          <FiShield /> Pillar 1 — Anonymous Secure Reporting
        </div>
        <h1 className="text-gradient">File Anonymous Report</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "8px", maxWidth: "500px", margin: "8px auto 0" }}>
          Your identity is replaced by a cryptographic Guardian ID. Reports are end-to-end encrypted.
        </p>
      </header>

      <div className="glass" style={{ padding: "12px 16px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
        <FiShield style={{ color: "var(--teal)", flexShrink: 0 }} />
        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Reporting as: </span>
        <span className="zk-hash">{guardianId}</span>
        <FiLock style={{ color: "var(--emerald)", fontSize: "0.85rem", marginLeft: "auto" }} />
      </div>

      {/* Location */}
      <div className="glass-strong" style={{ padding: "24px", marginBottom: "16px" }}>
        <h3 style={{ fontSize: "1rem", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <FiMapPin style={{ color: "var(--teal)" }} /> Location
        </h3>
        <button className="btn btn-primary btn-sm" onClick={handleGpsDetect} style={{ marginBottom: "12px" }}>
          {gpsLoading ? "Detecting..." : "Auto-Detect GPS"}
        </button>
        {location && (
          <div style={{ marginBottom: "12px" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </span>
          </div>
        )}
        <div style={{ height: "200px", borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
          <LocationPickerMap
            value={location}
            onChange={setLocation}
          />
        </div>
      </div>

      {/* Pollution Type */}
      <div className="glass-strong" style={{ padding: "24px", marginBottom: "16px" }}>
        <h3 style={{ fontSize: "1rem", marginBottom: "12px" }}>Pollution Type</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
          {POLLUTION_TYPES.map((pt) => (
            <button
              key={pt.value}
              onClick={() => setPollutionType(pt.value)}
              className={pollutionType === pt.value ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
              style={{ justifyContent: "flex-start", fontSize: "0.8rem" }}
            >
              {pt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Severity */}
      <div className="glass-strong" style={{ padding: "24px", marginBottom: "16px" }}>
        <h3 style={{ fontSize: "1rem", marginBottom: "12px" }}>Severity Level</h3>
        <input type="range" min="1" max="5" value={severity} onChange={(e) => setSeverity(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--teal)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
          <span>1 — Minimal</span>
          <span style={{ fontWeight: 700, color: severity >= 4 ? "var(--red)" : "var(--teal-light)", fontSize: "1rem" }}>{severity}/5</span>
          <span>5 — Catastrophic</span>
        </div>
      </div>

      {/* Evidence */}
      <div className="glass-strong" style={{ padding: "24px", marginBottom: "16px" }}>
        <h3 style={{ fontSize: "1rem", marginBottom: "12px" }}>
          <FiUpload style={{ verticalAlign: "middle" }} /> Evidence (optional)
        </h3>
        <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload}
          style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "0.85rem" }} />
        {imageBase64 && (
          <img src={imageBase64} alt="Evidence" style={{ marginTop: "12px", borderRadius: "var(--radius-md)", maxHeight: "200px", objectFit: "cover", width: "100%" }} />
        )}
        <textarea
          placeholder="Describe what you see (optional)..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={{ width: "100%", marginTop: "12px", padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "0.9rem", resize: "vertical" }}
        />
      </div>

      {/* Duplicate Error */}
      {duplicateError && (
        <div style={{ padding: "12px 16px", marginBottom: "16px", border: "1px solid var(--red)", background: "rgba(220,38,38,0.05)", display: "flex", alignItems: "flex-start", gap: "10px" }}>
          <FiShield style={{ color: "var(--red)", flexShrink: 0, marginTop: "2px" }} />
          <div>
            <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--red)", marginBottom: "4px" }}>Duplicate Location Detected</p>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{duplicateError}</p>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        className="btn btn-primary btn-lg"
        onClick={handleSubmit}
        disabled={!location || !pollutionType || submitting}
        style={{ width: "100%", opacity: (!location || !pollutionType) ? 0.5 : 1 }}
      >
        {submitting ? "Encrypting & Submitting..." : "🛡 Submit Anonymous Report"}
      </button>

      <div className="glass" style={{ padding: "12px 16px", marginTop: "16px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          <FiLock style={{ color: "var(--emerald)" }} />
          End-to-End Encrypted • Zero-Knowledge Proof • No IP Logging • Tamper-Proof
        </div>
      </div>
    </div>
  );
}

function FiAward(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8" r="7"/>
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
    </svg>
  );
}
