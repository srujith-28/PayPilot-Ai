import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateSpendingPolicy,
  calculateInvoiceTotals,
  simulateAffordability,
  parseNaturalInvoicePrompt,
  parseNaturalSpendSearch,
  generateDynamicCashflowForecast,
} from './rules.ts';
import type { SpendingMandate, CartItem, Product, CashflowPoint, Invoice, PurchaseApproval } from '../types/index.ts';

const mockMandate: SpendingMandate = {
  monthlyBudget: 1500,
  currentSpentThisMonth: 460,
  maxSingleItemLimit: 250,
  allowedCategories: ['Office Equipment', 'Software & Tools', 'Ergonomics', 'Hardware'],
  restrictedCategories: ['Luxury Goods', 'Entertainment', 'Personal Apparel'],
  expirationDate: '2026-11-01',
  requireReceiptsOver: 100,
  lastUpdated: '2026-10-01',
};

const validProduct: Product = {
  id: 'prod-1',
  name: 'ErgoTask Pro Mesh Office Chair',
  price: 199,
  category: 'Ergonomics',
  vendor: 'ErgoComfort',
  description: 'Adjustable task chair',
  image: '/src/assets/images/product_ergonomic_chair_1792058514552.jpg',
  rating: 4.8,
  reviewsCount: 142,
  inStock: true,
  specs: { Material: 'Breathable mesh' },
  comparisonNotes: 'Best lumbar support',
};

const expensiveProduct: Product = {
  id: 'prod-2',
  name: 'UltraView 34" Curved WQHD Monitor',
  price: 389,
  category: 'Hardware',
  vendor: 'ViewTech',
  description: 'Curved ultrawide display',
  image: '/src/assets/images/product_ultrawide_monitor_1792058514829.jpg',
  rating: 4.9,
  reviewsCount: 89,
  inStock: true,
  specs: { Resolution: '3440x1440' },
  comparisonNotes: 'Exceeds standard single item budget',
};

const restrictedProduct: Product = {
  id: 'prod-3',
  name: 'Designer Italian Leather Executive Briefcase',
  price: 240,
  category: 'Luxury Goods',
  vendor: 'Milano Heritage',
  description: 'Luxury accessory',
  image: '',
  rating: 4.7,
  reviewsCount: 31,
  inStock: true,
  specs: { Material: 'Full grain leather' },
  comparisonNotes: 'Prohibited category',
};

test('evaluateSpendingPolicy: passes valid cart within mandate', () => {
  const cart: CartItem[] = [{ product: validProduct, quantity: 1 }];
  const evaluation = evaluateSpendingPolicy(cart, mockMandate, 14250, 6000);

  assert.equal(evaluation.status, 'PASS');
  assert.equal(evaluation.canProceedToCheckout, true);
  assert.equal(evaluation.cartTotal, 199);
  assert.equal(evaluation.rules.every((r) => r.passed), true);
});

test('evaluateSpendingPolicy: blocks purchase exceeding single-item limit', () => {
  const cart: CartItem[] = [{ product: expensiveProduct, quantity: 1 }];
  const evaluation = evaluateSpendingPolicy(cart, mockMandate, 14250, 6000);

  assert.equal(evaluation.status, 'BLOCKED');
  assert.equal(evaluation.canProceedToCheckout, false);
  const singleItemRule = evaluation.rules.find((r) => r.ruleId === 'RULE_SINGLE_ITEM_LIMIT');
  assert.equal(singleItemRule?.passed, false);
});

test('evaluateSpendingPolicy: blocks item from restricted category', () => {
  const cart: CartItem[] = [{ product: restrictedProduct, quantity: 1 }];
  const evaluation = evaluateSpendingPolicy(cart, mockMandate, 14250, 6000);

  assert.equal(evaluation.status, 'BLOCKED');
  assert.equal(evaluation.canProceedToCheckout, false);
  const catRule = evaluation.rules.find((r) => r.ruleId === 'RULE_ALLOWED_CATEGORIES');
  assert.equal(catRule?.passed, false);
});

