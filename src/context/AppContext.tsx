import React, { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import type {
  PageRoute,
  UserProfile,
  SpendingMandate,
  Client,
  Invoice,
  Product,
  CartItem,
  PolicyEvaluation,
  CashflowPoint,
  PurchaseApproval,
  ActivityItem,
  AssistantMessage,
  AffordabilityResult,
} from '../types/index.ts';
import {
  initialUser,
  initialMandate,
  initialClients,
  initialInvoices,
  initialProducts,
  initialCashflowForecast,
  initialApprovals,
  initialActivities,
} from '../data/mockData.ts';
import {
  evaluateSpendingPolicy,
  calculateInvoiceTotals,
  simulateAffordability,
  generateDynamicCashflowForecast,
} from '../utils/rules.ts';

interface AppContextType {
  // Navigation
  currentRoute: PageRoute;
  setCurrentRoute: (route: PageRoute) => void;

  // User & Balances (clearly labeled as DEMO)
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  availableDemoCash: number;
  minimumCashReserve: number;
  setMinimumCashReserve: (amount: number) => void;

  // Spending Mandate
  mandate: SpendingMandate;
  updateMandate: (updates: Partial<SpendingMandate>) => void;

  // Products & Cart
  products: Product[];
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  policyEvaluation: PolicyEvaluation;

  // Approvals & Purchase State Machine
  approvals: PurchaseApproval[];
  selectedApproval: PurchaseApproval | null;
  setSelectedApproval: (appr: PurchaseApproval | null) => void;
  addApprovedPurchase: (approval: PurchaseApproval) => void;
  proposeCartPurchase: () => PurchaseApproval | null;
  approvePurchase: (approvalId: string, notes?: string) => void;
  rejectPurchase: (approvalId: string, reason?: string) => void;
  confirmSandboxCheckout: (approvalId: string) => void;
  recordSandboxCapture: (approvalId: string, orderId: string, captureId: string, amount: number) => void;

  // Invoices & Clients
  invoices: Invoice[];
  clients: Client[];
  selectedInvoice: Invoice | null;
  setSelectedInvoice: (inv: Invoice | null) => void;
  addInvoice: (invoiceData: Omit<Invoice, 'id' | 'invoiceNumber'>) => Invoice;
  updateInvoice: (invoiceId: string, updates: Partial<Invoice>) => void;
  sendInvoice: (invoiceId: string) => void;
  markInvoicePaid: (invoiceId: string, settlementType?: 'PAYPAL_VERIFIED' | 'DEMO_MANUAL') => void;
  sendInvoiceReminder: (invoiceId: string, note?: string) => void;

  // Cashflow & Affordability
  cashflowForecast: CashflowPoint[];
  affordabilitySimulation: AffordabilityResult;
  simulatedPurchaseAmount: number;
  setSimulatedPurchaseAmount: (amount: number) => void;
  simulatedTargetWeek: number;
  setSimulatedTargetWeek: (weekIndex: number) => void;

  // Activities
  activities: ActivityItem[];
  logActivity: (item: Omit<ActivityItem, 'id' | 'timestamp'>) => void;

  // AI Assistant
  assistantMessages: AssistantMessage[];
  isAssistantLoading: boolean;
  sendAssistantMessage: (userText: string) => void;
  resetAssistantChat: () => void;

  // Global Actions
  resetAllDemoData: () => void;

  // Active Modals
  activeModal: 'CREATE_INVOICE' | 'INVOICE_PREVIEW' | 'REMINDER' | 'PURCHASE_REVIEW' | 'SANDBOX_CHECKOUT' | null;
  setActiveModal: (modal: 'CREATE_INVOICE' | 'INVOICE_PREVIEW' | 'REMINDER' | 'PURCHASE_REVIEW' | 'SANDBOX_CHECKOUT' | null) => void;
  checkoutApproval: PurchaseApproval | null;
  setCheckoutApproval: (approval: PurchaseApproval | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = 'paypilot_demo_state_v1';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Navigation
  const [currentRoute, setCurrentRoute] = useState<PageRoute>('overview');

  // Load from localStorage or defaults
  const [user, setUser] = useState<UserProfile>(initialUser);
  const [mandate, setMandate] = useState<SpendingMandate>(initialMandate);
  const [minimumCashReserve, setMinimumCashReserve] = useState<number>(6000);
  const [availableDemoCash, setAvailableDemoCash] = useState<number>(14250);

  const [products] = useState<Product[]>(initialProducts);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [clients] = useState<Client[]>(initialClients);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const [approvals, setApprovals] = useState<PurchaseApproval[]>(initialApprovals);
  const [selectedApproval, setSelectedApproval] = useState<PurchaseApproval | null>(null);
  const [checkoutApproval, setCheckoutApproval] = useState<PurchaseApproval | null>(null);

  const cashflowForecast = useMemo(() => {
    return generateDynamicCashflowForecast({
      openingCash: availableDemoCash,
      invoices,
      approvals,
      minimumReserve: minimumCashReserve,
    });
  }, [availableDemoCash, invoices, approvals, minimumCashReserve]);

  const [simulatedPurchaseAmount, setSimulatedPurchaseAmount] = useState<number>(450);
  const [simulatedTargetWeek, setSimulatedTargetWeek] = useState<number>(1); // Week 2

  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);

  // Modals
  const [activeModal, setActiveModal] = useState<
    'CREATE_INVOICE' | 'INVOICE_PREVIEW' | 'REMINDER' | 'PURCHASE_REVIEW' | 'SANDBOX_CHECKOUT' | null
  >(null);

  // Assistant initial messages
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
    {
      id: 'msg-init',
      role: 'assistant',
      content:
        "Hello Jordan, I'm PayPilot, your financial copilot. I continuously monitor your incoming invoices, outgoing cash flow, and purchase policies. How can I help you optimize your money today?",
      timestamp: 'Just now',
      suggestedActions: [
        { label: 'Which invoices are overdue?', route: 'smart-invoice' },
        { label: 'Can I afford an $80 purchase this week?', route: 'cashflow-forecast' },
        { label: 'Draft an invoice for my latest project', route: 'smart-invoice' },
        { label: 'Explain why cart was blocked', route: 'smart-spend' },
      ],
    },
  ]);

  const [isAssistantLoading, setIsAssistantLoading] = useState<boolean>(false);

  // Activity logger helper
  const logActivity = (item: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    const now = new Date();
    const timeStr = `${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    const newItem: ActivityItem = {
      ...item,
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: timeStr,
    };
    setActivities((prev) => [newItem, ...prev]);
  };

  // Evaluate cart policy deterministically on every change
  const policyEvaluation = useMemo(() => {
    return evaluateSpendingPolicy(cart, mandate, availableDemoCash, minimumCashReserve);
  }, [cart, mandate, availableDemoCash, minimumCashReserve]);

  // Cart operations
  const addToCart = (product: Product, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => setCart([]);

  // Mandate updates
  const updateMandate = (updates: Partial<SpendingMandate>) => {
    setMandate((prev) => {
      const updated = { ...prev, ...updates, lastUpdated: new Date().toISOString().split('T')[0] };
      logActivity({
        type: 'SETTINGS_UPDATED',
        title: 'Spending Mandate Policy Updated',
        details: `Monthly budget: $${updated.monthlyBudget.toFixed(2)}, Single item limit: $${updated.maxSingleItemLimit.toFixed(2)}`,
        status: 'Completed',
        category: 'Policy',
      });
      return updated;
    });
  };

  // Affordability simulation calculation
  const affordabilitySimulation = useMemo(() => {
    return simulateAffordability(
      cashflowForecast,
      simulatedPurchaseAmount,
      simulatedTargetWeek,
      minimumCashReserve
    );
  }, [cashflowForecast, simulatedPurchaseAmount, simulatedTargetWeek, minimumCashReserve]);

  // Propose cart purchase to approval workflow
  const proposeCartPurchase = (): PurchaseApproval | null => {
    if (cart.length === 0) return null;

    const evaluation = evaluateSpendingPolicy(cart, mandate, availableDemoCash, minimumCashReserve);
    const newApproval: PurchaseApproval = {
      id: `appr-${Date.now()}`,
      title: cart.map((i) => i.product.name).join(' + '),
      items: cart.map((i) => ({
        productId: i.product.id,
        name: i.product.name,
        category: i.product.category,
        quantity: i.quantity,
        unitPrice: i.product.price,
        subtotal: Math.round(i.quantity * i.product.price * 100) / 100,
      })),
      totalAmount: evaluation.cartTotal,
      requestedBy: `${user.name} (Direct Checkout)`,
      userId: user.id,
      requestDate: new Date().toISOString(),
      state: evaluation.status === 'BLOCKED' ? 'BLOCKED' : 'AWAITING_APPROVAL',
      policyStatus: evaluation.status,
      policySummary: evaluation.summary,
      ruleViolations: evaluation.rules.filter((r) => !r.passed).map((r) => r.message),
      simulationNote:
        evaluation.status === 'BLOCKED'
          ? 'Automatic checkout disabled due to policy violation.'
          : 'Ready for Sandbox Checkout. Explicit user confirmation required.',
    };

    setApprovals((prev) => [newApproval, ...prev]);

    logActivity({
      type: evaluation.status === 'BLOCKED' ? 'POLICY_VIOLATION' : 'PURCHASE_PROPOSED',
      title: `Proposed Purchase: ${newApproval.title.substring(0, 40)}...`,
      details: evaluation.summary,
      amount: newApproval.totalAmount,
      status: evaluation.status === 'BLOCKED' ? 'Blocked' : 'Pending',
      resourceId: newApproval.id,
      category: 'Spend',
    });

    return newApproval;
  };

  const addApprovedPurchase = (approval: PurchaseApproval) => {
    setApprovals((prev) => [approval, ...prev.filter((a) => a.id !== approval.id)]);
    logActivity({
      type: 'PURCHASE_APPROVED',
      title: `Purchase Approved: ${approval.title.substring(0, 35)}...`,
      details: `Approved by Jordan Miller. Amount: $${approval.totalAmount.toFixed(2)}. Ready for Sandbox Checkout.`,
      amount: approval.totalAmount,
      status: 'Completed',
      resourceId: approval.id,
      category: 'Spend',
    });
  };

  // State transitions for approvals
  const approvePurchase = (approvalId: string, notes?: string) => {
    setApprovals((prev) =>
      prev.map((appr) => {
        if (appr.id === approvalId) {
          const updated: PurchaseApproval = {
            ...appr,
            state: 'APPROVED',
            approvalNotes: notes || 'Approved by user.',
            simulationNote: 'Approved. Proceed to simulated Sandbox Checkout to complete capture.',
          };
          return updated;
        }
        return appr;
      })
    );

    const appr = approvals.find((a) => a.id === approvalId);
    if (appr) {
      logActivity({
        type: 'PURCHASE_APPROVED',
        title: `Purchase Approved: ${appr.title.substring(0, 35)}...`,
        details: `Approved by Jordan Miller. Amount: $${appr.totalAmount.toFixed(2)}. Ready for Sandbox Checkout.`,
        amount: appr.totalAmount,
        status: 'Completed',
        resourceId: appr.id,
        category: 'Spend',
      });
    }
  };

  const rejectPurchase = (approvalId: string, reason?: string) => {
    setApprovals((prev) =>
      prev.map((appr) => {
        if (appr.id === approvalId) {
          return {
            ...appr,
            state: 'REJECTED',
            rejectionReason: reason || 'Declined by user during review.',
            simulationNote: 'Purchase was rejected. No funds will be captured.',
          };
        }
        return appr;
      })
    );

    const appr = approvals.find((a) => a.id === approvalId);
    if (appr) {
      logActivity({
        type: 'PURCHASE_REJECTED',
        title: `Purchase Rejected: ${appr.title.substring(0, 35)}...`,
        details: reason || 'Declined by user during policy review.',
        amount: appr.totalAmount,
        status: 'Completed',
        resourceId: appr.id,
        category: 'Spend',
      });
    }
  };

  const confirmSandboxCheckout = (approvalId: string) => {
    const txId = `SIM-TX-${Math.floor(100000 + Math.random() * 900000)}`;

    setApprovals((prev) =>
      prev.map((appr) => {
        if (appr.id === approvalId) {
          return {
            ...appr,
            state: 'CAPTURED',
            sandboxTransactionId: txId,
            simulationNote: `SIMULATED CAPTURE: Demo transaction ${txId} finalized. No real funds were deducted.`,
          };
        }
        return appr;
      })
    );

    const appr = approvals.find((a) => a.id === approvalId);
    if (appr) {
      // Deduct from demo cash and update mandate spend
      setAvailableDemoCash((prev) => Math.max(0, prev - appr.totalAmount));
      setMandate((prev) => ({
        ...prev,
        currentSpentThisMonth: Math.round((prev.currentSpentThisMonth + appr.totalAmount) * 100) / 100,
      }));

      logActivity({
        type: 'SANDBOX_CAPTURE',
        title: `Simulated Sandbox Capture: ${appr.title.substring(0, 35)}...`,
        details: `Simulated PayPal Sandbox order ${txId} captured. Amount: $${appr.totalAmount.toFixed(2)}. Demo cash adjusted.`,
        amount: appr.totalAmount,
        status: 'Simulated',
        resourceId: txId,
        category: 'Spend',
      });

      // Clear cart if this was the cart purchase
      clearCart();
    }
  };

  const recordSandboxCapture = (
    approvalId: string,
    orderId: string,
    captureId: string,
    amount: number
  ) => {
    setApprovals((prev) =>
      prev.map((appr) => {
        if (appr.id === approvalId) {
          return {
            ...appr,
            state: 'CAPTURED',
            sandboxTransactionId: captureId,
            simulationNote: `PayPal Sandbox Order ${orderId} captured (${captureId}). Amount: $${amount.toFixed(2)}.`,
          };
        }
        return appr;
      })
    );

    setAvailableDemoCash((prev) => Math.max(0, prev - amount));
    setMandate((prev) => ({
      ...prev,
      currentSpentThisMonth: Math.round((prev.currentSpentThisMonth + amount) * 100) / 100,
    }));

    const appr = approvals.find((a) => a.id === approvalId);
    logActivity({
      type: 'SANDBOX_CAPTURE',
      title: `PayPal Sandbox Capture: ${appr ? appr.title.substring(0, 30) : `Order ${orderId}`}`,
      details: `PayPal Sandbox Order ${orderId} successfully captured (Capture ID: ${captureId}). Amount: $${amount.toFixed(2)}.`,
      amount,
      status: 'Simulated',
      resourceId: captureId,
      category: 'Spend',
    });

    clearCart();
  };

  // Invoice management
  const addInvoice = (invoiceData: Omit<Invoice, 'id' | 'invoiceNumber'>): Invoice => {
    const nextNum = invoices.length + 89;
    const invoiceNumber = `INV-2026-${String(nextNum).padStart(3, '0')}`;
    const newInvoice: Invoice = {
      ...invoiceData,
      id: `inv-${Date.now()}`,
      invoiceNumber,
      remindersSentCount: 0,
    };

    setInvoices((prev) => [newInvoice, ...prev]);

    logActivity({
      type: 'INVOICE_CREATED',
      title: `Invoice Created: ${newInvoice.invoiceNumber}`,
      details: `${newInvoice.clientName} (${newInvoice.clientCompany || 'Client'}) for $${newInvoice.total.toFixed(2)}. Status: ${newInvoice.status.toUpperCase()}.`,
      amount: newInvoice.total,
      status: 'Completed',
      resourceId: newInvoice.id,
      category: 'Invoicing',
    });

    return newInvoice;
  };

  const updateInvoice = (invoiceId: string, updates: Partial<Invoice>) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === invoiceId ? { ...inv, ...updates } : inv))
    );
  };

  const sendInvoice = (invoiceId: string) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          return {
            ...inv,
            status: 'sent',
            issueDate: new Date().toISOString().split('T')[0],
          };
        }
        return inv;
      })
    );

    const inv = invoices.find((i) => i.id === invoiceId);
    if (inv) {
      logActivity({
        type: 'INVOICE_SENT',
        title: `Invoice Dispatched (Demo): ${inv.invoiceNumber}`,
        details: `Simulated email transmission to ${inv.clientEmail}. Amount: $${inv.total.toFixed(2)}. Due: ${inv.dueDate}.`,
        amount: inv.total,
        status: 'Completed',
        resourceId: inv.id,
        category: 'Invoicing',
      });
    }
  };

  const markInvoicePaid = (
    invoiceId: string,
    settlementType: 'PAYPAL_VERIFIED' | 'DEMO_MANUAL' = 'DEMO_MANUAL'
  ) => {
    let paidAmount = 0;
    const nowIso = new Date().toISOString();
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          paidAmount = inv.total;
          return {
            ...inv,
            status: 'paid',
            paidAt: nowIso,
            settlementType,
          };
        }
        return inv;
      })
    );

    // Increase demo cash balance
    setAvailableDemoCash((prev) => prev + paidAmount);

    const inv = invoices.find((i) => i.id === invoiceId);
    if (inv) {
      logActivity({
        type: 'INVOICE_PAID',
        title: `Invoice Paid (${settlementType === 'PAYPAL_VERIFIED' ? 'PayPal Verified' : 'Demo Manual'}): ${inv.invoiceNumber}`,
        details: `Received full settlement of $${inv.total.toFixed(2)} from ${inv.clientName} via ${settlementType === 'PAYPAL_VERIFIED' ? 'PayPal Sandbox API' : 'manual demo settlement'}. Demo cash updated.`,
        amount: inv.total,
        status: 'Completed',
        resourceId: inv.id,
        category: 'Invoicing',
      });
    }
  };

  const sendInvoiceReminder = (invoiceId: string, note?: string) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          return {
            ...inv,
            remindersSentCount: inv.remindersSentCount + 1,
            lastReminderDate: new Date().toISOString().split('T')[0],
          };
        }
        return inv;
      })
    );

    const inv = invoices.find((i) => i.id === invoiceId);
    if (inv) {
      logActivity({
        type: 'INVOICE_REMINDER',
        title: `Payment Reminder Sent: ${inv.invoiceNumber}`,
        details: note || `Dispatched automated overdue notice to ${inv.clientEmail} for $${inv.total.toFixed(2)}.`,
        amount: inv.total,
        status: 'Completed',
        resourceId: inv.id,
        category: 'Invoicing',
      });
    }
  };

  // Conversational Assistant implementation (calls server-side Gemini endpoint with resilient fallback)
  const sendAssistantMessage = async (userText: string) => {
    const userMsg: AssistantMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: 'Just now',
    };

    setAssistantMessages((prev) => [...prev, userMsg]);
    setIsAssistantLoading(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          context: {
            currentRoute,
            availableCash: availableDemoCash,
            minimumReserve: minimumCashReserve,
            cartCount: cart.length,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.reply) {
          const assistantMsg: AssistantMessage = {
            id: `ast-${Date.now()}`,
            role: 'assistant',
            content: data.reply,
            timestamp: 'Just now',
            suggestedActions: data.suggestedActions,
            dataHighlight: data.dataHighlight,
            modelUsed: data.modelUsed,
            preparedDraft: data.preparedDraft,
          };
          setAssistantMessages((prev) => [...prev, assistantMsg]);
          setIsAssistantLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('API call to /api/assistant failed, falling back to local engine:', err);
    }

    // Local deterministic fallback engine
    const lower = userText.toLowerCase();
    let reply = '';
    let suggestedActions: AssistantMessage['suggestedActions'] = undefined;
    let dataHighlight: AssistantMessage['dataHighlight'] = undefined;

    if (lower.includes('overdue') || (lower.includes('which') && lower.includes('invoice'))) {
      const overdue = invoices.filter((i) => i.status === 'overdue');
      if (overdue.length > 0) {
        reply = `You currently have ${overdue.length} overdue invoice: ${overdue.map((i) => `${i.invoiceNumber} for ${i.clientName} ($${i.total.toFixed(2)}, due ${i.dueDate})`).join(', ')}. I recommend dispatching a polite payment reminder.`;
        suggestedActions = [
          { label: 'View Overdue Invoices', route: 'smart-invoice' },
          { label: 'Send Overdue Reminder', route: 'smart-invoice' },
        ];
        dataHighlight = {
          type: 'invoice',
          title: overdue[0].invoiceNumber,
          value: `$${overdue[0].total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          details: `Client: ${overdue[0].clientCompany || overdue[0].clientName} · Due ${overdue[0].dueDate}`,
        };
      } else {
        reply = 'Good news! None of your active invoices are overdue. All outstanding receivables are within their agreed terms.';
      }
    } else if (lower.includes('afford') || lower.includes('purchase') || lower.includes('$80') || lower.includes('spend')) {
      const match = userText.match(/\$?(\d+(?:\.\d{1,2})?)/);
      const testAmount = match ? parseFloat(match[1]) : 80;
      const sim = simulateAffordability(cashflowForecast, testAmount, 0, minimumCashReserve);

      reply = `I evaluated an expense of $${testAmount.toFixed(2)} against your 12-week forecast and $${minimumCashReserve.toLocaleString()} minimum cash reserve:\n\n• Available Demo Cash: $${availableDemoCash.toLocaleString()}\n• Lowest Projected Cash: $${sim.lowestProjectedBalanceAfter.toLocaleString()} in ${sim.lowestProjectedWeekLabel}\n• Safety Buffer: $${sim.bufferRemaining.toLocaleString()} above floor\n\nVerdict: ${sim.verdict === 'SAFE' ? 'Safe to proceed.' : sim.verdict === 'CAUTION' ? 'Proceed with caution (tight buffer).' : 'Blocked / High Risk of reserve breach.'} ${sim.recommendation}`;
      suggestedActions = [
        { label: 'Simulate in Cashflow Planner', route: 'cashflow-forecast' },
        { label: 'Browse Smart Spend Catalog', route: 'smart-spend' },
      ];
      dataHighlight = {
        type: 'cashflow',
        title: 'Affordability Simulation',
        value: sim.verdict === 'SAFE' ? 'Approved (Safe)' : 'Caution',
        details: `Buffer after purchase: $${sim.bufferRemaining.toLocaleString()} above minimum reserve`,
      };
    } else if (lower.includes('late') && (lower.includes('client') || lower.includes('reserve') || lower.includes('two'))) {
      reply = `If Acme Technologies ($5,200) and Beacon Health ($3,800) both delay payment by 3 weeks, your Week 2 cash receipts drop from $9,000 to $0. Under this stress scenario (reflected in our P20 forecast line), your cash balance in Week 2 would be approximately $12,000, which still protects your $${minimumCashReserve.toLocaleString()} minimum reserve floor without causing insolvency.`;
      suggestedActions = [
        { label: 'Inspect P20 Forecast Band', route: 'cashflow-forecast' },
      ];
    } else if (lower.includes('block') || lower.includes('policy') || lower.includes('mandate')) {
      reply = `PayPilot's deterministic spending policy protects your liquidity by enforcing 4 strict guardrails:\n1. Allowed Categories (${mandate.allowedCategories.join(', ')})\n2. Single-Item Ceiling ($${mandate.maxSingleItemLimit.toFixed(2)})\n3. Monthly Budget ($${mandate.monthlyBudget.toFixed(2)})\n4. Minimum Cash Reserve Floor ($${minimumCashReserve.toFixed(2)})\n\nIf any item exceeds $${mandate.maxSingleItemLimit.toFixed(2)} or belongs to a restricted category like Luxury Goods, checkout is blocked by application code.`;
      suggestedActions = [
        { label: 'Review Spending Mandate', route: 'settings' },
        { label: 'Inspect Pending Approvals', route: 'activity-approvals' },
      ];
      dataHighlight = {
        type: 'policy',
        title: 'Active Mandate',
        value: `$${mandate.monthlyBudget.toLocaleString()} / mo`,
        details: `Single-item ceiling: $${mandate.maxSingleItemLimit} · Allowed: ${mandate.allowedCategories.length} categories`,
      };
    } else if (lower.includes('draft') || (lower.includes('create') && lower.includes('invoice'))) {
      reply = `I can help you prepare an invoice right away. Click 'Open Invoice Builder' to prepopulate line items, or type prompt like 'Create a $1,200 invoice for website design, due in 14 days'. I will calculate taxes and totals automatically and let you review before sending.`;
      suggestedActions = [
        { label: 'Open Invoice Builder', route: 'smart-invoice' },
      ];
    } else {
      reply = `I analyzed your current financial status:\n\n• Available Demo Cash: $${availableDemoCash.toLocaleString()}\n• Outstanding Invoices: $${invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total, 0).toLocaleString()}\n• Monthly Mandate Remaining: $${Math.max(0, mandate.monthlyBudget - mandate.currentSpentThisMonth).toLocaleString()}\n• Pending Approvals: ${approvals.filter((a) => a.state === 'AWAITING_APPROVAL').length}\n\nWhat would you like to drill into next?`;
      suggestedActions = [
        { label: 'Check Cashflow Forecast', route: 'cashflow-forecast' },
        { label: 'Browse Smart Spend', route: 'smart-spend' },
        { label: 'View Smart Invoices', route: 'smart-invoice' },
      ];
    }

    setTimeout(() => {
      const assistantMsg: AssistantMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: 'Just now',
        suggestedActions,
        dataHighlight,
        modelUsed: 'deterministic-grounded-engine',
      };
      setAssistantMessages((prev) => [...prev, assistantMsg]);
      setIsAssistantLoading(false);
    }, 250);
  };

  const resetAssistantChat = () => {
    setAssistantMessages([
      {
        id: 'msg-reset',
        role: 'assistant',
        content: "Chat session refreshed. How can I help you analyze your finances, invoices, or planned purchases?",
        timestamp: 'Just now',
        suggestedActions: [
          { label: 'Which invoices are overdue?', route: 'smart-invoice' },
          { label: 'Can I afford an $80 purchase this week?', route: 'cashflow-forecast' },
          { label: 'Explain why cart was blocked', route: 'smart-spend' },
        ],
      },
    ]);
  };

  const resetAllDemoData = () => {
    setUser(initialUser);
    setMandate(initialMandate);
    setMinimumCashReserve(6000);
    setAvailableDemoCash(14250);
    setCart([]);
    setInvoices(initialInvoices);
    setApprovals(initialApprovals);
    setActivities(initialActivities);
    setSimulatedPurchaseAmount(450);
    setSimulatedTargetWeek(1);
    resetAssistantChat();
    setActiveModal(null);
    fetch('/api/reset-data', { method: 'POST' }).catch((err) => {
      console.warn('Could not reset server stores:', err);
    });
    logActivity({
      type: 'SETTINGS_UPDATED',
      title: 'Demo Environment Reset',
      details: 'Restored initial sample clients, invoices, mandate rules, and cashflow data.',
      status: 'Completed',
      category: 'System',
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentRoute,
        setCurrentRoute,
        user,
        setUser,
        availableDemoCash,
        minimumCashReserve,
        setMinimumCashReserve,
        mandate,
        updateMandate,
        products,
        cart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        policyEvaluation,
        approvals,
        selectedApproval,
        setSelectedApproval,
        addApprovedPurchase,
        proposeCartPurchase,
        approvePurchase,
        rejectPurchase,
        confirmSandboxCheckout,
        recordSandboxCapture,
        invoices,
        clients,
        selectedInvoice,
        setSelectedInvoice,
        addInvoice,
        updateInvoice,
        sendInvoice,
        markInvoicePaid,
        sendInvoiceReminder,
        cashflowForecast,
        affordabilitySimulation,
        simulatedPurchaseAmount,
        setSimulatedPurchaseAmount,
        simulatedTargetWeek,
        setSimulatedTargetWeek,
        activities,
        logActivity,
        assistantMessages,
        isAssistantLoading,
        sendAssistantMessage,
        resetAssistantChat,
        resetAllDemoData,
        activeModal,
        setActiveModal,
        checkoutApproval,
        setCheckoutApproval,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
