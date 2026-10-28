import React from 'react';
import { Play, Sparkles, CheckCircle2, AlertOctagon, Box, Map, RefreshCw } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

export const Header: React.FC = () => {
  const {
    building,
    validation,
    activeScenario,
    runCurrentSimulation,
    isSimulating,
    activeTab,
    setActiveTab,
    is3DMode,
    setIs3DMode,
  } = useProject();

  const floor = building.floors[0];
  const totalOccupants = floor?.rooms.reduce((acc, r) => acc + r.occupants, 0) ?? 0;
  const blockedCount = activeScenario.blockedDoorIds.length;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 no-print">
      {/* Left: Building Title & Validation status */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900 text-base leading-tight">{building.name}</h2>
            {validation.valid ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Geometry Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                <AlertOctagon className="w-3 h-3 text-rose-600" />
                {validation.issues.filter(i => i.severity === 'error').length} Errors
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
            <span>Floor 0</span>
            <span>•</span>
            <span>{floor?.rooms.length ?? 0} Rooms</span>
            <span>•</span>
            <span>{totalOccupants} Nominal Occupants</span>
            <span>•</span>
            <span>Units: SI (Meters)</span>
            {blockedCount > 0 && (
              <>
                <span>•</span>
                <span className="font-semibold text-rose-600 bg-rose-50 px-1.5 rounded">
                  {blockedCount} Door{blockedCount > 1 ? 's' : ''} Blocked
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Mode switches and Execution triggers */}
      <div className="flex items-center gap-3">
        {/* 2D / 3D Switch */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => {
              setIs3DMode(false);
              if (activeTab === 'simulation3d') setActiveTab('editor');
            }}
            className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
              !is3DMode ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            2D Canvas
          </button>
          <button
            onClick={() => {
              setIs3DMode(true);
              if (activeTab === 'editor') setActiveTab('simulation3d');
            }}
            className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
              is3DMode ? 'bg-[#0D1729] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            3D Cutaway
          </button>
        </div>

        {/* Quick Simulation Trigger */}
        <button
          onClick={() => {
            runCurrentSimulation();
            if (activeTab === 'dashboard') setActiveTab('editor');
          }}
          disabled={!validation.valid || isSimulating}
          className="btn-primary text-xs py-2 px-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
          title={!validation.valid ? 'Resolve geometry errors before simulating' : 'Run deterministic simulation'}
        >
          {isSimulating ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-white" />
          )}
          Run Simulation
        </button>

        {/* AI Stress Test Trigger */}
        <button
          onClick={() => setActiveTab('agent')}
          className="btn-ai text-xs py-2 px-3.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-200" />
          AI Stress Test
        </button>
      </div>
    </header>
  );
};
