"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  Bell,
  Bot,
  Camera,
  ChevronDown,
  Crosshair,
  Layers3,
  Map as MapIcon,
  RefreshCw,
  Radio,
  MapPin,
  TriangleAlert,
  UserCircle2,
  Waves,
  ZoomIn,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import styles from "./MobileApp.module.css";
import LiveReportPanel from "@/components/reporting/LiveReportPanel";

type MobileTab = "map" | "feed" | "report" | "settings";
type MapLayerMode = "light" | "dark";
type MapTarget = { lat: number; lng: number };
type FeedReport = {
  id: string;
  type: string;
  severity: number | null;
  title: string | null;
  description: string | null;
  latitude: number;
  longitude: number;
  timestamp: string;
  verificationScore: number | null;
};

interface MobileMapStageProps {
  layerMode: MapLayerMode;
  zoomSignal: number;
  focusTarget: MapTarget | null;
}

interface MobileAppProps {
  initialTab?: MobileTab;
}

function TopBar({ left, center, right }: { left: ReactNode; center?: ReactNode; right: ReactNode }) {
  return (
    <div className={styles.topBar}>
      <div className={styles.topBarLeft}>{left}</div>
      {center ? <div className={styles.topBarCenter}>{center}</div> : <div className={styles.topBarSpacer} />}
      <div className={styles.topBarRight}>{right}</div>
    </div>
  );
}

function Brand({ subtitle = false }: { subtitle?: boolean }) {
  return (
    <div className={styles.brandBlock}>
      <div className={styles.brandIcon} aria-hidden="true">
        <Waves size={32} strokeWidth={2.25} />
      </div>
      <div className={styles.brandText}>
        <div className={styles.brandTitle}>HiveMind</div>
        {subtitle ? <div className={styles.brandSubtitle}>ODISHA CORRIDOR</div> : null}
      </div>
    </div>
  );
}

