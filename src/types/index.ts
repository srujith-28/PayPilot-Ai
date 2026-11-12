/**
 * PayPilot AI - Core Type Definitions
 */

export type PageRoute = 
  | 'overview' 
  | 'smart-spend' 
  | 'smart-invoice' 
  | 'cashflow-forecast' 
  | 'ai-assistant' 
  | 'activity-approvals' 
  | 'settings';

export type PolicyStatus = 'PASS' | 'NEEDS_REVIEW' | 'BLOCKED';

export type PurchaseState =
  | 'PROPOSED'
  | 'VALIDATING'
  | 'BLOCKED'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'SANDBOX_CHECKOUT'
  | 'BUYER_APPROVED'
  | 'CAPTURED'
  | 'FAILED'
  | 'REJECTED';

export type InvoiceStatus = 'draft' | 'ready' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  companyName: string;
  businessType: 'Freelancer' | 'Small Business' | 'Solo Consultant';
  avatarUrl: string;
  currency: 'USD' | 'EUR' | 'GBP';
  currencySymbol: string;
}

export interface SpendingMandate {
  monthlyBudget: number;
  currentSpentThisMonth: number;
  maxSingleItemLimit: number;
  allowedCategories: string[];
  restrictedCategories: string[];
  expirationDate: string;
  requireReceiptsOver: number;
  lastUpdated: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  vendor: string;
  description: string;
  image: string;
  rating: number;
  reviewsCount: number;
  inStock: boolean;
  specs: Record<string, string>;
  comparisonNotes: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface PolicyRuleResult {
  ruleId: string;
  name: string;
  passed: boolean;
  severity: 'BLOCKING' | 'WARNING' | 'INFO';
  message: string;
  details?: string;
}

export interface PolicyEvaluation {
  status: PolicyStatus;
  summary: string;
  cartTotal: number;
  itemCount: number;
  rules: PolicyRuleResult[];
  canProceedToCheckout: boolean;
  timestamp: string;
}

export interface PurchaseApproval {
  id: string;
  title: string;
  items: {
    productId: string;
    name: string;
    category: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
  totalAmount: number;
  currency?: string;
  requestedBy: string;
  userId?: string;
  requestDate: string;
  approvedAt?: string;
  approvalTimestamp?: string;
  environment?: 'SANDBOX' | string;
  paymentStatus?: 'PENDING' | 'ORDER_CREATED' | 'BUYER_APPROVED' | 'CAPTURED' | 'FAILED' | 'REJECTED';
  state: PurchaseState;
  policyStatus: PolicyStatus;
  policySummary: string;
  ruleViolations?: string[];
  rejectionReason?: string;
  sandboxTransactionId?: string;
  simulationNote: string;
  approvalNotes?: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientCompany?: string;
  description: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxRate: number; // e.g. 0.08 for 8%
  taxAmount: number;
  total: number;
  currency: string;
  paymentTerms: 'Due on Receipt' | 'Net 14' | 'Net 30' | 'Net 60';
  notes?: string;
  remindersSentCount: number;
  lastReminderDate?: string;
  paypalInvoiceId?: string;
  paypalStatus?: string;
  paypalPaymentUrl?: string;
  paidAt?: string;
  settlementType?: 'PAYPAL_VERIFIED' | 'DEMO_MANUAL';
}

export interface Client {
  id: string;
  name: string;
  email: string;
  company: string;
  defaultPaymentTerms: 'Due on Receipt' | 'Net 14' | 'Net 30' | 'Net 60';
  totalBilled: number;
}

export interface CashflowPoint {
  weekIndex: number;
  weekLabel: string;
  dateRange: string;
  startingCash: number;
  expectedIncoming: number;
  expectedOutgoing: number;
  netCash: number;
  projectedEndingCash: number; // P50 (Expected)
  p20EndingCash: number;       // Conservative / Late collections
  p80EndingCash: number;       // Optimistic / Early receipts
  scheduledInvoices: { id: string; client: string; amount: number }[];
  scheduledPurchases: { id: string; name: string; amount: number }[];
}

export interface ActivityItem {
  id: string;
  timestamp: string;
  type: 
    | 'INVOICE_SENT' 
    | 'INVOICE_PAID' 
    | 'INVOICE_CREATED' 
    | 'INVOICE_REMINDER'
    | 'PURCHASE_PROPOSED' 
    | 'PURCHASE_APPROVED' 
    | 'PURCHASE_REJECTED' 
    | 'SANDBOX_CAPTURE' 
    | 'POLICY_VIOLATION' 
    | 'SETTINGS_UPDATED';
  title: string;
  details: string;
  amount?: number;
  status: 'Completed' | 'Pending' | 'Blocked' | 'Simulated';
  resourceId?: string;
  category?: string;
}

export interface AffordabilityResult {
  affordable: boolean;
  purchaseAmount: number;
  targetWeekIndex: number;
  targetWeekLabel: string;
  projectedBalanceBefore: number;
  projectedBalanceAfter: number;
  minimumReserve: number;
  bufferRemaining: number;
  deficitAmount: number;
  lowestProjectedWeekLabel: string;
  lowestProjectedBalanceAfter: number;
  verdict: 'SAFE' | 'CAUTION' | 'CRITICAL_BREACH';
  recommendation: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedActions?: {
    label: string;
    route?: PageRoute;
    actionPayload?: Record<string, unknown>;
  }[];
  dataHighlight?: {
    type: 'invoice' | 'spend' | 'cashflow' | 'policy';
    title: string;
    value: string;
    details: string;
  };
  modelUsed?: string;
  preparedDraft?: Partial<Invoice>;
}
