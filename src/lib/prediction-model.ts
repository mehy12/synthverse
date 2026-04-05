// HiveMind — Cascade Flood Prediction Model
// Exponential risk escalation model calibrated for urban district flood vulnerability
//
// Model type: District-specific exponential risk with cascade multipliers
//
// Formula per district:
//   riskLevel(t) = baseline * exp(-λ * flood_index * t)
//   where λ = district vulnerability coefficient
//         t = days since flood onset
//         flood_index = normalized severity (0-1)
//
// Cascade: when upstream districts flood beyond threshold, downstream
//          districts experience amplified flood risk multipliers.

export interface FloodInput {
  severity: number;        // 1-5 scale
  floodType?: string;      // flash_flood, river_overflow, storm_surge, etc.
  pollutionType?: string;  // backward compat alias for floodType
  surfaceAreaKm2: number;  // estimated affected area
  durationDays: number;    // how long the flooding has been active
}

// Keep backward compat with existing API interface
export type PollutionInput = FloodInput;

export interface SpeciesForecast {
  id: string;
  name: string;
  icon: string;
  baselinePopulation: number;
  day30: number;
  day60: number;
  day90: number;
  status30: "stable" | "declining" | "critical" | "collapsed";
  status60: "stable" | "declining" | "critical" | "collapsed";
  status90: "stable" | "declining" | "critical" | "collapsed";
  economicLoss30: number;
  economicLoss60: number;
  economicLoss90: number;
  recoveryTimeDays: number;
}

export interface PredictionResult {
  forecasts: SpeciesForecast[];
  totalEconomicLoss30: number;
  totalEconomicLoss60: number;
  totalEconomicLoss90: number;
  totalEconomicLoss30Crore: string;
  totalEconomicLoss60Crore: string;
  totalEconomicLoss90Crore: string;
  mostVulnerable: string;
  cascadeChain: string[];
  interventionBenefit: {
    ifNow: string;
    if30Days: string;
    if60Days: string;
  };
}

