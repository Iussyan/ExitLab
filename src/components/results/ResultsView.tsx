import React from 'react';
import {
  BarChart2,
  TrendingUp,
  Clock,
  DoorOpen,
  Compass,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ShieldAlert
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

export const ResultsView: React.FC = () => {
  const { currentRun, baselineRun, building, setActiveTab } = useProject();

  const activeRun = currentRun || baselineRun;

  if (!activeRun) {
    return (
      <div className="p-16 text-center text-slate-500 space-y-3">
        <BarChart2 className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="text-base font-bold text-slate-800">No Simulation Data Available</h3>
        <p className="text-xs">Run a baseline or AI stress test to inspect metrics and bottleneck rankings.</p>
      </div>
    );
  }

  const baseM = baselineRun?.metrics;
  const currM = activeRun.metrics;
  const isCandidate = activeRun.runId !== baselineRun?.runId;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-[#315CFA] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
            Run Analysis & Chokepoint Metrics
          </span>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">
            {activeRun.scenario.name}
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Run ID: {activeRun.runId} • Building: {building.name}
          </p>
        </div>

        <button
          onClick={() => setActiveTab('report')}
          className="btn-outline text-xs py-2 px-3.5 shadow-xs"
        >
          <FileText className="w-4 h-4 text-slate-600" />
          Generate Printable Report
        </button>
      </div>

      {/* Metrics Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Clearance Time */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium mb-1 flex items-center justify-between">
            <span>Clearance Time (100%)</span>
            <Clock className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            {currM.clearanceTimeSeconds !== null ? `${currM.clearanceTimeSeconds}s` : 'Incomplete'}
          </div>
          {isCandidate && baseM?.clearanceTimeSeconds && currM.clearanceTimeSeconds && (
            <div className="text-[11px] font-semibold text-amber-600 mt-1">
              +{parseFloat((currM.clearanceTimeSeconds - baseM.clearanceTimeSeconds).toFixed(1))}s vs Baseline
            </div>
          )}
        </div>

        {/* Evacuated Agents */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium mb-1 flex items-center justify-between">
            <span>Evacuated Occupants</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            {currM.exitedCount} <span className="text-sm text-slate-400 font-normal">/ {currM.totalSpawned}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {((currM.exitedCount / currM.totalSpawned) * 100).toFixed(0)}% exit completion rate
          </div>
        </div>

        {/* Unreachable / Trapped */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium mb-1 flex items-center justify-between">
            <span>Trapped (Unreachable)</span>
            <AlertTriangle className={`w-4 h-4 ${currM.unreachableCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-extrabold font-mono ${currM.unreachableCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {currM.unreachableCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {currM.unreachableCount > 0 ? 'Requires egress route redesign' : 'All occupants reached exits'}
          </div>
        </div>

        {/* Max Queue Buildup */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium mb-1 flex items-center justify-between">
            <span>Max Queue Buildup</span>
            <Compass className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            {currM.maxQueueLength} <span className="text-sm text-slate-400 font-normal">occupants</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            At peak chokepoint transit interval
          </div>
        </div>
      </div>

      {/* Two Column Section: Door Throughputs & Bottlenecks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Door Throughputs */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Passage & Doorway Throughput</h3>
            <span className="text-xs text-slate-400 font-mono">{currM.doorThroughput.length} doors tracked</span>
          </div>

          <div className="space-y-3">
            {currM.doorThroughput.map(dt => (
              <div key={dt.doorId} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    {dt.isExit ? (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 rounded">EXIT</span>
                    ) : (
                      <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 rounded">INTERIOR</span>
                    )}
                    {dt.doorId}
                  </span>
                  <span className="font-bold text-slate-900 font-mono">{dt.totalPassed} agents passed</span>
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
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Identified Bottleneck Cells</h3>
            <span className="text-xs text-slate-400 font-mono">{currM.bottleneckCells.length} congested zones</span>
          </div>

          {currM.bottleneckCells.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No severe bottlenecks detected. All occupants transitioned with minimal stall events.
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
