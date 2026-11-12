import React, { useState } from 'react';
import { Plus, Sparkles, Receipt, FileText } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { InvoiceTable } from '../components/invoice/InvoiceTable.tsx';
import { CreateInvoiceModal } from '../components/invoice/CreateInvoiceModal.tsx';
import { InvoiceDetailModal } from '../components/invoice/InvoiceDetailModal.tsx';
import { ReminderModal } from '../components/invoice/ReminderModal.tsx';
import type { Invoice } from '../types/index.ts';

export const SmartInvoicePage: React.FC = () => {
  const { invoices } = useApp();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [reminderInvoice, setReminderInvoice] = useState<Invoice | null>(null);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Smart Invoices & Receivables
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated billing workflow for freelancers and growing small businesses
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 transition-colors shadow-xs"
        >
          <Sparkles className="h-3.5 w-3.5 text-teal-300" />
          <span>Create Invoice with AI</span>
        </button>
      </div>

      {/* Main Table & Status Cards Component */}
      <InvoiceTable
        onOpenCreateModal={() => setIsCreateOpen(true)}
        onOpenDetailModal={(inv) => setDetailInvoice(inv)}
        onOpenReminderModal={(inv) => setReminderInvoice(inv)}
      />

      {/* Modals */}
      <CreateInvoiceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onInvoiceCreated={(created) => setDetailInvoice(created)}
      />

      <InvoiceDetailModal
        invoice={detailInvoice}
        isOpen={detailInvoice !== null}
        onClose={() => setDetailInvoice(null)}
        onOpenReminderModal={(inv) => {
          setDetailInvoice(null);
          setReminderInvoice(inv);
        }}
      />

      <ReminderModal
        invoice={reminderInvoice}
        isOpen={reminderInvoice !== null}
        onClose={() => setReminderInvoice(null)}
      />
    </div>
  );
};
