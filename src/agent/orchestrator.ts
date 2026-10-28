import { Building } from '../schemas/building';
import {
  getBuildingSummary,
  validateScenario,
  executeScenario,
  compareRuns,
  RunComparison,
} from './tools';
import { Scenario, SimulationResult } from '../simulation/types';

export interface AgentStepTrace {
  step: number;
  phase: 'hypothesis' | 'propose_scenario' | 'validate_tool' | 'execute_simulation' | 'evaluate_metrics';
  status: 'pending' | 'success' | 'failed' | 'skipped';
  timestamp: string;
  summary: string;
  details?: Record<string, unknown>;
}

export interface Finding {
  findingId: string;
  scenarioId: string;
  runId: string;
  hypothesis: string;
  observedMetrics: {
    totalSpawned: number;
    exitedCount: number;
    unreachableCount: number;
    clearanceTimeSeconds: number | null;
    maxQueueLength: number;
    bottleneckCount: number;
  };
  comparison: RunComparison;
  explanation: string;
  caveats: string[];
}

export interface StressTestReport {
  buildingId: string;
  buildingName: string;
  baselineRun: SimulationResult;
  candidateRuns: SimulationResult[];
  comparisons: RunComparison[];
  findings: Finding[];
  traces: AgentStepTrace[];
  agentMode: 'meta_api' | 'autonomous_heuristic';
  assumptions: string[];
  disclaimer: string;
}

export interface AgentConfig {
  maxScenarios: number;
  seed: number;
  useBackendApi?: boolean;
}

/**
 * Orchestrates the Meta AI / autonomous stress-testing agent loop.
 */
