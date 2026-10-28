# ExitLab — Antigravity Agent Instructions

> Read this file first, then `EXITLAB_ANTIGRAVITY_GUIDE.md`. Treat these as requirements for work in this repository, not evidence that implementation exists.

## Mission and scope
Build ExitLab as a **solo-developer, ten-day hackathon prototype**: imported or authored single-floor building -> verified geometry -> reproducible evacuation simulation -> Meta-model-controlled stress testing -> visual comparisons and report. Safety-related output is **exploratory only**, never certified advice or live emergency navigation.

## Source-of-truth order
1. `AGENTS.md`: engineering behavior and safe workflow.
2. `EXITLAB_ANTIGRAVITY_GUIDE.md`: product scope, hybrid UI, priorities.
3. `BUILDING_SCHEMA.md`: persisted model and geometry contract.
4. `SIMULATION_SPEC.md`: reproducible simulation contract.
5. `META_AGENT_SPEC.md`: agent tools and permission boundaries.
6. `IMPORT_PIPELINE.md`: import/validation expectations.
7. `UI_DESIGN_SYSTEM.md`: UI components and navigation.
8. `ACCEPTANCE_TESTS.md`: evidence required for done.
9. `IMPLEMENTATION_STATUS.md`: **observed** implementation status; update after each task.

If documents conflict, do not silently choose: report discrepancy, make minimal defensible change, and update affected docs.

## Required working method
1. Inspect existing repository, package scripts, tests, and environment before editing. Never claim a feature is implemented from a specification alone.
2. Select one vertical slice, specify acceptance test, implement smallest cohesive change, test it, and record results.
3. Prefer React + TypeScript + Vite for web, React Konva for 2D, React Three Fiber for 3D, server-side Meta API calls, and **one shared building model**.
4. Start with a known synthetic single-floor JSON building. Deliver deterministic simulation **before** complex plan import or elaborate 3D.
5. Keep agent output untrusted. Validate typed inputs with schema, reject invalid scenario mutations, limit iterations/cost, and never allow arbitrary code or shell execution from the model.
6. Never store secrets in git. Use `.env.example`; keep real API keys on server. Public repo needs license and attribution for sample floor plans/assets.
7. Prefer simple geometry and transparent assumptions to visually impressive but unverified crowd physics.
8. Include loading, error, empty, and unavailable-AI states. Baseline simulation must remain usable without Meta API availability.
9. Do not fake benchmark data, simulation numbers, AI activity logs, or functionality. Seed demo data must be labeled.
10. After each milestone, update `IMPLEMENTATION_STATUS.md` with file paths, commands executed, pass/fail evidence, and remaining gaps.

## Execution priorities
P0: sample building -> schema validation -> baseline/blockage simulation -> metrics -> Meta tool loop -> 2D replay/results.
P1: PNG/JPG/PDF import + manual verification -> simplified 3D -> reports.
P2: advanced extraction, DXF/IFC, multifloor, collaboration. No P2 before P0 tested.

## Definition of done
A feature is done only when reachable from UI or documented API, validated on provided fixture, tested (automated or reproducible manual), and recorded in implementation status. 
