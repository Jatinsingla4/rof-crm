import { z } from 'zod';

// ============================================
// Consumer Schemas
// ============================================

export const ConsumerCreateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  mobile: z.string().regex(/^[0-9]{10}$/, 'Mobile must be 10 digits'),
  email: z.string().email().optional(),
  aadhaar: z.string().optional(),
  pan: z.string().optional(),
  incomeCategory: z.enum(['ews', 'lig', 'mig']),
  projectId: z.string().uuid('Invalid project ID'),
});

export const ConsumerUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  incomeCategory: z.enum(['ews', 'lig', 'mig']).optional(),
  leadStage: z.string().optional(),
});

export type ConsumerCreate = z.infer<typeof ConsumerCreateSchema>;
export type ConsumerUpdate = z.infer<typeof ConsumerUpdateSchema>;

// ============================================
// Unit Schemas
// ============================================

export const UnitCreateSchema = z.object({
  projectId: z.string().uuid(),
  tower: z.string().min(1),
  floor: z.number().int().positive(),
  unitNumber: z.string().min(1),
  bhkType: z.enum(['1bhk', '2bhk', 'studio']),
  carpetAreaSqm: z.number().positive(),
  superAreaSqm: z.number().positive(),
  basePriceInr: z.number().positive(),
  totalPriceInr: z.number().positive(),
  facing: z.enum(['north', 'south', 'east', 'west']).optional(),
  floorPlanUrl: z.string().url().optional(),
});

export type UnitCreate = z.infer<typeof UnitCreateSchema>;

// ============================================
// Allocation Schemas
// ============================================

export const AllocationCreateSchema = z.object({
  consumerId: z.string().uuid(),
  unitId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export const AllocationCancelSchema = z.object({
  allocationId: z.string().uuid(),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
});

export type AllocationCreate = z.infer<typeof AllocationCreateSchema>;
export type AllocationCancel = z.infer<typeof AllocationCancelSchema>;

// ============================================
// Payment Schemas
// ============================================

export const PaymentPlanCreateSchema = z.object({
  allocationId: z.string().uuid(),
  consumerId: z.string().uuid(),
  unitId: z.string().uuid(),
  projectId: z.string().uuid(),
  totalAmountInr: z.number().positive('Total amount must be positive'),
});

export const ReceiptRecordSchema = z.object({
  paymentPlanId: z.string().uuid(),
  installmentIndex: z.number().int().positive(),
  amountReceivedInr: z.number().positive('Amount must be positive'),
  paymentMethod: z.enum(['bank_transfer', 'cheque', 'neft', 'rtgs', 'upi']),
  transactionRef: z.string().optional(),
  receivedDate: z.string().date(),
});

export type PaymentPlanCreate = z.infer<typeof PaymentPlanCreateSchema>;
export type ReceiptRecord = z.infer<typeof ReceiptRecordSchema>;

// ============================================
// Document Schemas
// ============================================

export const DocumentTemplateCreateSchema = z.object({
  projectId: z.string().uuid(),
  documentType: z.enum([
    'allotment_letter',
    'demand_letter',
    'receipt',
    'bba',
    'noc',
    'possession_letter',
    'cancellation_letter',
    'welcome_letter',
  ]),
  title: z.string().min(3),
  htmlContent: z.string().min(10),
  mergeFields: z.array(z.string()).optional(),
});

export const DocumentGenerateSchema = z.object({
  consumerId: z.string().uuid(),
  allocationId: z.string().uuid().optional(),
  templateId: z.string().uuid(),
  mergeData: z.record(z.any()),
  deliveryMethod: z.enum(['email', 'whatsapp', 'sms']).optional(),
});

export type DocumentTemplateCreate = z.infer<typeof DocumentTemplateCreateSchema>;
export type DocumentGenerate = z.infer<typeof DocumentGenerateSchema>;

// ============================================
// Communication Schemas
// ============================================

export const RemarkCreateSchema = z.object({
  consumerId: z.string().uuid(),
  channel: z.enum(['call', 'email', 'whatsapp', 'sms', 'chat', 'in_person', 'system']),
  subject: z.string().optional(),
  notes: z.string().optional(),
  followUpDate: z.string().date().optional(),
  tags: z.array(z.string()).optional(),
});

export const EmailSendSchema = z.object({
  consumerId: z.string().uuid(),
  recipientEmail: z.string().email('Invalid email'),
  subject: z.string().min(5),
  htmlBody: z.string().min(10),
  templateId: z.string().optional(),
});

export const WhatsAppSendSchema = z.object({
  consumerId: z.string().uuid(),
  recipientPhone: z.string().regex(/^[+]?[0-9]{10,15}$/, 'Invalid phone number'),
  message: z.string().min(1).max(1024),
  templateId: z.string().optional(),
});

export const SmsSendSchema = z.object({
  consumerId: z.string().uuid(),
  recipientPhone: z.string().regex(/^[+]?[0-9]{10,15}$/, 'Invalid phone number'),
  message: z.string().min(1).max(160),
});

export const TicketCreateSchema = z.object({
  consumerId: z.string().uuid(),
  subject: z.string().min(5),
  description: z.string().min(10),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assignedToUserId: z.string().uuid().optional(),
});

export type RemarkCreate = z.infer<typeof RemarkCreateSchema>;
export type EmailSend = z.infer<typeof EmailSendSchema>;
export type WhatsAppSend = z.infer<typeof WhatsAppSendSchema>;
export type SmsSend = z.infer<typeof SmsSendSchema>;
export type TicketCreate = z.infer<typeof TicketCreateSchema>;

// ============================================
// User Schemas
// ============================================

export const UserCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  mobile: z.string().regex(/^[0-9]{10}$/).optional(),
  role: z.enum(['super_admin', 'project_manager', 'sales_executive', 'accounts_finance', 'support_agent', 'read_only_viewer']),
  assignedProjectIds: z.array(z.string().uuid()).optional(),
});

export const UserUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  mobile: z.string().regex(/^[0-9]{10}$/).optional(),
  role: z.string().optional(),
  assignedProjectIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const PasswordChangeSchema = z.object({
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
});

export type UserCreate = z.infer<typeof UserCreateSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type PasswordChange = z.infer<typeof PasswordChangeSchema>;

// ============================================
// Helper Functions
// ============================================

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { valid: boolean; data?: T; errors?: Record<string, string> } {
  try {
    const parsed = schema.parse(data);
    return { valid: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        errors[path] = err.message;
      });
      return { valid: false, errors };
    }
    return { valid: false, errors: { general: 'Validation error' } };
  }
}

// Custom field validators
export const validators = {
  phone: (value: string) => /^[0-9]{10}$/.test(value),
  email: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  aadhaar: (value: string) => /^[0-9]{12}$/.test(value),
  pan: (value: string) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value),
  date: (value: string) => !isNaN(Date.parse(value)),
  amount: (value: number) => value > 0,
  percentage: (value: number) => value >= 0 && value <= 100,
};
