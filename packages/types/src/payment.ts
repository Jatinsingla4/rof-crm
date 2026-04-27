/**
 * Payment Types - ROF CRM
 * AHP-compliant payment plans, HRERA Rule 15 interest, demand letters, receipts
 */

export type PaymentMethod = 'bank_transfer' | 'cheque' | 'neft' | 'rtgs' | 'upi';
export type DemandDeliveryChannel = 'email' | 'whatsapp' | 'print';
export type DemandDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'read';
export type RefundStatus = 'initiated' | 'processed' | 'completed';

/**
 * Payment Stage: AHP-compliant structure
 * 5% booking → 20% allotment (15 days) → 6 half-yearly (~12.5% each)
 */
export type PaymentStage = 'booking' | 'allotment' | 'quarter_1' | 'quarter_2' | 'quarter_3' | 'quarter_4' | 'quarter_5' | 'quarter_6';

export interface Installment {
  stage: PaymentStage;
  amountInr: number; // paise
  dueDate: Date;
  daysOfNotice: number; // 15, 7, or 3
  paymentRecordId?: string;
}

export interface PaymentPlan {
  id: string;
  allocationId: string;
  consumerId: string;
  unitId: string;
  projectId: string;
  totalAmountInr: number; // paise
  installments: Installment[]; // 8 installments total
  createdAt: Date;
  createdByUserId: string;
}

export interface Demand {
  id: string;
  paymentPlanId: string;
  installmentIndex: number;
  consumerId: string;
  dueDate: Date;
  amountDueInr: number; // paise
  daysUntilDue: number;
  generatedAt: Date;
  sentVia: DemandDeliveryChannel;
  deliveryStatus: DemandDeliveryStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
}

export interface Receipt {
  id: string;
  paymentPlanId: string;
  installmentIndex: number;
  consumerId: string;
  amountReceivedInr: number; // paise
  paymentMethod: PaymentMethod;
  transactionRef: string; // e.g., UTR for bank transfer
  receivedDate: Date;
  receivedByUserId: string;
  receiptNumber: string; // Auto-generated, numbered
  createdAt: Date;
}

/**
 * HRERA Rule 15: Penal Interest on Overdue Payments
 * Rate: SBI MCLR + 2% (~11.10% per annum)
 * Calculation: I = P × R × T / 100
 * P = principal, R = 11.10%, T = days_overdue / 365
 */
export interface PenalInterest {
  id: string;
  paymentPlanId: string;
  installmentIndex: number;
  consumerId: string;
  principalInr: number; // paise
  daysOverdue: number;
  ratePercent: number; // 11.10 (hardcoded per HRERA Rule 15)
  calculatedAt: Date;
  amountInr: number; // calculated: principal * rate * days / 365 / 100
  status: 'calculated' | 'escalated';
  escalatedAt?: Date;
  escalatedToUserId?: string; // Sales Manager user ID
}

export interface OverdueAgeing {
  id: string;
  paymentPlanId: string;
  bucket: '1_7_days' | '8_14_days' | '15_30_days' | '31_60_days' | '60_plus_days';
  count: number;
  totalAmountInr: number; // paise
  updatedAt: Date;
}

export interface BankStatement {
  id: string;
  projectId: string;
  statementDate: Date;
  bankName: string;
  csvFileUrl: string;
  parsedAt: Date;
}

export interface BankStatementLine {
  id: string;
  bankStatementId: string;
  transactionDate: Date;
  amountInr: number; // paise
  transactionRef: string;
  counterparty: string;
  matchedToReceiptId?: string;
}

export interface Cancellation {
  id: string;
  allocationId: string;
  consumerId: string;
  cancellationDate: Date;
  reason: string;
  forfeitureAmountInr: number; // ₹25,000 + 18% GST = ₹29,500 (hardcoded)
  refundAmountInr: number; // total_received - forfeiture
  refundStatus: RefundStatus;
  createdAt: Date;
}

export interface CreatePaymentPlanInput {
  allocationId: string;
  consumerId: string;
  unitId: string;
  totalAmountInr: number; // paise
}

export interface RecordPaymentInput {
  paymentPlanId: string;
  installmentIndex: number;
  amountReceivedInr: number; // paise
  paymentMethod: PaymentMethod;
  transactionRef: string;
  receivedDate: Date;
}
