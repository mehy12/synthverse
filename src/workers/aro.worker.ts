/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ARO WORKER: Off-main-thread disaster response simulation
 */

import { orchestrateResponse, ResponseTarget } from "../lib/response-orchestrator";
import { ResponseUnit, ResponseBase } from "../store/agent-store";

const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";

async function fetchRoute(from: [number, number], to: [number, number]): Promise<any> {
  const url = `${OSRM_BASE_URL}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.routes?.[0] || null;
  } catch {
    return null;
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { type, agents, targets, bases } = e.data;

  if (type === "REPLAN") {
    // 1. Calculate best assignments
    const assignments = orchestrateResponse(agents, targets);
    
    // 2. Fetch routes for new assignments in parallel
    const updatedAgents = [...agents];
    
    const assignmentPromises = assignments.map(async ({ agentId, targetId }) => {
      const agentIdx = updatedAgents.findIndex(a => a.id === agentId);
      const target = targets.find((t: ResponseTarget) => t.id === targetId);
      
      if (agentIdx !== -1 && target) {
        const route = await fetchRoute(updatedAgents[agentIdx].position, [target.lat, target.lng]);
        
        if (route) {
          const path = route.geometry.coordinates.map((c: any) => [c[1], c[0]]);
          updatedAgents[agentIdx] = {
            ...updatedAgents[agentIdx],
            status: "en_route",
            targetClusterId: targetId,
            path,
            pathIndex: 0,
            eta: route.duration,
          };
        }
      }
    });

    await Promise.all(assignmentPromises);

    // 3. Return to base if idle or returning
    const returnPromises = updatedAgents.map(async (agent, idx) => {
      if (agent.status === "returning" && !agent.path.length) {
        const base = (bases as ResponseBase[]).find(b => b.id === agent.baseId);
        if (base) {
          const route = await fetchRoute(agent.position, base.position);
          if (route) {
             const path = route.geometry.coordinates.map((c: any) => [c[1], c[0]]);
             updatedAgents[idx] = { ...agent, path, pathIndex: 0, eta: route.duration };
          }
        }
      }
    });

    await Promise.all(returnPromises);

    self.postMessage({ type: "PLAN_UPDATED", agents: updatedAgents });
  }
};
