import { Building, Point2, Polygon2, Wall, Door, Exit, Room, Obstacle, distance } from '../schemas/building';

export interface GridCell {
  x: number; // grid column
  y: number; // grid row
  worldX: number; // world x (meters)
  worldY: number; // world y (meters)
  walkable: boolean;
  roomId?: string;
  isDoor: boolean;
  doorId?: string;
  isExit: boolean;
  exitId?: string;
}

export interface NavGrid {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cellSizeM: number;
  cols: number;
  rows: number;
  cells: GridCell[][];
  exitCells: GridCell[];
  doorCellsMap: Map<string, GridCell[]>;
  walkableCells: GridCell[];
  roomCellsMap: Map<string, GridCell[]>;
}

/**
 * Standard ray-casting algorithm to test if point is inside a polygon.
 */
export function isPointInPolygon(pt: Point2, poly: Polygon2): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;

    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Calculate distance from point P to line segment AB, returning distance and projection distance along AB.
 */
export function pointToSegment(p: Point2, a: Point2, b: Point2): { dist: number; offsetAlongSegment: number; segLength: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const segLength = Math.sqrt(dx * dx + dy * dy);
  if (segLength < 1e-6) {
    return { dist: distance(p, a), offsetAlongSegment: 0, segLength: 0 };
  }

  const ux = dx / segLength;
  const uy = dy / segLength;

  const wAx = p.x - a.x;
  const wAy = p.y - a.y;

  const t = wAx * ux + wAy * uy;
  const clampedT = Math.max(0, Math.min(segLength, t));

  const projX = a.x + clampedT * ux;
  const projY = a.y + clampedT * uy;

  const dist = distance(p, { x: projX, y: projY });
  return { dist, offsetAlongSegment: t, segLength };
}

/**
 * Builds a 2D navigation grid from building geometry, taking into account blocked doors.
 */
