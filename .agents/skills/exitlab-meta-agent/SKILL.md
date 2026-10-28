---
name: exitlab-meta-agent
description: >-
  Procedures for developing, guarding, and evaluating the Meta AI stress-testing agent and tool-calling loop.
  Use when modifying Meta model endpoints, agent prompts, scenario validation rules, AI-vs-random benchmarks, or finding generation.
---

# ExitLab Meta AI Stress-Testing Agent

This skill guides the orchestration of the Meta AI model (Llama 3.3) for autonomous building disruption discovery, guarded tool execution, and scientific benchmarking.

## Architecture & Boundary Principles

1. **Server-Side API Credentials**: Never expose `META_LLAMA_API_KEY` to client browser code. All model requests pass through the secure Express proxy at [server/index.ts](file:///d:/Users/QCU/Documents/ExitLab/server/index.ts).
2. **Untrusted Model Output**:
   - The AI model cannot execute shell commands, read arbitrary files, or directly mutate building geometry.
   - Every scenario proposal must be validated with [validateScenario](file:///d:/Users/QCU/Documents/ExitLab/src/agent/tools.ts#L60-L100).
   - Reject any proposal attempting to block non-existent door IDs or exceeding configured budgets.
3. **Factual Grounding**:
   - Every user-facing [Finding](file:///d:/Users/QCU/Documents/ExitLab/src/agent/orchestrator.ts#L20-L37) must link to a real, completed simulation `runId`.
   - Never fabricate, hallucinate, or hardcode artificial metrics.
4. **Mandatory Safety Disclaimer**:
   - All AI findings and exported reports must clearly disclose research limitations:
     *"ExitLab is an exploratory research and tabletop decision-support prototype. It does NOT provide certified safety advice, emergency navigation, or regulatory compliance validation."*

## Key Files

- Agent Tools: [src/agent/tools.ts](file:///d:/Users/QCU/Documents/ExitLab/src/agent/tools.ts)
- Orchestrator Loop: [src/agent/orchestrator.ts](file:///d:/Users/QCU/Documents/ExitLab/src/agent/orchestrator.ts)
- AI vs Random Benchmark: [src/agent/benchmark.ts](file:///d:/Users/QCU/Documents/ExitLab/src/agent/benchmark.ts)
- Backend Proxy: [server/index.ts](file:///d:/Users/QCU/Documents/ExitLab/server/index.ts)
- AI Panel Component: [src/components/agent/AIPanel.tsx](file:///d:/Users/QCU/Documents/ExitLab/src/components/agent/AIPanel.tsx)
- Benchmark View: [src/components/benchmark/BenchmarkView.tsx](file:///d:/Users/QCU/Documents/ExitLab/src/components/benchmark/BenchmarkView.tsx)

## Agent Tool Contracts

```ts
getBuildingSummary(building: Building): BuildingSummary
validateScenario(building: Building, candidate: Partial<Scenario>): { valid: boolean; error?: string; scenario?: Scenario }
executeScenario(building: Building, scenario: Scenario): SimulationResult
compareRuns(baseline: SimulationResult, candidate: SimulationResult): RunComparison
getCongestionHotspots(run: SimulationResult): HotspotSummary
```

## Testing & Benchmarking Workflow

To test the agent loop and run the equal-budget AI-vs-Random benchmark (Acceptance Criterion A09):

```powershell
npm.cmd test -- -t "A07|A08|A09"
```
