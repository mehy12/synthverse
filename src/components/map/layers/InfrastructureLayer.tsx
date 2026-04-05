"use client";

import { Polyline, CircleMarker, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";
import powerGridNodes from "@/data/power-grid-locations.json";
import sewageGridNodes from "@/data/sewage-grid-locations.json";

interface InfrastructureLayerProps {
  showPowerGrid: boolean;
  showSewageLines: boolean;
}

// Sewage grid network generation based on real geocoded nodes
const SEWAGE_NETWORK = (() => {
  const connections: any[] = [];
  const nodes = sewageGridNodes as any[];
  const distThreshold = 0.012; 

  for (let i = 0; i < nodes.length; i += 2) { 
    const a = nodes[i];
    let found = 0;
    for (let j = i + 1; j < nodes.length && found < 2; j++) {
      const b = nodes[j];
      const dLat = Math.abs(a.lat - b.lat);
      const dLon = Math.abs(a.lon - b.lon);
      
      if (dLat < distThreshold && dLon < distThreshold) {
        connections.push({
          id: `sewage-${a.id}-${b.id}`,
          from: a,
          to: b
        });
        found++;
      }
    }
  }
  return connections;
})();

// Power grid network generation based on geocoded data
const GRID_NETWORK = (() => {
  const circles: Record<string, any[]> = {};
  powerGridNodes.forEach((node) => {
    if (!circles[node.circle]) circles[node.circle] = [];
    circles[node.circle].push(node);
  });

  const connections: any[] = [];
  Object.entries(circles).forEach(([circleName, nodes]) => {
    const sorted = [...nodes].sort((a, b) => a.lng - b.lng);
    for (let i = 0; i < sorted.length - 1; i++) {
      connections.push({
        id: `link-${circleName}-${i}`,
        from: sorted[i],
        to: sorted[i + 1],
        color: "#FCD34D", 
        width: 2,
      });
    }
    
    const divisions: Record<string, any[]> = {};
    nodes.forEach(n => {
      if (!divisions[n.division]) divisions[n.division] = [];
      divisions[n.division].push(n);
    });
    
    const divCenters = Object.values(divisions).map(d => d[0]);
    if (divCenters.length > 1) {
      for (let i = 0; i < divCenters.length - 1; i++) {
        connections.push({
          id: `trunk-${circleName}-${i}`,
          from: divCenters[i],
          to: divCenters[i+1],
          color: "#F59E0B", 
          width: 3,
        });
      }
    }
  });

  return connections;
})();

export default function InfrastructureLayer({
  showPowerGrid,
  showSewageLines,
}: InfrastructureLayerProps) {
  return (
    <>
      {/* Power Grid */}
      {showPowerGrid && (
        <>
          {GRID_NETWORK.map((link) => (
            <Polyline
              key={link.id}
              positions={[
                [link.from.lat, link.from.lng],
                [link.to.lat, link.to.lng],
              ]}
              pathOptions={{
                color: link.color,
                weight: link.width,
                opacity: 0.8,
                dashArray: "1, 10",
              }}
            >
              <Polyline
                positions={[
                  [link.from.lat, link.from.lng],
                  [link.to.lat, link.to.lng],
                ]}
                pathOptions={{
                  color: link.color,
                  weight: link.width,
                  opacity: 0.3,
                }}
              />
            </Polyline>
          ))}
          {powerGridNodes.map((node) => (
            <CircleMarker
              key={`power-node-${node.id}`}
              center={[node.lat, node.lng]}
              radius={4}
              pathOptions={{
                color: "#F59E0B",
                fillColor: "#FCD34D",
                fillOpacity: 1,
                weight: 1.5,
              }}
            >
              <Tooltip direction="top" offset={[0, -4]} opacity={1} className="custom-popup">
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {node.name}
                </div>
                <div style={{ fontSize: "0.64rem", color: "var(--text-secondary)" }}>
                  {node.circle} Grid Circle
                </div>
              </Tooltip>
              <Popup className="custom-popup">
                <div style={{ minWidth: "200px", padding: "8px" }}>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {node.name}
                  </h4>
                  <p style={{ margin: "0 0 4px 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    Division: {node.division}
                  </p>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    KV: {node.kv} | Capacity: {node.capacity}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </>
      )}

      {/* Sewage Lines */}
      {showSewageLines && (
        <>
          {SEWAGE_NETWORK.map((link) => (
            <Polyline
              key={link.id}
              positions={[
                [link.from.lat, link.from.lon],
                [link.to.lat, link.to.lon],
              ]}
              pathOptions={{
                color: "#10B981",
                weight: 2,
                opacity: 0.6,
                dashArray: "5, 5",
              }}
            />
          ))}
          {sewageGridNodes.map((node: any) => (
            <CircleMarker
              key={`sewage-node-${node.id}`}
              center={[node.lat, node.lon]}
              radius={3}
              pathOptions={{
                color: "#059669",
                fillColor: "#10B981",
                fillOpacity: 0.8,
                weight: 1,
              }}
            >
              <Tooltip direction="top" offset={[0, -3]} opacity={1} className="custom-popup">
                <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  STP Node: {node.id.slice(-6)}
                </div>
              </Tooltip>
            </CircleMarker>
          ))}
        </>
      )}
    </>
  );
}
