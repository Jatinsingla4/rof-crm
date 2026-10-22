-- CRM module: the allowed words were only comments. NOT VALID: old rows are left alone, every new or changed row is checked.
ALTER TABLE broadcast_campaigns ADD COLUMN IF NOT EXISTS segment VARCHAR(50);

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_chk;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_chk CHECK (status IN ('pending','completed')) NOT VALID;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_chk;
ALTER TABLE tasks ADD CONSTRAINT tasks_priority_chk CHECK (priority IN ('normal','high','urgent')) NOT VALID;
ALTER TABLE automation_rules DROP CONSTRAINT IF EXISTS automation_delay_chk;
ALTER TABLE automation_rules ADD CONSTRAINT automation_delay_chk CHECK (delay_minutes >= 0 AND delay_minutes <= 525600) NOT VALID;
ALTER TABLE communications DROP CONSTRAINT IF EXISTS communications_channel_chk;
ALTER TABLE communications ADD CONSTRAINT communications_channel_chk CHECK (channel IN ('email','whatsapp','sms','instagram','facebook')) NOT VALID;
ALTER TABLE communications DROP CONSTRAINT IF EXISTS communications_status_chk;
ALTER TABLE communications ADD CONSTRAINT communications_status_chk CHECK (status IN ('queued','sent','delivered','read','failed')) NOT VALID;
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS tickets_status_chk;
ALTER TABLE support_tickets ADD CONSTRAINT tickets_status_chk CHECK (status IN ('open','in_progress','resolved','closed')) NOT VALID;
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS tickets_priority_chk;
ALTER TABLE support_tickets ADD CONSTRAINT tickets_priority_chk CHECK (priority IN ('low','medium','high','urgent')) NOT VALID;
ALTER TABLE broadcast_campaigns DROP CONSTRAINT IF EXISTS campaigns_channel_chk;
ALTER TABLE broadcast_campaigns ADD CONSTRAINT campaigns_channel_chk CHECK (channel IN ('whatsapp','sms','email')) NOT VALID;
ALTER TABLE broadcast_campaigns DROP CONSTRAINT IF EXISTS campaigns_status_chk;
ALTER TABLE broadcast_campaigns ADD CONSTRAINT campaigns_status_chk CHECK (status IN ('draft','queued','sending','completed','failed')) NOT VALID;
