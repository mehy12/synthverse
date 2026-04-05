import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

interface HeatmapProps {
  points: Array<{ lat: number; lng: number; weight: number }>;
  visible: boolean;
  theme?: "flood" | "cyclone" | "earthquake";
}

export default function HeatmapLayer({ points, visible, theme = "flood" }: HeatmapProps) {
  const map = useMap();

  const themeConfig = {
    flood: {
      radius: 55,
      blur: 40,
      gradient: {
        0.0: "rgba(0, 0, 0, 0)",
        0.18: "rgba(34, 197, 94, 0.55)",
        0.4: "rgba(234, 179, 8, 0.75)",
        0.7: "rgba(249, 115, 22, 0.9)",
        1.0: "rgba(220, 38, 38, 1.0)",
      },
    },
    cyclone: {
      radius: 62,
      blur: 44,
      gradient: {
        0.0: "rgba(0, 0, 0, 0)",
        0.16: "rgba(14, 165, 233, 0.55)",
        0.42: "rgba(59, 130, 246, 0.78)",
        0.72: "rgba(249, 115, 22, 0.92)",
        1.0: "rgba(153, 27, 27, 1.0)",
      },
    },
    earthquake: {
      radius: 48,
      blur: 32,
      gradient: {
        0.0: "rgba(0, 0, 0, 0)",
        0.2: "rgba(168, 85, 247, 0.58)",
        0.45: "rgba(124, 58, 237, 0.8)",
        0.75: "rgba(249, 115, 22, 0.92)",
        1.0: "rgba(127, 29, 29, 1.0)",
      },
    },
  }[theme];

  useEffect(() => {
    if (!visible || !points.length) return;

    // Convert points to LatLng array with intensity
    // leaflet.heat expects [lat, lng, intensity]
    const heatPoints = points.map(p => [p.lat, p.lng, p.weight] as L.HeatLatLngTuple);

    const heatLayer = (L as any).heatLayer(heatPoints, {
      radius: themeConfig.radius,
      blur: themeConfig.blur,
      maxZoom: 16,
      gradient: themeConfig.gradient
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points, visible, theme]);

  return null;
}