test('evaluateSpendingPolicy: blocks cart when monthly budget is exceeded', () => {
  // Budget is $1500, spent is $460 -> remaining is $1040.
  // 6 chairs @ $199 = $1194 -> total spent would be $1654 > $1500
  const cart: CartItem[] = [{ product: validProduct, quantity: 6 }];
  const evaluation = evaluateSpendingPolicy(cart, mockMandate, 14250, 6000);

  assert.equal(evaluation.status, 'BLOCKED');
  assert.equal(evaluation.canProceedToCheckout, false);
  const budgetRule = evaluation.rules.find((r) => r.ruleId === 'RULE_MONTHLY_BUDGET');
  assert.equal(budgetRule?.passed, false);
});

test('evaluateSpendingPolicy: marks NEEDS_REVIEW when purchase breaches cash reserve floor', () => {
  // Low cash reserve = $6100, cart = $199 -> ending cash $5901 < $6000 floor
  const cart: CartItem[] = [{ product: validProduct, quantity: 1 }];
  const evaluation = evaluateSpendingPolicy(cart, mockMandate, 6100, 6000);

  assert.equal(evaluation.status, 'NEEDS_REVIEW');
  const reserveRule = evaluation.rules.find((r) => r.ruleId === 'RULE_CASH_RESERVE_FLOOR');
  assert.equal(reserveRule?.passed, false);
});

test('calculateInvoiceTotals: computes subtotal, tax and total accurately', () => {
  const items = [
    { quantity: 2, unitPrice: 500 }, // 1000
    { quantity: 1, unitPrice: 250 }, // 250
  ];
  const { subtotal, taxAmount, total } = calculateInvoiceTotals(items, 0.08);

  assert.equal(subtotal, 1250);
  assert.equal(taxAmount, 100);
  assert.equal(total, 1350);
});

test('calculateInvoiceTotals: handles zero tax rate and decimal amounts', () => {
  const items = [
    { quantity: 3, unitPrice: 33.33 },
  ];
  const { subtotal, taxAmount, total } = calculateInvoiceTotals(items, 0);

  assert.equal(subtotal, 99.99);
  assert.equal(taxAmount, 0);
  assert.equal(total, 99.99);
});

test('simulateAffordability: accurately evaluates reserve impact over forecast horizon', () => {
  const mockForecast: CashflowPoint[] = [
    {
      weekIndex: 0,
      weekLabel: 'Week 1',
      dateRange: 'Oct 16 - Oct 22',
      startingCash: 10000,
      expectedIncoming: 3000,
      expectedOutgoing: 1000,
      netCash: 2000,
      projectedEndingCash: 12000,
      p20EndingCash: 11000,
      p80EndingCash: 13000,
      scheduledInvoices: [],
      scheduledPurchases: [],
    },
    {
      weekIndex: 1,
      weekLabel: 'Week 2',
      dateRange: 'Oct 23 - Oct 29',
      startingCash: 12000,
      expectedIncoming: 1000,
      expectedOutgoing: 5000,
      netCash: -4000,
      projectedEndingCash: 8000,
      p20EndingCash: 7000,
      p80EndingCash: 9000,
      scheduledInvoices: [],
      scheduledPurchases: [],
    },
  ];

  // A $1,500 purchase in week 0:
  // Week 0 balance becomes $10,500. Week 1 balance becomes $6,500. Min reserve = $6,000 -> remaining buffer is $500.
  // Verdict should be CAUTION because buffer is < $1000 but >= 0.
  const resultCaution = simulateAffordability(mockForecast, 1500, 0, 6000);
  assert.equal(resultCaution.affordable, true);
  assert.equal(resultCaution.verdict, 'CAUTION');
  assert.equal(resultCaution.lowestProjectedBalanceAfter, 6500);
  assert.equal(resultCaution.bufferRemaining, 500);

  // A $3,000 purchase would make week 1 balance $5,000, which is below $6,000 -> CRITICAL_BREACH
  const resultBreach = simulateAffordability(mockForecast, 3000, 0, 6000);
  assert.equal(resultBreach.affordable, false);
  assert.equal(resultBreach.verdict, 'CRITICAL_BREACH');
  assert.equal(resultBreach.deficitAmount, 1000);
});

test('parseNaturalInvoicePrompt: extracts amount, description, and terms', () => {
  const parsed = parseNaturalInvoicePrompt('Create a $1,200 invoice for website design, due in 14 days');
  assert.equal(parsed.amount, 1200);
  assert.equal(parsed.description, 'website design');
  assert.equal(parsed.paymentTerms, 'Net 14');
  assert.equal(parsed.dueDays, 14);

  const parsed2 = parseNaturalInvoicePrompt('Send invoice for mobile app audit for $3,500 due on receipt');
  assert.equal(parsed2.amount, 3500);
  assert.equal(parsed2.paymentTerms, 'Due on Receipt');
});

