# PayPilot AI

> **Your Money In. Your Money Out. One Intelligent Financial Copilot.**  
> *Autonomous financial intelligence with deterministic guardrails, real PayPal Sandbox Orders & Invoicing, and human-in-the-loop authorization.*

[![Node.js](https://img.shields.io/badge/Node.js-v20+-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![PayPal Sandbox](https://img.shields.io/badge/PayPal-Sandbox%20API-003087.svg)](https://developer.paypal.com/)
[![Gemini](https://img.shields.io/badge/Google%20Gen%20AI-Gemini%203.8%20Flash-4285f4.svg)](https://aistudio.google.com/)
[![Tests](https://img.shields.io/badge/Tests-70%2F70%20Passing-success.svg)](https://nodejs.org/api/test.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## 1. Problem Statement

Freelancers, agency founders, and small business operators live in a fractured financial reality:

1. **Disconnected Cash Flows**: Receivables (invoicing), payables (procurement), and liquidity forecasts live in separate tools (spreadsheets, billing portals, shopping carts), making real-time cash visibility impossible.
2. **Accidental Budget & Reserve Breaches**: Unplanned hardware or software purchases frequently cause critical dips below minimum operating reserves, triggering liquidity crises.
3. **Delayed Receivables**: Overdue client invoices remain uncollected for weeks because drafting polite, professional follow-ups is tedious.
4. **The "Autonomous AI" Trap**: Traditional generative AI solutions either lack real financial tool access or dangerously attempt to execute transactions autonomously without managerial consent.

---

## 2. Proposed Solution

**PayPilot AI** is an intelligent financial copilot that unites receivables, procurement, and liquidity planning into a single command center backed by:

- **Deterministic Spending Mandates**: Non-negotiable policy guardrails that evaluate shopping carts against single-item ceilings, monthly budgets, approved categories, and cash reserve floors.
- **Controlled PayPal Sandbox Execution**: Direct integration with the **PayPal Orders API** (for procurement checkout and capture) and **PayPal Invoicing API v2** (for invoice drafting, dispatching, and reminder notifications).
- **Advisory AI with Human Authorization**: Gemini 3.8 Flash acts as an advisory copilot with controlled read-only and draft-preparation tools. All financial commitments require explicit human confirmation.
- **Dynamic 12-Week Cashflow Forecasting**: A probabilistic projection engine that models P20 (conservative), P50 (expected), and P80 (optimistic) liquidity curves without double-counting receivables or settled purchases.

---

## 3. Target Audience

- **Freelancers & Solopreneurs**: Independent software engineers, designers, copywriters, and consultants managing irregular income streams.
- **Boutique Agencies & Studios**: Small teams (1–20 people) needing disciplined procurement policies and fast, professional invoicing.
- **Small Business Owners**: Founders who need automated financial oversight without hiring a full-time CFO.

---

## 4. Key Features

- **Financial Overview Dashboard**: High-level pulse of available demo cash, receivables, monthly procurement spend, and a 12-week cashflow graph.
- **Smart Spend & Catalog**: Curated catalog of verified business gear with real-time policy evaluation. Compliant carts can proceed to Sandbox Checkout; violating items are deterministically blocked.
- **PayPal Sandbox Orders Checkout**: End-to-end checkout with real PayPal Sandbox buyer authentication, approval redirection, and idempotent server-side capture.
- **Smart Invoicing & PayPal Invoicing v2**: Natural-language invoice drafting ("Create a $1,200 invoice for website design, due in 14 days"), sandbox dispatching, and automated payment reminders.
- **Cashflow Forecast & Affordability Simulator**: 12-week projection engine modeling collections and outlays with interactive stress testing ("Can I afford an $80 purchase this week?").
- **Activity & Governance Audit Ledger**: Comprehensive timeline recording policy evaluations, approvals, and transaction IDs.
- **Clear Settlement Badging**: Visual distinction between `PAYPAL VERIFIED PAID` and `DEMO MANUAL SETTLEMENT`, plus `Captured (PayPal Sandbox)` vs `Captured (Demo Simulation)`.

---

## 5. Application Screens

```
+----------------------------------------------------------------------------------------------------+
|  PayPilot AI  |  Overview  |  Smart Spend  |  Smart Invoice  |  Cashflow  |  Copilot  |  Approvals |
+----------------------------------------------------------------------------------------------------+
|  [ Available Demo Cash: $14,250.00 ]  [ Outstanding Invoices: $9,000.00 ]  [ Min Floor: $6,000.00 ]|
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  12-WEEK PROJECTED CASH FLOW TRAJECTORY                                                            |
|  $32k |                                                     *----* P80 Optimistic                  |
|  $24k |                                          *---------* P50 Expected Net                      |
|  $16k |                     *-------------------*                                                  |
|   $8k |  *-----------------*                                *----* P20 Conservative                |
|   $6k |-- - - - - - - - - - - - - - - - - - - - - - - - - - - - - Minimum Reserve Floor            |
|       +----------------------------------------------------------------------------------          |
|          Wk 1     Wk 2     Wk 3     Wk 4     Wk 5     Wk 6     Wk 7     Wk 8 ... Wk 12             |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
|  SMART SPEND (POLICY: PASS)                  |  SMART INVOICING (PAYPAL SANDBOX)                   |
|  Focus Upgrade: Chair + Keyboard ($328.00)   |  INV-2026-091: Acme Tech ($5,200) [OVERDUE]         |
|  [ Approve & PayPal Sandbox Checkout ]       |  INV-2026-090: Beacon Health ($3,800) [SENT]        |
|                                              |  INV-2026-088: Acme Tech ($4,500) [PAYPAL VERIFIED] |
+----------------------------------------------------------------------------------------------------+
```

- **Overview Dashboard**: Unified financial metrics, interactive chart, pending approvals, and overdue receivables.
- **Smart Spend**: Product catalog, category and price filters, real-time spending mandate policy banner.
- **PayPal Sandbox Checkout Modal**: Initiates authenticated PayPal order, opens buyer approval page, and executes idempotent capture upon return.
- **Smart Invoice Builder**: Line-item calculation, tax handling, PayPal invoice draft generation, and reminder dispatch.
- **Activity & Approvals**: Filterable audit timeline showing lifecycle states (`Proposed` -> `Validating` -> `Awaiting Approval` -> `Sandbox Checkout` -> `Captured`).

---

## 6. Architecture Overview

PayPilot AI adopts a clean full-stack architecture with clear separation of concerns:

- **Frontend**: React 19 SPA styled with Tailwind CSS, Lucide icons, and Motion primitives. Reactive state management with fixed-precision arithmetic.
- **Backend**: Node.js Express server running TypeScript (`tsx`). Hosts REST API routes, authoritative product catalog, PayPal OAuth token manager, and PayPal REST clients.
- **Policy Engine**: Decoupled, pure TypeScript functions (`src/utils/rules.ts`) executing deterministic evaluations with 0% AI hallucination risk.
- **AI Orchestration**: Google Gen AI SDK (`@google/genai`) using `gemini-3.8-flash` with strictly bounded function calling and deterministic fallback.
- **PayPal Sandbox Gateway**: Server-side wrapper interfacing with `https://api-m.sandbox.paypal.com` for Orders v2 and Invoicing v2.

---

## 7. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 19, TypeScript, Vite 8, Tailwind CSS |
| **Icons & UI Animation**| Lucide React, Motion |
| **Backend Runtime** | Node.js (v20+), Express 4, TypeScript (`tsx`) |
| **AI / LLM Engine** | Google Gen AI SDK (`@google/genai`), Gemini 3.8 Flash |
| **Payments & Invoicing**| PayPal Sandbox REST APIs (Orders v2, Invoicing v2, Webhooks) |
| **Test Runner** | Node.js Built-in Test Runner (`node:test`, `node:assert/strict`) |
| **Browser Verification**| Playwright Headless Chromium (`playwright-cli`) |

---

## 8. PayPal API Integrations

PayPilot AI integrates two core PayPal developer products in Sandbox mode:

### 1. PayPal Orders API (v2)
- **Endpoint**: `POST /v2/checkout/orders`
- **Intent**: `CAPTURE`
- **Authoritative Recalculation**: Server calculates itemized lines and total amount from the database catalog before order creation.
- **Payee Routing**: Dynamically routes to the configured Sandbox merchant ID (`PAYPAL_MERCHANT_ID`) or merchant email (`PAYPAL_PAYEE_EMAIL`).
- **Buyer Approval Flow**: Redirects buyer to `https://www.sandbox.paypal.com/checkoutnow?token={orderId}`.
- **Authoritative Capture**: `POST /v2/checkout/orders/{id}/capture` is gated on upstream order status being `APPROVED` and uses `PayPal-Request-Id` for idempotency.

### 2. PayPal Invoicing API (v2)
- **Draft Creation**: `POST /v2/invoicing/invoices` generates authoritative draft invoices with specified payment terms and due dates.
- **Dispatch**: `POST /v2/invoicing/invoices/{id}/send` delivers the invoice to the client's sandbox billing email.
- **Payment Reminders**: `POST /v2/invoicing/invoices/{id}/remind` dispatches reminder notices for overdue receivables.
- **Live Status Verification**: `GET /v2/invoicing/invoices/{id}` queries live status (`DRAFT`, `SENT`, `PAID`, `MARKED_AS_PAID`, `CANCELLED`).
- **Webhook Processing**: `POST /api/paypal/webhooks` cryptographically validates certificate origin (`*.paypal.com`) and verifies transmission signatures.

---

## 9. AI Agent Capabilities & Safety Boundaries

The AI Assistant (*PayPilot Copilot*) is equipped with 8 controlled, read-only or draft-preparation tools:

| Controlled Tool | Purpose | Permission Level |
| :--- | :--- | :--- |
| `searchCatalog` | Search approved business equipment catalog | Read-Only |
| `getSpendingMandate` | Inspect active monthly budget, ceiling, and categories | Read-Only |
| `evaluateCartPolicy` | Run cart through deterministic policy engine | Pure Evaluation |
| `getInvoices` | Query unpaid, overdue, and settled invoices | Read-Only |
| `prepareInvoiceDraft` | Calculate invoice line items and prepopulate draft | Draft Only (Unsent) |
| `getCashflowForecast` | Retrieve 12-week P50 liquidity curve | Read-Only |
| `simulateExpenseImpact` | Stress test cash reserve against proposed purchase | Pure Simulation |
| `getRecentPurchases` | Retrieve recent purchase approvals and receipts | Read-Only |

### Hard Security Boundaries
The AI Copilot **CANNOT**:
- Approve purchases or grant exceptions.
- Bypass spending mandate limits.
- Send invoices without manual review.
- Capture payments or charge cards.
- Mark invoices as paid independently.

Any attempt to invoke these actions triggers an immediate `UNAUTHORIZED_FINANCIAL_ACTION` rejection.

---

## 10. Installation & Local Setup

### Prerequisites
- Node.js >= 20.x installed
- npm or bun installed

### Step-by-Step Setup

```bash
# 1. Clone repository
git clone https://github.com/your-username/paypilot-ai.git
cd paypilot-ai

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env

# Edit .env and supply your credentials:
# PAYPAL_CLIENT_ID="your_sandbox_client_id"
# PAYPAL_CLIENT_SECRET="your_sandbox_client_secret"
# GEMINI_API_KEY="your_gemini_api_key" (optional)

# 4. Start the application
npm run dev
```

Open your browser to `http://localhost:3000`.

---

## 11. Environment Configuration

| Variable | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `PORT` | Optional | HTTP server listening port (defaults to 3000) | `3000` |
| `NODE_ENV` | Optional | Runtime environment (`development` or `production`) | `development` |
| `APP_URL` | Optional | Public base URL of the application | `http://localhost:3000` |
| `PAYPAL_CLIENT_ID` | Recommended | PayPal Sandbox REST App Client ID | `AXXX...` |
| `PAYPAL_CLIENT_SECRET` | Recommended | PayPal Sandbox REST App Secret | `EXXX...` |
| `PAYPAL_MERCHANT_ID` | Optional | Target Sandbox Seller Merchant ID | `2WA3G7MXF3ZCG` |
| `PAYPAL_PAYEE_EMAIL` | Optional | Target Sandbox Seller Business Email | `seller@example.com` |
| `GEMINI_API_KEY` | Optional | Google Gemini API Key (defaults to deterministic engine) | `AIza...` |

---

## 12. Testing Using PayPal Sandbox

1. **Merchant Setup**:
   - Create a Sandbox Business account in [developer.paypal.com](https://developer.paypal.com/).
   - Copy Client ID and Secret into `.env`.
2. **Buyer Setup**:
   - Create a separate Sandbox Personal buyer account with USD balance.
3. **Verify Health**:
   - Visit `http://localhost:3000/api/paypal/diagnostic` to verify OAuth token acquisition.
4. **Execute Sandbox Orders Flow**:
   - Go to **Smart Spend**. Add an item under $250 (e.g. Mechanical Keyboard, $129.00).
   - Click **Review Cart & Mandate Check** -> **Approve & Sandbox Checkout**.
   - Click **Initiate PayPal Sandbox Order**.
   - Authenticate with your Sandbox Personal buyer account and approve payment.
   - Return to PayPilot AI and click **Capture Authorized Payment**.
   - Verify transaction ID and updated cash balance.
5. **Execute Sandbox Invoicing Flow**:
   - Go to **Smart Invoice** -> **Create Invoice with AI**.
   - Review draft and click **Save & Create in PayPal Sandbox**.
   - Click **Send Invoice (PayPal Sandbox)**.
   - In the detail modal, click **Verify PayPal Settlement** to check live payment state.

---

## 13. Running Automated Tests

PayPilot AI includes a comprehensive test suite using Node's native test runner:

```bash
# Run all 70 unit and integration tests
npm test

# Run TypeScript type check
npm run lint

# Run production build
npm run build
```

---

## 14. Known Limitations

- **In-Memory Store**: Purchase approvals, orders, and custom invoices are persisted in server-side memory for zero-dependency portability. In enterprise production, this should be backed by PostgreSQL or Cloud SQL.
- **Sandbox Environment Only**: Live payments are strictly prohibited by runtime safety assertions.
- **Single Currency**: All calculations and PayPal orders enforce USD to eliminate FX volatility during spending mandate checks.

---

## 15. Future Roadmap

1. **Multi-Currency Support**: Real-time FX rate grounding for international client invoicing and cross-border vendor procurement.
2. **PostgreSQL / Cloud SQL Persistence**: Relational schema persistence with row-level security for enterprise multi-tenant organizations.
3. **Automated Recurring Mandates**: Subscription billing monitoring with predictive cancellation recommendations before renewal dates.
4. **Mobile Native Companion**: Progressive Web App (PWA) or React Native companion with push notifications for instant purchase authorizations.

---

## 16. License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
