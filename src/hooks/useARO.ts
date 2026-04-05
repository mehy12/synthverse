/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { agentStore, BASES, ResponseUnit, AgentStatus } from "../store/agent-store";
import { interpolatePosition, getRotationAngle, ResponseTarget } from "../lib/response-orchestrator";

/**
 * ARO HOOK: Orchestrates the real-time simulation and animation of 13 agents
 */

export function useARO(isPlaying: boolean, targets: ResponseTarget[]) {
  const workerRef = useRef<Worker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const [isWorkerReady, setIsWorkerReady] = useState(false);

  // Initialize Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL("../workers/aro.worker.ts", import.meta.url));
    workerRef.current.onmessage = (e) => {
      if (e.data.type === "PLAN_UPDATED") {
        agentStore.setAgents(e.data.agents);
      }
    };
    setIsWorkerReady(true);
    return () => workerRef.current?.terminate();
  }, []);

  // Simulation Loop (60fps)
  const animate = useCallback((time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const deltaTime = (time - lastTimeRef.current) / 1000; // seconds
    lastTimeRef.current = time;

    if (isPlaying) {
      const agents = agentStore.getSnapshot();
      let updated = false;

      const newAgents = agents.map((agent) => {
        if (!agent.path || agent.path.length === 0 || agent.status === "idle") return agent;

        updated = true;
        
        // 1. Calculate travel distance this frame
        const distanceKm = (agent.speed * deltaTime) / 3600; // Speed in km/h -> km/s * dt
        // Approx deg to km conversion (1 deg ~ 111km)
        const distanceDeg = distanceKm / 111; 

        // 2. Interpolate position along current segment
        const p1 = agent.path[agent.pathIndex];
        const p2 = agent.path[agent.pathIndex + 1];

        if (!p2) {
          // Reached end of path
          const nextStatus: AgentStatus = agent.status === "en_route" ? "rescuing" : "idle";
          if (nextStatus === "rescuing") {
             // Simulate rescue time before returning
            return { ...agent, status: nextStatus, path: [], eta: 0, pathIndex: 0 };
          }
          return { ...agent, status: nextStatus, path: [], eta: 0, pathIndex: 0 };
        }

        const segmentDist = Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
        const newPos = interpolatePosition(agent.path, agent.pathIndex, Math.min(1, distanceDeg / (segmentDist || 1)));
        const angle = getRotationAngle(agent.position, newPos);

        // Advance index if we overshot segment
        let nextIndex = agent.pathIndex;
        if (distanceDeg >= segmentDist) nextIndex++;

        return {
          ...agent,
          position: newPos,
          pathIndex: nextIndex,
          angle: angle || agent.angle,
        };
      });

      if (updated) agentStore.setAgents(newAgents);
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [isPlaying]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => {
       if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [animate]);

  // Handle re-planning when targets change
  useEffect(() => {
     if (isWorkerReady && targets.length > 0) {
        workerRef.current?.postMessage({
           type: "REPLAN",
           agents: agentStore.getSnapshot(),
           targets,
           bases: BASES
        });
     }
  }, [targets, isWorkerReady]);

  return { agents: agentStore.getSnapshot(), bases: BASES };
}
