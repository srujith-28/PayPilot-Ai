import test from 'node:test';
import assert from 'node:assert/strict';
import {
  searchCatalog,
  getSpendingMandate,
  evaluateCartPolicy,
  getInvoices,
  prepareInvoiceDraft,
  simulateExpenseImpact,
  checkActionAuthorization,
} from './tools.ts';
import {
  generateDeterministicResponse,
  processAssistantRequest,
  executeToolByName,
} from './gemini.ts';

// ---------------------------------------------------------------------------
// 1. Prohibited Shopping Categories & Mandate Tests
// ---------------------------------------------------------------------------

test('Spending Policy: blocks items from restricted categories', () => {
  const mandate = getSpendingMandate();
  assert.ok(mandate.restrictedCategories.includes('Luxury Goods'));

  const evaluation = evaluateCartPolicy({
    items: [
      {
        name: 'Designer Italian Leather Briefcase',
        price: 180,
        quantity: 1,
        category: 'Luxury Goods',
      },
    ],
  });

  assert.equal(evaluation.status, 'BLOCKED');
  assert.ok(
    evaluation.rules.some(
      (r) => r.ruleId === 'RULE_ALLOWED_CATEGORIES' && !r.passed
    )
  );
});

test('Catalog Search: properly filters by category and maxPrice', () => {
  const allResults = searchCatalog({});
  assert.ok(allResults.count > 0);

  const filtered = searchCatalog({
    category: 'Hardware',
    maxPrice: 200,
  });

  for (const product of filtered.products) {
    assert.ok(product.price <= 200);
    assert.ok(product.category.toLowerCase().includes('hardware'));
  }
});

// ---------------------------------------------------------------------------
// 2. Missing Invoice Fields Validation Tests
// ---------------------------------------------------------------------------

test('Invoice Drafting: throws helpful error when clientName is missing', () => {
  assert.throws(
    () => {
      prepareInvoiceDraft({
        clientName: '',
        description: 'Brand identity sprint',
      });
    },
    {
      message: /Missing clientName/,
    }
  );
});

test('Invoice Drafting: throws helpful error when description is missing', () => {
  assert.throws(
    () => {
      prepareInvoiceDraft({
        clientName: 'Acme Corp',
        description: '   ',
      });
    },
    {
      message: /Missing description/,
    }
  );
});

test('Invoice Drafting: prepares draft in DRAFT status with deterministic totals', () => {
  const result = prepareInvoiceDraft({
    clientName: 'Lumina Media Studio',
    description: 'Video Production Phase 1',
    lineItems: [
      { description: 'Storyboarding', quantity: 10, unitPrice: 150 },
      { description: 'Sound Design', quantity: 5, unitPrice: 120 },
    ],
    paymentTermsDays: 30,
  });

  assert.equal(result.requiresUserReview, true);
  assert.equal(result.draft.status, 'draft');
  assert.equal(result.draft.subtotal, 2100);
  assert.equal(result.draft.total, 2100);
  assert.equal(result.draft.paymentTerms, 'Net 30');
});

// ---------------------------------------------------------------------------
// 3. Unauthorized Actions Boundary Tests
// ---------------------------------------------------------------------------

test('Financial Action Boundary: rejects attempt to approve purchase via AI', () => {
  const check = checkActionAuthorization('approvePurchase');
  assert.equal(check.authorized, false);
  assert.equal(check.code, 'UNAUTHORIZED_FINANCIAL_ACTION');
  assert.match(check.error!, /strictly prohibited/);
});

test('Financial Action Boundary: rejects attempt to bypass spending limit', () => {
  const check = checkActionAuthorization('bypassSpendingLimit');
  assert.equal(check.authorized, false);
  assert.equal(check.code, 'UNAUTHORIZED_FINANCIAL_ACTION');
});

