/**
 * PayPal Sandbox Orders Service for PayPilot AI
 *
 * Implements server-side PayPal REST API integration using Node.js:
 * - Uses https://api-m.sandbox.paypal.com exclusively (rejects live endpoints)
 * - OAuth access token acquisition & caching with expiry handling
 * - Authoritative cart price re-calculation from product catalog
 * - Spending mandate revalidation
 * - Order creation (POST /v2/checkout/orders)
 * - Buyer approval verification and idempotent order capture (POST /v2/checkout/orders/{id}/capture)
 * - Stores provider IDs & status only (never stores sensitive payment credentials)
 */

import { initialProducts, initialApprovals } from '../data/mockData.ts';
import { getSpendingMandate, setPurchaseApprovalsProvider } from './tools.ts';
import { evaluateSpendingPolicy } from '../utils/rules.ts';
import type { PurchaseApproval, CartItem } from '../types/index.ts';

// ---------------------------------------------------------------------------
// 1. URL & Security Constants
// ---------------------------------------------------------------------------

export const PAYPAL_SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';

/**
 * Strict verification that ONLY the PayPal Sandbox endpoint is accessed.
 * Any attempt to use live PayPal URLs is rejected immediately.
 */
export function assertSandboxBaseUrl(url: string = PAYPAL_SANDBOX_BASE): void {
  if (!url.startsWith(PAYPAL_SANDBOX_BASE)) {
    throw new Error(
      `SECURITY_VIOLATION: Live PayPal endpoints are strictly prohibited. PayPilot AI operates exclusively with PayPal Sandbox (${PAYPAL_SANDBOX_BASE}). Attempted: ${url}`
    );
  }
}

// ---------------------------------------------------------------------------
// 2. Credentials Configuration
// ---------------------------------------------------------------------------

export interface PayPalCredentials {
  clientId: string;
  clientSecret: string;
}

export function getPayPalCredentials(): PayPalCredentials | null {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId.trim() === '' || clientSecret.trim() === '') {
    return null;
  }

  return {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
  };
}

export function hasPayPalCredentials(): boolean {
  return getPayPalCredentials() !== null;
}

export interface PayeeDiagnosticInfo {
  configured: boolean;
  type: 'MERCHANT_ID' | 'EMAIL' | 'DEFAULT_CALLER';
  details: string;
  maskedIdentifier?: string;
}

/**
 * Reads optional payee configuration from environment variables.
 * Prefer configured merchant ID (PAYPAL_MERCHANT_ID) when available;
 * otherwise use configured merchant email (PAYPAL_PAYEE_EMAIL).
 * Returns null if neither is configured, preserving default caller payee behavior.
 */
export function getPayPalConfiguredPayee(): { merchant_id?: string; email_address?: string } | null {
  const merchantId = process.env.PAYPAL_MERCHANT_ID?.trim();
  const emailAddress = process.env.PAYPAL_PAYEE_EMAIL?.trim();

  if (merchantId) {
    return { merchant_id: merchantId };
  }
  if (emailAddress) {
    return { email_address: emailAddress };
  }
  return null;
}

/**
 * Returns safe diagnostic information about payee routing without exposing sensitive details.
 */
export function getPayeeDiagnosticInfo(): PayeeDiagnosticInfo {
  const merchantId = process.env.PAYPAL_MERCHANT_ID?.trim();
  const emailAddress = process.env.PAYPAL_PAYEE_EMAIL?.trim();

  if (merchantId) {
    const masked = merchantId.length > 4 ? `***${merchantId.slice(-4)}` : '***';
    return {
      configured: true,
      type: 'MERCHANT_ID',
      maskedIdentifier: masked,
      details: `Explicit merchant ID routing active (${masked}). Payments will route to the specified Sandbox seller merchant ID.`,
    };
  }

  if (emailAddress) {
    const atIndex = emailAddress.indexOf('@');
    let masked = '***';
    if (atIndex > 1) {
      masked = `${emailAddress.slice(0, 2)}***${emailAddress.slice(atIndex)}`;
    } else if (atIndex > 0) {
      masked = `*${emailAddress.slice(atIndex)}`;
    }
    return {
      configured: true,
      type: 'EMAIL',
      maskedIdentifier: masked,
      details: `Explicit payee email routing active (${masked}). Payments will route to the specified Sandbox seller email.`,
    };
  }

  return {
    configured: false,
    type: 'DEFAULT_CALLER',
    details: 'No explicit payee configured. PayPal Sandbox defaults to the merchant account owning the API credentials.',
  };
}

// ---------------------------------------------------------------------------
// 3. OAuth Token Caching & Acquisition
// ---------------------------------------------------------------------------