export async function runStressTestAgent(
  building: Building,
  config: AgentConfig = { maxScenarios: 3, seed: 42, useBackendApi: false },
  onProgress?: (trace: AgentStepTrace) => void
): Promise<StressTestReport> {
  const traces: AgentStepTrace[] = [];
  const log = (phase: AgentStepTrace['phase'], status: AgentStepTrace['status'], summary: string, details?: Record<string, unknown>) => {
    const trace: AgentStepTrace = {
      step: traces.length + 1,
      phase,
      status,
      timestamp: new Date().toISOString(),
      summary,
      details,
    };
    traces.push(trace);
    if (onProgress) onProgress(trace);
  };

  log('hypothesis', 'success', `Inspecting verified building "${building.name}" (${building.id})`);
  const summary = getBuildingSummary(building);

  // 1. Run Baseline
  log('execute_simulation', 'pending', 'Executing deterministic baseline simulation (all exits open)');
  const baselineScenario: Scenario = {
    id: 'scenario-baseline',
    name: 'Baseline Operational State',
    seed: config.seed,
    blockedDoorIds: [],
    occupancyMultiplier: 1.0,
  };

  const baselineRun = executeScenario(building, baselineScenario);
  log('execute_simulation', 'success', `Baseline completed: ${baselineRun.metrics.exitedCount}/${baselineRun.metrics.totalSpawned} evacuated in ${baselineRun.metrics.clearanceTimeSeconds ?? 'N/A'}s`, {
    runId: baselineRun.runId,
    metrics: baselineRun.metrics,
  });

  // 2. Formulate Candidate Scenarios
  // Determine available disruption points from building doors and exits
  const candidateScenariosToTest: { name: string; hypothesis: string; blockedDoorIds: string[]; multiplier?: number }[] = [];

  const floor = building.floors[0];
  const exitDoors = floor.doors.filter(d => d.kind === 'exit');
  const interiorDoors = floor.doors.filter(d => d.kind === 'interior');

  // Candidate 1: Single primary exit blocked
  if (exitDoors.length > 0) {
    candidateScenariosToTest.push({
      name: `Primary Exit Disruption (${exitDoors[0].id})`,
      hypothesis: `Blocking primary exit ${exitDoors[0].id} forces occupants to divert to alternative exits, increasing congestion and overall evacuation time.`,
      blockedDoorIds: [exitDoors[0].id],
    });
  }

  // Candidate 2: High density surge + exit blockage
  if (exitDoors.length > 1) {
    candidateScenariosToTest.push({
      name: `Secondary Exit Disruption (${exitDoors[1].id}) + 20% Surge`,
      hypothesis: `An unexpected 20% surge in occupant density combined with secondary exit ${exitDoors[1].id} failure will stress corridor transit capacity.`,
      blockedDoorIds: [exitDoors[1].id],
      multiplier: 1.2,
    });
  } else if (interiorDoors.length > 0) {
    candidateScenariosToTest.push({
      name: `Interior Chokepoint Disruption (${interiorDoors[0].id})`,
      hypothesis: `Interior door ${interiorDoors[0].id} failure may trap occupants or force circuitous evacuation paths.`,
      blockedDoorIds: [interiorDoors[0].id],
    });
  }

  // Candidate 3: Multiple exit / passage blockage stress
  if (exitDoors.length >= 2) {
    candidateScenariosToTest.push({
      name: `Corridor Passage Disruption (${interiorDoors[0]?.id || exitDoors[0].id})`,
      hypothesis: `Testing bottleneck vulnerability when internal corridor flow is restricted.`,
      blockedDoorIds: interiorDoors.length > 0 ? [interiorDoors[0].id] : [exitDoors[0].id],
      multiplier: 1.1,
    });
  }

  const budget = Math.min(config.maxScenarios, candidateScenariosToTest.length);
  const candidateRuns: SimulationResult[] = [];
  const comparisons: RunComparison[] = [];
  const findings: Finding[] = [];

  // Try server-side Meta model if requested
  let agentMode: 'meta_api' | 'autonomous_heuristic' = 'autonomous_heuristic';
  if (config.useBackendApi) {
    try {
      log('hypothesis', 'pending', 'Contacting Meta Model API via secure server proxy...');
      const response = await fetch('/api/agent/suggest-scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingSummary: summary, budget }),
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.scenarios) && data.scenarios.length > 0) {
          agentMode = 'meta_api';
          candidateScenariosToTest.length = 0;
          for (const sc of data.scenarios) {
            candidateScenariosToTest.push({
              name: sc.name || 'AI Proposed Scenario',
              hypothesis: sc.hypothesis || 'AI disruption hypothesis',
              blockedDoorIds: sc.blockedDoorIds || [],
              multiplier: sc.occupancyMultiplier || 1.0,
            });
          }
          log('hypothesis', 'success', `Meta model proposed ${candidateScenariosToTest.length} disruption scenarios`);
        } else {
          log('hypothesis', 'skipped', 'Meta model returned empty proposals; using guarded heuristic fallback');
        }
      } else {
        log('hypothesis', 'skipped', 'Meta API endpoint unavailable; falling back to guarded autonomous agent');
      }
    } catch (e) {
      log('hypothesis', 'skipped', 'Meta API endpoint unavailable; falling back to guarded autonomous agent');
    }
  }

  // 3. Iterative Agent Stress-Testing Loop
  for (let i = 0; i < budget; i++) {
    const candidateDef = candidateScenariosToTest[i];
    const scenarioId = `scenario-stress-${i + 1}`;

    log('propose_scenario', 'pending', `Agent proposing Scenario ${i + 1}: "${candidateDef.name}"`, {
      hypothesis: candidateDef.hypothesis,
      blockedDoors: candidateDef.blockedDoorIds,
    });

    // Validate scenario through guarded tool
    const validation = validateScenario(building, {
      id: scenarioId,
      name: candidateDef.name,
      seed: config.seed + i + 1,
      blockedDoorIds: candidateDef.blockedDoorIds,
      occupancyMultiplier: candidateDef.multiplier ?? 1.0,
    });

    if (!validation.valid || !validation.scenario) {
      log('validate_tool', 'failed', `Tool validation rejected scenario: ${validation.error}`);
      continue;
    }

    log('validate_tool', 'success', `Scenario validated against building topology schema`);

    // Execute deterministic simulation
    log('execute_simulation', 'pending', `Running simulation for scenario "${validation.scenario.name}"`);
    const runResult = executeScenario(building, validation.scenario);
    candidateRuns.push(runResult);

    // Compare with baseline
    log('evaluate_metrics', 'pending', `Comparing run "${runResult.runId}" against baseline`);
    const comparison = compareRuns(baselineRun, runResult);
    comparisons.push(comparison);

    // Formulate Finding
    let explanation = '';
    if (comparison.unreachableDelta > 0) {
      explanation = `CRITICAL FINDING: Blocking ${candidateDef.blockedDoorIds.join(', ')} caused ${comparison.unreachableDelta} occupants to become completely unreachable, leaving them trapped without an egress route.`;
    } else if (comparison.clearanceTimeDeltaSeconds !== null && comparison.clearanceTimeDeltaSeconds > 0) {
      explanation = `DELAY IDENTIFIED: Evacuation time increased by ${comparison.clearanceTimeDeltaSeconds.toFixed(1)}s (+${((comparison.clearanceTimeDeltaSeconds / (baselineRun.metrics.clearanceTimeSeconds || 1)) * 100).toFixed(0)}%). Queueing increased by ${comparison.maxQueueDelta} occupants around secondary passages.`;
    } else {
      explanation = `RESILIENT ROUTING: Occupants successfully redistributed across remaining openings with negligible impact on overall evacuation time.`;
    }

    const finding: Finding = {
      findingId: `finding-${i + 1}`,
      scenarioId: validation.scenario.id,
      runId: runResult.runId,
      hypothesis: candidateDef.hypothesis,
      observedMetrics: {
        totalSpawned: runResult.metrics.totalSpawned,
        exitedCount: runResult.metrics.exitedCount,
        unreachableCount: runResult.metrics.unreachableCount,
        clearanceTimeSeconds: runResult.metrics.clearanceTimeSeconds,
        maxQueueLength: runResult.metrics.maxQueueLength,
        bottleneckCount: runResult.metrics.bottleneckCells.length,
      },
      comparison,
      explanation,
      caveats: [
        'Exploratory simulation model based on 2D grid discretization',
        'Human behavior assumed to follow shortest available path without panic or smoke aversion',
        'Not certified engineering proof of life safety or code compliance',
      ],
    };

    findings.push(finding);
    log('evaluate_metrics', 'success', `Scenario evaluated (Impact Score: ${comparison.impactScore}/100): ${explanation}`);
  }

  // Sort findings by severity
  findings.sort((a, b) => b.comparison.impactScore - a.comparison.impactScore);

  return {
    buildingId: building.id,
    buildingName: building.name,
    baselineRun,
    candidateRuns,
    comparisons,
    findings,
    traces,
    agentMode,
    assumptions: summary.assumptions,
    disclaimer: 'ExitLab is an exploratory research and tabletop decision-support prototype. It does NOT provide certified safety advice, emergency navigation, or regulatory compliance validation.',
  };
}
