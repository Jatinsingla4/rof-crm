-- Bank reconciliation and construction milestones, hardened. Safe to run twice. NOT VALID: old rows are left alone, new and changed rows are checked.

-- a bank line now carries its project so the project-scope policy covers it (it had no project, any login with the id could read it)
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
UPDATE bank_transactions t SET project_id = i.project_id FROM bank_statement_imports i WHERE i.id = t.import_id AND t.project_id IS NULL;

-- the same file imported twice would double every line; one hash per project
ALTER TABLE bank_statement_imports ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_import_file ON bank_statement_imports(project_id, file_hash) WHERE file_hash IS NOT NULL;

-- one bank line pays one receipt, and one receipt is matched to one bank line
CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_txn_receipt ON bank_transactions(matched_receipt_id) WHERE matched_receipt_id IS NOT NULL;

ALTER TABLE bank_transactions DROP CONSTRAINT IF EXISTS bank_txn_status_chk;
ALTER TABLE bank_transactions ADD CONSTRAINT bank_txn_status_chk CHECK (match_status IN ('unmatched','auto_matched','manually_matched','ignored')) NOT VALID;
ALTER TABLE bank_statement_imports DROP CONSTRAINT IF EXISTS bank_import_status_chk;
ALTER TABLE bank_statement_imports ADD CONSTRAINT bank_import_status_chk CHECK (status IN ('processing','completed','failed')) NOT VALID;
ALTER TABLE construction_milestones DROP CONSTRAINT IF EXISTS milestones_status_chk;
ALTER TABLE construction_milestones ADD CONSTRAINT milestones_status_chk CHECK (status IN ('pending','in_progress','completed')) NOT VALID;
ALTER TABLE construction_milestones DROP CONSTRAINT IF EXISTS milestones_done_chk;
ALTER TABLE construction_milestones ADD CONSTRAINT milestones_done_chk CHECK (status <> 'completed' OR actual_date IS NOT NULL) NOT VALID;

SELECT rof_apply_project_scope();
