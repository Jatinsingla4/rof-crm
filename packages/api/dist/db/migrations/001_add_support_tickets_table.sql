-- Migration: Add support_tickets table for ticket/escalation management
-- Date: 2026-04-27
-- Purpose: Creates support_tickets table referenced by POST /api/communications/tickets endpoint

-- Create support_tickets table
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(50) DEFAULT 'medium',
  status VARCHAR(50) DEFAULT 'open',
  assigned_to_user_id UUID REFERENCES users(id),
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  sla_breach_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for query performance
CREATE INDEX idx_support_tickets_consumer ON support_tickets(consumer_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_assigned_to ON support_tickets(assigned_to_user_id);
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at DESC);

-- Columns and their purposes:
-- id: Unique identifier for the ticket
-- consumer_id: Links ticket to the consumer who raised it
-- subject: Short title of the ticket
-- description: Full description of the issue
-- priority: Priority level (low, medium, high, urgent) - defaults to 'medium'
-- status: Current status (open, in_progress, resolved, escalated) - defaults to 'open'
-- assigned_to_user_id: User assigned to resolve the ticket (nullable - unassigned initially)
-- created_by_user_id: User who created/reported the ticket
-- sla_breach_at: Timestamp when SLA was breached (for 24hr escalation workflow)
-- resolved_at: Timestamp when ticket was resolved
-- created_at: Timestamp when ticket was created
-- updated_at: Timestamp of last update
