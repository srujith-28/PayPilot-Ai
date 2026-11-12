/**
 * Controlled Application Tools for PayPilot AI
 *
 * Exposes narrowly scoped server-side functions for:
 * 1. Searching the product catalog
 * 2. Reading spending mandates
 * 3. Evaluating a proposed cart with the deterministic policy engine
 * 4. Reading invoices and overdue status
 * 5. Preparing invoice drafts (calculating totals deterministically)
 * 6. Reading existing cashflow forecast calculations
 * 7. Simulating the effect of a proposed expense
 *
 * Boundary Enforcement:
 * Gemini and AI orchestration can NEVER execute:
 * - approvePurchase
 * - bypassSpendingLimit
 * - sendInvoiceWithoutUserConfirmation
 * - capturePayment
 * - markInvoicePaid
 * Any attempt to trigger these actions returns a structured policy rejection.
 */

import {
  initialMandate,
  initialInvoices,
  initialProducts,
  initialCashflowForecast,
  initialApprovals,
} from '../data/mockData.ts';
import {
  evaluateSpendingPolicy,
  calculateInvoiceTotals,
  simulateAffordability,
} from '../utils/rules.ts';
import type {
  Product,
  SpendingMandate,
  Invoice,
  CartItem,
  PolicyEvaluation,
  CashflowPoint,
  AffordabilityResult,
  InvoiceLineItem,
  PurchaseApproval,
} from '../types/index.ts';

// ---------------------------------------------------------------------------
// 1. Catalog Search Tool
// ---------------------------------------------------------------------------

export interface SearchCatalogParams {
  query?: string;
  category?: string;
  maxPrice?: number;
}

export function searchCatalog(params: SearchCatalogParams): {
  count: number;
  products: Array<Pick<Product, 'id' | 'name' | 'category' | 'price' | 'inStock' | 'rating' | 'specs'>>;
} {
  let results = [...initialProducts];

  if (params.category && params.category.trim() !== '') {
    const cat = params.category.toLowerCase().trim();
    results = results.filter((p) => p.category.toLowerCase().includes(cat));
  }

  if (params.query && params.query.trim() !== '') {
    const q = params.query.toLowerCase().trim();
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        Object.values(p.specs).some((s) => s.toLowerCase().includes(q))
    );
  }

  if (typeof params.maxPrice === 'number' && !isNaN(params.maxPrice) && params.maxPrice > 0) {
    results = results.filter((p) => p.price <= params.maxPrice!);
  }

  return {
    count: results.length,
    products: results.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      inStock: p.inStock,
      rating: p.rating,
      specs: p.specs,
    })),
  };
}

// ---------------------------------------------------------------------------
// 2. Spending Mandate Tool
// ---------------------------------------------------------------------------

export function getSpendingMandate(): SpendingMandate {
  // Always returns authoritative policy rules
  return { ...initialMandate };
}

// ---------------------------------------------------------------------------
// 3. Deterministic Policy Cart Evaluation Tool
// ---------------------------------------------------------------------------

export interface EvaluateCartParams {
  items: Array<{
    productId?: string;
    name: string;
    price: number;
    quantity: number;
    category?: string;
  }>;
  currentAvailableCash?: number;
  minimumReserveFloor?: number;
}

export function evaluateCartPolicy(params: EvaluateCartParams): PolicyEvaluation {
  if (!params.items || !Array.isArray(params.items) || params.items.length === 0) {
    throw new Error('Missing cart items to evaluate');
  }

  // Hydrate category from catalog if missing
  const cartItems: CartItem[] = params.items.map((item, index) => {
    let cat = item.category || 'General';
    let foundProduct: Product | undefined;
    if (item.productId) {
      foundProduct = initialProducts.find((p) => p.id === item.productId);
      if (foundProduct) cat = foundProduct.category;
    }

    const product: Product = foundProduct
      ? { ...foundProduct, price: Number(item.price) || foundProduct.price }
      : {
          id: item.productId || `custom-${index}`,
          name: item.name,
          category: cat,
          price: Number(item.price) || 0,
          vendor: 'Authorized Merchant',
          description: item.name,
          image: '',
          rating: 4.8,
          reviewsCount: 1,
          inStock: true,
          specs: {},
          comparisonNotes: '',
        };

    return {
      product,
      quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
    };
  });

  const availableCash = typeof params.currentAvailableCash === 'number'
    ? params.currentAvailableCash
    : 14250;
  const reserveFloor = typeof params.minimumReserveFloor === 'number'
    ? params.minimumReserveFloor
    : 6000;

  return evaluateSpendingPolicy(cartItems, initialMandate, availableCash, reserveFloor);
}

