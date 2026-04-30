-- Migration 013: Add communications table for unified channel inbox
-- Date: 2026-04-29
-- Purpose: Stores outbound/inbound messages across email, WhatsApp, SMS, Instagram, Facebook
--          Used by POST /api/communications/emails, /whatsapp, /sms and GET /api/communications/:consumerId

CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL,           -- email | whatsapp | sms | instagram | facebook
  direction VARCHAR(20) DEFAULT 'outbound', -- outbound | inbound
  subject VARCHAR(255),
  message TEXT,
  email_recipient VARCHAR(255),
  phone_recipient VARCHAR(20),
  status VARCHAR(50) DEFAULT 'sent',      -- sent | delivered | read | failed
  sent_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_communications_consumer ON communications(consumer_id);
CREATE INDEX idx_communications_channel ON communications(channel);
CREATE INDEX idx_communications_created ON communications(created_at DESC);
