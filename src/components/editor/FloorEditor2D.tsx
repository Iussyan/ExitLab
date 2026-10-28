import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  MousePointer,
  Pencil,
  DoorOpen,
  LogOut,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
  Layers,
  Sliders,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  Users,
  X,
  Plus,
  Minus
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { pointToSegment, isPointInPolygon } from '../../simulation/navgrid';
import { Door, Room, Wall, Building } from '../../schemas/building';

export type EditorMode = 'select' | 'draw-wall' | 'insert-door' | 'insert-exit' | 'delete';

export const FloorEditor2D: React.FC = () => {
  const {
    building,
    setBuilding,
    validation,
    activeScenario,
    toggleDoorBlockage,
    runCurrentSimulation,
    isSimulating,
    currentRun,
    setActiveTab,
    setIs3DMode,
  } = useProject();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Tool Modes & Selection State
  const [editorMode, setEditorMode] = useState<EditorMode>('select');
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [hoveredDoorId, setHoveredDoorId] = useState<string | null>(null);
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);

  // Drawing & Snapping State
  const [drawingStart, setDrawingStart] = useState<{ x: number; y: number } | null>(null);
  const [mouseWorld, setMouseWorld] = useState<{ x: number; y: number } | null>(null);
  const [snappedPos, setSnappedPos] = useState<{ x: number; y: number; isVertex: boolean } | null>(null);
  const [doorPreview, setDoorPreview] = useState<{
    wall: Wall;
    offsetM: number;
    widthM: number;
    isExit: boolean;
  } | null>(null);

  // History Stack for Undo
  const [history, setHistory] = useState<Building[]>([]);

  // Viewport Settings
  const [zoom, setZoom] = useState<number>(1.0);
  const [showOccupants, setShowOccupants] = useState<boolean>(true);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(true);
  const [gridSnapStep, setGridSnapStep] = useState<number>(0.5);

  const floor = building.floors[0];

  // Transform parameters for screen-to-world mapping
  const transformRef = useRef({
    baseScale: 30,
    offsetX: 40,
    offsetY: 40,
    cssWidth: 1000,
    cssHeight: 650,
  });

  // Calculate building geometric bounds
  const bounds = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (floor) {
      for (const w of floor.walls) {
        minX = Math.min(minX, w.start.x, w.end.x);
        minY = Math.min(minY, w.start.y, w.end.y);
        maxX = Math.max(maxX, w.start.x, w.end.x);
        maxY = Math.max(maxY, w.start.y, w.end.y);
      }
      for (const r of floor.rooms) {
        for (const p of r.outline) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
      }
    }
    if (!isFinite(minX)) {
      minX = 0; minY = 0; maxX = 25; maxY = 15;
    }
    return { minX, minY, maxX, maxY };
  }, [floor]);

  // Push current state to undo history before making mutations
  const pushHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-15), building]);
  }, [building]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setBuilding(previous);
    setSelectedDoorId(null);
    setSelectedWallId(null);
    setSelectedRoomId(null);
    setDrawingStart(null);
  }, [history, setBuilding]);

  // Convert canvas mouse event to world meters (x, y)
  const getEventWorldCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const { baseScale, offsetX, offsetY } = transformRef.current;
    const worldX = (screenX - offsetX) / baseScale;
    const worldY = (screenY - offsetY) / baseScale;
    return { worldX, worldY };
  }, []);

  // Geometric snap function: snaps to nearest vertex or orthogonal angle
  const calculateSnap = useCallback(
    (rawX: number, rawY: number, startPt: { x: number; y: number } | null) => {
      if (!floor) return { x: rawX, y: rawY, isVertex: false };

      // 1. Vertex snap: check existing wall start/end vertices within 0.35m
      for (const w of floor.walls) {
        for (const v of [w.start, w.end]) {
          const dist = Math.hypot(rawX - v.x, rawY - v.y);
          if (dist < 0.35) {
            return { x: v.x, y: v.y, isVertex: true };
          }
        }
      }

      // 2. Grid snap
      let sx = Math.round(rawX / gridSnapStep) * gridSnapStep;
      let sy = Math.round(rawY / gridSnapStep) * gridSnapStep;

      // 3. Orthogonal lock if drawing from a start point
      if (startPt) {
        const dx = Math.abs(rawX - startPt.x);
        const dy = Math.abs(rawY - startPt.y);
        if (dy < 0.4 || dy / (dx + 1e-4) < 0.25) {
          sy = startPt.y; // horizontal lock
        } else if (dx < 0.4 || dx / (dy + 1e-4) < 0.25) {
          sx = startPt.x; // vertical lock
        }
      }

      return {
        x: parseFloat(sx.toFixed(2)),
        y: parseFloat(sy.toFixed(2)),
        isVertex: false,
      };
    },
    [floor, gridSnapStep]
  );

  // Find door hit near coordinates
  const findDoorAtCoords = useCallback(
    (wx: number, wy: number): Door | null => {
      if (!floor) return null;
      for (const door of floor.doors) {
        const wall = floor.walls.find(w => w.id === door.wallId);
        if (!wall) continue;

        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const wallLen = Math.hypot(dx, dy);
        if (wallLen < 1e-4) continue;

        const ux = dx / wallLen;
        const uy = dy / wallLen;

        const dStart = {
          x: wall.start.x + ux * door.offsetM,
          y: wall.start.y + uy * door.offsetM,
        };
        const dEnd = {
          x: wall.start.x + ux * (door.offsetM + door.widthM),
          y: wall.start.y + uy * (door.offsetM + door.widthM),
        };

        const { dist } = pointToSegment({ x: wx, y: wy }, dStart, dEnd);
        if (dist <= 0.8) return door;
      }
      return null;
    },
    [floor]
  );

  // Find wall hit near coordinates
  const findWallAtCoords = useCallback(
    (wx: number, wy: number): Wall | null => {
      if (!floor) return null;
      let bestWall: Wall | null = null;
      let bestDist = Infinity;

      for (const wall of floor.walls) {
        const { dist } = pointToSegment({ x: wx, y: wy }, wall.start, wall.end);
        if (dist <= 0.4 && dist < bestDist) {
          bestWall = wall;
          bestDist = dist;
        }
      }
      return bestWall;
    },
    [floor]
  );

  // Compute door insertion preview on wall
  const computeDoorPlacement = useCallback(
    (wx: number, wy: number, isExit: boolean) => {
      if (!floor) return null;
      const targetWall = findWallAtCoords(wx, wy);
      if (!targetWall) return null;

      const { offsetAlongSegment, segLength } = pointToSegment(
        { x: wx, y: wy },
        targetWall.start,
        targetWall.end
      );

      const doorWidth = isExit ? 1.5 : 1.0;
      const maxOffset = segLength - doorWidth - 0.1;
      if (maxOffset < 0.1) return null; // Wall too short for door

      const clampedOffset = Math.max(0.1, Math.min(maxOffset, offsetAlongSegment - doorWidth / 2));

      return {
        wall: targetWall,
        offsetM: parseFloat(clampedOffset.toFixed(2)),
        widthM: doorWidth,
        isExit,
      };
    },
    [floor, findWallAtCoords]
  );

  // Keyboard navigation & tool shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Escape') {
        setEditorMode('select');
        setDrawingStart(null);
        setSelectedDoorId(null);
        setSelectedWallId(null);
        setSelectedRoomId(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedWallId || selectedDoorId) {
          handleDeleteSelected();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.key.toLowerCase() === 'w') {
        setEditorMode('draw-wall');
        setDrawingStart(null);
      } else if (e.key.toLowerCase() === 'd') {
        setEditorMode('insert-door');
      } else if (e.key.toLowerCase() === 'e') {
        setEditorMode('insert-exit');
      } else if (e.key.toLowerCase() === 'v') {
        setEditorMode('select');
        setDrawingStart(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Delete currently selected wall or door
  const handleDeleteSelected = useCallback(() => {
    if (!floor) return;

    if (selectedWallId) {
      pushHistory();
      const wallToDelete = selectedWallId;
      const doorsToRemove = new Set(
        floor.doors.filter(d => d.wallId === wallToDelete).map(d => d.id)
      );
      const updatedWalls = floor.walls.filter(w => w.id !== wallToDelete);
      const updatedDoors = floor.doors.filter(d => !doorsToRemove.has(d.id));
      const updatedExits = floor.exits.filter(e => !doorsToRemove.has(e.doorId));

      setBuilding({
        ...building,
        floors: [
          {
            ...floor,
            walls: updatedWalls,
            doors: updatedDoors,
            exits: updatedExits,
          },
        ] as [typeof floor],
      });
      setSelectedWallId(null);
    } else if (selectedDoorId) {
      pushHistory();
      const doorToDelete = selectedDoorId;
      const updatedDoors = floor.doors.filter(d => d.id !== doorToDelete);
      const updatedExits = floor.exits.filter(e => e.doorId !== doorToDelete);

      setBuilding({
        ...building,
        floors: [
          {
            ...floor,
            doors: updatedDoors,
            exits: updatedExits,
          },
        ] as [typeof floor],
      });
      setSelectedDoorId(null);
    }
  }, [floor, selectedWallId, selectedDoorId, building, pushHistory, setBuilding]);

  // Main Canvas Render Loop (High-DPI Retina Scaled)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !floor) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Retina High-DPI support
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 1050;
    const cssHeight = canvas.clientHeight || 660;

    if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const { minX, minY, maxX, maxY } = bounds;
    const bWidth = Math.max(1, maxX - minX + 2);
    const bHeight = Math.max(1, maxY - minY + 2);

    const scaleX = (cssWidth - 80) / bWidth;
    const scaleY = (cssHeight - 80) / bHeight;
    const baseScale = Math.min(scaleX, scaleY) * zoom;

    const offsetX = (cssWidth - bWidth * baseScale) / 2 - (minX - 1) * baseScale;
    const offsetY = (cssHeight - bHeight * baseScale) / 2 - (minY - 1) * baseScale;

    transformRef.current = {
      baseScale,
      offsetX,
      offsetY,
      cssWidth,
      cssHeight,
    };

    const toScreenX = (wx: number) => offsetX + wx * baseScale;
    const toScreenY = (wy: number) => offsetY + wy * baseScale;
    const toScreenDist = (m: number) => m * baseScale;

    // 1. Draw Architectural 1m Grid
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = Math.floor(minX - 2); x <= Math.ceil(maxX + 2); x += 1) {
      ctx.beginPath();
      ctx.moveTo(toScreenX(x), 0);
      ctx.lineTo(toScreenX(x), cssHeight);
      ctx.stroke();
    }
    for (let y = Math.floor(minY - 2); y <= Math.ceil(maxY + 2); y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, toScreenY(y));
      ctx.lineTo(cssWidth, toScreenY(y));
      ctx.stroke();
    }

    // 2. Draw Rooms
    floor.rooms.forEach(room => {
      if (room.outline.length < 3) return;
      const isSelected = selectedRoomId === room.id;

      ctx.beginPath();
      ctx.moveTo(toScreenX(room.outline[0].x), toScreenY(room.outline[0].y));
      for (let i = 1; i < room.outline.length; i++) {
        ctx.lineTo(toScreenX(room.outline[i].x), toScreenY(room.outline[i].y));
      }
      ctx.closePath();

      ctx.fillStyle = isSelected ? 'rgba(49, 92, 250, 0.12)' : 'rgba(248, 250, 252, 0.75)';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#315CFA' : '#cbd5e1';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Room Center Label
      let sumX = 0, sumY = 0;
      for (const p of room.outline) {
        sumX += p.x;
        sumY += p.y;
      }
      const cx = sumX / room.outline.length;
      const cy = sumY / room.outline.length;

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(room.name, toScreenX(cx), toScreenY(cy) - 8);

      ctx.fillStyle = '#64748b';
      ctx.font = '600 10px Inter, sans-serif';
      ctx.fillText(`${room.occupants} occupants`, toScreenX(cx), toScreenY(cy) + 8);
    });

    // 3. Draw Solid Walls
    floor.walls.forEach(wall => {
      const isSelected = selectedWallId === wall.id;
      const isHovered = hoveredWallId === wall.id;

      ctx.beginPath();
      ctx.moveTo(toScreenX(wall.start.x), toScreenY(wall.start.y));
      ctx.lineTo(toScreenX(wall.end.x), toScreenY(wall.end.y));

      ctx.lineWidth = Math.max(3, toScreenDist(wall.thicknessM));
      ctx.strokeStyle = isSelected ? '#3b82f6' : isHovered ? '#475569' : '#0f172a';
      ctx.lineCap = 'round';
      ctx.stroke();

      // Wall endpoints handles when selected
      if (isSelected) {
        [wall.start, wall.end].forEach(v => {
          ctx.beginPath();
          ctx.arc(toScreenX(v.x), toScreenY(v.y), 4.5, 0, Math.PI * 2);
          ctx.fillStyle = '#3b82f6';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      }
    });

    // 4. Draw Doors & Exits
    floor.doors.forEach(door => {
      const wall = floor.walls.find(w => w.id === door.wallId);
      if (!wall) return;

      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const wallLen = Math.hypot(dx, dy);
      if (wallLen < 1e-4) return;

      const ux = dx / wallLen;
      const uy = dy / wallLen;

      const doorStartX = wall.start.x + ux * door.offsetM;
      const doorStartY = wall.start.y + uy * door.offsetM;
      const doorEndX = wall.start.x + ux * (door.offsetM + door.widthM);
      const doorEndY = wall.start.y + uy * (door.offsetM + door.widthM);

      const isBlocked = activeScenario.blockedDoorIds.includes(door.id) || !door.passable;
      const isSelected = selectedDoorId === door.id;
      const isHovered = hoveredDoorId === door.id;

      // Clear wall underneath door opening
      ctx.beginPath();
      ctx.moveTo(toScreenX(doorStartX), toScreenY(doorStartY));
      ctx.lineTo(toScreenX(doorEndX), toScreenY(doorEndY));
      ctx.lineWidth = Math.max(5, toScreenDist(wall.thicknessM) + 4);
      ctx.strokeStyle = isBlocked ? '#fee2e2' : '#ffffff';
      ctx.lineCap = 'butt';
      ctx.stroke();

      // Door Threshold Line
      ctx.beginPath();
      ctx.moveTo(toScreenX(doorStartX), toScreenY(doorStartY));
      ctx.lineTo(toScreenX(doorEndX), toScreenY(doorEndY));
      ctx.lineWidth = isSelected || isHovered ? 7 : 4;

      if (isBlocked) {
        ctx.strokeStyle = '#ef4444'; // Red
      } else if (door.kind === 'exit') {
        ctx.strokeStyle = '#10b981'; // Green exit
      } else {
        ctx.strokeStyle = '#3b82f6'; // Blue interior
      }
      ctx.stroke();

      // Door Badge Label
      const midX = (doorStartX + doorEndX) / 2;
      const midY = (doorStartY + doorEndY) / 2;

      ctx.save();
      ctx.translate(toScreenX(midX), toScreenY(midY));

      if (isBlocked) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.roundRect(-24, -10, 48, 20, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BLOCKED', 0, 0);
      } else if (door.kind === 'exit') {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.roundRect(-20, -10, 40, 20, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('EXIT ➔', 0, 0);
      } else {
        ctx.fillStyle = isSelected ? '#3b82f6' : '#64748b';
        ctx.beginPath();
        ctx.roundRect(-16, -9, 32, 18, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('DOOR', 0, 0);
      }
      ctx.restore();
    });

    // 5. Live CAD Construction Previews
    // Wall Drawing Preview
    if (editorMode === 'draw-wall' && drawingStart && mouseWorld && snappedPos) {
      const lenM = Math.hypot(snappedPos.x - drawingStart.x, snappedPos.y - drawingStart.y);

      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.moveTo(toScreenX(drawingStart.x), toScreenY(drawingStart.y));
      ctx.lineTo(toScreenX(snappedPos.x), toScreenY(snappedPos.y));
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = Math.max(3, toScreenDist(0.2));
      ctx.stroke();
      ctx.setLineDash([]);

      // Start & End Point Handles
      [drawingStart, snappedPos].forEach(pt => {
        ctx.beginPath();
        ctx.arc(toScreenX(pt.x), toScreenY(pt.y), 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#3b82f6';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Dimension Badge at Midpoint
      const midX = (drawingStart.x + snappedPos.x) / 2;
      const midY = (drawingStart.y + snappedPos.y) / 2;
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(toScreenX(midX) - 26, toScreenY(midY) - 18, 52, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${lenM.toFixed(2)}m`, toScreenX(midX), toScreenY(midY) - 9);
    }

    // Door Insertion Preview
    if ((editorMode === 'insert-door' || editorMode === 'insert-exit') && doorPreview) {
      const { wall, offsetM, widthM, isExit } = doorPreview;
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const wallLen = Math.hypot(dx, dy);

      if (wallLen > 0.01) {
        const ux = dx / wallLen;
        const uy = dy / wallLen;

        const dStartX = wall.start.x + ux * offsetM;
        const dStartY = wall.start.y + uy * offsetM;
        const dEndX = wall.start.x + ux * (offsetM + widthM);
        const dEndY = wall.start.y + uy * (offsetM + widthM);

        ctx.beginPath();
        ctx.moveTo(toScreenX(dStartX), toScreenY(dStartY));
        ctx.lineTo(toScreenX(dEndX), toScreenY(dEndY));
        ctx.lineWidth = 8;
        ctx.strokeStyle = isExit ? '#10b981' : '#3b82f6';
        ctx.stroke();

        // Label Badge
        const midX = (dStartX + dEndX) / 2;
        const midY = (dStartY + dEndY) / 2;
        ctx.fillStyle = isExit ? '#065f46' : '#1e3a8a';
        ctx.beginPath();
        ctx.roundRect(toScreenX(midX) - 30, toScreenY(midY) - 22, 60, 18, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isExit ? '➔ NEW EXIT' : '+ NEW DOOR', toScreenX(midX), toScreenY(midY) - 13);
      }
    }

    // 6. Draw Occupants
    if (showOccupants && currentRun && currentRun.frames.length > 0) {
      const initialFrame = currentRun.frames[0];
      initialFrame.agents.forEach(agent => {
        ctx.beginPath();
        ctx.arc(toScreenX(agent.x), toScreenY(agent.y), 3.5, 0, Math.PI * 2);
        ctx.fillStyle = agent.status === 'unreachable' ? '#ef4444' : '#315cfa';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    // 7. Metric Scale Bar (5 meters)
    const scaleBarMeters = 5;
    const barPx = toScreenDist(scaleBarMeters);
    const scaleBarX = 30;
    const scaleBarY = cssHeight - 25;

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scaleBarX, scaleBarY);
    ctx.lineTo(scaleBarX + barPx, scaleBarY);
    ctx.moveTo(scaleBarX, scaleBarY - 4);
    ctx.lineTo(scaleBarX, scaleBarY + 4);
    ctx.moveTo(scaleBarX + barPx, scaleBarY - 4);
    ctx.lineTo(scaleBarX + barPx, scaleBarY + 4);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = '600 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${scaleBarMeters}m (SI)`, scaleBarX + barPx / 2, scaleBarY - 6);

    ctx.restore();
  }, [
    building,
    floor,
    activeScenario,
    selectedDoorId,
    selectedWallId,
    selectedRoomId,
    hoveredDoorId,
    hoveredWallId,
    zoom,
    showOccupants,
    currentRun,
    bounds,
    editorMode,
    drawingStart,
    mouseWorld,
    snappedPos,
    doorPreview,
  ]);

  // Handle Mouse Move over Canvas
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getEventWorldCoords(e);
    if (!coords) return;
    setMouseWorld({ x: coords.worldX, y: coords.worldY });

    const snap = calculateSnap(coords.worldX, coords.worldY, drawingStart);
    setSnappedPos(snap);

    if (editorMode === 'draw-wall') {
      if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair';
      setDoorPreview(null);
    } else if (editorMode === 'insert-door' || editorMode === 'insert-exit') {
      if (canvasRef.current) canvasRef.current.style.cursor = 'cell';
      const preview = computeDoorPlacement(coords.worldX, coords.worldY, editorMode === 'insert-exit');
      setDoorPreview(preview);
    } else if (editorMode === 'delete') {
      if (canvasRef.current) canvasRef.current.style.cursor = 'not-allowed';
      const hitDoor = findDoorAtCoords(coords.worldX, coords.worldY);
      const hitWall = !hitDoor ? findWallAtCoords(coords.worldX, coords.worldY) : null;
      setHoveredDoorId(hitDoor?.id || null);
      setHoveredWallId(hitWall?.id || null);
    } else {
      // Select Mode
      const hoveredDoor = findDoorAtCoords(coords.worldX, coords.worldY);
      const hoveredWall = !hoveredDoor ? findWallAtCoords(coords.worldX, coords.worldY) : null;

      if (hoveredDoor || hoveredWall) {
        if (canvasRef.current) canvasRef.current.style.cursor = 'pointer';
        setHoveredDoorId(hoveredDoor?.id || null);
        setHoveredWallId(hoveredWall?.id || null);
      } else {
        if (canvasRef.current) canvasRef.current.style.cursor = 'default';
        setHoveredDoorId(null);
        setHoveredWallId(null);
      }
    }
  };

  // Handle Canvas Click: handles wall creation, door placement, and selection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getEventWorldCoords(e);
    if (!coords || !floor) return;

    if (editorMode === 'draw-wall') {
      const snap = calculateSnap(coords.worldX, coords.worldY, drawingStart);

      if (!drawingStart) {
        // First click: start drawing wall
        setDrawingStart({ x: snap.x, y: snap.y });
      } else {
        // Second click: finish wall segment
        const dist = Math.hypot(snap.x - drawingStart.x, snap.y - drawingStart.y);
        if (dist >= 0.25) {
          pushHistory();
          const newWallId = `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
          const newWall: Wall = {
            id: newWallId,
            start: { x: drawingStart.x, y: drawingStart.y },
            end: { x: snap.x, y: snap.y },
            thicknessM: 0.2,
            heightM: 2.8,
          };

          const updatedBuilding: Building = {
            ...building,
            floors: [
              {
                ...floor,
                walls: [...floor.walls, newWall],
              },
            ] as [typeof floor],
          };

          setBuilding(updatedBuilding);
          // Chain to next vertex
          setDrawingStart({ x: snap.x, y: snap.y });
          setSelectedWallId(newWallId);
        }
      }
    } else if (editorMode === 'insert-door' || editorMode === 'insert-exit') {
      const isExit = editorMode === 'insert-exit';
      const placement = computeDoorPlacement(coords.worldX, coords.worldY, isExit);

      if (placement) {
        pushHistory();
        const doorId = isExit ? `d-exit-${Date.now().toString(36)}` : `d-door-${Date.now().toString(36)}`;
        const newDoor: Door = {
          id: doorId,
          wallId: placement.wall.id,
          offsetM: placement.offsetM,
          widthM: placement.widthM,
          passable: true,
          kind: isExit ? 'exit' : 'interior',
        };

        const updatedDoors = [...floor.doors, newDoor];
        const updatedExits = isExit
          ? [
              ...floor.exits,
              {
                id: `exit-${Date.now().toString(36)}`,
                doorId,
                destination: 'outside' as const,
              },
            ]
          : floor.exits;

        const updatedBuilding: Building = {
          ...building,
          floors: [
            {
              ...floor,
              doors: updatedDoors,
              exits: updatedExits,
            },
          ] as [typeof floor],
        };

        setBuilding(updatedBuilding);
        setSelectedDoorId(doorId);
        setEditorMode('select');
        setDoorPreview(null);
      }
    } else if (editorMode === 'delete') {
      const hitDoor = findDoorAtCoords(coords.worldX, coords.worldY);
      if (hitDoor) {
        pushHistory();
        const doorToDelete = hitDoor.id;
        setBuilding({
          ...building,
          floors: [
            {
              ...floor,
              doors: floor.doors.filter(d => d.id !== doorToDelete),
              exits: floor.exits.filter(e => e.doorId !== doorToDelete),
            },
          ] as [typeof floor],
        });
        setSelectedDoorId(null);
        return;
      }

      const hitWall = findWallAtCoords(coords.worldX, coords.worldY);
      if (hitWall) {
        pushHistory();
        const wallToDelete = hitWall.id;
        const doorsToRemove = new Set(
          floor.doors.filter(d => d.wallId === wallToDelete).map(d => d.id)
        );
        setBuilding({
          ...building,
          floors: [
            {
              ...floor,
              walls: floor.walls.filter(w => w.id !== wallToDelete),
              doors: floor.doors.filter(d => !doorsToRemove.has(d.id)),
              exits: floor.exits.filter(e => !doorsToRemove.has(e.doorId)),
            },
          ] as [typeof floor],
        });
        setSelectedWallId(null);
        return;
      }
    } else {
      // Select Mode: Door click toggles blockage; wall/room click selects
      const clickedDoor = findDoorAtCoords(coords.worldX, coords.worldY);
      if (clickedDoor) {
        setSelectedDoorId(clickedDoor.id);
        setSelectedWallId(null);
        setSelectedRoomId(null);
        toggleDoorBlockage(clickedDoor.id);
        return;
      }

      const clickedWall = findWallAtCoords(coords.worldX, coords.worldY);
      if (clickedWall) {
        setSelectedWallId(clickedWall.id);
        setSelectedDoorId(null);
        setSelectedRoomId(null);
        return;
      }

      // Check room hit
      for (const room of floor.rooms) {
        if (isPointInPolygon({ x: coords.worldX, y: coords.worldY }, room.outline)) {
          setSelectedRoomId(room.id);
          setSelectedDoorId(null);
          setSelectedWallId(null);
          return;
        }
      }

      // Clicked empty canvas
      setSelectedDoorId(null);
      setSelectedWallId(null);
      setSelectedRoomId(null);
    }
  };

  // Modify room occupants in editor
  const updateRoomOccupants = (roomId: string, delta: number) => {
    if (!floor) return;
    pushHistory();
    const updatedRooms = floor.rooms.map(r => {
      if (r.id === roomId) {
        return { ...r, occupants: Math.max(0, r.occupants + delta) };
      }
      return r;
    });

    setBuilding({
      ...building,
      floors: [
        {
          ...floor,
          rooms: updatedRooms,
        },
      ] as [typeof floor],
    });
  };

  const selectedDoor = floor?.doors.find(d => d.id === selectedDoorId);
  const selectedWall = floor?.walls.find(w => w.id === selectedWallId);
  const selectedRoom = floor?.rooms.find(r => r.id === selectedRoomId);

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden relative">
      {/* Central 2D Canvas Area */}
      <div className="flex-1 flex flex-col bg-slate-100 relative overflow-hidden min-w-0" ref={containerRef}>
        {/* Validation Issues Alert Banner */}
        {!validation.valid && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 md:px-6 py-2.5 flex items-start gap-3 z-10 shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-rose-900 truncate">
                Geometry Validation Blocked: {validation.issues.length} Issues Detected
              </h4>
              <div className="text-[11px] text-rose-700 truncate font-mono mt-0.5">
                {validation.issues[0]?.code}: {validation.issues[0]?.message}
              </div>
            </div>
          </div>
        )}

        {/* CAD Tool Bar & Controls */}
        <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-1.5 flex flex-wrap items-center gap-1 shadow-md">
          {/* Tool Selector Buttons */}
          <button
            onClick={() => {
              setEditorMode('select');
              setDrawingStart(null);
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              editorMode === 'select'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Select & Toggle Blockage (V)"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Select</span>
          </button>

          <button
            onClick={() => {
              setEditorMode('draw-wall');
              setDrawingStart(null);
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              editorMode === 'draw-wall'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Draw Wall Tool (W)"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Wall</span>
          </button>

          <button
            onClick={() => {
              setEditorMode('insert-door');
              setDrawingStart(null);
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              editorMode === 'insert-door'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Add Interior Door (D)"
          >
            <DoorOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Door</span>
          </button>

          <button
            onClick={() => {
              setEditorMode('insert-exit');
              setDrawingStart(null);
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              editorMode === 'insert-exit'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Add Exterior Exit (E)"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </button>

          <button
            onClick={() => {
              setEditorMode('delete');
              setDrawingStart(null);
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              editorMode === 'delete'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Delete Tool"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>

          <div className="w-[1px] h-5 bg-slate-200 mx-1" />

          {/* Undo Action */}
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 disabled:opacity-35 transition-opacity"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-5 bg-slate-200 mx-1" />

          {/* Zoom Controls */}
          <button
            onClick={() => setZoom(z => Math.min(2.5, z + 0.15))}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.15))}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1.0)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 text-xs font-semibold px-2"
            title="Reset Zoom"
          >
            {Math.round(zoom * 100)}%
          </button>

          <div className="w-[1px] h-5 bg-slate-200 mx-1" />

          {/* Occupants Layer Toggle */}
          <button
            onClick={() => setShowOccupants(!showOccupants)}
            className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
              showOccupants ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Occupants</span>
          </button>

          {/* Mobile Inspector Toggle */}
          <button
            onClick={() => setInspectorOpen(!inspectorOpen)}
            className="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 ml-1"
            title="Toggle Properties Panel"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>

        {/* Live Instruction Banner for Active Mode */}
        {editorMode !== 'select' && (
          <div className="absolute top-16 left-3 z-10 bg-slate-900/90 text-white text-[11px] font-medium px-3.5 py-1.5 rounded-lg shadow-lg backdrop-blur-md flex items-center gap-2">
            {editorMode === 'draw-wall' && (
              <span>
                {drawingStart
                  ? 'Click next point to complete wall. (Esc to cancel)'
                  : 'Click on grid or wall vertex to start drawing wall.'}
              </span>
            )}
            {editorMode === 'insert-door' && (
              <span>Hover over any wall to preview, click to insert 1.0m interior door.</span>
            )}
            {editorMode === 'insert-exit' && (
              <span>Hover over an exterior wall, click to insert 1.5m exterior exit door.</span>
            )}
            {editorMode === 'delete' && (
              <span className="text-rose-300">Click any wall or door to remove it permanently.</span>
            )}
            <button
              onClick={() => {
                setEditorMode('select');
                setDrawingStart(null);
              }}
              className="ml-2 hover:bg-slate-800 p-0.5 rounded text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main 2D Drawing Canvas */}
        <div className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-hidden relative">
          <canvas
            ref={canvasRef}
            className="w-full h-full max-w-[1200px] max-h-[800px] bg-white rounded-xl shadow-md border border-slate-200"
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            onDoubleClick={() => setDrawingStart(null)}
          />
        </div>
      </div>

      {/* Right Properties & Inspector Drawer */}
      <div
        className={`w-full lg:w-80 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col shrink-0 shadow-sm z-20 ${
          inspectorOpen ? 'block' : 'hidden lg:flex'
        }`}
      >
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            CAD Inspector & Properties
          </h3>
          <button
            onClick={() => setInspectorOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-slate-600 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Selection State Details */}
          {selectedWall && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Selected Wall</span>
                <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {selectedWall.id}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-600">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-sans">Start Point</span>
                  ({selectedWall.start.x}m, {selectedWall.start.y}m)
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-sans">End Point</span>
                  ({selectedWall.end.x}m, {selectedWall.end.y}m)
                </div>
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500">Wall Length:</span>
                <span className="font-bold text-slate-800">
                  {Math.hypot(
                    selectedWall.end.x - selectedWall.start.x,
                    selectedWall.end.y - selectedWall.start.y
                  ).toFixed(2)}m
                </span>
              </div>
              <button
                onClick={handleDeleteSelected}
                className="w-full btn-danger text-xs py-2 mt-2 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Wall
              </button>
            </div>
          )}

          {selectedDoor && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Selected Door</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    selectedDoor.kind === 'exit'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {selectedDoor.kind.toUpperCase()}
                </span>
              </div>
              <div className="text-xs space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span>Width:</span>
                  <span className="font-bold font-mono">{selectedDoor.widthM}m</span>
                </div>
                <div className="flex justify-between">
                  <span>Offset on Wall:</span>
                  <span className="font-bold font-mono">{selectedDoor.offsetM}m</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span
                    className={`font-bold ${
                      activeScenario.blockedDoorIds.includes(selectedDoor.id)
                        ? 'text-rose-600'
                        : 'text-emerald-600'
                    }`}
                  >
                    {activeScenario.blockedDoorIds.includes(selectedDoor.id) ? 'Blocked' : 'Passable'}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => toggleDoorBlockage(selectedDoor.id)}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    activeScenario.blockedDoorIds.includes(selectedDoor.id)
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                      : 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                  }`}
                >
                  {activeScenario.blockedDoorIds.includes(selectedDoor.id)
                    ? 'Unblock Door'
                    : 'Block Door (Simulate Hazard)'}
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="w-full btn-secondary text-xs py-1.5 text-rose-600 hover:bg-rose-50 border-rose-200 flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Door
                </button>
              </div>
            </div>
          )}

          {selectedRoom && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Selected Room</span>
                <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {selectedRoom.id}
                </span>
              </div>
              <h4 className="text-sm font-extrabold text-slate-800">{selectedRoom.name}</h4>

              {/* Occupant Stepper */}
              <div className="pt-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
                  Occupant Load
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateRoomOccupants(selectedRoom.id, -2)}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 font-bold"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="flex-1 text-center font-mono font-extrabold text-sm text-slate-800">
                    {selectedRoom.occupants}
                  </span>
                  <button
                    onClick={() => updateRoomOccupants(selectedRoom.id, 2)}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {!selectedWall && !selectedDoor && !selectedRoom && (
            <div className="text-center py-6 text-slate-400">
              <MousePointer className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
              <p className="text-xs font-semibold text-slate-600">No Element Selected</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1">
                Click any wall, door, or room to inspect and edit its properties. Use toolbar tools to add new walls and doors.
              </p>
            </div>
          )}

          {/* Grid Snap Setting */}
          <div className="pt-2 border-t border-slate-200">
            <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
              Grid Snapping Interval
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[0.25, 0.5, 1.0].map(step => (
                <button
                  key={step}
                  onClick={() => setGridSnapStep(step)}
                  className={`py-1 text-xs font-mono font-bold rounded-lg border transition-all ${
                    gridSnapStep === step
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {step}m
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Drawer Simulation Launch */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <button
            onClick={() => {
              setIs3DMode(true);
              setActiveTab('viewer3d');
            }}
            className="btn-secondary text-xs py-2 px-3 flex-1 flex items-center justify-center gap-1.5"
          >
            Open in 3D Cutaway →
          </button>
          <button
            onClick={() => runCurrentSimulation()}
            disabled={!validation.valid || isSimulating}
            className="btn-primary text-xs py-2 px-3 flex-1 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Simulate
          </button>
        </div>
      </div>
    </div>
  );
};
