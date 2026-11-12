# PayPilot AI: Hackathon Demonstration Script (2:50 Max)

This script provides an exact, step-by-step walkthrough for demonstrating **PayPilot AI** in under **2 minutes and 50 seconds (170 seconds)**.

---

## Demonstration Timeline Summary

| Timestamp | Segment Title | Core Theme |
| :--- | :--- | :--- |
| **0:00 – 0:15** | Introduction & Problem | The fragmented financial workflow of freelancers & small businesses. |
| **0:15 – 0:45** | Natural Language Invoicing | AI draft preparation, human review, and PayPal Sandbox dispatch. |
| **0:45 – 1:05** | Settlement Reconciliation | Distinguishing `PAYPAL VERIFIED PAID` from `DEMO MANUAL SETTLEMENT`. |
| **1:05 – 1:30** | AI Affordability Simulation | Stress testing an $80 expense against the 12-week cash reserve floor. |
| **1:30 – 2:10** | Smart Spend & PayPal Orders | Policy validation, human approval, Sandbox order creation, and capture. |
| **2:10 – 2:30** | Deterministic Policy Enforcement | Demonstrating a purchase blocked by single-item limit ($250 ceiling). |
| **2:30 – 2:50** | Cashflow Dashboard & Closing | Unified liquidity curve, security boundaries, and concluding impact. |

---

## Detailed Step-by-Step Script

### Segment 1: Introduction & The Problem (0:00 – 0:15 | 15s)
- **Starting Screen**: `http://localhost:3000/` (Financial Overview Dashboard)
- **Spoken Narration**:
  > "Freelancers and small businesses waste dozens of hours every month juggling spreadsheets, overdue client invoices, and unexpected procurement costs that breach cash reserves. Meet PayPilot AI: your money in, your money out, unified in one intelligent copilot backed by deterministic guardrails and the real PayPal Sandbox API."
- **Visible Action**:
  - Point to the top metrics bar showing **Available Demo Cash: $14,250.00**, **Outstanding Invoices: $9,000.00**, and **Minimum Reserve Floor: $6,000.00**.
- **Expected Result**: Clean overview dashboard showing healthy $14,250 cash and live 12-week forecast trajectory.

---

### Segment 2: Natural Language Invoicing & PayPal Sandbox Dispatch (0:15 – 0:45 | 30s)
- **Screen**: Click **Smart Invoice** in the sidebar navigation.
- **Spoken Narration**:
  > "Instead of filling out complex accounting forms, let's create a client invoice using natural language. I'll click 'Create Invoice with AI' and enter: 'Create a $1,200 invoice for website design, due in 14 days'."
- **Action**:
  1. Click **+ Create Invoice with AI** button.
  2. Type or click the natural language prompt: `Create a $1,200 invoice for website design, due in 14 days`.
  3. Click **Generate Draft**.
  4. Review line items: Website Design, 1 qty @ $1,200.00 USD, terms Net 14.
  5. Click **Save & Create in PayPal Sandbox**.
- **Expected Result**:
  - The modal communicates that the draft was prepared in `DRAFT` status and was **not** sent automatically.
  - User reviews and confirms dispatch by clicking **Send Invoice (PayPal Sandbox)**.
  - The invoice appears in the table with status `Sent` and an official PayPal Invoice ID.

---

### Segment 3: Invoice Status & Settlement Distinction (0:45 – 1:05 | 20s)
- **Screen**: **Smart Invoice Table** (`http://localhost:3000/`)
- **Spoken Narration**:
  > "Notice how PayPilot strictly prevents false payment claims. Historical invoices settled through demo simulations are clearly tagged as 'DEMO MANUAL SETTLEMENT'. But when we click into an active invoice and hit 'Verify PayPal Settlement', our backend directly queries the PayPal Sandbox Invoicing API. Only when PayPal authoritatively confirms payment does it receive the green 'PAYPAL VERIFIED PAID' badge."
- **Action**:
  1. Show rows with `DEMO MANUAL SETTLEMENT` badge.
  2. Click on invoice `INV-2026-090` (Beacon Health Ventures) to open details.
  3. Point to the **Verify PayPal Settlement** button.
- **Expected Result**: The modal displays authoritative live status from PayPal Sandbox without synthetic assumptions.

---

### Segment 4: AI Affordability Simulation (1:05 – 1:30 | 25s)
- **Screen**: Click **AI Assistant** in the sidebar navigation.
- **Spoken Narration**:
  > "Now let's switch to money out. Can I afford an $80 office supply purchase this week? Let's ask PayPilot Copilot."
