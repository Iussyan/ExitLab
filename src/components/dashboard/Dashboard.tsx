import React from 'react';
import {
  Play,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  School,
  Split,
  AlertTriangle,
  FileCheck2,
  Clock,
  Users,
  DoorOpen,
  Compass
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

export const Dashboard: React.FC = () => {
  const {
    building,
    loadFixture,
    selectedFixtureId,
    currentRun,
    baselineRun,
    runBaselineSimulation,
    setActiveTab,
    setIs3DMode,
    stressTestReport,
  } = useProject();

  const floor = building.floors[0];
  const totalOccupants = floor?.rooms.reduce((acc, r) => acc + r.occupants, 0) ?? 0;
  const exitDoors = floor?.doors.filter(d => d.kind === 'exit') ?? [];

  const presets = [
    {
      id: 'simple-school',
      name: 'Oakridge Academy Science Wing',
      tag: 'Verified Benchmark',
      description: 'Single-floor layout with 6 rooms, 70 occupants, and two dual-leaf exits (West and East).',
      icon: School,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      id: 'narrow-door',
      name: 'High-Density Assembly Hall',
      tag: 'Chokepoint Stress',
      description: 'Constrained 0.8m interior passage funneling 32-64 occupants to test queue congestion.',
      icon: Split,
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      id: 'disconnected-room',
      name: 'Sealed Archive Wing',
      tag: 'Isolation Trap Test',
      description: 'Building with a sealed room having 0 exit routes to verify unreachable occupant detection.',
      icon: AlertTriangle,
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    },
    {
      id: 'malformed',
      name: 'Corrupted Architectural Draft',
      tag: 'Schema Rejection',
      description: 'Contains degenerate walls, floating doors, and unconfirmed scale to test validation errors.',
      icon: FileCheck2,
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0D1729] via-[#152238] to-[#1e1b4b] p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Meta AI Developer Hackathon · Solo Developer Prototype
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight mb-3">
            AI-Powered Evacuation Plan Stress Testing
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            Explore building failure conditions before emergencies happen. ExitLab uses a deterministic,
            physics-simplified grid engine driven by an autonomous Meta model agent that systematically discovers
            bottlenecks, isolated rooms, and blocked egress vulnerabilities.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActiveTab('agent');
              }}
              className="btn-ai text-sm px-5 py-2.5 shadow-lg shadow-purple-500/30"
            >
              <Sparkles className="w-4 h-4" />
              Launch Meta Stress Agent
            </button>
            <button
              onClick={() => {
                runBaselineSimulation();
                setActiveTab('editor');
              }}
              className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-colors border border-white/10 flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" />
              Run Baseline Evacuation
            </button>
          </div>
        </div>

        {/* Decorative Grid Graphic */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-20 pointer-events-none flex items-center justify-center">
          <div className="w-96 h-96 rounded-full bg-blue-500 blur-3xl" />
        </div>
      </div>

      {/* Numerical Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Total Occupants</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalOccupants}</div>
          <div className="text-[11px] text-slate-500 mt-1">Across {floor?.rooms.length ?? 0} designated rooms</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Passable Exits</span>
            <DoorOpen className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{exitDoors.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Designated outside discharge doors</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Baseline Clearance Time</span>
            <Clock className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {baselineRun?.metrics.clearanceTimeSeconds ? `${baselineRun.metrics.clearanceTimeSeconds}s` : 'Pending'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {baselineRun ? `100% evacuated (${baselineRun.metrics.exitedCount} agents)` : 'Run simulation to calculate'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Critical Bottlenecks</span>
            <Compass className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {currentRun?.metrics.bottleneckCells.length ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {currentRun?.metrics.maxQueueLength ? `Max queue: ${currentRun.metrics.maxQueueLength} occupants` : 'Normal flow'}
          </div>
        </div>
      </div>

      {/* Preset Buildings Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Verified Architectural Presets</h3>
            <p className="text-xs text-slate-500">Select a self-authored synthetic floor plan to test immediately</p>
          </div>
          <button
            onClick={() => setActiveTab('import')}
            className="text-xs font-semibold text-[#315CFA] hover:underline"
          >
            Import Custom Plan (PDF / Image) →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {presets.map(preset => {
            const Icon = preset.icon;
            const isSelected = selectedFixtureId === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => loadFixture(preset.id)}
                className={`p-5 rounded-xl border transition-all cursor-pointer bg-white flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#315CFA] ring-2 ring-blue-500/10 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${preset.badgeColor}`}>
                      {preset.tag}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mb-1">{preset.name}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">{preset.description}</p>
                </div>
                <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
                  <span className={`font-semibold ${isSelected ? 'text-[#315CFA]' : 'text-slate-500'}`}>
                    {isSelected ? 'Active Plan' : 'Load Fixture'}
                  </span>
                  <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-[#315CFA]' : 'text-slate-400'}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Safety and Scientific Disclaimer Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-1">
              Scientific Boundaries & Safety Limitations Disclosure
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              ExitLab is designed as a tabletop research and decision-support simulator. Egress paths, velocities,
              and doorway queues are calculated using a 2D discrete grid approximation (0.25m cell resolution, 1.2 m/s nominal
              walking speed, 1.3 persons/m/s door flow). It does <strong>not</strong> simulate fluid fire dynamics, toxic smoke
              inhalation, structural collapse, panic behavior, or certified regulatory building codes. Outputs must never be used
              for live emergency evacuation or life safety certification.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
