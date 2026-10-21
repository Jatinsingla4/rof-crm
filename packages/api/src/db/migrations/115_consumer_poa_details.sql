-- The applicant form (booking and applicant edit) has a "POA details" box for the main applicant; the column only existed for co-applicants, so filling it was a 500
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS poa_details TEXT;
