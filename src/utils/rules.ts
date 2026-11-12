import type {
  CartItem,
  SpendingMandate,
  PolicyEvaluation,
  PolicyRuleResult,
  InvoiceLineItem,
  CashflowPoint,
  AffordabilityResult,
  Invoice,
  PurchaseApproval,
} from '../types/index.ts';

/**
 * Pure policy evaluation engine.
 * Deterministic rules that evaluate a shopping cart against the user's spending mandate
 * and configured cash reserve. AI never bypasses these rules.
 */
export function evaluateSpendingPolicy(
  cartItems: CartItem[],
  mandate: SpendingMandate,
  currentCashReserve: number = 14250,
  minReserveThreshold: number = 6000
): PolicyEvaluation {
  const timestamp = new Date().toISOString();

  if (!cartItems || cartItems.length === 0) {
    return {
      status: 'PASS',
      summary: 'Cart is empty. No policy rules evaluated.',
      cartTotal: 0,
      itemCount: 0,
      rules: [],
      canProceedToCheckout: false,
      timestamp,
    };
  }

  const cartTotal = cartItems.reduce(
    (sum, item) => sum + Math.round(item.product.price * item.quantity * 100) / 100,
    0
  );
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const rules: PolicyRuleResult[] = [];

  // Rule 1: Category Check
  const disallowedItems = cartItems.filter((item) => {
    const cat = item.product.category;
    const isRestricted = mandate.restrictedCategories.some(
      (rc) => rc.toLowerCase() === cat.toLowerCase()
    );
    const isAllowed = mandate.allowedCategories.some(
      (ac) => ac.toLowerCase() === cat.toLowerCase()
    );
    return isRestricted || !isAllowed;
  });

  if (disallowedItems.length > 0) {
    const itemNames = disallowedItems.map((i) => `"${i.product.name}" (${i.product.category})`).join(', ');
    rules.push({
      ruleId: 'RULE_ALLOWED_CATEGORIES',
      name: 'Approved Category Check',
      passed: false,
      severity: 'BLOCKING',
      message: `Items not in approved categories: ${itemNames}. Mandate allows: ${mandate.allowedCategories.join(', ')}.`,
      details: 'Restricted or non-compliant category purchases cannot proceed without an updated mandate.',
    });
  } else {
    rules.push({
      ruleId: 'RULE_ALLOWED_CATEGORIES',
      name: 'Approved Category Check',
      passed: true,
      severity: 'INFO',
      message: 'All items belong to authorized business spending categories.',
    });
  }

  // Rule 2: Single-Item Limit Check
  const expensiveItems = cartItems.filter(
    (item) => item.product.price > mandate.maxSingleItemLimit
  );

  if (expensiveItems.length > 0) {
    const expensiveNames = expensiveItems
      .map((i) => `"${i.product.name}" ($${i.product.price.toFixed(2)})`)
      .join(', ');
    rules.push({
      ruleId: 'RULE_SINGLE_ITEM_LIMIT',
      name: 'Single-Item Price Threshold',
      passed: false,
      severity: 'BLOCKING',
      message: `Item exceeds maximum single-item limit of $${mandate.maxSingleItemLimit.toFixed(2)}: ${expensiveNames}.`,
      details: `Your mandate restricts any individual unit price to $${mandate.maxSingleItemLimit.toFixed(2)}.`,
    });
  } else {
    rules.push({
      ruleId: 'RULE_SINGLE_ITEM_LIMIT',
      name: 'Single-Item Price Threshold',
      passed: true,
      severity: 'INFO',
      message: `All items are within the $${mandate.maxSingleItemLimit.toFixed(2)} unit price ceiling.`,
    });
  }

  // Rule 3: Monthly Budget Check
  const projectedMonthlyTotal = Math.round((mandate.currentSpentThisMonth + cartTotal) * 100) / 100;
  const budgetRemainingBefore = Math.max(0, mandate.monthlyBudget - mandate.currentSpentThisMonth);

  if (projectedMonthlyTotal > mandate.monthlyBudget) {
    const overAmount = (projectedMonthlyTotal - mandate.monthlyBudget).toFixed(2);
    rules.push({
      ruleId: 'RULE_MONTHLY_BUDGET',
      name: 'Monthly Mandate Budget',
      passed: false,
      severity: 'BLOCKING',
      message: `Cart total of $${cartTotal.toFixed(2)} exceeds remaining monthly budget of $${budgetRemainingBefore.toFixed(2)} by $${overAmount}.`,
      details: `Configured monthly cap: $${mandate.monthlyBudget.toFixed(2)}. Already spent this month: $${mandate.currentSpentThisMonth.toFixed(2)}.`,
    });
  } else {
    const budgetRemainingAfter = (mandate.monthlyBudget - projectedMonthlyTotal).toFixed(2);
    rules.push({
      ruleId: 'RULE_MONTHLY_BUDGET',
      name: 'Monthly Mandate Budget',
      passed: true,
      severity: 'INFO',
      message: `Compliant with monthly budget. Remaining after purchase: $${budgetRemainingAfter}.`,
    });
  }

  // Rule 4: Cash Reserve Impact
  const projectedCashAfter = currentCashReserve - cartTotal;
  if (projectedCashAfter < minReserveThreshold) {
    const reserveDeficit = (minReserveThreshold - projectedCashAfter).toFixed(2);
    rules.push({
      ruleId: 'RULE_CASH_RESERVE_FLOOR',
      name: 'Minimum Cash Reserve Floor',
      passed: false,
      severity: 'WARNING',
      message: `Purchase would drop demo cash reserve to $${projectedCashAfter.toFixed(2)}, breaching your $${minReserveThreshold.toFixed(2)} threshold by $${reserveDeficit}.`,
      details: 'Requires manual managerial confirmation to approve deficit against reserve floor.',
    });
  } else {
    rules.push({
      ruleId: 'RULE_CASH_RESERVE_FLOOR',
      name: 'Minimum Cash Reserve Floor',
      passed: true,
      severity: 'INFO',
      message: `Safe cash buffer maintained. Demo cash remains $${projectedCashAfter.toFixed(2)} (above $${minReserveThreshold.toFixed(2)} floor).`,
    });
  }

  // Determine overall status
  const hasBlocking = rules.some((r) => !r.passed && r.severity === 'BLOCKING');
  const hasWarning = rules.some((r) => !r.passed && r.severity === 'WARNING');

  let status: PolicyEvaluation['status'] = 'PASS';
  let summary = 'Cart complies fully with spending mandate and cash reserve rules.';
  let canProceedToCheckout = true;

  if (hasBlocking) {
    status = 'BLOCKED';
    const blockingCount = rules.filter((r) => !r.passed && r.severity === 'BLOCKING').length;
    summary = `Purchase BLOCKED by ${blockingCount} mandatory spending policy rule${blockingCount > 1 ? 's' : ''}. Checkout disabled.`;
    canProceedToCheckout = false;
  } else if (hasWarning) {
    status = 'NEEDS_REVIEW';
    summary = 'Purchase requires managerial review due to minimum cash reserve advisory.';
    canProceedToCheckout = true; // Allowed to request approval/review, but flagged
  }

  return {
    status,
    summary,
    cartTotal,
    itemCount,
    rules,
    canProceedToCheckout,
    timestamp,
  };
}

