/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useSyncExternalStore, Fragment } from "react";
import { CircleMarker, Marker, Polyline, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";
import { agentStore, ResponseUnit, AgentType, BASES } from "../../../store/agent-store";

/**
 * AGENTS LAYER: Visualizes 13 living rescue units and 5 strategic bases
 */

const getAgentIcon = (type: AgentType, angle: number, status: string) => {
  const emoji = type === "ambulance" ? "🚑" : type === "boat" ? "🚤" : "🛠️";
  const color = status === "en_route" ? "#1A73E8" : status === "rescuing" ? "#F59E0B" : "#10B981";
  
  return L.divIcon({
    html: `
      <div style="
        transform: rotate(${angle}deg);
        filter: drop-shadow(0 0 4px ${color});
        font-size: 24px;
        transition: transform 0.1s linear;
        display: flex; justify-content: center; align-items: center;
        background: rgba(255,255,255,0.8);
        border-radius: 50%; width: 34px; height: 34px;
        border: 2px solid ${color};
      ">
        ${emoji}
      </div>
    `,
    className: "custom-agent-icon",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
};

const BASE_ICON = L.divIcon({
  html: `
    <div style="
      background: #1e293b;
      color: #fff;
      border-radius: 6px;
      padding: 4px;
      border: 2px solid #334155;
      font-size: 14px;
      display: flex; justify-content: center; align-items: center;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    ">
      🏢
    </div>
  `,
  className: "custom-base-icon",
  iconSize: [28, 28],
});

export default function AgentsLayer() {
  const agents = useSyncExternalStore(
    (l) => agentStore.subscribe(l),
    () => agentStore.getSnapshot()
  );

  return (
    <Fragment>
      {/* Bases */}
      {BASES.map((base) => (
        <Marker key={base.id} position={base.position} icon={BASE_ICON}>
           <Tooltip direction="top" offset={[0, -10]} className="custom-popup">
              <div style={{ fontWeight: 700 }}>{base.name}</div>
              <div style={{ fontSize: "0.7rem", color: "#64748b" }}>Command Center</div>
           </Tooltip>
        </Marker>
      ))}

      {/* Agents */}
      {agents.map((agent) => (
        <Fragment key={agent.id}>
          {/* Active Route Polyline */}
          {agent.path.length > 0 && (
            <Polyline
               positions={agent.path}
               pathOptions={{
                  color: agent.type === "ambulance" ? "#2563eb" : agent.type === "boat" ? "#0ea5e9" : "#eab308",
                  weight: 3,
                  opacity: 0.6,
                  dashArray: "10, 10",
               }}
            />
          )}

          {/* Agent Marker */}
          <Marker
            position={agent.position}
            icon={getAgentIcon(agent.type, agent.angle, agent.status)}
          >
            <Tooltip direction="top" offset={[0, -15]} className="custom-popup" permanent={false}>
               <div style={{ fontWeight: 800, fontSize: "0.75rem", color: "#1e293b" }}>
                  {agent.id} · {agent.status.toUpperCase()}
               </div>
               {agent.eta > 0 && (
                  <div style={{ fontSize: "0.68rem", color: "#2563eb", fontWeight: 600 }}>
                    ETA: {Math.ceil(agent.eta / 60)}m {Math.round(agent.eta % 60)}s
                  </div>
               )}
            </Tooltip>
            
            <Popup className="custom-popup">
               <div style={{ minWidth: "180px", padding: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                     <span style={{ fontWeight: 800, fontSize: "1rem" }}>{agent.id} Unit</span>
                     <span style={{ 
                        fontSize: "0.65rem", padding: "2px 6px", borderRadius: 99, 
                        background: agent.status === "en_route" ? "#dbeafe" : "#fef3c7",
                        color: agent.status === "en_route" ? "#1e40af" : "#92400e"
                     }}>
                        {agent.status.replace("_", " ").toUpperCase()}
                     </span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#475569" }}>
                     <p><strong>Speed:</strong> {agent.speed} km/h</p>
                     <p><strong>Assignment:</strong> {agent.targetClusterId || "Searching..."}</p>
                     <p><strong>Base:</strong> {agent.baseId.replace("base-", "").toUpperCase()}</p>
                  </div>
               </div>
            </Popup>
          </Marker>
        </Fragment>
      ))}
    </Fragment>
  );
}
