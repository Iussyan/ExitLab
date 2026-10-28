import React, { useState } from 'react';
import {
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Box,
  FileText,
  Activity,
  Layers,
  HelpCircle
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { runStressTestAgent, AgentStepTrace, Finding } from '../../agent/orchestrator';

export const AIPanel: React.FC = () => {
  const { building, stressTestReport, setStressTestReport, setActiveTab, setIs3DMode, toggleDoorBlockage, setActiveScenario } = useProject();

  const [budget, setBudget] = useState<number>(3);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [liveTraces, setLiveTraces] = useState<AgentStepTrace[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  const startAITest = async () => {
    setIsRunning(true);
    setLiveTraces([]);

    try {
      const report = await runStressTestAgent(
        building,
        { maxScenarios: budget, seed: 42, useBackendApi: true },
        trace => {
          setLiveTraces(prev => [...prev, trace]);
        }
      );
      setStressTestReport(report);
      if (report.findings.length > 0) {
        setSelectedFinding(report.findings[0]);
      }
    } catch (err) {
      console.error('Agent error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const activeTraces = isRunning ? liveTraces : stressTestReport?.traces || [];
  const findings = stressTestReport?.findings || [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-lg border border-purple-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Meta AI Autonomous Stress Testing Protocol
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Algorithmic Disruption & Bottleneck Discovery
            </h2>
            <p className="text-slate-300 text-xs leading-relaxed">
              The Meta agent analyzes verified geometry, generates testable failure hypotheses, validates
              typed tool requests, runs the deterministic physics engine, and compares factual metric deltas.
              AI outputs are strictly exploratory and assumption-dependent.
            </p>
          </div>

          {/* Controls Card */}
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10 flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <label className="text-xs text-slate-300 font-medium">Scenario Budget:</label>
              <select
                value={budget}
                onChange={e => setBudget(Number(e.target.value))}
                disabled={isRunning}
                className="bg-slate-800 border border-slate-700 text-white text-xs rounded-md px-2 py-1 font-semibold outline-none"
              >
                <option value={1}>1 Scenario (Fast)</option>
                <option value={2}>2 Scenarios</option>
                <option value={3}>3 Scenarios (Standard)</option>
                <option value={4}>4 Scenarios</option>
                <option value={5}>5 Scenarios (Deep)</option>
              </select>
            </div>

            <button
              onClick={startAITest}
              disabled={isRunning}
              className="btn-ai text-xs py-2.5 px-4 justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {isRunning ? (
                <>
                  <Activity className="w-4 h-4 animate-spin text-purple-200" />
                  Running Agent Loop...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Run AI Stress Test ({budget} Scenarios)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Agent Activity Trace Feed */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-[580px]">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-sm text-slate-900">Agent Activity Trace</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {activeTraces.length} steps recorded
            </span>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs">
            {activeTraces.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-6 font-sans">
                <BrainCircuitIcon className="w-10 h-10 text-slate-300 mb-2 stroke-1" />
                <p className="text-sm font-semibold text-slate-700">No Active Agent Trace</p>
                <p className="text-xs text-slate-500 mt-1">
                  Click "Run AI Stress Test" to observe real-time tool proposals, schema validation, and simulation runs.
                </p>
              </div>
            ) : (
              activeTraces.map((trace, idx) => {
                let badgeColor = 'bg-slate-100 text-slate-700';
                if (trace.status === 'success') badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                if (trace.status === 'failed') badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                if (trace.status === 'pending') badgeColor = 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse';

                return (
                  <div key={idx} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold uppercase tracking-wider text-slate-500">
                        Step {trace.step}: {trace.phase}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded font-bold uppercase text-[9px] border ${badgeColor}`}>
                        {trace.status}
                      </span>
                    </div>
                    <div className="text-slate-800 font-sans text-xs">{trace.summary}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Ranked Findings & Actionable Insights */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Evaluated Stress Findings</h3>
              <p className="text-xs text-slate-500">
                Ranked by measured impact on evacuation clearance and occupant safety
              </p>
            </div>
            {stressTestReport && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                Mode: {stressTestReport.agentMode === 'meta_api' ? 'Meta Llama API' : 'Guarded Autonomous'}
              </span>
            )}
          </div>

          {findings.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500 space-y-2">
              <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="font-semibold text-slate-700 text-sm">No Findings Yet</div>
              <p className="text-xs max-w-md mx-auto">
                Launch the stress test to test exit disruptions and view factual comparative findings.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {findings.map((f, idx) => {
                const comp = f.comparison;
                const isSelected = selectedFinding?.findingId === f.findingId;

                return (
                  <div
                    key={f.findingId}
                    onClick={() => setSelectedFinding(f)}
                    className={`p-5 rounded-xl border transition-all cursor-pointer bg-white shadow-xs ${
                      isSelected
                        ? 'border-purple-500 ring-2 ring-purple-500/10'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                            Finding #{idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-900">{comp.scenarioName}</span>
                        </div>
                        <p className="text-xs text-slate-600 italic">"{f.hypothesis}"</p>
                      </div>

                      {/* Severity Impact Score */}
                      <div className="text-right shrink-0">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Impact Score</div>
                        <div
                          className={`text-xl font-extrabold ${
                            comp.impactScore >= 50
                              ? 'text-rose-600'
                              : comp.impactScore >= 25
                              ? 'text-amber-600'
                              : 'text-blue-600'
                          }`}
                        >
                          {comp.impactScore}/100
                        </div>
                      </div>
                    </div>

                    {/* Numerical Deltas Grid */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg text-xs font-mono mb-3">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">Clearance Delay</span>
                        <strong className={comp.clearanceTimeDeltaSeconds ? 'text-amber-700' : 'text-slate-700'}>
                          {comp.clearanceTimeDeltaSeconds !== null ? `+${comp.clearanceTimeDeltaSeconds}s` : 'N/A (Trapped)'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">Unreachable Occupants</span>
                        <strong className={comp.unreachableDelta > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                          {comp.unreachableDelta > 0 ? `+${comp.unreachableDelta} Trapped` : '0 (All Exit)'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">Max Queue Buildup</span>
                        <strong className="text-slate-800">+{comp.maxQueueDelta} occupants</strong>
                      </div>
                    </div>

                    {/* Reasoned Explanation */}
                    <p className="text-xs text-slate-700 leading-relaxed font-medium mb-3">
                      {f.explanation}
                    </p>

                    {/* Action & Provenance */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-[11px]">
                      <span className="text-slate-400 font-mono">Run ID: {f.runId}</span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          const candidateRun = stressTestReport?.candidateRuns.find(r => r.runId === f.runId);
                          if (candidateRun) {
                            setActiveScenario(candidateRun.scenario);
                            setIs3DMode(true);
                            setActiveTab('simulation3d');
                          }
                        }}
                        className="btn-outline text-[11px] py-1 px-2.5 text-[#315CFA] hover:text-[#2347d9]"
                      >
                        <Box className="w-3 h-3" />
                        Replay Scenario in 3D →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function BrainCircuitIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M9 13a4.5 4.5 0 0 0 3-4" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M12 13h4" />
      <path d="M12 18h6a2 2 0 0 1 2 2v1" />
      <path d="M12 8h8" />
      <path d="M16 8V5a2 2 0 0 1 2-2" />
      <path d="M16 13v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}
