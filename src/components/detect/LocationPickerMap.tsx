"use client";

import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Location {
  lat: number;
  lng: number;
}

interface Props {
  value: Location | null;
  onChange: (location: Location) => void;
}

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const locationIcon = L.divIcon({
  html:
    '<div style="position: relative; display: flex; align-items: center; justify-content: center;">' +
    '<span style="position:absolute;width:26px;height:26px;border-radius:999px;background:rgba(59,130,246,0.16);box-shadow:0 0 0 0 rgba(59,130,246,0.5);animation:pulse-marker 1.6s ease-out infinite;"></span>' +
    '<span style="position:relative;width:14px;height:14px;border-radius:999px;background:#0EA5E9;border:2px solid #ffffff;"></span>' +
    "</div>",
  iconSize: [26, 26],
  iconAnchor: [13, 22],
  className: "location-picker-marker",
});

function ClickHandler({ onChange }: { onChange: (location: Location) => void }) {
  useMapEvents({
    click: (event) => {
      onChange({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  return null;
}

export default function LocationPickerMap({ value, onChange }: Props) {
  const center: [number, number] = value ? [value.lat, value.lng] : [9.98, 76.22];

  return (
    <div
      style={{
        position: "relative",
        height: "240px",
        width: "100%",
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
        background: "#ffffff",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <MapContainer
        center={center}
        zoom={value ? 11 : 7}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onChange={onChange} />
        {value && <Marker position={[value.lat, value.lng]} icon={locationIcon} />}
      </MapContainer>

      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          padding: "10px 12px",
          borderRadius: "10px",
          background: "rgba(255, 255, 255, 0.9)",
          border: "1px solid var(--border-subtle)",
          backdropFilter: "blur(10px)",
          color: "var(--text-primary)",
          fontSize: "0.75rem",
          maxWidth: "190px",
          lineHeight: 1.5,
        }}
      >
        <div
          style={{
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 4,
            opacity: 0.7,
            color: "var(--text-secondary)",
          }}
        >
          Incident Location
        </div>
        <div>
          Click on the map to drop a pin. Drag to fine tune, or use “Use Current Location”.
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          padding: "6px 10px",
          borderRadius: "999px",
          background: "rgba(255, 255, 255, 0.95)",
          border: "1px solid var(--border-subtle)",
          backdropFilter: "blur(8px)",
          color: "var(--text-secondary)",
          fontSize: "0.72rem",
          fontFamily: "var(--font-mono)",
          pointerEvents: "none",
        }}
      >
        {value
          ? `Pinned at ${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`
          : "Tap anywhere on the map to place a pin"}
      </div>
    </div>
  );
}
