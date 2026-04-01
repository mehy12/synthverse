"use client";

import dynamic from "next/dynamic";
import { Suspense, useState, useEffect } from "react";
import reports from "@/data/pollution-reports.json";
import { useSearchParams } from "next/navigation";

const TracerMap = dynamic(() => import("@/components/tracer/TracerMap"), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ width: "100%", height: "100%" }}></div>,
});

function TracerContent() {
  const searchParams = useSearchParams();
  const idFromUrl = searchParams.get("id");
  const [selectedReport, setSelectedReport] = useState<any>(null);
  
  // Set default report if provided in URL or just pick first
  useEffect(() => {
    if (idFromUrl) {
      if (idFromUrl.startsWith("live-")) {
        const stored = sessionStorage.getItem('target_trace');
        if (stored) setSelectedReport(JSON.parse(stored));
      } else {
        const match = reports.find(r => r.id === idFromUrl);
        if (match) setSelectedReport(match);
      }
    } else {
      setSelectedReport(reports[0]);
    }
  }, [idFromUrl]);

  return (
    <div style={{ height: "calc(100vh - var(--nav-height))", display: "flex" }}>
      {/* Sidebar Panel */}
      <div style={{
        width: "350px",
        height: "100%",
        borderRight: "1px solid var(--border-subtle)",
        background: "var(--bg-secondary)",
        display: "flex",
        flexDirection: "column",
        padding: "24px"
      }}>
        <h2 style={{ marginBottom: "20px", fontSize: "1.5rem" }} className="text-gradient">Reverse Tracer</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "20px", fontSize: "0.9rem" }}>
          Select a detection event. Our AI will compute backward trajectories using Gulf of Mannar current vectors to identify the origin.
        </p>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text-primary)" }}>Select Event</label>
          <select 
            style={{ 
              width: "100%", 
              padding: "10px", 
              borderRadius: "var(--radius-md)", 
              background: "#ffffff", 
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
              fontSize: "0.9rem"
            }}
            value={selectedReport?.id || ""}
            onChange={(e) => {
               if (e.target.value.startsWith("live-")) return; // fallback
               setSelectedReport(reports.find(r => r.id === e.target.value));
            }}
          >
            {selectedReport?.isLive && (
              <option value={selectedReport.id}>🔴 LIVE: {selectedReport.title}</option>
            )}
            {reports.map((r: any) => (
              <option key={r.id} value={r.id}>{r.title.substring(0, 30)}...</option>
            ))}
          </select>
        </div>

        {selectedReport && (
          <div className="glass animate-slide-up" style={{ padding: "16px", marginBottom: "20px", flex: 1, overflowY: "auto" }}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "8px" }}>Event Details</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "12px" }}>
              <strong>Type:</strong> <span style={{ textTransform: "uppercase", color: "var(--coral-light)" }}>{selectedReport.type}</span><br/>
              <strong>Date:</strong> {new Date(selectedReport.timestamp).toLocaleString()}<br/>
              <strong>Severity:</strong> {selectedReport.severity}/5
            </p>

            <div style={{ height: "1px", background: "var(--border-subtle)", margin: "16px 0" }}></div>

            <h3 style={{ fontSize: "1.1rem", marginBottom: "8px", color: "var(--teal)" }}>Pathfinding Status</h3>
            <div style={{ display: "flex", gap: "10px", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Vector Grid</span>
                <span style={{ color: "var(--emerald)" }}>Loaded Native</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Dispersion Run</span>
                <span style={{ color: "var(--amber)" }}>Animating [-12hrs]</span>
              </div>
              
              {selectedReport.isLive && selectedReport.vesselMatch ? (
                <div style={{ marginTop: "16px", padding: "12px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", borderRadius: "8px", boxShadow: "0 0 15px rgba(239, 68, 68, 0.2)" }} className="animate-fade-in">
                  <span className="badge badge-coral" style={{ marginBottom: "8px", border: "1px solid #ef4444" }}>AIS Radar Match</span>
                  <p style={{ fontSize: "0.95rem", color: "white", fontWeight: "600", marginTop: "4px" }}>Shipment passed {selectedReport.vesselMatch.hoursPassed} hours ago.</p>
                  <p style={{ fontSize: "0.85rem", color: "var(--teal)", marginTop: "6px", fontFamily: "var(--font-mono)" }}>
                    Vessel: {selectedReport.vesselMatch.name}<br/>
                    MMSI: {selectedReport.vesselMatch.mmsi}<br/>
                    Type: {selectedReport.vesselMatch.type}<br/>
                    Spill Prob: 94.2% [High]
                  </p>
                </div>
              ) : selectedReport.sourceMatch && (
                <div style={{ marginTop: "16px", padding: "12px", background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", borderRadius: "8px" }} className="animate-fade-in">
                  <span className="badge badge-coral" style={{ marginBottom: "8px" }}>Source Identified</span>
                  <p style={{ fontSize: "0.9rem", color: "white", fontWeight: "bold" }}>{selectedReport.sourceMatch}</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>Confidence: 87%</p>
                </div>
              )}
            </div>
            
          </div>
        )}

      </div>

      {/* Map Area */}
      <div style={{ flex: 1, position: "relative" }}>
        <Suspense fallback={<div>Loading Tracer Map...</div>}>
          <TracerMap selectedReport={selectedReport} />
        </Suspense>
      </div>
    </div>
  );
}

export default function TracerPage() {
  return (
    <Suspense fallback={<div>Loading Tracer...</div>}>
      <TracerContent />
    </Suspense>
  );
}
