# ExitLab — Antigravity Implementation Guide

**Project:** ExitLab — AI-Powered Evacuation Plan Stress-Testing Platform  
**Hackathon:** Meta Global AI Developer Hackathon · Indie Developer Track  
**Developer:** Solo student developer  
**Document status:** Implementation specification, **not** a statement that features already exist  
**Version:** 1.0 · 28 October 2026

> **Instruction to Antigravity:** Treat this document as the source of truth for scope and design. Implement incrementally, verify each milestone, and never represent planned features as completed. If the repository already contains code, inspect it first and report what actually exists before changing anything. Do not assume the mockups are functional code.

---

## 1. Project vision

ExitLab is a browser-based tool for **exploratory emergency evacuation planning and tabletop training**. Users import or create a simplified building plan, verify its geometry, place simulated occupants, run a baseline evacuation, and ask a Meta-powered agent to search for challenging but plausible disruptions. A deterministic simulation engine calculates outcomes; the AI proposes and evaluates scenarios and explains the measured differences. Results appear in synchronized 2D and 3D views with comparisons and reports.

**Distinctive capability:** the Meta agent repeatedly proposes **valid** scenarios, invokes a real simulator, analyzes feedback, and chooses the next experiment. Do **not** build merely a chatbot or a visualization with AI-generated text.

**Safety boundary:** ExitLab is a research/educational decision-support prototype. It is **not** an emergency navigation tool, a certified crowd simulator, a building-code compliance checker, or a substitute for qualified safety professionals. Label outputs as simulated and assumption-dependent. Never call a building “safe” based on the prototype.

### Intended hackathon demonstration

1. Open a prepared example building or import a PDF/image floor plan.
2. Review and correct detected or manually traced walls, doors, rooms, and exits.
3. See the same verified model in 2D and a lightweight 3D cutaway.
4. Add occupants and run a reproducible baseline evacuation.
5. Start an AI stress test; observe scenario proposals, tool executions, and simulation results.
6. Inspect a blocked-exit or bottleneck scenario visually and compare it against baseline.
7. Export a report with numerical findings, scenario definitions, and limitations.

---

## 2. Scope and truth labels

**IMPORTANT: All items below are specifications, not completed implementation.** No repository was examined when this file was authored. At present, only the ExitLab concept and UI mockup directions have been discussed. Antigravity must create an `IMPLEMENTATION_STATUS.md` after inspecting the actual repo, with checked evidence for each feature.

### P0 — Required for a coherent hackathon MVP

- [ ] React + TypeScript web application and consistent hybrid design system.
- [ ] Project dashboard, new project and demo project flows.
- [ ] Manually editable **single-floor** 2D building model (rooms, walls, doorways, exits, obstacles, occupant counts).
- [ ] Import PNG/JPG and render first page or selected page of PDF as a floor-plan underlay.
- [ ] Manual scale calibration and user confirmation of topology before simulation.
- [ ] Shared normalized building JSON schema used by editor, simulator, and 3D renderer.
- [ ] Simplified 3D cutaway generated from **confirmed geometry**; camera orbit, zoom, and 2D/3D switch.
- [ ] Deterministic, seeded movement simulation with valid routes, blockages, congestion approximation, and reproducible metrics.
- [ ] Baseline and manually defined disruption scenarios.
- [ ] Backend integration with at least one **actual Meta model** via authorized API or open weights (no fake AI calls).
- [ ] Meta stress-test agent that proposes schema-valid disruptions, calls the simulator through guarded tools, and evaluates returned measurements over multiple iterations.
- [ ] AI activity trace showing proposed scenario, tool call, outcome, and reasoning summary.
- [ ] Results with scenario comparisons, selected heatmap/trajectory visualization, and explanations tied to measured results.
- [ ] Downloadable report (HTML print-to-PDF is an acceptable MVP fallback), including assumptions and safety disclaimer.
- [ ] Public GitHub repository, clear setup instructions, permitted demo assets, and reproducible demo path.

### P1 — Recommended if P0 is solid

