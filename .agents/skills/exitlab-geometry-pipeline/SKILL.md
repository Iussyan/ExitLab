---
name: exitlab-geometry-pipeline
description: >-
  Procedures for managing building geometry schemas, validation rules, 2D floor editing, 3D cutaways, and plan import calibration.
  Use when creating building fixtures, modifying Zod schemas, updating 2D canvas drawing, 3D Three.js extrusions, or scale calibration.
---

# ExitLab Building Geometry Pipeline

This skill guides the canonical building data contract, geometric validation, 2D canvas editing, 3D isometric cutaways, and plan import calibration.

## Core Schema Contracts

All building geometry must adhere to the single canonical schema defined in [src/schemas/building.ts](file:///d:/Users/QCU/Documents/ExitLab/src/schemas/building.ts):

- **SI Units**: All coordinates and lengths use real-world meters (`units: 'm'`). Never use raw screen pixels for physics or routing calculations.
- **Single Floor (P0)**: Exactly one floor (`floors: [Floor]`) at elevation $z=0$.
- **Walls & Door Cutouts**:
  - Wall: line segment from `start` to `end` with `thicknessM` and `heightM`.
  - Door: references `wallId` with `offsetM` along the wall and `widthM`. Must satisfy `offsetM + widthM <= wallLength`.
  - Passable doors carve openings through walls in both 2D editor and 3D cutaway; blocked doors render physical impassable red barriers.
- **Exits**: An exit references a designated `Door` with `kind: 'exit'` leading outside.
- **Rooms**: Polygon outlines representing candidate walkable domains with designated occupant counts.
- **Provenance Requirements**: Imported plans cannot be simulated until `scaleConfirmed: true` and `geometryReviewed: true` are recorded in `importProvenance`.

## Key Files

- Building Schema & Validator: [src/schemas/building.ts](file:///d:/Users/QCU/Documents/ExitLab/src/schemas/building.ts)
- 2D Canvas Editor: [src/components/editor/FloorEditor2D.tsx](file:///d:/Users/QCU/Documents/ExitLab/src/components/editor/FloorEditor2D.tsx)
- 3D Cutaway Viewer: [src/components/viewer3d/Viewer3D.tsx](file:///d:/Users/QCU/Documents/ExitLab/src/components/viewer3d/Viewer3D.tsx)
- Import Wizard: [src/components/import/ImportWizard.tsx](file:///d:/Users/QCU/Documents/ExitLab/src/components/import/ImportWizard.tsx)
- Presets / Fixtures: [src/fixtures/](file:///d:/Users/QCU/Documents/ExitLab/src/fixtures/)

## Validation Checklist

Run the building validation test suite whenever altering schemas or fixtures:

```powershell
npm.cmd test -- -t "A01"
```

Verify that [validateBuildingGeometry](file:///d:/Users/QCU/Documents/ExitLab/src/schemas/building.ts#L112-L245) catches:
1. `DUPLICATE_ID`: Non-unique element IDs.
2. `DEGENERATE_WALL`: Wall segments with length $< 0.01\text{m}$.
3. `FLOATING_DOOR`: Doors referencing non-existent wall IDs.
4. `DOOR_EXCEEDS_WALL`: Door offset + width exceeding wall segment length.
5. `EXIT_MISSING_DOOR`: Exits referencing non-existent doors.
6. `SCALE_NOT_CONFIRMED`: Imported plans without user scale calibration.
