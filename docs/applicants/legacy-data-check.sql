-- Read-only. Lists applicants whose saved values today's rules would refuse (run on the live database to see what needs correcting).
-- Editing such an applicant still works: values sent back unchanged are accepted, only a new bad value is refused.
SELECT 'mobile' AS field, id, name, mobile AS value FROM consumers WHERE mobile !~ '^[6-9][0-9]{9}$' AND mobile !~ '^\+[1-9][0-9]{7,14}$'
UNION ALL SELECT 'email', id, name, email FROM consumers WHERE email IS NOT NULL AND email !~* '^[a-z0-9._%+''-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$'
UNION ALL SELECT 'pan', id, name, pan_no FROM consumers WHERE pan_no IS NOT NULL AND upper(replace(pan_no, ' ', '')) !~ '^[A-Z]{5}[0-9]{4}[A-Z]$'
UNION ALL SELECT 'aadhaar', id, name, '(hidden)' FROM consumers WHERE aadhaar_no IS NOT NULL AND replace(replace(aadhaar_no, ' ', ''), '-', '') !~ '^[2-9][0-9]{11}$'
UNION ALL SELECT 'pin (India)', id, name, present_pin FROM consumers WHERE present_pin IS NOT NULL AND coalesce(present_country, 'India') ILIKE 'india' AND present_pin !~ '^[1-9][0-9]{5}$'
UNION ALL SELECT 'date of birth', id, name, dob::text FROM consumers WHERE dob IS NOT NULL AND (dob < '1900-01-01' OR dob > now() - interval '18 years') AND coalesce(applicant_type, 'individual') <> 'company'
UNION ALL SELECT 'name without a letter', id, name, name FROM consumers WHERE name !~ '[[:alpha:]]'
ORDER BY 1, 3;

-- Same PAN or same mobile on more than one applicant of a project (now refused for new entries)
SELECT 'duplicate PAN' AS issue, project_id, upper(pan_no) AS value, count(*) FROM consumers WHERE pan_no IS NOT NULL GROUP BY project_id, upper(pan_no) HAVING count(*) > 1
UNION ALL SELECT 'duplicate mobile (no project)', NULL, mobile, count(*) FROM consumers WHERE project_id IS NULL GROUP BY mobile HAVING count(*) > 1;
