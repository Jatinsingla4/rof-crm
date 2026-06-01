-- Seed global document templates (project_id = NULL) for fallback
-- These are minimal templates that work with auto-merge logic

INSERT INTO document_templates (
  id, document_type, project_id, template_name, body_html, created_at, updated_at
) VALUES
  (
    gen_random_uuid(),
    'demand_letter',
    NULL,
    'Global Demand Letter Template',
    '<html><head><style>body { font-family: Arial, sans-serif; margin: 20px; }</style></head><body>
    <div style="text-align: center; margin-bottom: 30px;">
      <h2>DEMAND LETTER</h2>
      <p style="margin: 5px 0;">{{projectName}}</p>
      <p style="margin: 5px 0;">{{projectSector}}</p>
    </div>

    <div style="margin-bottom: 20px;">
      <p><strong>TO,</strong></p>
      <p>{{consumerName}}</p>
      <p>S/O {{fatherName}}</p>
      <p>{{address}}</p>
      <p>Mobile: {{mobile}}</p>
      <p>Email: {{email}}</p>
    </div>

    <div style="margin-bottom: 20px;">
      <p><strong>SUBJECT: DEMAND LETTER FOR PAYMENT OF OUTSTANDING DUES</strong></p>
      <p>Dear {{consumerName}},</p>
      <p>RE: Unit No. {{unitNumber}} ({{unitCategory}}), {{projectName}}</p>
      <p>Registration No.: {{customerId}}</p>
    </div>

    <p>We write to you regarding the outstanding dues against the above-mentioned property.
    As per our records, the following amounts are due and payable:</p>

    <div id="table-container" style="margin: 20px 0;"></div>

    <div style="margin-top: 30px;">
      <p>We request you to make the payment within 7 days from the date of this letter.</p>
      <p>Regards,</p>
      <p style="margin-top: 30px;">{{projectName}}</p>
      <p>Date: {{currentDate}}</p>
    </div>
    </body></html>',
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'allotment_letter',
    NULL,
    'Global Allotment Letter Template',
    '<html><head><style>body { font-family: Arial, sans-serif; margin: 20px; }</style></head><body>
    <div style="text-align: center; margin-bottom: 30px;">
      <h2>ALLOTMENT LETTER</h2>
      <p style="margin: 5px 0;">{{projectName}}</p>
    </div>

    <div style="margin-bottom: 20px;">
      <p><strong>Dear {{consumerName}},</strong></p>
      <p>We are pleased to inform you that your unit has been allotted.</p>
    </div>

    <div style="margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px;"><strong>Unit Number:</strong></td>
          <td style="padding: 8px;">{{unitNumber}}</td>
        </tr>
        <tr>
          <td style="padding: 8px;"><strong>Unit Type:</strong></td>
          <td style="padding: 8px;">{{unitCategory}}</td>
        </tr>
        <tr>
          <td style="padding: 8px;"><strong>Carpet Area:</strong></td>
          <td style="padding: 8px;">{{carpetArea}} Sq.Ft.</td>
        </tr>
        <tr>
          <td style="padding: 8px;"><strong>Project:</strong></td>
          <td style="padding: 8px;">{{projectName}}</td>
        </tr>
      </table>
    </div>

    <div style="margin-top: 30px;">
      <p>Regards,</p>
      <p style="margin-top: 30px;">{{projectName}}</p>
      <p>Date: {{currentDate}}</p>
    </div>
    </body></html>',
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'payment_receipt',
    NULL,
    'Global Payment Receipt Template',
    '<html><head><style>body { font-family: Arial, sans-serif; margin: 20px; }</style></head><body>
    <div style="text-align: center; margin-bottom: 30px;">
      <h2>PAYMENT RECEIPT</h2>
      <p style="margin: 5px 0;">{{projectName}}</p>
    </div>

    <div style="margin-bottom: 20px;">
      <p><strong>RECEIPT</strong></p>
    </div>

    <div style="margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px;"><strong>Consumer Name:</strong></td>
          <td style="padding: 8px;">{{consumerName}}</td>
        </tr>
        <tr>
          <td style="padding: 8px;"><strong>Registration No.:</strong></td>
          <td style="padding: 8px;">{{customerId}}</td>
        </tr>
        <tr>
          <td style="padding: 8px;"><strong>Unit Number:</strong></td>
          <td style="padding: 8px;">{{unitNumber}}</td>
        </tr>
        <tr>
          <td style="padding: 8px;"><strong>Project:</strong></td>
          <td style="padding: 8px;">{{projectName}}</td>
        </tr>
      </table>
    </div>

    <p>This is to certify that payment has been received as per details above.</p>

    <div style="margin-top: 30px;">
      <p>Regards,</p>
      <p style="margin-top: 30px;">{{projectName}}</p>
      <p>Date: {{currentDate}}</p>
    </div>
    </body></html>',
    NOW(),
    NOW()
  )
ON CONFLICT DO NOTHING;
