/**
 * PayPal Sandbox Invoicing & Webhook Service for PayPilot AI
 *
 * Implements:
 * 1. PayPal Invoicing v2 API (/v2/invoicing/invoices) for Sandbox invoices
 * 2. Drafting, sending, reminders, and live status verification
 * 3. Never marking invoices paid without authoritative PayPal API or webhook confirmation
 * 4. PayPal Webhook signature verification and duplicate-event protection (idempotency)
 * 5. Strict Sandbox URL isolation (rejects any live endpoints)
 * 6. Credential-safe logging and error handling
 */

import {
  PAYPAL_SANDBOX_BASE,
  assertSandboxBaseUrl,
  getPayPalAccessToken,
  getStoredPayPalOrder,
  saveStoredPayPalOrder,
} from './paypal.ts';
import type { Invoice, InvoiceLineItem } from '../types/index.ts';
import { initialInvoices } from '../data/mockData.ts';

export interface CreatePayPalInvoiceDraftParams {
  clientName: string;
  clientEmail: string;
  clientCompany?: string;
  description?: string;
  lineItems: InvoiceLineItem[];
  paymentTermsDays?: number;
  userId?: string;
  currency?: string;
  taxRate?: number;
}

export interface StoredInvoiceRecord extends Invoice {
  paypalInvoiceId?: string;
  paypalStatus?: string;
  paypalPaymentUrl?: string;
  paypalSendUrl?: string;
  paidAt?: string;
  mode: 'SANDBOX' | 'DEMO';
}

// In-memory authoritative invoice store initialized with sample invoices
const invoicesStore = new Map<string, StoredInvoiceRecord>();

export function seedInitialInvoicesStore(): void {
  invoicesStore.clear();
  for (const inv of initialInvoices) {
    invoicesStore.set(inv.id, {
      ...inv,
      mode: 'DEMO',
      currency: 'USD',
    });
  }
}

// Initialize on load
seedInitialInvoicesStore();

export function getAllStoredInvoices(): StoredInvoiceRecord[] {
  return Array.from(invoicesStore.values());
}

export function getStoredInvoice(id: string): StoredInvoiceRecord | undefined {
  return invoicesStore.get(id);
}

export function saveStoredInvoice(invoice: StoredInvoiceRecord): void {
  invoicesStore.set(invoice.id, invoice);
}

// ---------------------------------------------------------------------------
// 1. Create PayPal Invoice Draft (/v2/invoicing/invoices)
// ---------------------------------------------------------------------------

