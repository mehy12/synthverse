"use client";

import { Polyline, Polygon, Tooltip, Popup } from "react-leaflet";
import waterData from "@/data/water-infrastructure.json";

interface WaterwayLayerProps {
  showWaterways: boolean;
  showBasins: boolean;
  showPipelines: boolean;
  showIrrigation: boolean;
}

export default function WaterwayLayer({
  showWaterways,
  showBasins,
  showPipelines,
  showIrrigation,
}: WaterwayLayerProps) {
  return (
    <>
      {/* Rivers and Lakes */}
      {showWaterways &&
        waterData.waterways.map((waterway: any) => {
          if (waterway.kind === "lake" && waterway.polygon) {
            return (
              <Polygon
                key={waterway.name}
                positions={waterway.polygon}
                pathOptions={{
                  color: waterway.color,
                  weight: 3,
                  opacity: 0.95,
                  fillColor: "#14B8A6",
                  fillOpacity: 0.22,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={1} sticky className="custom-popup">
                  <div style={{ minWidth: "180px", padding: "2px 0" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {waterway.name}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: 2 }}>
                      Highlighted water body
                    </div>
                  </div>
                </Tooltip>
                <Popup className="custom-popup">
                  <div style={{ minWidth: "220px", padding: "8px" }}>
                    <h4 style={{ margin: "0 0 6px 0", fontSize: "0.92rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {waterway.name}
                    </h4>
                    <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {waterway.description}
                    </p>
                  </div>
                </Popup>
              </Polygon>
            );
          }

          return (
            <Polyline
              key={waterway.name}
              positions={waterway.line as any}
              pathOptions={{
                color: waterway.color,
                weight: 11,
                opacity: 0.18,
                lineCap: "round",
                lineJoin: "round",
              }}
            >
              <Polyline
                positions={waterway.line as any}
                pathOptions={{
                  color: waterway.color,
                  weight: 4,
                  opacity: 0.96,
                  dashArray: waterway.kind === "coast" ? "8 10" : undefined,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
              <Tooltip direction="top" offset={[0, -8]} opacity={1} sticky className="custom-popup">
                <div style={{ minWidth: "180px", padding: "2px 0" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {waterway.name}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: 2 }}>
                    Highlighted {waterway.kind}
                  </div>
                </div>
              </Tooltip>
              <Popup className="custom-popup">
                <div style={{ minWidth: "220px", padding: "8px" }}>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "0.92rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {waterway.name}
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {waterway.description}
                  </p>
                </div>
              </Popup>
            </Polyline>
          );
        })}

      {/* Basins and Wetlands */}
      {showBasins &&
        waterData.basins.map((basin: any) => (
          <Polygon
            key={basin.name}
            positions={basin.polygon}
            pathOptions={{
              color: basin.color,
              weight: 2,
              opacity: 0.7,
              fillColor: basin.color,
              fillOpacity: 0.08,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1} sticky className="custom-popup">
              <div style={{ minWidth: "160px", padding: "2px 0" }}>
                <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {basin.name}
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: 2 }}>
                  {basin.kind}
                </div>
              </div>
            </Tooltip>
            <Popup className="custom-popup">
              <div style={{ minWidth: "200px", padding: "8px" }}>
                <h4 style={{ margin: "0 0 6px 0", fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {basin.name}
                </h4>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {basin.description}
                </p>
              </div>
            </Popup>
          </Polygon>
        ))}

      {/* Pipelines */}
      {showPipelines &&
        waterData.pipelines.map((pipeline: any) => (
          <Polyline
            key={pipeline.name}
            positions={pipeline.path as any}
            pathOptions={{
              color: pipeline.color,
              weight: 5,
              opacity: 0.9,
              dashArray: "10 12",
              lineCap: "round",
              lineJoin: "round",
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1} sticky className="custom-popup">
              <div style={{ minWidth: "180px", padding: "2px 0" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {pipeline.name}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: 2 }}>
                  Imaginary water pipeline
                </div>
              </div>
            </Tooltip>
            <Popup className="custom-popup">
              <div style={{ minWidth: "220px", padding: "8px" }}>
                <h4 style={{ margin: "0 0 6px 0", fontSize: "0.92rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {pipeline.name}
                </h4>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {pipeline.description}
                </p>
              </div>
            </Popup>
          </Polyline>
        ))}

      {/* Irrigation */}
      {showIrrigation &&
        waterData.irrigation.map((canal: any) => (
          <Polyline
            key={canal.name}
            positions={canal.line as any}
            pathOptions={{
              color: canal.color,
              weight: 3,
              opacity: canal.opacity,
              lineCap: "round",
              lineJoin: "round",
            }}
          >
             <Tooltip direction="top" offset={[0, -8]} opacity={1} sticky className="custom-popup">
              <div style={{ minWidth: "140px", padding: "2px 0" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {canal.name}
                </div>
              </div>
            </Tooltip>
          </Polyline>
        ))}
    </>
  );
}
