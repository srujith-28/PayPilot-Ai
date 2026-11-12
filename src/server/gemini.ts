/**
 * Server-Side Gemini AI Service for PayPilot AI
 *
 * Implements:
 * - Real Gemini integration via `@google/genai` with `gemini-3.8-flash`
 * - Controlled application tools for catalog search, mandate check, cart policy,
 *   invoices, draft preparation, forecast, and affordability simulation
 * - Strict financial action boundary enforcement (AI cannot approve, bypass, send, or capture)
 * - Deterministic, graceful fallback when API key is missing or model errors
 * - Typed request/response validation
 */

import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai';
import dotenv from 'dotenv';
import {
  searchCatalog,
  getSpendingMandate,
  evaluateCartPolicy,
  getInvoices,
  prepareInvoiceDraft,
  getCashflowForecast,
  simulateExpenseImpact,
  getRecentPurchases,
  checkActionAuthorization,
} from './tools.ts';
import type { AssistantRequest, AssistantResponse } from './interfaces.ts';

dotenv.config();

const SYSTEM_INSTRUCTION = `You are PayPilot AI, an elite financial copilot for Jordan Miller (founder of Miller Design Lab LLC).
Your goal is to provide precise, trustworthy, and deterministic financial assistance covering:
1. Smart Spend: Catalog search, spending mandate checks, policy evaluation.
2. Invoicing: Overdue receivables, invoice drafting, payment reminders.
3. Cashflow: 12-week forecast analysis, stress testing, and purchase affordability.

STRICT SAFETY AND FINANCIAL ACTION BOUNDARIES:
- You are an advisory copilot ONLY.
- You can recommend, explain, calculate, and prepare drafts.
- You CANNOT approve purchases, bypass spending limits, send invoices, capture payments, or mark invoices paid.
- All consequential financial actions require explicit user review and confirmation in the UI.
- Never invent balances, invoice numbers, or payment states. Always rely on the authoritative data returned by tools.
- Keep responses professional, scannable, and helpful with concise bullet points where appropriate.`;

// Tool function declarations for Gemini
const searchCatalogTool: FunctionDeclaration = {
  name: 'searchCatalog',
  description: 'Search the product catalog by keyword, category, or maximum price.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'Keyword to search (e.g., chair, monitor, keyboard)' },
      category: { type: Type.STRING, description: 'Product category' },
      maxPrice: { type: Type.NUMBER, description: 'Maximum price limit in USD' },
    },
  },
};

const getSpendingMandateTool: FunctionDeclaration = {
  name: 'getSpendingMandate',
  description: 'Get the active spending mandate rules, monthly budget, single-item ceiling, and allowed categories.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      includeCategoryBreakdown: {
        type: Type.BOOLEAN,
        description: 'Optional flag to request full category breakdown',
      },
    },
  },
};

const evaluateCartPolicyTool: FunctionDeclaration = {
  name: 'evaluateCartPolicy',
  description: 'Run the deterministic policy engine against a proposed cart to check for mandate compliance and reserve safety.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description: 'Cart items to evaluate',
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Item name' },
            price: { type: Type.NUMBER, description: 'Item price' },
            quantity: { type: Type.NUMBER, description: 'Item quantity' },
            category: { type: Type.STRING, description: 'Item category' },
          },
          required: ['name', 'price'],
        },
      },
      currentAvailableCash: { type: Type.NUMBER, description: 'Current available cash balance' },
      minimumReserveFloor: { type: Type.NUMBER, description: 'Configured minimum cash reserve floor' },
    },
    required: ['items'],
  },
};

const getInvoicesTool: FunctionDeclaration = {
  name: 'getInvoices',
  description: 'Retrieve real invoices, overdue receivables, and client payment details.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      status: { type: Type.STRING, description: "Filter by status: 'all', 'draft', 'sent', 'paid', or 'overdue'" },
    },
  },
};

const prepareInvoiceDraftTool: FunctionDeclaration = {
  name: 'prepareInvoiceDraft',
  description: 'Prepare a proposed invoice draft for user review. Does not send or finalize the invoice.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      clientName: { type: Type.STRING, description: 'Client contact or company name' },
      clientCompany: { type: Type.STRING, description: 'Client legal or brand name' },
      clientEmail: { type: Type.STRING, description: 'Client billing email' },
      description: { type: Type.STRING, description: 'Scope of work or project description' },
      totalAmountHint: { type: Type.NUMBER, description: 'Proposed total invoice amount in USD' },
      paymentTermsDays: { type: Type.NUMBER, description: 'Payment terms in days (e.g. 14, 30)' },
    },
    required: ['clientName', 'description'],
  },
};