// ---------------------------------------------------------------------------
// 4. Invoices and Overdue Tool
// ---------------------------------------------------------------------------

export interface GetInvoicesParams {
  status?: 'all' | 'draft' | 'sent' | 'paid' | 'overdue';
  clientId?: string;
}

export function getInvoices(params?: GetInvoicesParams): {
  count: number;
  invoices: Array<Pick<Invoice, 'id' | 'invoiceNumber' | 'clientName' | 'clientCompany' | 'dueDate' | 'status' | 'total' | 'issueDate'>>;
  summary: {
    totalOutstanding: number;
    totalOverdue: number;
    overdueCount: number;
  };
} {
  let list = [...initialInvoices];

  if (params?.status && params.status !== 'all') {
    list = list.filter((i) => i.status === params.status);
  }

  if (params?.clientId) {
    list = list.filter((i) => i.clientId === params.clientId);
  }

  const outstanding = initialInvoices
    .filter((i) => i.status === 'sent' || i.status === 'overdue')
    .reduce((sum, i) => sum + i.total, 0);

  const overdueList = initialInvoices.filter((i) => i.status === 'overdue');
  const overdueTotal = overdueList.reduce((sum, i) => sum + i.total, 0);

  return {
    count: list.length,
    invoices: list.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      clientName: i.clientName,
      clientCompany: i.clientCompany,
      dueDate: i.dueDate,
      status: i.status,
      total: i.total,
      issueDate: i.issueDate,
    })),
    summary: {
      totalOutstanding: outstanding,
      totalOverdue: overdueTotal,
      overdueCount: overdueList.length,
    },
  };
}

// ---------------------------------------------------------------------------
// 5. Prepare Invoice Draft Tool
// ---------------------------------------------------------------------------

export interface PrepareInvoiceDraftParams {
  clientName: string;
  clientEmail?: string;
  clientCompany?: string;
  description: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalAmountHint?: number;
  paymentTermsDays?: number;
}

export function prepareInvoiceDraft(params: PrepareInvoiceDraftParams): {
  draft: Omit<Invoice, 'id' | 'invoiceNumber'> & { isDraftPreview: true };
  requiresUserReview: true;
  message: string;
} {
  // Validate mandatory fields
  if (!params.clientName || params.clientName.trim() === '') {
    throw new Error('Missing clientName: Client name or company is required to prepare an invoice draft.');
  }

  if (!params.description || params.description.trim() === '') {
    throw new Error('Missing description: Project or service description is required to prepare an invoice draft.');
  }

  let lineItems: InvoiceLineItem[] = [];

  if (params.lineItems && params.lineItems.length > 0) {
    lineItems = params.lineItems.map((li, index) => {
      const qty = Number(li.quantity) > 0 ? Number(li.quantity) : 1;
      const unit = Number(li.unitPrice) >= 0 ? Number(li.unitPrice) : 0;
      return {
        id: `draft-li-${index + 1}`,
        description: li.description || 'Consulting Services',
        quantity: qty,
        unitPrice: unit,
        total: Math.round(qty * unit * 100) / 100,
      };
    });
  } else {
    // Generate line item from description and total hint or fallback
    const total = Number(params.totalAmountHint) > 0 ? Number(params.totalAmountHint) : 1000;
    lineItems = [
      {
        id: 'draft-li-1',
        description: params.description,
        quantity: 1,
        unitPrice: total,
        total: total,
      },
    ];
  }

  const { subtotal, taxAmount, total } = calculateInvoiceTotals(lineItems, 0);

  const today = new Date();
  const issueDateStr = today.toISOString().split('T')[0];
  const termsDays = params.paymentTermsDays || 14;
  const dueDateObj = new Date(today.getTime() + termsDays * 24 * 60 * 60 * 1000);
  const dueDateStr = dueDateObj.toISOString().split('T')[0];

  return {
    draft: {
      isDraftPreview: true,
      clientId: 'cli-custom',
      clientName: params.clientName.trim(),
      clientCompany: params.clientCompany?.trim() || params.clientName.trim(),
      clientEmail: params.clientEmail?.trim() || 'billing@client.com',
      description: params.description.trim(),
      issueDate: issueDateStr,
      dueDate: dueDateStr,
      status: 'draft',
      lineItems,
      subtotal,
      taxRate: 0,
      taxAmount,
      total,
      currency: 'USD',
      paymentTerms: (termsDays === 30 ? 'Net 30' : termsDays === 60 ? 'Net 60' : termsDays === 0 ? 'Due on Receipt' : 'Net 14') as 'Due on Receipt' | 'Net 14' | 'Net 30' | 'Net 60',
      remindersSentCount: 0,
    },
    requiresUserReview: true,
    message: 'Invoice draft prepared. This is not sent and requires explicit user review and confirmation before dispatch.',
  };
}

