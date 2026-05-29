-- Migration: Add campaigns and campaign_metrics tables for marketing campaign ROI tracking
-- Date: 2026-04-27
-- Purpose: Creates campaigns table for marketing campaign definitions and campaign_metrics table for ROI aggregations
--          Referenced by GET /api/reports/campaign-roi endpoint
--          Adds campaign_id FK to consumers table to track which campaign each lead came from

-- Create campaigns table for marketing campaign definitions
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  channel VARCHAR(50),
  campaign_type VARCHAR(100),
  project_id UUID REFERENCES projects(id),
  budget_inr NUMERIC,
  start_date DATE,
  end_date DATE,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_project ON campaigns(project_id);
CREATE INDEX idx_campaigns_channel ON campaigns(channel);

-- Create campaign_metrics table for aggregated ROI metrics
CREATE TABLE campaign_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  project_id UUID REFERENCES projects(id),
  campaign_type VARCHAR(100),
  total_cost_inr NUMERIC DEFAULT 0,
  total_leads_generated INT DEFAULT 0,
  leads_converted_to_allotted INT DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  revenue_generated_inr NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_metrics_campaign ON campaign_metrics(campaign_id);
CREATE INDEX idx_campaign_metrics_project ON campaign_metrics(project_id);
CREATE INDEX idx_campaign_metrics_type ON campaign_metrics(campaign_type);

-- Add campaign_id FK to consumers table for lead attribution
ALTER TABLE consumers ADD COLUMN campaign_id UUID REFERENCES campaigns(id);
CREATE INDEX idx_consumers_campaign ON consumers(campaign_id);

-- Columns and their purposes (campaigns table):
-- id: Unique identifier for the marketing campaign
-- name: Display name of the campaign (e.g., "Google Ads Q2 2026", "Referral Drive March")
-- channel: Marketing channel (e.g., google_ads, facebook, email, walk_in, referral, phone_call)
-- campaign_type: Campaign type for filtering and categorization (custom field)
-- project_id: Links campaign to a specific project (nullable for multi-project campaigns)
-- budget_inr: Total campaign budget in rupees
-- start_date: Campaign start date
-- end_date: Campaign end date (nullable if ongoing)
-- created_by_user_id: User who created the campaign
-- created_at: Timestamp when campaign was created
-- updated_at: Timestamp of last update

-- Columns and their purposes (campaign_metrics table):
-- id: Unique identifier for the metrics record
-- campaign_id: Reference to the campaign
-- project_id: Associated project for filtering
-- campaign_type: Campaign type (denormalized for easy filtering without joins)
-- total_cost_inr: Total cost invested in the campaign
-- total_leads_generated: Total number of leads attributed to this campaign
-- leads_converted_to_allotted: Number of leads that converted to allotted status
-- conversion_rate: Percentage of leads converted to allotted (leads_converted_to_allotted / total_leads_generated * 100)
-- revenue_generated_inr: Total revenue generated from allotted units linked to this campaign
-- created_at: Timestamp when metrics were aggregated
-- updated_at: Timestamp of last update

-- Columns and their purposes (consumers table addition):
-- campaign_id: Links the lead to the marketing campaign that generated them (nullable if source is unknown)