// District vulnerability coefficients (λ)
// Higher λ = more vulnerable to flooding
const DISTRICT_VULNERABILITY: Record<string, {
  lambda: number;
  name: string;
  icon: string;
  baseline: number;
  threshold: number;
  dailyEconomicValue: number; // INR per day per % infrastructure at risk
  recoveryRate: number; // % per day natural recovery
  floodWeights: Record<string, number>;
  dependencies: string[];
}> = {
  kochi_central: {
    lambda: 0.016,
    name: "Kochi Central",
    icon: "🏙️",
    baseline: 100,
    threshold: 55,
    dailyEconomicValue: 8500,
    recoveryRate: 0.06,
    floodWeights: { flash_flood: 0.75, river_overflow: 0.6, storm_surge: 0.9, drainage_failure: 0.85, dam_release: 0.5, monsoon_surge: 0.7, coastal_erosion: 0.65 },
    dependencies: [],
  },
  edapally: {
    lambda: 0.019,
    name: "Edapally",
    icon: "🏘️",
    baseline: 100,
    threshold: 50,
    dailyEconomicValue: 6200,
    recoveryRate: 0.08,
    floodWeights: { flash_flood: 0.8, river_overflow: 0.7, storm_surge: 0.5, drainage_failure: 0.9, dam_release: 0.6, monsoon_surge: 0.65, coastal_erosion: 0.3 },
    dependencies: ["kochi_central"],
  },
  aluva: {
    lambda: 0.022,
    name: "Aluva",
    icon: "🌊",
    baseline: 100,
    threshold: 40,
    dailyEconomicValue: 3800,
    recoveryRate: 0.1,
    floodWeights: { flash_flood: 0.9, river_overflow: 0.95, storm_surge: 0.3, drainage_failure: 0.6, dam_release: 0.95, monsoon_surge: 0.85, coastal_erosion: 0.2 },
    dependencies: [],
  },
  fort_kochi: {
    lambda: 0.014,
    name: "Fort Kochi",
    icon: "🏛️",
    baseline: 100,
    threshold: 50,
    dailyEconomicValue: 4200,
    recoveryRate: 0.05,
    floodWeights: { flash_flood: 0.6, river_overflow: 0.5, storm_surge: 0.95, drainage_failure: 0.7, dam_release: 0.4, monsoon_surge: 0.8, coastal_erosion: 0.9 },
    dependencies: ["kochi_central"],
  },
  kaloor: {
    lambda: 0.020,
    name: "Kaloor",
    icon: "🏢",
    baseline: 100,
    threshold: 45,
    dailyEconomicValue: 5200,
    recoveryRate: 0.07,
    floodWeights: { flash_flood: 0.85, river_overflow: 0.5, storm_surge: 0.35, drainage_failure: 0.95, dam_release: 0.4, monsoon_surge: 0.55, coastal_erosion: 0.2 },
    dependencies: ["kochi_central", "edapally"],
  },
  mattancherry: {
    lambda: 0.017,
    name: "Mattancherry",
    icon: "⚓",
    baseline: 100,
    threshold: 48,
    dailyEconomicValue: 3500,
    recoveryRate: 0.06,
    floodWeights: { flash_flood: 0.7, river_overflow: 0.6, storm_surge: 0.85, drainage_failure: 0.8, dam_release: 0.35, monsoon_surge: 0.75, coastal_erosion: 0.8 },
    dependencies: ["fort_kochi"],
  },
  thrippunithura: {
    lambda: 0.013,
    name: "Thrippunithura",
    icon: "🏠",
    baseline: 100,
    threshold: 55,
    dailyEconomicValue: 2900,
    recoveryRate: 0.09,
    floodWeights: { flash_flood: 0.65, river_overflow: 0.55, storm_surge: 0.4, drainage_failure: 0.75, dam_release: 0.45, monsoon_surge: 0.6, coastal_erosion: 0.25 },
    dependencies: ["kochi_central"],
  },
  vypeen: {
    lambda: 0.021,
    name: "Vypeen Island",
    icon: "🏝️",
    baseline: 100,
    threshold: 42,
    dailyEconomicValue: 1800,
    recoveryRate: 0.04,
    floodWeights: { flash_flood: 0.5, river_overflow: 0.45, storm_surge: 0.95, drainage_failure: 0.6, dam_release: 0.3, monsoon_surge: 0.85, coastal_erosion: 0.95 },
    dependencies: ["fort_kochi"],
  },
};

function getStatus(pop: number, threshold: number): "stable" | "declining" | "critical" | "collapsed" {
  if (pop >= threshold * 1.2) return "stable";
  if (pop >= threshold) return "declining";
  if (pop >= threshold * 0.5) return "critical";
  return "collapsed";
}

