import React, { useState } from 'react';
import { X, Send, CheckCircle2, Clock, Bell, Printer, RefreshCw, ShieldCheck, AlertCircle, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import type { Invoice } from '../../types/index.ts';

interface InvoiceDetailModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenReminderModal: (invoice: Invoice) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onOpenReminderModal,
}) => {
  const { user, sendInvoice, markInvoicePaid } = useApp();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  if (!isOpen || !invoice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl border border-slate-200 my-8">
        {/* Header with actions */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-slate-900">{invoice.invoiceNumber}</span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold ${
                invoice.status === 'paid'
                  ? 'bg-emerald-50 text-emerald-800'
                  : invoice.status === 'overdue'
                  ? 'bg-rose-50 text-rose-800'
                  : invoice.status === 'sent'
                  ? 'bg-teal-50 text-teal-800'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {invoice.status.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
              title="Print Invoice"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Invoice Header Details */}
        <div className="grid grid-cols-2 gap-6 text-xs mb-6">
          <div>
            <span className="font-semibold text-slate-400 text-[11px] uppercase tracking-wider block mb-1">
              From
            </span>
            <p className="font-bold text-slate-900">{user.name}</p>
            <p className="text-slate-600">{user.companyName}</p>
            <p className="text-slate-500">{user.email}</p>
          </div>

          <div className="text-right">
            <span className="font-semibold text-slate-400 text-[11px] uppercase tracking-wider block mb-1">
              Billed To
            </span>
            <p className="font-bold text-slate-900">{invoice.clientName}</p>
            {invoice.clientCompany && <p className="text-slate-600">{invoice.clientCompany}</p>}
            <p className="text-slate-500">{invoice.clientEmail}</p>
          </div>
        </div>

        {/* Meta Bar */}
        <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 text-xs border border-slate-200/80 mb-5">
          <div>
            <span className="text-[11px] text-slate-400 block">Issue Date</span>
            <span className="font-semibold text-slate-800 font-mono">{invoice.issueDate}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Due Date</span>
            <span className="font-semibold text-slate-800 font-mono">{invoice.dueDate}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Payment Terms</span>
            <span className="font-semibold text-slate-800">{invoice.paymentTerms}</span>
          </div>
        </div>

        {/* Project Description */}
        <div className="mb-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Subject & Scope
          </span>
          <p className="text-xs text-slate-700 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
            {invoice.description}
          </p>
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 mb-5">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-right">Qty / Hrs</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.lineItems.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 px-3 font-medium text-slate-800">{item.description}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">{item.quantity}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">${item.unitPrice.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-900 tabular-nums">
                    ${item.total.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="flex justify-end mb-6">
          <div className="w-64 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold tabular-nums">${invoice.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax ({invoice.taxRate * 100}%):</span>
              <span className="tabular-nums">${invoice.taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold text-slate-900">
              <span>Total Due:</span>
              <span className="tabular-nums text-teal-800">${invoice.total.toFixed(2)} USD</span>
            </div>
          </div>
        </div>

        {/* Reminders History Notice if any */}
        {invoice.remindersSentCount > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900 mb-4 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-amber-700" />
              <span>{invoice.remindersSentCount} payment reminder notice sent to date.</span>
            </span>
            {invoice.lastReminderDate && (
              <span className="text-amber-800 font-mono">Last sent: {invoice.lastReminderDate}</span>
            )}
          </div>
        )}

        {/* Verification feedback alert */}
        {verificationFeedback && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
            <Info className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
            <span>{verificationFeedback}</span>
          </div>
        )}

        {/* Modal Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-4 gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 w-full sm:w-auto"
          >
            Close
          </button>

          <div className="flex flex-wrap items-center gap-2 justify-end w-full sm:w-auto">
            {invoice.status === 'draft' && (
              <button
                onClick={() => {
                  sendInvoice(invoice.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 shadow-xs"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send to Client</span>
              </button>
            )}

            {invoice.status === 'overdue' && (
              <button
                onClick={() => {
                  onClose();
                  onOpenReminderModal(invoice);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
              >
                <Bell className="h-3.5 w-3.5" />
                <span>Draft Reminder Notice</span>
              </button>
            )}

            {/* Authoritative PayPal Sandbox Verification for Sent / Overdue Invoices */}
            {(invoice.status === 'sent' || invoice.status === 'overdue') && invoice.paypalInvoiceId && (
              <button
                disabled={isVerifying}
                onClick={async () => {
                  setIsVerifying(true);
                  try {
                    const res = await fetch(`/api/paypal/invoices/${encodeURIComponent(invoice.id)}`);
                    const data = await res.json();
                    if (data.isPaid) {
                      markInvoicePaid(invoice.id, 'PAYPAL_VERIFIED');
                      setVerificationFeedback('Authoritative PayPal Confirmation: Settlement verified via PayPal Sandbox API. Invoice marked PAID.');
                    } else {
                      setVerificationFeedback(`Authoritative PayPal Sandbox Status: ${data.paypalLiveStatus || 'UNPAID'}. Payment has not been captured by buyer yet.`);
                    }
                  } catch (err: any) {
                    setVerificationFeedback(`Status query error: ${err.message}`);
                  } finally {
                    setIsVerifying(false);
                  }
                }}
                className="flex items-center gap-1.5 rounded-lg border border-teal-600 bg-teal-50 px-3.5 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 shadow-2xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-teal-700 ${isVerifying ? 'animate-spin' : ''}`} />
                <span>Verify PayPal Settlement</span>
              </button>
            )}

            {(invoice.status === 'sent' || invoice.status === 'overdue') && (
              <button
                onClick={() => {
                  markInvoicePaid(invoice.id, 'DEMO_MANUAL');
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs"
                title="Mark paid locally in demo workspace"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Record Settlement (Demo Manual)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
