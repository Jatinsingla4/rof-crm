-- Email templates get their own table. The screen used to save them into document_templates (the table of legal letters), where a template typed
-- "allotment_letter" or "payment_receipt" was picked by the letter generator (newest one wins) in place of the real letter. Safe to run twice.
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  template_type VARCHAR(40) NOT NULL DEFAULT 'general',
  subject VARCHAR(200) NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by_user_id UUID REFERENCES users(id),
  updated_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_templates_name ON email_templates (lower(name));
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_type_chk;
ALTER TABLE email_templates ADD CONSTRAINT email_templates_type_chk CHECK (template_type IN ('general','allotment_letter','demand_letter','payment_receipt','welcome','reminder')) NOT VALID;
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_body_chk;
ALTER TABLE email_templates ADD CONSTRAINT email_templates_body_chk CHECK (length(btrim(name)) > 0 AND length(body) <= 20000) NOT VALID;

-- the four starting templates the screen used to pretend to have (now real rows that can be edited, not deleted)
INSERT INTO email_templates (name, template_type, subject, body, is_system) VALUES
 ('Allotment Letter', 'allotment_letter', 'Allotment Letter - Unit {{unit_number}}', E'Dear {{consumer_name}},\n\nCongratulations! You have been allotted Unit {{unit_number}} in {{project_name}}.\n\nAllotment Date: {{allotment_date}}\n\nPlease complete the payments as per your payment plan.\n\nRegards,\nROF Infratech & Housing Pvt. Ltd.', true),
 ('Demand Letter', 'demand_letter', 'Payment Demand Notice - Unit {{unit_number}}', E'Dear {{consumer_name}},\n\nThis is a reminder that your instalment of Rs. {{amount}} is due on {{due_date}}.\n\nUnit: {{unit_number}} | Project: {{project_name}}\n\nPlease make the payment before the due date.\n\nRegards,\nROF Infratech & Housing Pvt. Ltd.', true),
 ('Payment Receipt', 'payment_receipt', 'Payment Receipt - Rs. {{amount}}', E'Dear {{consumer_name}},\n\nWe have received your payment of Rs. {{amount}}.\n\nUnit: {{unit_number}} | Project: {{project_name}}\n\nThank you for your timely payment.\n\nRegards,\nROF Infratech & Housing Pvt. Ltd.', true),
 ('Welcome Email', 'welcome', 'Welcome to ROF Infratech!', E'Dear {{consumer_name}},\n\nWelcome to ROF Infratech & Housing Pvt. Ltd.!\n\nYour application has been registered successfully.\n\nProject: {{project_name}}\n\nFor any queries, please contact our support team.\n\nRegards,\nROF Infratech & Housing Pvt. Ltd.', true)
ON CONFLICT DO NOTHING;
