-- Migration 007: Add FAQ and Knowledge Base tables
-- Internal staff-facing knowledge base with full-text search
-- Supports articles, categories, tags, and helpful/not helpful feedback

-- ============================================
-- FAQ CATEGORIES TABLE
-- ============================================

CREATE TABLE faq_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FAQ ARTICLES TABLE
-- ============================================

CREATE TABLE faq_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES faq_categories(id),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_published BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  created_by_user_id UUID REFERENCES users(id),
  updated_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_faq_articles_category ON faq_articles(category_id);
CREATE INDEX idx_faq_articles_published ON faq_articles(is_published);
CREATE INDEX idx_faq_articles_search ON faq_articles USING GIN (to_tsvector('english', title || ' ' || content));
CREATE INDEX idx_faq_articles_tags ON faq_articles USING GIN (tags);

-- ============================================
-- SEED INITIAL FAQ DATA
-- ============================================

-- Insert categories
INSERT INTO faq_categories (name, description, sort_order, is_active)
VALUES
  ('Payment Queries', 'Questions about payment calculations, HRERA penal interest, and instalment schedules', 1, true),
  ('Allotment Process', 'E-draw results, allotment letters, waitlist management, and cancellations', 2, true),
  ('Document Requests', 'Document generation, demand letters, receipts, and agreements', 3, true),
  ('Policy & Rules', 'AHP compliance, one-application-per-family rule, and ROF policies', 4, true);

-- Insert articles for Payment Queries category
INSERT INTO faq_articles (category_id, title, content, tags, is_published)
SELECT id, 'How is penal interest calculated under HRERA Rule 15?',
'# HRERA Rule 15: Penal Interest Calculation

When a buyer misses a payment deadline, ROF applies penal interest per HRERA Rule 15.

## Formula:
Interest = Principal × Rate × Time / 100

## Parameters:
- **Principal**: The overdue amount in INR
- **Rate**: 11.10% per annum (SBI MCLR + 2%)
- **Time**: Number of days overdue / 365

## Example:
If a buyer owes ₹10,00,000 and is 30 days overdue:
Interest = 10,00,000 × 11.10 × (30/365) / 100
Interest ≈ ₹9,123

## Key Points:
- Interest is calculated daily
- The CRM automatically calculates this on the Overdue Demands report
- ROF must communicate the penal interest amount when sending overdue notices
- Buyers have the right to dispute excessive interest if they believe it violates HRERA guidelines
', ARRAY['HRERA', 'interest', 'overdue', 'calculations'], true
FROM faq_categories WHERE name = 'Payment Queries';

INSERT INTO faq_articles (category_id, title, content, tags, is_published)
SELECT id, 'What happens if a customer misses an instalment?',
'# Missed Instalment Policy

Missing an instalment can have serious consequences for both the buyer and their allotment.

## Immediate Actions (Days 1-7):
1. Demand letter is automatically sent
2. Email notification sent to customer
3. WhatsApp reminder sent to customer mobile
4. No penalties applied yet

## Follow-up Actions (Days 8-15):
1. Second demand letter sent (marked as "Final Notice")
2. Escalation to Project Manager
3. Customer support team reaches out directly
4. HRERA penal interest starts accumulating

## Consequences (After 15 Days):
1. Penal interest calculated per HRERA Rule 15 (11.10% p.a.)
2. Allotment may be flagged for cancellation review
3. Customer can be blacklisted for future projects
4. Legal notice may be issued

## Customer Options:
- **Pay in Full**: Clears all arrears and interest
- **Negotiate Payment Plan**: Discuss with Project Manager for EMI arrangement
- **Surrender**: Forfeit ₹25,000 + 18% GST = ₹29,500; remaining amount refunded

## Best Practice:
Contact customers proactively 7-10 days before due date to avoid issues.
', ARRAY['payment', 'missed', 'overdue', 'consequences'], true
FROM faq_categories WHERE name = 'Payment Queries';

