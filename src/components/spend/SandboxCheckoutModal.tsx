import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  CreditCard,
  Lock,
  Check,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Server,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  Info,
  RotateCcw,
  Activity,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import type { PurchaseApproval } from '../../types/index.ts';

interface SandboxCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  approval: PurchaseApproval | null;
  initialApprovalState?: 'PENDING' | 'APPROVED' | 'CANCELLED';
  initialOrderId?: string;
}

export const SandboxCheckoutModal: React.FC<SandboxCheckoutModalProps> = ({
  isOpen,
  onClose,
  approval,
  initialApprovalState,
  initialOrderId,
}) => {
  const { confirmSandboxCheckout, recordSandboxCapture, setCurrentRoute } = useApp();

  // Mode: 'PAYPAL_SANDBOX_API', 'DEMO_SIMULATION', or 'DIAGNOSTICS'
  const [checkoutMode, setCheckoutMode] = useState<'PAYPAL_SANDBOX_API' | 'DEMO_SIMULATION' | 'DIAGNOSTICS'>('PAYPAL_SANDBOX_API');

  // Status and states
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [completedTx, setCompletedTx] = useState<string | null>(null);
  const [completedCaptureId, setCompletedCaptureId] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // PayPal Sandbox REST flow states
  const [hasServerCredentials, setHasServerCredentials] = useState<boolean | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(initialOrderId || null);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(
    initialOrderId ? `https://www.sandbox.paypal.com/checkoutnow?token=${initialOrderId}` : null
  );
  const [authoritativeTotal, setAuthoritativeTotal] = useState<number | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<'PENDING' | 'APPROVED' | 'CANCELLED'>(
    initialApprovalState || 'PENDING'
  );

  // Diagnostics state
  const [diagnosticReport, setDiagnosticReport] = useState<any | null>(null);
  const [isLoadingDiagnostic, setIsLoadingDiagnostic] = useState(false);

  const fetchDiagnostics = async () => {
    setIsLoadingDiagnostic(true);
    try {
      const res = await fetch('/api/paypal/diagnostic');
      const data = await res.json();
      setDiagnosticReport(data);
    } catch (err: any) {
      console.error('Failed to load PayPal Sandbox diagnostics:', err);
    } finally {
      setIsLoadingDiagnostic(false);
    }
  };

  // Check server-side PayPal credentials status on mount or when opening
  useEffect(() => {
    if (isOpen) {
      setApiError(null);
      if (initialApprovalState) {
        setApprovalStatus(initialApprovalState);
      }
      if (initialOrderId) {
        setCreatedOrderId(initialOrderId);
        setApprovalUrl(`https://www.sandbox.paypal.com/checkoutnow?token=${initialOrderId}`);
      }

      fetch('/api/paypal/config')
        .then((r) => r.json())
        .then((data) => {
          setHasServerCredentials(Boolean(data.configured));
          if (!data.configured) {
            setCheckoutMode('DEMO_SIMULATION');
          } else {
            setCheckoutMode('PAYPAL_SANDBOX_API');
          }
        })
        .catch(() => {
          setHasServerCredentials(false);
          setCheckoutMode('DEMO_SIMULATION');
        });

      // Auto-load diagnostics in background
      fetchDiagnostics();
    } else {
      // Reset states on modal close
      setCreatedOrderId(null);
      setApprovalUrl(null);
      setCompletedTx(null);
      setCompletedCaptureId(null);
      setApiError(null);
      setApprovalStatus('PENDING');
    }
  }, [isOpen, initialApprovalState, initialOrderId]);

  if (!isOpen || !approval) return null;

  // ---------------------------------------------------------------------------
  // 1. Existing Simulated Demo Flow (Instant Mock)
  // ---------------------------------------------------------------------------
  const handleSimulatePayment = () => {
    setIsProcessing(true);
    setApiError(null);
    setTimeout(() => {
      confirmSandboxCheckout(approval.id);
      setIsProcessing(false);
      const simTx = `SIM-TX-${Math.floor(100000 + Math.random() * 900000)}`;
      setCompletedTx(simTx);
    }, 600);
  };

  // ---------------------------------------------------------------------------
  // 2. Real PayPal Sandbox REST API Flow: Create Order
  // ---------------------------------------------------------------------------
  const handleCreatePayPalOrder = async () => {
    setIsProcessing(true);
    setApiError(null);
    try {
      // Ensure the server record is marked APPROVED if needed
      await fetch(`/api/purchases/${approval.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'User initiated PayPal Sandbox Checkout' }),
      }).catch(() => null);

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const returnUrl = `${origin}/?paypal_return=true&purchaseId=${approval.id}`;
      const cancelUrl = `${origin}/?paypal_cancel=true&purchaseId=${approval.id}`;

      const res = await fetch('/api/paypal/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'usr-jordan-miller',
        },
        body: JSON.stringify({
          purchaseApprovalId: approval.id,
          returnUrl,
          cancelUrl,
          items: approval.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create PayPal Sandbox order');
      }

      setCreatedOrderId(data.orderId);
      setApprovalUrl(data.approvalUrl);
      setAuthoritativeTotal(data.totalAmount);
      setApprovalStatus('PENDING');
    } catch (err: any) {
      setApiError(err.message || 'Error communicating with PayPal Sandbox API');
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 3. Check Order Status
  // ---------------------------------------------------------------------------
  const handleCheckOrderStatus = async () => {
    if (!createdOrderId) return;
    setIsCheckingStatus(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/paypal/orders/${encodeURIComponent(createdOrderId)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to query order status');
      }

      if (data.order.status === 'APPROVED') {
        setApprovalStatus('APPROVED');
      } else if (data.order.status === 'VOIDED') {
        setApprovalStatus('CANCELLED');
      } else if (data.order.status === 'COMPLETED') {
        setCompletedTx(createdOrderId);
        recordSandboxCapture(
          approval.id,
          createdOrderId,
          `CAP-${createdOrderId}`,
          authoritativeTotal || approval.totalAmount
        );
      } else {
        setApprovalStatus('PENDING');
      }
    } catch (err: any) {
      setApiError(err.message || 'Failed to check PayPal order status');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 4. Capture PayPal Sandbox Order
  // ---------------------------------------------------------------------------
  const handleCapturePayPalOrder = async () => {
    if (!createdOrderId) return;
    setIsProcessing(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/paypal/orders/${encodeURIComponent(createdOrderId)}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'usr-jordan-miller',
          'PayPal-Request-Id': `idem-${createdOrderId}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to capture PayPal Sandbox order');
      }

      const captureId = data.captureId || `CAP-${createdOrderId}`;
      setCompletedCaptureId(captureId);
      setCompletedTx(createdOrderId);

      // Record in application context
      recordSandboxCapture(
        approval.id,
        createdOrderId,
        captureId,
        authoritativeTotal || approval.totalAmount
      );
    } catch (err: any) {
      setApiError(err.message || 'Error capturing PayPal Sandbox order');
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 5. Buyer Cancellation & Reset Flow
  // ---------------------------------------------------------------------------
  const handleBuyerCancel = () => {
    setApprovalStatus('CANCELLED');
    setApiError(null);
  };

  const handleRestartCheckout = () => {
    setCreatedOrderId(null);
    setApprovalUrl(null);
    setApprovalStatus('PENDING');
    setApiError(null);
  };

  const handleFinish = () => {
    onClose();
    setCompletedTx(null);
    setCompletedCaptureId(null);
    setCurrentRoute('activity-approvals');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 overflow-hidden">
        {/* Prominent Sandbox Isolation Warning */}
        <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50/80 p-3 text-xs text-teal-950">
          <div className="flex items-center gap-1.5 font-bold mb-1">
            <ShieldAlert className="h-4 w-4 text-teal-700 shrink-0" />
            <span>PAYPAL SANDBOX ENVIRONMENT · STRICTLY NO LIVE PAYMENTS</span>
          </div>
          <p className="text-[11px] leading-relaxed text-teal-800">
            PayPilot AI connects exclusively to <span className="font-mono font-semibold">https://api-m.sandbox.paypal.com</span>. Live payment endpoints are strictly rejected by the server policy.
          </p>
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {checkoutMode === 'PAYPAL_SANDBOX_API' ? 'PayPal Sandbox Orders Checkout' : 'Simulated Sandbox Checkout'}
            </h2>
            <p className="text-xs text-slate-500">Purchase ID: {approval.id}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close checkout"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        {!completedTx && (
          <div className="mb-4 grid grid-cols-3 gap-1.5 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setCheckoutMode('PAYPAL_SANDBOX_API');
                setApiError(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold transition-all ${
                checkoutMode === 'PAYPAL_SANDBOX_API'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Server className="h-3.5 w-3.5 text-teal-700 shrink-0" />
              <span className="truncate">Sandbox API</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCheckoutMode('DEMO_SIMULATION');
                setApiError(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold transition-all ${
                checkoutMode === 'DEMO_SIMULATION'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span className="truncate">Simulated</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCheckoutMode('DIAGNOSTICS');
                setApiError(null);
                fetchDiagnostics();
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold transition-all ${
                checkoutMode === 'DIAGNOSTICS'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="h-3.5 w-3.5 text-blue-700 shrink-0" />
              <span className="truncate">Diagnostics</span>
            </button>
          </div>
        )}

        {/* Success Screen: Capture Successful */}
        {completedTx ? (
          <div className="py-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 border border-teal-200 text-teal-700">
              <Check className="h-7 w-7" />
            </div>
            <div>
              <span className="inline-block rounded-full bg-teal-100 text-teal-800 px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase mb-1">
                Capture Successful
              </span>
              <h3 className="text-base font-bold text-slate-900">
                PayPal Sandbox Payment Captured
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                Payment status transitioned to <span className="font-semibold text-teal-800">CAPTURED (SANDBOX)</span>. Authoritative spending mandate and demo balances were updated.
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1.5 font-mono tabular-nums text-left max-w-sm mx-auto">
              <div className="flex justify-between text-slate-500">
                <span>PayPal Order ID:</span>
                <span className="font-semibold text-slate-800">{completedTx}</span>
              </div>
              {completedCaptureId && (
                <div className="flex justify-between text-slate-500">
                  <span>Provider Capture ID:</span>
                  <span className="font-semibold text-teal-800">{completedCaptureId}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Authorized Amount:</span>
                <span className="font-semibold text-slate-800">
                  ${(authoritativeTotal || approval.totalAmount).toFixed(2)} USD
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Environment:</span>
                <span className="text-teal-700 font-semibold">PayPal Sandbox (api-m.sandbox.paypal.com)</span>
              </div>
            </div>

            <button
              onClick={handleFinish}
              className="w-full rounded-lg bg-slate-900 py-2.5 px-4 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              View in Activity & Approvals Audit
            </button>
          </div>
        ) : (
          /* Pre-Checkout Flow */
          <div className="space-y-4 text-xs">
            {/* Purchase Item List with Authoritative Catalog Recalculation Notice */}
            <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 bg-slate-50/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Order Items ({approval.items.length})
                </span>
                <span className="text-[10px] text-teal-700 font-medium">Catalog Price Verified</span>
              </div>

              {approval.items.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1.5">
                  <span className="text-slate-700 truncate pr-2">
                    {item.quantity}× {item.name}
                  </span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    ${item.subtotal.toFixed(2)}
                  </span>
                </div>
              ))}

              <div className="flex justify-between pt-2 mt-1 border-t border-slate-200 text-sm font-bold text-slate-900">
                <span>Authoritative Order Total</span>
                <span className="tabular-nums">${approval.totalAmount.toFixed(2)} USD</span>
              </div>
            </div>

            {/* Error Message if API fails (Capture Failed / Order Error) */}
            {apiError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-900 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold">
                    {apiError.includes('Buyer approval required')
                      ? 'Approval Pending in PayPal Sandbox'
                      : apiError.includes('cancelled')
                      ? 'Cancelled Checkout'
                      : 'PayPal Sandbox Notice'}
                  </p>
                  <p className="text-[11px] text-red-800 mt-0.5 leading-relaxed">{apiError}</p>
                </div>
              </div>
            )}

            {/* Checkout Mode 1: PayPal Sandbox REST API Mode */}
            {checkoutMode === 'PAYPAL_SANDBOX_API' && (
              <div className="space-y-3">
                {hasServerCredentials === false ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 space-y-2">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="h-4 w-4 text-amber-700" />
                      <span>Sandbox Credentials Required for REST Calls</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      To make real calls to <span className="font-mono">api-m.sandbox.paypal.com</span>, add <span className="font-mono font-semibold">PAYPAL_CLIENT_ID</span> and <span className="font-mono font-semibold">PAYPAL_CLIENT_SECRET</span> to your server secrets.
                    </p>
                    <button
                      type="button"
                      onClick={() => setCheckoutMode('DEMO_SIMULATION')}
                      className="rounded-md bg-amber-700 py-1.5 px-3 text-[11px] font-semibold text-white hover:bg-amber-800 transition-colors"
                    >
                      Use Simulated Demo Checkout Instead
                    </button>
                  </div>
                ) : (
                  <>
                    {!createdOrderId ? (
                      /* Step 1: Create Sandbox Order */
                      <div className="space-y-2 rounded-lg border border-slate-200 p-3 bg-slate-50/70">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">Sandbox Checkout: Order Initiation</span>
                          <span className="text-[10px] rounded-full bg-teal-100 text-teal-800 px-2 py-0.5 font-semibold">REST API</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Recalculates cart amounts from authoritative catalog and creates an order on <span className="font-mono">https://api-m.sandbox.paypal.com</span>. Total: <span className="font-semibold text-slate-800">${approval.totalAmount.toFixed(2)} USD</span>.
                        </p>
                        <button
                          type="button"
                          onClick={handleCreatePayPalOrder}
                          disabled={isProcessing}
                          className="w-full mt-2 rounded-lg bg-teal-800 py-2.5 px-4 text-xs font-semibold text-white shadow-xs hover:bg-teal-900 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              <span>Creating Sandbox Order...</span>
                            </>
                          ) : (
                            <span>Initiate PayPal Sandbox Order (${approval.totalAmount.toFixed(2)} USD)</span>
                          )}
                        </button>
                      </div>
                    ) : (
                      /* Step 2: Buyer Approval & Capture Flow */
                      <div className="space-y-3 rounded-lg border border-teal-200 p-3.5 bg-teal-50/30">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-teal-950">Sandbox Checkout: Order Created</span>
                          <span className="text-[10px] font-mono bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-semibold">
                            ID: {createdOrderId}
                          </span>
                        </div>

                        {/* Order Amount and Currency Display */}
                        <div className="flex items-center justify-between rounded-md bg-white border border-teal-200/80 p-2 text-xs">
                          <span className="text-slate-600">Order Amount & Currency:</span>
                          <span className="font-bold text-teal-900 text-sm tabular-nums">
                            ${(authoritativeTotal || approval.totalAmount).toFixed(2)} USD
                          </span>
                        </div>

                        {/* State 1: Cancelled Checkout */}
                        {approvalStatus === 'CANCELLED' ? (
                          <div className="rounded-lg border border-slate-300 bg-slate-100/90 p-3 space-y-2 text-slate-800">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              <XCircle className="h-4 w-4 text-slate-600 shrink-0" />
                              <span>Cancelled Checkout</span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              The checkout session was cancelled by the buyer. No funds were captured and no balances were changed.
                            </p>
                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                onClick={handleRestartCheckout}
                                className="flex items-center gap-1.5 rounded-md bg-teal-800 py-1.5 px-3 text-[11px] font-semibold text-white hover:bg-teal-900"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Restart Checkout</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setCheckoutMode('DEMO_SIMULATION')}
                                className="rounded-md border border-slate-300 bg-white py-1.5 px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Switch to Demo Simulation
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Direct Sandbox Buyer Authentication Security Notice */}
                            <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-2.5 text-[11px] text-teal-950 space-y-1">
                              <div className="flex items-center gap-1.5 font-bold text-teal-900">
                                <Lock className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                                <span>Direct Sandbox Buyer Authentication</span>
                              </div>
                              <p className="text-teal-800 leading-relaxed text-[10px]">
                                Sign in with your Personal Sandbox buyer account (e.g. <span className="font-mono font-semibold">sb-...@personal.example.com</span>) directly on PayPal's secure login screen. PayPilot AI never requests, receives, or stores buyer passwords.
                              </p>
                            </div>

                            {/* State 2: Buyer Approval Confirmed */}
                            {approvalStatus === 'APPROVED' ? (
                              <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                                    <span>Buyer Approval Confirmed</span>
                                  </div>
                                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                                    Ready to Capture
                                  </span>
                                </div>
                                <p className="text-[11px] text-emerald-800 leading-relaxed">
                                  PayPal Sandbox buyer approval has been confirmed! You can now execute server-side capture to finalize payment and record the transaction.
                                </p>
                              </div>
                            ) : (
                              /* State 3: Approval Pending / Buyer Action */
                              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                                    <Clock className="h-4 w-4 text-amber-700 shrink-0" />
                                    <span>Approval Pending</span>
                                  </div>
                                  <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                                    Awaiting Buyer Action
                                  </span>
                                </div>
                                <p className="text-[11px] text-amber-800 leading-relaxed">
                                  PayPal Sandbox orders require buyer authorization before server-side capture. Click the button below to open the Sandbox approval page.
                                </p>

                                {approvalUrl && (
                                  <a
                                    href={approvalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 rounded-lg border border-teal-600 bg-teal-700 py-2 px-3 text-xs font-semibold text-white hover:bg-teal-800 transition-colors shadow-xs"
                                  >
                                    <span>Proceed to PayPal Sandbox Approval</span>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                )}

                                <div className="flex items-center justify-between text-[11px] pt-1">
                                  <button
                                    type="button"
                                    onClick={handleCheckOrderStatus}
                                    disabled={isCheckingStatus}
                                    className="text-teal-800 font-semibold hover:underline flex items-center gap-1"
                                  >
                                    {isCheckingStatus ? (
                                      <>
                                        <RefreshCw className="h-3 w-3 animate-spin" />
                                        <span>Checking...</span>
                                      </>
                                    ) : (
                                      <span>Check Approval Status</span>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleBuyerCancel}
                                    className="text-slate-500 hover:text-slate-800"
                                  >
                                    Cancel Checkout
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Capture Action Button */}
                            <button
                              type="button"
                              onClick={handleCapturePayPalOrder}
                              disabled={isProcessing}
                              className={`w-full rounded-lg py-2.5 px-4 text-xs font-semibold text-white shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                                approvalStatus === 'APPROVED'
                                  ? 'bg-emerald-700 hover:bg-emerald-800 ring-2 ring-emerald-400'
                                  : 'bg-teal-800 hover:bg-teal-900'
                              }`}
                            >
                              {isProcessing ? (
                                <>
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  <span>Capturing PayPal Sandbox Payment...</span>
                                </>
                              ) : (
                                <span>Capture PayPal Sandbox Order (${(authoritativeTotal || approval.totalAmount).toFixed(2)} USD)</span>
                              )}
                            </button>

                            {/* Idempotency Protection Indicator */}
                            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 pt-0.5">
                              <ShieldAlert className="h-3 w-3 text-teal-700 shrink-0" />
                              <span>Idempotency protected with PayPal-Request-Id. Duplicate requests cannot charge twice.</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Checkout Mode 2: Simulated Demo Flow (Instant Mock) */}
            {checkoutMode === 'DEMO_SIMULATION' && (
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-teal-700 shrink-0" />
                  <div>
                    <p className="font-semibold text-slate-900 text-xs">Simulated Sandbox Test Account</p>
                    <p className="text-[10px] text-slate-500">sb-buyer@paypilot.demo · Instant offline test capture</p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-3">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleSimulatePayment}
                    disabled={isProcessing}
                    className="flex-1 rounded-lg bg-slate-900 py-2.5 px-4 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <span>Simulating Demo Capture...</span>
                    ) : (
                      <span>Confirm Demo Payment (${approval.totalAmount.toFixed(2)} USD)</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Checkout Mode 3: Sandbox Checkout Diagnostics */}
            {checkoutMode === 'DIAGNOSTICS' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-blue-700" />
                    <span>PayPal Sandbox Checkout Diagnostics</span>
                  </span>
                  <button
                    type="button"
                    onClick={fetchDiagnostics}
                    disabled={isLoadingDiagnostic}
                    className="text-[11px] font-semibold text-teal-800 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${isLoadingDiagnostic ? 'animate-spin' : ''}`} />
                    <span>Run Diagnostic Check</span>
                  </button>
                </div>

                {isLoadingDiagnostic && !diagnosticReport ? (
                  <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-teal-700" />
                    <span>Evaluating PayPal Sandbox endpoints...</span>
                  </div>
                ) : diagnosticReport ? (
                  <div className="space-y-2.5">
                    {/* 1. OAuth Authentication Status */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <Lock className="h-3.5 w-3.5 text-teal-700" />
                          <span>OAuth Authentication Status</span>
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            diagnosticReport.oauth?.authenticated
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {diagnosticReport.oauth?.authenticated ? 'Authenticated (Bearer)' : 'Unauthenticated'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {diagnosticReport.oauth?.details}
                      </p>
                    </div>

                    {/* 2. Order Creation Status */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <Server className="h-3.5 w-3.5 text-teal-700" />
                          <span>Order Creation Status</span>
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            diagnosticReport.orderCreation?.status === 'ready'
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {diagnosticReport.orderCreation?.status === 'ready' ? 'Ready & Protected' : 'Not Ready'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {diagnosticReport.orderCreation?.details}
                      </p>
                    </div>

                    {/* 3. Approval URL Availability */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <ExternalLink className="h-3.5 w-3.5 text-teal-700" />
                          <span>Approval URL Availability</span>
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            diagnosticReport.approvalUrl?.status === 'ready'
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {diagnosticReport.approvalUrl?.status === 'ready' ? 'Available' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {diagnosticReport.approvalUrl?.details}
                      </p>
                    </div>

                    {/* 4. Capture Endpoint Status */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <ShieldAlert className="h-3.5 w-3.5 text-teal-700" />
                          <span>Capture Endpoint Status</span>
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            diagnosticReport.capture?.status === 'ready'
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {diagnosticReport.capture?.status === 'ready' ? 'Ready (Pre-Approval Gated)' : 'Not Ready'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {diagnosticReport.capture?.details}
                      </p>
                    </div>

                    {/* 5. Payee Routing Configuration */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5 text-teal-700" />
                          <span>Seller / Payee Routing</span>
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            diagnosticReport.payee?.configured
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {diagnosticReport.payee?.configured
                            ? `Explicit (${diagnosticReport.payee.type === 'MERCHANT_ID' ? 'Merchant ID' : 'Email'})`
                            : 'Default App Account'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {diagnosticReport.payee?.details || 'Payee routing defaults to the merchant account owning the API credentials.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 text-xs">Diagnostic report unavailable.</p>
                )}

                <div className="border-t border-slate-100 pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setCheckoutMode('PAYPAL_SANDBOX_API')}
                    className="rounded-md bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-900"
                  >
                    Return to Sandbox Checkout
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