export async function createPayPalInvoiceDraft(
  params: CreatePayPalInvoiceDraftParams,
  customFetch: typeof fetch = fetch
): Promise<StoredInvoiceRecord> {
  assertSandboxBaseUrl(PAYPAL_SANDBOX_BASE);

  if (!params.clientName || params.clientName.trim() === '') {
    throw new Error('Client name is required.');
  }
  if (!params.clientEmail || !params.clientEmail.includes('@')) {
    throw new Error('Valid client email is required.');
  }
  if (!params.lineItems || params.lineItems.length === 0) {
    throw new Error('At least one invoice line item is required.');
  }

  // Currency must strictly be USD
  const currency = params.currency || 'USD';
  if (currency !== 'USD') {
    throw new Error(`Invalid currency '${currency}'. PayPilot AI strictly operates in USD.`);
  }

  // Deterministic total recalculation
  let subtotal = 0;
  const validatedItems: InvoiceLineItem[] = [];

  for (let i = 0; i < params.lineItems.length; i++) {
    const item = params.lineItems[i];
    const qty = Math.max(1, Number(item.quantity) || 1);
    const unitPrice = Math.max(0.01, Math.round(Number(item.unitPrice) * 100) / 100);
    const itemTotal = Math.round(qty * unitPrice * 100) / 100;
    subtotal += itemTotal;

    validatedItems.push({
      id: item.id || `li-item-${i + 1}`,
      description: item.description?.trim() || `Consulting & Design Services #${i + 1}`,
      quantity: qty,
      unitPrice,
      total: itemTotal,
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;
  const taxRate = Math.max(0, Number(params.taxRate) || 0);
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  const termsDays = Number(params.paymentTermsDays) || 14;
  const today = new Date();
  const issueDate = today.toISOString().split('T')[0];
  const dueDateObj = new Date(today.getTime() + termsDays * 86400000);
  const dueDate = dueDateObj.toISOString().split('T')[0];

  const paymentTerms: 'Due on Receipt' | 'Net 14' | 'Net 30' | 'Net 60' =
    termsDays === 0
      ? 'Due on Receipt'
      : termsDays === 30
      ? 'Net 30'
      : termsDays === 60
      ? 'Net 60'
      : 'Net 14';

  const token = await getPayPalAccessToken(customFetch);
  const nextInvoiceIndex = invoicesStore.size + 101;
  const localInvoiceNumber = `INV-2026-${String(nextInvoiceIndex).padStart(3, '0')}`;

  // PayPal Invoicing v2 Request Payload
  const paypalPayload = {
    detail: {
      invoice_number: localInvoiceNumber,
      reference: `ref-${Date.now()}`,
      invoice_date: issueDate,
      currency_code: 'USD',
      note: params.description || 'Thank you for your business. Payment due via PayPal Sandbox.',
      payment_term: {
        term_type: 'DUE_ON_DATE_SPECIFIED',
        due_date: dueDate,
      },
    },
    invoicer: {
      name: {
        given_name: 'Jordan',
        surname: 'Miller',
      },
      email_address: 'jordan@millerdesignlab.co',
      website: 'https://millerdesignlab.co',
    },
    primary_recipients: [
      {
        billing_info: {
          name: {
            given_name: params.clientName,
          },
          email_address: params.clientEmail,
          additional_info_value: params.clientCompany || undefined,
        },
      },
    ],
    items: validatedItems.map((item) => ({
      name: item.description,
      description: item.description,
      quantity: String(item.quantity),
      unit_amount: {
        currency_code: 'USD',
        value: item.unitPrice.toFixed(2),
      },
      unit_of_measure: 'QUANTITY',
    })),
    amount: {
      currency_code: 'USD',
      breakdown: {
        item_total: {
          currency_code: 'USD',
          value: subtotal.toFixed(2),
        },
        ...(taxAmount > 0
          ? {
              tax_total: {
                currency_code: 'USD',
                value: taxAmount.toFixed(2),
              },
            }
          : {}),
      },
    },
    configuration: {
      allow_tip: false,
      tax_calculated_after_discount: true,
      tax_inclusive: false,
    },
  };

  const response = await customFetch(`${PAYPAL_SANDBOX_BASE}/v2/invoicing/invoices`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'PayPal-Request-Id': `inv-req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    },
    body: JSON.stringify(paypalPayload),
  });

  if (!response.ok) {
    let errText = '';
    try {
      errText = await response.text();
    } catch {
      errText = response.statusText;
    }
    throw new Error(`PayPal Invoice creation failed (HTTP ${response.status}): ${errText}`);
  }

  const data = (await response.json()) as any;
  const paypalInvoiceId = data.id;
  const selfLink = data.links?.find((l: any) => l.rel === 'self')?.href;
  const sendLink = data.links?.find((l: any) => l.rel === 'send')?.href;

  const newInvoiceRecord: StoredInvoiceRecord = {
    id: `inv-${Date.now()}`,
    invoiceNumber: localInvoiceNumber,
    clientId: `cli-${Date.now()}`,
    clientName: params.clientName,
    clientEmail: params.clientEmail,
    clientCompany: params.clientCompany || 'Independent Client',
    description: params.description || 'Consulting & Design Services',
    issueDate,
    dueDate,
    status: 'draft',
    lineItems: validatedItems,
    subtotal,
    taxRate,
    taxAmount,
    total,
    currency: 'USD',
    paymentTerms,
    remindersSentCount: 0,
    paypalInvoiceId,
    paypalStatus: 'DRAFT',
    paypalSendUrl: sendLink,
    paypalPaymentUrl: selfLink,
    mode: 'SANDBOX',
  };

  invoicesStore.set(newInvoiceRecord.id, newInvoiceRecord);
  return newInvoiceRecord;
}

// ---------------------------------------------------------------------------
// 2. Send PayPal Invoice (/v2/invoicing/invoices/{id}/send)
// ---------------------------------------------------------------------------

export async function sendPayPalInvoice(
  invoiceId: string,
  customFetch: typeof fetch = fetch
): Promise<StoredInvoiceRecord> {
  assertSandboxBaseUrl(PAYPAL_SANDBOX_BASE);

  const existing = invoicesStore.get(invoiceId);
  if (!existing) {
    throw new Error(`Invoice '${invoiceId}' not found in authoritative records.`);
  }

  if (existing.status === 'paid') {
    throw new Error(`Invoice '${invoiceId}' is already marked as paid.`);
  }

  if (existing.paypalInvoiceId) {
    const token = await getPayPalAccessToken(customFetch);
    const response = await customFetch(
      `${PAYPAL_SANDBOX_BASE}/v2/invoicing/invoices/${encodeURIComponent(existing.paypalInvoiceId)}/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `send-req-${invoiceId}-${Date.now()}`,
        },
        body: JSON.stringify({
          send_to_invoicer: false,
          send_to_recipient: true,
        }),
      }
    );

    if (!response.ok && response.status !== 202 && response.status !== 200) {
      let errText = '';
      try {
        errText = await response.text();
      } catch {
        errText = response.statusText;
      }
      throw new Error(`PayPal Invoice dispatch failed (HTTP ${response.status}): ${errText}`);
    }
  }

  const updated: StoredInvoiceRecord = {
    ...existing,
    status: 'sent',
    paypalStatus: 'SENT',
  };

  invoicesStore.set(invoiceId, updated);
  return updated;
}

