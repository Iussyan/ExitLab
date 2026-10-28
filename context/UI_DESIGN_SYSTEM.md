# ExitLab — Hybrid UI/UX Implementation Contract

## Product character
Bright planning surfaces + dark immersive 3D simulator. Prioritize clarity, legibility, and factual status over decorative effects. Build responsive desktop-first layout; mobile offers view-only results where editing is impractical.

## Tokens
```css
:root {
 --brand-primary:#315CFA; --brand-ai:#7546F8;
 --surface:#F8FAFD; --surface-card:#FFFFFF; --text:#101828;
 --simulation-bg:#0D1729; --success:#16A477; --danger:#EF4444;
 --warning:#F59E0B; --border:#E4E8F0;
 --radius-card:12px;
}
```
Use Inter or Geist if available; fall back to system sans. Do not rely only on color for alerts. Distinguish **blocked**, **congested**, and **unreachable** with labels, patterns and legends.

## Global shell
- Persistent sidebar: Dashboard, Projects, Simulations, AI Stress Tests, Reports; Resources/Settings optional.
- Breadcrumb top bar. Project context and explicit save status. Context-specific right panel for editor properties or AI activity.
- No fake live indicators or fake data after wiring real operations; demo fixtures explicitly labeled.

## Screens and contracts
1. **Landing:** clear value proposition, Start Project / Try Demo, limitations statement.
2. **Dashboard:** projects, recent runs, New Project, empty-state onboarding. Do not hardcode fictitious counts.
3. **Import wizard:** upload -> page select -> scale -> detect/trace -> verify -> continue; visible uncertainty.
4. **2D editor:** pan/zoom/select, edit walls/doors/rooms/exits, undo/redo, layer toggles, properties, validation warnings. Saved canonical building model.
5. **3D workspace:** orbit/top-down views, floor/wall visibility, occupant replay, playback controls, legend, progress, 2D toggle. Dark theme contained in viewer/workspace.
6. **AI test panel:** scenario queue, hypothesis, model status, real tool-run history, stop/cancel, budget counter, valid/invalid status.
7. **Results:** baseline vs candidate metrics, congestion map, bottleneck list, run selector, assumptions and evidence links.
8. **Reports:** preview with scenario parameters, model/simulator version, metrics, caveats, export PDF/print if implemented.

## Interaction states
Each workflow must handle idle, loading, success, failed, empty, and disconnected-AI states. Save confirmation must reflect actual persistent state, never clicks alone. Confirm destructive edits. Enable simulation only for validated and reviewed geometry.

## Accessibility
Keyboard access and visible focus for primary flows; meaningful contrast and text labels; replay speed controls not animation-dependent; respect reduced motion. Keep chart legends and numeric tables alongside visualization.

## Key consistency rule
The project, run IDs, chosen scenario, time index, and camera view remain coherent across screens; do not show unexplained mismatched data or decorative numeric scores.
