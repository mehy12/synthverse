"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  Camera,
  ChevronDown,
  Crosshair,
  FlipHorizontal2,
  Layers3,
  Map as MapIcon,
  MapPin,
  Send,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  User,
  UserCircle2,
  Waves,
  Zap,
  ZoomIn,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import styles from "./MobileApp.module.css";
import LiveReportPanel from "@/components/reporting/LiveReportPanel";

type MobileTab = "map" | "analytics" | "report" | "settings";
type MapLayerMode = "light" | "dark";
type MapTarget = { lat: number; lng: number };

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
        <div className={styles.brandTitle}>FloodMind</div>
        {subtitle ? <div className={styles.brandSubtitle}>ODISHA CORRIDOR</div> : null}
      </div>
    </div>
  );
}

function BottomTabBar({ activeTab, onChange }: { activeTab: MobileTab; onChange: (tab: MobileTab) => void; }) {
  const tabs: Array<{ tab: MobileTab; label: string; icon: ReactNode }> = [
    { tab: "map", label: "Map", icon: <MapIcon size={22} strokeWidth={2} /> },
    { tab: "analytics", label: "Analytics", icon: <BarChart3 size={22} strokeWidth={2} /> },
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

function StopwatchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="13" r="7" />
      <path d="M9 2h6" />
      <path d="M12 6v1" />
      <path d="M15.2 9.8 12 13" />
    </svg>
  );
}

function MapScreen({ onOpenAnalytics }: { onOpenAnalytics: () => void }) {
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
            <button type="button" className={styles.simulationButton} onClick={onOpenAnalytics}>
              <span className={styles.robotIcon}><Bot size={18} strokeWidth={2.2} /></span>
              Trigger Simulation
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

function AnalyticsScreen() {
  const districts = [
    { name: "Sector-14 Hub", subtitle: "Commercial Infrastructure", status: "Critical Risk", statusClass: styles.pillDanger, progress: 84, barClass: styles.barDanger },
    { name: "Old Town Docks", subtitle: "Logistics & Warehousing", status: "Elevated", statusClass: styles.pillSlate, progress: 42, barClass: styles.barSlate },
    { name: "North Residential", subtitle: "Residential Zone A", status: "Stable Monitoring", statusClass: styles.pillSafe, progress: 12, barClass: styles.barSafe },
  ];

  return (
    <div className={styles.screen}>
      <TopBar
        left={<Brand />}
        right={<div className={styles.topBarIcons}><button className={styles.iconButton} type="button" aria-label="Notifications" onClick={() => window.alert("Notifications: 2 active alerts and 1 pending report.")}><Bell size={22} strokeWidth={2} /></button><div className={styles.avatarCircle}><UserCircle2 size={28} strokeWidth={1.8} /></div></div>}
      />

      <div className={styles.sectionEyebrow}>REAL-TIME ANALYSIS</div>
      <h1 className={styles.pageTitle}>Cascade Forecast</h1>

      <div className={styles.alertCard}>
        <div className={styles.alertIcon}><TriangleAlert size={22} strokeWidth={2.2} /></div>
        <div>
          <div className={styles.alertTitle}>Primary Risk Alert</div>
          <p className={styles.alertText}>Critical surge detected in the Upper Basin. Impact on urban drainage predicted within 120 minutes.</p>
        </div>
      </div>

      <div className={styles.summaryCard}>
        <div className={styles.cardLabel}>CASCADE TOTAL</div>
        <div className={styles.summaryFooter}>
          <div className={styles.summaryValue}>₹0.02 Cr</div>
          <div className={styles.pillEstimate}><ArrowUpRight size={13} strokeWidth={2.3} /> ESTIMATED</div>
        </div>
      </div>

      <div className={styles.metricGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>INFRASTRUCTURE LOSS</div>
          <div className={styles.metricValue}>₹0.012 Cr</div>
          <div className={styles.progressTrack}><div className={styles.progressFillRed} style={{ width: "58%" }} /></div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>DISTRICT RISK</div>
          <div className={styles.metricValue}>High</div>
          <div className={styles.levelRow}><span className={styles.levelPill}><ShieldAlert size={13} strokeWidth={2.1} /> LEVEL 4/5</span></div>
        </div>
      </div>

      <div className={styles.interventionCard}>
        <div>
          <div className={styles.interventionLabel}>INTERVENTION WINDOW</div>
          <div className={styles.interventionValue}>Immediate</div>
        </div>
        <div className={styles.stopwatchBox}><StopwatchIcon /></div>
      </div>

      <div className={styles.sectionHeaderRow}>
        <div className={styles.sectionTitle}>DISTRICT CASCADE FORECAST</div>
        <div className={styles.sectionPill}>Live Updates</div>
      </div>

      <div className={styles.districtList}>
        {districts.map((district) => (
          <div className={styles.districtCard} key={district.name}>
            <div className={styles.districtTopRow}>
              <div>
                <div className={styles.districtName}>{district.name}</div>
                <div className={styles.districtSubtitle}>{district.subtitle}</div>
              </div>
              <div className={district.statusClass}>{district.status}</div>
            </div>
            <div className={styles.propagationLabel}>PROPAGATION <span>{district.progress}%</span></div>
            <div className={styles.progressTrack}><div className={district.barClass} style={{ width: `${district.progress}%` }} /></div>
          </div>
        ))}
      </div>

      <div className={styles.flowCard}>
        <div className={styles.liveFlowPill}><span className={styles.liveDot} /> LIVE FLOW SCAN</div>
        <div className={styles.flowMapBackground} />
        <div className={styles.coordinatesCard}>
          <div className={styles.coordinatesLabel}>CURRENT COORDINATES</div>
          <div className={styles.coordinatesValue}>28.7041° N, 77.1025° E</div>
        </div>
      </div>
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

      <LiveReportPanel />
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
    "About FloodMind",
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
      {activeTab === "map" ? <MapScreen onOpenAnalytics={() => setActiveTab("analytics")} /> : null}
      {activeTab === "analytics" ? <AnalyticsScreen /> : null}
      {activeTab === "report" ? <ReportScreen /> : null}
      {activeTab === "settings" ? <SettingsScreen /> : null}
      <BottomTabBar activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
}