-- Insert articles for Allotment Process category
INSERT INTO faq_articles (category_id, title, content, tags, is_published)
SELECT id, 'What is the e-draw process and how are results imported?',
'# E-Draw Process & Results Import

The e-draw (electronic draw/lottery) is conducted by TCP Haryana to allocate AHP units transparently.

## E-Draw Timeline:
1. **Applicants Register**: Buyers submit application on edraw.tcpharyana.gov.in
2. **Government Conducts Draw**: Automated, video-recorded lottery by TCP
3. **Results Published**: Government releases results (Allotted, Waitlist, Unsuccessful)
4. **ROF Downloads**: ROF downloads CSV/Excel from TCP portal
5. **CRM Import**: Results imported into ROF CRM system

## Import Process in CRM:
1. Go to **Allocations > Import E-Draw Results**
2. Upload CSV/Excel file from TCP Haryana portal
3. System matches applicants by Aadhaar hash
4. Matched applicants auto-advance to "Draw Entered" stage
5. Mismatches flagged for manual review

## CSV File Format:
The file should contain columns:
- Applicant ID (or Aadhaar)
- Name
- Unit Type (BHK) preference
- Result (Allotted / Waitlist / Unsuccessful)

## Matching Logic:
- System hashes the Aadhaar in the CSV file
- Compares against hashed Aadhaar in consumer records
- Only matches within the same project

## Common Issues:
| Issue | Solution |
|-------|----------|
| "Applicant not found" | Check if applicant was already registered in CRM |
| Multiple matches | Happens if same Aadhaar has duplicate records; merge consumer records first |
| Import fails | Ensure CSV format matches; re-download fresh file from TCP |

## After Import:
- Next step: Allotment creation for "Allotted" results
- Waitlisted applicants wait for cancellation
- Unsuccessful applicants should be refunded (outside CRM)
', ARRAY['e-draw', 'import', 'allocation', 'tcp'], true
FROM faq_categories WHERE name = 'Allotment Process';

INSERT INTO faq_articles (category_id, title, content, tags, is_published)
SELECT id, 'How does the waitlist promotion work?',
'# Waitlist Promotion Process

When an allotted unit is cancelled or the buyer defaults, the next waitlisted customer is automatically promoted.

## Automatic Promotion:
1. Original allottee cancels or defaults
2. CRM searches for next waitlist candidate with same BHK type in same project
3. Candidate is automatically promoted to allotment
4. Unit reassigned to new allottee
5. Payment plan created; welcome letter sent

## Manual Promotion:
In some cases, ROF may manually select a waitlist candidate:
1. Go to **Allocations > Waitlist**
2. Select candidate to promote
3. Choose available unit of same type
4. System validates match and creates allotment
5. New customer notified

## Candidate Selection:
Waitlist is ordered by:
1. Registration date (FIFO)
2. BHK type preference
3. Project preference
4. Income category (if applicable)

## Customer Communication:
- Promotion letter sent via email + WhatsApp
- Payment plan details shared
- Welcome onboarding call scheduled
- First instalment due within 15 days

## Tracking:
- Waitlist position visible in CRM
- Promotion date recorded in remarks
- Customer journey reflects: Waitlist → Allotted → Onboarded
', ARRAY['waitlist', 'promotion', 'cancellation', 'default'], true
FROM faq_categories WHERE name = 'Allotment Process';

-- Insert articles for Document Requests category
INSERT INTO faq_articles (category_id, title, content, tags, is_published)
SELECT id, 'How do I generate a demand letter for a customer?',
'# Generating Demand Letters

Demand letters notify customers about upcoming or overdue payments.

## Types of Demand Letters:
1. **Pre-Due Reminder** (15 days before): Gentle reminder
2. **Pre-Due Notice** (7 days before): More formal
3. **Demand Letter** (On due date): Official demand
4. **Overdue Notice** (3+ days late): Urgent notice with interest calculation

