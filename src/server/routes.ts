/**
 * Express API Routes for PayPilot AI
 * Exposes server-side endpoints for assistant orchestration, catalog search,
 * policy evaluation, invoice drafting, and financial simulations.
 */

import { Router, type Request, type Response } from 'express';
import {
  processAssistantRequest,
  getGeminiClient,
} from './gemini.ts';
import {
  searchCatalog,
  evaluateCartPolicy,
  prepareInvoiceDraft,
  simulateExpenseImpact,
  getInvoices,
  getSpendingMandate,
  checkActionAuthorization,
} from './tools.ts';
import {
  hasPayPalCredentials,
  PAYPAL_SANDBOX_BASE,
  createPayPalOrder,
  capturePayPalOrder,
  getAllPurchaseApprovals,
  approvePurchaseRecord,
  getPurchaseApproval,
  verifyPayPalSandboxConnectivity,
  getPayPalOrderStatus,
  getPayPalSandboxDiagnostic,
  createAndApprovePurchaseRecord,
  getPayeeDiagnosticInfo,
  seedInitialApprovals,
} from './paypal.ts';
import {
  getAllStoredInvoices,
  getStoredInvoice,
  createPayPalInvoiceDraft,
  sendPayPalInvoice,
  remindPayPalInvoice,
  getPayPalInvoiceStatus,
  verifyAndProcessPayPalWebhook,
  seedInitialInvoicesStore,
} from './paypalInvoicing.ts';

export const apiRouter = Router();

// ---------------------------------------------------------------------------
// Health and Configuration Status
// ---------------------------------------------------------------------------
apiRouter.get('/health', (_req: Request, res: Response) => {
  const hasGemini = Boolean(getGeminiClient());
  const hasPayPal = hasPayPalCredentials();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiConfigured: hasGemini,
    model: hasGemini ? 'gemini-3.8-flash' : 'deterministic-grounded-fallback',
    paypalConfigured: hasPayPal,
    paypalMode: 'SANDBOX',
    sandboxEnforced: true,
    livePaymentsAllowed: false,
    currency: 'USD',
    mode: 'DEMO_MODE',
  });
});

// ---------------------------------------------------------------------------
// AI Assistant Endpoint
// ---------------------------------------------------------------------------
apiRouter.post('/assistant', async (req: Request, res: Response) => {
  try {
    const { message, context } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      res.status(400).json({
        success: false,
        error: 'Missing required field: message must be a non-empty string.',
      });
      return;
    }

    const result = await processAssistantRequest({
      message: message.trim(),
      context,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error in /api/assistant:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while processing assistant request',
    });
  }
});