/**
 * Pure calculation of invoice line items and totals.
 */
export function calculateInvoiceTotals(
  items: { quantity: number; unitPrice: number }[],
  taxRate: number = 0.08
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = items.reduce((sum, item) => {
    const qty = Math.max(0, item.quantity || 0);
    const price = Math.max(0, item.unitPrice || 0);
    return sum + Math.round(qty * price * 100) / 100;
  }, 0);

  const normalizedTaxRate = Math.max(0, taxRate || 0);
  const taxAmount = Math.round(subtotal * normalizedTaxRate * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount,
    total,
  };
}

/**
 * Pure calculation of cashflow affordability for planned purchases.
 */
export function simulateAffordability(
  forecast: CashflowPoint[],
  purchaseAmount: number,
  targetWeekIndex: number = 0,
  minimumReserve: number = 6000
): AffordabilityResult {
  if (!forecast || forecast.length === 0) {
    return {
      affordable: false,
      purchaseAmount,
      targetWeekIndex,
      targetWeekLabel: 'Unknown',
      projectedBalanceBefore: 0,
      projectedBalanceAfter: -purchaseAmount,
      minimumReserve,
      bufferRemaining: -minimumReserve - purchaseAmount,
      deficitAmount: purchaseAmount,
      lowestProjectedWeekLabel: 'Unknown',
      lowestProjectedBalanceAfter: -purchaseAmount,
      verdict: 'CRITICAL_BREACH',
      recommendation: 'No forecast data available to evaluate affordability.',
    };
  }

  const validTargetIndex = Math.min(Math.max(0, targetWeekIndex), forecast.length - 1);
  const targetPoint = forecast[validTargetIndex];

  const projectedBalanceBefore = targetPoint.projectedEndingCash;
  const projectedBalanceAfter = Math.round((projectedBalanceBefore - purchaseAmount) * 100) / 100;

  // Track projected balances across all subsequent weeks if this purchase is deducted
  let lowestBalanceAfter = projectedBalanceAfter;
  let lowestWeek = targetPoint.weekLabel;

  for (let i = validTargetIndex; i < forecast.length; i++) {
    const adjustedWeekEnding = Math.round((forecast[i].projectedEndingCash - purchaseAmount) * 100) / 100;
    if (adjustedWeekEnding < lowestBalanceAfter) {
      lowestBalanceAfter = adjustedWeekEnding;
      lowestWeek = forecast[i].weekLabel;
    }
  }

  const bufferRemaining = Math.round((lowestBalanceAfter - minimumReserve) * 100) / 100;
  const deficitAmount = bufferRemaining < 0 ? Math.abs(bufferRemaining) : 0;

  let verdict: AffordabilityResult['verdict'] = 'SAFE';
  let affordable = true;
  let recommendation = '';

  if (bufferRemaining < 0) {
    verdict = 'CRITICAL_BREACH';
    affordable = false;
    recommendation = `This $${purchaseAmount.toFixed(2)} purchase will breach your $${minimumReserve.toFixed(2)} reserve floor in ${lowestWeek} by $${deficitAmount.toFixed(2)}. Postpone until pending invoices are collected.`;
  } else if (bufferRemaining < 1000) {
    verdict = 'CAUTION';
    affordable = true;
    recommendation = `Affordable, but leaves only a slim buffer of $${bufferRemaining.toFixed(2)} above your $${minimumReserve.toFixed(2)} reserve in ${lowestWeek}. Monitor invoice collections closely.`;
  } else {
    verdict = 'SAFE';
    affordable = true;
    recommendation = `Safe to execute. Your cash reserves remain comfortably protected with a $${bufferRemaining.toFixed(2)} buffer above the $${minimumReserve.toFixed(2)} floor.`;
  }

  return {
    affordable,
    purchaseAmount,
    targetWeekIndex: validTargetIndex,
    targetWeekLabel: targetPoint.weekLabel,
    projectedBalanceBefore,
    projectedBalanceAfter,
    minimumReserve,
    bufferRemaining,
    deficitAmount,
    lowestProjectedWeekLabel: lowestWeek,
    lowestProjectedBalanceAfter: lowestBalanceAfter,
    verdict,
    recommendation,
  };
}

