-- Migration 036: Add plaintext aadhaar_no column (aadhaar_hash already exists)
-- This allows storing plaintext Aadhaar and PAN for display purposes while keeping hashes for security

-- Add aadhaar_no column if it doesn't exist
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS aadhaar_no VARCHAR(20);

-- Create index on aadhaar_no for faster lookups
CREATE INDEX IF NOT EXISTS idx_consumers_aadhaar_no ON consumers(aadhaar_no);
