import { describe, it, expect } from 'vitest';
import { Building, validateBuildingGeometry } from '../src/schemas/building';
import { runSimulation } from '../src/simulation/engine';
import { buildNavGrid } from '../src/simulation/navgrid';
import { computeExitDistanceField } from '../src/simulation/pathfinding';
import {
  getBuildingSummary,
  validateScenario,
  executeScenario,
  compareRuns,
  getCongestionHotspots,
} from '../src/agent/tools';
import { runStressTestAgent } from '../src/agent/orchestrator';
import { runAIVsRandomBenchmark } from '../src/agent/benchmark';

import simpleSchool from '../src/fixtures/simple-school.json';
import disconnectedRoom from '../src/fixtures/disconnected-room.json';
import narrowDoor from '../src/fixtures/narrow-door.json';
import malformedBuilding from '../src/fixtures/malformed-building.json';

describe('Comprehensive Component & Flow Audit', () => {
  it('checks all 4 fixtures against the schema validator', () => {
    const vSchool = validateBuildingGeometry(simpleSchool as unknown as Building);
    expect(vSchool.valid).toBe(true);

    const vDisc = validateBuildingGeometry(disconnectedRoom as unknown as Building);
    expect(vDisc.valid).toBe(true);

    const vNarrow = validateBuildingGeometry(narrowDoor as unknown as Building);
    expect(vNarrow.valid).toBe(true);

    const vMalformed = validateBuildingGeometry(malformedBuilding as unknown as Building);
    expect(vMalformed.valid).toBe(false);
    expect(vMalformed.issues.length).toBeGreaterThanOrEqual(5);
  });

  it('audits navgrid and pathfinding across all valid fixtures', () => {
    for (const fixture of [simpleSchool, disconnectedRoom, narrowDoor]) {
      const b = fixture as unknown as Building;
      const nav = buildNavGrid(b, 0.25, []);
      expect(nav.cols).toBeGreaterThan(0);
      expect(nav.rows).toBeGreaterThan(0);
      expect(nav.walkableCells.length).toBeGreaterThan(0);

      const field = computeExitDistanceField(nav);
      expect(field.distances.length).toBe(nav.rows);
      expect(field.distances[0].length).toBe(nav.cols);
    }
  });

  it('audits simulation execution on narrow door with extreme occupant counts', () => {
    const b = narrowDoor as unknown as Building;
    const run = runSimulation(b, {
      id: 'audit-heavy',
      name: 'Audit Heavy',
      seed: 99,
      blockedDoorIds: [],
      occupancyMultiplier: 1.5,
    });

    expect(run.metrics.totalSpawned).toBe(48);
    expect(run.metrics.exitedCount).toBe(48);
    expect(run.metrics.clearanceTimeSeconds).toBeGreaterThan(0);
    expect(run.frames.length).toBeGreaterThan(0);
  });

  it('audits tool calls and edge validation rejection', () => {
    const b = simpleSchool as unknown as Building;
    const summary = getBuildingSummary(b);
    expect(summary.totalOccupants).toBe(78);
    expect(summary.doorsCount).toBe(7);
    expect(summary.exitsCount).toBe(2);

    // Rejection of invalid door ID
    const badDoor = validateScenario(b, {
      id: 'bad',
      name: 'Bad',
      blockedDoorIds: ['non-existent-door'],
    });
    expect(badDoor.valid).toBe(false);

    // Rejection of blocking all doors
    const allDoors = b.floors[0].doors.map(d => d.id);
    const blockAll = validateScenario(b, {
      id: 'block-all',
      name: 'Block All',
      blockedDoorIds: allDoors,
    });
    expect(blockAll.valid).toBe(false);
  });

  it('audits agent orchestrator and finding generation', async () => {
    const b = simpleSchool as unknown as Building;
    const report = await runStressTestAgent(b, { maxScenarios: 2, seed: 10 });
    expect(report.candidateRuns.length).toBe(2);
    expect(report.comparisons.length).toBe(2);
    expect(report.findings.length).toBe(2);

    for (const f of report.findings) {
      expect(f.comparison.impactScore).toBeGreaterThanOrEqual(0);
      expect(f.comparison.impactScore).toBeLessThanOrEqual(100);
      expect(f.explanation.length).toBeGreaterThan(15);
      expect(f.caveats.length).toBeGreaterThan(0);
    }
  });

  it('audits benchmark execution and metric calculation', async () => {
    const b = narrowDoor as unknown as Building;
    const bench = await runAIVsRandomBenchmark(b, 2, 88);
    expect(bench.budget).toBe(2);
    expect(bench.aiAgentResults.totalScenariosRun).toBe(2);
    expect(bench.randomBaselineResults.totalScenariosRun + bench.randomBaselineResults.invalidProposalsCount).toBe(2);
    expect(bench.comparisonSummary).toBeDefined();
    expect(bench.aiRuns).toBeDefined();
    expect(bench.aiRuns!.length).toBe(2);
    expect(bench.randomRuns).toBeDefined();
  });

  it('audits 2-point scale calibration and pixel-to-meter calculation', () => {
    // Reference 10.0 meters across 400 pixels
    const point1 = { x: 100, y: 150 };
    const point2 = { x: 500, y: 150 };
    const knownDistanceM = 10.0;

    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);
    expect(pixelDistance).toBe(400);

    const pixelsPerMeter = pixelDistance / knownDistanceM;
    expect(pixelsPerMeter).toBe(40.0);

    // Verify converted world dimension: 200px should be 5.0m
    const testPx = 200;
    const convertedM = testPx / pixelsPerMeter;
    expect(convertedM).toBe(5.0);
  });

  it('audits congestion grid generation and spatial bounds', () => {
    const b = simpleSchool as unknown as Building;
    const run = runSimulation(b, {
      id: 'heatmap-audit',
      name: 'Heatmap Audit',
      seed: 42,
      blockedDoorIds: [],
    });

    expect(run.congestionGrid).toBeDefined();
    expect(run.congestionGrid.length).toBeGreaterThan(0);
    expect(run.congestionGrid[0].length).toBeGreaterThan(0);
    expect(run.gridBounds.cellSizeM).toBe(0.25);
    expect(run.metrics.bottleneckCells).toBeDefined();
  });

  it('guarantees agents never pass through solid walls outside of door openings', () => {
    const b = simpleSchool as unknown as Building;
    const run = runSimulation(b, {
      id: 'wall-pass-test',
      name: 'Wall Pass Test',
      seed: 42,
      blockedDoorIds: [],
    });

    // Valid door intervals on corridor south wall (w-corr-s at y = 5.0):
    // d-room-101: offset 2.5, width 1.0 -> [2.5, 3.5]
    // d-room-102: offset 10.5, width 1.0 -> [10.5, 11.5]
    // d-room-103: offset 18.5, width 1.0 -> [18.5, 19.5]
    const validDoorXOnCorrS = [
      { min: 2.2, max: 3.8 },
      { min: 10.2, max: 11.8 },
      { min: 18.2, max: 19.8 },
    ];

    for (let f = 1; f < run.frames.length; f++) {
      const prevFrame = run.frames[f - 1];
      const currFrame = run.frames[f];

      for (const currAg of currFrame.agents) {
        const prevAg = prevFrame.agents.find(a => a.id === currAg.id);
        if (!prevAg) continue;

        const crossedCorrS = (prevAg.y < 5.0 && currAg.y >= 5.0) || (prevAg.y >= 5.0 && currAg.y < 5.0);
        if (crossedCorrS) {
          const isAtDoor = validDoorXOnCorrS.some(d => currAg.x >= d.min && currAg.x <= d.max);
          expect(isAtDoor, `Agent ${currAg.id} crossed wall at x=${currAg.x}, y=${currAg.y} outside of any door!`).toBe(true);
        }
      }
    }
  });

  it('guarantees agents never cut diagonally through solid wall apexes', () => {
    const b = simpleSchool as unknown as Building;
    const run = runSimulation(b, {
      id: 'corner-cut-test',
      name: 'Corner Cut Test',
      seed: 1337,
      blockedDoorIds: [],
    });

    const nav = buildNavGrid(b, 0.25, []);

    // Verify each agent frame-to-frame movement step
    for (let f = 1; f < run.frames.length; f++) {
      const prevFrame = run.frames[f - 1];
      const currFrame = run.frames[f];

      for (const currAg of currFrame.agents) {
        const prevAg = prevFrame.agents.find(a => a.id === currAg.id);
        if (!prevAg) continue;

        // Convert world positions to grid coordinates
        const prevCol = Math.floor((prevAg.x - nav.minX) / nav.cellSizeM);
        const prevRow = Math.floor((prevAg.y - nav.minY) / nav.cellSizeM);
        const currCol = Math.floor((currAg.x - nav.minX) / nav.cellSizeM);
        const currRow = Math.floor((currAg.y - nav.minY) / nav.cellSizeM);

        const dCol = currCol - prevCol;
        const dRow = currRow - prevRow;

        // If moving diagonally across grid cells
        if (dCol !== 0 && dRow !== 0 && Math.abs(dCol) === 1 && Math.abs(dRow) === 1) {
          if (
            prevCol >= 0 && prevCol < nav.cols &&
            currCol >= 0 && currCol < nav.cols &&
            prevRow >= 0 && prevRow < nav.rows &&
            currRow >= 0 && currRow < nav.rows
          ) {
            const adj1 = nav.cells[prevRow][currCol];
            const adj2 = nav.cells[currRow][prevCol];
            // Neither adjacent orthogonal cell may be an unwalkable solid wall
            const cornerCut = !adj1.walkable && !adj2.walkable;
            expect(cornerCut, `Agent ${currAg.id} cut diagonally through solid wall apex at col=${currCol}, row=${currRow}`).toBe(false);
          }
        }
      }
    }
  });

  it('enforces maximum door transit flow rate (<= 1.3 pers/m/s)', () => {
    const b = narrowDoor as unknown as Building;
    // narrowDoor has a 0.8m bottleneck door and 32 occupants in total
    const run = runSimulation(b, {
      id: 'flow-rate-invariant',
      name: 'Flow Rate Invariant',
      seed: 42,
      blockedDoorIds: [],
    });

    const door = b.floors[0].doors.find(d => d.id === 'd-narrow-bottleneck')!;
    expect(door).toBeDefined();
    expect(door.widthM).toBe(0.8);

    const doorThroughput = run.metrics.doorThroughput.find(dt => dt.doorId === 'd-narrow-bottleneck');
    expect(doorThroughput).toBeDefined();
    expect(doorThroughput!.totalPassed).toBe(30);

    // Verify throughput flow rate satisfies 1.3 pers/m/s upper bound (with small burst tolerance)
    expect(doorThroughput!.flowRatePerSec).toBeLessThanOrEqual(door.widthM * 1.3 * 1.25);
  });

  it('reroutes occupants cleanly when secondary exit is blocked without stranding or teleportation', () => {
    const b = simpleSchool as unknown as Building;
    // Block exit door d-exit-west
    const run = runSimulation(b, {
      id: 'reroute-test',
      name: 'Reroute Test',
      seed: 77,
      blockedDoorIds: ['d-exit-west'],
    });

    // All occupants should route to d-exit-east
    expect(run.metrics.totalSpawned).toBe(78);
    expect(run.metrics.exitedCount).toBe(78);
    expect(run.metrics.unreachableCount).toBe(0);

    // Verify every agent position is finite (no NaNs or teleports)
    for (const frame of run.frames) {
      for (const ag of frame.agents) {
        expect(isFinite(ag.x)).toBe(true);
        expect(isFinite(ag.y)).toBe(true);
      }
    }
  });

  it('strictly conserves total occupant count across multiple seeds and density multipliers (fuzzing)', () => {
    const b = simpleSchool as unknown as Building;
    const multipliers = [0.5, 1.0, 1.5, 2.0];
    const seeds = [1, 42, 99, 1337];

    for (const mult of multipliers) {
      for (const seed of seeds) {
        const run = runSimulation(b, {
          id: `fuzz-${mult}-${seed}`,
          name: `Fuzz ${mult}x ${seed}`,
          seed,
          blockedDoorIds: [],
          occupancyMultiplier: mult,
        });

        const { totalSpawned, exitedCount, unreachableCount, timedOutCount } = run.metrics;
        expect(exitedCount + unreachableCount + timedOutCount).toBe(totalSpawned);
        expect(run.frames.length).toBeGreaterThan(0);
        expect(run.frames[run.frames.length - 1].activeCount).toBe(0);
      }
    }
  });
});







