import { describe, it, expect } from 'vitest';
import { Building, BuildingSchema, validateBuildingGeometry } from '../src/schemas/building';
import { runSimulation } from '../src/simulation/engine';
import { Scenario } from '../src/simulation/types';

// Load Fixtures
import simpleSchoolData from '../src/fixtures/simple-school.json';
import disconnectedRoomData from '../src/fixtures/disconnected-room.json';
import narrowDoorData from '../src/fixtures/narrow-door.json';
import malformedBuildingData from '../src/fixtures/malformed-building.json';

const simpleSchool = simpleSchoolData as unknown as Building;
const disconnectedRoom = disconnectedRoomData as unknown as Building;
const narrowDoor = narrowDoorData as unknown as Building;

describe('A01: Building Schema & Hard Validation Rules', () => {
  it('validates canonical simple-school fixture without errors', () => {
    const parseResult = BuildingSchema.safeParse(simpleSchool);
    expect(parseResult.success).toBe(true);

    const validation = validateBuildingGeometry(simpleSchool);
    expect(validation.valid).toBe(true);
    expect(validation.issues.filter(i => i.severity === 'error')).toHaveLength(0);
  });

  it('rejects malformed building fixture with actionable diagnostic errors', () => {
    const validation = validateBuildingGeometry(malformedBuildingData as unknown as Building);
    expect(validation.valid).toBe(false);

    const errorCodes = validation.issues.map(i => i.code);
    // Should catch duplicate ID, degenerate wall, floating door, unconfirmed scale/review
    expect(errorCodes).toContain('DUPLICATE_ID');
    expect(errorCodes).toContain('DEGENERATE_WALL');
    expect(errorCodes).toContain('FLOATING_DOOR');
    expect(errorCodes).toContain('DOOR_EXCEEDS_WALL');
    expect(errorCodes).toContain('EXIT_MISSING_DOOR');
    expect(errorCodes).toContain('SCALE_NOT_CONFIRMED');
    expect(errorCodes).toContain('GEOMETRY_NOT_REVIEWED');
  });
});

describe('A02: Deterministic Simulation Reproducibility', () => {
  it('returns byte-identical metrics and agent trajectories given identical building, scenario, and seed', () => {
    const scenario: Scenario = {
      id: 'baseline-test',
      name: 'Reproducibility Baseline',
      seed: 42,
      blockedDoorIds: [],
    };

    const run1 = runSimulation(simpleSchool, scenario);
    const run2 = runSimulation(simpleSchool, scenario);

    expect(run1.metrics.totalSpawned).toBe(run2.metrics.totalSpawned);
    expect(run1.metrics.exitedCount).toBe(run2.metrics.exitedCount);
    expect(run1.metrics.clearanceTimeSeconds).toBe(run2.metrics.clearanceTimeSeconds);
    expect(run1.metrics.p50ExitTimeSeconds).toBe(run2.metrics.p50ExitTimeSeconds);
    expect(run1.metrics.p95ExitTimeSeconds).toBe(run2.metrics.p95ExitTimeSeconds);
    expect(run1.metrics.maxQueueLength).toBe(run2.metrics.maxQueueLength);

    // Deep compare all frame counts and agent coordinates across all frames
    expect(run1.frames.length).toBe(run2.frames.length);
    for (let f = 0; f < run1.frames.length; f++) {
      const f1 = run1.frames[f];
      const f2 = run2.frames[f];
      expect(f1.timeSeconds).toBe(f2.timeSeconds);
      expect(f1.activeCount).toBe(f2.activeCount);
      expect(f1.exitedCumulative).toBe(f2.exitedCumulative);
      expect(f1.agents).toEqual(f2.agents);
    }
  });

  it('produces different trajectories when seed is changed', () => {
    const runA = runSimulation(simpleSchool, { id: 'seed-a', name: 'Seed A', seed: 101, blockedDoorIds: [] });
    const runB = runSimulation(simpleSchool, { id: 'seed-b', name: 'Seed B', seed: 999, blockedDoorIds: [] });

    // Initial agent spawn coordinates should vary due to seeded PRNG
    const spawnPositionsA = runA.frames[0].agents.map(a => `${a.x},${a.y}`);
    const spawnPositionsB = runB.frames[0].agents.map(a => `${a.x},${a.y}`);
    expect(spawnPositionsA).not.toEqual(spawnPositionsB);
  });
});

