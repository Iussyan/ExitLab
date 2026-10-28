# ExitLab — Acceptance Criteria & Test Plan

## Release gate: core end-to-end workflow
Given a versioned self-authored school fixture and no Meta key, user can open building, review 2D plan, run baseline and blocked-exit scenarios, inspect real results, and replay agent paths. With a valid Meta key, the agent can request **bounded, schema-valid** scenarios and compare real run data. Features marked complete only with reproducible evidence.

## Functional acceptance matrix
| ID | Acceptance criterion | Evidence |
|---|---|---|
| A01 | Malformed building rejected with actionable error | Unit test + screenshot |
| A02 | Same building/seed/scenario returns identical trace and metrics | Automated test |
| A03 | Blocked exit cannot be crossed | Automated route test |
| A04 | Disconnected room agents flagged unreachable | Automated test |
| A05 | Conservation of occupant count throughout run | Automated invariant |
| A06 | Baseline run works without Meta key | Manual integration test |
| A07 | AI requests tool with strict structured arguments, invalid requests rejected | Mocked API test |
| A08 | Every AI claim references real completed run ID and facts | Integration test |
| A09 | Equal-budget AI-vs-random scenario benchmark available | Recorded script + report |
| A10 | PNG/JPG/PDF import or manual trace preserves dimensions after scale confirmation | Import fixture tests |
| A11 | Edited door opening updates 2D, 3D, and routing consistently | Visual + routing test |
| A12 | UI shows failed/loading/empty states and prevents unverified simulation | UI tests |
| A13 | Public repository contains README, setup instructions, license, attribution, no secrets | Repo audit |
| A14 | Report labels values as simulated and documents model assumptions | Sample exported report |

## Suggested commands (adapt after project setup)
`npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e` if configured. Never claim commands passed unless actually executed; record environment and failures in `IMPLEMENTATION_STATUS.md`.

## Demo walkthrough to rehearse
- Open preverified school fixture.
- Run reproducible baseline and display trace/metrics.
- Block one exit; show corrected route and metric differences.
- Open Meta AI agent; show actual proposed scenario and executed simulator tool result.
- Compare findings to seeded random baseline, with fair run budget.
- Open dark 3D replay, then results and export.
- Mention assumptions, no certification, and which features were built during hackathon.

## Blocking failures
Paths through walls, fake simulation metrics, invalid/unsafe tool access, silent scale inference, unreviewed imported geometry being simulated, exposing API keys, fabricated user-facing model activities, or non-reproducible core results are all release blockers.
