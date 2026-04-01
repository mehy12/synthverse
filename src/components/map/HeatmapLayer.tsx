import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

interface HeatmapProps {
  points: Array<{ lat: number; lng: number; weight: number }>;
  visible: boolean;
}

export default function HeatmapLayer({ points, visible }: HeatmapProps) {
  const map = useMap();

  useEffect(() => {
    if (!visible || !points.length) return;

    // Convert points to LatLng array with intensity
    // leaflet.heat expects [lat, lng, intensity]
    const heatPoints = points.map(p => [p.lat, p.lng, p.weight] as L.HeatLatLngTuple);

    const heatLayer = (L as any).heatLayer(heatPoints, {
      // Larger radius / blur so coastal band feels like a smooth strip
      // even when the user zooms in closely.
      radius: 55,
      blur: 40,
      maxZoom: 16,
      // Gradient: green in low-intensity offshore water, then yellow/orange,
      // with deep red hugging the strongest coastal pollution band.
      gradient: {
        0.0: "rgba(0, 0, 0, 0)",
        0.18: "rgba(34, 197, 94, 0.55)", // green
        0.4: "rgba(234, 179, 8, 0.75)",  // yellow
        0.7: "rgba(249, 115, 22, 0.9)",  // orange
        1.0: "rgba(220, 38, 38, 1.0)"    // red
      }
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points, visible]);

  return null;
}
