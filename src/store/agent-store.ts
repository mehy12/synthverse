/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

export type AgentType = "ambulance" | "boat" | "repair";
export type AgentStatus = "idle" | "en_route" | "rescuing" | "returning";

export interface ResponseUnit {
  id: string;
  type: AgentType;
  position: [number, number];
  status: AgentStatus;
  targetClusterId?: string;
  path: [number, number][]; 
  pathIndex: number;
  eta: number; // seconds
  speed: number; // km/h
  baseId: string;
  angle: number; // For rotation on map
}

export interface ResponseBase {
  id: string;
  name: string;
  position: [number, number];
  type: "permanent" | "forward";
}

const STRATEGIC_BASES: ResponseBase[] = [
  { id: "base-bbsr", name: "Bhubaneswar Central Hub", position: [20.2961, 85.8245], type: "permanent" },
  { id: "base-ctc", name: "Cuttack North Base", position: [20.4625, 85.8830], type: "permanent" },
  { id: "base-puri", name: "Puri Coastal Response", position: [19.8135, 85.8312], type: "permanent" },
  { id: "base-bam", name: "Berhampur Southern Command", position: [19.3150, 84.7941], type: "permanent" },
  { id: "base-sbp", name: "Sambalpur Western Base", position: [21.4669, 83.9812], type: "permanent" },
];

// Initial 13 agents distributed among bases
const INITIAL_AGENTS: ResponseUnit[] = [
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `A${i + 1}`,
    type: "ambulance" as AgentType,
    position: STRATEGIC_BASES[i % 5].position,
    status: "idle" as AgentStatus,
    path: [],
    pathIndex: 0,
    eta: 0,
    speed: 60,
    baseId: STRATEGIC_BASES[i % 5].id,
    angle: 0,
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `B${i + 1}`,
    type: "boat" as AgentType,
    position: STRATEGIC_BASES[i % 5].position,
    status: "idle" as AgentStatus,
    path: [],
    pathIndex: 0,
    eta: 0,
    speed: 40,
    baseId: STRATEGIC_BASES[i % 5].id,
    angle: 0,
  })),
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `R${i + 1}`,
    type: "repair" as AgentType,
    position: STRATEGIC_BASES[i % 5].position,
    status: "idle" as AgentStatus,
    path: [],
    pathIndex: 0,
    eta: 0,
    speed: 35,
    baseId: STRATEGIC_BASES[i % 5].id,
    angle: 0,
  })),
];

class AgentStore {
  private agents: ResponseUnit[] = INITIAL_AGENTS;
  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return this.agents;
  }

  updateAgent(id: string, updates: Partial<ResponseUnit>) {
    this.agents = this.agents.map((a) => (a.id === id ? { ...a, ...updates } : a));
    this.notify();
  }

  setAgents(newAgents: ResponseUnit[]) {
    this.agents = newAgents;
    this.notify();
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

export const agentStore = new AgentStore();
export const BASES = STRATEGIC_BASES;