function BottomTabBar({ activeTab, onChange }: { activeTab: MobileTab; onChange: (tab: MobileTab) => void; }) {
  const tabs: Array<{ tab: MobileTab; label: string; icon: ReactNode }> = [
    { tab: "map", label: "Map", icon: <MapIcon size={22} strokeWidth={2} /> },
    { tab: "feed", label: "Live Feed", icon: <Radio size={22} strokeWidth={2} /> },
    { tab: "report", label: "Report", icon: <Camera size={22} strokeWidth={2} /> },
    { tab: "settings", label: "Settings", icon: <SettingsIcon /> },
  ];

  return (
    <nav className={styles.tabBar} aria-label="Primary">
      {tabs.map((item) => {
        const isActive = item.tab === activeTab;
        return (
          <button
            key={item.tab}
            type="button"
            className={`${styles.tabButton} ${isActive ? styles.tabButtonActive : ""}`}
            onClick={() => onChange(item.tab)}
            aria-current={isActive ? "page" : undefined}
          >
            <span className={styles.tabIcon}>{item.icon}</span>
            <span className={styles.tabLabel}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function SettingsIcon() {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.65 1.65 0 0 0-1-1.5 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.65 1.65 0 0 0 1.5-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 4.29l.06.06A1.65 1.65 0 0 0 9 4.6c.4 0 .8-.16 1-.4V4a2 2 0 0 1 4 0v.1a1.65 1.65 0 0 0 1 1.5 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82c.24.4.4.9.4 1.48 0 .4-.16.8-.4 1Z" /></svg>;
}

function MapScreen({ onOpenLiveFeed }: { onOpenLiveFeed: () => void }) {
  const [MobileMapStage, setMobileMapStage] = useState<ComponentType<MobileMapStageProps> | null>(null);
  const [layerMode, setLayerMode] = useState<MapLayerMode>("light");
  const [zoomSignal, setZoomSignal] = useState(0);
  const [focusTarget, setFocusTarget] = useState<MapTarget | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    "Tap a control to interact with the live map.",
  );

  useEffect(() => {
    let cancelled = false;

    void import("./MobileMapStage").then((module) => {
      if (!cancelled) {
        setMobileMapStage(() => module.default);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleNotificationTap = () => {
    window.alert("Notifications: 3 active alerts, 1 unresolved report.");
  };

  const handleLayerToggle = () => {
    setLayerMode((currentMode) => {
      const nextMode = currentMode === "light" ? "dark" : "light";
      setStatusMessage(`Basemap switched to ${nextMode === "light" ? "light" : "dark"} mode.`);
      return nextMode;
    });
  };

  const handleZoomIn = () => {
    setZoomSignal((value) => value + 1);
    setStatusMessage("Zoomed in on the map.");
  };

  const handleLocate = () => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFocusTarget({ lat: position.coords.latitude, lng: position.coords.longitude });
          setStatusMessage("Centered on your current location.");
        },
        () => {
          setFocusTarget({ lat: 20.2961, lng: 85.8245 });
          setStatusMessage("Location unavailable. Centered on the Odisha corridor.");
        },
        { enableHighAccuracy: true, timeout: 3000, maximumAge: 0 },
      );
      return;
    }

    setFocusTarget({ lat: 20.2961, lng: 85.8245 });
    setStatusMessage("Centered on the Odisha corridor.");
  };

  return (
    <div className={styles.screen}>
      <TopBar
        left={<Brand subtitle />}
        center={
          <div className={`${styles.statusPill} ${styles.statusPillActive}`}>
            <span className={styles.statusDot} />
            SYSTEM ACTIVE
          </div>
        }
        right={<button className={styles.iconButton} type="button" aria-label="Notifications" onClick={handleNotificationTap}><Bell size={22} strokeWidth={2} /></button>}
      />

      <div className={styles.mapActionBanner}>
        <div className={styles.mapActionBannerIcon}>
          <Bell size={18} strokeWidth={2.3} />
        </div>
        <div>
          <div className={styles.mapActionBannerTitle}>Live Map Response</div>
          <div className={styles.mapActionBannerText}>{statusMessage}</div>
        </div>
      </div>

      <div className={styles.mapStage}>
        {MobileMapStage ? (
          <MobileMapStage layerMode={layerMode} zoomSignal={zoomSignal} focusTarget={focusTarget} />
        ) : (
          <div className={styles.mobileMapLoading} />
        )}

        <div className={styles.mapControls}>
          <button type="button" className={styles.controlButton} aria-label="Locate" onClick={handleLocate}><Crosshair size={24} strokeWidth={2.2} /></button>
          <button type="button" className={styles.controlButton} aria-label="Layers" onClick={handleLayerToggle}><Layers3 size={24} strokeWidth={2.2} /></button>
          <button type="button" className={styles.controlButton} aria-label="Zoom in" onClick={handleZoomIn}><ZoomIn size={24} strokeWidth={2.2} /></button>
        </div>

        <div className={styles.mapBottomSheet}>
          <div className={styles.sheetHandle} />
          <div className={styles.sheetContent}>
            <div className={styles.sheetLeft}>
              <div className={styles.sheetIconBox}><Waves size={26} strokeWidth={2.2} /></div>
              <div>
                <div className={styles.sheetTitle}>Flood Hazard</div>
                <div className={styles.sheetSubtitle}>Live Heatmap</div>
              </div>
            </div>
            <button type="button" className={styles.simulationButton} onClick={onOpenLiveFeed}>
              <span className={styles.robotIcon}><Bot size={18} strokeWidth={2.2} /></span>
              Open Live Feed
            </button>
          </div>
        </div>
      </div>

      <div className={styles.mapSummaryCard}>
        <div className={styles.cardLabel}>ZONES MONITORED</div>
        <div className={styles.cardHeaderRow}>
          <div className={styles.cardHeaderTitle}>Mahanadi Delta</div>
          <div className={styles.cardHeaderValue}>24 Total</div>
        </div>
        <div className={styles.zoneRow}>
          <span className={styles.zoneDotDanger} />
          <span className={styles.zoneName}>Mahanadi Delta</span>
          <span className={styles.zoneStatusDanger}>CRITICAL</span>
        </div>
        <div className={styles.zoneRow}>
          <span className={styles.zoneDotSafe} />
          <span className={styles.zoneName}>Chilika Lake Basin</span>
          <span className={styles.zoneStatusSafe}>STABLE</span>
        </div>
      </div>
    </div>
  );
}

function LiveFeedScreen() {
  const [reports, setReports] = useState<FeedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = async () => {
    setError(null);
    try {
      const response = await fetch("/api/reports", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load live feed");
      }
      const payload = (await response.json()) as FeedReport[];
      setReports(Array.isArray(payload) ? payload.slice(0, 20) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load live feed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFeed();
  }, []);

  return (
    <div className={styles.screen}>
      <TopBar
        left={<Brand />}
        right={<div className={styles.topBarIcons}><button className={styles.iconButton} type="button" aria-label="Notifications" onClick={() => window.alert("Notifications: 2 active alerts and 1 pending report.")}><Bell size={22} strokeWidth={2} /></button><div className={styles.avatarCircle}><UserCircle2 size={28} strokeWidth={1.8} /></div></div>}
      />

      <div className={styles.sectionEyebrow}>PUBLIC LEDGER</div>
      <h1 className={styles.pageTitle}>Live Feed</h1>

      <div className={styles.sectionHeaderRow}>
        <div className={styles.sectionTitle}>LATEST REPORTS</div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadFeed()}>
          <RefreshCw size={14} strokeWidth={1.8} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className={styles.alertCard}>
          <div className={styles.alertIcon}><RefreshCw size={22} strokeWidth={2.2} /></div>
          <div>
            <div className={styles.alertTitle}>Loading live feed</div>
            <p className={styles.alertText}>Fetching latest public reports...</p>
          </div>
        </div>
      ) : error ? (
        <div className={styles.alertCard}>
          <div className={styles.alertIcon}><TriangleAlert size={22} strokeWidth={2.2} /></div>
          <div>
            <div className={styles.alertTitle}>Feed unavailable</div>
            <p className={styles.alertText}>{error}</p>
          </div>
        </div>
      ) : (
        <div className={styles.feedList}>
          {reports.length === 0 ? (
            <article className={styles.feedCard}>
              <div className={styles.feedBody}>
                <div className={styles.feedHeadline}>No reports yet</div>
                <div className={styles.feedSubline}>Once public reports are submitted, they will appear here.</div>
              </div>
            </article>
          ) : (
            reports.map((report) => (
              <article className={styles.feedCard} key={report.id}>
                <div className={styles.feedThumbFlood} />
                <div className={styles.feedBody}>
                  <div className={styles.feedTopRow}>
                    <div className={(report.severity ?? 0) >= 4 ? styles.pillCritical : styles.pillModerate}>
                      {(report.severity ?? 0) >= 4 ? "HIGH" : "NORMAL"}
                    </div>
                    <div className={styles.feedTime}>{new Date(report.timestamp).toLocaleTimeString()}</div>
                  </div>
                  <div className={styles.feedHeadline}>{report.title || `${report.type} report`}</div>
                  <div className={styles.feedSubline}>
                    <MapPin size={13} strokeWidth={2} /> {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                  </div>
                  <div className={styles.feedSubline}>Verification: {report.verificationScore ?? 0}/100</div>
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ReportScreen() {
  return (
    <div className={styles.screen}>
      <TopBar
        left={<Brand />}
        right={<div className={styles.topBarIcons}><button className={styles.iconButton} type="button" aria-label="Notifications" onClick={() => window.alert("Notifications: report feed is live.")}><Bell size={22} strokeWidth={2} /></button><div className={styles.avatarCircle}><UserCircle2 size={28} strokeWidth={1.8} /></div></div>}
      />

      <LiveReportPanel compact />
    </div>
  );
}

function SettingsScreen() {
  const { user, logout } = useAuth();

  const rows = [
    "Notifications",
    "Map Layer Defaults",
    "GPS Accuracy",
    "Report Privacy",
    "Data Sync",
    "About HiveMind",
  ];

  return (
    <div className={styles.screen}>
      <TopBar
        left={<Brand />}
        right={<div className={styles.topBarIcons}><button className={styles.iconButton} type="button" aria-label="Notifications" onClick={() => window.alert("Notifications: settings sync is up to date.")}><Bell size={22} strokeWidth={2} /></button><div className={styles.avatarCircle}>{user?.avatar || <UserCircle2 size={28} strokeWidth={1.8} />}</div></div>}
      />

      <div className={styles.profileCard}>
        <div className={styles.profileAvatar}>{user?.avatar || <UserCircle2 size={30} strokeWidth={1.8} />}</div>
        <div>
          <div className={styles.profileName}>{user?.name || "Field Operator"}</div>
          <div className={styles.profileRole}>Field Operator</div>
        </div>
      </div>

      <div className={styles.settingsList}>
        {rows.map((row) => (
          <button key={row} type="button" className={styles.settingRow}>
            <span>{row}</span>
            {row === "Report Privacy" ? <span className={styles.togglePill}>ZK Anonymous</span> : <ChevronDown size={18} strokeWidth={2.2} color="#8a97a8" />}
          </button>
        ))}
      </div>

      <button type="button" className={styles.logoutButton} onClick={logout}>Logout</button>
    </div>
  );
}

export default function MobileApp({ initialTab = "map" }: MobileAppProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className={styles.mobileApp}>
      {activeTab === "map" ? <MapScreen onOpenLiveFeed={() => setActiveTab("feed")} /> : null}
      {activeTab === "feed" ? <LiveFeedScreen /> : null}
      {activeTab === "report" ? <ReportScreen /> : null}
      {activeTab === "settings" ? <SettingsScreen /> : null}
      <BottomTabBar activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
}

