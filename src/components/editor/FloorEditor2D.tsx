import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  DoorClosed,
  DoorOpen,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  Info,
  Layers,
  ZoomIn,
  ZoomOut,
  ChevronRight,
  ChevronLeft,
  Sliders,
  Users,
  Eye,
  CheckCircle2
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { pointToSegment, isPointInPolygon } from '../../simulation/navgrid';
import { Door, Room, Wall } from '../../schemas/building';

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

  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [hoveredDoorId, setHoveredDoorId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [showOccupants, setShowOccupants] = useState<boolean>(true);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(true);

  const floor = building.floors[0];

  // Store transform params so mouse event handlers have exact screen-to-world mapping
  const transformRef = useRef({
    baseScale: 30,
    offsetX: 40,
    offsetY: 40,
    canvasWidth: 1000,
    canvasHeight: 650,
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

  // Redraw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !floor) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const { minX, minY, maxX, maxY } = bounds;
    const bWidth = Math.max(1, maxX - minX + 2);
    const bHeight = Math.max(1, maxY - minY + 2);

    const scaleX = (width - 80) / bWidth;
    const scaleY = (height - 80) / bHeight;
    const baseScale = Math.min(scaleX, scaleY) * zoom;

    const offsetX = (width - bWidth * baseScale) / 2 - (minX - 1) * baseScale;
    const offsetY = (height - bHeight * baseScale) / 2 - (minY - 1) * baseScale;

    transformRef.current = {
      baseScale,
      offsetX,
      offsetY,
      canvasWidth: width,
      canvasHeight: height,
    };

    const toScreenX = (wx: number) => offsetX + wx * baseScale;
    const toScreenY = (wy: number) => offsetY + wy * baseScale;
    const toScreenDist = (m: number) => m * baseScale;

    // Draw background 1m grid
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = Math.floor(minX - 1); x <= Math.ceil(maxX + 1); x += 1) {
      ctx.beginPath();
      ctx.moveTo(toScreenX(x), 0);
      ctx.lineTo(toScreenX(x), height);
      ctx.stroke();
    }
    for (let y = Math.floor(minY - 1); y <= Math.ceil(maxY + 1); y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, toScreenY(y));
      ctx.lineTo(width, toScreenY(y));
      ctx.stroke();
    }

    // 1. Draw Rooms
    floor.rooms.forEach((room, idx) => {
      if (room.outline.length < 3) return;
      const isSelected = selectedRoomId === room.id;

      ctx.beginPath();
      ctx.moveTo(toScreenX(room.outline[0].x), toScreenY(room.outline[0].y));
      for (let i = 1; i < room.outline.length; i++) {
        ctx.lineTo(toScreenX(room.outline[i].x), toScreenY(room.outline[i].y));
      }
      ctx.closePath();

      // Room fill tint
      if (isSelected) {
        ctx.fillStyle = '#eff6ff';
      } else {
        const tints = ['#f8fafc', '#f1f5f9', '#f8fafc', '#f3f4f6'];
        ctx.fillStyle = tints[idx % tints.length];
      }
      ctx.fill();

      ctx.strokeStyle = isSelected ? '#315CFA' : '#cbd5e1';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.setLineDash(isSelected ? [] : [4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label & Occupant count
      const centerX = room.outline.reduce((acc, p) => acc + p.x, 0) / room.outline.length;
      const centerY = room.outline.reduce((acc, p) => acc + p.y, 0) / room.outline.length;
      ctx.fillStyle = isSelected ? '#1e40af' : '#475569';
      ctx.font = '600 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(room.name, toScreenX(centerX), toScreenY(centerY) - 8);

      ctx.font = '500 11px Inter, sans-serif';
      ctx.fillStyle = isSelected ? '#2563eb' : '#64748b';
      ctx.fillText(`${room.occupants} occupants`, toScreenX(centerX), toScreenY(centerY) + 10);
    });

    // 2. Draw Obstacles
    floor.obstacles.forEach(obs => {
      if (obs.outline.length < 3) return;
      ctx.beginPath();
      ctx.moveTo(toScreenX(obs.outline[0].x), toScreenY(obs.outline[0].y));
      for (let i = 1; i < obs.outline.length; i++) {
        ctx.lineTo(toScreenX(obs.outline[i].x), toScreenY(obs.outline[i].y));
      }
      ctx.closePath();
      ctx.fillStyle = '#94a3b8';
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // 3. Draw Solid Walls
    floor.walls.forEach(wall => {
      ctx.beginPath();
      ctx.moveTo(toScreenX(wall.start.x), toScreenY(wall.start.y));
      ctx.lineTo(toScreenX(wall.end.x), toScreenY(wall.end.y));
      ctx.lineWidth = Math.max(3, toScreenDist(wall.thicknessM));
      ctx.strokeStyle = '#1e293b';
      ctx.lineCap = 'round';
      ctx.stroke();
    });

    // 4. Draw Doors & Exits
    floor.doors.forEach(door => {
      const wall = floor.walls.find(w => w.id === door.wallId);
      if (!wall) return;

      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const wallLen = Math.sqrt(dx * dx + dy * dy);
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

      // Draw Door Threshold line
      ctx.beginPath();
      ctx.moveTo(toScreenX(doorStartX), toScreenY(doorStartY));
      ctx.lineTo(toScreenX(doorEndX), toScreenY(doorEndY));
      ctx.lineWidth = isSelected || isHovered ? 7 : 4;

      if (isBlocked) {
        ctx.strokeStyle = '#ef4444'; // Red
      } else if (door.kind === 'exit') {
        ctx.strokeStyle = '#16a477'; // Green exit
      } else {
        ctx.strokeStyle = '#315cfa'; // Blue interior
      }
      ctx.stroke();

      // Door Badge
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
        ctx.fillStyle = '#16a477';
        ctx.beginPath();
        ctx.roundRect(-18, -10, 36, 20, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('EXIT', 0, 0);
      } else {
        ctx.fillStyle = isSelected ? '#315CFA' : '#64748b';
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

    // 5. Draw Occupants
    if (showOccupants && currentRun && currentRun.frames.length > 0) {
      const initialFrame = currentRun.frames[0];
      initialFrame.agents.forEach(agent => {
        ctx.beginPath();
        ctx.arc(toScreenX(agent.x), toScreenY(agent.y), 3.5, 0, Math.PI * 2);
        if (agent.status === 'unreachable') {
          ctx.fillStyle = '#ef4444';
        } else {
          ctx.fillStyle = '#315cfa';
        }
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    // Metric Scale Bar (5 meters)
    const scaleBarMeters = 5;
    const barPx = toScreenDist(scaleBarMeters);
    const scaleBarX = 30;
    const scaleBarY = height - 25;

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
  }, [building, activeScenario, selectedDoorId, selectedRoomId, hoveredDoorId, zoom, showOccupants, currentRun, bounds]);

  // Convert canvas mouse event to real world meters (x, y)
  const getEventWorldCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleFactorX = canvas.width / rect.width;
    const scaleFactorY = canvas.height / rect.height;

    const screenX = (e.clientX - rect.left) * scaleFactorX;
    const screenY = (e.clientY - rect.top) * scaleFactorY;

    const { baseScale, offsetX, offsetY } = transformRef.current;
    const worldX = (screenX - offsetX) / baseScale;
    const worldY = (screenY - offsetY) / baseScale;
    return { worldX, worldY };
  };

  // Find door hit near coordinates
  const findDoorAtCoords = (wx: number, wy: number): Door | null => {
    if (!floor) return null;
    for (const door of floor.doors) {
      const wall = floor.walls.find(w => w.id === door.wallId);
      if (!wall) continue;

      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const wallLen = Math.sqrt(dx * dx + dy * dy);
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
      // Hit tolerance 0.9m
      if (dist <= 0.9) {
        return door;
      }
    }
    return null;
  };

  // Handle Canvas Click: toggles door blockage directly on click!
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getEventWorldCoords(e);
    if (!coords) return;

    // Check door hit
    const clickedDoor = findDoorAtCoords(coords.worldX, coords.worldY);
    if (clickedDoor) {
      setSelectedDoorId(clickedDoor.id);
      setSelectedRoomId(null);
      toggleDoorBlockage(clickedDoor.id);
      return;
    }

    // Check room hit
    if (floor) {
      for (const room of floor.rooms) {
        if (isPointInPolygon({ x: coords.worldX, y: coords.worldY }, room.outline)) {
          setSelectedRoomId(room.id);
          setSelectedDoorId(null);
          return;
        }
      }
    }

    // Clicked empty area
    setSelectedDoorId(null);
    setSelectedRoomId(null);
  };

  // Handle Mouse Move: hover cursor indicator
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getEventWorldCoords(e);
    if (!coords) return;

    const hovered = findDoorAtCoords(coords.worldX, coords.worldY);
    if (hovered) {
      setHoveredDoorId(hovered.id);
      if (canvasRef.current) canvasRef.current.style.cursor = 'pointer';
    } else {
      setHoveredDoorId(null);
      if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair';
    }
  };

  // Modify room occupants in editor
  const updateRoomOccupants = (roomId: string, delta: number) => {
    if (!floor) return;
    const updatedRooms = floor.rooms.map(r => {
      if (r.id === roomId) {
        return { ...r, occupants: Math.max(0, r.occupants + delta) };
      }
      return r;
    });

    const updatedBuilding = {
      ...building,
      floors: [
        {
          ...floor,
          rooms: updatedRooms,
        },
      ] as [typeof floor],
    };

    setBuilding(updatedBuilding);
  };

  const selectedDoor = floor?.doors.find(d => d.id === selectedDoorId);
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

        {/* Canvas Toolbar */}
        <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-md border border-slate-200 rounded-lg p-1 flex items-center gap-1.5 shadow-sm">
          <button
            onClick={() => setZoom(z => Math.min(2.5, z + 0.15))}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-700"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.15))}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-700"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1.0)}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-700 text-xs font-semibold px-2"
            title="Reset Zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <div className="w-[1px] h-4 bg-slate-200" />
          <button
            onClick={() => setShowOccupants(!showOccupants)}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
              showOccupants ? 'bg-blue-50 text-[#315CFA]' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Occupants</span>
          </button>

          {/* Toggle inspector button for small screens */}
          <button
            onClick={() => setInspectorOpen(!inspectorOpen)}
            className="lg:hidden p-1.5 hover:bg-slate-100 rounded text-slate-700 ml-1"
            title="Toggle Properties Panel"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-hidden relative">
          <canvas
            ref={canvasRef}
            width={1100}
            height={680}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            className="bg-white rounded-xl border border-slate-200 shadow-sm max-w-full max-h-full object-contain cursor-crosshair"
          />
        </div>

        {/* Interactive Tip and Quick Legend */}
        <div className="h-9 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 md:px-6 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-3 overflow-x-auto text-[11px]">
            <span className="flex items-center gap-1 shrink-0">
              <span className="w-2.5 h-1 bg-[#1e293b] rounded" /> Wall
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <span className="w-2.5 h-1 bg-[#16a477] rounded" /> Exit
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <span className="w-2.5 h-1 bg-[#315cfa] rounded" /> Door
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <span className="w-2.5 h-1 bg-[#ef4444] rounded" /> Blocked
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Click directly on any door to block/unblock
          </span>
        </div>
      </div>

      {/* Right Control & Door Inspection Panel (Collapsible on mobile) */}
      <div
        className={`${
          inspectorOpen ? 'flex' : 'hidden lg:flex'
        } w-full lg:w-80 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex-col h-72 lg:h-full overflow-hidden shrink-0 z-10 shadow-lg lg:shadow-none`}
      >
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Scenario & Properties</h3>
            <p className="text-[11px] text-slate-500">Inspect doors, rooms & trigger simulations</p>
          </div>
          <button
            onClick={() => setInspectorOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {/* Selected Element Property Inspector */}
        {selectedRoom && (
          <div className="p-3.5 bg-blue-50/60 border-b border-blue-100 shrink-0 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-blue-900">Selected Room: {selectedRoom.name}</span>
              <span className="text-[10px] text-blue-700 font-mono">{selectedRoom.id}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Occupants:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateRoomOccupants(selectedRoom.id, -2)}
                  className="w-6 h-6 rounded bg-white border border-slate-300 font-bold text-xs hover:bg-slate-50"
                >
                  -
                </button>
                <span className="font-bold text-slate-900 min-w-8 text-center font-mono">
                  {selectedRoom.occupants}
                </span>
                <button
                  onClick={() => updateRoomOccupants(selectedRoom.id, +2)}
                  className="w-6 h-6 rounded bg-white border border-slate-300 font-bold text-xs hover:bg-slate-50"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Doors List */}
        <div className="p-3.5 space-y-2.5 flex-1 overflow-y-auto">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Doors & Exits ({floor?.doors.length ?? 0})</span>
            {activeScenario.blockedDoorIds.length > 0 && (
              <span className="text-rose-600 font-bold font-mono">
                {activeScenario.blockedDoorIds.length} blocked
              </span>
            )}
          </div>

          <div className="space-y-2">
            {floor?.doors.map(door => {
              const isBlocked = activeScenario.blockedDoorIds.includes(door.id);
              const isExit = door.kind === 'exit';
              const isSelected = selectedDoorId === door.id;

              return (
                <div
                  key={door.id}
                  onClick={() => setSelectedDoorId(door.id)}
                  className={`p-2.5 rounded-lg border text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#315CFA] ring-1 ring-blue-500/20 bg-blue-50/30'
                      : isBlocked
                      ? 'bg-rose-50/60 border-rose-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      {isExit ? (
                        <span className="text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded text-[9px] uppercase font-bold">
                          EXIT
                        </span>
                      ) : (
                        <span className="text-blue-700 bg-blue-100 px-1 py-0.2 rounded text-[9px] uppercase font-bold">
                          DOOR
                        </span>
                      )}
                      {door.id}
                    </span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        toggleDoorBlockage(door.id);
                      }}
                      className={`px-2 py-0.5 rounded font-semibold text-[11px] transition-colors ${
                        isBlocked
                          ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {isBlocked ? 'Blocked (Click)' : 'Passable'}
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Width: {door.widthM}m</span>
                    <span>Wall: {door.wallId}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons at bottom */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 space-y-2 shrink-0">
          <button
            onClick={() => {
              runCurrentSimulation();
              setIs3DMode(true);
              setActiveTab('simulation3d');
            }}
            disabled={!validation.valid || isSimulating}
            className="w-full btn-primary text-xs py-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Simulate Current Scenario in 3D
          </button>
          <button
            onClick={() => setActiveTab('agent')}
            className="w-full btn-ai text-xs py-1.5 justify-center"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Let Meta AI Find Vulnerabilities
          </button>
        </div>
      </div>
    </div>
  );
};
