/**
 * Consumer Types - ROF CRM
 * 360° consumer profile with KYC, lead stages, application history
 */

export type LeadStage = 'enquiry' | 'interested' | 'application_filed' | 'draw_entered' | 'allotted' | 'onboarded' | 'cancelled';
export type IncomeCategory = 'EWS' | 'LIG' | 'MIG';
export type KYCDocumentType = 'aadhaar' | 'pan' | 'income_cert' | 'affidavit' | 'bank_details' | 'photo' | 'address_proof';
export type RelationshipType = 'spouse' | 'child' | 'parent' | 'sibling' | 'other';
export type DrawResult = 'allotted' | 'waitlist' | 'unsuccessful';

export interface Consumer {
  id: string;
  name: string;
  photoUrl?: string;
  mobile: string; // Unique per project
  email: string;
  aadhaarHash: string; // SHA256 + salt, never stored plaintext
  panHash: string;
  parivarPehchanPatra?: string; // Family ID for one-app-per-family rule
  incomeCategory: IncomeCategory;
  leadStage: LeadStage;
  projectId: string;
  allocatedUnitId?: string; // Unit currently allocated to
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string;
}

export interface KYCDocument {
  id: string;
  consumerId: string;
  documentType: KYCDocumentType;
  fileUrl: string;
  expiryDate?: Date; // For documents with expiry
  uploadedAt: Date;
  uploadedByUserId: string;
  verified: boolean;
}

export interface CoApplicant {
  id: string;
  consumerId: string;
  name: string;
  relationship: RelationshipType;
  aadhaarHash: string;
  panHash: string;
  createdAt: Date;
}

export interface ApplicationHistory {
  id: string;
  consumerId: string;
  drawDate: Date;
  drawResult: DrawResult;
  drawPosition?: number; // Position in e-draw (if allotted/waitlist)
  waitlistPosition?: number;
  createdAt: Date;
}

export interface Remark {
  id: string;
  consumerId: string;
  userId: string;
  timestamp: Date;
  channel: 'call' | 'email' | 'chat' | 'sms' | 'in_person' | 'system';
  subject?: string;
  notes: string;
  followUpDate?: Date;
  followUpAction?: string;
  tags: string[];
}

export interface ConsumerPaymentSummary {
  totalDue: number; // paise
  collected: number; // paise
  overdue: number; // paise
  penalInterestAccrued: number; // paise
  upcomingDueDate?: Date;
}

export interface CreateConsumerInput {
  name: string;
  mobile: string;
  email: string;
  aadhaar: string; // Raw Aadhaar (to be hashed)
  pan: string;
  parivarPehchanPatra?: string;
  incomeCategory: IncomeCategory;
  projectId: string;
}

export interface UpdateConsumerInput {
  name?: string;
  email?: string;
  incomeCategory?: IncomeCategory;
  leadStage?: LeadStage;
}
