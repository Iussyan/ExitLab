import { z } from 'zod';

// Basic Geometric Types
export const Point2Schema = z.object({
  x: z.number().finite('Point x must be a finite number'),
  y: z.number().finite('Point y must be a finite number'),
});
export type Point2 = z.infer<typeof Point2Schema>;

export const Polygon2Schema = z.array(Point2Schema).min(3, 'A polygon must have at least 3 vertices');
export type Polygon2 = z.infer<typeof Polygon2Schema>;

// Wall definition
export const WallSchema = z.object({
  id: z.string().min(1, 'Wall ID cannot be empty'),
  start: Point2Schema,
  end: Point2Schema,
  thicknessM: z.number().positive('Wall thickness must be positive (> 0m)'),
  heightM: z.number().positive('Wall height must be positive (> 0m)'),
});
export type Wall = z.infer<typeof WallSchema>;

// Door definition
export const DoorKindSchema = z.enum(['interior', 'exit']);
export type DoorKind = z.infer<typeof DoorKindSchema>;

export const DoorSchema = z.object({
  id: z.string().min(1, 'Door ID cannot be empty'),
  wallId: z.string().min(1, 'Door wallId cannot be empty'),
  offsetM: z.number().min(0, 'Door offset from wall start cannot be negative'),
  widthM: z.number().positive('Door width must be positive (> 0m)'),
  passable: z.boolean(),
  kind: DoorKindSchema,
  connectsRoomIds: z.array(z.string()).optional(),
});
export type Door = z.infer<typeof DoorSchema>;

// Room definition
export const RoomSchema = z.object({
  id: z.string().min(1, 'Room ID cannot be empty'),
  name: z.string().min(1, 'Room name cannot be empty'),
  outline: Polygon2Schema,
  occupants: z.number().int('Occupants must be an integer').min(0, 'Occupants cannot be negative').max(5000, 'Occupant cap exceeded (max 5000)'),
});
export type Room = z.infer<typeof RoomSchema>;

// Exit definition
export const ExitSchema = z.object({
  id: z.string().min(1, 'Exit ID cannot be empty'),
  doorId: z.string().min(1, 'Exit doorId cannot be empty'),
  destination: z.literal('outside'),
});
export type Exit = z.infer<typeof ExitSchema>;

// Obstacle definition
export const ObstacleSchema = z.object({
  id: z.string().min(1, 'Obstacle ID cannot be empty'),
  outline: Polygon2Schema,
  blocksMovement: z.boolean(),
});
export type Obstacle = z.infer<typeof ObstacleSchema>;

// Safety Fixture definition (Extinguishers, Egress Arrows, Stairs, Signage)
export const SafetyFixtureKindSchema = z.enum([
  'fire_extinguisher',
  'egress_arrow',
  'stairs',
  'exit_sign',
  'alarm_pull_station',
]);
export type SafetyFixtureKind = z.infer<typeof SafetyFixtureKindSchema>;

export const SafetyFixtureSchema = z.object({
  id: z.string().min(1, 'Fixture ID cannot be empty'),
  kind: SafetyFixtureKindSchema,
  position: Point2Schema,
  rotationDeg: z.number().default(0),
  label: z.string().optional(),
});
export type SafetyFixture = z.infer<typeof SafetyFixtureSchema>;

// Floor definition
export const FloorSchema = z.object({
  id: z.string().min(1, 'Floor ID cannot be empty'),
  elevationM: z.number().finite(),
  walls: z.array(WallSchema),
  doors: z.array(DoorSchema),
  rooms: z.array(RoomSchema),
  exits: z.array(ExitSchema),
  obstacles: z.array(ObstacleSchema).default([]),
  fixtures: z.array(SafetyFixtureSchema).default([]),
});
export type Floor = z.infer<typeof FloorSchema>;

// Provenance definition
export const ImportProvenanceSchema = z.object({
  format: z.enum(['json', 'png', 'jpg', 'pdf', 'svg', 'dxf', 'ifc']),
  sourceName: z.string().optional(),
  scaleConfirmed: z.boolean(),
  geometryReviewed: z.boolean(),
});
export type ImportProvenance = z.infer<typeof ImportProvenanceSchema>;

// Building definition (Exactly 1 floor for P0)
export const BuildingSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1, 'Building ID cannot be empty'),
  name: z.string().min(1, 'Building name cannot be empty'),
  units: z.literal('m'),
  floors: z.tuple([FloorSchema]),
  importProvenance: ImportProvenanceSchema.optional(),
});
export type Building = z.infer<typeof BuildingSchema>;

// Diagnostic issue for UI & validation reporting
export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  targetId?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