describe('A03: Blocked Exit Routing & Behavior', () => {
  it('ensures agents never cross a blocked exit door and successfully reroute to remaining exit', () => {
    const baselineScenario: Scenario = {
      id: 'baseline',
      name: 'Baseline - All Exits Open',
      seed: 777,
      blockedDoorIds: [],
    };

    const blockedScenario: Scenario = {
      id: 'blocked-west',
      name: 'Disruption - West Exit Blocked',
      seed: 777,
      blockedDoorIds: ['d-exit-west'],
    };

    const baseRun = runSimulation(simpleSchool, baselineScenario);
    const blockedRun = runSimulation(simpleSchool, blockedScenario);

    // In baseline, both west and east exits are used
    const baseWestPassages = baseRun.metrics.doorThroughput.find(d => d.doorId === 'd-exit-west')?.totalPassed ?? 0;
    const baseEastPassages = baseRun.metrics.doorThroughput.find(d => d.doorId === 'd-exit-east')?.totalPassed ?? 0;
    expect(baseWestPassages).toBeGreaterThan(0);
    expect(baseEastPassages).toBeGreaterThan(0);

    // In blocked scenario, west exit has EXACTLY 0 passages!
    const blockedWestPassages = blockedRun.metrics.doorThroughput.find(d => d.doorId === 'd-exit-west')?.totalPassed ?? 0;
    const blockedEastPassages = blockedRun.metrics.doorThroughput.find(d => d.doorId === 'd-exit-east')?.totalPassed ?? 0;
    expect(blockedWestPassages).toBe(0);
    expect(blockedEastPassages).toBe(blockedRun.metrics.exitedCount);

    // All evacuating agents rerouted through east exit
    expect(blockedRun.metrics.exitedCount).toBe(blockedRun.metrics.totalSpawned);

    // Clearance time with one exit blocked should be significantly higher due to congestion
    if (baseRun.metrics.clearanceTimeSeconds && blockedRun.metrics.clearanceTimeSeconds) {
      expect(blockedRun.metrics.clearanceTimeSeconds).toBeGreaterThan(baseRun.metrics.clearanceTimeSeconds);
    }
  });

  it('reports all occupants as unreachable if ALL exits are blocked', () => {
    const allBlockedScenario: Scenario = {
      id: 'all-blocked',
      name: 'All Exits Blocked',
      seed: 123,
      blockedDoorIds: ['d-exit-west', 'd-exit-east'],
    };

    const run = runSimulation(simpleSchool, allBlockedScenario);
    expect(run.metrics.exitedCount).toBe(0);
    expect(run.metrics.unreachableCount).toBe(run.metrics.totalSpawned);
    expect(run.metrics.clearanceTimeSeconds).toBeNull();
  });
});

describe('A04: Disconnected Room Handling', () => {
  it('correctly flags occupants of sealed/disconnected rooms as unreachable while accessible room evacuates', () => {
    const scenario: Scenario = {
      id: 'disconnected-test',
      name: 'Test Disconnected Room',
      seed: 888,
      blockedDoorIds: [],
    };

    const run = runSimulation(disconnectedRoom, scenario);

    // In disconnected-room fixture:
    // r-accessible has 5 occupants
    // r-sealed-archive has 4 occupants (no door/exit)
    expect(run.metrics.totalSpawned).toBe(9);
    expect(run.metrics.exitedCount).toBe(5);
    expect(run.metrics.unreachableCount).toBe(4);
    expect(run.metrics.timedOutCount).toBe(0);

    // Per SIMULATION_SPEC: clearanceTimeSeconds must be null because not all occupants evacuate
    expect(run.metrics.clearanceTimeSeconds).toBeNull();
  });
});

describe('A05: Conservation of Occupant Count Invariant', () => {
  it('strictly conserves total occupant count (exited + unreachable + timedOut = totalSpawned) in all scenarios', () => {
    const scenarios: Scenario[] = [
      { id: 'sc-1', name: 'Baseline', seed: 1, blockedDoorIds: [] },
      { id: 'sc-2', name: 'West Blocked', seed: 2, blockedDoorIds: ['d-exit-west'] },
      { id: 'sc-3', name: 'East Blocked', seed: 3, blockedDoorIds: ['d-exit-east'] },
      { id: 'sc-4', name: 'High Density', seed: 4, blockedDoorIds: [], occupancyMultiplier: 1.5 },
      { id: 'sc-5', name: 'Both Blocked', seed: 5, blockedDoorIds: ['d-exit-west', 'd-exit-east'] },
    ];

    for (const sc of scenarios) {
      const run = runSimulation(simpleSchool, sc);
      const sum = run.metrics.exitedCount + run.metrics.unreachableCount + run.metrics.timedOutCount;
      expect(sum).toBe(run.metrics.totalSpawned);

      // Verify each individual frame maintains conservation of active + exited + unreachable
      for (const frame of run.frames) {
        expect(frame.activeCount + frame.exitedCumulative + run.metrics.unreachableCount).toBe(run.metrics.totalSpawned);
      }
    }
  });
});

