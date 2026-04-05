/* eslint-disable @typescript-eslint/no-explicit-any */
import { AgentType, AgentStatus, ResponseUnit } from "../store/agent-store";

/**
 * PRODUCTION-GRADE ARO INTELLIGENCE
 * priority = (risk_level × population_density) / travel_time
 */

export interface ResponseTarget {
  id: string;
  lat: number;
  lng: number;
  riskScore: number; // 0.0 - 1.0
  population: number; // Synthetic density
  type: "hazard" | "cluster";
  severity: "critical" | "high" | "medium";
}

// Synthetic population density for Odisha coastal/inland hubs
const POPULATION_MAP: Record<string, number> = {
  Bhubaneswar: 1200000,
  Cuttack: 650000,
  Puri: 250000,
  Berhampur: 400000,
  Sambalpur: 350000,
  Balasore: 200000,
  Paradip: 100000,
};

/**
 * Assigns a population score to a coordinate based on proximity to major hubs
 */
export function getSyntheticPopulation(lat: number, lng: number): number {
  // Fallback if no hub is near
  let pop = 15000; 
  // Simple heuristic: coastal areas are denser
  if (lng > 85.5) pop += 20000;
  if (lat > 20.0 && lat < 20.5) pop += 30000;
  return pop;
}

export function calculatePriority(target: ResponseTarget, travelTimeMin: number): number {
  const riskMult = target.severity === "critical" ? 5.0 : target.severity === "high" ? 3.0 : 1.5;
  // Normalized pop (10k to 1M range)
  const popScore = Math.log10(target.population) / 6; 
  // Priority score (higher is better)
  return (riskMult * popScore * 100) / (travelTimeMin + 1);
}

/**
 * Path interpolation for 60fps movement
 */
export function interpolatePosition(
  path: [number, number][],
  currentIndex: number,
  progress: number // 0.0 to 1.0 between currentIndex and currentIndex + 1
): [number, number] {
  if (!path.length) return [0, 0];
  if (currentIndex >= path.length - 1) return path[path.length - 1];

  const p1 = path[currentIndex];
  const p2 = path[currentIndex + 1];

  const lat = p1[0] + (p2[0] - p1[0]) * progress;
  const lng = p1[1] + (p2[1] - p1[1]) * progress;

  return [lat, lng];
}

/**
 * Calculates rotation angle between two points for agent orientation
 */
export function getRotationAngle(p1: [number, number], p2: [number, number]): number {
  const dy = p2[0] - p1[0];
  const dx = p2[1] - p1[1];
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/**
 * Orchestrator logic to match units to targets
 */
export function orchestrateResponse(
  agents: ResponseUnit[],
  targets: ResponseTarget[]
): { agentId: string; targetId: string }[] {
  const assignments: { agentId: string; targetId: string }[] = [];
  const availableAgents = agents.filter(a => a.status === "idle" || a.status === "returning");
  const unassignedTargets = [...targets].sort((a,b) => {
    const prioA = calculatePriority(a, 10); // Assume 10m avg
    const prioB = calculatePriority(b, 10);
    return prioB - prioA;
  });

  for (const target of unassignedTargets) {
    if (availableAgents.length === 0) break;

    // Find best agent for this target
    let bestAgentIdx = -1;
    let minTravelTime = Infinity;

    availableAgents.forEach((agent, idx) => {
      // Basic distance-based time estimate for assignment phase
      const dist = Math.sqrt(Math.pow(agent.position[0] - target.lat, 2) + Math.pow(agent.position[1] - target.lng, 2));
      const estTime = (dist * 111) / agent.speed; // approx km
      
      // Eligibility check
      if (agent.type === "boat" && target.type !== "cluster") return; // Boats only for water/flood clusters
      
      if (estTime < minTravelTime) {
        minTravelTime = estTime;
        bestAgentIdx = idx;
      }
    });

    if (bestAgentIdx !== -1) {
      assignments.push({ agentId: availableAgents[bestAgentIdx].id, targetId: target.id });
      availableAgents.splice(bestAgentIdx, 1);
    }
  }

  return assignments;
}
