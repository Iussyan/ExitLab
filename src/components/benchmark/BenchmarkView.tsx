import React, { useState } from 'react';
import { Scale, Play, CheckCircle2, TrendingUp, AlertTriangle, ShieldAlert, Clock, Compass } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { runAIVsRandomBenchmark, BenchmarkResult } from '../../agent/benchmark';

export const BenchmarkView: React.FC = () => {
  const { building, benchmarkResult, setBenchmarkResult } = useProject();
  const [budget, setBudget] = useState<number>(3);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const startBenchmark = async () => {
    setIsRunning(true);
    try {
      const res = await runAIVsRandomBenchmark(building, budget, 42);
      setBenchmarkResult(res);
    } catch (e) {
      console.error('Benchmark failed:', e);
    } finally {
      setIsRunning(false);
    }
  };

  const ai = benchmarkResult?.aiAgentResults;
  const rand = benchmarkResult?.randomBaselineResults;
  const summary = benchmarkResult?.comparisonSummary;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-2xl space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
            <Scale className="w-3.5 h-3.5" />
            Acceptance Criterion A09 · Equal-Budget Scientific Evaluation
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            AI-Guided Stress Search vs. Seeded Random Search
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Evaluates whether the Meta AI agent uncovers more severe evacuation vulnerabilities than an unguided random
            disruption strategy under identical building geometry, scenario budgets, and simulation seeds.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <select
            value={budget}
            onChange={e => setBudget(Number(e.target.value))}
            disabled={isRunning}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 font-semibold outline-none"
          >
            <option value={2}>Budget: 2 Scenarios Each</option>
            <option value={3}>Budget: 3 Scenarios Each</option>
            <option value={4}>Budget: 4 Scenarios Each</option>
          </select>
          <button
            onClick={startBenchmark}
            disabled={isRunning}
            className="btn-primary text-xs py-2 px-4 shadow-sm"
          >
            {isRunning ? 'Running Benchmark...' : 'Run Equal-Budget Benchmark'}
          </button>
        </div>
      </div>

      {benchmarkResult && ai && rand ? (
        <div className="space-y-6">
          {/* Scientific Verdict Card */}
          <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-purple-950 text-sm">Evaluation Summary</h4>
                <p className="text-xs text-purple-900 leading-relaxed font-medium">
                  {summary?.explanation}
                </p>
              </div>
            </div>
          </div>

          {/* Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Meta AI Search Card */}
            <div className="bg-white rounded-xl border-2 border-purple-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    Strategy A
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">Meta AI Stress Agent</h3>
                </div>
                <span className="text-xs font-mono text-slate-400">Budget: {ai.totalScenariosRun} runs</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block mb-1">Worst Clearance Time</span>
                  <strong className="text-sm font-bold text-slate-900 font-mono">
                    {ai.worstClearanceTimeSeconds !== null ? `${ai.worstClearanceTimeSeconds}s` : 'Trapped'}
                  </strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block mb-1">Max Trapped Occupants</span>
                  <strong className={`text-sm font-bold font-mono ${ai.maxUnreachableCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                    {ai.maxUnreachableCount}
                  </strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block mb-1">Bottlenecks Discovered</span>
                  <strong className="text-sm font-bold text-purple-700 font-mono">
                    {ai.totalBottlenecksDiscovered}
                  </strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block mb-1">Invalid Proposals</span>
                  <strong className="text-sm font-bold text-emerald-600 font-mono">
                    {ai.invalidProposalsCount} (Guarded)
                  </strong>
                </div>
              </div>
            </div>

            {/* Random Disruption Baseline Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                    Strategy B (Control)
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">Seeded Random Baseline</h3>
                </div>
                <span className="text-xs font-mono text-slate-400">Budget: {rand.totalScenariosRun} runs</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block mb-1">Worst Clearance Time</span>
                  <strong className="text-sm font-bold text-slate-900 font-mono">
                    {rand.worstClearanceTimeSeconds !== null ? `${rand.worstClearanceTimeSeconds}s` : 'Trapped'}
                  </strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block mb-1">Max Trapped Occupants</span>
                  <strong className={`text-sm font-bold font-mono ${rand.maxUnreachableCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                    {rand.maxUnreachableCount}
                  </strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block mb-1">Bottlenecks Discovered</span>
                  <strong className="text-sm font-bold text-slate-700 font-mono">
                    {rand.totalBottlenecksDiscovered}
                  </strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block mb-1">Invalid Proposals</span>
                  <strong className="text-sm font-bold text-slate-600 font-mono">
                    {rand.invalidProposalsCount}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-16 text-center text-slate-500 space-y-3">
          <Scale className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Ready to Benchmark</h3>
          <p className="text-xs max-w-md mx-auto text-slate-500 leading-relaxed">
            Click "Run Equal-Budget Benchmark" to execute both search strategies on "{building.name}" and verify
            whether AI vulnerability discovery outperforms random scenario generation.
          </p>
        </div>
      )}
    </div>
  );
};
