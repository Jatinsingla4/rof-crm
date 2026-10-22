-- Who initiated a cancellation refund / draw refund (so the person who completes it can be someone else), and the buyer's GSTIN on an invoice.
ALTER TABLE cancellations ADD COLUMN IF NOT EXISTS refund_initiated_by uuid REFERENCES users(id);
ALTER TABLE draw_refunds ADD COLUMN IF NOT EXISTS initiated_by uuid REFERENCES users(id);
ALTER TABLE gst_invoices ADD COLUMN IF NOT EXISTS buyer_gstin varchar(15);
