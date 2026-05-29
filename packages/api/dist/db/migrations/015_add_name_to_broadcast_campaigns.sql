-- Migration 015: Add name column to broadcast_campaigns table
-- Date: 2026-05-02
-- Purpose: Store campaign name for better campaign tracking and management

ALTER TABLE broadcast_campaigns ADD COLUMN IF NOT EXISTS name VARCHAR(255);
