import React, { useState } from 'react';
import {
  CheckSquare,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  CreditCard,
  Filter,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import type { PurchaseApproval, PurchaseState, ActivityItem } from '../types/index.ts';

export const ActivityApprovalsPage: React.FC = () => {
  const {
    approvals,
    approvePurchase,
    rejectPurchase,
    confirmSandboxCheckout,
    activities,
    setActiveModal,
    setCheckoutApproval,
  } = useApp();

  const [activityFilter, setActivityFilter] = useState<'all' | 'Spend' | 'Invoicing' | 'Policy'>('all');
  const [approvalTab, setApprovalTab] = useState<'pending' | 'all'>('pending');
  const [selectedActivityDetail, setSelectedActivityDetail] = useState<ActivityItem | null>(null);
  const [rejectPromptApproval, setRejectPromptApproval] = useState<PurchaseApproval | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Pending vs All Approvals
  const pendingApprovals = approvals.filter(
    (a) => a.state === 'AWAITING_APPROVAL' || a.state === 'BLOCKED'
  );

  const displayedApprovals = approvalTab === 'pending' ? pendingApprovals : approvals;

  const filteredActivities = activities.filter((act) => {
    if (activityFilter === 'all') return true;
    return act.category === activityFilter;
  });

  const getPurchaseStateBadge = (state: PurchaseState, approval?: PurchaseApproval) => {
    switch (state) {
      case 'CAPTURED': {
        const isPayPal =
          approval?.sandboxTransactionId &&
          !approval.sandboxTransactionId.startsWith('SIM-');
        return (
          <span
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${
              isPayPal
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-teal-50 text-teal-800'
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>{isPayPal ? 'Captured (PayPal Sandbox)' : 'Captured (Demo Simulation)'}</span>
          </span>
        );
      }
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
            <Check className="h-3 w-3" />
            <span>Approved</span>
          </span>
        );
      case 'AWAITING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
            <Clock className="h-3 w-3" />
            <span>Awaiting Approval</span>
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-800">
            <ShieldAlert className="h-3 w-3" />
            <span>Blocked by Policy</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            <X className="h-3 w-3" />
            <span>Rejected</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            <span>{state}</span>
          </span>
        );
    }
  };

  const handleConfirmReject = () => {
    if (rejectPromptApproval) {
      rejectPurchase(rejectPromptApproval.id, rejectReason || 'Declined during review.');
      setRejectPromptApproval(null);
      setRejectReason('');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Activity & Approvals Governance
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-friendly ledger of all evaluated transactions, policy checks, and user authorizations
          </p>
        </div>

        {/* State machine diagram indicator */}
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <span className="font-semibold text-slate-700">Lifecycle:</span>
          <span>Proposed</span>
          <span>→</span>
          <span>Validating</span>
          <span>→</span>
          <span className="text-amber-700 font-medium">Awaiting Approval</span>
          <span>→</span>
          <span className="text-teal-800 font-medium">Sandbox Checkout</span>
          <span>→</span>
          <span className="text-emerald-700 font-medium">Captured (Simulated)</span>
        </div>
      </div>

      {/* 1. Purchase Approvals & Order Governance Panel */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Purchase Approvals & Orders ({displayedApprovals.length})
            </h3>
            <p className="text-xs text-slate-500">
              Evaluated purchases, mandate decisions, and PayPal Sandbox transactions
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              onClick={() => setApprovalTab('pending')}
              className={`px-3 py-1 rounded-md transition-colors ${
                approvalTab === 'pending'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending Action ({pendingApprovals.length})
            </button>
            <button
              onClick={() => setApprovalTab('all')}
              className={`px-3 py-1 rounded-md transition-colors ${
                approvalTab === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Purchases ({approvals.length})
            </button>
          </div>
        </div>

        {displayedApprovals.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500 mb-2 stroke-1" />
            <p className="font-medium text-slate-700">No approvals to display</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              All proposed purchases and expenses have been addressed.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedApprovals.map((appr) => {
              const isBlocked = appr.state === 'BLOCKED' || appr.policyStatus === 'BLOCKED';
              const isCaptured = appr.state === 'CAPTURED';
              const isRejected = appr.state === 'REJECTED';
              const isApproved = appr.state === 'APPROVED';

              return (
                <div
                  key={appr.id}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 transition-colors hover:bg-slate-50 text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{appr.title}</span>
                      {getPurchaseStateBadge(appr.state, appr)}
                    </div>
                    <span className="font-bold text-slate-900 text-base tabular-nums">
                      ${appr.totalAmount.toFixed(2)} USD
                    </span>
                  </div>

                  <p className="text-slate-600 mb-2 leading-relaxed">
                    <span className="font-medium text-slate-700">Policy Verdict: </span>
                    {appr.policySummary}
                  </p>

                  {appr.sandboxTransactionId && (
                    <p className="text-[11px] text-teal-800 bg-teal-50/70 rounded px-2 py-1 mb-2 font-mono">
                      Transaction / Capture ID: {appr.sandboxTransactionId}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/60 pt-3">
                    <div className="text-[11px] text-slate-400">
                      ID: {appr.id} · Requested by {appr.requestedBy}
                    </div>

                    <div className="flex items-center gap-2">
                      {isCaptured ? (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                          Settlement Finalized
                        </span>
                      ) : isRejected ? (
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          Declined
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => setRejectPromptApproval(appr)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                          >
                            Reject
                          </button>

                          {isBlocked ? (
                            <button
                              disabled
                              className="rounded-lg bg-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-400 cursor-not-allowed"
                            >
                              Blocked by Policy
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setCheckoutApproval(appr);
                                setActiveModal('SANDBOX_CHECKOUT');
                              }}
                              className="rounded-lg bg-teal-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-900 shadow-2xs"
                            >
                              {isApproved ? 'Open Sandbox Checkout' : 'Approve & Sandbox Checkout'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Audit-Friendly Activity Ledger Table */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Audit Activity Log ({filteredActivities.length})
            </h3>
            <p className="text-xs text-slate-500">
              Immutable timeline of all financial events, approvals, and system evaluations
            </p>
          </div>

          {/* Segmented Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
            {(['all', 'Spend', 'Invoicing', 'Policy'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setActivityFilter(cat)}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activityFilter === cat
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat === 'all' ? 'All Activities' : cat}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Event Type</th>
                <th className="py-2.5 px-3">Resource / Summary</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredActivities.map((act) => (
                <tr key={act.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                    {act.timestamp}
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-block font-semibold text-slate-800 text-[11px]">
                      {act.type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-medium text-slate-900">{act.title}</p>
                    <p className="text-[11px] text-slate-500 truncate max-w-md">{act.details}</p>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                    {act.amount !== undefined ? `$${act.amount.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${
                        act.status === 'Completed'
                          ? 'bg-emerald-50 text-emerald-800'
                          : act.status === 'Simulated'
                          ? 'bg-teal-50 text-teal-800'
                          : act.status === 'Blocked'
                          ? 'bg-rose-50 text-rose-800'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {act.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => setSelectedActivityDetail(act)}
                      className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      title="Inspect Activity Record"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Detail Inspection Modal */}
      {selectedActivityDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 text-sm">Audit Record Detail</h3>
              <button
                onClick={() => setSelectedActivityDetail(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <span className="text-[11px] text-slate-400 block">Event Title</span>
                <p className="font-semibold text-slate-900">{selectedActivityDetail.title}</p>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block">Timestamp</span>
                <p className="font-mono text-slate-700">{selectedActivityDetail.timestamp}</p>
              </div>

              {selectedActivityDetail.amount !== undefined && (
                <div>
                  <span className="text-[11px] text-slate-400 block">Financial Amount</span>
                  <p className="font-bold text-slate-900 text-base tabular-nums">
                    ${selectedActivityDetail.amount.toFixed(2)} USD
                  </p>
                </div>
              )}

              <div>
                <span className="text-[11px] text-slate-400 block">Audit Details</span>
                <p className="rounded-lg bg-slate-50 p-2.5 border border-slate-100 text-slate-700 leading-relaxed">
                  {selectedActivityDetail.details}
                </p>
              </div>

              {selectedActivityDetail.resourceId && (
                <div>
                  <span className="text-[11px] text-slate-400 block">Resource ID</span>
                  <p className="font-mono text-slate-600">{selectedActivityDetail.resourceId}</p>
                </div>
              )}
            </div>

            <div className="mt-5 border-t border-slate-100 pt-3 flex justify-end">
              <button
                onClick={() => setSelectedActivityDetail(null)}
                className="rounded-lg bg-slate-900 px-4 py-1.5 font-semibold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Confirmation Modal */}
      {rejectPromptApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 text-xs">
            <h3 className="font-bold text-slate-900 text-sm mb-2">Confirm Rejection</h3>
            <p className="text-slate-600 mb-3">
              Are you sure you want to decline this purchase for "{rejectPromptApproval.title}"?
            </p>

            <textarea
              rows={3}
              placeholder="Reason for rejection (e.g. postponed project requirement)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 mb-4 focus:border-teal-500 focus:outline-none"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectPromptApproval(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="rounded-lg bg-rose-600 px-3.5 py-1.5 font-semibold text-white hover:bg-rose-700"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
