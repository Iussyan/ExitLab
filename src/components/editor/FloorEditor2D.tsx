import React, { useRef, useEffect, useState } from 'react';
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
  Maximize2
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Door, Room, Wall } from '../../schemas/building';

export const FloorEditor2D: React.FC = () => {
  const {
    building,
    validation,
    activeScenario,
    toggleDoorBlockage,
    runCurrentSimulation,
    isSimulating,
    currentRun,
    setActiveTab,
  } = useProject();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [showOccupants, setShowOccupants] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);

  const floor = building.floors[0];

  // Draw 2D canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !floor) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas size
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Compute bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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

    if (!isFinite(minX)) {
      minX = 0; minY = 0; maxX = 25; maxY = 15;
    }

    const bWidth = Math.max(1, maxX - minX + 2);
    const bHeight = Math.max(1, maxY - minY + 2);

    const scaleX = (width - 80) / bWidth;
    const scaleY = (height - 80) / bHeight;
    const baseScale = Math.min(scaleX, scaleY) * zoom;

    const offsetX = (width - bWidth * baseScale) / 2 - (minX - 1) * baseScale;
    const offsetY = (height - bHeight * baseScale) / 2 - (minY - 1) * baseScale;

    const toScreenX = (wx: number) => offsetX + wx * baseScale;
    const toScreenY = (wy: number) => offsetY + wy * baseScale;
    const toScreenDist = (m: number) => m * baseScale;

    // Draw background grid (1m major grid, 0.25m minor grid)
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
      ctx.beginPath();
      ctx.moveTo(toScreenX(room.outline[0].x), toScreenY(room.outline[0].y));
      for (let i = 1; i < room.outline.length; i++) {
        ctx.lineTo(toScreenX(room.outline[i].x), toScreenY(room.outline[i].y));
      }
      ctx.closePath();

      // Soft room tint
      const tints = ['#f8fafc', '#f1f5f9', '#f8fafc', '#f3f4f6', '#f8fafc'];
      ctx.fillStyle = tints[idx % tints.length];
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Room label & occupant count
      const centerX = room.outline.reduce((acc, p) => acc + p.x, 0) / room.outline.length;
      const centerY = room.outline.reduce((acc, p) => acc + p.y, 0) / room.outline.length;
      ctx.fillStyle = '#475569';
      ctx.font = '600 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(room.name, toScreenX(centerX), toScreenY(centerY) - 8);

      ctx.font = '500 11px Inter, sans-serif';
      ctx.fillStyle = '#64748b';
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

    // 3. Draw Walls
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
      ctx.lineWidth = isSelected ? 6 : 4;

      if (isBlocked) {
        ctx.strokeStyle = '#ef4444'; // Red for blocked
      } else if (door.kind === 'exit') {
        ctx.strokeStyle = '#16a477'; // Green for exit
      } else {
        ctx.strokeStyle = '#315cfa'; // Blue for interior door
      }
      ctx.stroke();

      // Label Door / Exit
      const midX = (doorStartX + doorEndX) / 2;
      const midY = (doorStartY + doorEndY) / 2;

      ctx.save();
      ctx.translate(toScreenX(midX), toScreenY(midY));

      if (isBlocked) {
        // Red BLOCKED Badge
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
        // Green EXIT Badge
        ctx.fillStyle = '#16a477';
        ctx.beginPath();
        ctx.roundRect(-18, -10, 36, 20, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('EXIT', 0, 0);
      }
      ctx.restore();
    });

    // 5. Draw Occupants (if enabled and current run available)
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

    // Draw Metric Scale Bar in corner (5 meters)
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
    ctx.fillText(`${scaleBarMeters} meters (SI)`, scaleBarX + barPx / 2, scaleBarY - 6);
  }, [building, activeScenario, selectedDoorId, zoom, showOccupants, currentRun]);

  return (
    <div className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Central 2D Canvas Area */}
      <div className="flex-1 flex flex-col bg-slate-100 relative">
        {/* Validation Issues Alert Banner (if errors or warnings exist) */}
        {!validation.valid && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-bold text-rose-900">
                Building Validation Blocked: {validation.issues.length} Issues Detected
              </h4>
              <ul className="text-xs text-rose-700 list-disc list-inside mt-1 space-y-0.5 font-mono">
                {validation.issues.slice(0, 4).map((issue, idx) => (
                  <li key={idx}>
                    <span className="font-bold">[{issue.code}]</span> {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Canvas Toolbar */}
        <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg p-1.5 flex items-center gap-2 shadow-sm">
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
            100%
          </button>
          <div className="w-[1px] h-4 bg-slate-200" />
          <button
            onClick={() => setShowOccupants(!showOccupants)}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
              showOccupants ? 'bg-blue-50 text-[#315CFA]' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Occupants
          </button>
        </div>

        {/* Main Canvas */}
        <div className="flex-1 flex items-center justify-center p-4">
          <canvas
            ref={canvasRef}
            width={1100}
            height={680}
            className="bg-white rounded-xl border border-slate-200 shadow-sm max-w-full max-h-full object-contain cursor-crosshair"
          />
        </div>

        {/* Quick Legend at bottom */}
        <div className="h-10 bg-white/90 backdrop-blur-md border-t border-slate-200 px-6 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-[#1e293b] rounded" /> Solid Wall
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-[#16a477] rounded" /> Passable Exit Door
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-[#315cfa] rounded" /> Interior Passage Door
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-[#ef4444] rounded" /> Blocked Door (Impassable)
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Tip: Click doors in right panel to simulate blockages
          </span>
        </div>
      </div>

      {/* Right Control & Door Inspection Panel */}
      <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full overflow-y-auto">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-sm text-slate-900">Interactive Scenario Controls</h3>
          <p className="text-xs text-slate-500 mt-0.5">Toggle door blockages to stress-test routing</p>
        </div>

        {/* Doors List */}
        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Building Doors & Exits ({floor?.doors.length ?? 0})
          </div>

          <div className="space-y-2">
            {floor?.doors.map(door => {
              const isBlocked = activeScenario.blockedDoorIds.includes(door.id);
              const isExit = door.kind === 'exit';

              return (
                <div
                  key={door.id}
                  className={`p-3 rounded-lg border text-xs transition-all ${
                    isBlocked
                      ? 'bg-rose-50/60 border-rose-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      {isExit ? (
                        <span className="text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">
                          EXIT
                        </span>
                      ) : (
                        <span className="text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">
                          INTERIOR
                        </span>
                      )}
                      {door.id}
                    </span>
                    <button
                      onClick={() => toggleDoorBlockage(door.id)}
                      className={`px-2 py-1 rounded font-semibold text-[11px] transition-colors ${
                        isBlocked
                          ? 'bg-rose-600 text-white hover:bg-rose-700'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {isBlocked ? 'Blocked (Unblock)' : 'Passable (Block)'}
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500 space-y-0.5">
                    <div>Width: <strong>{door.widthM}m</strong> • Wall: {door.wallId}</div>
                    {door.connectsRoomIds && (
                      <div>Connects: {door.connectsRoomIds.join(' ↔ ')}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Button at bottom */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-2">
          <button
            onClick={() => {
              runCurrentSimulation();
              setActiveTab('simulation3d');
            }}
            disabled={!validation.valid || isSimulating}
            className="w-full btn-primary text-xs py-2.5 justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Simulate Current Scenario in 3D
          </button>
          <button
            onClick={() => setActiveTab('agent')}
            className="w-full btn-ai text-xs py-2 justify-center"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Let Meta AI Find Vulnerabilities
          </button>
        </div>
      </div>
    </div>
  );
};
