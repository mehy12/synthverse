"use client";

import { useEffect, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import styles from "./MobileApp.module.css";
import "leaflet/dist/leaflet.css";

type MapLayerMode = "light" | "dark";

interface MobileMapStageProps {
  layerMode: MapLayerMode;
  zoomSignal: number;
  focusTarget: { lat: number; lng: number } | null;
}

function MapEffects({ zoomSignal, focusTarget }: Pick<MobileMapStageProps, "zoomSignal" | "focusTarget">) {
  const map = useMap();
  const previousZoomSignal = useRef(zoomSignal);

  useEffect(() => {
    if (zoomSignal === previousZoomSignal.current) {
      return;
    }

    previousZoomSignal.current = zoomSignal;
    map.zoomIn();
  }, [map, zoomSignal]);

  useEffect(() => {
    if (!focusTarget) {
      return;
    }

    map.flyTo([focusTarget.lat, focusTarget.lng], Math.max(map.getZoom(), 13), {
      animate: true,
      duration: 0.8,
    });
  }, [focusTarget, map]);

  return null;
}

function createIcon(html: string) {
  return L.divIcon({
    html,
    className: "mobile-map-icon",
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
}

export default function MobileMapStage({ layerMode, zoomSignal, focusTarget }: MobileMapStageProps) {
  const tileUrl = layerMode === "light"
    ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

  const waterIcon = createIcon(`
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;transform:translate(-50%, -100%);">
      <div style="width:34px;height:34px;border-radius:12px;background:#c81e1e;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 18px rgba(0,0,0,.18);">
        <svg viewBox='0 0 24 24' width='18' height='18' fill='none' stroke='currentColor' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'>
          <path d='M12 22s6-5.2 6-11.2A6 6 0 0 0 6 10.8C6 16.8 12 22 12 22z'/>
          <circle cx='12' cy='10.5' r='2.3' fill='currentColor' stroke='none'/>
        </svg>
      </div>
      <div style="background:#f3f4f6;color:#111827;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:700;letter-spacing:.02em;box-shadow:0 4px 10px rgba(0,0,0,.08);">LVL 4.2m</div>
    </div>
  `);
  const sensorIcon = createIcon(`
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;transform:translate(-50%, -100%);">
      <div style="width:34px;height:34px;border-radius:12px;background:#0d7a6e;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 18px rgba(0,0,0,.18);">
        <svg viewBox='0 0 24 24' width='18' height='18' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'>
          <path d='M7 12h10' />
          <path d='M12 7v10' />
          <circle cx='12' cy='12' r='7' />
        </svg>
      </div>
      <div style="background:#f3f4f6;color:#111827;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:700;letter-spacing:.02em;box-shadow:0 4px 10px rgba(0,0,0,.08);">S-092</div>
    </div>
  `);
  const normalIcon = createIcon(`
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;transform:translate(-50%, -100%);">
      <div style="width:34px;height:34px;border-radius:10px;background:#0d7a6e;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 18px rgba(0,0,0,.18);">
        <svg viewBox='0 0 24 24' width='18' height='18' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'>
          <path d='M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0' />
          <path d='M2 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0' />
        </svg>
      </div>
      <div style="background:#f3f4f6;color:#111827;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:700;letter-spacing:.02em;box-shadow:0 4px 10px rgba(0,0,0,.08);">NORMAL</div>
    </div>
  `);

  return (
    <MapContainer center={[20.2961, 85.8245]} zoom={11} scrollWheelZoom={false} zoomControl={false} className={styles.mapContainer}>
      <TileLayer key={layerMode} url={tileUrl} attribution="" />
      <MapEffects zoomSignal={zoomSignal} focusTarget={focusTarget} />
      <Marker position={[20.406, 85.91]} icon={waterIcon} />
      <Marker position={[20.245, 85.74]} icon={sensorIcon} />
      <Marker position={[20.125, 85.88]} icon={normalIcon} />
    </MapContainer>
  );
}