## Steps to Generate:
1. Go to **Payments > Demand Letters**
2. Filter by:
   - Project
   - Payment Plan
   - Due date range
3. Select customers needing letters
4. Choose template (or custom)
5. Review merge fields (names, amounts, dates auto-populate)
6. Generate PDF or send directly
7. Delivery method: Email, WhatsApp, Print

## Automatic Generation:
- 15-day pre-due reminder: Auto-generated, manual review before send
- 7-day pre-due notice: Auto-generated, manual review before send
- On due date: Auto-generated, sent automatically via email
- Overdue notices: Triggered manually or by sales manager escalation

## Template Fields:
Demand letters include auto-populated fields:
- Customer name & contact
- Payment plan details
- Instalment number and amount
- Due date
- HRERA penal interest (if overdue)
- Bank account details for payment
- Reference number

## Sending:
- Check delivery status (Sent, Delivered, Read)
- Re-send if delivery fails
- Confirm in remarks log when sent
', ARRAY['demand', 'letter', 'template', 'payment'], true
FROM faq_categories WHERE name = 'Document Requests';

INSERT INTO faq_articles (category_id, title, content, tags, is_published)
SELECT id, 'What documents are needed for a No Objection Certificate (NOC)?',
'# No Objection Certificate (NOC) Requirements

A No Objection Certificate is required before a buyer can register their property with the government.

## What is an NOC?
An NOC from ROF confirms that:
- All payments have been made in full
- No dues are outstanding
- The buyer is in good standing
- Property transfer is authorized

## When is NOC Needed?
- Before property registration
- For property mutation
- For loan disbursement (if buyer taking mortgage)
- For resale (if buyer selling to another party)

## Documents Required from Buyer:
1. **Allotment Letter** (Original)
2. **Buyer-Builder Agreement (BBA)** (Signed copy)
3. **All Payment Receipts** (Complete payment history)
4. **Possession Letter** (From ROF)
5. **NOC Application Form** (Provided by ROF)
6. **Identity Proof** (Copy)
7. **Address Proof** (Copy)

## ROF''s Verification Process:
1. Customer submits documents
2. Finance team verifies all payments complete
3. Legal team reviews BBA and possession status
4. Compliance check against RERA/HRERA
5. Approval and NOC issuance (2-3 working days)

## NOC Generation in CRM:
1. Go to **Documents > NOC Requests**
2. Search customer by name/ID
3. System auto-checks: All payments done? Yes/No
4. If Yes: Auto-generate NOC with signature block
5. If No: Show outstanding amount; flag for follow-up
6. Send to customer via email + WhatsApp
7. Track delivery status

## Common Rejections:
| Issue | Cause | Solution |
|-------|-------|----------|
| NOC Denied | Outstanding payment | Clear dues; reapply |
| NOC Delayed | Missing documents | Submit all required docs |
| NOC Verification Failed | BBA not signed | Obtain signed copy |

## Timeline:
- Application to NOC: 3-5 working days
- Registration with government: 7-15 days (depends on local authorities)
', ARRAY['NOC', 'certificate', 'documents', 'registration'], true
FROM faq_categories WHERE name = 'Document Requests';

-- Insert articles for Policy & Rules category
INSERT INTO faq_articles (category_id, title, content, tags, is_published)
SELECT id, 'What is the one-application-per-family rule?',
'# One-Application-Per-Family Rule (AHP Compliance)

This is a government mandate under Haryana AHP to prevent fraud and ensure fair allocation.

## The Rule:
**Only ONE member of a family can hold an active allotment in a single AHP project at any point in time.**

## What is "Family"?
Defined by the Parivar Pehchan Patra (PPP), which is:
- Haryana Family ID card
- Used to identify household members
- Mandatory for AHP applications

