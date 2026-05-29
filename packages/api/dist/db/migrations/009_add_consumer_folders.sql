-- Migration 009: Add consumer folder structure
-- Organises documents into logical folders per consumer

-- ============================================
-- CONSUMER FOLDERS TABLE
-- ============================================

CREATE TABLE consumer_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  folder_name VARCHAR(100) NOT NULL,
  folder_type VARCHAR(50) NOT NULL,
  parent_folder_id UUID REFERENCES consumer_folders(id),
  sort_order INTEGER DEFAULT 0,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADD FOLDER COLUMN TO DOCUMENT VAULT
-- ============================================

ALTER TABLE document_vault
ADD COLUMN folder_id UUID REFERENCES consumer_folders(id);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_consumer_folders_consumer ON consumer_folders(consumer_id);
CREATE INDEX idx_consumer_folders_type ON consumer_folders(folder_type);
CREATE INDEX idx_consumer_folders_parent ON consumer_folders(parent_folder_id);
CREATE INDEX idx_document_vault_folder ON document_vault(folder_id);
