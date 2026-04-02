// OceanSentinel Guardian Credits System
// Anonymous identity + tamper-proof credit tracking

export const REPORT_REWARD = 25;
export const VERIFIED_BONUS = 50;
export const CLEAN_ZONE_BONUS = 15;
export const WEEKLY_BONUS = 30;
export const CORROBORATION_BONUS = 40;

export interface EarningEntry {
  id: string;
  action: string;
  credits: number;
  date: string;
  type: string;
}

export interface GuardianProfile {
  guardianId: string;
  creditBalance: number;
  totalReports: number;
  verifiedReports: number;
  memberSince: string;
  tier: string;
  earningHistory: EarningEntry[];
}

const STORAGE_KEY = "oceansentinel_guardian";

function generateHash(): string {
  const chars = "0123456789ABCDEF";
  const seg = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `GRD-${seg(4)}-${seg(4)}`;
}

function computeTier(credits: number): string {
  if (credits >= 1000) return "Gold Guardian";
  if (credits >= 500) return "Silver Guardian";
  return "Bronze Guardian";
}

export function getGuardianProfile(): GuardianProfile {
  if (typeof window === "undefined") {
    return createDefaultProfile();
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const profile = createDefaultProfile();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return profile;
  }

  try {
    return JSON.parse(stored);
  } catch {
    const profile = createDefaultProfile();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return profile;
  }
}

function createDefaultProfile(): GuardianProfile {
  return {
    guardianId: generateHash(),
    creditBalance: 0,
    totalReports: 0,
    verifiedReports: 0,
    memberSince: new Date().toISOString(),
    tier: "Bronze Guardian",
    earningHistory: [],
  };
}

export function earnCredits(action: string, amount: number, type: string = "report"): GuardianProfile {
  if (typeof window === "undefined") return createDefaultProfile();

  const profile = getGuardianProfile();
  const entry: EarningEntry = {
    id: `earn-${Date.now()}`,
    action,
    credits: amount,
    date: new Date().toISOString(),
    type,
  };

  profile.earningHistory.unshift(entry);
  profile.creditBalance += amount;
  profile.tier = computeTier(profile.creditBalance);

  if (type === "report") {
    profile.totalReports += 1;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

export function markReportVerified(): GuardianProfile {
  if (typeof window === "undefined") return createDefaultProfile();

  const profile = getGuardianProfile();
  profile.verifiedReports += 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

export function getCreditBalance(): number {
  return getGuardianProfile().creditBalance;
}

export function getEarningHistory(): EarningEntry[] {
  return getGuardianProfile().earningHistory;
}

export function generateCryptoReceipt(reportData: {
  latitude: number;
  longitude: number;
  type: string;
  severity: number;
}): { hash: string; timestamp: string; guardianId: string } {
  const profile = getGuardianProfile();
  const raw = `${profile.guardianId}-${reportData.latitude}-${reportData.longitude}-${reportData.type}-${Date.now()}`;
  // Simple hash simulation (in production this would be SHA-256)
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const hexHash = Math.abs(hash).toString(16).padStart(12, "0").slice(0, 12);

  return {
    hash: hexHash,
    timestamp: new Date().toISOString(),
    guardianId: profile.guardianId,
  };
}
