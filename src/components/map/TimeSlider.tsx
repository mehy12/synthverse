"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Clock } from "lucide-react";

interface TimeSliderProps {
  value: number;
  onChange: (hour: number) => void;
  label: string;
}

const TICK_MARKS = [0, 3, 6, 12, 18, 24];

export default function TimeSlider({ value, onChange, label }: TimeSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      onChange(value >= 24 ? 0 : value + 1);
    }, 800);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, value, onChange]);

  // Stop on max
  useEffect(() => {
    if (value >= 24 && isPlaying) setIsPlaying(false);
  }, [value, isPlaying]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    onChange(0);
  }, [onChange]);

  const progress = (value / 24) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      style={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 20px",
        borderRadius: 14,
        background: "rgba(255, 255, 255, 0.97)",
        border: "1px solid rgba(203, 213, 225, 1)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.12)",
        minWidth: 500,
        maxWidth: "60vw",
      }}
    >
      {/* Play/Pause */}
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 8,
          background: isPlaying
            ? "rgba(239, 68, 68, 0.15)"
            : "rgba(56, 189, 248, 0.15)",
          border: `1px solid ${isPlaying ? "rgba(239, 68, 68, 0.3)" : "rgba(56, 189, 248, 0.3)"}`,
          cursor: "pointer",
          color: isPlaying ? "#ef4444" : "#38bdf8",
          transition: "all 0.2s",
          flexShrink: 0,
        }}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </button>

      {/* Time label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minWidth: 90,
          flexShrink: 0,
        }}
      >
        <Clock size={12} color="#64748b" />
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            color: value > 0 ? "#38bdf8" : "#94a3b8",
            letterSpacing: "0.05em",
          }}
        >
          T+{String(value).padStart(2, "0")}h
        </span>
      </div>

      {/* Slider track */}
      <div style={{ flex: 1, position: "relative", height: 32 }}>
        {/* Track background */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: 4,
            borderRadius: 2,
            background: "rgba(203, 213, 225, 0.9)",
            transform: "translateY(-50%)",
          }}
        />

        {/* Track fill */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            width: `${progress}%`,
            height: 4,
            borderRadius: 2,
            background:
              value >= 18
                ? "linear-gradient(90deg, #38bdf8, #ef4444)"
                : value >= 12
                  ? "linear-gradient(90deg, #38bdf8, #f59e0b)"
                  : "linear-gradient(90deg, #38bdf8, #22d3ee)",
            transform: "translateY(-50%)",
            transition: "width 0.3s ease",
          }}
        />

        {/* Tick marks */}
        {TICK_MARKS.map((tick) => (
          <div
            key={tick}
            style={{
              position: "absolute",
              left: `${(tick / 24) * 100}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: tick === 0 || tick === 24 ? 2 : 1,
                height: tick === 0 || tick === 24 ? 10 : 6,
                background:
                  tick <= value
                    ? "rgba(56, 189, 248, 0.6)"
                    : "rgba(100, 116, 139, 0.4)",
                borderRadius: 1,
              }}
            />
            <span
              style={{
                position: "absolute",
                top: 22,
                fontSize: "0.55rem",
                color:
                  tick <= value
                    ? "rgba(56, 189, 248, 0.8)"
                    : "rgba(100, 116, 139, 0.5)",
                fontWeight: 600,
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {tick}h
            </span>
          </div>
        ))}

        {/* Range input */}
        <input
          type="range"
          min={0}
          max={24}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            width: "100%",
            transform: "translateY(-50%)",
            opacity: 0,
            cursor: "pointer",
            height: 20,
            margin: 0,
          }}
        />

        {/* Thumb */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${progress}%`,
            width: 14,
            height: 14,
            borderRadius: 7,
            background: "#38bdf8",
            border: "2px solid #ffffff",
            transform: "translate(-50%, -50%)",
            boxShadow: "0 0 10px rgba(56, 189, 248, 0.5)",
            transition: "left 0.3s ease",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Status label */}
      <span
        style={{
          fontSize: "0.62rem",
          color: "#64748b",
          fontWeight: 600,
          minWidth: 80,
          textAlign: "right",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>

      {/* Reset */}
      <button
        onClick={reset}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: 6,
          background: "rgba(248, 250, 252, 1)",
          border: "1px solid rgba(203, 213, 225, 1)",
          cursor: "pointer",
          color: "#64748b",
          transition: "all 0.2s",
          flexShrink: 0,
        }}
      >
        <RotateCcw size={12} />
      </button>
    </motion.div>
  );
}