- [ ] Assisted plan interpretation using Meta multimodal model, returning **candidate** labels/regions for manual verification.
- [ ] SAM 3.1-assisted segmentation of drawing elements if supported by available access and practical for blueprint images.
- [ ] Additional scenario types such as corridor capacity reduction and different occupant distributions.
- [ ] 2D congestion overlay and a simulation replay timeline.
- [ ] AI-versus-random scenario selection comparison with equal evaluation budgets.
- [ ] Multiple demo layouts and saved projects (browser storage first; Supabase only if needed).
- [ ] CSV export of scenario metrics and simple shareable report views.

### P2 — Stretch goals / after hackathon

- [ ] DXF importer; SVG vector import.
- [ ] IFC/BIM import and extraction of semantic building elements.
- [ ] Multistory models, validated stair connectivity, and occupancy-dependent mobility variants.
- [ ] Native DWG/RVT/SKP support (prefer external export to interchange formats).
- [ ] Detailed smoke/fire spread, physics-based crowd behavior, and advanced accessibility models.
- [ ] Production authentication, team collaboration, enterprise controls, sensor integrations.
- [ ] Professional engineering calibration, validation, and regulatory compliance use.

### Explicitly out of scope for P0

- Automatic, accurate 3D reconstruction of arbitrary floor-plan files without review.
- Real-time emergency route instructions or certified building safety verdicts.
- Photorealistic building rendering or fully animated human characters.
- Native CAD/BIM handling for every proprietary extension.
- Autonomous modifications to the user's approved building geometry without confirmation.
- A generic chatbot as the main interaction.

---

## 3. Hybrid UI/UX design specification

**Design concept:** Bright, accessible planning interfaces; dark immersive 3D simulation workspace. Keep the application visually consistent across both modes.

### Design tokens

| Role | Hex | Use |
|---|---|---|
| Primary blue | `#315CFA` | Primary buttons, selected navigation, active editor state |
| AI violet | `#7546F8` | Meta agent, AI run state, experiment indicators |
| Simulation navy | `#0D1729` | 3D workspace background, dark panels |
| Canvas white | `#F8FAFD` | Planning canvas and page backgrounds |
| Success green | `#16A477` | Valid available exits, successful operations |
| Alert red | `#EF4444` | Blockages, failed tests, danger highlighting |

Use neutral grays for ordinary controls. Red should not be used merely for decoration. Use **Inter or Geist** for typography. Rounded cards (approximately 10–14px), ample spacing, readable labels, subtle borders, clear hover/focus/disabled states. Prioritize keyboard focus, contrast, and desktop usability; provide smaller-screen fallbacks.

### Shared navigation and layout

- Public landing: top navigation, product hero, demo entry.
- Signed-in/demo workspace: fixed left sidebar (`Dashboard`, `Projects`, `Simulations`, `AI Stress Tests`, `Reports`, `Resources`, `Settings`), context breadcrumb/topbar, central canvas, optional right property/agent panel.
- Keep a consistent logo, action placement, icon library, and form pattern throughout.
- Differentiate **simulation data** from **AI interpretation** in every results view.

### Screen-by-screen requirements

**1. Landing page (public)**
- Hero: “AI-Powered Evacuation Plan Stress Testing”; supporting copy should emphasize exploring failure conditions, not certifying safety.
- Calls to action: “Try Live Demo”, “Start New Project”.
- Conceptual 3D cutaway preview, compact explanation of import → simulate → stress-test → compare.
- Accessibility, safety disclaimer, FAQ/learn-more section.

