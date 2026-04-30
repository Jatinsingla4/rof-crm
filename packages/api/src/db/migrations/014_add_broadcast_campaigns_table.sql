-- Migration 014: Add broadcast_campaigns table for bulk WhatsApp/SMS campaigns
-- Date: 2026-04-29
-- Purpose: Stores broadcast campaign records created via POST /api/communications/broadcast
--          and listed via GET /api/communications/campaigns

CREATE TABLE IF NOT EXISTS broadcast_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  channel VARCHAR(50) NOT NULL,           -- whatsapp | sms | email
  message TEXT,
  total_recipients INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'queued',    -- queued | sending | completed | failed
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_broadcast_campaigns_project ON broadcast_campaigns(project_id);
CREATE INDEX idx_broadcast_campaigns_status ON broadcast_campaigns(status);
CREATE INDEX idx_broadcast_campaigns_created ON broadcast_campaigns(created_at DESC);