/**
 * Natural language helper to parse an invoice prompt like:
 * "Create a $1,200 invoice for website design, due in 14 days"
 */
export function parseNaturalInvoicePrompt(input: string): {
  amount?: number;
  description?: string;
  paymentTerms?: 'Due on Receipt' | 'Net 14' | 'Net 30' | 'Net 60';
  dueDays?: number;
} {
  const result: ReturnType<typeof parseNaturalInvoicePrompt> = {};

  if (!input) return result;

  // Extract amount ($1,200 or 1200 or 1,200.50)
  const amountMatch = input.match(/\$?\s*([\d,]+(?:\.\d{1,2})?)/);
  if (amountMatch && amountMatch[1]) {
    const cleanNum = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (!isNaN(cleanNum) && cleanNum > 0) {
      result.amount = cleanNum;
    }
  }

  // Extract terms / due in X days
  const dueDaysMatch = input.match(/due\s+(?:in\s+)?(\d+)\s*days?/i);
  if (dueDaysMatch && dueDaysMatch[1]) {
    const days = parseInt(dueDaysMatch[1], 10);
    result.dueDays = days;
    if (days <= 1) result.paymentTerms = 'Due on Receipt';
    else if (days <= 14) result.paymentTerms = 'Net 14';
    else if (days <= 30) result.paymentTerms = 'Net 30';
    else result.paymentTerms = 'Net 60';
  } else if (/net\s*30/i.test(input)) {
    result.paymentTerms = 'Net 30';
    result.dueDays = 30;
  } else if (/net\s*14/i.test(input)) {
    result.paymentTerms = 'Net 14';
    result.dueDays = 14;
  } else if (/due\s+on\s+receipt/i.test(input)) {
    result.paymentTerms = 'Due on Receipt';
    result.dueDays = 0;
  }

  // Extract description ("for [description], due...")
  const forMatch = input.match(/for\s+([^,.;]+?)(?:,\s*due|\s+due|\s*$)/i);
  if (forMatch && forMatch[1]) {
    result.description = forMatch[1].trim();
  }

  return result;
}

