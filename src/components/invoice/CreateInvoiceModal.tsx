import React, { useState } from 'react';
import { X, Sparkles, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { calculateInvoiceTotals, parseNaturalInvoicePrompt } from '../../utils/rules.ts';
import type { Invoice, InvoiceLineItem } from '../../types/index.ts';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvoiceCreated: (invoice: Invoice) => void;
}

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  isOpen,
  onClose,
  onInvoiceCreated,
}) => {
  const { clients, addInvoice, user } = useApp();

  // Natural language prompt state
  const [naturalPrompt, setNaturalPrompt] = useState('');
  const [aiParsedNotice, setAiParsedNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || '');
  const [clientName, setClientName] = useState(clients[0]?.name || '');
  const [clientEmail, setClientEmail] = useState(clients[0]?.email || '');
  const [clientCompany, setClientCompany] = useState(clients[0]?.company || '');
  const [description, setDescription] = useState('Design & Advisory Services');
  const [paymentTerms, setPaymentTerms] = useState<'Due on Receipt' | 'Net 14' | 'Net 30' | 'Net 60'>('Net 14');
  const [taxRate, setTaxRate] = useState<number>(0);

  // Default dates
  const today = new Date().toISOString().split('T')[0];
  const [issueDate, setIssueDate] = useState(today);

  const getDueDate = (terms: string, start: string) => {
    const d = new Date(start);
    if (terms === 'Due on Receipt') return start;
    if (terms === 'Net 14') d.setDate(d.getDate() + 14);
    else if (terms === 'Net 30') d.setDate(d.getDate() + 30);
    else if (terms === 'Net 60') d.setDate(d.getDate() + 60);
    return d.toISOString().split('T')[0];
  };

  const [dueDate, setDueDate] = useState(() => getDueDate('Net 14', today));

  // Line items state
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    {
      id: 'li-new-1',
      description: 'UI/UX Design Architecture Sprint',
      quantity: 10,
      unitPrice: 120,
      total: 1200,
    },
  ]);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  // Handle client select change
  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const found = clients.find((c) => c.id === clientId);
    if (found) {
      setClientName(found.name);
      setClientEmail(found.email);
      setClientCompany(found.company);
      setPaymentTerms(found.defaultPaymentTerms);
      setDueDate(getDueDate(found.defaultPaymentTerms, issueDate));
    }
  };

  // Line items manipulation
  const handleUpdateLineItem = (id: string, field: 'description' | 'quantity' | 'unitPrice', val: any) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: val };
          const qty = Number(field === 'quantity' ? val : item.quantity) || 0;
          const price = Number(field === 'unitPrice' ? val : item.unitPrice) || 0;
          updated.total = Math.round(qty * price * 100) / 100;
          return updated;
        }
        return item;
      })
    );
  };

  const handleAddLineItem = () => {
    const newItem: InvoiceLineItem = {
      id: `li-new-${Date.now()}`,
      description: '',
      quantity: 1,
      unitPrice: 100,
      total: 100,
    };
    setLineItems((prev) => [...prev, newItem]);
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Pure totals calculation
  const totals = calculateInvoiceTotals(lineItems, taxRate);

  // Natural language parsing with AI helper
  const handleApplyAIPrompt = async () => {
    if (!naturalPrompt.trim()) return;

    try {
      const res = await fetch('/api/invoices/prepare-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientName || 'Client',
          clientEmail,
          clientCompany,
          description: naturalPrompt,
          totalAmountHint: parseNaturalInvoicePrompt(naturalPrompt).amount,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.draft) {
          setLineItems(data.draft.lineItems);
          setDescription(data.draft.description);
          setAiParsedNotice(`Server AI prepared draft: Subtotal $${data.draft.subtotal.toFixed(2)}. Requires user review.`);
          return;
        }
      }
    } catch (e) {
      // Graceful fallback to client parser
    }

    const parsed = parseNaturalInvoicePrompt(naturalPrompt);

    if (parsed.amount) {
      setLineItems([
        {
          id: `li-ai-${Date.now()}`,
          description: parsed.description || 'Professional Consultation Services',
          quantity: 1,
          unitPrice: parsed.amount,
          total: parsed.amount,
        },
      ]);
    }
    if (parsed.description) {
      setDescription(parsed.description);
    }
    if (parsed.paymentTerms) {
      setPaymentTerms(parsed.paymentTerms);
      setDueDate(getDueDate(parsed.paymentTerms, issueDate));
    }

    setAiParsedNotice(
      `Extracted: ${parsed.amount ? `$${parsed.amount.toFixed(2)}` : ''} ${
        parsed.description ? `for "${parsed.description}"` : ''
      } ${parsed.paymentTerms ? `(${parsed.paymentTerms})` : ''}`
    );
  };

  // Explicit confirmation validation
  const handleSaveInvoice = async (status: 'draft' | 'sent') => {
    const newErrors: Record<string, string> = {};

    if (!clientName.trim()) newErrors.clientName = 'Client name is required.';
    if (!clientEmail.trim() || !clientEmail.includes('@')) {
      newErrors.clientEmail = 'Valid client email is required.';
    }
    if (lineItems.length === 0) {
      newErrors.lineItems = 'At least one line item is required.';
    }
    const invalidItems = lineItems.filter(
      (item) => !item.description.trim() || item.quantity <= 0 || item.unitPrice <= 0
    );
    if (invalidItems.length > 0) {
      newErrors.items = 'All line items must have a description, positive quantity, and unit price.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    let paypalInvoiceData: any = null;

    try {
      const days = paymentTerms === 'Due on Receipt' ? 0 : paymentTerms === 'Net 30' ? 30 : paymentTerms === 'Net 60' ? 60 : 14;
      const res = await fetch('/api/paypal/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          clientEmail,
          clientCompany,
          description,
          lineItems,
          paymentTermsDays: days,
          currency: 'USD',
          taxRate,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.invoice) {
          paypalInvoiceData = data.invoice;
          if (status === 'sent' && data.invoice.id) {
            await fetch(`/api/paypal/invoices/${encodeURIComponent(data.invoice.id)}/send`, {
              method: 'POST',
            });
          }
        }
      }
    } catch {
      // Fallback cleanly
    } finally {
      setIsSubmitting(false);
    }

    const created = addInvoice({
      clientId: selectedClientId,
      clientName,
      clientEmail,
      clientCompany,
      description,
      issueDate,
      dueDate,
      status,
      lineItems,
      subtotal: totals.subtotal,
      taxRate,
      taxAmount: totals.taxAmount,
      total: totals.total,
      currency: user.currency,
      paymentTerms,
      remindersSentCount: 0,
      paypalInvoiceId: paypalInvoiceData?.paypalInvoiceId,
      paypalStatus: paypalInvoiceData ? (status === 'sent' ? 'SENT' : 'DRAFT') : undefined,
    });

    onInvoiceCreated(created);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Create Smart Invoice</h2>
            <p className="text-xs text-slate-500">
              Draft or dispatch verified commercial invoices with automated totals calculation
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Natural Language Prompt Box */}
        <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3 mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-teal-900">
              <Sparkles className="h-3.5 w-3.5 text-teal-700" />
              Draft with AI Natural Language
            </span>
            <button
              type="button"
              onClick={() =>
                setNaturalPrompt('Create a $1,200 invoice for website design, due in 14 days')
              }
              className="text-[11px] text-teal-800 hover:underline"
            >
              Use example prompt
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Create a $1,200 invoice for website design, due in 14 days"
              value={naturalPrompt}
              onChange={(e) => setNaturalPrompt(e.target.value)}
              className="flex-1 rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-teal-600"
            />
            <button
              type="button"
              onClick={handleApplyAIPrompt}
              className="rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-900 shadow-2xs"
            >
              Apply Prompt
            </button>
          </div>
          {aiParsedNotice && (
            <p className="mt-1.5 text-[11px] font-medium text-teal-800 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
              {aiParsedNotice}
            </p>
          )}
        </div>

        {/* Invoice Form */}
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4 text-xs">
          {/* Client Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Select Client</label>
              <select
                value={selectedClientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-teal-500"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company} ({c.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Client Email</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-teal-500"
              />
              {errors.clientEmail && (
                <span className="text-[11px] text-rose-600">{errors.clientEmail}</span>
              )}
            </div>
          </div>

          {/* Invoice Subject & Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">Description / Project</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Payment Terms</label>
              <select
                value={paymentTerms}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setPaymentTerms(val);
                  setDueDate(getDueDate(val, issueDate));
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-teal-500"
              >
                <option value="Due on Receipt">Due on Receipt</option>
                <option value="Net 14">Net 14 (14 Days)</option>
                <option value="Net 30">Net 30 (30 Days)</option>
                <option value="Net 60">Net 60 (60 Days)</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Issue Date</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => {
                  setIssueDate(e.target.value);
                  setDueDate(getDueDate(paymentTerms, e.target.value));
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-teal-500"
              />
            </div>
          </div>

          {/* Line Items Editor */}
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-800">Line Items</span>
              <button
                type="button"
                onClick={handleAddLineItem}
                className="flex items-center gap-1 text-[11px] font-semibold text-teal-800 hover:underline"
              >
                <Plus className="h-3 w-3" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2">
              {lineItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Item description..."
                    value={item.description}
                    onChange={(e) => handleUpdateLineItem(item.id, 'description', e.target.value)}
                    className="flex-3 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                  />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) =>
                      handleUpdateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)
                    }
                    className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 tabular-nums text-right"
                  />
                  <div className="relative w-24">
                    <span className="absolute left-2 top-1.5 text-slate-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Price"
                      value={item.unitPrice}
                      onChange={(e) =>
                        handleUpdateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white pl-5 pr-2 py-1.5 text-xs text-slate-800 tabular-nums text-right"
                    />
                  </div>
                  <span className="w-20 text-right font-semibold text-slate-900 tabular-nums">
                    ${item.total.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLineItem(item.id)}
                    disabled={lineItems.length === 1}
                    className="text-slate-400 hover:text-rose-600 p-1 disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {errors.items && <p className="mt-1 text-[11px] text-rose-600">{errors.items}</p>}
          </div>

          {/* Calculated Totals Box */}
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/80 space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                ${totals.subtotal.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-600">
              <div className="flex items-center gap-2">
                <span>Tax Rate:</span>
                <select
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value))}
                  className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700"
                >
                  <option value={0}>0% (Exempt)</option>
                  <option value={0.08}>8.0% Standard</option>
                  <option value={0.1}>10.0% VAT</option>
                </select>
              </div>
              <span className="tabular-nums font-medium text-slate-800">
                ${totals.taxAmount.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
              <span>Calculated Total:</span>
              <span className="tabular-nums text-teal-800">${totals.total.toFixed(2)} USD</span>
            </div>
          </div>

          {/* Action buttons with explicit user confirmation */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSaveInvoice('draft')}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                Save as Draft
              </button>

              <button
                type="button"
                onClick={() => handleSaveInvoice('sent')}
                className="rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 shadow-xs"
              >
                Confirm & Send (Demo)
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