interface CachedToken {
  accessToken: string;
  expiresAt: number; // millisecond timestamp
}

let tokenCache: CachedToken | null = null;

export function resetPayPalTokenCache(): void {
  tokenCache = null;
}

/**
 * Retrieves a valid OAuth 2.0 Bearer access token for the PayPal Sandbox API.
 * Reuses active tokens until within 60 seconds of expiration.
 */
export async function getPayPalAccessToken(
  customFetch: typeof fetch = fetch
): Promise<string> {
  // Check in-memory cache with 60-second safety buffer
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.accessToken;
  }

  const credentials = getPayPalCredentials();
  if (!credentials) {
    throw new Error(
      'PayPal credentials missing: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be configured in environment secrets.'
    );
  }

  assertSandboxBaseUrl(PAYPAL_SANDBOX_BASE);

  const authHeader = Buffer.from(
    `${credentials.clientId}:${credentials.clientSecret}`
  ).toString('base64');

  const response = await customFetch(`${PAYPAL_SANDBOX_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    let errBody = '';
    try {
      errBody = await response.text();
    } catch {
      errBody = response.statusText;
    }
    throw new Error(`PayPal OAuth authentication failed (HTTP ${response.status}): ${errBody}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    token_type: string;
    expires_in: number;
  };

  if (!data.access_token) {
    throw new Error('PayPal OAuth response did not contain an access_token.');
  }

  const expiresInMs = (data.expires_in || 3600) * 1000;
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresInMs,
  };

  return tokenCache.accessToken;
}

export interface PayPalHealthStatus {
  status: 'ok' | 'unconfigured' | 'error';
  configured: boolean;
  authenticated: boolean;
  mode: 'SANDBOX';
  sandboxBaseUrl: string;
  livePaymentsAllowed: false;
  timestamp: string;
  tokenType?: string;
  error?: string;
}

/**
 * Validates PayPal Sandbox OAuth connectivity without creating orders,
 * capturing payments, or exposing sensitive credentials.
 */
