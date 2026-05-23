-- Migration 049: Allow NULL due_date on demands for milestone-based installments
-- Milestone installments (due_date_offset_days = 0) have no fixed due date
-- until ROF formally raises them. NULL means "not yet scheduled".
ALTER TABLE demands ALTER COLUMN due_date DROP NOT NULL;
