import React, { useState } from 'react';
import {
  Search,
  Filter,
  Eye,
  Send,
  CheckCircle2,
  Bell,
  Clock,
  Plus,
  ArrowUpDown,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import type { Invoice, InvoiceStatus } from '../../types/index.ts';

interface InvoiceTableProps {
  onOpenCreateModal: () => void;
  onOpenDetailModal: (invoice: Invoice) => void;
  onOpenReminderModal: (invoice: Invoice) => void;
}

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  onOpenCreateModal,
  onOpenDetailModal,
  onOpenReminderModal,
}) => {
  const { invoices, sendInvoice, markInvoicePaid } = useApp();
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Status metrics
  const outstandingInvoices = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue');
  const outstandingTotal = outstandingInvoices.reduce((s, i) => s + i.total, 0);

  const paidThisMonth = invoices.filter((i) => i.status === 'paid');
  const paidTotal = paidThisMonth.reduce((s, i) => s + i.total, 0);

  const overdueInvoices = invoices.filter((i) => i.status === 'overdue');
  const overdueTotal = overdueInvoices.reduce((s, i) => s + i.total, 0);

  const draftInvoices = invoices.filter((i) => i.status === 'draft');
  const draftTotal = draftInvoices.reduce((s, i) => s + i.total, 0);

  // Filtered rows
  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        (inv.clientCompany && inv.clientCompany.toLowerCase().includes(q)) ||
        inv.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getStatusBadge = (inv: Invoice) => {
    switch (inv.status) {
      case 'paid':
        if (inv.settlementType === 'PAYPAL_VERIFIED') {
          return (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              <span>PAYPAL VERIFIED PAID</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
            <CheckCircle2 className="h-3 w-3 text-slate-500" />
            <span>DEMO MANUAL SETTLEMENT</span>
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-800 border border-rose-200">
            <Clock className="h-3 w-3" />
            <span>Overdue</span>
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800 border border-teal-200">
            <Send className="h-3 w-3" />
            <span>Sent</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
            <span>Cancelled</span>
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            <span>Draft</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Outstanding Invoices</span>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            ${outstandingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {outstandingInvoices.length} awaiting settlement
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Paid This Month</span>
          <p className="mt-1 text-2xl font-bold text-emerald-700 tabular-nums">
            ${paidTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {paidThisMonth.length} settled in October
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Overdue Invoices</span>
          <p className="mt-1 text-2xl font-bold text-rose-700 tabular-nums">
            ${overdueTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-rose-600 font-medium">
            {overdueInvoices.length} requires attention
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Draft Invoices</span>
          <p className="mt-1 text-2xl font-bold text-slate-800 tabular-nums">
            ${draftTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {draftInvoices.length} unissued drafts
          </p>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        {/* Interactive Segmented Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 rounded-lg shrink-0">
          {(
            [
              { id: 'all', label: 'All Invoices' },
              { id: 'draft', label: 'Draft' },
              { id: 'sent', label: 'Sent' },
              { id: 'overdue', label: 'Overdue' },
              { id: 'paid', label: 'Paid' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & New Invoice Action */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none"
            />
          </div>

          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Invoice #</th>
              <th className="py-3 px-4">Client</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4">Issue Date</th>
              <th className="py-3 px-4">Due Date</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  <p className="font-medium text-slate-700">No invoices found</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Try adjusting your status filter or create a new invoice with AI.
                  </p>
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900 font-mono tabular-nums">
                    {inv.invoiceNumber}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-800">{inv.clientName}</p>
                    {inv.clientCompany && (
                      <p className="text-[11px] text-slate-400">{inv.clientCompany}</p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                    ${inv.total.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                    {inv.issueDate}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px]">
                    <span className={inv.status === 'overdue' ? 'text-rose-600 font-semibold' : 'text-slate-600'}>
                      {inv.dueDate}
                    </span>
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(inv)}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onOpenDetailModal(inv)}
                        className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        title="View & Edit Invoice"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>

                      {inv.status === 'draft' && (
                        <button
                          onClick={() => sendInvoice(inv.id)}
                          className="flex items-center gap-1 rounded-md bg-teal-800 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-900"
                          title="Send to client (Demo)"
                        >
                          <Send className="h-3 w-3" />
                          <span>Send</span>
                        </button>
                      )}

                      {inv.status === 'overdue' && (
                        <button
                          onClick={() => onOpenReminderModal(inv)}
                          className="flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                          title="Draft payment reminder"
                        >
                          <Bell className="h-3 w-3" />
                          <span>Remind</span>
                        </button>
                      )}

                      {(inv.status === 'sent' || inv.status === 'overdue') && (
                        <button
                          onClick={() => markInvoicePaid(inv.id, 'DEMO_MANUAL')}
                          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200"
                          title="Record demo settlement"
                        >
                          Demo Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