export async function verifyPayPalSandboxConnectivity(
  customFetch: typeof fetch = fetch
): Promise<PayPalHealthStatus> {
  assertSandboxBaseUrl(PAYPAL_SANDBOX_BASE);

  const credentials = getPayPalCredentials();
  if (!credentials) {
    return {
      status: 'unconfigured',
      configured: false,
      authenticated: false,
      mode: 'SANDBOX',
      sandboxBaseUrl: PAYPAL_SANDBOX_BASE,
      livePaymentsAllowed: false,
      timestamp: new Date().toISOString(),
      error: 'PayPal credentials missing: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are not configured in environment secrets.',
    };
  }

  try {
    const token = await getPayPalAccessToken(customFetch);
    const authenticated = Boolean(token && token.length > 0);

    return {
      status: authenticated ? 'ok' : 'error',
      configured: true,
      authenticated,
      mode: 'SANDBOX',
      sandboxBaseUrl: PAYPAL_SANDBOX_BASE,
      livePaymentsAllowed: false,
      tokenType: 'Bearer',
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    let safeMessage = error?.message || 'PayPal Sandbox OAuth authentication failed.';
    if (credentials.clientSecret) {
      safeMessage = safeMessage.split(credentials.clientSecret).join('***');
    }
    if (credentials.clientId) {
      safeMessage = safeMessage.split(credentials.clientId).join('***');
    }

    return {
      status: 'error',
      configured: true,
      authenticated: false,
      mode: 'SANDBOX',
      sandboxBaseUrl: PAYPAL_SANDBOX_BASE,
      livePaymentsAllowed: false,
      timestamp: new Date().toISOString(),
      error: safeMessage,
    };
  }
}

export interface PayPalDiagnosticReport {
  mode: 'SANDBOX';
  sandboxBaseUrl: string;
  livePaymentsAllowed: false;
  timestamp: string;
  oauth: {
    status: 'ok' | 'unconfigured' | 'error';
    authenticated: boolean;
    tokenType?: string;
    details: string;
  };
  orderCreation: {
    status: 'ready' | 'not_ready';
    endpoint: string;
    authoritativeRecalculation: boolean;
    mandateEnforcement: boolean;
    details: string;
  };
  approvalUrl: {
    status: 'ready' | 'not_ready';
    baseUrl: string;
    pattern: string;
    details: string;
  };
  capture: {
    status: 'ready' | 'not_ready';
    endpoint: string;
    preApprovalGating: boolean;
    idempotencyProtection: boolean;
    details: string;
  };
  payee: PayeeDiagnosticInfo;
  storedOrdersCount: number;
}

/**
 * Diagnostic runner checking:
 * 1. OAuth authentication status
 * 2. Order creation status
 * 3. Approval URL availability
 * 4. Capture endpoint status
 */
export async function getPayPalSandboxDiagnostic(
  customFetch: typeof fetch = fetch
): Promise<PayPalDiagnosticReport> {
  assertSandboxBaseUrl(PAYPAL_SANDBOX_BASE);

  const health = await verifyPayPalSandboxConnectivity(customFetch);
  const isHealthy = health.status === 'ok' && health.authenticated;

  return {
    mode: 'SANDBOX',
    sandboxBaseUrl: PAYPAL_SANDBOX_BASE,
    livePaymentsAllowed: false,
    timestamp: new Date().toISOString(),
    oauth: {
      status: health.status,
      authenticated: health.authenticated,
      tokenType: health.tokenType || (health.authenticated ? 'Bearer' : undefined),
      details: health.authenticated
        ? `Authenticated with PayPal Sandbox API (${PAYPAL_SANDBOX_BASE}). Valid Bearer token cached.`
        : health.error || 'OAuth token could not be obtained from PayPal Sandbox.',
    },
    orderCreation: {
      status: isHealthy ? 'ready' : 'not_ready',
      endpoint: 'POST /v2/checkout/orders',
      authoritativeRecalculation: true,
      mandateEnforcement: true,
      details: isHealthy
        ? 'Authoritative product catalog price recalculation and deterministic spending policy evaluation active.'
        : 'Order creation requires valid Sandbox OAuth credentials.',
    },
    approvalUrl: {
      status: isHealthy ? 'ready' : 'not_ready',
      baseUrl: 'https://www.sandbox.paypal.com',
      pattern: 'https://www.sandbox.paypal.com/checkoutnow?token={orderId}',
      details: isHealthy
        ? 'Sandbox checkout approval URL extracted from PayPal rel="payer-action" / rel="approve" links for external buyer login.'
        : 'Approval URL generation requires valid Sandbox order creation.',
    },
    capture: {
      status: isHealthy ? 'ready' : 'not_ready',
      endpoint: 'POST /v2/checkout/orders/{id}/capture',
      preApprovalGating: true,
      idempotencyProtection: true,
      details: isHealthy
        ? 'Capture strictly checks upstream order status is APPROVED (blocking PAYER_ACTION_REQUIRED) and enforces idempotency with PayPal-Request-Id.'
        : 'Capture endpoint requires valid Sandbox OAuth credentials.',
    },
    payee: getPayeeDiagnosticInfo(),
    storedOrdersCount: ordersStore.size,
  };
}

// ---------------------------------------------------------------------------
// 4. Server-Side Purchase Approval & Order Storage
// ---------------------------------------------------------------------------

export interface StoredPayPalOrder {
  orderId: string;
  purchaseApprovalId: string;
  userId?: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'COMPLETED' | 'VOIDED';
  totalAmount: number;
  currency: string;
  approveUrl: string;
  createdAt: string;
  capturedAt?: string;
  captureId?: string;
  idempotencyKeys: Set<string>;
  payee?: { merchant_id?: string; email_address?: string };
}

// In-memory store for purchase approvals and PayPal orders
let purchaseApprovalsStore: Map<string, PurchaseApproval> = new Map();
let ordersStore: Map<string, StoredPayPalOrder> = new Map();

export function seedInitialApprovals(): void {
  purchaseApprovalsStore.clear();
  ordersStore.clear();
  for (const appr of initialApprovals) {
    purchaseApprovalsStore.set(appr.id, { ...appr });
  }
}

// Initialize on load
seedInitialApprovals();

export function getPurchaseApproval(id: string): PurchaseApproval | undefined {
  return purchaseApprovalsStore.get(id);
}

export function savePurchaseApproval(approval: PurchaseApproval): void {
  purchaseApprovalsStore.set(approval.id, { ...approval });
}

export function getStoredPayPalOrder(orderId: string): StoredPayPalOrder | undefined {
  return ordersStore.get(orderId);
}

export function saveStoredPayPalOrder(order: StoredPayPalOrder): void {
  ordersStore.set(order.orderId, order);
}

export function getAllPurchaseApprovals(): PurchaseApproval[] {
  return Array.from(purchaseApprovalsStore.values());
}

setPurchaseApprovalsProvider(getAllPurchaseApprovals);

export function approvePurchaseRecord(id: string, notes?: string, userId?: string): PurchaseApproval {
  const existing = purchaseApprovalsStore.get(id);
  if (!existing) {
    throw new Error(`Purchase record '${id}' not found.`);
  }

  const authUser = userId || 'usr-jordan-miller';
  if (existing.userId && existing.userId !== authUser) {
    throw new Error(`Unauthorized: User '${authUser}' does not own purchase record '${id}'.`);
  }

  const nowIso = new Date().toISOString();
  const updated: PurchaseApproval = {
    ...existing,
    state: 'APPROVED',
    approvedAt: nowIso,
    approvalTimestamp: nowIso,
    environment: 'SANDBOX',
    paymentStatus: 'PENDING',
    approvalNotes: notes || 'Approved by user.',
    simulationNote: 'Approved. Ready for PayPal Sandbox Checkout creation.',
  };
  purchaseApprovalsStore.set(id, updated);
  return updated;
}

export interface CreateAndApprovePurchaseParams {
  items: Array<{ productId: string; quantity: number }>;
  userId?: string;
  notes?: string;
  currentAvailableCash?: number;
  minimumReserveFloor?: number;
}

/**
 * Creates and persists an approved purchase record in authoritative backend storage.
 * - Recalculates cart total using authoritative product catalog prices
 * - Evaluates spending mandate rules (rejects if BLOCKED)
 * - Generates authoritative backend purchase ID
 * - Persists record in backend store with all required metadata
 */
export function createAndApprovePurchaseRecord(
  params: CreateAndApprovePurchaseParams
): PurchaseApproval {
  if (!params.items || !Array.isArray(params.items) || params.items.length === 0) {
    throw new Error('Cart items array cannot be empty.');
  }

  const authUser = params.userId || 'usr-jordan-miller';

  // 1. Authoritative Catalog validation & price recalculation
  const validatedCartItems: CartItem[] = [];
  let calculatedTotal = 0;

  for (const item of params.items) {
    if (!item.productId || typeof item.productId !== 'string') {
      throw new Error('Each item must specify a valid productId from the authoritative catalog.');
    }

    const catalogProduct = initialProducts.find((p) => p.id === item.productId);
    if (!catalogProduct) {
      throw new Error(`Product '${item.productId}' not found in authoritative product catalog.`);
    }

    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const itemSubtotal = Math.round(catalogProduct.price * qty * 100) / 100;
    calculatedTotal += itemSubtotal;

    validatedCartItems.push({
      product: { ...catalogProduct },
      quantity: qty,
    });
  }

  calculatedTotal = Math.round(calculatedTotal * 100) / 100;
  if (calculatedTotal <= 0) {
    throw new Error('Invalid order amount: Total order amount must be greater than 0.');
  }

  // 2. Spending mandate revalidation
  const mandate = getSpendingMandate();
  const availableCash = typeof params.currentAvailableCash === 'number'
    ? params.currentAvailableCash
    : 14250;
  const reserveFloor = typeof params.minimumReserveFloor === 'number'
    ? params.minimumReserveFloor
    : 6000;

  const policyEval = evaluateSpendingPolicy(validatedCartItems, mandate, availableCash, reserveFloor);
  if (policyEval.status === 'BLOCKED') {
    throw new Error(`Purchase blocked by spending mandate: ${policyEval.summary}`);
  }

  // 3. Generate authoritative backend purchase ID
  const now = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  const purchaseId = `appr-${now}-${randomSuffix}`;
  const nowIso = new Date().toISOString();

  const title = validatedCartItems.map((ci) => `${ci.quantity}× ${ci.product.name}`).join(' + ');

  const approvedPurchase: PurchaseApproval = {
    id: purchaseId,
    title,
    items: validatedCartItems.map((ci) => ({
      productId: ci.product.id,
      name: ci.product.name,
      category: ci.product.category,
      quantity: ci.quantity,
      unitPrice: ci.product.price,
      subtotal: Math.round(ci.product.price * ci.quantity * 100) / 100,
    })),
    totalAmount: calculatedTotal,
    currency: 'USD',
    requestedBy: 'Jordan Miller',
    userId: authUser,
    requestDate: nowIso,
    approvedAt: nowIso,
    approvalTimestamp: nowIso,
    environment: 'SANDBOX',
    paymentStatus: 'PENDING',
    state: 'APPROVED',
    policyStatus: policyEval.status,
    policySummary: policyEval.summary,
    approvalNotes: params.notes || 'Approved by user for PayPal Sandbox Checkout.',
    simulationNote: 'Approved. Ready for PayPal Sandbox Order creation.',
  };

  savePurchaseApproval(approvedPurchase);
  return approvedPurchase;
}

// ---------------------------------------------------------------------------
// 5. Create PayPal Sandbox Order
// ---------------------------------------------------------------------------

export interface CreatePayPalOrderParams {
  purchaseApprovalId: string;
  items?: Array<{
    productId: string;
    quantity: number;
    // Client-supplied prices are strictly ignored and recalculated from catalog
  }>;
  userId?: string;
  returnUrl?: string;
  cancelUrl?: string;
  currentAvailableCash?: number;
  minimumReserveFloor?: number;
}

export interface CreatePayPalOrderResult {
  success: true;
  orderId: string;
  approvalUrl: string;
  status: 'CREATED';
  totalAmount: number;
  currency: 'USD';
  purchaseApprovalId: string;
  payeeConfigured?: boolean;
  payeeType?: 'MERCHANT_ID' | 'EMAIL' | 'DEFAULT_CALLER';
  mode: 'SANDBOX';
}

export async function createPayPalOrder(
  params: CreatePayPalOrderParams,
  customFetch: typeof fetch = fetch
): Promise<CreatePayPalOrderResult> {
  assertSandboxBaseUrl(PAYPAL_SANDBOX_BASE);

  // 1. Validate credentials
  const credentials = getPayPalCredentials();
  if (!credentials) {
    throw new Error(
      'PayPal credentials missing: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be configured in environment secrets.'
    );
  }

  // 2. Validate existing purchase approval record
  if (!params.purchaseApprovalId || typeof params.purchaseApprovalId !== 'string') {
    throw new Error('Missing required parameter: purchaseApprovalId is required.');
  }

  const approval = getPurchaseApproval(params.purchaseApprovalId);
  if (!approval) {
    throw new Error(
      `Purchase record '${params.purchaseApprovalId}' not found. An existing approved purchase record is required before creating a PayPal order.`
    );
  }

  // Ownership verification
  const authUser = params.userId || 'usr-jordan-miller';
  if (approval.userId && approval.userId !== authUser) {
    throw new Error(`Unauthorized: User '${authUser}' does not own purchase record '${approval.id}'.`);
  }

  // Requirement 6: Require an existing approved purchase record
  if (approval.state !== 'APPROVED' && approval.state !== 'SANDBOX_CHECKOUT') {
    throw new Error(
      `Purchase record '${params.purchaseApprovalId}' is not approved (current state: ${approval.state}). Checkout requires an approved purchase record.`
    );
  }

  // Duplicate order creation handled safely
  if (approval.sandboxTransactionId) {
    const existingOrder = getStoredPayPalOrder(approval.sandboxTransactionId);
    if (existingOrder && (existingOrder.status === 'CREATED' || existingOrder.status === 'APPROVED')) {
      return {
        success: true,
        orderId: existingOrder.orderId,
        approvalUrl: existingOrder.approveUrl,
        status: 'CREATED',
        totalAmount: existingOrder.totalAmount,
        currency: 'USD',
        purchaseApprovalId: approval.id,
        mode: 'SANDBOX',
      };
    }
  }

  // 3. Cart & Catalog Validation (Never trust client-supplied prices)
  const itemsSource = params.items !== undefined
    ? params.items
    : (approval.items && Array.isArray(approval.items) ? approval.items : []);

  if (!itemsSource || itemsSource.length === 0) {
    throw new Error('Cart items array cannot be empty.');
  }

  const validatedCartItems: CartItem[] = [];
  let calculatedTotal = 0;

  for (const item of itemsSource) {
    if (!item.productId || typeof item.productId !== 'string') {
      throw new Error('Each item must specify a valid productId from the authoritative catalog.');
    }

    const catalogProduct = initialProducts.find((p) => p.id === item.productId);
    if (!catalogProduct) {
      throw new Error(`Product '${item.productId}' not found in authoritative product catalog.`);
    }

    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    // Authoritative catalog price used exclusively
    const itemSubtotal = Math.round(catalogProduct.price * qty * 100) / 100;
    calculatedTotal += itemSubtotal;

    validatedCartItems.push({
      product: { ...catalogProduct },
      quantity: qty,
    });
  }

  calculatedTotal = Math.round(calculatedTotal * 100) / 100;

  if (calculatedTotal <= 0) {
    throw new Error('Invalid order amount: Total order amount must be greater than 0.');
  }

  // 4. Revalidate spending mandate
  const mandate = getSpendingMandate();
  const availableCash = typeof params.currentAvailableCash === 'number'
    ? params.currentAvailableCash
    : 14250;
  const reserveFloor = typeof params.minimumReserveFloor === 'number'
    ? params.minimumReserveFloor
    : 6000;

  const policyEval = evaluateSpendingPolicy(validatedCartItems, mandate, availableCash, reserveFloor);
  if (policyEval.status === 'BLOCKED') {
    throw new Error(
      `Purchase blocked by spending mandate: ${policyEval.summary}`
    );
  }

  // 5. Obtain OAuth Bearer Token
  const accessToken = await getPayPalAccessToken(customFetch);

  // 6. Build PayPal Order Payload
  const returnUrl = params.returnUrl || 'https://paypilot.sandbox.demo/checkout/success';
  const cancelUrl = params.cancelUrl || 'https://paypilot.sandbox.demo/checkout/cancel';

  const configuredPayee = getPayPalConfiguredPayee();

  const purchaseUnit: Record<string, any> = {
    reference_id: approval.id,
    description: approval.title.substring(0, 127),
    amount: {
      currency_code: 'USD',
      value: calculatedTotal.toFixed(2),
      breakdown: {
        item_total: {
          currency_code: 'USD',
          value: calculatedTotal.toFixed(2),
        },
      },
    },
    items: validatedCartItems.map((ci) => ({
      name: ci.product.name.substring(0, 127),
      unit_amount: {
        currency_code: 'USD',
        value: ci.product.price.toFixed(2),
      },
      quantity: String(ci.quantity),
      category: 'PHYSICAL_GOODS',
    })),
  };

  // Optionally include configured payee (preferring merchant_id over email_address)
  if (configuredPayee) {
    purchaseUnit.payee = configuredPayee;
  }

  const orderPayload = {
    intent: 'CAPTURE',
    purchase_units: [purchaseUnit],
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
          brand_name: 'PayPilot AI',
          locale: 'en-US',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      },
    },
  };

  // 7. Call PayPal Sandbox Orders API
  const response = await customFetch(`${PAYPAL_SANDBOX_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(orderPayload),
  });

  if (!response.ok) {
    let errBody = '';
    try {
      errBody = await response.text();
    } catch {
      errBody = response.statusText;
    }
    throw new Error(`PayPal Order creation failed (HTTP ${response.status}): ${errBody}`);
  }

  const orderData = (await response.json()) as {
    id: string;
    status: string;
    links?: Array<{ href: string; rel: string; method: string }>;
  };

  if (!orderData.id) {
    throw new Error('PayPal Order response did not include a valid order ID.');
  }

  const approveLink =
    orderData.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href ||
    `https://www.sandbox.paypal.com/checkoutnow?token=${orderData.id}`;

  // 8. Store in server order store
  const storedOrder: StoredPayPalOrder = {
    orderId: orderData.id,
    purchaseApprovalId: approval.id,
    userId: authUser,
    status: 'CREATED',
    totalAmount: calculatedTotal,
    currency: 'USD',
    approveUrl: approveLink,
    createdAt: new Date().toISOString(),
    idempotencyKeys: new Set(),
    payee: configuredPayee || undefined,
  };
  saveStoredPayPalOrder(storedOrder);

  // Update approval state to SANDBOX_CHECKOUT (Do NOT mark as captured or paid!)
  approval.state = 'SANDBOX_CHECKOUT';
  approval.paymentStatus = 'ORDER_CREATED';
  approval.sandboxTransactionId = orderData.id;
  approval.simulationNote = `PayPal Sandbox Order ${orderData.id} created. Awaiting buyer authorization before capture.`;
  savePurchaseApproval(approval);

  const payeeInfo = getPayeeDiagnosticInfo();

  return {
    success: true,
    orderId: orderData.id,
    approvalUrl: approveLink,
    status: 'CREATED',
    totalAmount: calculatedTotal,
    currency: 'USD',
    purchaseApprovalId: approval.id,
    payeeConfigured: payeeInfo.configured,
    payeeType: payeeInfo.type,
    mode: 'SANDBOX',
  };
}

