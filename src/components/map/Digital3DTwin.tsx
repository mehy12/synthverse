"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface Block3D {
  lat: number;
  lng: number;
  height: number;
  severity: "low" | "medium" | "high" | "critical";
  label: string;
  riskScore: number;
}

interface BlockData extends Block3D {
  screenX: number;
  screenY: number;
}

const Digital3DTwin: React.FC<{ data?: Block3D[] }> = ({ data = [] }) => {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Default Odisha high-risk zones if no data provided
  const defaultBlocks: Block3D[] = useMemo(
    () => [
      {
        lat: 20.46,
        lng: 85.88,
        height: 85,
        severity: "critical",
        label: "Mahanadi Basin",
        riskScore: 0.92,
      },
      {
        lat: 19.72,
        lng: 85.48,
        height: 78,
        severity: "high",
        label: "Chilika Lake",
        riskScore: 0.88,
      },
      {
        lat: 20.2961,
        lng: 85.8245,
        height: 65,
        severity: "high",
        label: "Bhubaneswar",
        riskScore: 0.72,
      },
      {
        lat: 20.4625,
        lng: 85.8828,
        height: 72,
        severity: "high",
        label: "Cuttack",
        riskScore: 0.81,
      },
      {
        lat: 21.4704,
        lng: 83.9758,
        height: 58,
        severity: "medium",
        label: "Sambalpur",
        riskScore: 0.62,
      },
      {
        lat: 19.8135,
        lng: 85.8312,
        height: 68,
        severity: "high",
        label: "Puri Coast",
        riskScore: 0.76,
      },
      {
        lat: 20.3164,
        lng: 86.6104,
        height: 71,
        severity: "high",
        label: "Paradeep Port",
        riskScore: 0.79,
      },
      {
        lat: 21.2,
        lng: 85.3,
        height: 55,
        severity: "medium",
        label: "Dhenkanal",
        riskScore: 0.58,
      },
      {
        lat: 19.3,
        lng: 85.0,
        height: 62,
        severity: "medium",
        label: "Ganjam",
        riskScore: 0.68,
      },
    ],
    [],
  );

  const blocks = useMemo(() => {
    return data.length > 0 ? data : defaultBlocks;
  }, [data, defaultBlocks]);

  // Initialize canvas overlay
  useEffect(() => {
    if (!containerRef.current) {
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.top = "0";
      container.style.left = "0";
      container.style.pointerEvents = "none";
      container.style.zIndex = "400";
      containerRef.current = container;
      map.getContainer().appendChild(container);
    }

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvasRef.current = canvas;
    containerRef.current.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (ctx) {
      contextRef.current = ctx;
    }

    const resizeCanvas = () => {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
    };

    resizeCanvas();
    map.addEventListener("resize", resizeCanvas);

    return () => {
      map.removeEventListener("resize", resizeCanvas);
    };
  }, [map]);

  // Animation and rendering loop
  useEffect(() => {
    let angle = 0;

    const render = () => {
      const ctx = contextRef.current;
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return;

      // Clear canvas
      ctx.fillStyle = "rgba(0, 0, 0, 0.02)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Transform blocks to screen coordinates and render
      const blockScreenCoords: BlockData[] = blocks.map((block) => {
        const point = map.latLngToContainerPoint(
          L.latLng(block.lat, block.lng),
        );
        return {
          ...block,
          screenX: point.x,
          screenY: point.y,
        };
      });

      // Sort by distance (painter's algorithm)
      blockScreenCoords.sort(
        (a, b) =>
          Math.sqrt(Math.pow(a.screenX, 2) + Math.pow(a.screenY, 2)) -
          Math.sqrt(Math.pow(b.screenX, 2) + Math.pow(b.screenY, 2)),
      );

      // Draw blocks with 3D perspective
      blockScreenCoords.forEach((block) => {
        draw3DBlock(ctx, block, angle);
      });

      angle += 0.5;
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [blocks, map]);

  return null;
};

function draw3DBlock(
  ctx: CanvasRenderingContext2D,
  block: BlockData,
  rotation: number,
) {
  const { screenX, screenY, height, severity, label, riskScore } = block;

  // Block dimensions
  const width = 40;
  const depth = 30;
  const scaledHeight = height;

  // ISO projection
  const angle = (rotation * Math.PI) / 180;
  const isoX = Math.cos(angle) * (width / 2);
  const isoY = Math.sin(angle) * (width / 2);

  // Color based on severity
  const colors: Record<string, { main: string; dark: string; light: string }> =
    {
      low: { main: "#10b981", dark: "#047857", light: "#d1fae5" },
      medium: { main: "#f59e0b", dark: "#d97706", light: "#fef3c7" },
      high: { main: "#ef4444", dark: "#991b1b", light: "#fee2e2" },
      critical: { main: "#8b5cf6", dark: "#4c0519", light: "#f3e8ff" },
    };

  const color = colors[severity];

  // Draw base (bottom face)
  ctx.fillStyle = color.dark;
  ctx.beginPath();
  ctx.moveTo(screenX - width / 2, screenY + depth / 2);
  ctx.lineTo(screenX + width / 2, screenY + depth / 2);
  ctx.lineTo(
    screenX + width / 2 + isoX,
    screenY + depth / 2 - scaledHeight + isoY,
  );
  ctx.lineTo(
    screenX - width / 2 + isoX,
    screenY + depth / 2 - scaledHeight + isoY,
  );
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw front face
  ctx.fillStyle = color.main;
  ctx.beginPath();
  ctx.moveTo(screenX - width / 2, screenY + depth / 2);
  ctx.lineTo(screenX + width / 2, screenY + depth / 2);
  ctx.lineTo(screenX + width / 2, screenY + depth / 2 - scaledHeight);
  ctx.lineTo(screenX - width / 2, screenY + depth / 2 - scaledHeight);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw top face
  ctx.fillStyle = color.light;
  ctx.beginPath();
  ctx.moveTo(screenX - width / 2, screenY + depth / 2 - scaledHeight);
  ctx.lineTo(screenX + width / 2, screenY + depth / 2 - scaledHeight);
  ctx.lineTo(
    screenX + width / 2 + isoX,
    screenY + depth / 2 - scaledHeight + isoY,
  );
  ctx.lineTo(
    screenX - width / 2 + isoX,
    screenY + depth / 2 - scaledHeight + isoY,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw right side face
  ctx.fillStyle = color.dark;
  ctx.beginPath();
  ctx.moveTo(screenX + width / 2, screenY + depth / 2);
  ctx.lineTo(
    screenX + width / 2 + isoX,
    screenY + depth / 2 - scaledHeight + isoY,
  );
  ctx.lineTo(screenX + width / 2, screenY + depth / 2 - scaledHeight);
  ctx.lineTo(screenX + width / 2, screenY + depth / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw left side face
  ctx.fillStyle = color.dark;
  ctx.beginPath();
  ctx.moveTo(screenX - width / 2, screenY + depth / 2);
  ctx.lineTo(
    screenX - width / 2 + isoX,
    screenY + depth / 2 - scaledHeight + isoY,
  );
  ctx.lineTo(screenX - width / 2, screenY + depth / 2 - scaledHeight);
  ctx.lineTo(screenX - width / 2, screenY + depth / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Label with risk score
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, screenX, screenY + depth / 2 + 15);

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.font = "10px sans-serif";
  ctx.fillText(
    `${(riskScore * 100).toFixed(0)}%`,
    screenX,
    screenY + depth / 2 + 28,
  );

  // Glow effect for critical
  if (severity === "critical") {
    ctx.strokeStyle = "rgba(139, 92, 246, 0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 35, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export default Digital3DTwin;