// ---------------------------------------------------------------------------
// 6. Cashflow Forecast Tool
// ---------------------------------------------------------------------------

export function getCashflowForecast(): {
  currentCashReserve: number;
  minimumReserveFloor: number;
  weeks: Array<Pick<CashflowPoint, 'weekIndex' | 'weekLabel' | 'expectedIncoming' | 'expectedOutgoing' | 'netCash' | 'projectedEndingCash'>>;
} {
  return {
    currentCashReserve: 14250,
    minimumReserveFloor: 6000,
    weeks: initialCashflowForecast.map((w) => ({
      weekIndex: w.weekIndex,
      weekLabel: w.weekLabel,
      expectedIncoming: w.expectedIncoming,
      expectedOutgoing: w.expectedOutgoing,
      netCash: w.netCash,
      projectedEndingCash: w.projectedEndingCash,
    })),
  };
}

// ---------------------------------------------------------------------------
// 7. Affordability Simulation Tool
// ---------------------------------------------------------------------------

export interface SimulateExpenseParams {
  expenseAmount: number;
  targetWeekIndex?: number;
  minimumReserve?: number;
}

export function simulateExpenseImpact(params: SimulateExpenseParams): AffordabilityResult {
  const amount = Number(params.expenseAmount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Invalid expense amount: Must be a positive number.');
  }

  const weekIdx = typeof params.targetWeekIndex === 'number' ? params.targetWeekIndex : 1;
  const reserve = typeof params.minimumReserve === 'number' ? params.minimumReserve : 6000;

  return simulateAffordability(initialCashflowForecast, amount, weekIdx, reserve);
}

// ---------------------------------------------------------------------------
// 8. Recent Purchases Tool
// ---------------------------------------------------------------------------

let purchaseApprovalsProvider: () => PurchaseApproval[] = () => initialApprovals;

export function setPurchaseApprovalsProvider(provider: () => PurchaseApproval[]): void {
  purchaseApprovalsProvider = provider;
}

export interface GetRecentPurchasesParams {
  limit?: number;
}

export function getRecentPurchases(params?: GetRecentPurchasesParams): {
  count: number;
  purchases: Array<{
    id: string;
    title: string;
    totalAmount: number;
    state: string;
    paymentStatus?: string;
    requestDate: string;
    sandboxTransactionId?: string;
  }>;
} {
  const list = purchaseApprovalsProvider();
  const limit = typeof params?.limit === 'number' && params.limit > 0 ? params.limit : 5;
  const sorted = [...list].sort((a, b) => {
    const da = new Date(a.requestDate).getTime() || 0;
    const db = new Date(b.requestDate).getTime() || 0;
    return db - da;
  });

  const sliced = sorted.slice(0, limit);
  return {
    count: sliced.length,
    purchases: sliced.map((p) => ({
      id: p.id,
      title: p.title,
      totalAmount: p.totalAmount,
      state: p.state,
      paymentStatus: p.paymentStatus,
      requestDate: p.requestDate,
      sandboxTransactionId: p.sandboxTransactionId,
    })),
  };
}

// ---------------------------------------------------------------------------
// 9. Financial Action Boundary Enforcement
// ---------------------------------------------------------------------------

export const UNAUTHORIZED_ACTIONS = [
  'approvePurchase',
  'bypassSpendingLimit',
  'bypassMandate',
  'sendInvoice',
  'sendInvoiceWithoutApproval',
  'capturePayment',
  'markInvoicePaid',
  'modifyPaymentStatus',
  'transferFunds',
] as const;

export type UnauthorizedAction = typeof UNAUTHORIZED_ACTIONS[number];

export function checkActionAuthorization(actionName: string): {
  authorized: boolean;
  error?: string;
  code?: 'UNAUTHORIZED_FINANCIAL_ACTION';
} {
  const normalized = actionName.toLowerCase().replace(/[^a-z]/g, '');

  const isUnauthorized = UNAUTHORIZED_ACTIONS.some((unauth) =>
    normalized.includes(unauth.toLowerCase().replace(/[^a-z]/g, ''))
  );

  if (isUnauthorized) {
    return {
      authorized: false,
      code: 'UNAUTHORIZED_FINANCIAL_ACTION',
      error: `Security Violation: Action '${actionName}' is strictly prohibited. AI models cannot approve purchases, bypass mandates, send invoices, or capture payments. All financial decisions require explicit human authorization in the PayPilot interface.`,
    };
  }

  return { authorized: true };
}
