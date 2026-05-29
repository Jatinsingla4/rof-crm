-- Migration 010: Remove legacy document tables
--
-- These tables were replaced during Phase 1 and are no longer used:
-- - generated_documents → replaced by documents table (lines 321-336 in schema.sql)
-- - scanned_contracts → replaced by document_vault table (lines 348-357 in schema.sql)
--
-- Verification: grep search of entire codebase confirmed zero references
-- to either table outside of schema.sql definitions.
--
-- This cleanup removes schema bloat and prevents future developer confusion.

DROP TABLE IF EXISTS generated_documents;
DROP TABLE IF EXISTS scanned_contracts;
