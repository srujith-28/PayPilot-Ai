# PayPilot AI: Production Deployment Guide

This guide details the simplest and most reliable deployment methods for **PayPilot AI**.

---

## 1. Deployment Architecture

PayPilot AI is a unified full-stack application:
- In production (`NODE_ENV=production`), the Node.js Express server (`server.ts`) directly serves the compiled Vite static assets from `/dist` and exposes the `/api/*` endpoints on the same port.
- No separate reverse proxy is required for single-container hosting.
- The health check is available at `GET /api/health`.

---

## 2. Environment Variables & Secrets Handling

Set these environment variables in your deployment dashboard (e.g., Cloud Run, Render, Railway, or AWS App Runner):

| Variable | Required | Description | Safe Default |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | Set to `production` | `production` |
| `PORT` | Optional | Port assigned by the hosting environment | `3000` or `$PORT` |
| `APP_URL` | Yes | The public HTTPS domain of your deployed application | `https://your-app.run.app` |
| `PAYPAL_CLIENT_ID` | Recommended | PayPal Sandbox REST App Client ID | (from PayPal dashboard) |
| `PAYPAL_CLIENT_SECRET` | Recommended | PayPal Sandbox REST App Secret | (from PayPal dashboard) |
| `PAYPAL_MERCHANT_ID` | Optional | Specific target Sandbox Seller Merchant ID | `2WA3G7MXF3ZCG` |
| `PAYPAL_PAYEE_EMAIL` | Optional | Specific target Sandbox Seller Business Email | `seller@example.com` |
| `GEMINI_API_KEY` | Optional | Google Gemini API Key (defaults to deterministic fallback) | (from AI Studio) |

> 🔒 **Security Guarantee**: All PayPal client secrets and Gemini API keys remain strictly on the server. They are never exposed to the client or embedded in client bundles.

---

## 3. Option A: Google Cloud Run (Recommended for AI Studio)

Google Cloud Run provides instant, serverless container hosting with HTTPS and automatic scale-to-zero.

```bash
# 1. Build and push container to Google Artifact Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/paypilot-ai

# 2. Deploy to Cloud Run
gcloud run deploy paypilot-ai \
  --image gcr.io/YOUR_PROJECT_ID/paypilot-ai \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,PORT=8080 \
  --set-secrets PAYPAL_CLIENT_ID=paypal-client-id:latest,PAYPAL_CLIENT_SECRET=paypal-client-secret:latest,GEMINI_API_KEY=gemini-api-key:latest
```

---

## 4. Option B: Render or Railway

### Render:
1. Connect your GitHub repository to Render as a **Web Service**.
2. Select **Docker** as the environment.
3. Add environment variables under **Environment**:
   - `NODE_ENV`: `production`
   - `PAYPAL_CLIENT_ID`: your sandbox client ID
   - `PAYPAL_CLIENT_SECRET`: your sandbox client secret
   - `GEMINI_API_KEY`: your Gemini API key (optional)
4. Render automatically detects the `Dockerfile` and builds the service.

---

## 5. Option C: Direct Node.js / VPS (Ubuntu, Debian)

```bash
# Clone and install
git clone https://github.com/your-username/paypilot-ai.git
cd paypilot-ai
npm install

# Build client assets
npm run build

# Start production server with PM2 or systemd
export NODE_ENV=production
export PORT=3000
npm run start
```

---

## 6. Pre-Flight Verification Checklist

Before opening the application to evaluators or users:

1. **Verify Health Endpoint**:
   ```bash
   curl -s http://localhost:3000/api/health | jq .
   ```
   Expected response:
   ```json
   {
     "status": "ok",
     "geminiConfigured": true,
     "model": "gemini-3.8-flash",
     "paypalConfigured": true,
     "paypalMode": "SANDBOX",
     "sandboxEnforced": true,
     "livePaymentsAllowed": false,
     "currency": "USD"
   }
   ```

2. **Verify PayPal Sandbox Diagnostics**:
   ```bash
   curl -s http://localhost:3000/api/paypal/diagnostic | jq .
   ```
   Ensures OAuth token acquisition and capture gating are operational.

3. **Verify Sandbox Isolation**:
   Confirm that all API calls target `https://api-m.sandbox.paypal.com` and that live payments remain disabled.
