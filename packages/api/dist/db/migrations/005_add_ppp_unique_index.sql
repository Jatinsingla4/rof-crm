-- Migration 005: Enforce one-application-per-family rule using Parivar Pehchan Patra (PPP)
-- Haryana AHP policy mandates one application per family per project
-- Cancelled applications are excluded to allow re-application after cancellation

CREATE UNIQUE INDEX idx_consumers_ppp_project_unique
ON consumers (parivar_pehchan_patra, project_id)
WHERE parivar_pehchan_patra IS NOT NULL
AND lead_stage NOT IN ('cancelled');

-- Index explanation:
-- - Scoped per project: A family can apply to different projects
-- - Partial: Only enforces uniqueness for non-null PPP and non-cancelled lead stages
-- - Allows re-application: After cancellation, family can submit new application