describe('Bottleneck & Narrow Door Dynamics', () => {
  it('detects bottleneck cells and queueing when passage is constrained', () => {
    const scenario: Scenario = {
      id: 'narrow-bottleneck-test',
      name: 'Bottleneck Test',
      seed: 55,
      blockedDoorIds: [],
      occupancyMultiplier: 2.0, // 60 occupants to generate heavy queueing at 0.8m door
    };

    const run = runSimulation(narrowDoor, scenario, { congestionWaitThresholdSteps: 2 });
    expect(run.metrics.totalSpawned).toBe(64);
    expect(run.metrics.exitedCount).toBe(64);

    // Chokepoint should show queueing and wait events
    expect(run.metrics.maxQueueLength).toBeGreaterThan(0);
    expect(run.metrics.bottleneckCells.length).toBeGreaterThan(0);

    const bottleneckAtDoor = run.metrics.bottleneckCells.find(b => b.doorId === 'd-narrow-bottleneck');
    expect(bottleneckAtDoor).toBeDefined();
  });
});

describe('A07: Guarded Tool Calling & Schema Validation', () => {
  it('rejects candidate scenarios with non-existent door IDs or over-budget constraints', async () => {
    const { validateScenario } = await import('../src/agent/tools');

    // Attempt to block a door ID that doesn't exist
    const invalidDoorResult = validateScenario(simpleSchool, {
      id: 'bad-door',
      name: 'Bad Door Test',
      blockedDoorIds: ['d-fake-door-999'],
    });
    expect(invalidDoorResult.valid).toBe(false);
    expect(invalidDoorResult.error).toContain('does not exist');

    // Valid scenario passes
    const validResult = validateScenario(simpleSchool, {
      id: 'good-scenario',
      name: 'Valid West Block',
      blockedDoorIds: ['d-exit-west'],
    });
    expect(validResult.valid).toBe(true);
    expect(validResult.scenario?.blockedDoorIds).toEqual(['d-exit-west']);
  });
});

describe('A08: AI Findings Provenance & Factual Grounding', () => {
  it('ensures every AI finding references real run IDs, verifiable metrics, and safety caveats', async () => {
    const { runStressTestAgent } = await import('../src/agent/orchestrator');

    const report = await runStressTestAgent(simpleSchool, { maxScenarios: 2, seed: 1234 });
    expect(report.candidateRuns.length).toBe(2);
    expect(report.findings.length).toBe(2);

    for (const finding of report.findings) {
      // Must link to real run ID
      const matchingRun = report.candidateRuns.find(r => r.runId === finding.runId);
      expect(matchingRun).toBeDefined();

      // Metrics in finding must match actual simulator metrics
      expect(finding.observedMetrics.totalSpawned).toBe(matchingRun!.metrics.totalSpawned);
      expect(finding.observedMetrics.exitedCount).toBe(matchingRun!.metrics.exitedCount);
      expect(finding.observedMetrics.unreachableCount).toBe(matchingRun!.metrics.unreachableCount);

      // Must include safety caveats
      expect(finding.caveats.length).toBeGreaterThan(0);
      expect(finding.caveats.some(c => c.toLowerCase().includes('not certified'))).toBe(true);
    }
  });
});

describe('A09: Equal-Budget AI-vs-Random Benchmark', () => {
  it('runs equal-budget benchmark comparing AI stress search against seeded random selection', async () => {
    const { runAIVsRandomBenchmark } = await import('../src/agent/benchmark');

    const benchmark = await runAIVsRandomBenchmark(simpleSchool, 2, 777);
    expect(benchmark.budget).toBe(2);
    expect(benchmark.aiAgentResults.totalScenariosRun).toBe(2);
    expect(benchmark.randomBaselineResults.totalScenariosRun).toBe(2);
    expect(benchmark.comparisonSummary.explanation.length).toBeGreaterThan(10);
  });
});