// Distance helper
export function distance(p1: Point2, p2: Point2): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Comprehensive semantic and topological building validator
export function validateBuildingGeometry(building: Building): ValidationResult {
  const issues: ValidationIssue[] = [];
  const idSet = new Set<string>();

  // Check unique IDs across the building
  const registerId = (id: string, type: string) => {
    if (idSet.has(id)) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_ID',
        message: `Duplicate ID detected: "${id}" used in ${type}`,
        targetId: id,
      });
    } else {
      idSet.add(id);
    }
  };

  registerId(building.id, 'building');

  const floor = building.floors[0];
  if (!floor) {
    issues.push({
      severity: 'error',
      code: 'NO_FLOOR',
      message: 'Building must contain exactly one floor for P0',
    });
    return { valid: false, issues };
  }

  registerId(floor.id, 'floor');

  // Walls check
  const wallMap = new Map<string, Wall>();
  for (const wall of floor.walls) {
    registerId(wall.id, 'wall');
    wallMap.set(wall.id, wall);

    const length = distance(wall.start, wall.end);
    if (length < 0.01) {
      issues.push({
        severity: 'error',
        code: 'DEGENERATE_WALL',
        message: `Wall "${wall.id}" is degenerate: start and end points are nearly identical (${length.toFixed(3)}m)`,
        targetId: wall.id,
      });
    }
  }

  // Doors check
  const doorMap = new Map<string, Door>();
  for (const door of floor.doors) {
    registerId(door.id, 'door');
    doorMap.set(door.id, door);

    const wall = wallMap.get(door.wallId);
    if (!wall) {
      issues.push({
        severity: 'error',
        code: 'FLOATING_DOOR',
        message: `Door "${door.id}" references non-existent wall "${door.wallId}"`,
        targetId: door.id,
      });
      continue;
    }

    const wallLen = distance(wall.start, wall.end);
    if (door.offsetM + door.widthM > wallLen + 0.01) {
      issues.push({
        severity: 'error',
        code: 'DOOR_EXCEEDS_WALL',
        message: `Door "${door.id}" width (${door.widthM}m) + offset (${door.offsetM}m) exceeds wall length (${wallLen.toFixed(2)}m)`,
        targetId: door.id,
      });
    }

    if (door.connectsRoomIds) {
      for (const roomId of door.connectsRoomIds) {
        if (!floor.rooms.some(r => r.id === roomId)) {
          issues.push({
            severity: 'warning',
            code: 'DOOR_DANGLING_ROOM_REF',
            message: `Door "${door.id}" connects to room "${roomId}" which does not exist`,
            targetId: door.id,
          });
        }
      }
    }
  }

  // Exits check
  for (const exit of floor.exits) {
    registerId(exit.id, 'exit');
    const door = doorMap.get(exit.doorId);
    if (!door) {
      issues.push({
        severity: 'error',
        code: 'EXIT_MISSING_DOOR',
        message: `Exit "${exit.id}" references non-existent door "${exit.doorId}"`,
        targetId: exit.id,
      });
    } else if (door.kind !== 'exit') {
      issues.push({
        severity: 'error',
        code: 'EXIT_NON_EXIT_DOOR',
        message: `Exit "${exit.id}" references door "${exit.doorId}" which is marked kind="${door.kind}", not "exit"`,
        targetId: exit.id,
      });
    }
  }

  // Rooms check
  for (const room of floor.rooms) {
    registerId(room.id, 'room');
    if (room.outline.length < 3) {
      issues.push({
        severity: 'error',
        code: 'MALFORMED_ROOM_POLYGON',
        message: `Room "${room.id}" outline must contain at least 3 vertices (found ${room.outline.length})`,
        targetId: room.id,
      });
    }
  }

  // Obstacles check
  for (const obstacle of floor.obstacles) {
    registerId(obstacle.id, 'obstacle');
    if (obstacle.outline.length < 3) {
      issues.push({
        severity: 'error',
        code: 'MALFORMED_OBSTACLE_POLYGON',
        message: `Obstacle "${obstacle.id}" outline must contain at least 3 vertices`,
        targetId: obstacle.id,
      });
    }
  }

  // Safety Fixtures check (if provided)
  if (floor.fixtures) {
    for (const fixture of floor.fixtures) {
      registerId(fixture.id, 'fixture');
    }
  }

  // Provenance / Verification requirements for simulation
  if (building.importProvenance) {
    if (!building.importProvenance.scaleConfirmed) {
      issues.push({
        severity: 'error',
        code: 'SCALE_NOT_CONFIRMED',
        message: 'Building import scale has not been confirmed by user',
      });
    }
    if (!building.importProvenance.geometryReviewed) {
      issues.push({
        severity: 'error',
        code: 'GEOMETRY_NOT_REVIEWED',
        message: 'Building geometry has not been reviewed by user',
      });
    }
  }

  const hasErrors = issues.some(i => i.severity === 'error');
  return {
    valid: !hasErrors,
    issues,
  };
}
