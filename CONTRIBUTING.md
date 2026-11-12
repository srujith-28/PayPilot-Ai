# Contributing to PayPilot AI

Thank you for your interest in contributing to **PayPilot AI**! We welcome bug reports, documentation enhancements, feature proposals, and code contributions.

## Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone. Please be respectful, constructive, and collaborative.

## Development Workflow

### 1. Prerequisites

- **Node.js**: >= 20.x
- **npm** or **bun**
- A **PayPal Sandbox Developer Account** from [developer.paypal.com](https://developer.paypal.com/)
- Optional: A Google AI Studio API key for Gemini 3.8 Flash from [aistudio.google.com](https://aistudio.google.com/)

### 2. Local Setup

```bash
# Clone repository
git clone https://github.com/your-username/paypilot-ai.git
cd paypilot-ai

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

Visit `http://localhost:3000` in your browser.

### 3. Core Architectural Principles & Invariants

When writing code for PayPilot AI, maintain these non-negotiable architectural rules:

1. **Strict PayPal Sandbox Only**: Never call `api.paypal.com` or live PayPal endpoints. Every upstream endpoint must be verified against `https://api-m.sandbox.paypal.com`.
2. **Deterministic Spending Policy Engine**: The policy rules (single-item limits, monthly budget ceiling, allowed categories, and minimum cash reserve floor) are deterministic pure functions in `src/utils/rules.ts`. AI agents never bypass or mutate these rules.
3. **No Unilateral AI Financial Actions**: The AI Assistant is advisory only. Tools strictly block actions such as `approvePurchase`, `sendInvoiceWithoutApproval`, or `capturePayment`.
4. **Authoritative Server Recalculation**: The backend recalculates order amounts and invoice totals using authoritative product catalog prices and line items—never client-supplied price strings.
5. **Fixed-Precision Decimal Arithmetic**: All monetary sums must be rounded to two decimal places using standard fixed arithmetic (`Math.round(val * 100) / 100`).
6. **Clear Settlement Distinction**: The UI must distinctly label `PAYPAL VERIFIED PAID` vs `DEMO MANUAL SETTLEMENT`, and `Captured (PayPal Sandbox)` vs `Captured (Demo Simulation)`.

### 4. Running Tests & Quality Gates

Before submitting a pull request, ensure all verification suites pass cleanly:

```bash
# Run unit and integration tests
npm test

# Run TypeScript typecheck
npm run lint

# Verify production Vite build
npm run build
```

### 5. Submitting Changes

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Commit with descriptive messages: `git commit -m "feat(spend): add policy audit trace"`
3. Push to your fork: `git push origin feature/your-feature-name`
4. Open a Pull Request detailing the changes, motivation, and test evidence.
