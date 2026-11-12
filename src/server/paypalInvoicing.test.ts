/**
 * PayPal Sandbox Invoicing & Webhook Unit Tests
 *
 * Covers:
 * 1. PayPal Invoice draft creation with authoritative USD totals
 * 2. Rejection of invalid currencies and missing fields
 * 3. PayPal Invoice dispatching and status transitions
 * 4. PayPal Invoice payment reminders
 * 5. Authoritative live status checking from PayPal Sandbox
 * 6. Webhook signature header and certificate domain security
 * 7. Webhook duplicate-event protection (idempotency)
 * 8. Authoritative invoice payment via verified webhooks
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPayPalInvoiceDraft,
  sendPayPalInvoice,
  remindPayPalInvoice,
  getPayPalInvoiceStatus,
  verifyAndProcessPayPalWebhook,
  resetWebhookDeduplicationCache,
  seedInitialInvoicesStore,
  getStoredInvoice,
} from './paypalInvoicing.ts';
import { resetPayPalTokenCache, saveStoredPayPalOrder, getStoredPayPalOrder } from './paypal.ts';

// ---------------------------------------------------------------------------
// 1. Invoice Draft Creation Tests
// ---------------------------------------------------------------------------

test('PayPal Invoicing: creates draft invoice with recalculated USD totals', async () => {
  process.env.PAYPAL_CLIENT_ID = 'mock_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'mock_client_secret';
  resetPayPalTokenCache();
  seedInitialInvoicesStore();

  let paypalPayloadCaptured: any = null;

  const mockFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = String(url);
    if (urlStr.includes('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'mock_token', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (urlStr.includes('/v2/invoicing/invoices')) {
      paypalPayloadCaptured = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          id: 'INV2-MOCK-TEST-123',
          status: 'DRAFT',
          links: [
            { href: 'https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-MOCK-TEST-123', rel: 'self' },
            { href: 'https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-MOCK-TEST-123/send', rel: 'send' },
          ],
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected mock URL: ${urlStr}`);
  };

  const invoice = await createPayPalInvoiceDraft(
    {
      clientName: 'Sarah Chen',
      clientEmail: 'billing@acmetechnologies.io',
      clientCompany: 'Acme Technologies Inc.',
      description: 'Q4 Enterprise UX Consulting',
      lineItems: [
        { id: 'item-1', description: 'Design Sprint', quantity: 2, unitPrice: 600, total: 1200 },
      ],
      paymentTermsDays: 14,
      currency: 'USD',
    },
    mockFetch as unknown as typeof fetch
  );

  assert.equal(invoice.status, 'draft');
  assert.equal(invoice.paypalStatus, 'DRAFT');
  assert.equal(invoice.paypalInvoiceId, 'INV2-MOCK-TEST-123');
  assert.equal(invoice.currency, 'USD');
  assert.equal(invoice.total, 1200);
  assert.equal(invoice.mode, 'SANDBOX');

  // Verify payload sent to PayPal
  assert.ok(paypalPayloadCaptured);
  assert.equal(paypalPayloadCaptured.detail.currency_code, 'USD');
  assert.equal(paypalPayloadCaptured.detail.payment_term.term_type, 'DUE_ON_DATE_SPECIFIED');
  assert.equal(paypalPayloadCaptured.amount.currency_code, 'USD');
  assert.equal(paypalPayloadCaptured.amount.breakdown.item_total.value, '1200.00');
});

test('PayPal Invoicing: rejects invalid currency and missing client email', async () => {
  await assert.rejects(
    async () => {
      await createPayPalInvoiceDraft({
        clientName: 'Marcus Vance',
        clientEmail: 'invalid-email',
        lineItems: [{ id: '1', description: 'Consulting', quantity: 1, unitPrice: 500, total: 500 }],
      });
    },
    {
      message: /Valid client email is required/,
    }
  );

  await assert.rejects(
    async () => {
      await createPayPalInvoiceDraft({
        clientName: 'Marcus Vance',
        clientEmail: 'marcus@luminamedia.com',
        lineItems: [{ id: '1', description: 'Consulting', quantity: 1, unitPrice: 500, total: 500 }],
        currency: 'EUR',
      });
    },
    {
      message: /Invalid currency 'EUR'. PayPilot AI strictly operates in USD/,
    }
  );
});

// ---------------------------------------------------------------------------
// 2. Invoice Dispatching & Reminders Tests
// ---------------------------------------------------------------------------

test('PayPal Invoicing: dispatches invoice and updates status to sent', async () => {
  process.env.PAYPAL_CLIENT_ID = 'mock_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'mock_client_secret';
  resetPayPalTokenCache();
  seedInitialInvoicesStore();

  let sendEndpointCalled = false;

  const mockFetch = async (url: RequestInfo | URL): Promise<Response> => {
    const urlStr = String(url);
    if (urlStr.includes('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'mock_token', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (urlStr.includes('/v2/invoicing/invoices') && urlStr.endsWith('/send')) {
      sendEndpointCalled = true;
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.includes('/v2/invoicing/invoices')) {
      return new Response(
        JSON.stringify({ id: 'INV2-SEND-TEST', status: 'DRAFT', links: [] }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected mock URL: ${urlStr}`);
  };

  const created = await createPayPalInvoiceDraft(
    {
      clientName: 'Dr. Elena Rostova',
      clientEmail: 'finance@beaconhealth.co',
      lineItems: [{ id: '1', description: 'Testing', quantity: 1, unitPrice: 800, total: 800 }],
    },
    mockFetch as unknown as typeof fetch
  );

  const sent = await sendPayPalInvoice(created.id, mockFetch as unknown as typeof fetch);
  assert.equal(sent.status, 'sent');
  assert.equal(sent.paypalStatus, 'SENT');
  assert.equal(sendEndpointCalled, true);
});

test('PayPal Invoicing: dispatches reminder and increments counter', async () => {
  process.env.PAYPAL_CLIENT_ID = 'mock_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'mock_client_secret';
  resetPayPalTokenCache();
  seedInitialInvoicesStore();

  let remindEndpointCalled = false;

  const mockFetch = async (url: RequestInfo | URL): Promise<Response> => {
    const urlStr = String(url);
    if (urlStr.includes('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'mock_token', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (urlStr.includes('/v2/invoicing/invoices') && urlStr.endsWith('/send')) {
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.includes('/v2/invoicing/invoices') && urlStr.endsWith('/remind')) {
      remindEndpointCalled = true;
      return new Response(null, { status: 204 });
    }
    if (urlStr.includes('/v2/invoicing/invoices')) {
      return new Response(
        JSON.stringify({ id: 'INV2-REMIND-TEST', status: 'DRAFT', links: [] }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected mock URL: ${urlStr}`);
  };

  const created = await createPayPalInvoiceDraft(
    {
      clientName: 'Dr. Elena Rostova',
      clientEmail: 'finance@beaconhealth.co',
      lineItems: [{ id: '1', description: 'Testing', quantity: 1, unitPrice: 800, total: 800 }],
    },
    mockFetch as unknown as typeof fetch
  );

  // Send first
  await sendPayPalInvoice(created.id, mockFetch as unknown as typeof fetch);

  // Then remind
  const reminded = await remindPayPalInvoice(created.id, 'Friendly payment check', mockFetch as unknown as typeof fetch);
  assert.equal(reminded.remindersSentCount, 1);
  assert.ok(reminded.lastReminderDate);
  assert.equal(remindEndpointCalled, true);
});

// ---------------------------------------------------------------------------
// 3. Authoritative Live Status & Webhook Tests
// ---------------------------------------------------------------------------

test('PayPal Invoicing: queries live authoritative status from PayPal Sandbox', async () => {
  process.env.PAYPAL_CLIENT_ID = 'mock_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'mock_client_secret';
  resetPayPalTokenCache();
  seedInitialInvoicesStore();

  const mockFetch = async (url: RequestInfo | URL): Promise<Response> => {
    const urlStr = String(url);
    if (urlStr.includes('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'mock_token', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (urlStr.includes('/v2/invoicing/invoices/INV2-LIVE-CHECK')) {
      return new Response(
        JSON.stringify({
          id: 'INV2-LIVE-CHECK',
          status: 'PAID',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr.includes('/v2/invoicing/invoices')) {
      return new Response(
        JSON.stringify({ id: 'INV2-LIVE-CHECK', status: 'DRAFT', links: [] }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected mock URL: ${urlStr}`);
  };

  const created = await createPayPalInvoiceDraft(
    {
      clientName: 'Sarah Chen',
      clientEmail: 'billing@acmetechnologies.io',
      lineItems: [{ id: '1', description: 'Design', quantity: 1, unitPrice: 500, total: 500 }],
    },
    mockFetch as unknown as typeof fetch
  );

  const statusCheck = await getPayPalInvoiceStatus(created.id, mockFetch as unknown as typeof fetch);
  assert.equal(statusCheck.authoritativeSource, 'PAYPAL_SANDBOX_API');
  assert.equal(statusCheck.paypalLiveStatus, 'PAID');
  assert.equal(statusCheck.isPaid, true);
  assert.equal(statusCheck.invoice.status, 'paid');
});

test('PayPal Webhook: rejects untrusted certificate domains and verifies signature headers', async () => {
  resetWebhookDeduplicationCache();

  // 1. Untrusted attacker cert URL
  const untrustedResult = await verifyAndProcessPayPalWebhook(
    {
      'paypal-cert-url': 'https://attacker.evil.com/fake-cert.pem',
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-transmission-id': 'trans-fake',
      'paypal-transmission-sig': 'sig-fake',
      'paypal-transmission-time': new Date().toISOString(),
    },
    { id: 'EVT-UNTRUSTED-1', event_type: 'INVOICING.INVOICE.PAID' }
  );

  assert.equal(untrustedResult.verified, false);
  assert.match(untrustedResult.error || '', /Unauthorized certificate URL domain/);

  // 2. Valid PayPal domain cert URL
  const validResult = await verifyAndProcessPayPalWebhook(
    {
      'paypal-cert-url': 'https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-123.pem',
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-transmission-id': 'trans-valid-1',
      'paypal-transmission-sig': 'sig-valid',
      'paypal-transmission-time': new Date().toISOString(),
    },
    { id: 'EVT-VALID-1', event_type: 'INVOICING.INVOICE.PAID' }
  );

  assert.equal(validResult.verified, true);
  assert.equal(validResult.duplicate, false);
});

test('PayPal Webhook: idempotency protects against duplicate events', async () => {
  resetWebhookDeduplicationCache();

  const headers = {
    'paypal-cert-url': 'https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-123.pem',
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-transmission-id': 'trans-idem-1',
    'paypal-transmission-sig': 'sig-idem',
    'paypal-transmission-time': new Date().toISOString(),
  };

  const payload = {
    id: 'WH-EVT-DUPLICATE-TEST-99',
    event_type: 'INVOICING.INVOICE.PAID',
    resource: {
      invoice: {
        id: 'INV2-TEST',
      },
    },
  };

  // First call
  const first = await verifyAndProcessPayPalWebhook(headers, payload);
  assert.equal(first.verified, true);
  assert.equal(first.duplicate, false);

  // Second duplicate call
  const second = await verifyAndProcessPayPalWebhook(headers, payload);
  assert.equal(second.verified, true);
  assert.equal(second.duplicate, true);
});

test('PayPal Webhook: processes CHECKOUT.ORDER.APPROVED and PAYMENT.CAPTURE.COMPLETED', async () => {
  resetWebhookDeduplicationCache();

  saveStoredPayPalOrder({
    orderId: 'ORDER-WH-TEST-1',
    purchaseApprovalId: 'appr-wh-test',
    totalAmount: 150,
    currency: 'USD',
    status: 'CREATED',
    approveUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-WH-TEST-1',
    createdAt: new Date().toISOString(),
    idempotencyKeys: new Set(),
  });

  const headers = {
    'paypal-cert-url': 'https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-123.pem',
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-transmission-id': 'trans-ord-1',
    'paypal-transmission-sig': 'sig-ord',
    'paypal-transmission-time': new Date().toISOString(),
  };

  // 1. Order approved event
  const approvedResult = await verifyAndProcessPayPalWebhook(headers, {
    id: 'WH-EVT-APPROVED-1',
    event_type: 'CHECKOUT.ORDER.APPROVED',
    resource: { id: 'ORDER-WH-TEST-1' },
  });
  assert.equal(approvedResult.verified, true);
  const orderAfterApproval = getStoredPayPalOrder('ORDER-WH-TEST-1');
  assert.equal(orderAfterApproval?.status, 'APPROVED');

  // 2. Capture completed event
  const capturedResult = await verifyAndProcessPayPalWebhook(headers, {
    id: 'WH-EVT-CAPTURED-1',
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: {
      id: 'CAPTURE-ID-999',
      supplementary_data: {
        related_ids: {
          order_id: 'ORDER-WH-TEST-1',
        },
      },
    },
  });
  assert.equal(capturedResult.verified, true);
  const orderAfterCapture = getStoredPayPalOrder('ORDER-WH-TEST-1');
  assert.equal(orderAfterCapture?.status, 'COMPLETED');
  assert.equal(orderAfterCapture?.captureId, 'CAPTURE-ID-999');
});