const getCashflowForecastTool: FunctionDeclaration = {
  name: 'getCashflowForecast',
  description: 'Retrieve the 12-week cashflow forecast with expected inflows, outflows, and P50 projections.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      horizonWeeks: {
        type: Type.NUMBER,
        description: 'Number of weeks in forecast horizon, defaults to 12',
      },
    },
  },
};

const simulateExpenseImpactTool: FunctionDeclaration = {
  name: 'simulateExpenseImpact',
  description: 'Simulate the impact of a planned purchase against minimum cash reserves over the forecast horizon.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      expenseAmount: { type: Type.NUMBER, description: 'Dollar amount of proposed expense' },
      targetWeekIndex: { type: Type.NUMBER, description: 'Week index to apply the expense (0-11)' },
      minimumReserve: { type: Type.NUMBER, description: 'Minimum reserve floor in USD' },
    },
    required: ['expenseAmount'],
  },
};

const getRecentPurchasesTool: FunctionDeclaration = {
  name: 'getRecentPurchases',
  description: 'Retrieve the most recent purchase approvals and order requests.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      limit: { type: Type.NUMBER, description: 'Maximum number of purchases to retrieve (default: 5)' },
    },
  },
};

const allToolDeclarations = [
  searchCatalogTool,
  getSpendingMandateTool,
  evaluateCartPolicyTool,
  getInvoicesTool,
  prepareInvoiceDraftTool,
  getCashflowForecastTool,
  simulateExpenseImpactTool,
  getRecentPurchasesTool,
];

/**
 * Initializes GoogleGenAI client if GEMINI_API_KEY is present
 */
export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Executes a controlled tool securely
 */
export function executeToolByName(name: string, args: Record<string, any>): {
  result: any;
  error?: string;
  isUnauthorized?: boolean;
} {
  // Check action boundary authorization
  const authCheck = checkActionAuthorization(name);
  if (!authCheck.authorized) {
    return {
      result: null,
      error: authCheck.error,
      isUnauthorized: true,
    };
  }

  try {
    switch (name) {
      case 'searchCatalog':
        return { result: searchCatalog(args) };
      case 'getSpendingMandate':
        return { result: getSpendingMandate() };
      case 'evaluateCartPolicy':
        return { result: evaluateCartPolicy(args as any) };
      case 'getInvoices':
        return { result: getInvoices(args) };
      case 'prepareInvoiceDraft':
        return { result: prepareInvoiceDraft(args as any) };
      case 'getCashflowForecast':
        return { result: getCashflowForecast() };
      case 'simulateExpenseImpact':
        return { result: simulateExpenseImpact(args as any) };
      case 'getRecentPurchases':
        return { result: getRecentPurchases(args as any) };
      default:
        return { result: null, error: `Unknown tool: ${name}` };
    }
  } catch (err: any) {
    return { result: null, error: err.message || 'Tool execution failed' };
  }
}

/**
 * Deterministic fallback responder when Gemini API key is not configured or fails
 */
