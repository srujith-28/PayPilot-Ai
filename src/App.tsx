/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { Header } from './components/layout/Header.tsx';

// Pages
import { OverviewPage } from './pages/OverviewPage.tsx';
import { SmartSpendPage } from './pages/SmartSpendPage.tsx';
import { SmartInvoicePage } from './pages/SmartInvoicePage.tsx';
import { CashflowForecastPage } from './pages/CashflowForecastPage.tsx';
import { AIAssistantPage } from './pages/AIAssistantPage.tsx';
import { ActivityApprovalsPage } from './pages/ActivityApprovalsPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';

// Global Modals
import { PurchaseReviewModal } from './components/spend/PurchaseReviewModal.tsx';
import { SandboxCheckoutModal } from './components/spend/SandboxCheckoutModal.tsx';
import { CreateInvoiceModal } from './components/invoice/CreateInvoiceModal.tsx';
import { InvoiceDetailModal } from './components/invoice/InvoiceDetailModal.tsx';
import { ReminderModal } from './components/invoice/ReminderModal.tsx';

const AppContent: React.FC = () => {
  const {
    currentRoute,
    activeModal,
    setActiveModal,
    selectedInvoice,
    setSelectedInvoice,
    checkoutApproval,
    setCheckoutApproval,
    proposeCartPurchase,
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [reminderTargetInvoice, setReminderTargetInvoice] = useState<any>(null);
  const [initialApprovalState, setInitialApprovalState] = useState<'PENDING' | 'APPROVED' | 'CANCELLED' | undefined>(undefined);
  const [initialOrderId, setInitialOrderId] = useState<string | undefined>(undefined);
  const [callbackBanner, setCallbackBanner] = useState<{ type: 'success' | 'cancel'; message: string } | null>(null);

  const { approvals } = useApp();

  // Listen for PayPal Sandbox buyer return and cancel callbacks
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || undefined;
    const hasCancel = params.get('paypal_cancel') === 'true';
    const hasReturn = !hasCancel && (params.get('paypal_return') === 'true' || Boolean(token));
    const purchaseId = params.get('purchaseId');

    if (hasReturn) {
      setCallbackBanner({
        type: 'success',
        message: 'PayPal Sandbox buyer approval received. Ready to capture payment on server. (Notice: Buyer approval is not payment confirmation; server capture is required).',
      });
      setInitialApprovalState('APPROVED');
      if (token) {
        setInitialOrderId(token);
      }
      const targetAppr = approvals.find((a) => a.id === purchaseId) || checkoutApproval || approvals[0];
      if (targetAppr) {
        setCheckoutApproval(targetAppr);
        setActiveModal('SANDBOX_CHECKOUT');
      }
      window.history.replaceState({}, '', window.location.pathname);
    } else if (hasCancel) {
      setCallbackBanner({
        type: 'cancel',
        message: 'PayPal Sandbox checkout was cancelled by the buyer. No funds were captured.',
      });
      setInitialApprovalState('CANCELLED');
      if (token) {
        setInitialOrderId(token);
      }
      const targetAppr = approvals.find((a) => a.id === purchaseId) || checkoutApproval || approvals[0];
      if (targetAppr) {
        setCheckoutApproval(targetAppr);
        setActiveModal('SANDBOX_CHECKOUT');
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [approvals]);

  const renderActiveRoute = () => {
    switch (currentRoute) {
      case 'overview':
        return <OverviewPage />;
      case 'smart-spend':
        return <SmartSpendPage />;
      case 'smart-invoice':
        return <SmartInvoicePage />;
      case 'cashflow-forecast':
        return <CashflowForecastPage />;
      case 'ai-assistant':
        return <AIAssistantPage />;
      case 'activity-approvals':
        return <ActivityApprovalsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Sidebar (Persistent on desktop, drawer on mobile) */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* Main Workspace Frame */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-4">
            {callbackBanner && (
              <div
                className={`flex items-center justify-between rounded-xl p-3.5 text-xs border ${
                  callbackBanner.type === 'success'
                    ? 'border-teal-200 bg-teal-50 text-teal-900'
                    : 'border-slate-300 bg-slate-100 text-slate-800'
                }`}
              >
                <span>{callbackBanner.message}</span>
                <button
                  onClick={() => setCallbackBanner(null)}
                  className="ml-3 font-bold hover:underline"
                >
                  Dismiss
                </button>
              </div>
            )}
            {renderActiveRoute()}
          </div>
        </main>
      </div>

      {/* Global Purchase Review Modal */}
      <PurchaseReviewModal
        isOpen={activeModal === 'PURCHASE_REVIEW'}
        onClose={() => setActiveModal(null)}
        onContinueToCheckout={(approvedPurchase) => {
          if (approvedPurchase) {
            setCheckoutApproval(approvedPurchase);
          }
          setActiveModal('SANDBOX_CHECKOUT');
        }}
      />

      {/* Global Simulated Sandbox Checkout Modal */}
      <SandboxCheckoutModal
        isOpen={activeModal === 'SANDBOX_CHECKOUT'}
        onClose={() => {
          setActiveModal(null);
          setCheckoutApproval(null);
          setInitialApprovalState(undefined);
          setInitialOrderId(undefined);
        }}
        approval={checkoutApproval}
        initialApprovalState={initialApprovalState}
        initialOrderId={initialOrderId}
      />

      {/* Global Create Invoice Modal */}
      <CreateInvoiceModal
        isOpen={activeModal === 'CREATE_INVOICE'}
        onClose={() => setActiveModal(null)}
        onInvoiceCreated={(created) => {
          setSelectedInvoice(created);
        }}
      />

      {/* Global Invoice Detail Modal */}
      <InvoiceDetailModal
        isOpen={selectedInvoice !== null}
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onOpenReminderModal={(inv) => {
          setSelectedInvoice(null);
          setReminderTargetInvoice(inv);
        }}
      />

      {/* Global Overdue Reminder Modal */}
      <ReminderModal
        isOpen={reminderTargetInvoice !== null}
        invoice={reminderTargetInvoice}
        onClose={() => setReminderTargetInvoice(null)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
