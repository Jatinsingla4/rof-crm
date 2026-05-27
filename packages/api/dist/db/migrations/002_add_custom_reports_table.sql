-- Migration: Add custom_reports table for custom report definitions and scheduling
-- Date: 2026-04-28
-- Purpose: Creates custom_reports table for storing custom report definitions with filtering, column selection, and scheduling
--          Referenced by POST /api/reports/custom-report and GET /api/reports/custom-reports endpoints

-- Create custom_reports table
CREATE TABLE custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  report_type VARCHAR(100) NOT NULL,
  filter_criteria JSONB,
  columns_selected TEXT[],
  schedule_frequency VARCHAR(50),
  schedule_recipients TEXT[],
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for query performance
CREATE INDEX idx_custom_reports_project ON custom_reports(project_id);
CREATE INDEX idx_custom_reports_created_by ON custom_reports(created_by_user_id);
CREATE INDEX idx_custom_reports_created_at ON custom_reports(created_at DESC);

-- Columns and their purposes:
-- id: Unique identifier for the custom report definition
-- name: Display name/title of the report (optional, can be auto-generated from reportType)
-- project_id: Links report to a specific project (nullable for cross-project/global reports)
-- report_type: Type of report (e.g., sales_dashboard, financial_dashboard, project_dashboard, custom_kpi)
-- filter_criteria: JSON object containing filters to apply to the report (e.g., date range, consumer status, unit status)
-- columns_selected: Array of column names/field identifiers to include in the report output
-- schedule_frequency: How often to auto-generate report (daily, weekly, monthly, null if not scheduled)
-- schedule_recipients: Array of email addresses to send scheduled reports to
-- created_by_user_id: User who created this report definition
-- created_at: Timestamp when report definition was created
-- updated_at: Timestamp of last update to the report definition
