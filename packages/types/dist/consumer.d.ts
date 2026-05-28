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
    mobile: string;
    email: string;
    aadhaarHash: string;
    panHash: string;
    parivarPehchanPatra?: string;
    incomeCategory: IncomeCategory;
    leadStage: LeadStage;
    projectId: string;
    allocatedUnitId?: string;
    createdAt: Date;
    updatedAt: Date;
    createdByUserId: string;
}
export interface KYCDocument {
    id: string;
    consumerId: string;
    documentType: KYCDocumentType;
    fileUrl: string;
    expiryDate?: Date;
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
    drawPosition?: number;
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
    totalDue: number;
    collected: number;
    overdue: number;
    penalInterestAccrued: number;
    upcomingDueDate?: Date;
}
export interface CreateConsumerInput {
    name: string;
    mobile: string;
    email: string;
    aadhaar: string;
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
//# sourceMappingURL=consumer.d.ts.map