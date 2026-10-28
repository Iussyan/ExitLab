---
name: exitlab-simulation
description: >-
  Procedures, invariants, and debugging workflows for the ExitLab deterministic evacuation simulation engine.
  Use when modifying pathfinding, grid walkability, door flow capacity, queueing behavior, or running simulation invariant tests.
---

# ExitLab Evacuation Simulation Engine

This skill guides engineering work on the deterministic evacuation simulation engine, pathfinding grid, and movement physics.

## Core Principles

1. **Strict Determinism**: Identical `(building, scenario, seed)` must produce byte-identical metric results and movement trace frames. Never use `Math.random()`, wall-clock time, or unseeded random sources in physics or agent logic. Always use [SeededPRNG](file:///d:/Users/QCU/Documents/ExitLab/src/simulation/prng.ts).
2. **Conservation of Occupants**: Throughout every frame of the simulation:
   $$\text{activeCount} + \text{exitedCount} + \text{unreachableCount} + \text{timedOutCount} = \text{totalSpawned}$$
3. **Physical Capacity & Throughput**:
   - Grid spatial resolution: $0.25\text{m} \times 0.25\text{m}$ cells.
   - Cell occupancy limit: Maximum 1 agent per cell to prevent unrealistic stacking.
   - Doorway flow rate: Constrained to $1.3 \text{ occupants}/\text{meter of width}/\text{second}$.
   - Nominal walking speed: $1.2\text{ m/s}$ ($0.3\text{m}$ per $0.25\text{s}$ timestep).
4. **No Teleportation**: Agents only move across adjacent passable cells (8-way connected with diagonal corner-cutting prevention). Walls are completely solid; doors only allow passage when marked passable and not present in `scenario.blockedDoorIds`.

## Key Files

- Simulation Engine: [src/simulation/engine.ts](file:///d:/Users/QCU/Documents/ExitLab/src/simulation/engine.ts)
- Navigation Grid: [src/simulation/navgrid.ts](file:///d:/Users/QCU/Documents/ExitLab/src/simulation/navgrid.ts)
- Dijkstra Router: [src/simulation/pathfinding.ts](file:///d:/Users/QCU/Documents/ExitLab/src/simulation/pathfinding.ts)
- Types & Metrics: [src/simulation/types.ts](file:///d:/Users/QCU/Documents/ExitLab/src/simulation/types.ts)
- Deterministic PRNG: [src/simulation/prng.ts](file:///d:/Users/QCU/Documents/ExitLab/src/simulation/prng.ts)
- Automated Test Suite: [tests/simulation.test.ts](file:///d:/Users/QCU/Documents/ExitLab/tests/simulation.test.ts)

## Verification Procedures

Always verify any simulation engine modification by executing the automated test suite:

```powershell
npm.cmd test
```

### Invariants Checklist

- [ ] Same seed generates identical `clearanceTimeSeconds`, `exitedCount`, and frame arrays.
- [ ] Blocked exits record 0 passages in `metrics.doorThroughput`.
- [ ] Isolated/sealed rooms report occupants as `unreachable`, never exited.
- [ ] `clearanceTimeSeconds` is `null` if any occupant is trapped or times out.
- [ ] Overcrowded narrow passages produce queue wait events and appear in `metrics.bottleneckCells`.