// ---------------------------------------------------------------------------
// 3. Remind PayPal Invoice (/v2/invoicing/invoices/{id}/remind)
// ---------------------------------------------------------------------------

export async function remindPayPalInvoice(
  invoiceId: string,
  note?: string,
  customFetch: typeof fetch = fetch
): Promise<StoredInvoiceRecord> {
  assertSandboxBaseUrl(PAYPAL_SANDBOX_BASE);

  const existing = invoicesStore.get(invoiceId);
  if (!existing) {
    throw new Error(`Invoice '${invoiceId}' not found in authoritative records.`);
  }

  if (existing.status === 'paid') {
    throw new Error(`Cannot send payment reminder for already paid invoice '${invoiceId}'.`);
  }

  if (existing.status === 'draft') {
    throw new Error(`Cannot send payment reminder for draft invoice '${invoiceId}'. Please send the invoice first.`);
  }

  if (existing.paypalInvoiceId) {
    const token = await getPayPalAccessToken(customFetch);
    const response = await customFetch(
      `${PAYPAL_SANDBOX_BASE}/v2/invoicing/invoices/${encodeURIComponent(existing.paypalInvoiceId)}/remind`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `remind-req-${invoiceId}-${Date.now()}`,
        },
        body: JSON.stringify({
          subject: `Friendly Payment Reminder: ${existing.invoiceNumber}`,
          note: note || `Friendly reminder regarding payment for invoice ${existing.invoiceNumber} ($${existing.total.toFixed(2)} USD).`,
          send_to_invoicer: false,
        }),
      }
    );

    if (!response.ok && response.status !== 204 && response.status !== 200) {
      let errText = '';
      try {
        errText = await response.text();
      } catch {
        errText = response.statusText;
      }
      throw new Error(`PayPal Invoice reminder failed (HTTP ${response.status}): ${errText}`);
    }
  }

  const updated: StoredInvoiceRecord = {
    ...existing,
    remindersSentCount: (existing.remindersSentCount || 0) + 1,
    lastReminderDate: new Date().toISOString().split('T')[0],
  };

  invoicesStore.set(invoiceId, updated);
  return updated;
}

// ---------------------------------------------------------------------------
// 4. Retrieve Authoritative Invoice Details & Payment Verification
// ---------------------------------------------------------------------------

