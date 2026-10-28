import { Point2 } from '../schemas/building';

export interface Scenario {
  id: string;
  name: string;
  seed: number;
  blockedDoorIds: string[];
  blockedObstacleIds?: string[];
  occupancyMultiplier?: number; // bounded e.g. [0.5, 2.0]
  startDelaySeconds?: number;
}

export interface SimulationConfig {
  cellSizeM: number; // grid resolution, e.g. 0.25m
  dt: number; // timestep in seconds, e.g. 0.25s
  maxTimeSeconds: number; // cap, e.g. 180s
  nominalSpeedMps: number; // average walking speed, e.g. 1.2 m/s
  congestionWaitThresholdSteps: number; // steps stalled to count as bottleneck cell
  sampleIntervalSeconds: number; // recording interval for replay trace, e.g. 0.25s
}

export const DEFAULT_SIM_CONFIG: SimulationConfig = {
  cellSizeM: 0.25,
  dt: 0.25,
  maxTimeSeconds: 240,
  nominalSpeedMps: 1.2,
  congestionWaitThresholdSteps: 4,
  sampleIntervalSeconds: 0.25,
};

export type AgentStatus = 'moving' | 'delayed' | 'exited' | 'unreachable' | 'timed_out';

export interface AgentState {
  id: string;
  roomId: string;
  x: number; // world meters
  y: number; // world meters
  targetExitId: string | null;
  status: AgentStatus;
  exitTimeSeconds: number | null;
  totalDistanceM: number;
  stepsWaiting: number;
}

export interface AgentTracePoint {
  id: string;
  x: number;
  y: number;
  status: AgentStatus;
}

export interface SimulationFrame {
  timeSeconds: number;
  activeCount: number;
  exitedCumulative: number;
  agents: AgentTracePoint[];
}

export interface BottleneckCell {
  gridX: number;
  gridY: number;
  worldX: number;
  worldY: number;
  totalWaitEvents: number;
  doorId?: string;
}

export interface DoorThroughput {
  doorId: string;
  isExit: boolean;
  totalPassed: number;
  flowRatePerSec: number;
}

export interface SimulationMetrics {
  totalSpawned: number;
  exitedCount: number;
  unreachableCount: number;
  timedOutCount: number;
  clearanceTimeSeconds: number | null; // null if not all evacuate
  p50ExitTimeSeconds: number | null;
  p95ExitTimeSeconds: number | null;
  maxQueueLength: number;
  bottleneckCells: BottleneckCell[];
  doorThroughput: DoorThroughput[];
  occupancyOverTime: { timeSeconds: number; remainingCount: number; exitedCumulative: number }[];
  completed: boolean;
  stoppingReason: 'all_exited' | 'all_unreachable_or_exited' | 'time_cap_reached';
  simulatorVersion: string;
}

export interface SimulationResult {
  runId: string;
  buildingId: string;
  scenario: Scenario;
  metrics: SimulationMetrics;
  frames: SimulationFrame[];
  gridBounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    widthCells: number;
    heightCells: number;
    cellSizeM: number;
  };
  congestionGrid: number[][]; // heat map counts per grid cell
}
