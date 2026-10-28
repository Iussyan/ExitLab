import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  MapPin,
  Box,
  BrainCircuit,
  BarChart2,
  FileText,
  UploadCloud,
  Scale,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Flame,
  HelpCircle
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, selectedFixtureId, loadFixture, is3DMode, setIs3DMode } = useProject();
  const [metaApiOnline, setMetaApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setMetaApiOnline(data.metaApiConfigured))
      .catch(() => setMetaApiOnline(false));
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'editor', label: '2D Floor Editor', icon: MapPin },
    { id: 'simulation3d', label: '3D Simulation', icon: Box },
    { id: 'agent', label: 'AI Stress Testing', icon: BrainCircuit, badge: 'Meta AI' },
    { id: 'benchmark', label: 'AI Benchmark', icon: Scale },
    { id: 'results', label: 'Results & Heatmap', icon: BarChart2 },
    { id: 'import', label: 'Import & Calibrate', icon: UploadCloud },
    { id: 'report', label: 'Export Report', icon: FileText },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen select-none shrink-0 no-print">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#315CFA] to-[#7546F8] flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Flame className="w-5 h-5 fill-white/20" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight text-slate-900">ExitLab</h1>
            <p className="text-[11px] font-medium text-slate-500">Evacuation AI Stress-Lab</p>
          </div>
        </div>
      </div>

      {/* Model / API Status Pill */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs flex items-center justify-between text-slate-600">
        <span className="flex items-center gap-1.5 font-medium">
          <span className={`w-2 h-2 rounded-full ${metaApiOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          Meta AI Mode
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
          {metaApiOnline ? 'Llama 3.3 Connected' : 'Guarded Local'}
        </span>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="text-[11px] font-semibold text-slate-400 px-3 uppercase tracking-wider mb-2">
          Workspace
        </div>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (item.id === 'simulation3d') setIs3DMode(true);
                else if (item.id === 'editor') setIs3DMode(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-50 text-[#315CFA] font-semibold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#315CFA]' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] bg-purple-100 text-[#7546F8] font-bold px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Fixture Selector */}
        <div className="pt-5 pb-2">
          <div className="text-[11px] font-semibold text-slate-400 px-3 uppercase tracking-wider mb-2">
            Preset Buildings
          </div>
          <div className="space-y-1">
            {[
              { id: 'simple-school', label: 'Oakridge School (Verified)' },
              { id: 'narrow-door', label: 'Narrow Passage Bottleneck' },
              { id: 'disconnected-room', label: 'Sealed Room (Trap Test)' },
              { id: 'malformed', label: 'Malformed Draft (Error Test)' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => loadFixture(f.id)}
                className={`w-full text-left text-xs px-3 py-1.5 rounded-md truncate transition-colors ${
                  selectedFixtureId === f.id
                    ? 'bg-slate-200/70 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Safety Boundary Footer Disclaimer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70">
        <div className="flex items-start gap-2 p-2 rounded bg-amber-50/80 border border-amber-200 text-amber-900 text-[11px] leading-tight">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>Research Prototype:</strong> Exploratory stress testing only. Never certified safety advice.
          </span>
        </div>
      </div>
    </aside>
  );
};
