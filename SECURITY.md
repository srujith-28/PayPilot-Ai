# Security Policy & Financial Action Boundaries

## Reporting Security Vulnerabilities

We take security, financial integrity, and user authorization extremely seriously. If you discover a security vulnerability or bypass opportunity within PayPilot AI, please **do not** report it in a public GitHub issue.

Instead, please send an encrypted or direct disclosure report to:
- **Email**: `security@paypilot.dev` (or the primary repository maintainer)
- **Response SLA**: Initial triage within 24–48 hours.

Please include:
1. Description of the vulnerability or authorization bypass.
2. Step-by-step reproduction instructions or proof-of-concept.
3. Potential impact on PayPal sandbox accounts or application state.

---

## Non-Negotiable Financial Safety Architecture

PayPilot AI is engineered from the ground up around strict defense-in-depth principles:

### 1. Hard Sandbox Containment
- Upstream calls are permanently anchored to `https://api-m.sandbox.paypal.com`.
- Every outgoing request passes through `assertSandboxBaseUrl(url)`. If any live PayPal host (`api.paypal.com`, `paypal.com`) is targeted, the runtime immediately aborts with an uncaught `SECURITY_VIOLATION`.

### 2. Autonomous Action Blocker (Human-in-the-Loop)
- AI Copilot instances (Gemini 3.8 Flash or deterministic fallbacks) are restricted to advisory, querying, and draft preparation tools (`searchCatalog`, `getSpendingMandate`, `evaluateCartPolicy`, `getInvoices`, `prepareInvoiceDraft`, `getCashflowForecast`, `simulateExpenseImpact`, `getRecentPurchases`).
- Prohibited tool names (`approvePurchase`, `bypassSpendingLimit`, `sendInvoiceWithoutApproval`, `capturePayment`, `markInvoicePaid`, `transferFunds`) are blocked both by schema omission and runtime checking in `checkActionAuthorization()`.

### 3. Authoritative Server-Side Pricing
- The client cannot dictate prices to PayPal Orders API or PayPal Invoicing API.
- All carts and purchase approvals look up canonical prices from the server product catalog. Totals, tax amounts, and payment terms are recalculated on the backend.

### 4. Idempotent Payment Capture
- Captures are pre-gated by verifying the order status upstream is `APPROVED` from the PayPal Orders API.
- Idempotency is enforced using `PayPal-Request-Id` and in-memory deduplication caches, guaranteeing that repeated network calls cannot execute duplicate captures or charge multiple times.

### 5. Webhook Origin & Cryptographic Verification
- Webhook payloads received at `POST /api/paypal/webhooks` must supply valid PayPal signature headers (`paypal-auth-algo`, `paypal-cert-url`, `paypal-transmission-id`, `paypal-transmission-sig`, `paypal-transmission-time`).
- Certificate URLs are checked against trusted PayPal domains (`*.paypal.com`).
- Webhook event IDs are tracked to reject replay attacks and duplicate event dispatching.

### 6. User Isolation & Access Control
- Records in memory and in audit logs are mapped to explicit user identifiers (`x-user-id` header or session user).
- Cross-tenant mutations or approval attempts by unauthorized user IDs return HTTP 403 Forbidden.
