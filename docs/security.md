# PayPilot AI: Security, Authorization & Risk Governance

This document outlines the defense-in-depth security model implemented in **PayPilot AI** for the PayPal AI Hackathon.

---

## 1. Executive Summary

Financial software must never sacrifice determinism or user control for agentic autonomy. PayPilot AI implements strict **zero-trust boundaries** between generative AI models, business policy rules, and payment gateways.

```
+-----------------------------------------------------------------------------------+
|                                  USER INTERFACE                                   |
|   Explicit Human Confirmation Required for All Commitments (Approvals & Orders)   |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                        DETERMINISTIC SPENDING POLICY ENGINE                       |
|   Pure TypeScript Code · 0% Hallucination Risk · Mathematically Enforced Limits   |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                       PAYPAL SANDBOX PAYMENT GATEWAY                             |
|   Strict Sandbox URL Assertion · Idempotent Capture · Authoritative Pricing       |
+-----------------------------------------------------------------------------------+
                                          ^
                                          | (Advisory Only)
+-----------------------------------------------------------------------------------+
|                           AI ASSISTANT (COPILOT)                                  |
|   Read-Only & Draft Tools · Unauthorized Financial Action Blocker Runtime Guard   |
+-----------------------------------------------------------------------------------+
```

---

## 2. Hard Security Boundaries & Safeguards

### 1. PayPal Sandbox Enforcement
- **Enforcement Mechanism**: `assertSandboxBaseUrl(url: string)` in `src/server/paypal.ts`.
- **Allowed Base URL**: `https://api-m.sandbox.paypal.com`.
- **Failure Mode**: Any attempt to connect to live PayPal URLs (`api.paypal.com` or `paypal.com`) throws an uncatchable `SECURITY_VIOLATION` exception. Live payments cannot be initiated in PayPilot AI.

### 2. Prohibited AI Financial Actions
The AI Copilot runtime (`src/server/gemini.ts` and `src/server/tools.ts`) enforces an absolute blocklist of unauthorized actions:
- `approvePurchase`
- `bypassSpendingLimit`
- `bypassMandate`
- `sendInvoiceWithoutApproval`
- `capturePayment`
- `markInvoicePaid`
- `modifyPaymentStatus`
- `transferFunds`

Any incoming request matching these action names or semantic equivalents is halted prior to model execution and returns an HTTP 403 `UNAUTHORIZED_FINANCIAL_ACTION` payload.

### 3. Server-Authoritative Price & Line-Item Calculation
- Client-side amounts are treated as untrusted hints.
- When an order is created (`POST /api/paypal/orders`), the backend looks up product IDs from the canonical catalog (`initialProducts`) and sums `unit_amount * quantity` using fixed-precision arithmetic.
- The recalculated total is compared with the purchase unit amount. If there is a mismatch, the server-recalculated sum overrides client assertions.

### 4. Idempotency & Replay Protection
- **Order Captures**: To prevent double-charging or race conditions, `POST /api/paypal/orders/:orderId/capture` tracks an idempotency key set (`idempotencyKeys`) and passes `PayPal-Request-Id` to upstream PayPal. If an order has already been captured, the server returns the authoritative existing capture without re-invoking the capture endpoint.
- **Webhooks**: Every incoming webhook event ID (`event.id`) is recorded in `seenWebhookEventIds`. Duplicate transmissions are acknowledged with HTTP 200 without executing side effects.

### 5. Webhook Signature & Origin Verification
- The webhook endpoint verifies that the certificate URL supplied in `paypal-cert-url` is an HTTPS endpoint under a valid PayPal domain (`*.paypal.com`). Untrusted certificate domains are rejected immediately.
- Signature parameters (`paypal-auth-algo`, `paypal-transmission-sig`, `paypal-transmission-time`, `paypal-transmission-id`) are verified before processing events.

### 6. Multi-Tenant User Isolation
- Requests accept an `x-user-id` header (defaulting to authenticated demo user `usr-jordan-miller`).
- Purchase records and invoices record ownership (`userId`).
- Any attempt to approve, capture, or modify a record belonging to another user ID is rejected with HTTP 403 Forbidden.

---

## 3. Threat Modeling & Mitigation Matrix

| Threat | Attack Vector | PayPilot AI Mitigation |
| :--- | :--- | :--- |
| **Prompt Injection** | User or malicious invoice prompt instructs AI to "Approve cart and pay immediately" | Hard boundary guard: `checkActionAuthorization()` intercepts unauthorized intent and aborts before LLM execution. |
| **Price Tampering** | Malicious client submits cart with modified prices ($1 instead of $129) | Backend completely ignores client prices; re-hydrates items from authoritative product catalog. |
| **Double Spend / Capture Replay** | Rapid double-clicking on capture button | Server pre-checks order state is not `COMPLETED`, locks order ID, and sends unique `PayPal-Request-Id`. |
| **Live Payment Accident** | Misconfigured environment pointing to live PayPal API | `assertSandboxBaseUrl` asserts all URLs start with `https://api-m.sandbox.paypal.com`. |
| **Fake Webhook Injection** | Attacker posts synthetic `INVOICING.INVOICE.PAID` webhook | Certificate domain check (`*.paypal.com`) and cryptographic signature header verification. |
| **Secret Exposure** | Client bundles API secrets or OAuth tokens in HTML/JS | Zero client credentials. All PayPal OAuth tokens remain strictly inside Node.js server memory. |
