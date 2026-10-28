import { Building } from '../schemas/building';
import { runSimulation } from '../simulation/engine';
import { Scenario, SimulationResult, SimulationMetrics } from '../simulation/types';

export interface BuildingSummary {
  buildingId: string;
  name: string;
  totalOccupants: number;
  roomsCount: number;
  rooms: { id: string; name: string; occupants: number }[];
  doorsCount: number;
  doors: { id: string; wallId: string; widthM: number; kind: string; connectsRoomIds?: string[] }[];
  exitsCount: number;
  exits: { id: string; doorId: string }[];
  assumptions: string[];
}

export interface RunComparison {
  baselineRunId: string;
  candidateRunId: string;
  scenarioName: string;
  exitedDelta: number;
  unreachableDelta: number;
  clearanceTimeDeltaSeconds: number | null;
  maxQueueDelta: number;
  distinctBottlenecks: number;
  impactScore: number; // 0 to 100 severity rating based on evacuation degradation
}

/**
 * Tool 1: getBuildingSummary
 * Returns structured summary of building topology, exits, and rooms.
 */
export function getBuildingSummary(building: Building): BuildingSummary {
  const floor = building.floors[0];
  const totalOccupants = floor.rooms.reduce((acc, r) => acc + r.occupants, 0);

  return {
    buildingId: building.id,
    name: building.name,
    totalOccupants,
    roomsCount: floor.rooms.length,
    rooms: floor.rooms.map(r => ({ id: r.id, name: r.name, occupants: r.occupants })),
    doorsCount: floor.doors.length,
    doors: floor.doors.map(d => ({ id: d.id, wallId: d.wallId, widthM: d.widthM, kind: d.kind, connectsRoomIds: d.connectsRoomIds })),
    exitsCount: floor.exits.length,
    exits: floor.exits.map(e => ({ id: e.id, doorId: e.doorId })),
    assumptions: [
      'Single-floor 2D grid-discretized movement with 0.25m cell resolution',
      'Nominal walking speed 1.2 m/s',
      'Doorway flow capacity limited to 1.3 persons/meter/sec',
      'Seeded deterministic routing towards nearest accessible exit',
      'Exploratory simulation for planning; not a certified fire safety compliance tool',
    ],
  };
}

/**
 * Tool 2: validateAndProposeScenario
 * Ensures all blocked door IDs exist in the building and constraints are respected.
 */
export function validateScenario(
  building: Building,
  candidate: Partial<Scenario> & { id: string; name: string }
): { valid: boolean; error?: string; scenario?: Scenario } {
  const floor = building.floors[0];
  const validDoorIds = new Set(floor.doors.map(d => d.id));

  const blocked = candidate.blockedDoorIds || [];
  for (const doorId of blocked) {
    if (!validDoorIds.has(doorId)) {
      return {
        valid: false,
        error: `Invalid scenario: Door "${doorId}" does not exist in building "${building.id}"`,
      };
    }
  }

  // Check budget: cannot block all doors if more than 1 door exists
  if (blocked.length > 0 && blocked.length >= floor.doors.length) {
    return {
      valid: false,
      error: `Invalid scenario: Cannot block every door simultaneously (budget exceeded)`,
    };
  }

  const multiplier = Math.min(2.0, Math.max(0.5, candidate.occupancyMultiplier ?? 1.0));
  const seed = candidate.seed ?? Math.floor(Math.random() * 100000);

  const scenario: Scenario = {
    id: candidate.id,
    name: candidate.name,
    seed,
    blockedDoorIds: blocked,
    blockedObstacleIds: candidate.blockedObstacleIds || [],
    occupancyMultiplier: multiplier,
    startDelaySeconds: candidate.startDelaySeconds || 0,
  };

  return { valid: true, scenario };
}

/**
 * Tool 3: executeScenario
 * Runs the deterministic simulation and returns metrics.
 */
export function executeScenario(building: Building, scenario: Scenario): SimulationResult {
  return runSimulation(building, scenario);
}

/**
 * Tool 4: compareRuns
 * Deterministic calculation of metric deltas between baseline and candidate stress runs.
 */
export function compareRuns(baseline: SimulationResult, candidate: SimulationResult): RunComparison {
  const baseM = baseline.metrics;
  const candM = candidate.metrics;

  const exitedDelta = candM.exitedCount - baseM.exitedCount;
  const unreachableDelta = candM.unreachableCount - baseM.unreachableCount;

  let clearanceTimeDeltaSeconds: number | null = null;
  if (candM.clearanceTimeSeconds !== null && baseM.clearanceTimeSeconds !== null) {
    clearanceTimeDeltaSeconds = parseFloat((candM.clearanceTimeSeconds - baseM.clearanceTimeSeconds).toFixed(2));
  }

  const maxQueueDelta = candM.maxQueueLength - baseM.maxQueueLength;
  const distinctBottlenecks = candM.bottleneckCells.length;

  // Impact severity score calculation (0 to 100)
  let severity = 0;
  if (unreachableDelta > 0) {
    severity += Math.min(60, (unreachableDelta / baseM.totalSpawned) * 100);
  }
  if (clearanceTimeDeltaSeconds !== null && clearanceTimeDeltaSeconds > 0 && baseM.clearanceTimeSeconds) {
    const delayPct = (clearanceTimeDeltaSeconds / baseM.clearanceTimeSeconds) * 100;
    severity += Math.min(30, delayPct * 0.5);
  }
  if (maxQueueDelta > 0) {
    severity += Math.min(10, maxQueueDelta * 2);
  }

  const impactScore = Math.min(100, Math.max(0, Math.round(severity)));

  return {
    baselineRunId: baseline.runId,
    candidateRunId: candidate.runId,
    scenarioName: candidate.scenario.name,
    exitedDelta,
    unreachableDelta,
    clearanceTimeDeltaSeconds,
    maxQueueDelta,
    distinctBottlenecks,
    impactScore,
  };
}

/**
 * Tool 5: getCongestionHotspots
 */
export function getCongestionHotspots(run: SimulationResult) {
  return {
    runId: run.runId,
    scenarioId: run.scenario.id,
    bottleneckCount: run.metrics.bottleneckCells.length,
    topHotspots: run.metrics.bottleneckCells.slice(0, 5),
    maxQueueLength: run.metrics.maxQueueLength,
  };
}