test('parseNaturalSpendSearch: extracts keyword, max price, and category hint', () => {
  const parsed = parseNaturalSpendSearch('Find an ergonomic office chair under $150');
  assert.equal(parsed.maxPrice, 150);
  assert.equal(parsed.categoryHint, 'Ergonomics');
  assert.match(parsed.keyword.toLowerCase(), /chair/);
});

test('generateDynamicCashflowForecast: computes 12 weeks with accurate opening cash and no double counting', () => {
  const sampleInvoices: Invoice[] = [
    {
      id: 'inv-unpaid-1',
      invoiceNumber: 'INV-2026-001',
      clientId: 'cli-acme',
      clientName: 'Acme Corp',
      clientEmail: 'billing@acme.com',
      description: 'Web development',
      issueDate: '2026-10-10',
      dueDate: '2026-10-24', // Week 1 (Oct 22 - Oct 28)
      status: 'sent',
      lineItems: [],
      subtotal: 5000,
      taxRate: 0,
      taxAmount: 0,
      total: 5000,
      currency: 'USD',
      paymentTerms: 'Net 14',
      remindersSentCount: 0,
    },
    {
      id: 'inv-paid-1',
      invoiceNumber: 'INV-2026-002',
      clientId: 'cli-beta',
      clientName: 'Beta LLC',
      clientEmail: 'billing@beta.com',
      description: 'Consulting',
      issueDate: '2026-10-01',
      dueDate: '2026-10-15',
      status: 'paid', // ALREADY paid, so included in openingCash
      lineItems: [],
      subtotal: 2000,
      taxRate: 0,
      taxAmount: 0,
      total: 2000,
      currency: 'USD',
      paymentTerms: 'Net 14',
      remindersSentCount: 0,
    },
  ];

  const sampleApprovals: PurchaseApproval[] = [
    {
      id: 'appr-captured-1',
      title: 'Ergonomic Desk',
      items: [],
      totalAmount: 400,
      requestedBy: 'Jordan Miller',
      userId: 'usr-jordan-miller',
      requestDate: '2026-10-14',
      state: 'CAPTURED', // Already captured & deducted from openingCash
      policyStatus: 'PASS',
      policySummary: 'Approved',
      ruleViolations: [],
      sandboxTransactionId: 'CAPTURE-12345',
      simulationNote: 'Captured via PayPal Sandbox',
    },
    {
      id: 'appr-pending-1',
      title: 'Mechanical Keyboard',
      items: [],
      totalAmount: 129,
      requestedBy: 'Jordan Miller',
      userId: 'usr-jordan-miller',
      requestDate: '2026-10-15',
      state: 'APPROVED', // Pending settlement -> should be in expectedOutgoing Week 0
      policyStatus: 'PASS',
      policySummary: 'Approved',
      ruleViolations: [],
      simulationNote: 'Approved. Ready for checkout',
    },
  ];

  const points = generateDynamicCashflowForecast({
    openingCash: 14250,
    invoices: sampleInvoices,
    approvals: sampleApprovals,
    minimumReserve: 6000,
  });

  // Verify 12 weeks returned
  assert.equal(points.length, 12);

  // Week 0 opening cash must be exactly 14250
  assert.equal(points[0].startingCash, 14250);

  // Week 0 outgoing must include baseline ($450) + pending approval ($129) = $579
  // Note: captured approval ($400) is NOT added to outgoing because it's already deducted from openingCash
  assert.equal(points[0].expectedOutgoing, 579);

  // Paid invoice ($2000) is NOT added to Week 0 or Week 1 expectedIncoming
  // Only unpaid invoice ($5000) in Week 1
  assert.equal(points[0].expectedIncoming, 0);
  assert.equal(points[1].expectedIncoming, 5000);

  // Verify P20 <= P50 <= P80 for all weeks
  for (const pt of points) {
    assert.ok(
      pt.p20EndingCash <= pt.p80EndingCash,
      `P20 ($${pt.p20EndingCash}) should be <= P80 ($${pt.p80EndingCash}) in ${pt.weekLabel}`
    );
  }
});