**2. Project dashboard**
- Recent buildings, recently run scenarios, total projects/simulations/reports (real counts; don't invent data in production).
- New project, sample project, reopen project, quick links to results.
- Meaningful empty state for first-time users.

**3. Building-plan import wizard**
- Stepper: `Import → Review → Edit → Simulate`.
- Drag/drop JPG/PNG/PDF, file constraints, page selection where applicable.
- Raster image/PDF preview and scale calibration (user selects two points and enters a real-world distance).
- Assistive extraction must clearly distinguish guessed vs confirmed shapes; never silently trust predicted exits.
- Sample floor plan available without uploading private facility plans.

**4. 2D floor-plan editor**
- Left tools: select, wall, room, doorway, exit, obstacle, occupants.
- Center: pannable/zoomable grid and plan underlay with editable handles.
- Right: selected-object properties, dimensions, occupancy and validation issues.
- Layers, undo/redo, save, “Preview 3D”, and “Run Baseline”.
- Flag disconnected rooms, missing exits, incomplete scale, intersecting or invalid geometry.

**5. 3D simulation workspace (dark mode)**
- Isometric/cutaway building built from the same normalized geometry as 2D.
- Camera orbit, pan, zoom, top/3D toggle; hide walls/occupants, show routes and heatmap.
- Playback bar with play/pause, speed, scrub, reset and clearly labeled simulated elapsed time.
- Overlay stats: simulated occupants, completed/unreachable, selected scenario, elapsed simulated time.
- Use simple spheres/capsules or markers for occupants, not expensive character assets.

**6. AI stress-testing panel**
- Explain what the agent will test and show safe, bounded controls: number of scenarios, allowed disruption types, optional goal, run/cancel.
- Agent activity feed: building summary → proposed scenarios → validated tool calls → simulator outputs → next selection.
- Distinguish model-produced hypotheses from engine-measured results.
- Provide controls to inspect, replay, and compare individual scenarios.
- Never let model text directly execute unvalidated code or mutate project files.

**7. Results and insights**
- Tabs: Overview, Scenario Comparison, Bottlenecks, Routes, Recommendations.
- Baseline vs stress-case metrics and occupancy-over-time chart.
- Map/3D view with heatmap or congestion marker overlay, timestamp and legend.
- AI findings anchored to scenario IDs, geometry IDs, and observed numeric outputs.
- Explicit assumptions, limitations, and links to reproducible configurations.

**8. Report export**
- Preview with project, scenario definition, building assumptions, metric tables, diagrams/screenshots, observed bottlenecks, recommendations and limitations.
- HTML print/PDF export first; richer PDF template later.
- Do not imply certification or professional validation.

### UX state requirements

For each screen implement loading, empty, invalid input, permission/API error, and success states. Use skeletons sparingly; keep file import and long-running agent execution interruptible. Show clear progress and what can be retried. Never display fabricated AI results as if they were measured.

---

## 4. Architecture and boundaries

```text
React + TypeScript frontend
  ├─ Project/dashboard/import workflow
  ├─ 2D editor (React Konva)
  ├─ 3D viewer (Three.js + React Three Fiber)
  └─ Results, AI activity log, report
            │
            ▼
Backend/API (Node.js / TypeScript)
  ├─ Building schema validation and storage
  ├─ Deterministic seeded simulator (may run in browser worker)
  ├─ Scenario evaluator and experiment history
  ├─ Meta Model API client (server-side credentials ONLY)
  └─ Guarded agent orchestration and typed tools
            │
            ▼
Meta model: propose/choose/interpret scenarios
  ↔ validated runSimulation / inspectBuilding / compareRuns tools
```

**Recommended initial stack:** Vite, React, TypeScript, Tailwind CSS, React Konva, Three.js, React Three Fiber, Zod, a small Node backend, and a charting library. PDF.js for PDF preview. Keep the simulation and its rules in framework-independent TypeScript modules. GitHub as public source; Vercel or another compatible deployment provider after backend/runtime requirements are checked. Use Supabase only if persistent cloud storage or accounts add real MVP value.

### Separation of responsibilities

| Component | Responsibility |
|---|---|
| Importer | Read file and produce an underlay / tentative geometry |
| User verification | Confirm scale, topology, doors and exits |
| Building model | Shared source of truth for 2D, 3D and simulator |
| 3D renderer | Visualize confirmed geometry; **does not** determine evacuation performance |
| Simulator | Calculate movement, path availability, bottlenecks, and metrics |
| Meta agent | Select stress scenarios, call tools, interpret measured outputs |
| Report layer | Display evidence, comparisons, provenance, assumptions |

---

## 5. Building data model

Define and validate an explicit schema with Zod. It should include stable IDs and SI units, not pixels, for geometric computations.

```ts
interface Point2D { x: number; y: number } // meters
interface Wall { id: string; start: Point2D; end: Point2D; thicknessM: number }
interface Door { id: string; wallId: string; centerOffsetM: number; widthM: number; isExit: boolean }
interface Room { id: string; name: string; polygon: Point2D[]; occupants: number }
interface Obstacle { id: string; polygon: Point2D[] }
interface Floor {
  id: string; level: number; elevationM: number; heightM: number;
  walls: Wall[]; doors: Door[]; rooms: Room[]; obstacles: Obstacle[];
}
interface Building { id: string; name: string; units: 'meters'; floors: Floor[]; version: number }
```

This is a **starter schema**, not a complete production data model. Extend it with explicit room-door connectivity, entrances/exit destinations, the source file reference, import confidence, confirmed status, scale metadata, occupant starting locations, and scenario modifications. Ensure all geometry used by simulation is validated and confirmed.

### Import rules

- PNG/JPG/PDF: render as underlay, allow manual tracing; provide assisted extraction only after reliable baseline works.
- SVG/DXF: future vector extraction, with unit checks and normalization.
- IFC: future BIM parsing; viewing geometry alone is not sufficient to establish navigability.
- Don't claim a plan provides real heights, widths, or connectivity if the information isn't there.

---

## 6. Simulation specification (MVP)

Use a simple fixed-time-step, seeded, grid-based or graph-based approach. Avoid claiming realistic human behavior without empirical calibration.

**Inputs:** confirmed walkable geometry, doors/exits, occupant starting locations, nominal movement assumptions, timestep, seed, scenario blockages/capacity changes.  
**Engine:** build walkability and connectivity; route via A* or Dijkstra; move agents under collision/capacity simplifications; optionally reroute when a passage becomes blocked; log positions and passage usage per timestep.  
**Outputs:** total simulated time, evacuated count, unreachable count, occupancy over time, maximum queue/congestion indicator, per-door throughput, per-room completion, trajectories/frames for replay.

**Must-pass tests:**

1. Same inputs + same seed → same metrics and movement replay.
2. A blocked exit cannot be used.
3. A fully disconnected room reports occupants as unreachable.
4. Narrower corridor capacity changes throughput in a controlled test.
5. No teleporting through walls; all destinations are reachable through connected openings.
6. Missing scale, malformed geometry, or invalid occupancy produces explicit validation errors.

Clearly label outputs as **simplified model estimates**, not real-world evacuation predictions. Store model settings in every result for reproducibility.

---

## 7. Meta AI agent specification

**Core requirement:** Use an actual Meta model, accessed with appropriate hackathon authorization and credentials. Confirm the exact available model IDs, limits, endpoint, tool-calling protocol, and cost in the official account documentation before coding integration. Do not hardcode assumptions about an API response shape or model availability.

### Allowed agent capabilities

1. `inspectBuilding(buildingId)` → verified topology summary, exits, chokepoints, occupancy.
2. `proposeScenario(buildingId, constraints)` → typed disruption object (blocked exit/door, corridor restriction, distribution adjustment).
3. `runSimulation(buildingId, scenario, seed)` → validated numerical metrics and trace ID.
4. `compareRuns(runIds)` → deterministic deltas and ranked conditions.
5. `suggestRevision(buildingId, evidence)` → **proposal only**, not silent geometry mutation.

Validate every tool argument with Zod and verify object IDs exist. Limit scenario count and tool calls, timeouts, payload sizes, and model cost. Guard against prompt injection in imported document text. Keep API credentials in server environment variables; `.env` must be gitignored.

### Agent cycle

```text
Verified building → Meta agent forms hypothesis
→ validates disruption against geometry
→ simulator executes bounded scenario
→ typed numerical result returned to agent
→ agent explains observed result and selects next test
→ stop at configured budget
→ compare best stress scenarios and proposed revisions
```

**Evaluation:** Compare agent-selected scenarios against random and/or simple heuristic selection using identical buildings, seeds, scenario budgets, and allowable actions. Report worst modeled clearance time, unreachable count, distinct bottlenecks, invalid proposals, and latency/cost. Do not claim AI superiority unless measured.

A chat-like “Ask about results” panel can be added later but must not replace the tool-using agent.

---

## 8. Suggested project structure

```text
exitlab/
  README.md
  IMPLEMENTATION_STATUS.md
  docs/
    PRD.md
    ARCHITECTURE.md
    BUILDING_SCHEMA.md
    SIMULATION_SPEC.md
    AGENT_SPEC.md
    SAFETY_AND_LIMITATIONS.md
  apps/
    web/                 # React frontend
    api/                 # Backend Meta integration
  packages/
    schemas/             # Zod / shared TS types
    geometry/            # Geometry normalization and validation
    simulation/          # Pure simulation logic and tests
    agent/               # Typed tool orchestration
  public/
    samples/             # Self-created or appropriately licensed floor plans
  tests/
    fixtures/            # Reproducible sample buildings/scenarios
```

Use a simpler single-app layout if Antigravity determines the monorepo would slow the MVP; preserve modular boundaries either way.

---

## 9. Build sequence (ten-day priority plan)

| Day | Main deliverable | Definition of done |
|---|---|---|
| 1 | Repo, design tokens, demo building, schema | App runs; schema validates sample building |
| 2 | Simulation core | Automated deterministic tests pass |
| 3 | Scenario variants and replay data | Blocked exit and congestion tests work |
| 4 | Meta API and agent loop | Actual model selects and evaluates valid tool calls |
| 5 | Dashboard and 2D editor | Building can be edited, validated, and saved |
| 6 | 3D renderer | Same geometry displayed in 2D and 3D |
| 7 | PNG/JPG/PDF import + calibration | User imports, traces/corrects, confirms geometry |
| 8 | AI activity, results dashboard | Real runs show traceable metrics and comparisons |
| 9 | Reports, benchmark, accessibility, error states | End-to-end tests and demo route pass |
| 10 | Polish, public docs, demo and submission | Reproducible deployment, honest feature claims |

Reprioritize based on model access and working code. If running behind, **protect the deterministic simulator + real Meta tool-use loop + clear comparison demo** and postpone AI import automation, extra formats and detailed 3D effects.

---

## 10. Repository, licensing, and hackathon compliance

- Keep repository **public** as specified in hackathon FAQ.
- Clearly identify features developed during the hackathon, and do not show earlier functionality as new work.
- Use self-created or legally usable building-plan samples, fonts, icons, and images; record attribution/licenses.
- Never commit private building plans, credentials, or confidential data.
- Disclose limitations and ensure demo screenshots/metrics are genuine or labeled illustrative.
- Verify project eligibility and safety framing with organizers if needed.
- Maintain clear commits, README instructions, architecture diagram, setup commands, and reproducible test scripts.

---

## 11. Definition of a successful MVP

**ExitLab is demonstrably working when:**

- A user loads a real or sample floor-plan image and creates **verified** navigable building geometry.
- The geometry appears consistently in 2D and a simplified 3D cutaway.
- A deterministic simulation can run a baseline and a blocked-exit condition and provide measurable, reproducible differences.
- An actual Meta-powered agent can inspect the building, select and execute multiple valid tests via tools, and interpret **real** simulator outputs.
- The interface shows agent actions, simulations, comparison metrics, and assumptions; a report can be exported.
- Tests pass and a new developer can run the public project from the README.

### Explicit status at document creation

| Item | Status |
|---|---|
| Project concept and core use cases | **Defined in discussions** |
| Hybrid visual direction / eight screen concepts | **Mockups only; not implemented** |
| Technical architecture and scope | **Proposed in this document** |
| Source code, APIs, database, frontend | **Not verified / no repository inspected** |
| Model API access and actual model calls | **Not verified** |
| Real simulation engine or validated results | **Not implemented or verified here** |
| Import-to-3D workflow | **Design only** |
| Testing, deployment, compliance, public repository | **Not verified** |

---

## 12. First command/prompt for Antigravity

> You are the engineering agent for ExitLab. Read `EXITLAB_ANTIGRAVITY_GUIDE.md` completely. First inspect the repository and report existing files, commands, dependencies and working features. Create `IMPLEMENTATION_STATUS.md` with verified **Done / In progress / Not started** entries and a prioritized issue list. Do not claim mockups or planned features are implemented. Then implement the smallest vertical slice: load the self-created sample building through the shared validated schema, render its 2D view, simulate a deterministic baseline and blocked-exit scenario, and display actual metric differences. Add unit tests and run them. Keep components modular, use the hybrid color tokens and meet the safety boundaries in this guide. Do not introduce additional features before this slice is demonstrably working. Explain changed files and how to run/test them.

---

**Principle:** Build a scientifically honest and repeatable **AI stress-testing demonstration**, not a dramatic animation that implies verified emergency safety.
