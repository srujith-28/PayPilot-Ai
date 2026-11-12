import React, { useState } from 'react';
import {
  DollarSign,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertCircle,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { CashflowChart } from '../components/charts/CashflowChart.tsx';

export const OverviewPage: React.FC = () => {
  const {
    user,
    availableDemoCash,
    minimumCashReserve,
    invoices,
    approvals,
    cashflowForecast,
    setCurrentRoute,
    sendAssistantMessage,
    setActiveModal,
    setSelectedApproval,
    setCheckoutApproval,
    activities,
  } = useApp();

  const [quickPrompt, setQuickPrompt] = useState('');

  // Derived metrics
  const outstandingInvoices = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue');
  const outstandingTotal = outstandingInvoices.reduce((s, i) => s + i.total, 0);

  const paidThisMonth = invoices.filter((i) => i.status === 'paid');
  const paidTotal = paidThisMonth.reduce((s, i) => s + i.total, 0);

  const pendingApprovals = approvals.filter((a) => a.state === 'AWAITING_APPROVAL');
  const pendingApprovalsTotal = pendingApprovals.reduce((s, a) => s + a.totalAmount, 0);

  // Projected 12-week net flow
  const lastPoint = cashflowForecast[cashflowForecast.length - 1];
  const projectedNet = (lastPoint?.projectedEndingCash || availableDemoCash) - availableDemoCash;

  const handleAskQuick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPrompt.trim()) return;
    sendAssistantMessage(quickPrompt);
    setCurrentRoute('ai-assistant');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Greeting Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Good morning, {user.name.split(' ')[0]}.
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Here's your financial overview for {user.companyName}.
          </p>
        </div>

        {/* Prominent Demo Data Badge */}
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200/90 px-3.5 py-2 text-xs text-amber-900 shadow-2xs">
          <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
          <div>
            <span className="font-semibold block">DEMO DATA MODE</span>
            <span className="text-[11px] text-amber-800/90">
              Simulated balances · No live bank connectivity
            </span>
          </div>
        </div>
      </div>

      {/* Prominent AI Assistant Search Launcher */}
      <div className="rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-50/70 via-white to-slate-50 p-4 shadow-2xs">
        <form onSubmit={handleAskQuick} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-900 shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-800 text-white">
              <Sparkles className="h-3.5 w-3.5 text-teal-300" />
            </div>
            <span>Ask PayPilot Copilot</span>
          </div>
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Ask PayPilot anything about your money, e.g. 'Can I afford an $80 purchase?'"
              value={quickPrompt}
              onChange={(e) => setQuickPrompt(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none shadow-2xs"
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shrink-0 shadow-xs"
          >
            Ask Copilot
          </button>
        </form>
      </div>

      {/* 5 Core Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Available Cash */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Available Demo Cash
            </span>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
              ${availableDemoCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Floor: ${minimumCashReserve.toLocaleString()}
          </p>
        </div>

        {/* Outstanding Invoices */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Outstanding Invoices
            </span>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
              ${outstandingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {outstandingInvoices.length} invoices pending
          </p>
        </div>

        {/* Invoices Paid This Month */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Paid This Month
            </span>
            <p className="mt-1 text-2xl font-bold text-emerald-700 tabular-nums">
              ${paidTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <p className="mt-2 text-[11px] text-emerald-700 font-medium">
            {paidThisMonth.length} settled in October
          </p>
        </div>

        {/* Planned Purchases Awaiting Approval */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Planned Purchases
            </span>
            <p className="mt-1 text-2xl font-bold text-slate-800 tabular-nums">
              ${pendingApprovalsTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <p className="mt-2 text-[11px] text-amber-700 font-medium">
            {pendingApprovals.length} awaiting your approval
          </p>
        </div>

        {/* Projected Net Cash Flow */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between sm:col-span-2 lg:col-span-1">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              12-Wk Projected Net
            </span>
            <p className="mt-1 text-2xl font-bold text-teal-800 tabular-nums">
              +${projectedNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <p className="mt-2 text-[11px] text-teal-700 font-medium">
            Growth over current balance
          </p>
        </div>
      </div>

      {/* 12-Week Cashflow Chart Preview */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              12-Week Projected Cash Flow Trajectory
            </h3>
            <p className="text-xs text-slate-500">
              Expected net liquidity curve including upcoming invoice collections and operational expenses
            </p>
          </div>

          <button
            onClick={() => setCurrentRoute('cashflow-forecast')}
            className="flex items-center gap-1 text-xs font-semibold text-teal-800 hover:text-teal-900 transition-colors"
          >
            <span>Open Scenario Planner</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <CashflowChart data={cashflowForecast} minimumReserve={minimumCashReserve} compact={false} />
      </div>

      {/* Two Column Grid: Pending Approvals & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Pending Approvals */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Pending Purchase Approvals</h3>
                <p className="text-xs text-slate-500">
                  User-controlled payments awaiting explicit confirmation
                </p>
              </div>
              <button
                onClick={() => setCurrentRoute('activity-approvals')}
                className="text-xs font-semibold text-teal-800 hover:underline"
              >
                View all
              </button>
            </div>

            {pendingApprovals.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No purchases awaiting approval at this time.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingApprovals.map((appr) => (
                  <div
                    key={appr.id}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 text-xs transition-colors hover:bg-slate-50"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-semibold text-slate-900 leading-snug">{appr.title}</p>
                      <span className="font-bold text-slate-900 text-sm tabular-nums ml-2">
                        ${appr.totalAmount.toFixed(2)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 mb-2">
                      Requested by {appr.requestedBy} · Policy: {appr.policyStatus}
                    </p>

                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                      <span className="text-[10px] text-teal-800 font-medium">
                        Policy Check: PASS
                      </span>
                      <button
                        onClick={() => {
                          setCheckoutApproval(appr);
                          setActiveModal('SANDBOX_CHECKOUT');
                        }}
                        className="rounded-lg bg-teal-800 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-900 shadow-2xs"
                      >
                        Review & Sandbox Checkout
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Deterministic spending rules enforced</span>
            <button
              onClick={() => setCurrentRoute('smart-spend')}
              className="font-medium text-slate-700 hover:text-slate-900"
            >
              Browse Spend Catalog →
            </button>
          </div>
        </div>

        {/* Right: Recent Invoice Activity */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent Invoice Activity</h3>
                <p className="text-xs text-slate-500">Receivables and collection progress</p>
              </div>
              <button
                onClick={() => setCurrentRoute('smart-invoice')}
                className="text-xs font-semibold text-teal-800 hover:underline"
              >
                Manage Invoices
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {invoices.slice(0, 4).map((inv) => (
                <div key={inv.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-slate-900">{inv.invoiceNumber}</span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                          inv.status === 'paid'
                            ? inv.settlementType === 'PAYPAL_VERIFIED'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700'
                            : inv.status === 'overdue'
                            ? 'bg-rose-50 text-rose-800'
                            : 'bg-teal-50 text-teal-800'
                        }`}
                      >
                        {inv.status === 'paid'
                          ? inv.settlementType === 'PAYPAL_VERIFIED'
                            ? 'PAYPAL PAID'
                            : 'PAID (DEMO)'
                          : inv.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {inv.clientCompany || inv.clientName} · Due: {inv.dueDate}
                    </p>
                  </div>

                  <span className="font-bold text-slate-900 tabular-nums">
                    ${inv.total.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">{outstandingInvoices.length} active receivables</span>
            <button
              onClick={() => {
                setActiveModal('CREATE_INVOICE');
              }}
              className="font-semibold text-teal-800 hover:text-teal-900"
            >
              + Create New Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
