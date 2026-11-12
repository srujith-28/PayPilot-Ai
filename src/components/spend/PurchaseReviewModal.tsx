import React, { useState } from 'react';
import { X, ShieldCheck, ShieldAlert, AlertTriangle, ArrowRight, Trash2, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import type { PurchaseApproval } from '../../types/index.ts';

interface PurchaseReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueToCheckout: (approvedPurchase?: PurchaseApproval) => void;
}

export const PurchaseReviewModal: React.FC<PurchaseReviewModalProps> = ({
  isOpen,
  onClose,
  onContinueToCheckout,
}) => {
  const {
    cart,
    policyEvaluation,
    clearCart,
    user,
    mandate,
    availableDemoCash,
    minimumCashReserve,
    addApprovedPurchase,
    setCheckoutApproval,
  } = useApp();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  if (!isOpen || cart.length === 0) return null;

  const isBlocked = policyEvaluation.status === 'BLOCKED';

  const handleApproveAndContinue = async () => {
    if (isBlocked || isSubmitting) return;
    setIsSubmitting(true);
    setApprovalError(null);

    try {
      const res = await fetch('/api/purchases/approve-cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id || 'usr-jordan-miller',
        },
        body: JSON.stringify({
          items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
          notes: 'Approved by user via Purchase Review Modal',
          currentAvailableCash: availableDemoCash,
          minimumReserveFloor: minimumCashReserve,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to authorize purchase on backend.');
      }

      const approved: PurchaseApproval = data.purchase;
      addApprovedPurchase(approved);
      setCheckoutApproval(approved);
      clearCart();
      onContinueToCheckout(approved);
    } catch (err: any) {
      setApprovalError(err.message || 'Failed to approve purchase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Purchase Review & Policy Mandate</h2>
            <p className="text-xs text-slate-500">
              Verify compliance and financial authorization before demo checkout
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close review"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cart Item Summary */}
        <div className="my-4 max-h-48 overflow-y-auto divide-y divide-slate-100 pr-1">
          {cart.map((item) => (
            <div key={item.product.id} className="flex items-center justify-between py-2 text-xs">
              <div className="min-w-0 flex-1 pr-3">
                <p className="font-semibold text-slate-900 truncate">{item.product.name}</p>
                <p className="text-slate-500 text-[11px]">
                  Category: {item.product.category} · Qty: {item.quantity} × ${item.product.price.toFixed(2)}
                </p>
              </div>
              <span className="font-bold text-slate-900 tabular-nums">
                ${(item.quantity * item.product.price).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Totals & Cash impact */}
        <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1.5 border border-slate-200/80 mb-4">
          <div className="flex justify-between text-slate-600">
            <span>Total Purchase Amount:</span>
            <span className="font-bold text-slate-900 tabular-nums">
              ${policyEvaluation.cartTotal.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-slate-500 text-[11px]">
            <span>Monthly Mandate Remaining After:</span>
            <span className="tabular-nums">
              ${Math.max(0, mandate.monthlyBudget - (mandate.currentSpentThisMonth + policyEvaluation.cartTotal)).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-slate-500 text-[11px]">
            <span>Projected Cash After:</span>
            <span className="tabular-nums">
              ${(availableDemoCash - policyEvaluation.cartTotal).toFixed(2)} (Min Reserve: ${minimumCashReserve.toFixed(2)})
            </span>
          </div>
        </div>

        {/* Policy Evaluation Verdict Card */}
        <div
          className={`rounded-lg p-3 text-xs mb-4 border ${
            isBlocked
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : policyEvaluation.status === 'NEEDS_REVIEW'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2 font-bold mb-1">
            {isBlocked ? (
              <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
            ) : policyEvaluation.status === 'NEEDS_REVIEW' ? (
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            )}
            <span>Policy Status: {policyEvaluation.status}</span>
          </div>
          <p className="text-[11px] leading-relaxed">{policyEvaluation.summary}</p>
        </div>

        {/* Error message */}
        {approvalError && (
          <div className="rounded-lg p-2.5 text-xs bg-rose-50 border border-rose-200 text-rose-800 mb-4 flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{approvalError}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <button
            onClick={() => {
              clearCart();
              onClose();
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 py-2 px-3 rounded-lg hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Reject & Clear Cart</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              onClick={handleApproveAndContinue}
              disabled={isBlocked || isSubmitting}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold shadow-xs transition-colors ${
                isBlocked || isSubmitting
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-teal-800 text-white hover:bg-teal-900'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Authorizing on Server...</span>
                </>
              ) : (
                <>
                  <span>Approve & Continue to Sandbox Checkout</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