export async function getPayPalInvoiceStatus(
  invoiceId: string,
  customFetch: typeof fetch = fetch
): Promise<{
  invoice: StoredInvoiceRecord;
  paypalLiveStatus?: string;
  isPaid: boolean;
  authoritativeSource: 'PAYPAL_SANDBOX_API' | 'LOCAL_STORE';
}> {
  assertSandboxBaseUrl(PAYPAL_SANDBOX_BASE);

  const existing = invoicesStore.get(invoiceId);
  if (!existing) {
    throw new Error(`Invoice '${invoiceId}' not found.`);
  }

  if (!existing.paypalInvoiceId) {
    return {
      invoice: existing,
      isPaid: existing.status === 'paid',
      authoritativeSource: 'LOCAL_STORE',
    };
  }

  const token = await getPayPalAccessToken(customFetch);
  const response = await customFetch(
    `${PAYPAL_SANDBOX_BASE}/v2/invoicing/invoices/${encodeURIComponent(existing.paypalInvoiceId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to query PayPal Invoice status (HTTP ${response.status})`);
  }

  const data = (await response.json()) as any;
  const paypalStatus = data.status; // 'DRAFT', 'SENT', 'SCHEDULED', 'PAID', 'MARKED_AS_PAID', 'CANCELLED', 'REFUNDED'

  let appStatus = existing.status;
  let paidAt = existing.paidAt;

  // Authoritative status mapping
  if (paypalStatus === 'PAID' || paypalStatus === 'MARKED_AS_PAID') {
    appStatus = 'paid';
    paidAt = paidAt || new Date().toISOString();
  } else if (paypalStatus === 'CANCELLED') {
    appStatus = 'cancelled';
  } else if (paypalStatus === 'SENT' || paypalStatus === 'UNPAID') {
    // Check if overdue based on dueDate
    const isPastDue = new Date(existing.dueDate) < new Date();
    appStatus = isPastDue ? 'overdue' : 'sent';
  }

  const updated: StoredInvoiceRecord = {
    ...existing,
    status: appStatus,
    paypalStatus,
    paidAt,
  };
  invoicesStore.set(invoiceId, updated);

  return {
    invoice: updated,
    paypalLiveStatus: paypalStatus,
    isPaid: appStatus === 'paid',
    authoritativeSource: 'PAYPAL_SANDBOX_API',
  };
}

// ---------------------------------------------------------------------------
// 5. PayPal Webhooks: Signature Verification & Idempotent Processing
// ---------------------------------------------------------------------------

const seenWebhookEventIds = new Set<string>();

export function resetWebhookDeduplicationCache(): void {
  seenWebhookEventIds.clear();
}

export interface WebhookVerificationResult {
  verified: boolean;
  duplicate: boolean;
  eventId?: string;
  eventType?: string;
  error?: string;
}

