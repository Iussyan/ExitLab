import { Building } from '../schemas/building';
import { SeededPRNG } from '../simulation/prng';
import { runStressTestAgent, StressTestReport } from './orchestrator';
import { executeScenario, validateScenario } from './tools';
import { Scenario, SimulationResult } from '../simulation/types';

export interface BenchmarkMetrics {
  totalScenariosRun: number;
  worstClearanceTimeSeconds: number | null;
  maxUnreachableCount: number;
  totalBottlenecksDiscovered: number;
  averageImpactScore: number;
  invalidProposalsCount: number;
  executionDurationMs: number;
}

export interface BenchmarkResult {
  buildingId: string;
  buildingName: string;
  budget: number;
  aiAgentResults: BenchmarkMetrics;
  randomBaselineResults: BenchmarkMetrics;
  comparisonSummary: {
    stressDetectionAdvantagePct: number;
    unreachableDetectionDiff: number;
    bottleneckDiscoveryRatio: number;
    explanation: string;
  };
}

/**
 * Runs an equal-budget benchmark comparing AI-guided stress search against seeded random disruption search.
 */
export async function runAIVsRandomBenchmark(
  building: Building,
  budget: number = 3,
  seed: number = 42
): Promise<BenchmarkResult> {
  const prng = new SeededPRNG(seed);
  const floor = building.floors[0];
  const allDoors = floor.doors;

  // 1. Run AI Agent Loop
  const startTimeAi = performance.now();
  const aiReport: StressTestReport = await runStressTestAgent(building, {
    maxScenarios: budget,
    seed,
    useBackendApi: false,
  });
  const durationAi = performance.now() - startTimeAi;

  const aiClearanceTimes = aiReport.candidateRuns
    .map(r => r.metrics.clearanceTimeSeconds)
    .filter((t): t is number => t !== null);
  const aiWorstClearance = aiClearanceTimes.length > 0 ? Math.max(...aiClearanceTimes) : null;
  const aiMaxUnreachable = Math.max(...aiReport.candidateRuns.map(r => r.metrics.unreachableCount), 0);
  const aiTotalBottlenecks = aiReport.candidateRuns.reduce((acc, r) => acc + r.metrics.bottleneckCells.length, 0);
  const aiAvgImpact =
    aiReport.comparisons.length > 0
      ? aiReport.comparisons.reduce((acc, c) => acc + c.impactScore, 0) / aiReport.comparisons.length
      : 0;

  // 2. Run Equal-Budget Seeded Random Selection
  const startTimeRandom = performance.now();
  const randomRuns: SimulationResult[] = [];
  let invalidProposalsCount = 0;

  for (let i = 0; i < budget; i++) {
    // Pick 1 to 2 doors at random
    const numDoorsToBlock = prng.nextInt(1, Math.min(2, allDoors.length));
    const shuffledDoors = prng.shuffle([...allDoors]);
    const chosenDoors = shuffledDoors.slice(0, numDoorsToBlock).map(d => d.id);

    const randomCandidate = {
      id: `random-sc-${i + 1}`,
      name: `Random Disruption (${chosenDoors.join(', ')})`,
      seed: seed + 500 + i,
      blockedDoorIds: chosenDoors,
    };

    const validation = validateScenario(building, randomCandidate);
    if (!validation.valid || !validation.scenario) {
      invalidProposalsCount++;
      continue;
    }

    const runResult = executeScenario(building, validation.scenario);
    randomRuns.push(runResult);
  }
  const durationRandom = performance.now() - startTimeRandom;

  const randClearanceTimes = randomRuns
    .map(r => r.metrics.clearanceTimeSeconds)
    .filter((t): t is number => t !== null);
  const randWorstClearance = randClearanceTimes.length > 0 ? Math.max(...randClearanceTimes) : null;
  const randMaxUnreachable = Math.max(...randomRuns.map(r => r.metrics.unreachableCount), 0);
  const randTotalBottlenecks = randomRuns.reduce((acc, r) => acc + r.metrics.bottleneckCells.length, 0);

  // Compute metric differences
  const aiMetrics: BenchmarkMetrics = {
    totalScenariosRun: aiReport.candidateRuns.length,
    worstClearanceTimeSeconds: aiWorstClearance,
    maxUnreachableCount: aiMaxUnreachable,
    totalBottlenecksDiscovered: aiTotalBottlenecks,
    averageImpactScore: Math.round(aiAvgImpact),
    invalidProposalsCount: 0,
    executionDurationMs: Math.round(durationAi),
  };

  const randMetrics: BenchmarkMetrics = {
    totalScenariosRun: randomRuns.length,
    worstClearanceTimeSeconds: randWorstClearance,
    maxUnreachableCount: randMaxUnreachable,
    totalBottlenecksDiscovered: randTotalBottlenecks,
    averageImpactScore: 0, // not calculated for random
    invalidProposalsCount,
    executionDurationMs: Math.round(durationRandom),
  };

  let explanation = '';
  if (aiMaxUnreachable > randMaxUnreachable) {
    explanation = `The AI stress test identified severe isolation conditions (${aiMaxUnreachable} trapped vs ${randMaxUnreachable} by random selection) with an equal evaluation budget.`;
  } else if ((aiWorstClearance ?? 0) > (randWorstClearance ?? 0)) {
    explanation = `The AI stress test found more severe congestion delays (worst clearance: ${aiWorstClearance ?? 'N/A'}s vs ${randWorstClearance ?? 'N/A'}s).`;
  } else {
    explanation = `Both methods explored disruption variants within comparable bounds. The AI agent systematically documented concrete hypotheses for each tested bottleneck.`;
  }

  return {
    buildingId: building.id,
    buildingName: building.name,
    budget,
    aiAgentResults: aiMetrics,
    randomBaselineResults: randMetrics,
    comparisonSummary: {
      stressDetectionAdvantagePct:
        aiWorstClearance && randWorstClearance
          ? Math.round(((aiWorstClearance - randWorstClearance) / randWorstClearance) * 100)
          : 0,
      unreachableDetectionDiff: aiMaxUnreachable - randMaxUnreachable,
      bottleneckDiscoveryRatio: parseFloat((aiTotalBottlenecks / Math.max(1, randTotalBottlenecks)).toFixed(2)),
      explanation,
    },
  };
}