test('Financial Action Boundary: rejects attempt to capture live payment', () => {
  const check = checkActionAuthorization('capturePayment');
  assert.equal(check.authorized, false);
});

test('Financial Action Boundary: rejects attempt to mark invoice paid', () => {
  const check = checkActionAuthorization('markInvoicePaid');
  assert.equal(check.authorized, false);
});

test('Tool Execution: executing unauthorized action via executeToolByName is blocked', () => {
  const result = executeToolByName('approvePurchase', {});
  assert.equal(result.isUnauthorized, true);
  assert.equal(result.result, null);
  assert.match(result.error!, /strictly prohibited/);
});

// ---------------------------------------------------------------------------
// 4. Malformed Requests & Model Fallback Tests
// ---------------------------------------------------------------------------

test('Assistant Orchestration: handles empty request message with validation error', async () => {
  const response = await processAssistantRequest({ message: '   ' });
  assert.equal(response.success, false);
  assert.equal(response.error, 'Empty request message');
});

test('Assistant Orchestration: blocks unauthorized intent in user prompt', async () => {
  const response = await processAssistantRequest({
    message: 'Please bypass spending limit and approve purchase immediately',
  });
  assert.equal(response.success, false);
  assert.equal(response.error, 'UNAUTHORIZED_FINANCIAL_ACTION');
  assert.match(response.reply, /Security Violation/);
});

test('Deterministic Fallback: handles overdue invoices question correctly', () => {
  const response = generateDeterministicResponse({
    message: 'Which invoices are currently overdue?',
  });
  assert.equal(response.success, true);
  assert.ok(response.reply.includes('overdue invoice'));
  assert.ok(response.suggestedActions && response.suggestedActions.length > 0);
  assert.ok(response.toolCallsExecuted?.includes('getInvoices'));
});

test('Deterministic Fallback: handles affordability simulation accurately', () => {
  const response = generateDeterministicResponse({
    message: 'Can I afford an $80 office supply purchase this week?',
  });
  assert.equal(response.success, true);
  assert.ok(response.reply.includes('Available Demo Cash'));
  assert.ok(response.reply.includes('Safe to proceed'));
  assert.ok(response.toolCallsExecuted?.includes('simulateExpenseImpact'));
});

test('Deterministic Fallback: handles outstanding invoices query accurately', () => {
  const response = generateDeterministicResponse({
    message: 'How much money is tied up in outstanding invoices?',
  });
  assert.equal(response.success, true);
  assert.ok(response.reply.includes('tied up across'));
  assert.ok(response.reply.includes('$9,000.00'));
  assert.ok(response.toolCallsExecuted?.includes('getInvoices'));
});

test('Deterministic Fallback: handles 12-week cash position query accurately', () => {
  const response = generateDeterministicResponse({
    message: 'What is my projected cash position in 12 weeks?',
  });
  assert.equal(response.success, true);
  assert.ok(response.reply.includes('Projected Ending Cash (Week 12)'));
  assert.ok(response.reply.includes('trajectory remains solvent'));
  assert.ok(response.toolCallsExecuted?.includes('getCashflowForecast'));
});

test('Deterministic Fallback: handles recent purchases query accurately', () => {
  const response = generateDeterministicResponse({
    message: 'Show my recent purchases.',
  });
  assert.equal(response.success, true);
  assert.ok(response.reply.includes('recent purchase approvals'));
  assert.ok(response.toolCallsExecuted?.includes('getRecentPurchases'));
});

test('Deterministic Fallback: handles blocked purchase explanation query accurately', () => {
  const response = generateDeterministicResponse({
    message: 'Why was this purchase blocked?',
  });
  assert.equal(response.success, true);
  assert.ok(response.reply.includes('Single-Item Ceiling'));
  assert.ok(response.reply.includes('Monthly Budget'));
  assert.ok(response.reply.includes('Allowed Categories'));
  assert.ok(response.toolCallsExecuted?.includes('getSpendingMandate'));
});

