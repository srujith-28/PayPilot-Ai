import React from 'react';
import {
  TrendingUp,
  Info,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { CashflowChart } from '../components/charts/CashflowChart.tsx';
import { AffordabilityCalculator } from '../components/forecast/AffordabilityCalculator.tsx';

export const CashflowForecastPage: React.FC = () => {
  const {
    cashflowForecast,
    minimumCashReserve,
    availableDemoCash,
    simulatedPurchaseAmount,
    simulatedTargetWeek,
  } = useApp();

  const totalIncoming12W = cashflowForecast.reduce((s, p) => s + p.expectedIncoming, 0);
  const totalOutgoing12W = cashflowForecast.reduce((s, p) => s + p.expectedOutgoing, 0);
  const endingP50 = cashflowForecast[cashflowForecast.length - 1]?.projectedEndingCash || 0;
  const net12WGrowth = endingP50 - availableDemoCash;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            12-Week Cashflow Forecast & Liquidity Planning
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Forward-looking liquidity intelligence based on confirmed invoices, recurring commitments, and probabilistic collection timing
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-900 shadow-2xs">
          <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
          <span>Demo Data Simulation · Not Live Bank Feed</span>
        </div>
      </div>

      {/* 4 Inflow/Outflow Metric Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Current Demo Liquidity
          </span>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            ${availableDemoCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Safety Floor: ${minimumCashReserve.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              12-Wk Expected Inflow
            </span>
            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-700 tabular-nums">
            +${totalIncoming12W.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Scheduled invoice settlements
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              12-Wk Expected Outflow
            </span>
            <ArrowDownRight className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-1 text-2xl font-bold text-rose-700 tabular-nums">
            -${totalOutgoing12W.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Hosting, rent, taxes & SaaS
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Projected Net Ending (P50)
          </span>
          <p className="mt-1 text-2xl font-bold text-teal-800 tabular-nums">
            ${endingP50.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-teal-700 font-medium">
            +${net12WGrowth.toLocaleString()} net trajectory
          </p>
        </div>
      </div>

      {/* Main 12-Week Interactive Visual Chart */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              12-Week Probabilistic Cash Flow Model
            </h3>
            <p className="text-xs text-slate-500">
              Hover over any week to inspect incoming invoices, operational outlays, and uncertainty ranges
            </p>
          </div>

          {/* Active simulation indicator if testing amount > 0 */}
          {simulatedPurchaseAmount > 0 && (
            <div className="flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] text-amber-900 font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Simulating ${simulatedPurchaseAmount} in Week {simulatedTargetWeek + 1}</span>
            </div>
          )}
        </div>

        <CashflowChart
          data={cashflowForecast}
          minimumReserve={minimumCashReserve}
          simulatedExpense={
            simulatedPurchaseAmount > 0
              ? { amount: simulatedPurchaseAmount, startWeekIndex: simulatedTargetWeek }
              : undefined
          }
        />
      </div>

      {/* Probability Scenarios Explanation Card (Required by brief) */}
      <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <Info className="h-4 w-4 text-teal-700 shrink-0" />
          <span>Understanding Uncertainty Ranges (P20, P50, P80)</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          Financial projections are probabilistic models based on historical client payment latency, not absolute guarantees:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-2xs">
            <span className="font-bold text-slate-800 block text-xs mb-1">
              P20 Conservative Scenario
            </span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Assumes 20% of clients delay invoices by 14+ days. Use this lower boundary to verify whether essential payroll and rent will remain protected.
            </p>
          </div>

          <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-2xs">
            <span className="font-bold text-teal-900 block text-xs mb-1">
              P50 Expected Baseline
            </span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              The median probability trajectory assuming invoices are settled according to typical client payment cycles and scheduled recurring costs.
            </p>
          </div>

          <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-2xs">
            <span className="font-bold text-slate-800 block text-xs mb-1">
              P80 Optimistic Scenario
            </span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Assumes early remittance on outstanding contracts and immediate adoption of newly proposed project milestones.
            </p>
          </div>
        </div>
      </div>

      {/* Affordability Calculator Component */}
      <AffordabilityCalculator />

      {/* Weekly Ledger Table (Clean high-density breakdown) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <h3 className="text-sm font-bold text-slate-900 mb-1">
          12-Week Weekly Ledger Breakdown
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Detailed itemization of expected collections and planned expenses by week
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Week</th>
                <th className="py-2.5 px-3">Date Range</th>
                <th className="py-2.5 px-3 text-right">Inflow</th>
                <th className="py-2.5 px-3 text-right">Outflow</th>
                <th className="py-2.5 px-3 text-right">Net Flow</th>
                <th className="py-2.5 px-3 text-right">Ending Cash (P50)</th>
                <th className="py-2.5 px-3">Key Scheduled Events</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {cashflowForecast.map((point) => (
                <tr key={point.weekIndex} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-slate-900 font-sans">
                    {point.weekLabel}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 font-sans text-xs">
                    {point.dateRange}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold tabular-nums">
                    {point.expectedIncoming > 0 ? `+$${point.expectedIncoming.toLocaleString()}` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right text-rose-700 tabular-nums">
                    {point.expectedOutgoing > 0 ? `-$${point.expectedOutgoing.toLocaleString()}` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium tabular-nums">
                    <span className={point.netCash >= 0 ? 'text-teal-800' : 'text-rose-600'}>
                      {point.netCash >= 0 ? '+' : ''}${point.netCash.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                    ${point.projectedEndingCash.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 font-sans text-xs">
                    {point.scheduledInvoices.length > 0
                      ? point.scheduledInvoices.map((i) => i.client).join(', ')
                      : point.scheduledPurchases.length > 0
                      ? point.scheduledPurchases[0].name
                      : 'Standard recurring overhead'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Explicit Disclosure & Non-Guaranteed Funds Notice */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs text-slate-600">
          <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-slate-800">Forecast Intelligence Disclosure:</strong> All projected figures represent forward-looking mathematical estimates derived from confirmed invoice schedules, planned operating expenses, and probabilistic collection timing. These figures are planning estimates, not guaranteed bank balances. Outstanding receivables are strictly recorded as expected collections and are never counted as available cash until authoritative payment settlement.
          </p>
        </div>
      </div>
    </div>
  );
};