/**
 * Natural language helper for spend search query parsing.
 * e.g. "Find an ergonomic office chair under $150"
 */
export function parseNaturalSpendSearch(input: string): {
  keyword: string;
  maxPrice?: number;
  categoryHint?: string;
} {
  if (!input) return { keyword: '' };

  let keyword = input;
  let maxPrice: number | undefined;

  // Detect price constraint (under $150, max $200, below 250)
  const priceMatch = input.match(/(?:under|below|less than|max(?:imum)?)\s*\$?(\d+(?:\.\d{1,2})?)/i);
  if (priceMatch && priceMatch[1]) {
    maxPrice = parseFloat(priceMatch[1]);
    keyword = keyword.replace(priceMatch[0], '').trim();
  }

  // Remove common filler words
  keyword = keyword
    .replace(/^(?:find|search for|look for|show me|get|buy)\s+/i, '')
    .trim();

  // Detect category hints
  let categoryHint: string | undefined;
  if (/chair|desk|stand|ergonomic/i.test(input)) {
    categoryHint = 'Ergonomics';
  } else if (/keyboard|mouse|monitor|hub|cable|hardware/i.test(input)) {
    categoryHint = 'Hardware';
  } else if (/paper|pen|notebook|supplies|office/i.test(input)) {
    categoryHint = 'Office Equipment';
  }

  return {
    keyword,
    maxPrice,
    categoryHint,
  };
}

/**
 * Baseline 12-week operational expense schedule.
 * Predictable recurring costs for a design consultancy studio.
 */
