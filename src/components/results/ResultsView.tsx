import React, { useState, useRef, useEffect } from 'react';
import {
  BarChart2,
  TrendingUp,
  Clock,
  DoorOpen,
  Compass,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Play,
  Layers,
  ChevronDown,
  Box
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { SimulationResult } from '../../simulation/types';

export const ResultsView: React.FC = () => {
  const {
    currentRun,
    baselineRun,
    availableRuns,
    setCurrentRun,
    building,
    validation,
    runCurrentSimulation,
    setActiveTab,
    setIs3DMode,
    setActiveScenario,
  } = useProject();

  const [selectedRunId, setSelectedRunId] = useState<string>(
    currentRun?.runId || baselineRun?.runId || ''
  );
  const [heatmapMode, setHeatmapMode] = useState<'congestion' | 'bottlenecks'>('congestion');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active run selected by user, falling back to current or baseline
  const activeRun: SimulationResult | null =
    availableRuns.find(r => r.runId === selectedRunId) ||
    currentRun ||
    baselineRun;

  const floor = building.floors[0];

  // Render 2D Heatmap Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !floor || !activeRun) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

    const bWidth = Math.max(1, maxX - minX + 2);
    const bHeight = Math.max(1, maxY - minY + 2);

    const baseScale = Math.min((width - 60) / bWidth, (height - 60) / bHeight);
    const offsetX = (width - bWidth * baseScale) / 2 - (minX - 1) * baseScale;
    const offsetY = (height - bHeight * baseScale) / 2 - (minY - 1) * baseScale;

    const toScreenX = (wx: number) => offsetX + wx * baseScale;
    const toScreenY = (wy: number) => offsetY + wy * baseScale;
    const toScreenDist = (m: number) => m * baseScale;

    // 1. Draw Rooms
    floor.rooms.forEach(room => {
      if (room.outline.length < 3) return;
      ctx.beginPath();
      ctx.moveTo(toScreenX(room.outline[0].x), toScreenY(room.outline[0].y));
      for (let i = 1; i < room.outline.length; i++) {
        ctx.lineTo(toScreenX(room.outline[i].x), toScreenY(room.outline[i].y));
      }
      ctx.closePath();
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // 2. Draw Congestion Heatmap Cells
    const bounds = activeRun.gridBounds;
    const cellSizeM = bounds.cellSizeM;
    const grid = activeRun.congestionGrid;

    if (heatmapMode === 'congestion' && grid) {
      // Find max congestion value for normalization
      let maxVal = 1;
      for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
          if (grid[y][x] > maxVal) maxVal = grid[y][x];
        }
      }

      for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
          const val = grid[y][x];
          if (val <= 0) continue;

          const ratio = Math.min(1.0, val / Math.max(5, maxVal));
          const worldX = bounds.minX + x * cellSizeM;
          const worldY = bounds.minY + y * cellSizeM;

          const sx = toScreenX(worldX);
          const sy = toScreenY(worldY);
          const sw = toScreenDist(cellSizeM) + 0.5;
          const sh = toScreenDist(cellSizeM) + 0.5;

          // Color gradient from cyan/blue -> amber -> bright red
          if (ratio > 0.65) {
            ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + ratio * 0.45})`; // Red
          } else if (ratio > 0.3) {
            ctx.fillStyle = `rgba(245, 158, 11, ${0.35 + ratio * 0.4})`; // Amber
          } else {
            ctx.fillStyle = `rgba(59, 130, 246, ${0.25 + ratio * 0.35})`; // Blue
          }

          ctx.fillRect(sx, sy, sw, sh);
        }
      }
    }

    // 3. Draw Solid Walls & Doors
    floor.walls.forEach(wall => {
      ctx.beginPath();
      ctx.moveTo(toScreenX(wall.start.x), toScreenY(wall.start.y));
      ctx.lineTo(toScreenX(wall.end.x), toScreenY(wall.end.y));
      ctx.lineWidth = Math.max(2, toScreenDist(wall.thicknessM));
      ctx.strokeStyle = '#1e293b';
      ctx.lineCap = 'round';
      ctx.stroke();
    });

    floor.doors.forEach(door => {
      const wall = floor.walls.find(w => w.id === door.wallId);
      if (!wall) return;

      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const wallLen = Math.sqrt(dx * dx + dy * dy);
      if (wallLen < 1e-4) return;

      const ux = dx / wallLen;
      const uy = dy / wallLen;

      const dStartX = wall.start.x + ux * door.offsetM;
      const dStartY = wall.start.y + uy * door.offsetM;
      const dEndX = wall.start.x + ux * (door.offsetM + door.widthM);
      const dEndY = wall.start.y + uy * (door.offsetM + door.widthM);

      const isBlocked = activeRun.scenario.blockedDoorIds.includes(door.id);

      ctx.beginPath();
      ctx.moveTo(toScreenX(dStartX), toScreenY(dStartY));
      ctx.lineTo(toScreenX(dEndX), toScreenY(dEndY));
      ctx.lineWidth = 4;
      ctx.strokeStyle = isBlocked ? '#ef4444' : door.kind === 'exit' ? '#16a477' : '#315cfa';
      ctx.stroke();
    });

    // 4. Draw Bottleneck Cell Markers
    activeRun.metrics.bottleneckCells.forEach((b, idx) => {
      const sx = toScreenX(b.worldX);
      const sy = toScreenY(b.worldY);

      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(idx + 1), sx, sy);
    });
  }, [floor, activeRun, heatmapMode]);

  if (!activeRun) {
    return (
      <div className="p-12 md:p-16 text-center text-slate-500 space-y-4 max-w-md mx-auto">
        <BarChart2 className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="text-base font-bold text-slate-800">No Simulation Data Available</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Run a baseline evacuation or AI stress test to inspect spatial congestion heatmaps, queueing, and bottleneck rankings.
        </p>
        {validation.valid && (
          <button
            onClick={() => runCurrentSimulation()}
            className="btn-primary text-xs py-2 px-4 shadow-sm mx-auto"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Run Evacuation Simulation Now
          </button>
        )}
      </div>
    );
  }

  const baseM = baselineRun?.metrics;
  const currM = activeRun.metrics;
  const isCandidate = activeRun.runId !== baselineRun?.runId;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
      {/* Header & Run Selector Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-[#315CFA] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
            Spatial Congestion & Chokepoint Metrics
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            {activeRun.scenario.name}
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Run ID: {activeRun.runId} • Building: {building.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Run Switcher Dropdown */}
          {availableRuns.length > 1 && (
            <div className="relative">
              <select
                value={activeRun.runId}
                onChange={e => {
                  const chosen = availableRuns.find(r => r.runId === e.target.value);
                  if (chosen) {
                    setSelectedRunId(chosen.runId);
                    setCurrentRun(chosen);
                    setActiveScenario(chosen.scenario);
                  }
                }}
                className="bg-white border border-slate-300 rounded-lg text-xs font-semibold px-3 py-2 text-slate-800 shadow-xs outline-none focus:border-[#315CFA]"
              >
                {availableRuns.map((r, i) => (
                  <option key={r.runId} value={r.runId}>
                    {r.runId === baselineRun?.runId ? '★ Baseline' : `Scenario: ${r.scenario.name}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => {
              setCurrentRun(activeRun);
              setActiveScenario(activeRun.scenario);
              setIs3DMode(true);
              setActiveTab('simulation3d');
            }}
            className="btn-outline text-xs py-2 px-3 shadow-xs"
          >
            <Box className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">3D Replay</span>
          </button>

          <button
            onClick={() => setActiveTab('report')}
            className="btn-primary text-xs py-2 px-3.5 shadow-xs"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Export Report</span>
          </button>
        </div>
      </div>

      {/* Metrics Comparison Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Clearance Time */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium mb-1 flex items-center justify-between">
            <span>Clearance Time (100%)</span>
            <Clock className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono">
            {currM.clearanceTimeSeconds !== null ? `${currM.clearanceTimeSeconds}s` : 'Incomplete'}
          </div>
          {isCandidate && baseM?.clearanceTimeSeconds && currM.clearanceTimeSeconds && (
            <div className="text-[11px] font-semibold text-amber-600 mt-1">
              +{parseFloat((currM.clearanceTimeSeconds - baseM.clearanceTimeSeconds).toFixed(1))}s vs Baseline
            </div>
          )}
        </div>

        {/* Evacuated Agents */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium mb-1 flex items-center justify-between">
            <span>Evacuated Occupants</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono">
            {currM.exitedCount} <span className="text-xs sm:text-sm text-slate-400 font-normal">/ {currM.totalSpawned}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {((currM.exitedCount / currM.totalSpawned) * 100).toFixed(0)}% completion rate
          </div>
        </div>

        {/* Unreachable / Trapped */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium mb-1 flex items-center justify-between">
            <span>Trapped (Unreachable)</span>
            <AlertTriangle className={`w-4 h-4 ${currM.unreachableCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-xl sm:text-2xl font-extrabold font-mono ${currM.unreachableCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {currM.unreachableCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {currM.unreachableCount > 0 ? 'Blocked egress chokepoint' : 'All reached outside exits'}
          </div>
        </div>

        {/* Max Queue Buildup */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium mb-1 flex items-center justify-between">
            <span>Max Queue Buildup</span>
            <Compass className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono">
            {currM.maxQueueLength} <span className="text-xs sm:text-sm text-slate-400 font-normal">occupants</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Peak wait at doorway chokepoints
          </div>
        </div>
      </div>

      {/* Visual Spatial Heatmap Canvas Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              Spatial Congestion & Bottleneck Map
            </h3>
            <p className="text-xs text-slate-500">
              Visual floor plan overlaying grid visit density and identified bottleneck hotspots
            </p>
          </div>

          {/* Heatmap Legend */}
          <div className="flex items-center gap-3 text-xs bg-slate-50 p-1.5 px-3 rounded-lg border border-slate-200">
            <span className="text-slate-500 font-medium text-[11px]">Density:</span>
            <span className="flex items-center gap-1 text-[11px]">
              <span className="w-3 h-2.5 rounded bg-blue-500/50" /> Low Flow
            </span>
            <span className="flex items-center gap-1 text-[11px]">
              <span className="w-3 h-2.5 rounded bg-amber-500/70" /> Congested
            </span>
            <span className="flex items-center gap-1 text-[11px]">
              <span className="w-3 h-2.5 rounded bg-rose-500/80" /> Bottleneck
            </span>
          </div>
        </div>

        {/* Heatmap Canvas */}
        <div className="flex items-center justify-center p-2 bg-slate-50 rounded-xl border border-slate-200/80 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={950}
            height={520}
            className="max-w-full max-h-[500px] object-contain rounded-lg bg-white shadow-xs"
          />
        </div>
      </div>

      {/* Two Column Section: Door Throughputs & Bottlenecks List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Door Throughputs */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Passage & Doorway Flow Rates</h3>
            <span className="text-xs text-slate-400 font-mono">{currM.doorThroughput.length} doors tracked</span>
          </div>

          <div className="space-y-2.5">
            {currM.doorThroughput.map(dt => (
              <div key={dt.doorId} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    {dt.isExit ? (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 rounded">EXIT</span>
                    ) : (
                      <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 rounded">INTERIOR</span>
                    )}
                    {dt.doorId}
                  </span>
                  <span className="font-bold text-slate-900 font-mono">{dt.totalPassed} passed</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Measured Flow Rate:</span>
                  <span className="font-semibold text-slate-700">{dt.flowRatePerSec} agents/sec</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Identified Bottleneck Hotspots */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Ranked Bottleneck Hotspots</h3>
            <span className="text-xs text-slate-400 font-mono">{currM.bottleneckCells.length} congested zones</span>
          </div>

          {currM.bottleneckCells.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No severe bottleneck queues detected under this scenario.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto">
              {currM.bottleneckCells.slice(0, 8).map((b, idx) => (
                <div key={idx} className="p-3 bg-rose-50/60 rounded-lg border border-rose-100 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-rose-950 block">
                      Hotspot #{idx + 1} {b.doorId ? `(Door ${b.doorId})` : ''}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Location: X={b.worldX.toFixed(2)}m, Y={b.worldY.toFixed(2)}m
                    </span>
                  </div>
                  <span className="px-2 py-1 rounded bg-rose-200/80 text-rose-900 font-bold font-mono text-[11px]">
                    {b.totalWaitEvents} wait events
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
