import React from 'react';
import { DollarSign, ShieldCheck, AlertTriangle, ShieldAlert, ArrowRight, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';

export const AffordabilityCalculator: React.FC = () => {
  const {
    cashflowForecast,
    minimumCashReserve,
    setMinimumCashReserve,
    simulatedPurchaseAmount,
    setSimulatedPurchaseAmount,
    simulatedTargetWeek,
    setSimulatedTargetWeek,
    affordabilitySimulation,
  } = useApp();

  const sim = affordabilitySimulation;

  const quickAmounts = [150, 450, 850, 1500, 3000];

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-5">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            "Can I Afford This?" Scenario Simulator
          </h2>
          <p className="text-xs text-slate-500">
            Simulate the liquidity impact of planned capital expenses against your minimum cash reserve
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs">
          <span className="text-slate-500 font-medium">Configured Floor:</span>
          <span className="font-bold text-slate-900 tabular-nums">
            ${minimumCashReserve.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input controls */}
        <div className="lg:col-span-5 space-y-4">
          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Simulated Purchase Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-semibold text-sm">$</span>
              <input
                type="number"
                min="0"
                step="50"
                value={simulatedPurchaseAmount}
                onChange={(e) => setSimulatedPurchaseAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-4 py-2 text-sm font-bold text-slate-900 tabular-nums focus:border-teal-500 focus:outline-none"
              />
            </div>

            {/* Quick chips */}
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Quick test:</span>
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setSimulatedPurchaseAmount(amt)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    simulatedPurchaseAmount === amt
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>

          {/* Target week selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Expected Week of Expense
            </label>
            <select
              value={simulatedTargetWeek}
              onChange={(e) => setSimulatedTargetWeek(parseInt(e.target.value, 10))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 font-medium focus:border-teal-500 focus:outline-none"
            >
              {cashflowForecast.map((point) => (
                <option key={point.weekIndex} value={point.weekIndex}>
                  {point.weekLabel} ({point.dateRange}) · Expected Ending: ${point.projectedEndingCash.toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          {/* Configurable reserve floor slider */}
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700">Safety Reserve Floor</span>
              <span className="font-bold text-slate-900 tabular-nums">
                ${minimumCashReserve.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min="2000"
              max="15000"
              step="500"
              value={minimumCashReserve}
              onChange={(e) => setMinimumCashReserve(parseInt(e.target.value, 10))}
              className="w-full accent-teal-700 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              The minimum liquidity cushion your business requires before triggering an alert.
            </p>
          </div>
        </div>

        {/* Right: Simulation Verdict & Impact */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-xl bg-slate-50/70 border border-slate-200/80 p-5">
          <div>
            {/* Verdict header banner */}
            <div
              className={`flex items-center gap-2.5 rounded-lg p-3 text-xs font-bold mb-4 ${
                sim.verdict === 'SAFE'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : sim.verdict === 'CAUTION'
                  ? 'bg-amber-50 text-amber-900 border border-amber-200'
                  : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}
            >
              {sim.verdict === 'SAFE' ? (
                <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0" />
              ) : sim.verdict === 'CAUTION' ? (
                <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-rose-700 shrink-0" />
              )}
              <div>
                <p className="text-xs uppercase tracking-wider">
                  {sim.verdict === 'SAFE'
                    ? 'AFFORDABLE — RESERVE PROTECTED'
                    : sim.verdict === 'CAUTION'
                    ? 'AFFORDABLE WITH CAUTION'
                    : 'DEFICIT ALERT — MINIMUM RESERVE BREACH'}
                </p>
                <p className="text-[11px] font-normal mt-0.5">{sim.recommendation}</p>
              </div>
            </div>

            {/* Metric grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mb-4">
              <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] text-slate-400 block">Balance in {sim.targetWeekLabel}</span>
                <span className="text-sm font-bold text-slate-900 tabular-nums">
                  ${sim.projectedBalanceAfter.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  was ${sim.projectedBalanceBefore.toLocaleString()}
                </span>
              </div>

              <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] text-slate-400 block">Lowest Point ({sim.lowestProjectedWeekLabel})</span>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    sim.lowestProjectedBalanceAfter < minimumCashReserve
                      ? 'text-rose-700'
                      : 'text-slate-900'
                  }`}
                >
                  ${sim.lowestProjectedBalanceAfter.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  12-week minimum
                </span>
              </div>

              <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-2xs col-span-2 sm:col-span-1">
                <span className="text-[11px] text-slate-400 block">Cushion Over Floor</span>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    sim.bufferRemaining < 0 ? 'text-rose-700' : 'text-teal-800'
                  }`}
                >
                  {sim.bufferRemaining < 0 ? '-' : '+'}${Math.abs(sim.bufferRemaining).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Floor: ${minimumCashReserve.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200/60 pt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>
              Calculated using code rules against scheduled receivables and recurring costs. Not fabricated by AI.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
