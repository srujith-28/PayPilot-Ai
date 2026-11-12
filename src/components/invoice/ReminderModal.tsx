import React, { useState } from 'react';
import { X, Send, Sparkles, Bell, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import type { Invoice } from '../../types/index.ts';

interface ReminderModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  invoice,
  isOpen,
  onClose,
}) => {
  const { sendInvoiceReminder, user } = useApp();
  const [tone, setTone] = useState<'friendly' | 'formal' | 'urgent'>('friendly');
  const [customMessage, setCustomMessage] = useState('');
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen || !invoice) return null;

  const toneTemplates = {
    friendly: `Hi ${invoice.clientName},\n\nI hope you're having a productive week! Just a quick, gentle reminder that invoice ${invoice.invoiceNumber} for $${invoice.total.toFixed(2)} (${invoice.description}) was due on ${invoice.dueDate}.\n\nPlease let me know if you need any updated billing details or another copy of the invoice.\n\nWarm regards,\n${user.name}\n${user.companyName}`,
    formal: `Dear ${invoice.clientName},\n\nThis is a formal payment notice regarding outstanding invoice ${invoice.invoiceNumber} in the amount of $${invoice.total.toFixed(2)}, which matured on ${invoice.dueDate}.\n\nKindly review and process this remittance at your earliest convenience to maintain current account status.\n\nSincerely,\n${user.name}\n${user.companyName}`,
    urgent: `URGENT NOTICE: Overdue Payment for Invoice ${invoice.invoiceNumber}\n\nDear Accounts Payable / ${invoice.clientName},\n\nOur records show that invoice ${invoice.invoiceNumber} ($${invoice.total.toFixed(2)}) is now overdue past the contractual terms (${invoice.paymentTerms}).\n\nPlease confirm remittance initiation today or reply with expected settlement timing.\n\nBest regards,\n${user.name}\n${user.companyName}`,
  };

  const messageText = customMessage || toneTemplates[tone];

  const handleSendReminder = () => {
    sendInvoiceReminder(invoice.id, `Dispatched ${tone} reminder to ${invoice.clientEmail}`);
    setSentSuccess(true);
    setTimeout(() => {
      setSentSuccess(false);
      setCustomMessage('');
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-rose-600" />
            <h2 className="text-base font-bold text-slate-900">Draft Payment Reminder</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {sentSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Check className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Reminder Dispatched (Demo)</h3>
            <p className="text-xs text-slate-500">
              Simulated notice sent to {invoice.clientEmail}. Activity audit updated.
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Target invoice recap */}
            <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3 flex justify-between items-center">
              <div>
                <p className="font-semibold text-slate-900">{invoice.invoiceNumber} · {invoice.clientName}</p>
                <p className="text-slate-500 text-[11px]">Due: {invoice.dueDate} · {invoice.clientEmail}</p>
              </div>
              <span className="font-bold text-slate-900 text-sm tabular-nums">
                ${invoice.total.toFixed(2)}
              </span>
            </div>

            {/* Tone selector */}
            <div>
              <label className="block font-medium text-slate-700 mb-1.5">Select AI Reminder Tone</label>
              <div className="grid grid-cols-3 gap-2">
                {(['friendly', 'formal', 'urgent'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTone(t);
                      setCustomMessage('');
                    }}
                    className={`rounded-lg border py-2 px-3 text-xs font-semibold capitalize transition-colors ${
                      tone === t
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Drafted Email Message */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-medium text-slate-700">Email Draft</label>
                <span className="text-[11px] text-teal-800 flex items-center gap-1 font-medium">
                  <Sparkles className="h-3 w-3" />
                  AI Assisted
                </span>
              </div>
              <textarea
                rows={6}
                value={messageText}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 leading-relaxed focus:border-teal-500 focus:outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSendReminder}
                className="flex items-center gap-1.5 rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 shadow-xs"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send Reminder (Demo)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