export function buildNavGrid(building: Building, cellSizeM: number = 0.25, blockedDoorIds: string[] = []): NavGrid {
  const floor = building.floors[0];
  const blockedDoorSet = new Set(blockedDoorIds);

  // 1. Calculate bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const wall of floor.walls) {
    minX = Math.min(minX, wall.start.x, wall.end.x);
    minY = Math.min(minY, wall.start.y, wall.end.y);
    maxX = Math.max(maxX, wall.start.x, wall.end.x);
    maxY = Math.max(maxY, wall.start.y, wall.end.y);
  }

  for (const room of floor.rooms) {
    for (const pt of room.outline) {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
  }

  // Add 0.5m padding
  const margin = 0.5;
  minX -= margin;
  minY -= margin;
  maxX += margin;
  maxY += margin;

  const cols = Math.max(1, Math.ceil((maxX - minX) / cellSizeM));
  const rows = Math.max(1, Math.ceil((maxY - minY) / cellSizeM));

  const doorMap = new Map<string, Door>();
  for (const door of floor.doors) {
    doorMap.set(door.id, door);
  }

  const exitDoorMap = new Map<string, Exit>();
  for (const exit of floor.exits) {
    exitDoorMap.set(exit.doorId, exit);
  }

  // Organize doors by wallId
  const wallDoorsMap = new Map<string, Door[]>();
  for (const door of floor.doors) {
    const list = wallDoorsMap.get(door.wallId) || [];
    list.push(door);
    wallDoorsMap.set(door.wallId, list);
  }

  const cells: GridCell[][] = [];
  const exitCells: GridCell[] = [];
  const doorCellsMap = new Map<string, GridCell[]>();
  const walkableCells: GridCell[] = [];
  const roomCellsMap = new Map<string, GridCell[]>();

  for (const room of floor.rooms) {
    roomCellsMap.set(room.id, []);
  }

  // 2. Initialize grid
  for (let y = 0; y < rows; y++) {
    cells[y] = [];
    const worldY = minY + (y + 0.5) * cellSizeM;

    for (let x = 0; x < cols; x++) {
      const worldX = minX + (x + 0.5) * cellSizeM;
      const pt: Point2 = { x: worldX, y: worldY };

      let isInsideAnyRoom = false;
      let associatedRoomId: string | undefined = undefined;

      // Check if point is inside any room polygon
      for (const room of floor.rooms) {
        if (isPointInPolygon(pt, room.outline)) {
          isInsideAnyRoom = true;
          associatedRoomId = room.id;
          break;
        }
      }

      const cell: GridCell = {
        x,
        y,
        worldX,
        worldY,
        walkable: isInsideAnyRoom,
        roomId: associatedRoomId,
        isDoor: false,
        isExit: false,
      };

      cells[y][x] = cell;
    }
  }

  // 3. Apply Obstacles
  for (const obstacle of floor.obstacles) {
    if (!obstacle.blocksMovement) continue;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = cells[y][x];
        if (!cell.walkable) continue;
        if (isPointInPolygon({ x: cell.worldX, y: cell.worldY }, obstacle.outline)) {
          cell.walkable = false;
        }
      }
    }
  }

  // 4. Apply Walls
  for (const wall of floor.walls) {
    const halfThick = wall.thicknessM / 2 + cellSizeM * 0.35;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = cells[y][x];
        const pt: Point2 = { x: cell.worldX, y: cell.worldY };
        const { dist, offsetAlongSegment, segLength } = pointToSegment(pt, wall.start, wall.end);

        // Check if cell is within the wall solid body
        if (dist <= halfThick && offsetAlongSegment >= -cellSizeM * 0.35 && offsetAlongSegment <= segLength + cellSizeM * 0.35) {
          cell.walkable = false;
        }
      }
    }
  }

  // 5. Apply Doors (carve openings through walls and establish transit thresholds)
  for (const door of floor.doors) {
    const wall = floor.walls.find(w => w.id === door.wallId);
    if (!wall) continue;

    const isBlocked = blockedDoorSet.has(door.id) || !door.passable;
    if (isBlocked) continue; // blocked doors remain impassable solid walls

    const wallThickness = wall.thicknessM;
    const doorHalfDepth = Math.max(wallThickness / 2 + cellSizeM * 0.85, 0.45);
    const doorStart = door.offsetM - cellSizeM * 0.15;
    const doorEnd = door.offsetM + door.widthM + cellSizeM * 0.15;

    const exit = exitDoorMap.get(door.id);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = cells[y][x];
        const pt: Point2 = { x: cell.worldX, y: cell.worldY };
        const { dist, offsetAlongSegment } = pointToSegment(pt, wall.start, wall.end);

        if (offsetAlongSegment >= doorStart && offsetAlongSegment <= doorEnd && dist <= doorHalfDepth) {
          cell.walkable = true;
          cell.isDoor = true;
          cell.doorId = door.id;

          const dList = doorCellsMap.get(door.id) || [];
          dList.push(cell);
          doorCellsMap.set(door.id, dList);

          if (exit) {
            cell.isExit = true;
            cell.exitId = exit.id;
            if (!exitCells.includes(cell)) {
              exitCells.push(cell);
            }
          }
        }
      }
    }
  }

  // 6. Collect final walkable and room cells
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = cells[y][x];
      if (cell.walkable) {
        walkableCells.push(cell);
        if (cell.roomId) {
          const rList = roomCellsMap.get(cell.roomId);
          if (rList && !cell.isDoor) rList.push(cell);
        }
      }
    }
  }

  // Fallback: if a tiny room has only door cells, include them so occupants can spawn
  for (const [roomId, list] of roomCellsMap.entries()) {
    if (list.length === 0) {
      for (const cell of walkableCells) {
        if (cell.roomId === roomId) list.push(cell);
      }
    }
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    cellSizeM,
    cols,
    rows,
    cells,
    exitCells,
    doorCellsMap,
    walkableCells,
    roomCellsMap,
  };
}
