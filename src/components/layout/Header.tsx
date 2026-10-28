import React from 'react';
import { Play, Sparkles, CheckCircle2, AlertOctagon, Box, Map, RefreshCw, Menu } from 'lucide-react';
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
    mobileSidebarOpen,
    setMobileSidebarOpen,
  } = useProject();

  const floor = building.floors[0];
  const totalOccupants = floor?.rooms.reduce((acc, r) => acc + r.occupants, 0) ?? 0;
  const blockedCount = activeScenario.blockedDoorIds.length;

  const handleRunSimulation = () => {
    runCurrentSimulation();
    if (is3DMode) {
      setActiveTab('simulation3d');
    } else {
      setActiveTab('editor');
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shrink-0 no-print z-20">
      {/* Left: Mobile hamburger & Building Title */}
      <div className="flex items-center gap-3 overflow-hidden">
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none"
          title="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-slate-900 text-sm md:text-base leading-tight truncate max-w-[200px] sm:max-w-md">
              {building.name}
            </h2>
            {validation.valid ? (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 shrink-0">
                <AlertOctagon className="w-3 h-3 text-rose-600" />
                {validation.issues.filter(i => i.severity === 'error').length} Errors
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 md:gap-2 mt-0.5 truncate">
            <span>Floor 0</span>
            <span>•</span>
            <span>{totalOccupants} Occupants</span>
            {blockedCount > 0 && (
              <>
                <span>•</span>
                <span className="font-semibold text-rose-600 bg-rose-50 px-1 rounded">
                  {blockedCount} Blocked
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Mode switches and Execution triggers */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* 2D / 3D Switch */}
        <div className="flex items-center bg-slate-100 p-0.5 md:p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => {
              setIs3DMode(false);
              setActiveTab('editor');
            }}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1 transition-all ${
              !is3DMode && activeTab === 'editor'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">2D Canvas</span>
          </button>
          <button
            onClick={() => {
              setIs3DMode(true);
              setActiveTab('simulation3d');
            }}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1 transition-all ${
              is3DMode && activeTab === 'simulation3d'
                ? 'bg-[#0D1729] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">3D Cutaway</span>
          </button>
        </div>

        {/* Quick Simulation Trigger */}
        <button
          onClick={handleRunSimulation}
          disabled={!validation.valid || isSimulating}
          className="btn-primary text-xs py-1.5 md:py-2 px-2.5 md:px-3.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
          title={!validation.valid ? 'Resolve geometry errors before simulating' : 'Run deterministic simulation'}
        >
          {isSimulating ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-white" />
          )}
          <span className="hidden md:inline">Run Simulation</span>
          <span className="md:hidden">Run</span>
        </button>

        {/* AI Stress Test Trigger */}
        <button
          onClick={() => setActiveTab('agent')}
          className="btn-ai text-xs py-1.5 md:py-2 px-2.5 md:px-3.5 shadow-xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-200" />
          <span className="hidden md:inline">AI Stress Test</span>
          <span className="md:hidden">AI</span>
        </button>
      </div>
    </header>
  );
};