// ---------------------------------------------------------------------------
// Smart Spend: Catalog Search
// ---------------------------------------------------------------------------
apiRouter.post('/spend/search', (req: Request, res: Response) => {
  try {
    const { query, category, maxPrice } = req.body;
    const results = searchCatalog({
      query: typeof query === 'string' ? query : undefined,
      category: typeof category === 'string' ? category : undefined,
      maxPrice: typeof maxPrice === 'number' ? maxPrice : undefined,
    });
    res.json({ success: true, ...results });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Smart Spend: Policy Evaluation
// ---------------------------------------------------------------------------
apiRouter.post('/spend/evaluate', (req: Request, res: Response) => {
  try {
    const { items, currentAvailableCash, minimumReserveFloor } = req.body;
    if (!items || !Array.isArray(items)) {
      res.status(400).json({ success: false, error: 'Items array is required for policy evaluation.' });
      return;
    }

    const evaluation = evaluateCartPolicy({
      items,
      currentAvailableCash,
      minimumReserveFloor,
    });

    res.json({ success: true, evaluation });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Smart Invoice: Prepare Draft (Deterministic Calculation)
// ---------------------------------------------------------------------------
apiRouter.post('/invoices/prepare-draft', (req: Request, res: Response) => {
  try {
    const {
      clientName,
      clientEmail,
      clientCompany,
      description,
      lineItems,
      totalAmountHint,
      paymentTermsDays,
    } = req.body;

    const result = prepareInvoiceDraft({
      clientName,
      clientEmail,
      clientCompany,
      description,
      lineItems,
      totalAmountHint,
      paymentTermsDays,
    });

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Cashflow: Affordability Simulation
// ---------------------------------------------------------------------------
apiRouter.post('/forecast/simulate', (req: Request, res: Response) => {
  try {
    const { expenseAmount, targetWeekIndex, minimumReserve } = req.body;
    if (typeof expenseAmount !== 'number' || expenseAmount <= 0) {
      res.status(400).json({ success: false, error: 'expenseAmount must be a positive number.' });
      return;
    }

    const result = simulateExpenseImpact({
      expenseAmount,
      targetWeekIndex,
      minimumReserve,
    });

    res.json({ success: true, simulation: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Guard Check: Security Action Boundary Test Endpoint
// ---------------------------------------------------------------------------
apiRouter.post('/security/check-action', (req: Request, res: Response) => {
  const { actionName } = req.body;
  if (!actionName) {
    res.status(400).json({ error: 'Missing actionName' });
    return;
  }
  const check = checkActionAuthorization(String(actionName));
  res.json(check);
});

// ---------------------------------------------------------------------------
// PayPal Sandbox Integration Endpoints
// ---------------------------------------------------------------------------

apiRouter.get('/paypal/config', (_req: Request, res: Response) => {
  const payeeInfo = getPayeeDiagnosticInfo();
  res.json({
    configured: hasPayPalCredentials(),
    mode: 'SANDBOX',
    sandboxBaseUrl: PAYPAL_SANDBOX_BASE,
    livePaymentsAllowed: false,
    currency: 'USD',
    payee: payeeInfo,
    environmentNotice: 'PayPal Sandbox exclusively. Live payments are strictly prohibited in PayPilot AI.',
  });
});

apiRouter.get('/paypal/health', async (_req: Request, res: Response) => {
  try {
    const health = await verifyPayPalSandboxConnectivity();
    res.json(health);
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      configured: hasPayPalCredentials(),
      authenticated: false,
      mode: 'SANDBOX',
      sandboxBaseUrl: PAYPAL_SANDBOX_BASE,
      livePaymentsAllowed: false,
      timestamp: new Date().toISOString(),
      error: error.message || 'Unexpected error while checking PayPal health',
    });
  }
});

apiRouter.get('/paypal/diagnostic', async (_req: Request, res: Response) => {
  try {
    const report = await getPayPalSandboxDiagnostic();
    res.json(report);
  } catch (error: any) {
    res.status(500).json({
      mode: 'SANDBOX',
      sandboxBaseUrl: PAYPAL_SANDBOX_BASE,
      livePaymentsAllowed: false,
      timestamp: new Date().toISOString(),
      error: error.message || 'Failed to generate PayPal Sandbox diagnostic report',
    });
  }
});

apiRouter.get('/paypal/diagnostics', async (req: Request, res: Response) => {
  // Alias for /paypal/diagnostic
  try {
    const report = await getPayPalSandboxDiagnostic();
    res.json(report);
  } catch (error: any) {
    res.status(500).json({
      mode: 'SANDBOX',
      sandboxBaseUrl: PAYPAL_SANDBOX_BASE,
      livePaymentsAllowed: false,
      timestamp: new Date().toISOString(),
      error: error.message || 'Failed to generate PayPal Sandbox diagnostic report',
    });
  }
});

apiRouter.get('/purchases', (_req: Request, res: Response) => {
  const approvals = getAllPurchaseApprovals();
  res.json({ success: true, count: approvals.length, purchases: approvals });
});

apiRouter.get('/purchases/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const purchase = getPurchaseApproval(id);
  if (!purchase) {
    res.status(404).json({
      success: false,
      error: `Purchase record '${id}' not found.`,
    });
    return;
  }
  res.json({ success: true, purchase });
});

apiRouter.post('/purchases/approve-cart', (req: Request, res: Response) => {
  try {
    const { items, notes, currentAvailableCash, minimumReserveFloor } = req.body;
    const userId =
      (req.headers['x-user-id'] as string) ||
      req.body.userId ||
      'usr-jordan-miller';

    const purchase = createAndApprovePurchaseRecord({
      items,
      userId,
      notes,
      currentAvailableCash,
      minimumReserveFloor,
    });

    res.status(201).json({ success: true, purchase });
  } catch (error: any) {
    const status = error.message?.includes('blocked') ? 403 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
});

apiRouter.post('/purchases', (req: Request, res: Response) => {
  try {
    const { items, notes, currentAvailableCash, minimumReserveFloor } = req.body;
    const userId =
      (req.headers['x-user-id'] as string) ||
      req.body.userId ||
      'usr-jordan-miller';

    const purchase = createAndApprovePurchaseRecord({
      items,
      userId,
      notes,
      currentAvailableCash,
      minimumReserveFloor,
    });

    res.status(201).json({ success: true, purchase });
  } catch (error: any) {
    const status = error.message?.includes('blocked') ? 403 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
});

apiRouter.post('/purchases/:id/approve', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId =
      (req.headers['x-user-id'] as string) ||
      req.body.userId ||
      'usr-jordan-miller';
    const updated = approvePurchaseRecord(id, notes, userId);
    res.json({ success: true, purchase: updated });
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 403;
    res.status(status).json({ success: false, error: error.message });
  }
});

apiRouter.post('/paypal/orders', async (req: Request, res: Response) => {
  try {
    const {
      purchaseApprovalId,
      items,
      returnUrl,
      cancelUrl,
      currentAvailableCash,
      minimumReserveFloor,
    } = req.body;

    const userId =
      (req.headers['x-user-id'] as string) ||
      req.body.userId ||
      'usr-jordan-miller';

    const result = await createPayPalOrder({
      purchaseApprovalId,
      items,
      userId,
      returnUrl,
      cancelUrl,
      currentAvailableCash,
      minimumReserveFloor,
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error in POST /api/paypal/orders:', error.message);
    const status = error.message?.includes('missing')
      ? 503
      : error.message?.includes('Unauthorized')
      ? 403
      : error.message?.includes('blocked')
      ? 403
      : error.message?.includes('not found')
      ? 404
      : 400;

    res.status(status).json({
      success: false,
      error: error.message || 'Failed to create PayPal Sandbox order',
      mode: 'SANDBOX',
    });
  }
});

apiRouter.get('/paypal/orders/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const userId =
      (req.headers['x-user-id'] as string) ||
      (req.query.userId as string) ||
      'usr-jordan-miller';

    const result = await getPayPalOrderStatus(orderId, userId);
    res.json({ success: true, order: result });
  } catch (error: any) {
    const status = error.message?.includes('not found')
      ? 404
      : error.message?.includes('Unauthorized')
      ? 403
      : 400;
    res.status(status).json({ success: false, error: error.message });
  }
});

apiRouter.post('/paypal/orders/:orderId/capture', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const userId =
      (req.headers['x-user-id'] as string) ||
      req.body.userId ||
      'usr-jordan-miller';

    const idempotencyKey =
      (req.headers['paypal-request-id'] as string) ||
      (req.headers['x-idempotency-key'] as string) ||
      req.body?.idempotencyKey ||
      `idem-${orderId}`;

    const result = await capturePayPalOrder({
      orderId,
      userId,
      idempotencyKey,
    });

    res.json(result);
  } catch (error: any) {
    console.error(`Error in POST /api/paypal/orders/${req.params.orderId}/capture:`, error.message);
    const status = error.message?.includes('not found')
      ? 404
      : error.message?.includes('Unauthorized')
      ? 403
      : error.message?.includes('approval required')
      ? 428
      : error.message?.includes('cancelled')
      ? 409
      : 400;

    res.status(status).json({
      success: false,
      error: error.message || 'Failed to capture PayPal Sandbox order',
      mode: 'SANDBOX',
    });
  }
});

// ---------------------------------------------------------------------------
// PayPal Sandbox Invoicing API Endpoints
// ---------------------------------------------------------------------------

apiRouter.get('/invoices', (_req: Request, res: Response) => {
  const invoices = getAllStoredInvoices();
  res.json({ success: true, count: invoices.length, invoices });
});

apiRouter.get('/invoices/:id', (req: Request, res: Response) => {
  const invoice = getStoredInvoice(req.params.id);
  if (!invoice) {
    res.status(404).json({ success: false, error: `Invoice '${req.params.id}' not found.` });
    return;
  }
  res.json({ success: true, invoice });
});

apiRouter.post('/paypal/invoices', async (req: Request, res: Response) => {
  try {
    const {
      clientName,
      clientEmail,
      clientCompany,
      description,
      lineItems,
      paymentTermsDays,
      currency,
      taxRate,
    } = req.body;

    const result = await createPayPalInvoiceDraft({
      clientName,
      clientEmail,
      clientCompany,
      description,
      lineItems,
      paymentTermsDays,
      currency,
      taxRate,
      userId: (req.headers['x-user-id'] as string) || 'usr-jordan-miller',
    });

    res.status(201).json({ success: true, invoice: result });
  } catch (error: any) {
    console.error('Error in POST /api/paypal/invoices:', error.message);
    const status = error.message?.includes('missing') ? 503 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
});

apiRouter.post('/paypal/invoices/:id/send', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await sendPayPalInvoice(id);
    res.json({ success: true, invoice: result });
  } catch (error: any) {
    console.error(`Error in POST /api/paypal/invoices/${req.params.id}/send:`, error.message);
    const status = error.message?.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
});

apiRouter.post('/paypal/invoices/:id/remind', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const result = await remindPayPalInvoice(id, note);
    res.json({ success: true, invoice: result });
  } catch (error: any) {
    console.error(`Error in POST /api/paypal/invoices/${req.params.id}/remind:`, error.message);
    const status = error.message?.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
});

apiRouter.get('/paypal/invoices/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getPayPalInvoiceStatus(id);
    res.json({ success: true, ...result });
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------------------------------
// PayPal Webhooks Endpoint (/api/paypal/webhooks)
// ---------------------------------------------------------------------------

apiRouter.post('/paypal/webhooks', async (req: Request, res: Response) => {
  try {
    const headers: Record<string, string | undefined> = {
      'paypal-auth-algo': req.headers['paypal-auth-algo'] as string,
      'paypal-cert-url': req.headers['paypal-cert-url'] as string,
      'paypal-transmission-id': req.headers['paypal-transmission-id'] as string,
      'paypal-transmission-sig': req.headers['paypal-transmission-sig'] as string,
      'paypal-transmission-time': req.headers['paypal-transmission-time'] as string,
    };

    const result = await verifyAndProcessPayPalWebhook(headers, req.body);

    if (!result.verified) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({
      success: true,
      processed: !result.duplicate,
      duplicate: result.duplicate,
      eventId: result.eventId,
      eventType: result.eventType,
    });
  } catch (error: any) {
    console.error('Error processing PayPal webhook:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Reset Demo & Sandbox Data Endpoint (/api/reset-data)
// ---------------------------------------------------------------------------
apiRouter.post('/reset-data', (_req: Request, res: Response) => {
  try {
    seedInitialApprovals();
    seedInitialInvoicesStore();
    res.json({
      success: true,
      message: 'All in-memory demo approvals, PayPal sandbox orders, and invoices reset to initial seed state.',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