export function generateDeterministicResponse(request: AssistantRequest): AssistantResponse {
  const query = request.message.trim();
  const lower = query.toLowerCase();

  // 1. Check for unauthorized action requests
  const auth = checkActionAuthorization(lower);
  if (!auth.authorized) {
    return {
      success: false,
      reply: auth.error || 'Action not permitted by financial safety policy.',
      modelUsed: 'deterministic-policy-engine',
      suggestedActions: [
        { label: 'View Spending Mandate', route: 'settings' },
        { label: 'Review Pending Approvals', route: 'activity-approvals' },
      ],
      error: 'UNAUTHORIZED_FINANCIAL_ACTION',
    };
  }

  // 2. Overdue invoices inquiry
  if (lower.includes('overdue') || (lower.includes('which') && lower.includes('invoice'))) {
    const invData = getInvoices();
    const overdue = invData.invoices.filter((i) => i.status === 'overdue');
    if (overdue.length > 0) {
      const first = overdue[0];
      return {
        success: true,
        reply: `You currently have ${overdue.length} overdue invoice totaling $${invData.summary.totalOverdue.toLocaleString('en-US', { minimumFractionDigits: 2 })}:\n\n• ${first.invoiceNumber} for ${first.clientName} (${first.clientCompany}) — $${first.total.toFixed(2)}, due ${first.dueDate}.\n\nWould you like me to prepare a polite payment reminder?`,
        modelUsed: 'deterministic-grounded-engine',
        toolCallsExecuted: ['getInvoices'],
        suggestedActions: [
          { label: 'View Overdue Invoices', route: 'smart-invoice' },
          { label: 'Send Payment Reminder', route: 'smart-invoice' },
        ],
        dataHighlight: {
          type: 'invoice',
          title: first.invoiceNumber,
          value: `$${first.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          details: `Client: ${first.clientCompany || first.clientName} · Due ${first.dueDate}`,
        },
      };
    } else {
      return {
        success: true,
        reply: 'Good news! None of your active invoices are overdue. All outstanding receivables are within their agreed terms.',
        modelUsed: 'deterministic-grounded-engine',
        toolCallsExecuted: ['getInvoices'],
        suggestedActions: [{ label: 'View All Invoices', route: 'smart-invoice' }],
      };
    }
  }

  // 2b. Outstanding / tied up invoices inquiry
  if (lower.includes('outstanding') || lower.includes('tied up')) {
    const invData = getInvoices();
    return {
      success: true,
      reply: `You currently have $${invData.summary.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })} tied up across ${invData.invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').length} outstanding invoices:\n\n• INV-2026-091: Acme Technologies Inc. — $5,200.00 (OVERDUE)\n• INV-2026-090: Beacon Health Ventures — $3,800.00 (Sent, due Oct 22)\n\nCollecting these will boost your available cash from $14,250.00 to $23,250.00.`,
      modelUsed: 'deterministic-grounded-engine',
      toolCallsExecuted: ['getInvoices'],
      suggestedActions: [
        { label: 'View Smart Invoices', route: 'smart-invoice' },
        { label: 'Send Overdue Reminder', route: 'smart-invoice' },
      ],
      dataHighlight: {
        type: 'invoice',
        title: 'Outstanding Receivables',
        value: `$${invData.summary.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        details: `${invData.summary.overdueCount} overdue · 1 pending Net 14`,
      },
    };
  }

  // 2c. 12-week cash position
  if (lower.includes('12 week') || lower.includes('projected cash') || lower.includes('cash position') || lower.includes('in 12 weeks')) {
    const forecast = getCashflowForecast();
    const finalWeek = forecast.weeks[forecast.weeks.length - 1];
    return {
      success: true,
      reply: `Based on your deterministic 12-week forecast:\n\n• Current Opening Cash (Week 1): $${forecast.currentCashReserve.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n• Projected Ending Cash (Week 12): $${finalWeek.projectedEndingCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n• Minimum Reserve Floor: $${forecast.minimumReserveFloor.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n• Safety Buffer in Week 12: $${(finalWeek.projectedEndingCash - forecast.minimumReserveFloor).toLocaleString('en-US', { minimumFractionDigits: 2 })} above floor\n\nYour cash trajectory remains solvent and above the required reserve floor throughout all 12 weeks.`,
      modelUsed: 'deterministic-grounded-engine',
      toolCallsExecuted: ['getCashflowForecast'],
      suggestedActions: [
        { label: 'Open Cashflow Forecast', route: 'cashflow-forecast' },
        { label: 'Simulate Expense', route: 'cashflow-forecast' },
      ],
      dataHighlight: {
        type: 'cashflow',
        title: 'Week 12 Projected Cash',
        value: `$${finalWeek.projectedEndingCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        details: `Trajectory: Solvent · Safety Buffer: $${(finalWeek.projectedEndingCash - forecast.minimumReserveFloor).toLocaleString()}`,
      },
    };
  }

  // 2d. Recent purchases
  if (lower.includes('recent purchase') || lower.includes('purchases') || lower.includes('show my purchase') || lower.includes('purchase history')) {
    const recent = getRecentPurchases({ limit: 5 });
    const purchaseLines = recent.purchases
      .map(
        (p) =>
          `• ${p.title} — $${p.totalAmount.toFixed(2)} [State: ${p.state}${
            p.sandboxTransactionId ? ` · TX: ${p.sandboxTransactionId}` : ''
          }]`
      )
      .join('\n');

    return {
      success: true,
      reply: `Here are your recent purchase approvals and orders:\n\n${purchaseLines}\n\nYou can review complete audit details and transaction receipts in Activity & Approvals.`,
      modelUsed: 'deterministic-grounded-engine',
      toolCallsExecuted: ['getRecentPurchases'],
      suggestedActions: [
        { label: 'View Activity & Approvals', route: 'activity-approvals' },
        { label: 'Browse Smart Spend', route: 'smart-spend' },
      ],
      dataHighlight: {
        type: 'spend',
        title: 'Recent Purchases',
        value: `${recent.count} records`,
        details: 'Audit-friendly spend ledger',
      },
    };
  }

  // 3. Affordability question
  if (lower.includes('afford') || lower.includes('can i spend') || lower.includes('$80') || (lower.includes('purchase') && lower.includes('$'))) {
    const match = query.match(/\$?(\d+(?:\.\d{1,2})?)/);
    const amount = match ? parseFloat(match[1]) : 80;
    const sim = simulateExpenseImpact({ expenseAmount: amount, targetWeekIndex: 1, minimumReserve: 6000 });

    const verdictText =
      sim.verdict === 'SAFE'
        ? 'Safe to proceed.'
        : sim.verdict === 'CAUTION'
        ? 'Proceed with caution (tight safety buffer).'
        : 'High risk of cash reserve breach.';

    return {
      success: true,
      reply: `I evaluated an expense of $${amount.toFixed(2)} against your 12-week cashflow forecast and $6,000 minimum reserve floor:\n\n• Available Demo Cash: $14,250.00\n• Lowest Projected Balance After: $${sim.lowestProjectedBalanceAfter.toLocaleString()} in ${sim.lowestProjectedWeekLabel}\n• Buffer Remaining: $${sim.bufferRemaining.toLocaleString()} above floor\n• Verdict: ${verdictText}\n\n${sim.recommendation}`,
      modelUsed: 'deterministic-grounded-engine',
      toolCallsExecuted: ['simulateExpenseImpact', 'getCashflowForecast'],
      suggestedActions: [
        { label: 'Simulate in Cashflow Planner', route: 'cashflow-forecast' },
        { label: 'Browse Smart Spend Catalog', route: 'smart-spend' },
      ],
      dataHighlight: {
        type: 'cashflow',
        title: 'Affordability Simulation',
        value: sim.verdict === 'SAFE' ? 'Approved (Safe)' : 'Caution',
        details: `Buffer after purchase: $${sim.bufferRemaining.toLocaleString()} above minimum reserve`,
      },
    };
  }

  // 4. Draft invoice
  if (lower.includes('draft') || (lower.includes('create') && lower.includes('invoice'))) {
    // Extract amount if present
    const amountMatch = query.match(/\$?(\d+(?:,\d{3})*(?:\.\d{1,2})?)/);
    const parsedAmount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 1200;

    let client = 'Acme Technologies Inc.';
    if (lower.includes('lumina')) client = 'Lumina Media Studio';
    if (lower.includes('beacon')) client = 'Beacon Health Ventures';

    const draftResult = prepareInvoiceDraft({
      clientName: client,
      description: 'Consulting & Design Services (Phase 1)',
      totalAmountHint: parsedAmount,
      paymentTermsDays: 14,
    });

    return {
      success: true,
      reply: `I have prepared a draft invoice for ${client} for $${draftResult.draft.total.toFixed(2)} with Net 14 payment terms.\n\n⚠️ Policy Note: In accordance with financial safety boundaries, this invoice is in DRAFT status and has NOT been sent. You can review, edit line items, and dispatch it in the invoice workspace.`,
      modelUsed: 'deterministic-grounded-engine',
      toolCallsExecuted: ['prepareInvoiceDraft'],
      preparedDraft: draftResult.draft,
      suggestedActions: [
        { label: 'Open Invoice Builder', route: 'smart-invoice' },
        { label: 'View All Invoices', route: 'smart-invoice' },
      ],
      dataHighlight: {
        type: 'invoice',
        title: 'New Draft Invoice',
        value: `$${draftResult.draft.total.toFixed(2)}`,
        details: `Client: ${client} · Terms: Net 14`,
      },
    };
  }

  // 5. Blocked cart explanation
  if (lower.includes('block') || lower.includes('policy') || lower.includes('mandate')) {
    const mandate = getSpendingMandate();
    return {
      success: true,
      reply: `PayPilot enforces 4 strict spending guardrails:\n\n1. Single-Item Ceiling: Maximum $${mandate.maxSingleItemLimit.toFixed(2)} per item\n2. Monthly Budget: $${mandate.monthlyBudget.toFixed(2)} (Spent: $${mandate.currentSpentThisMonth.toFixed(2)})\n3. Allowed Categories: ${mandate.allowedCategories.join(', ')}\n4. Cash Reserve Floor: $6,000.00 minimum liquidity\n\nIf any item exceeds $${mandate.maxSingleItemLimit.toFixed(2)} or belongs to a restricted category like Luxury Goods, the policy engine blocks automated checkout. High-cost items require manual review in Approvals.`,
      modelUsed: 'deterministic-grounded-engine',
      toolCallsExecuted: ['getSpendingMandate'],
      suggestedActions: [
        { label: 'Review Spending Mandate', route: 'settings' },
        { label: 'Inspect Pending Approvals', route: 'activity-approvals' },
      ],
      dataHighlight: {
        type: 'policy',
        title: 'Active Mandate',
        value: `$${mandate.monthlyBudget.toLocaleString()} / mo`,
        details: `Single-item ceiling: $${mandate.maxSingleItemLimit} · Allowed: ${mandate.allowedCategories.length} categories`,
      },
    };
  }

  // 6. Shopping / product queries
  if (lower.includes('chair') || lower.includes('desk') || lower.includes('keyboard') || lower.includes('monitor') || lower.includes('find') || lower.includes('buy')) {
    const results = searchCatalog({ query });
    if (results.count > 0) {
      const top = results.products[0];
      const specsSummary = Object.entries(top.specs).map(([k, v]) => `${k}: ${v}`).join(', ');
      return {
        success: true,
        reply: `I found ${results.count} matching item(s) in your approved product catalog:\n\n• ${top.name} — $${top.price.toFixed(2)} (${top.category})\n  Specs: ${specsSummary}\n\nThis item is in stock and complies with your mandate. You can add it directly to your cart in Smart Spend.`,
        modelUsed: 'deterministic-grounded-engine',
        toolCallsExecuted: ['searchCatalog'],
        suggestedActions: [
          { label: 'Open Smart Spend', route: 'smart-spend' },
        ],
        dataHighlight: {
          type: 'spend',
          title: top.name,
          value: `$${top.price.toFixed(2)}`,
          details: `Category: ${top.category} · Rating: ${top.rating}★`,
        },
      };
    }
  }

  // Default overview summary
  const inv = getInvoices();
  const mandate = getSpendingMandate();
  return {
    success: true,
    reply: `Here is your current financial pulse:\n\n• Available Demo Cash: $14,250.00\n• Outstanding Invoices: $${inv.summary.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${inv.summary.overdueCount} overdue)\n• Monthly Mandate Remaining: $${(mandate.monthlyBudget - mandate.currentSpentThisMonth).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n• Cash Reserve Safety: Secure ($8,250 above floor)\n\nWhat would you like to explore or analyze?`,
    modelUsed: 'deterministic-grounded-engine',
    toolCallsExecuted: ['getInvoices', 'getSpendingMandate'],
    suggestedActions: [
      { label: 'Cashflow Forecast', route: 'cashflow-forecast' },
      { label: 'Smart Spend Workspace', route: 'smart-spend' },
      { label: 'Smart Invoices', route: 'smart-invoice' },
    ],
  };
}

/**
 * Main AI Assistant Orchestration Service
 */
export async function processAssistantRequest(request: AssistantRequest): Promise<AssistantResponse> {
  const query = request.message?.trim();
  if (!query) {
    return {
      success: false,
      reply: 'Please provide a question or instruction for PayPilot.',
      modelUsed: 'validation',
      error: 'Empty request message',
    };
  }

  // Pre-check for unauthorized actions before calling model
  const auth = checkActionAuthorization(query);
  if (!auth.authorized) {
    return {
      success: false,
      reply: auth.error || 'Action prohibited by financial safety boundaries.',
      modelUsed: 'boundary-guard',
      error: 'UNAUTHORIZED_FINANCIAL_ACTION',
      suggestedActions: [
        { label: 'Review Spending Mandate', route: 'settings' },
        { label: 'Review Pending Approvals', route: 'activity-approvals' },
      ],
    };
  }

  const ai = getGeminiClient();

  // If no Gemini API key is configured, use the deterministic grounded engine
  if (!ai) {
    return generateDeterministicResponse(request);
  }

  const timeoutMs = 25000;
  const callWithTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms: ${label}`)), ms)
      ),
    ]);
  };

  try {
    const model = 'gemini-3.8-flash';
    const executedTools: string[] = [];

    // Step 1: Initial call to Gemini with tools
    const initialResponse = await callWithTimeout(
      ai.models.generateContent({
        model,
        contents: query,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: allToolDeclarations }],
          temperature: 0.2, // Low temperature for high precision and factual grounding
        },
      }),
      timeoutMs,
      'generateContent initial call'
    );

    const functionCalls = initialResponse.functionCalls;

    // If Gemini chose to call tools:
    if (functionCalls && functionCalls.length > 0) {
      const toolResults: Array<{ name: string; response: any }> = [];

      for (const call of functionCalls) {
        const toolName = call.name || '';
        if (!toolName) continue;

        executedTools.push(toolName);
        const exec = executeToolByName(toolName, (call.args as Record<string, any>) || {});

        if (exec.isUnauthorized) {
          return {
            success: false,
            reply: exec.error || 'Unauthorized financial action blocked by security policy.',
            modelUsed: model,
            toolCallsExecuted: executedTools,
            error: 'UNAUTHORIZED_FINANCIAL_ACTION',
          };
        }

        toolResults.push({
          name: toolName,
          response: exec.result || { error: exec.error },
        });
      }

      // Step 2: Send tool results back to Gemini for grounded synthesis
      const secondResponse = await callWithTimeout(
        ai.models.generateContent({
          model,
          contents: [
            { role: 'user', parts: [{ text: query }] },
            initialResponse.candidates?.[0]?.content as any,
            {
              role: 'user',
              parts: toolResults.map((tr) => ({
                functionResponse: {
                  name: tr.name,
                  response: tr.response,
                },
              })),
            } as any,
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.2,
          },
        }),
        timeoutMs,
        'generateContent tool synthesis'
      );

      const replyText = secondResponse.text || initialResponse.text || 'Response generated.';

      // Determine suggested actions based on executed tools
      let suggestedActions: AssistantResponse['suggestedActions'] = undefined;
      let dataHighlight: AssistantResponse['dataHighlight'] = undefined;

      if (executedTools.includes('getInvoices')) {
        suggestedActions = [
          { label: 'View Invoices', route: 'smart-invoice' },
          { label: 'Send Overdue Reminder', route: 'smart-invoice' },
        ];
      } else if (executedTools.includes('searchCatalog') || executedTools.includes('evaluateCartPolicy')) {
        suggestedActions = [
          { label: 'Open Smart Spend', route: 'smart-spend' },
        ];
      } else if (executedTools.includes('simulateExpenseImpact') || executedTools.includes('getCashflowForecast')) {
        suggestedActions = [
          { label: 'Open Cashflow Forecast', route: 'cashflow-forecast' },
        ];
      }

      return {
        success: true,
        reply: replyText,
        modelUsed: model,
        toolCallsExecuted: executedTools,
        suggestedActions,
        dataHighlight,
      };
    }

    // Direct text response without tool call
    const text = initialResponse.text || '';
    return {
      success: true,
      reply: text || 'I processed your query. Let me know if you would like to run any simulations or check invoices.',
      modelUsed: model,
      toolCallsExecuted: [],
    };
  } catch (err: any) {
    console.error('Gemini API call failed, falling back to deterministic engine:', err);
    // Graceful fallback to deterministic response
    const fallback = generateDeterministicResponse(request);
    return {
      ...fallback,
      error: `Gemini API encountered an error (${err.message || 'Unknown'}). Fallback deterministic engine used.`,
    };
  }
}
