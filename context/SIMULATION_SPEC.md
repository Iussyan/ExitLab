# ExitLab — Simulation Contract (MVP)

## Goal and non-goals
Build a repeatable **exploratory** movement simulator, not a validated prediction of emergency human behavior, fire/smoke propagation, or regulatory compliance.

## Core pipeline
1. Validate verified `Building` against schema; rasterize polygons/walls/door openings into walkable grid (suggest 0.25–0.5 m cells; configurable).
2. Mark obstacles and closed doors impassable; connect doors/exit cells correctly.
3. Spawn defined number of occupant agents in valid walkable room cells using a seeded RNG.
4. Compute route to an available exit via A* or Dijkstra; optionally reroute when blocked.
5. Advance all agents at fixed `dt` (e.g. 0.25 s); enforce occupancy/capacity and collision rules consistently. Use one agreed update policy to avoid move-order bias.
6. End when all agents have exited, are demonstrably unreachable, or a time cap is reached.
7. Export time-series state and metrics; permit replay without rerunning model reasoning.

## Determinism
Same building hash + scenario + simulator version + seed must produce identical trace and metrics. Never use unseeded random or wall-clock time in physics logic.

## Typed scenario
```ts
type Scenario = {
 id: string; name: string; seed: number;
 blockedDoorIds: string[];
 blockedObstacleIds?: string[];
 occupancyMultiplier?: number; // constrain to e.g. [0.5, 1.5]
 startDelaySeconds?: number; // nonnegative bounded
};
```
Do not let model inject wall geometry, arbitrary scripts, negative capacities, unknown IDs, or more blocked doors than configured budget. Preserve the baseline unchanged.

## Metrics with precise meaning
- `exitedCount`: agents reaching designated outside exits by stop time.
- `unreachableCount`: agents whose valid route graph has no path to an exit under scenario.
- `timedOutCount`: agents not exited by configured max runtime but not proven unreachable.
- `clearanceTimeSeconds`: time last agent exits **only if all evacuate**; otherwise null.
- `p50ExitTimeSeconds`, `p95ExitTimeSeconds`: among exited agents, identified as such.
- `maxQueueLength`: maximum waiting agents around a defined passage region, if implemented.
- `bottleneckCells`: congested cells based on documented threshold and sample interval.
- `completed`: true only if run resolved under a declared stopping condition.

Never mislabel stalled or timed-out agents as unreachable; never report full evacuation time if not all exit. Compare paired runs using same seed and occupant conditions when possible.

## Algorithm policy
- Start with **simple, clearly documented grid movement** and passage capacity; if no reliable congestion model exists, describe it as a toy model and omit claims about realistic crowd dynamics.
- Avoid occupants walking through walls or each other; ensure opening widths and grid resolution are compatible.
- Record movement traces `(time, agentId, x, y, state)` or compressed frames for 2D/3D playback.
- Provide pause, play, speed controls on *replay*, without altering simulation calculations.

## Minimum test cases
1. Empty room with a reachable exit completes.
2. Block only available exit -> agent unreachable (not exited).
3. Block one of two exits -> no use of blocked door.
4. Identical seeds -> identical trace and metrics.
5. Path crosses passable door but never wall.
6. Two routes, one blocked -> correct reroute or clearly documented no-reroute behavior.
7. Fixed occupant count is conserved: exited + unreachable + timedOut + active = spawned.
8. Overcrowded door does not permit infinite throughput.

## Validation disclosure
Display modeling assumptions and do not infer real-world safe/unsafe outcomes. Report simulator version, seed, step size, capacity settings, and geometry review status.
