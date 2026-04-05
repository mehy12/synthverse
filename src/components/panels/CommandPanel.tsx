/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useSyncExternalStore } from "react";
import { agentStore, ResponseUnit } from "../../store/agent-store";

const STATUS_ICONS: Record<string, string> = {
  idle: "⚪",
  en_route: "🔵",
  rescuing: "🟠",
  returning: "🟢",
};

export default function CommandPanel() {
  const agents: ResponseUnit[] = useSyncExternalStore(
    (l) => agentStore.subscribe(l),
    () => agentStore.getSnapshot()
  );

  return (
    <div style={{
      width: "320px",
      height: "100%",
      background: "#0f172a", // Slate 900
      color: "#f8fafc",
      display: "flex",
      flexDirection: "column",
      borderLeft: "1px solid #334155",
      boxShadow: "-4px 0 20px rgba(0,0,0,0.5)",
      fontFamily: "var(--font-geist-mono, monospace)",
      fontSize: "0.75rem",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px",
        background: "#1e293b", // Slate 800
        borderBottom: "1px solid #334155",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{ fontWeight: 800, fontSize: "0.85rem", letterSpacing: "1px", color: "#38bdf8" }}>
          📡 COMMAND CENTER
        </span>
        <span style={{ fontSize: "0.7rem", padding: "2px 6px", background: "rgba(16,185,129,0.1)", color: "#10b981", borderRadius: "4px", border: "1px solid rgba(16,185,129,0.2)" }}>
          LIVE
        </span>
      </div>

      {/* Stats Summary */}
      <div style={{
        padding: "10px 16px",
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "4px",
        background: "#020617",
        borderBottom: "1px solid #1e293b",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.6rem" }}>AMB</div>
          <div style={{ fontWeight: 700 }}>{agents.filter((a: ResponseUnit) => a.type === "ambulance").length}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.6rem" }}>BOA</div>
          <div style={{ fontWeight: 700 }}>{agents.filter((a: ResponseUnit) => a.type === "boat").length}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.6rem" }}>REP</div>
          <div style={{ fontWeight: 700 }}>{agents.filter((a: ResponseUnit) => a.type === "repair").length}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.6rem" }}>BS</div>
          <div style={{ fontWeight: 700 }}>5</div>
        </div>
      </div>

      {/* Agent List */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "4px 0",
      }}>
        {agents.sort((a: ResponseUnit, b: ResponseUnit) => {
           if (a.status !== b.status) {
              const order = ["rescuing", "en_route", "returning", "idle"];
              return order.indexOf(a.status) - order.indexOf(b.status);
           }
           return a.id.localeCompare(b.id);
        }).map((agent: ResponseUnit) => (
          <div key={agent.id} style={{
            padding: "8px 16px",
            borderBottom: "1px solid #1e293b",
            background: agent.status !== "idle" ? "rgba(56,189,248,0.02)" : "transparent",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            transition: "all 0.2s",
          }}>
            <span style={{ fontSize: "1.2rem", width: "24px" }}>
               {agent.type === "ambulance" ? "🚑" : agent.type === "boat" ? "🚤" : "🛠️"}
            </span>
            
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                <span style={{ fontWeight: 700, color: "#e2e8f0" }}>{agent.id} UNIT</span>
                <span style={{ color: agent.status === "en_route" ? "#38bdf8" : agent.status === "rescuing" ? "#fbbf24" : "#94a3b8", fontSize: "0.65rem", fontWeight: 700 }}>
                   {agent.status.replace("_", " ").toUpperCase()}
                </span>
              </div>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#64748b", fontSize: "0.65rem" }}>
                   {agent.targetClusterId ? `→ ${agent.targetClusterId.slice(0, 10)}...` : "NO ASSIGNMENT"}
                </span>
                {agent.eta > 0 && (
                   <span style={{ fontSize: "0.7rem", color: "#30a6df", fontWeight: 700 }}>
                      {Math.ceil(agent.eta / 60)}m {Math.round(agent.eta % 60)}s
                   </span>
                )}
              </div>

              {/* Mini progress bar if en route */}
              {agent.status === "en_route" && (
                <div style={{ height: "2px", width: "100%", background: "#1e293b", marginTop: "6px", borderRadius: "1px", overflow: "hidden" }}>
                  <div style={{ 
                     height: "100%", background: "#38bdf8", 
                     width: `${Math.min(100, (1 - (agent.eta / 900)) * 100)}%` // dummy estimation for bar
                  }} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: "12px 16px",
        background: "#020617",
        borderTop: "1px solid #1e293b",
        display: "flex",
        fontSize: "0.65rem",
        color: "#475569",
        justifyContent: "space-between",
      }}>
        <span>COORDS: 20.296°N, 85.824°E</span>
        <span>SYS: SZI-V.01-ALPHA</span>
      </div>
    </div>
  );
}