## Enforcement in CRM:
1. When a consumer is created with a PPP, CRM checks for duplicates
2. If another family member has an active allotment in same project → **Rejected**
3. Error message: "DUPLICATE_FAMILY_APPLICATION"
4. Suggestion: Add as co-applicant instead, or wait for first allotment to complete

## Examples:

| Scenario | Allowed? | Why |
|----------|----------|-----|
| Father and son apply for same project | No | Same family, same project |
| Father applies for Project A; son for Project B | Yes | Different projects |
| Father allotted; mother cancels; mother reapplies | Yes | After cancellation, rule resets |
| Co-applicant added to existing allotment | Yes | Co-applicants share one allotment |

## Co-Applicant Strategy:
Instead of separate applications, use:
1. **Primary Applicant**: Main buyer (e.g., Father)
2. **Co-Applicants**: Family members (e.g., Wife, Adult Son)
- Only one allotment for the family
- Stronger application (combined income)
- Benefits shared among family

## CRM Implementation:
- Parivar Pehchan Patra field in consumer profile
- Unique index on (ppp, project_id, lead_stage) excluding cancelled
- System validation prevents creation of duplicate applications
- Manual override available to Super Admin (with audit log)

## What Happens if Duplicate Detected?
1. Second application rejected at creation
2. Error message shown: "A member of this family already has an active application"
3. First application link provided for reference
4. Suggestion: Contact Project Manager to discuss options
', ARRAY['one-family', 'AHP', 'PPP', 'rule', 'duplicate'], true
FROM faq_categories WHERE name = 'Policy & Rules';

INSERT INTO faq_articles (category_id, title, content, tags, is_published)
SELECT id, 'What are the cancellation and forfeiture rules under AHP?',
'# Cancellation and Forfeiture Policy

When an allottee cancels or defaults, ROF applies forfeiture and refund rules per AHP guidelines.

## Forfeiture Amount:
**₹25,000 + 18% GST = ₹29,500**

This is deducted from all payments received by the buyer.

## When Cancellation Happens:
1. **Buyer Requests**: Written cancellation request
2. **Default**: Buyer misses payment for 60+ days; ROF initiates
3. **ROF Initiates**: Due to policy violation or government mandate

## Refund Calculation:
```
Refund = Total Payments Received - ₹29,500 (forfeiture)
```

## Example:
| Item | Amount |
|------|--------|
| Total payments received | ₹50,00,000 |
| Forfeiture | -₹29,500 |
| **Refund** | **₹49,70,500** |

## Timeline:
1. **Cancellation approved**: Recorded in CRM
2. **Forfeiture deducted**: Automatically calculated
3. **Refund initiated**: Finance team processes (5-7 days)
4. **Bank transfer**: Sent to buyer''s registered bank account
5. **Confirmation**: Email + WhatsApp sent to buyer

## Waitlist Promotion:
- Upon cancellation, unit becomes available
- Next waitlisted customer with same BHK type automatically promoted
- If no waitlist candidate, unit returned to "Available" status

## HRERA Compliance:
- Forfeiture amount capped by HRERA guidelines
- ROF cannot forfeit more than 10% of transaction value (or ₹29,500, whichever is lower)
- Refund must be processed within 30 days
- If refund delayed beyond 30 days: 10% annual interest applies

## CRM Workflow:
1. Go to **Allocations > Cancel**
2. Provide cancellation reason
3. System calculates forfeiture and refund
4. Create cancellation record
5. Send cancellation letter + refund notification
6. Promote waitlist candidate (auto or manual)
7. Record in remarks log

## What Buyer Needs to Know:
- Cancellation reason (voluntary vs default)
- Forfeiture amount
- Refund amount
- Bank details for transfer
- Timeline for refund
- Impact on future applications (may be blacklisted)
', ARRAY['cancellation', 'forfeiture', 'refund', 'default', 'AHP'], true
FROM faq_categories WHERE name = 'Policy & Rules';