export function predictBiodiversityLoss(input: PollutionInput): PredictionResult {
  const severityIndex = input.severity / 5;
  const areaMultiplier = Math.min(2, Math.log2(input.surfaceAreaKm2 + 1) / 3 + 0.5);
  const durationFactor = Math.min(1.5, 1 + input.durationDays / 60);

  // Phase 1: Direct flood risk escalation for each district
  const populations: Record<string, { day30: number; day60: number; day90: number }> = {};

  for (const [id, spec] of Object.entries(DISTRICT_VULNERABILITY)) {
    const floodKey = input.floodType ?? input.pollutionType ?? "flash_flood";
    const typeWeight = spec.floodWeights[floodKey] ?? 1.0;
    const effectiveLambda = spec.lambda * typeWeight * areaMultiplier * durationFactor;

    populations[id] = {
      day30: spec.baseline * Math.exp(-effectiveLambda * severityIndex * 30),
      day60: spec.baseline * Math.exp(-effectiveLambda * severityIndex * 60),
      day90: spec.baseline * Math.exp(-effectiveLambda * severityIndex * 90),
    };
  }

  // Phase 2: Cascade effects — if upstream districts flood, downstream districts amplified
  const cascadeOrder = [
    "kochi_central", "aluva", "edapally", "fort_kochi",
    "kaloor", "mattancherry", "thrippunithura", "vypeen",
  ];

  for (const timeKey of ["day30", "day60", "day90"] as const) {
    for (const id of cascadeOrder) {
      const spec = DISTRICT_VULNERABILITY[id];
      for (const depId of spec.dependencies) {
        const depSpec = DISTRICT_VULNERABILITY[depId];
        const depPop = populations[depId][timeKey];
        if (depPop < depSpec.threshold) {
          const cascadePenalty = (depSpec.threshold - depPop) / depSpec.threshold;
          populations[id][timeKey] *= (1 - cascadePenalty * 0.4);
        }
      }
      populations[id][timeKey] = Math.max(0, Math.round(populations[id][timeKey] * 10) / 10);
    }
  }

  // Phase 3: Build forecasts
  const forecasts: SpeciesForecast[] = cascadeOrder.map((id) => {
    const spec = DISTRICT_VULNERABILITY[id];
    const pop = populations[id];
    const lossPercent30 = (spec.baseline - pop.day30) / 100;
    const lossPercent60 = (spec.baseline - pop.day60) / 100;
    const lossPercent90 = (spec.baseline - pop.day90) / 100;

    const recoveryDays = pop.day90 <= 0
      ? 9999
      : Math.round((spec.baseline - pop.day90) / (spec.recoveryRate * spec.baseline) * 30);

    return {
      id,
      name: spec.name,
      icon: spec.icon,
      baselinePopulation: spec.baseline,
      day30: pop.day30,
      day60: pop.day60,
      day90: pop.day90,
      status30: getStatus(pop.day30, spec.threshold),
      status60: getStatus(pop.day60, spec.threshold),
      status90: getStatus(pop.day90, spec.threshold),
      economicLoss30: Math.round(spec.dailyEconomicValue * lossPercent30 * 30),
      economicLoss60: Math.round(spec.dailyEconomicValue * lossPercent60 * 60),
      economicLoss90: Math.round(spec.dailyEconomicValue * lossPercent90 * 90),
      recoveryTimeDays: Math.min(recoveryDays, 3650),
    };
  });

  const totalLoss30 = forecasts.reduce((s, f) => s + f.economicLoss30, 0);
  const totalLoss60 = forecasts.reduce((s, f) => s + f.economicLoss60, 0);
  const totalLoss90 = forecasts.reduce((s, f) => s + f.economicLoss90, 0);

  const toCrore = (n: number) => (n / 10000000).toFixed(2);

  const mostVulnerable = forecasts.reduce((a, b) => (b.day90 < a.day90 ? b : a)).name;
  const collapsed90 = forecasts.filter((f) => f.status90 === "collapsed" || f.status90 === "critical").map((f) => f.name);

  return {
    forecasts,
    totalEconomicLoss30: totalLoss30,
    totalEconomicLoss60: totalLoss60,
    totalEconomicLoss90: totalLoss90,
    totalEconomicLoss30Crore: toCrore(totalLoss30),
    totalEconomicLoss60Crore: toCrore(totalLoss60),
    totalEconomicLoss90Crore: toCrore(totalLoss90),
    mostVulnerable,
    cascadeChain: collapsed90,
    interventionBenefit: {
      ifNow: `Recovery in ~${Math.round(totalLoss30 / 100000)} days, ₹${toCrore(totalLoss90 - totalLoss30)} Cr saved`,
      if30Days: `Recovery in ~${Math.round(totalLoss60 / 80000)} days, ₹${toCrore(totalLoss90 - totalLoss60)} Cr saved`,
      if60Days: `Severe damage — recovery may take years, ₹${toCrore(totalLoss90)} Cr total loss`,
    },
  };
}


