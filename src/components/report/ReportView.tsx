import React from 'react';
import { Printer, ShieldAlert, CheckCircle2, Clock, Users, Compass, FileText } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

export const ReportView: React.FC = () => {
  const { building, baselineRun, currentRun, stressTestReport } = useProject();

  const handlePrint = () => {
    window.print();
  };

  const floor = building.floors[0];
  const totalOccupants = floor?.rooms.reduce((acc, r) => acc + r.occupants, 0) ?? 0;
  const exitDoors = floor?.doors.filter(d => d.kind === 'exit') ?? [];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Print Trigger Button */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Evacuation Plan Stress Report</h2>
          <p className="text-xs text-slate-500">
            Formally documented findings, comparative metrics, and research boundaries
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="btn-primary text-xs py-2 px-4 shadow-sm"
        >
          <Printer className="w-4 h-4" />
          Print / Save as PDF
        </button>
      </div>

      {/* Printable Document Sheet */}
      <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-sm space-y-8 text-slate-900">
        {/* Document Header */}
        <div className="border-b border-slate-200 pb-6 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#315CFA] mb-1">
              ExitLab Simulation & Stress Report
            </div>
            <h1 className="text-2xl font-extrabold text-slate-950">{building.name}</h1>
            <div className="text-xs text-slate-500 font-mono mt-1 space-x-3">
              <span>Building ID: {building.id}</span>
              <span>•</span>
              <span>Generated: {new Date().toLocaleDateString()}</span>
              <span>•</span>
              <span>Units: SI (Meters)</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-block">
              Scale Confirmed • Geometry Reviewed
            </span>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Executive Summary</h3>
          <p className="text-xs leading-relaxed text-slate-700">
            This report evaluates egress performance under baseline and disruption scenarios for{' '}
            <strong>{building.name}</strong> ({totalOccupants} nominal occupants across {floor?.rooms.length ?? 0} rooms).
            Movement was calculated using a discrete 0.25m cell grid simulation with fixed fixed-timestep updates (dt=0.25s)
            and door flow capacity bounds (1.3 persons/m/s).
          </p>
        </div>

        {/* Baseline Metrics Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Baseline Evacuation Metrics</h3>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="p-3">Scenario</th>
                  <th className="p-3">Clearance Time</th>
                  <th className="p-3">Evacuated</th>
                  <th className="p-3">Trapped</th>
                  <th className="p-3">Max Queue</th>
                  <th className="p-3">Exits Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                <tr>
                  <td className="p-3 font-sans font-semibold">Baseline (All Exits Open)</td>
                  <td className="p-3 font-bold text-purple-700">
                    {baselineRun?.metrics.clearanceTimeSeconds ? `${baselineRun.metrics.clearanceTimeSeconds}s` : 'N/A'}
                  </td>
                  <td className="p-3 text-emerald-700 font-bold">
                    {baselineRun?.metrics.exitedCount ?? 0} / {totalOccupants}
                  </td>
                  <td className="p-3 text-slate-600">{baselineRun?.metrics.unreachableCount ?? 0}</td>
                  <td className="p-3 text-slate-600">{baselineRun?.metrics.maxQueueLength ?? 0}</td>
                  <td className="p-3 font-sans">{exitDoors.length} Exits</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Stress Test Findings (if available) */}
        {stressTestReport && stressTestReport.findings.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Meta AI Stress Findings & Identified Bottlenecks
            </h3>
            <div className="space-y-3">
              {stressTestReport.findings.map((f, idx) => (
                <div key={f.findingId} className="p-4 border border-slate-200 rounded-lg bg-slate-50/50 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      Finding {idx + 1}: {f.comparison.scenarioName}
                    </span>
                    <span className="font-mono text-purple-700 font-bold">
                      Impact Severity: {f.comparison.impactScore}/100
                    </span>
                  </div>
                  <p className="text-slate-600 italic">"{f.hypothesis}"</p>
                  <p className="text-slate-800 font-medium">{f.explanation}</p>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Run ID: {f.runId} • Trapped Delta: +{f.comparison.unreachableDelta} • Max Queue: +{f.comparison.maxQueueDelta}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modeling Assumptions */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Modeling Assumptions</h3>
          <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
            <li>Single-floor 2D grid discretization with 0.25-meter spatial resolution.</li>
            <li>Fixed-timestep numerical integration (dt = 0.25 seconds).</li>
            <li>Nominal walking velocity assumed at 1.2 meters per second across unobstructed flat terrain.</li>
            <li>Doorway flow rates constrained to 1.3 occupants per meter of door width per second.</li>
            <li>Cell capacity restricted to 1 occupant per cell to prevent unrealistic overlaps.</li>
          </ul>
        </div>

        {/* Mandatory Safety Boundaries Disclaimer */}
        <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-5 text-amber-950 space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-700" />
            Mandatory Non-Certification Disclaimer
          </div>
          <p className="text-xs leading-relaxed text-amber-900/90">
            ExitLab is an exploratory research and tabletop decision-support prototype built for the Meta Global AI Developer Hackathon.
            It is <strong>NOT</strong> an emergency route instruction service, a certified building code compliance verification system,
            or an authorized substitute for professional fire and life safety engineering consultation.
            Outputs represent idealized toy model approximations and must not be used for live emergency guidance or life safety validation.
          </p>
        </div>
      </div>
    </div>
  );
};