export const BASELINE_SCHEDULED_PURCHASES: Record<number, Array<{ id: string; name: string; amount: number }>> = {
  0: [{ id: 'sp-1', name: 'Software Subscriptions (Figma/Adobe/GSuite)', amount: 450 }],
  1: [
    { id: 'sp-2', name: 'Quarterly Cloud Hosting & CDN', amount: 800 },
    { id: 'sp-3', name: 'Studio Office Rent Share', amount: 1000 },
  ],
  2: [{ id: 'sp-4', name: 'Accounting & Payroll Processing', amount: 850 }],
  3: [{ id: 'sp-5', name: 'Estimated Tax Reserve Escrow Transfer', amount: 3400 }],
  4: [{ id: 'sp-6', name: 'Contractor QA testing', amount: 920 }],
  5: [{ id: 'sp-7', name: 'Equipment maintenance & insurance', amount: 1200 }],
  6: [{ id: 'sp-8', name: 'Monthly Office Lease & Utilities', amount: 2200 }],
  7: [{ id: 'sp-9', name: 'Subcontractor Design Support', amount: 1400 }],
  8: [{ id: 'sp-10', name: 'SaaS Tooling Annual Renewals', amount: 750 }],
  9: [{ id: 'sp-11', name: 'Year-end legal & corporate filing', amount: 3600 }],
  10: [{ id: 'sp-12', name: 'Cloud Backup & Infrastructure', amount: 800 }],
  11: [{ id: 'sp-13', name: 'New Year Software Licenses', amount: 1100 }],
};

export const BASELINE_FUTURE_INCOMING: Record<number, Array<{ id: string; client: string; amount: number }>> = {
  4: [{ id: 'inv-proj-1', client: 'Acme Technologies (Monthly Retainer)', amount: 4800 }],
  5: [{ id: 'inv-proj-2', client: 'Studio Horizon Design', amount: 2000 }],
  7: [{ id: 'inv-proj-3', client: 'Acme Technologies (Phase 3 milestone)', amount: 6200 }],
  8: [{ id: 'inv-proj-4', client: 'Beacon Health Ventures', amount: 3500 }],
  9: [{ id: 'inv-proj-5', client: 'Lumina Media Studio', amount: 1800 }],
};

export const WEEK_METADATA = [
  { index: 0, label: 'Week 1', dateRange: 'Oct 15 - Oct 21' },
  { index: 1, label: 'Week 2', dateRange: 'Oct 22 - Oct 28' },
  { index: 2, label: 'Week 3', dateRange: 'Oct 29 - Nov 04' },
  { index: 3, label: 'Week 4', dateRange: 'Nov 05 - Nov 11' },
  { index: 4, label: 'Week 5', dateRange: 'Nov 12 - Nov 18' },
  { index: 5, label: 'Week 6', dateRange: 'Nov 19 - Nov 25' },
  { index: 6, label: 'Week 7', dateRange: 'Nov 26 - Dec 02' },
  { index: 7, label: 'Week 8', dateRange: 'Dec 03 - Dec 09' },
  { index: 8, label: 'Week 9', dateRange: 'Dec 10 - Dec 16' },
  { index: 9, label: 'Week 10', dateRange: 'Dec 17 - Dec 23' },
  { index: 10, label: 'Week 11', dateRange: 'Dec 24 - Dec 30' },
  { index: 11, label: 'Week 12', dateRange: 'Dec 31 - Jan 06' },
];

export interface DynamicCashflowParams {
  openingCash: number;
  invoices: Invoice[];
  approvals: PurchaseApproval[];
  minimumReserve?: number;
}

/**
 * Pure dynamic 12-week cashflow generator.
 *
 * Rules:
 * 1. Week 0 opening balance is exactly current demo cash (openingCash).
 * 2. Unpaid invoices (sent/overdue) map to expected incoming cash (never added to opening cash before payment).
 * 3. Paid invoices are ALREADY part of opening cash, so they are excluded from future incoming.
 * 4. Captured purchases are ALREADY deducted from opening cash, so they are excluded from future outgoing.
 * 5. Approved/unsettled purchases are scheduled as pending outgoing in Week 0.
 * 6. Computes P50 (deterministic net), P20 (conservative: 70% collections, 108% expenses), and P80 (105% collections, 95% expenses).
 */