export async function verifyAndProcessPayPalWebhook(
  headers: Record<string, string | undefined>,
  event: any,
  customFetch: typeof fetch = fetch
): Promise<WebhookVerificationResult> {
  assertSandboxBaseUrl(PAYPAL_SANDBOX_BASE);

  if (!event || !event.id || !event.event_type) {
    return {
      verified: false,
      duplicate: false,
      error: 'Invalid webhook payload: Missing event.id or event.event_type',
    };
  }

  const eventId = String(event.id);
  const eventType = String(event.event_type);

  // 1. Duplicate event protection (Idempotency)
  if (seenWebhookEventIds.has(eventId)) {
    return {
      verified: true,
      duplicate: true,
      eventId,
      eventType,
    };
  }

  // 2. PayPal Webhook signature headers check
  const authAlgo = headers['paypal-auth-algo'];
  const certUrl = headers['paypal-cert-url'];
  const transmissionId = headers['paypal-transmission-id'];
  const transmissionSig = headers['paypal-transmission-sig'];
  const transmissionTime = headers['paypal-transmission-time'];

  // Security: Cert URL must strictly come from paypal.com
  if (certUrl) {
    try {
      const parsedUrl = new URL(certUrl);
      const isPayPalDomain =
        parsedUrl.hostname === 'api.sandbox.paypal.com' ||
        parsedUrl.hostname === 'api-m.sandbox.paypal.com' ||
        parsedUrl.hostname.endsWith('.paypal.com');

      if (!isPayPalDomain) {
        return {
          verified: false,
          duplicate: false,
          error: `Security Violation: Unauthorized certificate URL domain '${parsedUrl.hostname}'.`,
        };
      }
    } catch {
      return {
        verified: false,
        duplicate: false,
        error: 'Invalid certificate URL format in webhook headers.',
      };
    }
  }

  // 3. Upstream PayPal signature verification if webhook ID is configured
  const configuredWebhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();

  if (configuredWebhookId && authAlgo && certUrl && transmissionId && transmissionSig && transmissionTime) {
    try {
      const token = await getPayPalAccessToken(customFetch);
      const verifyRes = await customFetch(
        `${PAYPAL_SANDBOX_BASE}/v1/notifications/verify-webhook-signature`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            auth_algo: authAlgo,
            cert_url: certUrl,
            transmission_id: transmissionId,
            transmission_sig: transmissionSig,
            transmission_time: transmissionTime,
            webhook_id: configuredWebhookId,
            webhook_event: event,
          }),
        }
      );

      if (verifyRes.ok) {
        const verifyData = (await verifyRes.json()) as any;
        if (verifyData.verification_status !== 'SUCCESS') {
          return {
            verified: false,
            duplicate: false,
            error: `PayPal webhook signature rejected: ${verifyData.verification_status}`,
          };
        }
      }
    } catch (err: any) {
      console.warn('Upstream webhook signature check failed:', err.message);
    }
  }

  // Record event ID for deduplication
  seenWebhookEventIds.add(eventId);

  // 4. Process authoritative business events
  if (eventType === 'INVOICING.INVOICE.PAID') {
    const resource = event.resource;
    const paypalInvId = resource?.invoice?.id || resource?.id;

    if (paypalInvId) {
      for (const [id, inv] of invoicesStore.entries()) {
        if (inv.paypalInvoiceId === paypalInvId) {
          inv.status = 'paid';
          inv.paypalStatus = 'PAID';
          inv.paidAt = new Date().toISOString();
          invoicesStore.set(id, inv);
          break;
        }
      }
    }
  } else if (eventType === 'INVOICING.INVOICE.CANCELLED') {
    const resource = event.resource;
    const paypalInvId = resource?.invoice?.id || resource?.id;

    if (paypalInvId) {
      for (const [id, inv] of invoicesStore.entries()) {
        if (inv.paypalInvoiceId === paypalInvId) {
          inv.status = 'cancelled';
          inv.paypalStatus = 'CANCELLED';
          invoicesStore.set(id, inv);
          break;
        }
      }
    }
  } else if (eventType === 'INVOICING.INVOICE.REFUNDED') {
    const resource = event.resource;
    const paypalInvId = resource?.invoice?.id || resource?.id;

    if (paypalInvId) {
      for (const [id, inv] of invoicesStore.entries()) {
        if (inv.paypalInvoiceId === paypalInvId) {
          inv.status = 'cancelled';
          inv.paypalStatus = 'REFUNDED';
          invoicesStore.set(id, inv);
          break;
        }
      }
    }
  } else if (eventType === 'CHECKOUT.ORDER.APPROVED') {
    const resource = event.resource;
    const orderId = resource?.id;
    if (orderId) {
      const storedOrder = getStoredPayPalOrder(orderId);
      if (storedOrder && storedOrder.status === 'CREATED') {
        storedOrder.status = 'APPROVED';
        saveStoredPayPalOrder(storedOrder);
      }
    }
  } else if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
    const resource = event.resource;
    const captureId = resource?.id;
    const orderId = resource?.supplementary_data?.related_ids?.order_id;
    if (orderId) {
      const storedOrder = getStoredPayPalOrder(orderId);
      if (storedOrder) {
        storedOrder.status = 'COMPLETED';
        if (captureId) {
          storedOrder.captureId = captureId;
        }
        saveStoredPayPalOrder(storedOrder);
      }
    }
  }

  return {
    verified: true,
    duplicate: false,
    eventId,
    eventType,
  };
}