- **Action**:
  1. Click suggested prompt: `Can I afford an $80 purchase this week?`.
  2. The assistant calls `simulateExpenseImpact` and `getCashflowForecast`.
- **Spoken Narration**:
  > "Notice how the Copilot doesn't guess. It simulates the expense against our 12-week cashflow forecast and $6,000 reserve floor, reporting that our lowest projected balance remains safe at $13,720 in Week 1, maintaining an $7,720 safety buffer."
- **Expected Result**: AI response displays detailed breakdown, lowest projected week, and a `SAFE` verdict with a button to browse the Smart Spend catalog.

---

### Segment 5: Smart Spend, Mandate Approval & PayPal Sandbox Checkout (1:30 – 2:10 | 40s)
- **Screen**: Click **Smart Spend** in the sidebar navigation.
- **Spoken Narration**:
  > "Let's browse the catalog. We'll select the Apex Pro Wireless Mechanical Keyboard for $129.00."
- **Action**:
  1. Click **Add to Cart** on the Mechanical Keyboard ($129.00).
  2. Open cart drawer: Cart total shows $129.00.
  3. Point to the deterministic policy banner: **POLICY STATUS: PASS** (Complies with $250 single-item ceiling and $1,500 monthly budget).
  4. Click **Review Cart & Mandate Check**.
  5. In the Review modal, click **Approve & Sandbox Checkout**.
  6. The PayPal Sandbox Orders modal opens: Click **Initiate PayPal Sandbox Order**.
  7. PayPal returns the official Sandbox Approval URL.
  8. Click **Open PayPal Sandbox Checkout Window** (authenticates in Sandbox Buyer window and approves order).
  9. Upon return, click **Capture Authorized Payment**.
- **Expected Result**:
  - Backend verifies buyer approval, calls `POST /v2/checkout/orders/{id}/capture` with idempotency headers.
  - Modal confirms: `Payment Captured! PayPal Capture ID: [AUTHORITATIVE_ID]`.
  - Available demo cash drops by exactly $129.00 to $14,121.00.
  - Recorded in Activity & Approvals with tag `Captured (PayPal Sandbox)`.

---

### Segment 6: Deterministic Policy Enforcement: Blocked Purchase (2:10 – 2:30 | 20s)
- **Screen**: **Smart Spend** page.
- **Spoken Narration**:
  > "What happens if someone tries to buy a high-cost item? Let's add the UltraView 34-inch Monitor at $389.00."
- **Action**:
  1. Click **Add to Cart** on the UltraView 34" Monitor ($389.00).
  2. View the cart banner: **POLICY STATUS: BLOCKED**.
  3. Point to the blocking rule: `Item price ($389.00) exceeds maximum single-item limit of $250.00`.
  4. Point to the checkout button: **Checkout Disabled (Policy Violation)**.
- **Spoken Narration**:
  > "Our pure deterministic policy engine halts automatic checkout immediately. No AI hallucination, prompt injection, or client-side tampering can bypass this ceiling."
- **Expected Result**: The checkout button is disabled with clear policy explanation.

---

### Segment 7: Cashflow Forecast Dashboard & Concluding Impact (2:30 – 2:50 | 20s)
- **Screen**: Click **Cashflow Forecast** in the sidebar navigation.
- **Spoken Narration**:
  > "Finally, let's look at the Cashflow Forecast. PayPilot plots all 12 weeks with P20, P50, and P80 uncertainty bounds. Captured purchases are already deducted from opening cash, while unpaid invoices are mapped to their expected collection windows without double-counting.
  > With PayPilot AI, small businesses finally have a unified financial copilot they can trust: intelligent enough to advise, disciplined enough to obey policy, and powered by PayPal Sandbox. Thank you!"
- **Action**:
  - Hover over Week 1, Week 2, and Week 12 on the interactive chart.
- **Expected Result**: Smooth, responsive SVG chart highlighting P50 expected balance and the $6,000 minimum reserve floor.

---

## Speaker Checkpoints & Fallback Notes

- **If PayPal Sandbox API is slow**: The UI displays interactive step-by-step spinners and descriptive error alerts.
- **If AI key is missing**: The deterministic fallback engine responds instantly with live application metrics.
- **Total Duration**: 2 minutes, 45 seconds (leaves 5 seconds buffer before the 2:50 limit).