export function generateDynamicCashflowForecast(params: DynamicCashflowParams): CashflowPoint[] {
  const { openingCash, invoices, approvals } = params;

  // 1. Group active unpaid invoices by target week
  const incomingByWeek: Record<number, Array<{ id: string; client: string; amount: number }>> = {};
  for (let w = 0; w < 12; w++) {
    incomingByWeek[w] = [];
    if (BASELINE_FUTURE_INCOMING[w]) {
      incomingByWeek[w].push(...BASELINE_FUTURE_INCOMING[w]);
    }
  }

  for (const inv of invoices) {
    // Only unpaid active invoices contribute to expected future incoming
    if (inv.status === 'paid' || inv.status === 'cancelled') {
      continue;
    }

    let targetWeek = 1; // Default to Week 2

    if (inv.status === 'overdue') {
      // Overdue invoices are actively pursued for collection in Week 1
      targetWeek = 1;
    } else if (inv.dueDate) {
      const d = inv.dueDate;
      if (d <= '2026-10-21') targetWeek = 0;
      else if (d <= '2026-10-28') targetWeek = 1;
      else if (d <= '2026-11-04') targetWeek = 2;
      else if (d <= '2026-11-11') targetWeek = 3;
      else if (d <= '2026-11-18') targetWeek = 4;
      else if (d <= '2026-11-25') targetWeek = 5;
      else if (d <= '2026-12-02') targetWeek = 6;
      else if (d <= '2026-12-09') targetWeek = 7;
      else if (d <= '2026-12-16') targetWeek = 8;
      else if (d <= '2026-12-23') targetWeek = 9;
      else if (d <= '2026-12-30') targetWeek = 10;
      else targetWeek = 11;
    }

    incomingByWeek[targetWeek].push({
      id: inv.id,
      client: inv.clientCompany || inv.clientName,
      amount: inv.total,
    });
  }

  // 2. Group pending / approved uncaptured purchases into outgoing
  const outgoingByWeek: Record<number, Array<{ id: string; name: string; amount: number }>> = {};
  for (let w = 0; w < 12; w++) {
    outgoingByWeek[w] = [...(BASELINE_SCHEDULED_PURCHASES[w] || [])];
  }

  for (const appr of approvals) {
    // Only approved/pending purchases that are NOT yet captured contribute to future outgoing
    if (appr.state === 'APPROVED' || appr.state === 'AWAITING_APPROVAL') {
      outgoingByWeek[0].push({
        id: appr.id,
        name: appr.title,
        amount: appr.totalAmount,
      });
    }
  }

  // 3. Roll forward 12 weeks of cashflow balances
  const points: CashflowPoint[] = [];
  let currentStarting = Math.round(openingCash * 100) / 100;
  let p20Current = currentStarting;
  let p80Current = currentStarting;

  for (let w = 0; w < 12; w++) {
    const meta = WEEK_METADATA[w];
    const scheduledInvoices = incomingByWeek[w];
    const scheduledPurchases = outgoingByWeek[w];

    const expectedIncoming = Math.round(
      scheduledInvoices.reduce((sum, item) => sum + item.amount, 0) * 100
    ) / 100;

    const expectedOutgoing = Math.round(
      scheduledPurchases.reduce((sum, item) => sum + item.amount, 0) * 100
    ) / 100;

    const netCash = Math.round((expectedIncoming - expectedOutgoing) * 100) / 100;
    const projectedEndingCash = Math.round((currentStarting + netCash) * 100) / 100;

    // Scenarios:
    // P20: 70% collections, 108% outgoings
    p20Current = Math.round(
      (p20Current + expectedIncoming * 0.70 - expectedOutgoing * 1.08) * 100
    ) / 100;

    // P80: 105% collections, 95% outgoings
    p80Current = Math.round(
      (p80Current + expectedIncoming * 1.05 - expectedOutgoing * 0.95) * 100
    ) / 100;

    points.push({
      weekIndex: w,
      weekLabel: meta.label,
      dateRange: meta.dateRange,
      startingCash: currentStarting,
      expectedIncoming,
      expectedOutgoing,
      netCash,
      projectedEndingCash,
      p20EndingCash: p20Current,
      p80EndingCash: p80Current,
      scheduledInvoices,
      scheduledPurchases,
    });

    currentStarting = projectedEndingCash;
  }

  return points;
}

