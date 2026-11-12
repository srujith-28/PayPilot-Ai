/**
 * PayPal Sandbox Integration Unit Tests
 *
 * Covers:
 * 1. Strict live API rejection (Sandbox URL isolation)
 * 2. Missing credentials handling
 * 3. OAuth token retrieval, caching, and expiry handling
 * 4. Authoritative catalog pricing & invalid amount rejection (anti-tampering)
 * 5. Spending mandate enforcement & blocked purchase rejection
 * 6. Successful Sandbox Order creation flow
 * 7. Unauthorized capture & buyer approval verification
 * 8. Idempotency protection & duplicate request safety
 * 9. Upstream PayPal API error handling
 * 10. Successful Sandbox capture and credential-safe storage
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAYPAL_SANDBOX_BASE,
  assertSandboxBaseUrl,
  resetPayPalTokenCache,
  getPayPalAccessToken,
  createPayPalOrder,
  capturePayPalOrder,
  seedInitialApprovals,
  getPurchaseApproval,
  savePurchaseApproval,
  approvePurchaseRecord,
  saveStoredPayPalOrder,
  getStoredPayPalOrder,
  verifyPayPalSandboxConnectivity,
  getPayPalSandboxDiagnostic,
  createAndApprovePurchaseRecord,
  getPayPalConfiguredPayee,
  getPayeeDiagnosticInfo,
} from './paypal.ts';

// ---------------------------------------------------------------------------
// 1. Strict Sandbox Endpoint Isolation Tests
// ---------------------------------------------------------------------------

test('PayPal Security: rejects any live PayPal endpoint strictly', () => {
  assert.doesNotThrow(() => {
    assertSandboxBaseUrl('https://api-m.sandbox.paypal.com');
  });

  assert.throws(
    () => {
      assertSandboxBaseUrl('https://api-m.paypal.com');
    },
    {
      message: /SECURITY_VIOLATION: Live PayPal endpoints are strictly prohibited/,
    }
  );

  assert.throws(
    () => {
      assertSandboxBaseUrl('https://api.paypal.com/v2/checkout/orders');
    },
    {
      message: /SECURITY_VIOLATION/,
    }
  );
});

// ---------------------------------------------------------------------------
// 2. Missing Credentials Tests
// ---------------------------------------------------------------------------

test('PayPal Credentials: throws helpful error when credentials are not configured', async () => {
  const origClientId = process.env.PAYPAL_CLIENT_ID;
  const origClientSecret = process.env.PAYPAL_CLIENT_SECRET;

  try {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    resetPayPalTokenCache();

    await assert.rejects(
      async () => {
        await getPayPalAccessToken();
      },
      {
        message: /PayPal credentials missing: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be configured/,
      }
    );
  } finally {
    if (origClientId) process.env.PAYPAL_CLIENT_ID = origClientId;
    if (origClientSecret) process.env.PAYPAL_CLIENT_SECRET = origClientSecret;
  }
});

// ---------------------------------------------------------------------------
// 3. OAuth Token Retrieval and Caching Tests
// ---------------------------------------------------------------------------

test('PayPal OAuth: obtains and safely caches access token with expiry', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_mock_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_mock_client_secret';
  resetPayPalTokenCache();

  let tokenCalls = 0;
  const mockFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = String(url);
    if (urlStr.includes('/v1/oauth2/token')) {
      tokenCalls++;
      return new Response(
        JSON.stringify({
          access_token: 'mock_sandbox_access_token_xyz',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected URL in mock: ${urlStr}`);
  };

  const token1 = await getPayPalAccessToken(mockFetch as unknown as typeof fetch);
  assert.equal(token1, 'mock_sandbox_access_token_xyz');
  assert.equal(tokenCalls, 1);

  // Calling again immediately should reuse cached token without network request
  const token2 = await getPayPalAccessToken(mockFetch as unknown as typeof fetch);
  assert.equal(token2, 'mock_sandbox_access_token_xyz');
  assert.equal(tokenCalls, 1);
});

// ---------------------------------------------------------------------------
// 4. Authoritative Pricing & Invalid Amounts Validation Tests
// ---------------------------------------------------------------------------

test('PayPal Order Creation: recalculates prices strictly from authoritative catalog', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_mock_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_mock_client_secret';
  resetPayPalTokenCache();
  seedInitialApprovals();

  // Approve appr-001 so it can be checked out
  approvePurchaseRecord('appr-001');

  let orderPayloadReceived: any = null;

  const mockFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = String(url);
    if (urlStr.includes('/v1/oauth2/token')) {
      return new Response(
        JSON.stringify({ access_token: 'mock_token', expires_in: 3600 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr.includes('/v2/checkout/orders')) {
      orderPayloadReceived = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          id: 'MOCK-ORDER-999',
          status: 'CREATED',
          links: [
            { href: 'https://www.sandbox.paypal.com/checkoutnow?token=MOCK-ORDER-999', rel: 'approve', method: 'GET' },
          ],
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected mock URL: ${urlStr}`);
  };

  // Client attempts to pass a tampered price of $1.00 for keyboard (catalog price is $129.00)
  const result = await createPayPalOrder(
    {
      purchaseApprovalId: 'appr-001',
      items: [
        {
          productId: 'prod-keyboard',
          quantity: 2,
        },
      ],
    },
    mockFetch as unknown as typeof fetch
  );

  // Authoritative catalog price ($129.00 * 2 = $258.00) must be used
  assert.equal(result.totalAmount, 258.00);
  assert.equal(result.orderId, 'MOCK-ORDER-999');
  assert.equal(result.status, 'CREATED');

  const unitAmount = orderPayloadReceived.purchase_units[0].items[0].unit_amount.value;
  assert.equal(unitAmount, '129.00');
  const totalAmount = orderPayloadReceived.purchase_units[0].amount.value;
  assert.equal(totalAmount, '258.00');
});

test('PayPal Order Creation: rejects non-existent catalog items and empty carts', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_mock_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_mock_client_secret';
  seedInitialApprovals();
  approvePurchaseRecord('appr-001');

  await assert.rejects(
    async () => {
      await createPayPalOrder({
        purchaseApprovalId: 'appr-001',
        items: [],
      });
    },
    {
      message: /Cart items array cannot be empty/,
    }
  );

  await assert.rejects(
    async () => {
      await createPayPalOrder({
        purchaseApprovalId: 'appr-001',
        items: [{ productId: 'fake-nonexistent-item', quantity: 1 }],
      });
    },
    {
      message: /Product 'fake-nonexistent-item' not found in authoritative product catalog/,
    }
  );
});

// ---------------------------------------------------------------------------
// 5. Spending Mandate & Unapproved Purchase Rejection Tests
// ---------------------------------------------------------------------------

test('PayPal Order Creation: rejects unapproved and blocked purchase records', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_mock_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_mock_client_secret';
  seedInitialApprovals();

  // appr-001 starts in AWAITING_APPROVAL (not yet approved)
  await assert.rejects(
    async () => {
      await createPayPalOrder({
        purchaseApprovalId: 'appr-001',
        items: [{ productId: 'prod-keyboard', quantity: 1 }],
      });
    },
    {
      message: /is not approved \(current state: AWAITING_APPROVAL\)/,
    }
  );

  // appr-002 is BLOCKED
  await assert.rejects(
    async () => {
      await createPayPalOrder({
        purchaseApprovalId: 'appr-002',
        items: [{ productId: 'prod-monitor', quantity: 1 }],
      });
    },
    {
      message: /is not approved \(current state: BLOCKED\)/,
    }
  );
});

test('PayPal Order Creation: rejects cart violating spending mandate', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_mock_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_mock_client_secret';
  seedInitialApprovals();
  approvePurchaseRecord('appr-001');

  // Attempting to buy a restricted item (e.g. prod-briefcase: Luxury Goods)
  await assert.rejects(
    async () => {
      await createPayPalOrder({
        purchaseApprovalId: 'appr-001',
        items: [{ productId: 'prod-briefcase', quantity: 1 }],
      });
    },
    {
      message: /Purchase blocked by spending mandate/,
    }
  );
});

// ---------------------------------------------------------------------------
// 6. Upstream PayPal API Error Handling Tests
// ---------------------------------------------------------------------------

test('PayPal Order Creation: handles upstream PayPal API errors gracefully', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_mock_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_mock_client_secret';
  resetPayPalTokenCache();
  seedInitialApprovals();
  approvePurchaseRecord('appr-001');

  const mockErrorFetch = async (url: RequestInfo | URL): Promise<Response> => {
    const urlStr = String(url);
    if (urlStr.includes('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'mock_token', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (urlStr.includes('/v2/checkout/orders')) {
      return new Response(
        JSON.stringify({
          name: 'UNPROCESSABLE_ENTITY',
          message: 'The requested action could not be performed.',
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected URL: ${urlStr}`);
  };

  await assert.rejects(
    async () => {
      await createPayPalOrder(
        {
          purchaseApprovalId: 'appr-001',
          items: [{ productId: 'prod-keyboard', quantity: 1 }],
        },
        mockErrorFetch as unknown as typeof fetch
      );
    },
    {
      message: /PayPal Order creation failed \(HTTP 422\)/,
    }
  );
});

// ---------------------------------------------------------------------------
// 7. Order Capture: Buyer Approval & Unauthorized Capture Tests
// ---------------------------------------------------------------------------

test('PayPal Capture: requires buyer approval in PayPal before capturing', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_mock_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_mock_client_secret';
  resetPayPalTokenCache();
  seedInitialApprovals();

  // Create an approved purchase and stored order
  approvePurchaseRecord('appr-001');
  saveStoredPayPalOrder({
    orderId: 'MOCK-ORDER-123',
    purchaseApprovalId: 'appr-001',
    status: 'CREATED',
    totalAmount: 129.00,
    currency: 'USD',
    approveUrl: 'https://sandbox.paypal.com/test',
    createdAt: new Date().toISOString(),
    idempotencyKeys: new Set(),
  });

  const mockPendingFetch = async (url: RequestInfo | URL): Promise<Response> => {
    const urlStr = String(url);
    if (urlStr.includes('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'mock_token', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (urlStr.includes('/v2/checkout/orders/MOCK-ORDER-123') && !urlStr.endsWith('/capture')) {
      // Buyer has NOT approved yet (status is still CREATED)
      return new Response(
        JSON.stringify({
          id: 'MOCK-ORDER-123',
          status: 'CREATED',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected URL: ${urlStr}`);
  };

  await assert.rejects(
    async () => {
      await capturePayPalOrder(
        { orderId: 'MOCK-ORDER-123' },
        mockPendingFetch as unknown as typeof fetch
      );
    },
    {
      message: /Buyer approval required: PayPal order has not completed the buyer approval flow yet/,
    }
  );
});

test('PayPal Capture: blocks unauthorized capture when purchase is rejected or missing', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_mock_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_mock_client_secret';
  seedInitialApprovals();

  saveStoredPayPalOrder({
    orderId: 'MOCK-UNAUTH-ORDER',
    purchaseApprovalId: 'non-existent-approval',
    status: 'CREATED',
    totalAmount: 50.00,
    currency: 'USD',
    approveUrl: 'https://sandbox.paypal.com',
    createdAt: new Date().toISOString(),
    idempotencyKeys: new Set(),
  });

  await assert.rejects(
    async () => {
      await capturePayPalOrder({ orderId: 'MOCK-UNAUTH-ORDER' });
    },
    {
      message: /Unauthorized capture: Associated purchase approval 'non-existent-approval' not found/,
    }
  );
});

// ---------------------------------------------------------------------------
// 8. Idempotency & Successful Capture Tests
// ---------------------------------------------------------------------------

test('PayPal Capture: executes successful capture and handles duplicate requests idempotently', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_mock_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_mock_client_secret';
  resetPayPalTokenCache();
  seedInitialApprovals();
  approvePurchaseRecord('appr-001');

  saveStoredPayPalOrder({
    orderId: 'MOCK-SUCCESS-ORDER',
    purchaseApprovalId: 'appr-001',
    status: 'CREATED',
    totalAmount: 199.00,
    currency: 'USD',
    approveUrl: 'https://sandbox.paypal.com/test',
    createdAt: new Date().toISOString(),
    idempotencyKeys: new Set(),
  });

  let captureApiCalled = 0;

  const mockSuccessFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = String(url);
    if (urlStr.includes('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'mock_token', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (urlStr.includes('/v2/checkout/orders/MOCK-SUCCESS-ORDER/capture')) {
      captureApiCalled++;
      return new Response(
        JSON.stringify({
          id: 'MOCK-SUCCESS-ORDER',
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: 'SANDBOX-CAPTURE-777',
                    status: 'COMPLETED',
                    amount: { currency_code: 'USD', value: '199.00' },
                  },
                ],
              },
            },
          ],
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr.includes('/v2/checkout/orders/MOCK-SUCCESS-ORDER')) {
      return new Response(
        JSON.stringify({
          id: 'MOCK-SUCCESS-ORDER',
          status: 'APPROVED', // Buyer approved
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected mock URL: ${urlStr}`);
  };

  // 1. First capture call
  const captureResult = await capturePayPalOrder(
    { orderId: 'MOCK-SUCCESS-ORDER', idempotencyKey: 'idem-key-1001' },
    mockSuccessFetch as unknown as typeof fetch
  );

  assert.equal(captureResult.status, 'COMPLETED');
  assert.equal(captureResult.captureId, 'SANDBOX-CAPTURE-777');
  assert.equal(captureResult.orderId, 'MOCK-SUCCESS-ORDER');
  assert.equal(captureResult.mode, 'SANDBOX');
  assert.equal(captureApiCalled, 1);

  // Verify associated purchase record is updated without storing payment credentials
  const updatedApproval = getPurchaseApproval('appr-001');
  assert.equal(updatedApproval?.state, 'CAPTURED');
  assert.equal(updatedApproval?.sandboxTransactionId, 'SANDBOX-CAPTURE-777');

  // 2. Duplicate request with same idempotency key
  const duplicateResult = await capturePayPalOrder(
    { orderId: 'MOCK-SUCCESS-ORDER', idempotencyKey: 'idem-key-1001' },
    mockSuccessFetch as unknown as typeof fetch
  );

  assert.equal(duplicateResult.status, 'COMPLETED');
  assert.equal(duplicateResult.captureId, 'SANDBOX-CAPTURE-777');
  assert.equal(duplicateResult.alreadyCaptured, true);
  // Upstream capture API was NOT called again
  assert.equal(captureApiCalled, 1);
});

// ---------------------------------------------------------------------------
// 9. PayPal Sandbox Connectivity Health Verification Tests
// ---------------------------------------------------------------------------

test('PayPal Health: reports unconfigured when credentials are not present', async () => {
  const origClientId = process.env.PAYPAL_CLIENT_ID;
  const origClientSecret = process.env.PAYPAL_CLIENT_SECRET;

  try {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    resetPayPalTokenCache();

    const health = await verifyPayPalSandboxConnectivity();
    assert.equal(health.status, 'unconfigured');
    assert.equal(health.configured, false);
    assert.equal(health.authenticated, false);
    assert.equal(health.mode, 'SANDBOX');
    assert.equal(health.livePaymentsAllowed, false);
    assert.match(health.error || '', /credentials missing/);
  } finally {
    if (origClientId) process.env.PAYPAL_CLIENT_ID = origClientId;
    if (origClientSecret) process.env.PAYPAL_CLIENT_SECRET = origClientSecret;
  }
});

test('PayPal Health: reports success and authenticated when token request succeeds', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_sandbox_client_id_123';
  process.env.PAYPAL_CLIENT_SECRET = 'test_sandbox_client_secret_abc';
  resetPayPalTokenCache();

  let calledUrl = '';
  const mockFetch = async (url: RequestInfo | URL): Promise<Response> => {
    calledUrl = String(url);
    if (calledUrl.includes('/v1/oauth2/token')) {
      return new Response(
        JSON.stringify({
          access_token: 'sandbox_access_token_secure_999',
          token_type: 'Bearer',
          expires_in: 32400,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected mock URL: ${calledUrl}`);
  };

  const health = await verifyPayPalSandboxConnectivity(mockFetch as unknown as typeof fetch);
  assert.equal(health.status, 'ok');
  assert.equal(health.configured, true);
  assert.equal(health.authenticated, true);
  assert.equal(health.mode, 'SANDBOX');
  assert.equal(health.livePaymentsAllowed, false);
  assert.equal(health.sandboxBaseUrl, PAYPAL_SANDBOX_BASE);
  assert.equal(calledUrl, `${PAYPAL_SANDBOX_BASE}/v1/oauth2/token`);

  // Crucial: ensure access token is NOT exposed in the health result object
  assert.equal((health as any).access_token, undefined);
  assert.equal((health as any).accessToken, undefined);
});

test('PayPal Health: reports error without leaking secret credentials on auth failure', async () => {
  const secretKey = 'super_secret_sandbox_key_xyz';
  process.env.PAYPAL_CLIENT_ID = 'test_client_id';
  process.env.PAYPAL_CLIENT_SECRET = secretKey;
  resetPayPalTokenCache();

  const mockFailFetch = async (): Promise<Response> => {
    return new Response(
      JSON.stringify({
        error: 'invalid_client',
        error_description: `Client authentication failed for ${secretKey}`,
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const health = await verifyPayPalSandboxConnectivity(mockFailFetch as unknown as typeof fetch);
  assert.equal(health.status, 'error');
  assert.equal(health.configured, true);
  assert.equal(health.authenticated, false);
  assert.equal(health.mode, 'SANDBOX');
  assert.equal(health.livePaymentsAllowed, false);

  // Strictly verify the secret key is NOT present in the error output
  assert.ok(health.error, 'Expected an error message');
  assert.equal(health.error.includes(secretKey), false);
  assert.ok(health.error.includes('***'));
});

// ---------------------------------------------------------------------------
// 10. Required Integration Scenario Tests
// ---------------------------------------------------------------------------

test('PayPal Security: rejects order creation when user does not own purchase record (Invalid purchase ownership)', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_secret';
  seedInitialApprovals();
  approvePurchaseRecord('appr-001');

  // Attempt to create order as an attacker who is not Jordan Miller
  await assert.rejects(
    async () => {
      await createPayPalOrder({
        purchaseApprovalId: 'appr-001',
        userId: 'usr-unauthorized-attacker',
      });
    },
    {
      message: /Unauthorized: User 'usr-unauthorized-attacker' does not own purchase record/,
    }
  );
});

test('PayPal Security: rejects order capture when user does not own order (Attempted unauthorized capture)', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_secret';
  seedInitialApprovals();
  approvePurchaseRecord('appr-001');

  saveStoredPayPalOrder({
    orderId: 'MOCK-OWNER-ORDER',
    purchaseApprovalId: 'appr-001',
    userId: 'usr-jordan-miller',
    status: 'CREATED',
    totalAmount: 328.00,
    currency: 'USD',
    approveUrl: 'https://sandbox.paypal.com/test',
    createdAt: new Date().toISOString(),
    idempotencyKeys: new Set(),
  });

  // Attempt to capture as different user
  await assert.rejects(
    async () => {
      await capturePayPalOrder({
        orderId: 'MOCK-OWNER-ORDER',
        userId: 'usr-attacker-999',
      });
    },
    {
      message: /Unauthorized capture: User 'usr-attacker-999' does not own PayPal order/,
    }
  );
});

test('PayPal Capture: safely handles buyer cancellation (Buyer cancellation flow)', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_secret';
  resetPayPalTokenCache();
  seedInitialApprovals();
  approvePurchaseRecord('appr-001');

  saveStoredPayPalOrder({
    orderId: 'MOCK-CANCELLED-ORDER',
    purchaseApprovalId: 'appr-001',
    userId: 'usr-jordan-miller',
    status: 'CREATED',
    totalAmount: 328.00,
    currency: 'USD',
    approveUrl: 'https://sandbox.paypal.com/cancel',
    createdAt: new Date().toISOString(),
    idempotencyKeys: new Set(),
  });

  const mockCancelledFetch = async (url: RequestInfo | URL): Promise<Response> => {
    const urlStr = String(url);
    if (urlStr.includes('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'mock_token', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (urlStr.includes('/v2/checkout/orders/MOCK-CANCELLED-ORDER')) {
      return new Response(
        JSON.stringify({
          id: 'MOCK-CANCELLED-ORDER',
          status: 'VOIDED', // Order cancelled/voided in PayPal
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected mock URL: ${urlStr}`);
  };

  await assert.rejects(
    async () => {
      await capturePayPalOrder(
        { orderId: 'MOCK-CANCELLED-ORDER', userId: 'usr-jordan-miller' },
        mockCancelledFetch as unknown as typeof fetch
      );
    },
    {
      message: /Buyer cancelled checkout: PayPal order has been voided or cancelled by buyer/,
    }
  );

  // Stored order should be updated to VOIDED and purchase marked REJECTED
  const storedOrder = getStoredPayPalOrder('MOCK-CANCELLED-ORDER');
  assert.equal(storedOrder?.status, 'VOIDED');
  const approval = getPurchaseApproval('appr-001');
  assert.equal(approval?.state, 'REJECTED');
});

test('PayPal Capture: handles failed capture status from PayPal API (Failed capture flow)', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_secret';
  resetPayPalTokenCache();
  seedInitialApprovals();
  approvePurchaseRecord('appr-001');

  saveStoredPayPalOrder({
    orderId: 'MOCK-FAILING-CAPTURE-ORDER',
    purchaseApprovalId: 'appr-001',
    userId: 'usr-jordan-miller',
    status: 'CREATED',
    totalAmount: 328.00,
    currency: 'USD',
    approveUrl: 'https://sandbox.paypal.com/test',
    createdAt: new Date().toISOString(),
    idempotencyKeys: new Set(),
  });

  const mockFailCaptureFetch = async (url: RequestInfo | URL): Promise<Response> => {
    const urlStr = String(url);
    if (urlStr.includes('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'mock_token', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (urlStr.includes('/v2/checkout/orders/MOCK-FAILING-CAPTURE-ORDER/capture')) {
      return new Response(
        JSON.stringify({
          id: 'MOCK-FAILING-CAPTURE-ORDER',
          status: 'FAILED', // Capture failed
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: 'CAP-FAILED-123',
                    status: 'FAILED',
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr.includes('/v2/checkout/orders/MOCK-FAILING-CAPTURE-ORDER')) {
      return new Response(
        JSON.stringify({
          id: 'MOCK-FAILING-CAPTURE-ORDER',
          status: 'APPROVED',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected mock URL: ${urlStr}`);
  };

  await assert.rejects(
    async () => {
      await capturePayPalOrder(
        { orderId: 'MOCK-FAILING-CAPTURE-ORDER', userId: 'usr-jordan-miller' },
        mockFailCaptureFetch as unknown as typeof fetch
      );
    },
    {
      message: /PayPal capture.*Received status: FAILED/,
    }
  );

  // Stored order should NOT be marked completed
  const storedOrder = getStoredPayPalOrder('MOCK-FAILING-CAPTURE-ORDER');
  assert.notEqual(storedOrder?.status, 'COMPLETED');
});

test('PayPal Order Creation: accepts approved purchase ID without client items and recalculates from authoritative catalog', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_secret';
  resetPayPalTokenCache();
  seedInitialApprovals();
  approvePurchaseRecord('appr-001');

  let orderPayloadCreated: any = null;
  const mockFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = String(url);
    if (urlStr.includes('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'mock_token', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (urlStr.includes('/v2/checkout/orders')) {
      orderPayloadCreated = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          id: 'MOCK-ORDER-AUTHORITATIVE',
          status: 'CREATED',
          links: [
            { href: 'https://www.sandbox.paypal.com/checkoutnow?token=MOCK-ORDER-AUTHORITATIVE', rel: 'approve', method: 'GET' },
          ],
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected mock URL: ${urlStr}`);
  };

  // Only pass purchaseApprovalId, NO items array provided
  const result = await createPayPalOrder(
    { purchaseApprovalId: 'appr-001' },
    mockFetch as unknown as typeof fetch
  );

  assert.equal(result.success, true);
  assert.equal(result.orderId, 'MOCK-ORDER-AUTHORITATIVE');
  // 1x Chair ($199.00) + 1x Keyboard ($129.00) = $328.00
  assert.equal(result.totalAmount, 328.00);
  assert.equal(result.currency, 'USD');
  assert.equal(result.status, 'CREATED');

  assert.equal(orderPayloadCreated.purchase_units[0].items.length, 2);
  assert.equal(orderPayloadCreated.purchase_units[0].amount.value, '328.00');
  assert.equal(orderPayloadCreated.intent, 'CAPTURE');
});

// ---------------------------------------------------------------------------
// 11. PayPal Sandbox Checkout Diagnostic Report Tests
// ---------------------------------------------------------------------------

test('PayPal Diagnostic: generates comprehensive sandbox status report for all 4 components', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_diag_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_diag_secret';
  resetPayPalTokenCache();

  const mockDiagFetch = async (url: RequestInfo | URL): Promise<Response> => {
    const urlStr = String(url);
    if (urlStr.includes('/v1/oauth2/token')) {
      return new Response(
        JSON.stringify({
          access_token: 'diag_token_123',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected URL in mock: ${urlStr}`);
  };

  const report = await getPayPalSandboxDiagnostic(mockDiagFetch as unknown as typeof fetch);

  assert.equal(report.mode, 'SANDBOX');
  assert.equal(report.sandboxBaseUrl, 'https://api-m.sandbox.paypal.com');
  assert.equal(report.livePaymentsAllowed, false);

  // 1. OAuth authentication status
  assert.equal(report.oauth.status, 'ok');
  assert.equal(report.oauth.authenticated, true);
  assert.equal(report.oauth.tokenType, 'Bearer');

  // 2. Order creation status
  assert.equal(report.orderCreation.status, 'ready');
  assert.equal(report.orderCreation.authoritativeRecalculation, true);
  assert.equal(report.orderCreation.mandateEnforcement, true);

  // 3. Approval URL availability
  assert.equal(report.approvalUrl.status, 'ready');
  assert.equal(report.approvalUrl.baseUrl, 'https://www.sandbox.paypal.com');

  // 4. Capture endpoint status
  assert.equal(report.capture.status, 'ready');
  assert.equal(report.capture.preApprovalGating, true);
  assert.equal(report.capture.idempotencyProtection, true);
});

test('PayPal Diagnostic: reports unconfigured and not_ready when credentials missing', async () => {
  const origClientId = process.env.PAYPAL_CLIENT_ID;
  const origClientSecret = process.env.PAYPAL_CLIENT_SECRET;

  try {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    resetPayPalTokenCache();

    const report = await getPayPalSandboxDiagnostic();

    assert.equal(report.mode, 'SANDBOX');
    assert.equal(report.oauth.status, 'unconfigured');
    assert.equal(report.oauth.authenticated, false);
    assert.equal(report.orderCreation.status, 'not_ready');
    assert.equal(report.approvalUrl.status, 'not_ready');
    assert.equal(report.capture.status, 'not_ready');
  } finally {
    if (origClientId) process.env.PAYPAL_CLIENT_ID = origClientId;
    if (origClientSecret) process.env.PAYPAL_CLIENT_SECRET = origClientSecret;
  }
});

// ---------------------------------------------------------------------------
// 12. Authoritative Backend Purchase Record Persistence & Synchronization Tests
// ---------------------------------------------------------------------------

test('Purchase Synchronization: createAndApprovePurchaseRecord recalculates catalog total and persists in backend store', () => {
  seedInitialApprovals();

  // In initialProducts catalog:
  // prod-chair = ErgoComfort Office Chair ($199.00)
  // prod-keyboard = Apex Wireless Mechanical Keyboard ($129.00)
  const approved = createAndApprovePurchaseRecord({
    items: [
      { productId: 'prod-chair', quantity: 1 },
      { productId: 'prod-keyboard', quantity: 2 },
    ],
    userId: 'usr-jordan-miller',
    notes: 'Approved via modal test',
    currentAvailableCash: 14250,
    minimumReserveFloor: 6000,
  });

  // Verify backend generated purchase ID format
  assert.ok(approved.id.startsWith('appr-'));
  assert.equal(approved.userId, 'usr-jordan-miller');
  assert.equal(approved.currency, 'USD');
  // $199.00 + 2 * $129.00 ($258.00) = $457.00
  assert.equal(approved.totalAmount, 457.00);
  assert.equal(approved.state, 'APPROVED');
  assert.equal(approved.policyStatus, 'PASS');
  assert.equal(approved.environment, 'SANDBOX');
  assert.equal(approved.paymentStatus, 'PENDING');
  assert.ok(approved.approvedAt);
  assert.ok(approved.approvalTimestamp);
  assert.equal(approved.items.length, 2);
  assert.equal(approved.items[0].unitPrice, 199.00);
  assert.equal(approved.items[1].unitPrice, 129.00);
  assert.equal(approved.items[1].quantity, 2);
  assert.equal(approved.items[1].subtotal, 258.00);

  // Verify exact retrieval from authoritative backend store
  const retrieved = getPurchaseApproval(approved.id);
  assert.ok(retrieved, 'Persisted purchase must be retrievable by exact ID');
  assert.equal(retrieved?.id, approved.id);
  assert.equal(retrieved?.totalAmount, 457.00);
  assert.equal(retrieved?.state, 'APPROVED');
  assert.equal(retrieved?.paymentStatus, 'PENDING');
});

test('Purchase Synchronization: createAndApprovePurchaseRecord rejects blocked purchase (policy mandate violation)', () => {
  seedInitialApprovals();

  // prod-briefcase = Designer Italian Leather Briefcase ($340.00) in Luxury Goods category (unauthorized)
  assert.throws(
    () => {
      createAndApprovePurchaseRecord({
        items: [{ productId: 'prod-briefcase', quantity: 1 }],
        userId: 'usr-jordan-miller',
      });
    },
    {
      message: /Purchase blocked by spending mandate/,
    }
  );
});

test('Purchase Synchronization: createPayPalOrder fails cleanly if purchase record does not exist', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_secret';
  resetPayPalTokenCache();
  seedInitialApprovals();

  await assert.rejects(
    async () => {
      await createPayPalOrder({
        purchaseApprovalId: 'appr-non-existent-id-12345',
      });
    },
    {
      message: /Purchase record 'appr-non-existent-id-12345' not found/,
    }
  );
});

test('Purchase Synchronization: createPayPalOrder fails if purchase record is not approved', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_secret';
  resetPayPalTokenCache();
  seedInitialApprovals();

  // appr-002 is in 'AWAITING_APPROVAL' state
  await assert.rejects(
    async () => {
      await createPayPalOrder({
        purchaseApprovalId: 'appr-002',
      });
    },
    {
      message: /Purchase record 'appr-002' is not approved/,
    }
  );
});

test('Purchase Synchronization: createPayPalOrder rejects unauthorized user mismatch', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_secret';
  resetPayPalTokenCache();
  seedInitialApprovals();
  approvePurchaseRecord('appr-001');

  await assert.rejects(
    async () => {
      await createPayPalOrder({
        purchaseApprovalId: 'appr-001',
        userId: 'usr-unauthorized-hacker',
      });
    },
    {
      message: /Unauthorized: User 'usr-unauthorized-hacker' does not own purchase record/,
    }
  );
});

test('Purchase Synchronization: createPayPalOrder succeeds with persisted purchase and prevents duplicate orders', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_secret';
  resetPayPalTokenCache();
  seedInitialApprovals();

  // 1. Create and persist approved purchase
  const approved = createAndApprovePurchaseRecord({
    items: [{ productId: 'prod-keyboard', quantity: 1 }],
    userId: 'usr-jordan-miller',
  });

  let postOrderCount = 0;
  const mockFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = String(url);
    if (urlStr.includes('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'mock_token', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (urlStr.includes('/v2/checkout/orders')) {
      postOrderCount++;
      return new Response(
        JSON.stringify({
          id: 'PAYPAL-SANDBOX-ORDER-SYNC-TEST',
          status: 'CREATED',
          links: [
            {
              href: 'https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-SANDBOX-ORDER-SYNC-TEST',
              rel: 'approve',
              method: 'GET',
            },
          ],
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected mock URL: ${urlStr}`);
  };

  // 2. First order creation
  const orderRes1 = await createPayPalOrder(
    { purchaseApprovalId: approved.id, userId: 'usr-jordan-miller' },
    mockFetch as unknown as typeof fetch
  );

  assert.equal(orderRes1.success, true);
  assert.equal(orderRes1.orderId, 'PAYPAL-SANDBOX-ORDER-SYNC-TEST');
  assert.equal(postOrderCount, 1);

  // Check that purchase state is updated
  const updatedAppr = getPurchaseApproval(approved.id);
  assert.equal(updatedAppr?.state, 'SANDBOX_CHECKOUT');
  assert.equal(updatedAppr?.paymentStatus, 'ORDER_CREATED');
  assert.equal(updatedAppr?.sandboxTransactionId, 'PAYPAL-SANDBOX-ORDER-SYNC-TEST');

  // 3. Second order creation with SAME approved purchase ID: safe duplicate return
  const orderRes2 = await createPayPalOrder(
    { purchaseApprovalId: approved.id, userId: 'usr-jordan-miller' },
    mockFetch as unknown as typeof fetch
  );

  assert.equal(orderRes2.success, true);
  assert.equal(orderRes2.orderId, 'PAYPAL-SANDBOX-ORDER-SYNC-TEST');
  // Must NOT make an additional PayPal API order creation call
  assert.equal(postOrderCount, 1, 'Duplicate request must safely return existing active order without re-calling PayPal API');
});

// ---------------------------------------------------------------------------
// 13. Optional Payee Routing & USD Consistency Tests
// ---------------------------------------------------------------------------

test('PayPal Payee Configuration: prefers PAYPAL_MERCHANT_ID over PAYPAL_PAYEE_EMAIL when both are configured', () => {
  const origMerchantId = process.env.PAYPAL_MERCHANT_ID;
  const origPayeeEmail = process.env.PAYPAL_PAYEE_EMAIL;

  try {
    process.env.PAYPAL_MERCHANT_ID = 'SANDBOX_MERCHANT_9988';
    process.env.PAYPAL_PAYEE_EMAIL = 'merchant_secondary@business.example.com';

    const payee = getPayPalConfiguredPayee();
    assert.deepEqual(payee, { merchant_id: 'SANDBOX_MERCHANT_9988' });

    const diag = getPayeeDiagnosticInfo();
    assert.equal(diag.configured, true);
    assert.equal(diag.type, 'MERCHANT_ID');
    assert.ok(diag.maskedIdentifier?.includes('9988'));
    assert.ok(diag.details.includes('Sandbox seller merchant ID'));
  } finally {
    if (origMerchantId !== undefined) {
      process.env.PAYPAL_MERCHANT_ID = origMerchantId;
    } else {
      delete process.env.PAYPAL_MERCHANT_ID;
    }
    if (origPayeeEmail !== undefined) {
      process.env.PAYPAL_PAYEE_EMAIL = origPayeeEmail;
    } else {
      delete process.env.PAYPAL_PAYEE_EMAIL;
    }
  }
});

test('PayPal Payee Configuration: uses PAYPAL_PAYEE_EMAIL when PAYPAL_MERCHANT_ID is unset', () => {
  const origMerchantId = process.env.PAYPAL_MERCHANT_ID;
  const origPayeeEmail = process.env.PAYPAL_PAYEE_EMAIL;

  try {
    delete process.env.PAYPAL_MERCHANT_ID;
    process.env.PAYPAL_PAYEE_EMAIL = 'seller_test@business.example.com';

    const payee = getPayPalConfiguredPayee();
    assert.deepEqual(payee, { email_address: 'seller_test@business.example.com' });

    const diag = getPayeeDiagnosticInfo();
    assert.equal(diag.configured, true);
    assert.equal(diag.type, 'EMAIL');
    assert.ok(diag.maskedIdentifier?.includes('@business.example.com'));
    assert.ok(diag.details.includes('Sandbox seller email'));
  } finally {
    if (origMerchantId !== undefined) {
      process.env.PAYPAL_MERCHANT_ID = origMerchantId;
    } else {
      delete process.env.PAYPAL_MERCHANT_ID;
    }
    if (origPayeeEmail !== undefined) {
      process.env.PAYPAL_PAYEE_EMAIL = origPayeeEmail;
    } else {
      delete process.env.PAYPAL_PAYEE_EMAIL;
    }
  }
});

test('PayPal Payee Configuration: returns null and DEFAULT_CALLER when neither is configured', () => {
  const origMerchantId = process.env.PAYPAL_MERCHANT_ID;
  const origPayeeEmail = process.env.PAYPAL_PAYEE_EMAIL;

  try {
    delete process.env.PAYPAL_MERCHANT_ID;
    delete process.env.PAYPAL_PAYEE_EMAIL;

    const payee = getPayPalConfiguredPayee();
    assert.equal(payee, null);

    const diag = getPayeeDiagnosticInfo();
    assert.equal(diag.configured, false);
    assert.equal(diag.type, 'DEFAULT_CALLER');
    assert.ok(diag.details.includes('PayPal Sandbox defaults to the merchant account owning the API credentials'));
  } finally {
    if (origMerchantId !== undefined) {
      process.env.PAYPAL_MERCHANT_ID = origMerchantId;
    } else {
      delete process.env.PAYPAL_MERCHANT_ID;
    }
    if (origPayeeEmail !== undefined) {
      process.env.PAYPAL_PAYEE_EMAIL = origPayeeEmail;
    } else {
      delete process.env.PAYPAL_PAYEE_EMAIL;
    }
  }
});

test('PayPal Payee Order Creation: injects payee.merchant_id into purchase_units[0] when PAYPAL_MERCHANT_ID is configured', async () => {
  const origMerchantId = process.env.PAYPAL_MERCHANT_ID;
  const origPayeeEmail = process.env.PAYPAL_PAYEE_EMAIL;

  try {
    process.env.PAYPAL_CLIENT_ID = 'test_client_id';
    process.env.PAYPAL_CLIENT_SECRET = 'test_secret';
    process.env.PAYPAL_MERCHANT_ID = '2WA3G7MXF3ZCG';
    delete process.env.PAYPAL_PAYEE_EMAIL;

    resetPayPalTokenCache();
    seedInitialApprovals();

    const approved = createAndApprovePurchaseRecord({
      items: [{ productId: 'prod-keyboard', quantity: 1 }],
      userId: 'usr-jordan-miller',
    });

    let capturedPayload: any = null;
    const mockFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlStr = String(url);
      if (urlStr.includes('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'mock_token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/v2/checkout/orders')) {
        capturedPayload = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'PAYPAL-ORDER-PAYEE-MERCHANT',
            status: 'CREATED',
            links: [
              {
                href: 'https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-PAYEE-MERCHANT',
                rel: 'approve',
                method: 'GET',
              },
            ],
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected mock URL: ${urlStr}`);
    };

    const res = await createPayPalOrder(
      { purchaseApprovalId: approved.id, userId: 'usr-jordan-miller' },
      mockFetch as unknown as typeof fetch
    );

    assert.equal(res.success, true);
    assert.equal(res.payeeConfigured, true);
    assert.equal(res.payeeType, 'MERCHANT_ID');
    assert.ok(capturedPayload, 'Payload must be sent to PayPal Orders API');
    assert.deepEqual(capturedPayload.purchase_units[0].payee, { merchant_id: '2WA3G7MXF3ZCG' });

    // Verify stored order retains payee info
    const stored = getStoredPayPalOrder('PAYPAL-ORDER-PAYEE-MERCHANT');
    assert.deepEqual(stored?.payee, { merchant_id: '2WA3G7MXF3ZCG' });
  } finally {
    if (origMerchantId !== undefined) {
      process.env.PAYPAL_MERCHANT_ID = origMerchantId;
    } else {
      delete process.env.PAYPAL_MERCHANT_ID;
    }
    if (origPayeeEmail !== undefined) {
      process.env.PAYPAL_PAYEE_EMAIL = origPayeeEmail;
    } else {
      delete process.env.PAYPAL_PAYEE_EMAIL;
    }
  }
});

test('PayPal Payee Order Creation: injects payee.email_address into purchase_units[0] when PAYPAL_PAYEE_EMAIL is configured', async () => {
  const origMerchantId = process.env.PAYPAL_MERCHANT_ID;
  const origPayeeEmail = process.env.PAYPAL_PAYEE_EMAIL;

  try {
    process.env.PAYPAL_CLIENT_ID = 'test_client_id';
    process.env.PAYPAL_CLIENT_SECRET = 'test_secret';
    delete process.env.PAYPAL_MERCHANT_ID;
    process.env.PAYPAL_PAYEE_EMAIL = 'merchant_direct@business.example.com';

    resetPayPalTokenCache();
    seedInitialApprovals();

    const approved = createAndApprovePurchaseRecord({
      items: [{ productId: 'prod-keyboard', quantity: 1 }],
      userId: 'usr-jordan-miller',
    });

    let capturedPayload: any = null;
    const mockFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlStr = String(url);
      if (urlStr.includes('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'mock_token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/v2/checkout/orders')) {
        capturedPayload = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'PAYPAL-ORDER-PAYEE-EMAIL',
            status: 'CREATED',
            links: [
              {
                href: 'https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-PAYEE-EMAIL',
                rel: 'approve',
                method: 'GET',
              },
            ],
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected mock URL: ${urlStr}`);
    };

    const res = await createPayPalOrder(
      { purchaseApprovalId: approved.id, userId: 'usr-jordan-miller' },
      mockFetch as unknown as typeof fetch
    );

    assert.equal(res.success, true);
    assert.equal(res.payeeConfigured, true);
    assert.equal(res.payeeType, 'EMAIL');
    assert.ok(capturedPayload, 'Payload must be sent to PayPal Orders API');
    assert.deepEqual(capturedPayload.purchase_units[0].payee, { email_address: 'merchant_direct@business.example.com' });

    // Verify stored order retains payee info
    const stored = getStoredPayPalOrder('PAYPAL-ORDER-PAYEE-EMAIL');
    assert.deepEqual(stored?.payee, { email_address: 'merchant_direct@business.example.com' });
  } finally {
    if (origMerchantId !== undefined) {
      process.env.PAYPAL_MERCHANT_ID = origMerchantId;
    } else {
      delete process.env.PAYPAL_MERCHANT_ID;
    }
    if (origPayeeEmail !== undefined) {
      process.env.PAYPAL_PAYEE_EMAIL = origPayeeEmail;
    } else {
      delete process.env.PAYPAL_PAYEE_EMAIL;
    }
  }
});

test('PayPal Payee Order Creation: omits payee when neither is configured, preserving default caller payee', async () => {
  const origMerchantId = process.env.PAYPAL_MERCHANT_ID;
  const origPayeeEmail = process.env.PAYPAL_PAYEE_EMAIL;

  try {
    process.env.PAYPAL_CLIENT_ID = 'test_client_id';
    process.env.PAYPAL_CLIENT_SECRET = 'test_secret';
    delete process.env.PAYPAL_MERCHANT_ID;
    delete process.env.PAYPAL_PAYEE_EMAIL;

    resetPayPalTokenCache();
    seedInitialApprovals();

    const approved = createAndApprovePurchaseRecord({
      items: [{ productId: 'prod-keyboard', quantity: 1 }],
      userId: 'usr-jordan-miller',
    });

    let capturedPayload: any = null;
    const mockFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlStr = String(url);
      if (urlStr.includes('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'mock_token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/v2/checkout/orders')) {
        capturedPayload = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'PAYPAL-ORDER-NO-PAYEE',
            status: 'CREATED',
            links: [
              {
                href: 'https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-NO-PAYEE',
                rel: 'approve',
                method: 'GET',
              },
            ],
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected mock URL: ${urlStr}`);
    };

    const res = await createPayPalOrder(
      { purchaseApprovalId: approved.id, userId: 'usr-jordan-miller' },
      mockFetch as unknown as typeof fetch
    );

    assert.equal(res.success, true);
    assert.equal(res.payeeConfigured, false);
    assert.equal(res.payeeType, 'DEFAULT_CALLER');
    assert.ok(capturedPayload, 'Payload must be sent to PayPal Orders API');
    assert.equal(capturedPayload.purchase_units[0].payee, undefined);

    const stored = getStoredPayPalOrder('PAYPAL-ORDER-NO-PAYEE');
    assert.equal(stored?.payee, undefined);
  } finally {
    if (origMerchantId !== undefined) {
      process.env.PAYPAL_MERCHANT_ID = origMerchantId;
    } else {
      delete process.env.PAYPAL_MERCHANT_ID;
    }
    if (origPayeeEmail !== undefined) {
      process.env.PAYPAL_PAYEE_EMAIL = origPayeeEmail;
    } else {
      delete process.env.PAYPAL_PAYEE_EMAIL;
    }
  }
});

test('PayPal Currency Consistency: enforces USD strictly across catalog, cart recalculations, purchase units, and items', async () => {
  process.env.PAYPAL_CLIENT_ID = 'test_client_id';
  process.env.PAYPAL_CLIENT_SECRET = 'test_secret';
  resetPayPalTokenCache();
  seedInitialApprovals();

  // Multi-item cart: Keyboard ($129.00) + Headphones ($179.00) = $308.00 USD
  const approved = createAndApprovePurchaseRecord({
    items: [
      { productId: 'prod-keyboard', quantity: 1 },
      { productId: 'prod-headphones', quantity: 1 },
    ],
    userId: 'usr-jordan-miller',
  });

  assert.equal(approved.currency, 'USD');
  assert.equal(approved.totalAmount, 308.00);

  let capturedPayload: any = null;
  const mockFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = String(url);
    if (urlStr.includes('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'mock_token', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (urlStr.includes('/v2/checkout/orders')) {
      capturedPayload = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          id: 'PAYPAL-ORDER-USD-TEST',
          status: 'CREATED',
          links: [
            {
              href: 'https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-USD-TEST',
              rel: 'approve',
              method: 'GET',
            },
          ],
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected mock URL: ${urlStr}`);
  };

  const orderResult = await createPayPalOrder(
    { purchaseApprovalId: approved.id, userId: 'usr-jordan-miller' },
    mockFetch as unknown as typeof fetch
  );

  assert.equal(orderResult.currency, 'USD');
  assert.equal(orderResult.totalAmount, 308.00);

  // Check currency_code on purchase unit amount
  assert.equal(capturedPayload.purchase_units[0].amount.currency_code, 'USD');
  assert.equal(capturedPayload.purchase_units[0].amount.value, '308.00');

  // Check currency_code on amount breakdown
  assert.equal(capturedPayload.purchase_units[0].amount.breakdown.item_total.currency_code, 'USD');
  assert.equal(capturedPayload.purchase_units[0].amount.breakdown.item_total.value, '308.00');

  // Check currency_code on each item in the purchase unit
  for (const item of capturedPayload.purchase_units[0].items) {
    assert.equal(item.unit_amount.currency_code, 'USD');
  }
});




