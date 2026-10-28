import { Building } from '../schemas/building';
import { SeededPRNG } from './prng';
import { buildNavGrid, GridCell, NavGrid } from './navgrid';
import { computeExitDistanceField, DistanceField } from './pathfinding';
import {
  Scenario,
  SimulationConfig,
  DEFAULT_SIM_CONFIG,
  SimulationResult,
  SimulationMetrics,
  SimulationFrame,
  AgentState,
  BottleneckCell,
  DoorThroughput,
} from './types';

export const SIMULATOR_VERSION = '1.0.0-mvp';

interface InternalAgent {
  id: string;
  roomId: string;
  x: number; // grid x
  y: number; // grid row y
  worldX: number;
  worldY: number;
  targetExitId: string | null;
  status: 'moving' | 'delayed' | 'exited' | 'unreachable' | 'timed_out';
  exitTimeSeconds: number | null;
  totalDistanceM: number;
  stepsWaiting: number;
  startDelayRemaining: number;
}

/**
 * Runs a 100% deterministic, seeded evacuation simulation.
 */
export function runSimulation(
  building: Building,
  scenario: Scenario,
  config: Partial<SimulationConfig> = {}
): SimulationResult {
  const simConfig: SimulationConfig = { ...DEFAULT_SIM_CONFIG, ...config };
  const prng = new SeededPRNG(scenario.seed);

  // 1. Build Navigation Grid with active blocked doors
  const navGrid = buildNavGrid(building, simConfig.cellSizeM, scenario.blockedDoorIds);

  // 2. Compute Exit Distance Field (multi-source Dijkstra)
  const distanceField = computeExitDistanceField(navGrid);

  // 3. Spawn Occupants in Rooms
  const floor = building.floors[0];
  const agents: InternalAgent[] = [];
  const multiplier = Math.min(2.0, Math.max(0.5, scenario.occupancyMultiplier ?? 1.0));
  const startDelaySec = Math.max(0, scenario.startDelaySeconds ?? 0);

  let agentCounter = 1;

  for (const room of floor.rooms) {
    const targetOccupants = Math.round(room.occupants * multiplier);
    if (targetOccupants <= 0) continue;

    const availableCells = navGrid.roomCellsMap.get(room.id) || [];

    for (let i = 0; i < targetOccupants; i++) {
      const agentId = `ag-${room.id}-${agentCounter++}`;

      if (availableCells.length === 0) {
        // No walkable cells in this room at all -> unreachable
        agents.push({
          id: agentId,
          roomId: room.id,
          x: 0,
          y: 0,
          worldX: room.outline[0]?.x ?? 0,
          worldY: room.outline[0]?.y ?? 0,
          targetExitId: null,
          status: 'unreachable',
          exitTimeSeconds: null,
          totalDistanceM: 0,
          stepsWaiting: 0,
          startDelayRemaining: startDelaySec,
        });
        continue;
      }

      // Pick random walkable cell in room
      const chosenCell = availableCells[prng.nextInt(0, availableCells.length - 1)];
      const distToExit = distanceField.distances[chosenCell.y][chosenCell.x];
      const isUnreachable = !isFinite(distToExit);

      agents.push({
        id: agentId,
        roomId: room.id,
        x: chosenCell.x,
        y: chosenCell.y,
        worldX: chosenCell.worldX,
        worldY: chosenCell.worldY,
        targetExitId: null,
        status: isUnreachable ? 'unreachable' : 'moving',
        exitTimeSeconds: null,
        totalDistanceM: 0,
        stepsWaiting: 0,
        startDelayRemaining: startDelaySec,
      });
    }
  }

  // 4. Initialize Tracking State
  const totalSpawned = agents.length;
  let simTime = 0;
  const frames: SimulationFrame[] = [];
  const occupancyOverTime: { timeSeconds: number; remainingCount: number; exitedCumulative: number }[] = [];

  const congestionGrid: number[][] = Array.from({ length: navGrid.rows }, () => Array(navGrid.cols).fill(0));
  const waitGrid: number[][] = Array.from({ length: navGrid.rows }, () => Array(navGrid.cols).fill(0));
  const doorPassageCounts = new Map<string, number>();

  for (const door of floor.doors) {
    doorPassageCounts.set(door.id, 0);
  }

  // Door flow capacity tracker (flow rate = 1.3 persons/m/s)
  const DOOR_FLOW_RATE_PER_METER_PER_SEC = 1.3;
  const doorTokens = new Map<string, number>();
  const doorMap = new Map<string, (typeof floor.doors)[0]>();
  for (const door of floor.doors) {
    doorMap.set(door.id, door);
    // Start with 1.0 token so initial arrival passes without delay
    doorTokens.set(door.id, 1.0);
  }

  // Cell occupancy tracker to enforce local capacity (1 agent per 0.25m cell)
  const MAX_CELL_CAPACITY = 1;
  const cellOccupants = new Map<string, number>();

  const getCellKey = (cx: number, cy: number) => `${cx}:${cy}`;

  // Initial cell population
  for (const agent of agents) {
    if (agent.status === 'moving') {
      const key = getCellKey(agent.x, agent.y);
      cellOccupants.set(key, (cellOccupants.get(key) || 0) + 1);
      congestionGrid[agent.y][agent.x]++;
    }
  }

  let exitedCount = 0;
  let unreachableCount = agents.filter(a => a.status === 'unreachable').length;

  // Record initial frame (t=0)
  frames.push({
    timeSeconds: 0,
    activeCount: totalSpawned - exitedCount - unreachableCount,
    exitedCumulative: 0,
    agents: agents.map(a => ({
      id: a.id,
      x: a.worldX,
      y: a.worldY,
      status: a.status,
    })),
  });

  occupancyOverTime.push({
    timeSeconds: 0,
    remainingCount: totalSpawned - exitedCount - unreachableCount,
    exitedCumulative: 0,
  });

  let maxQueueLength = 0;
  let stoppingReason: 'all_exited' | 'all_unreachable_or_exited' | 'time_cap_reached' = 'time_cap_reached';

  // 5. Main Simulation Loop
  const dt = simConfig.dt;
  const maxSteps = Math.ceil(simConfig.maxTimeSeconds / dt);

  // 8 neighbor offsets for local route adjustments
  const candidateOffsets = [
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: -1 },
  ];

  const cellDoorWaitingFor = new Map<string, string>(); // key -> doorId

  for (let step = 1; step <= maxSteps; step++) {
    simTime = parseFloat((step * dt).toFixed(3));

    // Replenish door flow tokens each timestep based on door width
    for (const door of floor.doors) {
      const current = doorTokens.get(door.id) || 0;
      const added = door.widthM * DOOR_FLOW_RATE_PER_METER_PER_SEC * dt;
      // Cap at 2.0 to allow brief burst but prevent infinite throughput
      doorTokens.set(door.id, Math.min(2.0, current + added));
    }

    // Filter active agents that are moving or delayed
    const activeAgents = agents.filter(a => a.status === 'moving');

    if (activeAgents.length === 0) {
      stoppingReason = exitedCount === totalSpawned ? 'all_exited' : 'all_unreachable_or_exited';
      break;
    }

    // Sort active agents: closest to exit moves first to prevent backward queue blocking
    activeAgents.sort((a, b) => {
      const distA = distanceField.distances[a.y][a.x];
      const distB = distanceField.distances[b.y][b.x];
      return distA - distB;
    });

    let currentStepWaitCount = 0;

    for (const agent of activeAgents) {
      if (agent.startDelayRemaining > 0) {
        agent.startDelayRemaining -= dt;
        continue;
      }

      const currX = agent.x;
      const currY = agent.y;
      const currDist = distanceField.distances[currY][currX];

      // Check if current cell is already an exit!
      const currCell = navGrid.cells[currY][currX];
      if (currCell.isExit) {
        // Evacuated!
        agent.status = 'exited';
        agent.exitTimeSeconds = simTime;
        agent.targetExitId = currCell.exitId || null;
        exitedCount++;

        const currKey = getCellKey(currX, currY);
        const count = cellOccupants.get(currKey) || 1;
        if (count <= 1) cellOccupants.delete(currKey);
        else cellOccupants.set(currKey, count - 1);

        if (currCell.doorId) {
          doorPassageCounts.set(currCell.doorId, (doorPassageCounts.get(currCell.doorId) || 0) + 1);
        }
        continue;
      }

      // Find best next cell that reduces distance to exit and has available capacity
      let bestCell: GridCell | null = null;
      let minDistance = currDist;
      let targetedDoorId: string | undefined = undefined;

      for (const { dx, dy } of candidateOffsets) {
        if (dx === 0 && dy === 0) continue;
        const nx = currX + dx;
        const ny = currY + dy;

        if (nx < 0 || nx >= navGrid.cols || ny < 0 || ny >= navGrid.rows) continue;
        const targetCell = navGrid.cells[ny][nx];
        if (!targetCell.walkable) continue;

        // Diagonal corner check
        if (dx !== 0 && dy !== 0) {
          if (!navGrid.cells[currY][nx].walkable || !navGrid.cells[ny][currX].walkable) continue;
        }

        const candidateDist = distanceField.distances[ny][nx];
        if (candidateDist < minDistance - 1e-4) {
          // Check door throughput capacity if stepping into a door
          if (targetCell.isDoor && targetCell.doorId && !currCell.isDoor) {
            targetedDoorId = targetCell.doorId;
            const availableTokens = doorTokens.get(targetCell.doorId) || 0;
            if (availableTokens < 1.0) {
              // Door capacity reached for this timestep: agent must wait
              continue;
            }
          }

          const occ = cellOccupants.get(getCellKey(nx, ny)) || 0;
          if (occ < MAX_CELL_CAPACITY) {
            minDistance = candidateDist;
            bestCell = targetCell;
          }
        }
      }

      if (bestCell) {
        // If entering a door from outside the door, consume 1.0 throughput token and count passage
        if (bestCell.isDoor && bestCell.doorId && !currCell.isDoor) {
          const tokens = doorTokens.get(bestCell.doorId) || 1.0;
          doorTokens.set(bestCell.doorId, Math.max(0, tokens - 1.0));
          doorPassageCounts.set(bestCell.doorId, (doorPassageCounts.get(bestCell.doorId) || 0) + 1);
        }

        // Move to bestCell
        const oldKey = getCellKey(currX, currY);
        const oldCount = cellOccupants.get(oldKey) || 1;
        if (oldCount <= 1) cellOccupants.delete(oldKey);
        else cellOccupants.set(oldKey, oldCount - 1);

        const newKey = getCellKey(bestCell.x, bestCell.y);
        cellOccupants.set(newKey, (cellOccupants.get(newKey) || 0) + 1);

        agent.x = bestCell.x;
        agent.y = bestCell.y;
        agent.worldX = bestCell.worldX;
        agent.worldY = bestCell.worldY;
        agent.totalDistanceM += simConfig.cellSizeM;
        agent.stepsWaiting = 0;

        congestionGrid[bestCell.y][bestCell.x]++;

        // Check if new cell is exit
        if (bestCell.isExit) {
          agent.status = 'exited';
          agent.exitTimeSeconds = simTime;
          agent.targetExitId = bestCell.exitId || null;
          exitedCount++;

          const c = cellOccupants.get(newKey) || 1;
          if (c <= 1) cellOccupants.delete(newKey);
          else cellOccupants.set(newKey, c - 1);
        }
      } else {
        // Stalled / waiting in queue due to congestion or door flow rate
        agent.stepsWaiting++;
        currentStepWaitCount++;
        waitGrid[currY][currX]++;

        if (targetedDoorId) {
          cellDoorWaitingFor.set(`${currX}:${currY}`, targetedDoorId);
        }
      }
    }

    if (currentStepWaitCount > maxQueueLength) {
      maxQueueLength = currentStepWaitCount;
    }

    // Record frame at sampling intervals or at end
    const shouldRecordFrame = step % Math.round(simConfig.sampleIntervalSeconds / dt) === 0 || step === maxSteps;
    if (shouldRecordFrame) {
      frames.push({
        timeSeconds: simTime,
        activeCount: totalSpawned - exitedCount - unreachableCount,
        exitedCumulative: exitedCount,
        agents: agents.map(a => ({
          id: a.id,
          x: a.worldX,
          y: a.worldY,
          status: a.status,
        })),
      });

      occupancyOverTime.push({
        timeSeconds: simTime,
        remainingCount: totalSpawned - exitedCount - unreachableCount,
        exitedCumulative: exitedCount,
      });
    }
  }

  // 6. Handle any agents still active at max runtime (timed_out)
  let timedOutCount = 0;
  for (const agent of agents) {
    if (agent.status === 'moving' || agent.status === 'delayed') {
      agent.status = 'timed_out';
      timedOutCount++;
    }
  }

  // 7. Calculate Verified Metrics
  const exitedAgents = agents.filter(a => a.status === 'exited' && a.exitTimeSeconds !== null);
  const exitTimes = exitedAgents.map(a => a.exitTimeSeconds!).sort((a, b) => a - b);

  // Clearance time is defined strictly ONLY IF all spawned agents evacuated
  const clearanceTimeSeconds = exitedCount === totalSpawned && totalSpawned > 0 ? (exitTimes[exitTimes.length - 1] ?? 0) : null;

  const p50ExitTimeSeconds =
    exitTimes.length > 0 ? exitTimes[Math.floor(exitTimes.length * 0.5)] : null;
  const p95ExitTimeSeconds =
    exitTimes.length > 0 ? exitTimes[Math.min(exitTimes.length - 1, Math.floor(exitTimes.length * 0.95))] : null;

  // Identify Bottleneck Cells (cells with frequent stall events)
  const bottleneckCells: BottleneckCell[] = [];
  for (let y = 0; y < navGrid.rows; y++) {
    for (let x = 0; x < navGrid.cols; x++) {
      const waits = waitGrid[y][x];
      if (waits >= simConfig.congestionWaitThresholdSteps) {
        const cell = navGrid.cells[y][x];
        const associatedDoor = cellDoorWaitingFor.get(`${x}:${y}`) || cell.doorId;
        bottleneckCells.push({
          gridX: x,
          gridY: y,
          worldX: cell.worldX,
          worldY: cell.worldY,
          totalWaitEvents: waits,
          doorId: associatedDoor,
        });
      }
    }
  }

  // Sort bottlenecks by most congested
  bottleneckCells.sort((a, b) => b.totalWaitEvents - a.totalWaitEvents);

  // Door Throughputs
  const doorThroughput: DoorThroughput[] = floor.doors.map(door => {
    const totalPassed = doorPassageCounts.get(door.id) || 0;
    const effectiveTime = clearanceTimeSeconds || simTime || 1;
    return {
      doorId: door.id,
      isExit: door.kind === 'exit',
      totalPassed,
      flowRatePerSec: parseFloat((totalPassed / effectiveTime).toFixed(2)),
    };
  });

  const metrics: SimulationMetrics = {
    totalSpawned,
    exitedCount,
    unreachableCount,
    timedOutCount,
    clearanceTimeSeconds,
    p50ExitTimeSeconds,
    p95ExitTimeSeconds,
    maxQueueLength,
    bottleneckCells,
    doorThroughput,
    occupancyOverTime,
    completed: stoppingReason !== 'time_cap_reached',
    stoppingReason,
    simulatorVersion: SIMULATOR_VERSION,
  };

  const runId = `run-${Date.now().toString(36)}-${scenario.id}`;

  return {
    runId,
    buildingId: building.id,
    scenario,
    metrics,
    frames,
    gridBounds: {
      minX: navGrid.minX,
      minY: navGrid.minY,
      maxX: navGrid.maxX,
      maxY: navGrid.maxY,
      widthCells: navGrid.cols,
      heightCells: navGrid.rows,
      cellSizeM: navGrid.cellSizeM,
    },
    congestionGrid,
  };
}
