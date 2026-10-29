# ExitLab

> **Architectural-Grade Tabletop Evacuation Simulation & AI Disruption Stress-Testing Platform**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r169-black?logo=three.js&logoColor=white)](https://threejs.org/)
[![React Three Fiber](https://img.shields.io/badge/R3F-8.17-black)](https://docs.pmnd.rs/react-three-fiber)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Tests-30%20Passed-brightgreen?logo=vitest&logoColor=white)](https://vitest.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)

---

## Executive Overview

**ExitLab** is an engineering-grade tabletop evacuation workbench that bridges raster 2D floor plans, interactive CAD drafting, discrete deterministic physics simulation, 3D WebGL cutaways, and autonomous Meta LLM disruption stress-testing.

Built for safety coordinators, architectural researchers, and facility managers, ExitLab transforms static building drawings into interactive digital twins. An autonomous AI agent acts as a red-team stress tester—synthesizing worst-case emergency scenarios (blocked corridors, jammed exits, localized density surges) to uncover latent egress bottlenecks before real-world emergencies occur.

---

## Key Capabilities

```
  +---------------------------------------------------------------------------------+
  |                                   ExitLab                                       |
  +-------------------+-----------------------------+-------------------------------+
  |  2D Input & CAD   |   Deterministic Physics     |   3D Digital Twin & Meta AI   |
  +-------------------+-----------------------------+-------------------------------+
  | - CV Plan Scanner | - 0.25m Spatial Grid        | - Instanced WebGL Cutaway     |
  | - 2-Pt Calibrator | - Multi-Source Dijkstra     | - 60fps useFrame Lerping      |
  | - Interactive CAD | - 1.3 pers/m/s Door Flow    | - Autonomous Disruption Agent |
  | - Snapping & Ortho| - Occupant Conservation     | - AI vs. Random Benchmarking  |
  +-------------------+-----------------------------+-------------------------------+
```

### 1. Intelligent Floor Plan Vectorization & Safety Fixture Detection
- **Computer Vision Pipeline**: Ingests raster floor plans (`PNG`, `JPG`, blueprints) and vectorizes structural walls, exterior exits, interior doors, and room zones via morphological edge tracing and flood-fill segmentation.
- **Safety Equipment Extraction**: Automatically identifies red emergency clusters (Fire Extinguishers), directional green corridors (Egress Arrows), and stairwell landings.
- **Interactive Calibration**: 2-point reference measurement tool with live metric distance calculations converts arbitrary image pixel coordinates into true physical meters.

### 2. Deterministic Evacuation Simulation Engine
- **Discrete Navigation Grid**: Discretizes building floorplates into a high-resolution $0.25\,\text{m} \times 0.25\,\text{m}$ grid, preventing diagonal corner-cutting through solid geometry.
- **Multi-Source Dijkstra Vector Fields**: Real-time potential field computation routes occupants dynamically toward the nearest clear exterior discharge exit.
- **Hydraulic Door Capacity**: Strict flow-rate throttling enforces the standard $1.3\,\text{persons} / \text{meter} / \text{second}$ door transit boundary (SFPE / NFPA 101 principles).
- **Occupant Conservation**: Formally verified invariant ($\text{Exited} + \text{Unreachable} + \text{Active} = \text{Total Spawned}$) guarantees zero agent duplication or teleportation across all ticks.
- **100% Determinism**: Seeded PRNG (`xoshiro128**`) guarantees byte-identical trajectories and egress logs across repeated runs on any machine.

### 3. Autonomous Meta AI Disruption Agent
- **LLM-Driven Stress Testing**: An integrated Meta Llama reasoning agent evaluates floor layouts, formulates structural vulnerability hypotheses, and executes guarded scenario interventions.
- **Guarded Tool Execution**: Agent interacts via typed, strictly validated tool calls (`block_door`, `block_exit`, `disable_room`, `set_occupant_density`).
- **Benchmark Against Random Controls**: Executes automated trials comparing AI-targeted disruptions against equal-budget random disruptions to evaluate bottleneck discovery efficacy.
- **Abort & Live Progress**: Responsive `AbortSignal` controller allows instant interruption while preserving partial findings and live activity traces.

### 4. Interactive 2D CAD Floor Plan Editor
- **Drafting Tools**: Rapidly modify layouts using dedicated hotkey-driven tools:
  - `W` — **Wall Tool**: Vertex snapping ($<0.35\,\text{m}$), orthogonal angle locking ($0^\circ, 90^\circ, 180^\circ, 270^\circ$), dashed construction line, and real-time metric dimension badges.
  - `D` — **Door Tool**: Interior door placement with live wall-alignment guides.
  - `E` — **Exit Tool**: Exterior discharge exit placement.
  - `X` — **Delete Tool**: Click-to-remove geometry elements.
- **CAD Controls**: Configurable snap grid ($0.25\,\text{m}$, $0.5\,\text{m}$, $1.0\,\text{m}$), undo stack (`Ctrl+Z`), and Retina-scaled canvas rendering.

### 5. 3D Cutaway Digital Twin & Spatial Heatmaps
- **High-Performance WebGL Instancing**: Renders hundreds of occupants simultaneously at 60 FPS using a single Three.js `InstancedMesh`.
- **Smooth Trajectory Interpolation**: Continuous `useFrame` vector lerping eliminates discrete grid-stepping artifacts during replay.
- **Architectural Detailing**: Realistic 3D wall extrusions, glowing green wayfinding signage (`EXIT ➔`), red hazard barricades (`BLOCKED`), floating room labels, 3D fire extinguishers, and emergency staircases.
- **Spatial Congestion Heatmaps**: 2D kernel-density overlay visualizing egress bottlenecks and crowd wait-times over the simulation duration.

---

## Modeling Principles & Invariants

| Principle | Specification | Implementation Reference |
|---|---|---|
| **Coordinate System** | Metric SI units ($x, y$ in meters, origin top-left) | [src/schemas/building.ts](file:///d:/Users/QCU/Documents/ExitLab/src/schemas/building.ts) |
| **Grid Resolution** | $0.25\,\text{m} \times 0.25\,\text{m}$ per cell | [src/simulation/navgrid.ts](file:///d:/Users/QCU/Documents/ExitLab/src/simulation/navgrid.ts) |
| **Time Discretization** | Fixed $\Delta t = 0.25\,\text{s}$ per tick | [src/simulation/engine.ts](file:///d:/Users/QCU/Documents/ExitLab/src/simulation/engine.ts) |
| **Walking Velocity** | $1.2\,\text{m/s}$ unimpeded base speed | [src/simulation/engine.ts](file:///d:/Users/QCU/Documents/ExitLab/src/simulation/engine.ts) |
| **Door Capacity Flow** | $1.3\,\text{persons} / (\text{meter} \cdot \text{second})$ | [src/simulation/engine.ts](file:///d:/Users/QCU/Documents/ExitLab/src/simulation/engine.ts) |
| **Occupant Conservation** | $\sum \text{Occupants}_{\text{final}} \equiv \sum \text{Occupants}_{\text{initial}}$ | [tests/audit.test.ts](file:///d:/Users/QCU/Documents/ExitLab/tests/audit.test.ts) |
| **Reproducibility** | Seeded PRNG (`xoshiro128**`) | [src/simulation/prng.ts](file:///d:/Users/QCU/Documents/ExitLab/src/simulation/prng.ts) |

---

## Architectural Structure

```
ExitLab/
├── src/
│   ├── schemas/              # Zod validation schemas & strongly-typed models
│   │   ├── building.ts       # Building, Floor, Wall, Door, Exit, Room, Fixtures
│   │   └── simulation.ts     # Scenario, RunParams, SimulationLog, Metric types
│   ├── simulation/           # Core deterministic physics engine
│   │   ├── engine.ts         # Agent state machine, collision queueing, door throttling
│   │   ├── navgrid.ts        # 0.25m spatial grid rasterization & line clipping
│   │   ├── pathfinding.ts    # Multi-source Dijkstra distance field calculation
│   │   └── prng.ts           # Seeded deterministic pseudo-random number generator
│   ├── agent/                # Meta Llama autonomous stress-testing
│   │   ├── orchestrator.ts   # Tool-calling loop with AbortSignal cancellation
│   │   ├── tools.ts          # Guarded disruption tools with validation
│   │   └── benchmark.ts      # AI vs. Random disruption benchmark harness
│   ├── services/             # Computer vision & vectorization
│   │   └── planDetector.ts   # Edge detection, wall vectorizer & fixture extractor
│   ├── components/           # UI views and component hierarchy
│   │   ├── viewer3d/         # 3D Three.js / R3F cutaway viewer & instanced meshes
│   │   ├── editor/           # 2D Canvas CAD floor plan drafting workspace
│   │   ├── agent/            # AI activity trace stream & scenario cards
│   │   ├── dashboard/        # Preset floor plans & summary metrics
│   │   ├── import/           # Image plan import & 2-point scale calibrator
│   │   ├── results/          # Congestion density heatmap & egress metrics
│   │   ├── report/           # Printable executive report & CSV/JSON export
│   │   └── benchmark/        # AI vs. Random performance comparison view
│   ├── fixtures/             # Canonical test and benchmark buildings
│   │   ├── residential-fire-plan.json # 22-occupant verified emergency plan
│   │   ├── simple-school.json         # 4-classroom, 2-exit baseline building
│   │   ├── narrow-door.json           # High-density bottleneck test fixture
│   │   └── disconnected-room.json     # Isolated room boundary condition fixture
│   └── App.tsx               # Lazy-routed application root with blueprint skeletons
├── server/
│   └── index.ts              # Express API server & Meta Llama LLM proxy
├── tests/
│   ├── audit.test.ts         # Invariant defense, door throttling, conservation fuzzing
│   ├── simulation.test.ts    # Determinism, wall collisions, Dijkstra routing
│   └── planDetector.test.ts  # Computer vision extraction & 100% egress verification
├── vite.config.ts            # Vite bundler config with manual chunk splitting
└── package.json              # Dependencies and execution scripts
```

---

## Quickstart & Installation

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **Package Manager**: `npm` (Windows PowerShell: use `npm.cmd`)
- **API Key (Optional)**: Meta Llama API key (compatible with Groq, Together AI, or OpenAI-compatible endpoints)

### 1. Clone & Install Dependencies
```powershell
git clone https://github.com/your-username/ExitLab.git
cd ExitLab

# Install dependencies (Windows)
npm.cmd install
```

### 2. Configure Environment
Copy [.env.example](file:///d:/Users/QCU/Documents/ExitLab/.env.example) to `.env`:
```powershell
cp .env.example .env
```
Edit `.env` to configure your API endpoint (defaults to Groq Llama 3.3 70B):
```env
PORT=3001
META_LLAMA_API_KEY=your_api_key_here
META_LLAMA_BASE_URL=https://api.groq.com/openai/v1
META_LLAMA_MODEL=llama-3.3-70b-versatile
```
> *Note: If no API key is provided, ExitLab automatically operates in 100% offline heuristic mode—no external connection required.*

### 3. Run Development Servers
Start both the backend server and Vite frontend:

**Terminal 1 — Backend Proxy:**
```powershell
npm.cmd run server
```

**Terminal 2 — Frontend Application:**
```powershell
npm.cmd run dev
```

Open your browser to `http://localhost:5173`.

---

## Verification & Testing

ExitLab includes an automated test suite enforcing physical invariants, geometric collision avoidance, door transit rates, and computer vision plan extraction.

Run the test suite:
```powershell
npm.cmd test -- --run
```

All 30 unit and integration tests pass:
- `tests/planDetector.test.ts`: CV pixel analysis, 3D fixture conversion, and full 22-occupant egress verification.
- `tests/simulation.test.ts`: Determinism, byte-identical log reproducibility, and occupant conservation.
- `tests/audit.test.ts`: Diagonal corner-cutting defense, $1.3\,\text{pers/m/s}$ door capacity throttle, and density multiplier fuzzing.

To verify production bundling:
```powershell
npm.cmd run build
```
*(Code-split chunking generates an initial bundle of just ~45 kB, eliminating heavy monolithic loads).*

---

## Step-by-Step User Workflows

### Workflow A: Turn an Image Blueprint into a 3D Plan
1. Navigate to **Import Plan** from the left sidebar.
2. Drag-and-drop any architectural drawing or click **Load Sample Blueprint**.
3. Toggle the detection layers in the sticky bar:
   - **Walls**: Structural boundaries detected via adaptive thresholding.
   - **Doors & Exits**: Transit portals color-coded in blue and green.
   - **Rooms & Labels**: Detected zone polygons and auto-calculated areas ($m^2$).
   - **Safety Equipment**: Red fire extinguisher stations and green egress arrows.
4. Set the physical scale using the **2-Point Calibrator** (click two points and enter the known distance in meters).
5. Click **Convert to 3D Plan & Run Simulation** to immediately view your building in 3D and watch occupants evacuate.

### Workflow B: Red-Team Stress-Testing with Meta AI
1. Open any building in the **AI Stress Testing** view.
2. Select an agent mode:
   - **Llama 3.3 70B (Server)**: Autonomous multi-turn reasoning with tool validation.
   - **Offline Heuristic**: Local heuristic stress search (no API required).
3. Set your test budget and click **Start AI Disruption Test**.
4. Observe the live reasoning trace as the agent probes weak points (e.g., blocking the primary exit during peak occupancy).
5. Review the ranked **Vulnerability Impact Cards** and click **Replay in 3D** to inspect crowd crush locations and detour paths.

### Workflow C: Interactive 2D CAD Editing
1. Navigate to **2D Editor**.
2. Press `W` to activate the **Wall Tool**. Click to place vertices; snap indicators and orthogonal locks assist alignment.
3. Press `D` to insert an interior door into any wall segment.
4. Press `E` to place an exterior discharge exit portal.
5. Click any door to toggle its real-time **Blockage** status (red outline) and switch to the 3D viewer to test how occupants reroute.

---

## Built-In Fixtures Reference

| Fixture Name | Path | Occupants | Exits | Key Testing Scenario |
|---|---|---|---|---|
| **Residential Fire Plan** | [residential-fire-plan.json](file:///d:/Users/QCU/Documents/ExitLab/src/fixtures/residential-fire-plan.json) | 22 | 2 | Real-world floor plan with fire equipment, garden, WC, and patio |
| **Simple School** | [simple-school.json](file:///d:/Users/QCU/Documents/ExitLab/src/fixtures/simple-school.json) | 40 | 2 | 4 classrooms, central hallway, dual exterior discharge |
| **Narrow Door Bottleneck** | [narrow-door.json](file:///d:/Users/QCU/Documents/ExitLab/src/fixtures/narrow-door.json) | 60 | 1 | $0.8\,\text{m}$ single door bottleneck testing queueing flow rates |
| **Disconnected Room** | [disconnected-room.json](file:///d:/Users/QCU/Documents/ExitLab/src/fixtures/disconnected-room.json) | 15 | 1 | Boundary testing for stranded occupants and unreachable zones |

---

## Safety & Engineering Disclaimer

> [!WARNING]
> **Exploratory Decision Support Notice**: ExitLab is an engineering simulation and tabletop research workbench designed for exploratory design comparison, academic study, and emergency scenario ideation.
>
> ExitLab **does not** constitute certified professional fire protection engineering (FPE), structural life safety design, or certified architectural compliance approval under NFPA 101, IBC, or local building regulations. All critical facility modifications must be reviewed and certified by licensed life-safety professionals.

---

## License

This project is licensed under the [MIT License](LICENSE).
