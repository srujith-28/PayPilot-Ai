/**
 * Backend Service Interfaces for PayPilot AI
 * Defines clear contracts separating the AI orchestration layer, business logic,
 * storage persistence, and payment gateway providers.
 */

import type {
  UserProfile,
  SpendingMandate,
  Invoice,
  Product,
  CashflowPoint,
  PurchaseApproval,
  ActivityItem,
  PolicyEvaluation,
  AffordabilityResult,
  CartItem,
  InvoiceLineItem,
} from '../types/index.ts';

// ---------------------------------------------------------------------------
// 1. Storage Service Contract (Prepared for Future SQLite / Firestore / Postgres)
// ---------------------------------------------------------------------------

export interface InvoiceFilter {
  status?: Invoice['status'];
  clientId?: string;
  search?: string;
}

export interface IStorageService {
  getUser(userId: string): Promise<UserProfile | null>;
  getSpendingMandate(userId: string): Promise<SpendingMandate>;
  updateSpendingMandate(userId: string, mandate: Partial<SpendingMandate>): Promise<SpendingMandate>;
  
  getProducts(category?: string, query?: string): Promise<Product[]>;
  getProductById(productId: string): Promise<Product | null>;
  
  getInvoices(filter?: InvoiceFilter): Promise<Invoice[]>;
  getInvoiceById(invoiceId: string): Promise<Invoice | null>;
  createInvoice(invoice: Omit<Invoice, 'id' | 'invoiceNumber'>): Promise<Invoice>;
  updateInvoice(invoiceId: string, updates: Partial<Invoice>): Promise<Invoice>;
  
  getCashflowForecast(): Promise<CashflowPoint[]>;
  getApprovals(): Promise<PurchaseApproval[]>;
  createApproval(approval: Omit<PurchaseApproval, 'id'>): Promise<PurchaseApproval>;
  updateApproval(approvalId: string, updates: Partial<PurchaseApproval>): Promise<PurchaseApproval>;
  
  getActivities(limit?: number): Promise<ActivityItem[]>;
  logActivity(activity: Omit<ActivityItem, 'id' | 'timestamp'>): Promise<ActivityItem>;
}

// ---------------------------------------------------------------------------
// 2. Payment Gateway Contract (Prepared for Future PayPal Sandbox / Live)
// ---------------------------------------------------------------------------

export interface PaymentOrderRequest {
  approvalId: string;
  amount: number;
  currency: string;
  items: Array<{
    name: string;
    unitPrice: number;
    quantity: number;
  }>;
  customId?: string;
}

export interface PaymentOrderResult {
  orderId: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED';
  approveUrl?: string;
  isSimulated: boolean;
  simulationNote?: string;
}

export interface PaymentCaptureResult {
  captureId: string;
  orderId: string;
  status: 'COMPLETED' | 'FAILED' | 'PENDING';
  amountCaptured: number;
  currency: string;
  isSimulated: boolean;
  simulationNote?: string;
}

export interface IPaymentGateway {
  name: string;
  isSandbox(): boolean;
  createOrder(request: PaymentOrderRequest): Promise<PaymentOrderResult>;
  captureOrder(orderId: string): Promise<PaymentCaptureResult>;
}

// ---------------------------------------------------------------------------
// 3. Assistant & Tool Execution Contracts
// ---------------------------------------------------------------------------

export interface AssistantRequest {
  message: string;
  context?: {
    currentRoute?: string;
    availableCash?: number;
    minimumReserve?: number;
    cartCount?: number;
  };
}

export interface AssistantResponse {
  success: boolean;
  reply: string;
  modelUsed: string;
  suggestedActions?: Array<{
    label: string;
    route?: string;
  }>;
  dataHighlight?: {
    type: 'invoice' | 'policy' | 'cashflow' | 'spend';
    title: string;
    value: string;
    details: string;
  };
  preparedDraft?: Partial<Invoice>;
  toolCallsExecuted?: string[];
  error?: string;
}
