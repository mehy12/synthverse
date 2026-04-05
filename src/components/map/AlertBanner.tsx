"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info, X, Bell } from "lucide-react";
import { FloodAlert } from "@/data/odisha-geo";

interface AlertBannerProps {
  alerts: FloodAlert[];
}

const severityConfig = {
  critical: {
    bg: "rgba(220, 38, 38, 0.15)",
    border: "rgba(220, 38, 38, 0.4)",
    text: "#fca5a5",
    icon: "#ef4444",
    badge: "#dc2626",
  },
  warning: {
    bg: "rgba(245, 158, 11, 0.12)",
    border: "rgba(245, 158, 11, 0.35)",
    text: "#fcd34d",
    icon: "#f59e0b",
    badge: "#d97706",
  },
  info: {
    bg: "rgba(59, 130, 246, 0.10)",
    border: "rgba(59, 130, 246, 0.30)",
    text: "#93c5fd",
    icon: "#3b82f6",
    badge: "#2563eb",
  },
};

export default function AlertBanner({ alerts }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.id));

  // Rotate through alerts
  useEffect(() => {
    if (visibleAlerts.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % visibleAlerts.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [visibleAlerts.length]);

  if (visibleAlerts.length === 0) return null;

  const alert = visibleAlerts[currentIndex % visibleAlerts.length];
  if (!alert) return null;

  const config = severityConfig[alert.severity];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={alert.id}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          borderRadius: 12,
          background: config.bg,
          border: `1px solid ${config.border}`,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          maxWidth: "70vw",
          minWidth: 400,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 8,
            background: `${config.badge}22`,
            flexShrink: 0,
          }}
        >
          {alert.severity === "critical" ? (
            <AlertTriangle size={16} color={config.icon} />
          ) : alert.severity === "warning" ? (
            <Bell size={16} color={config.icon} />
          ) : (
            <Info size={16} color={config.icon} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 2,
            }}
          >
            <span
              style={{
                fontSize: "0.6rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: config.badge,
                padding: "1px 6px",
                borderRadius: 4,
                background: `${config.badge}20`,
              }}
            >
              {alert.severity}
            </span>
            <span
              style={{
                fontSize: "0.65rem",
                color: "rgba(148, 163, 184, 0.7)",
              }}
            >
              {alert.district}
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "0.78rem",
              color: config.text,
              fontWeight: 500,
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {alert.message}
          </p>
        </div>

        {visibleAlerts.length > 1 && (
          <span
            style={{
              fontSize: "0.6rem",
              color: "rgba(148, 163, 184, 0.5)",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {(currentIndex % visibleAlerts.length) + 1}/{visibleAlerts.length}
          </span>
        )}

        <button
          onClick={() =>
            setDismissed((prev) => new Set([...prev, alert.id]))
          }
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            borderRadius: 6,
            background: "rgba(255,255,255,0.05)",
            border: "none",
            cursor: "pointer",
            color: "rgba(148, 163, 184, 0.6)",
            flexShrink: 0,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
          }
        >
          <X size={12} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
