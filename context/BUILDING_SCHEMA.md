# ExitLab — Building Data Contract (v1)

## Intent
One canonical representation drives **2D editor, 3D cutaway, routing, simulation, and reporting**. Units are meters. Scope for MVP: one floor, axis-aligned or simple polygon geometry, no arbitrary BIM fidelity.

## Coordinate system
- World `x,y` is horizontal floor plane; world `z` is vertical height in 3D.
- Floor 0 elevation `z=0`; 2D screen coordinates are converted by viewport transform only.
- All lengths and coordinates use meters. Do not silently assume scale for a scanned image.
- Coordinate origin is arbitrary but consistent per building. Polygon vertices ordered consistently; reject self-intersections.

## Canonical TypeScript shape (implement with Zod equivalent)
```ts
type Point2 = { x: number; y: number };
type Polygon2 = Point2[];
type Wall = { id: string; start: Point2; end: Point2; thicknessM: number; heightM: number };
type Door = { id: string; wallId: string; offsetM: number; widthM: number; passable: boolean; kind: 'interior'|'exit'; connectsRoomIds?: string[] };
type Room = { id: string; name: string; outline: Polygon2; occupants: number };
type Exit = { id: string; doorId: string; destination: 'outside' };
type Obstacle = { id: string; outline: Polygon2; blocksMovement: boolean };
type Floor = { id: string; elevationM: number; walls: Wall[]; doors: Door[]; rooms: Room[]; exits: Exit[]; obstacles: Obstacle[] };
type Building = { schemaVersion: 1; id: string; name: string; units: 'm'; floors: [Floor]; importProvenance?: { format: 'json'|'png'|'jpg'|'pdf'|'svg'|'dxf'|'ifc'; sourceName?: string; scaleConfirmed: boolean; geometryReviewed: boolean } };
```
Notes: `Room.outline` is a walkable-domain candidate, not proof of navigability. Derive and cache simulation walkability separately. Door placement must be checked relative to the referenced wall and the door width must fit the segment. An exit links an actual passable outside opening, not a green icon on a picture.

## Hard validation rules
- IDs unique within building; all references resolve.
- Each coordinate finite; thickness/height/door width positive; occupant count nonnegative integer, with configurable cap.
- Exactly one floor for P0. Reject malformed polygons, degenerate walls, floating doors, exit IDs referencing non-exit doors.
- Every simulated occupant spawn must lie in walkable geometry; detect unreachable areas before running.
- `importProvenance.scaleConfirmed` and `.geometryReviewed` must be true before imported geometry can be run. A hand-authored fixture can be explicitly marked verified.
- Invalid plans show actionable editor diagnostics; do not fabricate missing dimensions.

## Geometry adapters
`parseUploadedPlan() -> DraftGeometry` (untrusted), `userVerifyDraft() -> Building` (validated), `buildNavigationGrid(Building) -> NavGrid`, `render2D(Building)`, `render3D(Building)`.
Avoid maintaining independent 2D/3D coordinate datasets. Serialize with schema version; define migration before changing structure.

## Required fixtures
- `fixtures/simple-school.json`: 4–6 rooms, two exits, known scale.
- `fixtures/disconnected-room.json`: room with no valid route.
- `fixtures/narrow-door.json`: constrained passage.
- `fixtures/malformed-building.json`: rejected with a clear message.