// ---------------------------------------------------------------------------
// 6. Capture PayPal Sandbox Order
// ---------------------------------------------------------------------------

export interface CapturePayPalOrderParams {
  orderId: string;
  userId?: string;
  idempotencyKey?: string;
}

export interface CapturePayPalOrderResult {
  success: true;
  orderId: string;
  captureId: string;
  status: 'COMPLETED';
  purchaseApprovalId: string;
  totalAmount: number;
  currency: string;
  alreadyCaptured?: boolean;
  message?: string;
  mode: 'SANDBOX';
}

export async function capturePayPalOrder(
  params: CapturePayPalOrderParams,
  customFetch: typeof fetch = fetch
): Promise<CapturePayPalOrderResult> {
  assertSandboxBaseUrl(PAYPAL_SANDBOX_BASE);

  if (!params.orderId || typeof params.orderId !== 'string') {
    throw new Error('Missing required parameter: orderId is required.');
  }

  // 1. Verify stored order
  const storedOrder = getStoredPayPalOrder(params.orderId);
  if (!storedOrder) {
    throw new Error(`PayPal order '${params.orderId}' not found in order registry.`);
  }

  // 2. Idempotency Check: Already captured?
  if (storedOrder.status === 'COMPLETED' && storedOrder.captureId) {
    return {
      success: true,
      orderId: storedOrder.orderId,
      captureId: storedOrder.captureId,
      status: 'COMPLETED',
      purchaseApprovalId: storedOrder.purchaseApprovalId,
      totalAmount: storedOrder.totalAmount,
      currency: storedOrder.currency,
      alreadyCaptured: true,
      message: 'Order has already been captured.',
      mode: 'SANDBOX',
    };
  }

  // Idempotency check with idempotencyKey
  if (params.idempotencyKey && storedOrder.idempotencyKeys.has(params.idempotencyKey)) {
    if (storedOrder.captureId) {
      return {
        success: true,
        orderId: storedOrder.orderId,
        captureId: storedOrder.captureId,
        status: 'COMPLETED',
        purchaseApprovalId: storedOrder.purchaseApprovalId,
        totalAmount: storedOrder.totalAmount,
        currency: storedOrder.currency,
        alreadyCaptured: true,
        message: 'Duplicate request: Order already captured under this idempotency key.',
        mode: 'SANDBOX',
      };
    }
  }

  // 3. Confirm order belongs to approved purchase and verify ownership
  const approval = getPurchaseApproval(storedOrder.purchaseApprovalId);
  if (!approval) {
    throw new Error(
      `Unauthorized capture: Associated purchase approval '${storedOrder.purchaseApprovalId}' not found.`
    );
  }

  const authUser = params.userId || 'usr-jordan-miller';
  if (storedOrder.userId && storedOrder.userId !== authUser) {
    throw new Error(
      `Unauthorized capture: User '${authUser}' does not own PayPal order '${params.orderId}'.`
    );
  }

  if (approval.userId && approval.userId !== authUser) {
    throw new Error(
      `Unauthorized capture: User '${authUser}' does not own purchase record '${approval.id}'.`
    );
  }

  if (approval.state === 'BLOCKED' || approval.state === 'REJECTED') {
    throw new Error(
      `Unauthorized capture: Associated purchase record is in ${approval.state} state and cannot be captured.`
    );
  }

  // 4. Retrieve OAuth token
  const accessToken = await getPayPalAccessToken(customFetch);

  // 5. Check order status in PayPal Sandbox (Buyer Approval Verification)
  const getOrderRes = await customFetch(
    `${PAYPAL_SANDBOX_BASE}/v2/checkout/orders/${encodeURIComponent(params.orderId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!getOrderRes.ok) {
    let errBody = '';
    try {
      errBody = await getOrderRes.text();
    } catch {
      errBody = getOrderRes.statusText;
    }
    throw new Error(`Failed to verify PayPal order status (HTTP ${getOrderRes.status}): ${errBody}`);
  }

  const orderDetails = (await getOrderRes.json()) as {
    id: string;
    status: string;
    purchase_units?: Array<{
      payments?: {
        captures?: Array<{ id: string; status: string }>;
      };
    }>;
  };

  // If order was voided or cancelled by buyer in PayPal
  if (orderDetails.status === 'VOIDED') {
    storedOrder.status = 'VOIDED';
    saveStoredPayPalOrder(storedOrder);
    approval.state = 'REJECTED';
    approval.rejectionReason = 'Order was cancelled or voided by buyer in PayPal Sandbox.';
    savePurchaseApproval(approval);
    throw new Error('Buyer cancelled checkout: PayPal order has been voided or cancelled by buyer in PayPal Sandbox.');
  }

  // If already completed in PayPal upstream
  if (orderDetails.status === 'COMPLETED') {
    const existingCapture = orderDetails.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = existingCapture?.id || `CAP-${storedOrder.orderId}`;

    storedOrder.status = 'COMPLETED';
    storedOrder.captureId = captureId;
    storedOrder.capturedAt = new Date().toISOString();
    if (params.idempotencyKey) storedOrder.idempotencyKeys.add(params.idempotencyKey);
    saveStoredPayPalOrder(storedOrder);

    approval.state = 'CAPTURED';
    approval.sandboxTransactionId = captureId;
    approval.simulationNote = `PayPal Sandbox Order ${storedOrder.orderId} captured: ${captureId}.`;
    savePurchaseApproval(approval);

    return {
      success: true,
      orderId: storedOrder.orderId,
      captureId,
      status: 'COMPLETED',
      purchaseApprovalId: approval.id,
      totalAmount: storedOrder.totalAmount,
      currency: storedOrder.currency,
      alreadyCaptured: true,
      mode: 'SANDBOX',
    };
  }

  // Requirement 8: Confirm order has completed the required PayPal buyer approval flow
  if (orderDetails.status !== 'APPROVED') {
    throw new Error(
      `Buyer approval required: PayPal order has not completed the buyer approval flow yet (current status: ${orderDetails.status}). Please complete approval in PayPal Sandbox.`
    );
  }

  // 6. Call PayPal Capture API
  const captureHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  if (params.idempotencyKey) {
    captureHeaders['PayPal-Request-Id'] = params.idempotencyKey;
  }

  const captureRes = await customFetch(
    `${PAYPAL_SANDBOX_BASE}/v2/checkout/orders/${encodeURIComponent(params.orderId)}/capture`,
    {
      method: 'POST',
      headers: captureHeaders,
      body: '{}',
    }
  );

  if (!captureRes.ok) {
    let errBody = '';
    try {
      errBody = await captureRes.text();
    } catch {
      errBody = captureRes.statusText;
    }
    throw new Error(`PayPal Order capture failed (HTTP ${captureRes.status}): ${errBody}`);
  }

  const captureData = (await captureRes.json()) as {
    id: string;
    status: string;
    purchase_units?: Array<{
      payments?: {
        captures?: Array<{
          id: string;
          status: string;
          amount?: { currency_code: string; value: string };
        }>;
      };
    }>;
  };

  const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];
  const captureId = capture?.id || `CAP-${captureData.id}`;
  const captureStatus = capture?.status || captureData.status;

  // Requirement 9: Verify the PayPal response and capture status before recording a successful capture
  if (captureStatus !== 'COMPLETED') {
    throw new Error(`PayPal capture did not complete successfully. Received status: ${captureStatus}`);
  }

  // Requirement 9: Store provider IDs and status without storing sensitive payment credentials
  storedOrder.status = 'COMPLETED';
  storedOrder.captureId = captureId;
  storedOrder.capturedAt = new Date().toISOString();
  if (params.idempotencyKey) {
    storedOrder.idempotencyKeys.add(params.idempotencyKey);
  }
  saveStoredPayPalOrder(storedOrder);

  // Update associated purchase approval
  approval.state = 'CAPTURED';
  approval.sandboxTransactionId = captureId;
  approval.simulationNote = `PayPal Sandbox Order ${storedOrder.orderId} captured: ${captureId}. Finalized in Sandbox mode.`;
  savePurchaseApproval(approval);

  return {
    success: true,
    orderId: storedOrder.orderId,
    captureId,
    status: 'COMPLETED',
    purchaseApprovalId: approval.id,
    totalAmount: storedOrder.totalAmount,
    currency: storedOrder.currency,
    mode: 'SANDBOX',
  };
}

/**
 * Checks the status of a PayPal Sandbox Order without capturing.
 */
export async function getPayPalOrderStatus(
  orderId: string,
  userId?: string,
  customFetch: typeof fetch = fetch
): Promise<{
  orderId: string;
  status: string;
  purchaseApprovalId: string;
  totalAmount: number;
  currency: string;
  mode: 'SANDBOX';
}> {
  assertSandboxBaseUrl(PAYPAL_SANDBOX_BASE);
  const storedOrder = getStoredPayPalOrder(orderId);
  if (!storedOrder) {
    throw new Error(`PayPal order '${orderId}' not found in order registry.`);
  }

  const authUser = userId || 'usr-jordan-miller';
  if (storedOrder.userId && storedOrder.userId !== authUser) {
    throw new Error(`Unauthorized: User '${authUser}' does not own order '${orderId}'.`);
  }

  const accessToken = await getPayPalAccessToken(customFetch);
  const res = await customFetch(
    `${PAYPAL_SANDBOX_BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!res.ok) {
    let errBody = '';
    try {
      errBody = await res.text();
    } catch {
      errBody = res.statusText;
    }
    throw new Error(`Failed to check order status (HTTP ${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as { id: string; status: string };

  if (data.status === 'VOIDED' && storedOrder.status !== 'VOIDED') {
    storedOrder.status = 'VOIDED';
    saveStoredPayPalOrder(storedOrder);
    const appr = getPurchaseApproval(storedOrder.purchaseApprovalId);
    if (appr) {
      appr.state = 'REJECTED';
      appr.rejectionReason = 'Order was cancelled by buyer.';
      savePurchaseApproval(appr);
    }
  }

  return {
    orderId: data.id,
    status: data.status,
    purchaseApprovalId: storedOrder.purchaseApprovalId,
    totalAmount: storedOrder.totalAmount,
    currency: storedOrder.currency,
    mode: 'SANDBOX',
  };
}

