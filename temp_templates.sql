INSERT INTO document_templates
(project_id, document_type, name, body_html, merge_fields, version_number, created_at, updated_at)
VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'welcome_letter',
  'Welcome Letter',
  $BODY$<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;margin:40px">
<div style="text-align:center;border-bottom:2px solid #333;padding-bottom:20px">
<h1 style="color:#1a5276">ROF Group</h1>
<p><em>Building Dreams, Delivering Homes</em></p>
</div>
<h2 style="text-align:center">WELCOME TO ROF FAMILY</h2>
<p>Dear {{consumerName}},</p>
<p>Congratulations and welcome to the ROF family!
We are delighted to have you as the owner of unit
<strong>{{unitNumber}}</strong> in
<strong>{{projectName}}</strong>.</p>
<p>Your next steps:</p>
<ol>
<li>Complete allotment amount payment within 15 days</li>
<li>Submit remaining KYC documents</li>
<li>Stay in touch for construction updates</li>
</ol>
<p>For queries please contact your relationship manager.</p>
<p>Warm regards,</p>
<p>Team ROF Group</p>
</body>
</html>$BODY$,
'{"consumerName","unitNumber","projectName","letterDate"}',
1,
NOW(),
NOW()
),
(
  '00000000-0000-0000-0000-000000000001',
  'custom_letter',
  'Custom/Ad-hoc Letter',
  $BODY2$<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;margin:40px">
<div style="text-align:center;border-bottom:2px solid #333;padding-bottom:20px">
<h1 style="color:#1a5276">ROF Group</h1>
<p><em>Building Dreams, Delivering Homes</em></p>
</div>
<p>Date: {{letterDate}}</p>
<p>Ref: {{referenceNumber}}</p>
<p>Dear {{consumerName}},</p>
<p>[Letter content goes here]</p>
<p>For any queries please contact us.</p>
<p>Regards,</p>
<p>Authorised Signatory: _______________</p>
<p>For ROF Group</p>
</body>
</html>$BODY2$,
'{"consumerName","letterDate","referenceNumber"}',
1,
NOW(),
NOW()
);
