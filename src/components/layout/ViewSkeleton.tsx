import React from 'react';
import { Layers, Compass, Cpu } from 'lucide-react';

interface ViewSkeletonProps {
  message?: string;
  subtext?: string;
}

export const ViewSkeleton: React.FC<ViewSkeletonProps> = ({
  message = 'Loading Spatial Module...',
  subtext = 'Calibrating CAD geometry pipeline & GPU textures',
}) => {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[60vh] h-full w-full bg-slate-900 overflow-hidden select-none">
      {/* Blueprint background grid */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #38bdf8 1px, transparent 1px),
            linear-gradient(to bottom, #38bdf8 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px'
        }}
      />

      {/* Radial glow */}
      <div className="absolute w-96 h-96 bg-brand-primary/20 rounded-full blur-3xl pointer-events-none animate-pulse" />

      {/* Floating HUD Skeleton Box */}
      <div className="relative z-10 flex flex-col items-center max-w-sm w-full mx-4 p-8 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 shadow-2xl text-center space-y-5">
        {/* Animated Icon Ring */}
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-primary/20 to-purple-500/20 border border-brand-primary/40 shadow-inner">
          <Layers className="w-8 h-8 text-brand-primary animate-pulse" />
          <div className="absolute inset-0 rounded-2xl border-2 border-brand-primary/50 border-t-transparent animate-spin" />
        </div>

        {/* Title & Subtext */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-primary/10 border border-brand-primary/30 text-[10px] font-mono font-semibold tracking-wider text-brand-primary uppercase">
            <Cpu className="w-3 h-3 animate-spin" />
            ExitLab Engine
          </div>
          <h3 className="text-base font-bold text-slate-100 tracking-tight">
            {message}
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            {subtext}
          </p>
        </div>

        {/* Simulated Shimmer Progress Bar */}
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700/50">
          <div className="h-full bg-gradient-to-r from-brand-primary via-indigo-400 to-brand-primary w-2/3 rounded-full animate-[shimmer_1.5s_infinite]" />
        </div>

        {/* Coordinate breadcrumb */}
        <div className="flex items-center justify-between w-full pt-1 text-[10px] font-mono text-slate-500 border-t border-slate-800">
          <span className="flex items-center gap-1">
            <Compass className="w-3 h-3 text-slate-400" />
            GRID 0.25m
          </span>
          <span>DETERMINISTIC · SYNC</span>
        </div>
      </div>
    </div>
  );
};
