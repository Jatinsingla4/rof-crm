-- Insert ATS Template for ROF ALANTE_TEST Project
INSERT INTO document_templates (
  id,
  project_id,
  document_type,
  name,
  body_html,
  merge_fields,
  version_number,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'dc2998ae-0d40-4451-b7c8-1b7c157eb668',
  'buyer_builder_agreement',
  'Agreement for Sale - ROF ALANTE_TEST',
  $HTML$<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agreement for Sale</title>
  <style>
    body {
      font-family: "Times New Roman", Times, serif;
      margin: 2.5cm;
      line-height: 1.5;
      font-size: 12pt;
      color: #000;
    }
    .header {
      text-align: center;
      margin-bottom: 2cm;
    }
    .header h1 {
      font-size: 14pt;
      font-weight: bold;
      margin: 0.5cm 0;
    }
    .header p {
      margin: 0.2cm 0;
      font-size: 11pt;
    }
    .section {
      margin-top: 0.5cm;
      margin-bottom: 0.5cm;
    }
    .section-title {
      font-weight: bold;
      font-size: 12pt;
      text-decoration: underline;
      margin-bottom: 0.3cm;
    }
    .clause {
      margin-left: 0.5cm;
      text-align: justify;
      margin-bottom: 0.3cm;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.5cm 0;
    }
    table, th, td {
      border: 1px solid #000;
    }
    th, td {
      padding: 0.3cm;
      text-align: left;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    .page-break {
      page-break-after: always;
    }
    .signature-block {
      margin-top: 1.5cm;
      margin-bottom: 0.5cm;
    }
    .signature-line {
      margin-top: 1cm;
      border-bottom: 1px solid #000;
      width: 5cm;
      margin-left: 0;
    }
    .signature-name {
      font-size: 10pt;
      margin-top: 0.2cm;
    }
    .footer {
      text-align: center;
      font-size: 10pt;
      margin-top: 1cm;
      color: #666;
    }
  </style>
</head>
<body>

<div class="header">
  <h1>AGREEMENT FOR SALE</h1>
  <p>Property Agreement Number: {{application_no}}</p>
  <p>Date: {{agreement_date}}</p>
</div>

<div class="section">
  <div class="section-title">1. PARTIES TO THE AGREEMENT</div>
  <div class="clause">
    <p><strong>SELLER/BUILDER/PROMOTER (hereinafter called "the Builder"):</strong></p>
    <p>Name: {{promoter_name}}</p>
    <p>CIN Number: {{promoter_cin}}</p>
    <p>Pan: {{promoter_pan}}</p>
    <p>Address: {{promoter_address}}</p>
  </div>
  <div class="clause">
    <p><strong>BUYER/ALLOTTEE (hereinafter called "the Allottee"):</strong></p>
    <p>Name: {{allottee_name}}</p>
    <p>Relation: {{allottee_relation}} {{allottee_relative_name}}</p>
    <p>Age: {{allottee_age}} years</p>
    <p>Aadhaar Number: {{allottee_aadhaar}}</p>
    <p>PAN Number: {{allottee_pan}}</p>
    <p>Address: {{allottee_address}}</p>
  </div>
</div>

<div class="section">
  <div class="section-title">2. PROJECT DETAILS</div>
  <div class="clause">
    <p><strong>Project Name:</strong> {{project_name}}</p>
    <p><strong>Location:</strong> {{village_name}}, {{sector_name}}, {{district_name}}</p>
    <p><strong>RERA Registration Number:</strong> {{harera_reg_no}}</p>
    <p><strong>License Number:</strong> {{license_no}} dated {{license_date}}</p>
    <p><strong>Environmental Clearance:</strong> {{env_clearance_no}} dated {{env_clearance_date}}</p>
    <p><strong>Building Plan Approval:</strong> {{building_plan_memo_no}} dated {{building_plan_date}}</p>
    <p><strong>Land Ownership Details:</strong></p>
    <p style="margin-left: 1cm;">Name: {{land_owner_name}}</p>
    <p style="margin-left: 1cm;">LLPIN: {{land_owner_llpin}}</p>
    <p style="margin-left: 1cm;">Pan: {{land_owner_pan}}</p>
    <p style="margin-left: 1cm;">GPA/Vasika No.: {{land_owner_gpa_vasika_no}} dated {{land_owner_gpa_date}}</p>
    <p style="margin-left: 1cm;">Address: {{land_owner_address}}</p>
    <p><strong>Sale Deed Details:</strong> Deed No. {{sale_deed_no}} dated {{sale_deed_date}}</p>
    <p><strong>Collaboration Agreement:</strong> {{collab_agreement_date}}</p>
    <p><strong>Khasra Details:</strong> {{khasra_details}}</p>
    <p><strong>Sub-Registrar Office:</strong> {{sub_registrar_office}}</p>
  </div>
</div>

<div class="section">
  <div class="section-title">3. FLAT/UNIT DETAILS</div>
  <table>
    <tr>
      <th>Description</th>
      <th>Details</th>
    </tr>
    <tr>
      <td>Flat/Unit No.</td>
      <td>{{flat_no}}, {{tower_name}}</td>
    </tr>
    <tr>
      <td>Floor</td>
      <td>{{floor_no}}</td>
    </tr>
    <tr>
      <td>Unit Type</td>
      <td>{{unit_type}}</td>
    </tr>
    <tr>
      <td>Carpet Area</td>
      <td>{{carpet_area}}</td>
    </tr>
    <tr>
      <td>Balcony Area</td>
      <td>{{balcony_area}}</td>
    </tr>
    <tr>
      <td>Parking No.</td>
      <td>{{parking_no}}</td>
    </tr>
  </table>
</div>

<div class="section">
  <div class="section-title">4. FINANCIAL TERMS</div>
  <div class="clause">
    <p><strong>Total Price of Unit (Net):</strong> {{total_price}}</p>
    <p><strong>Amount in Words:</strong> {{total_price_words}}</p>
    <p><strong>Breakup:</strong></p>
    <table style="margin-left: 1cm;">
      <tr>
        <td>Basic Price (Carpet Area @ {{rate_per_sqft}} per Sq.Ft.)</td>
        <td style="text-align: right;">{{basic_price}}</td>
      </tr>
      <tr>
        <td>Balcony Charges (@ {{balcony_rate}} per Sq.Ft.)</td>
        <td style="text-align: right;">{{balcony_price}}</td>
      </tr>
      <tr style="font-weight: bold; background-color: #f0f0f0;">
        <td>Total Price</td>
        <td style="text-align: right;">{{total_price}}</td>
      </tr>
    </table>
    <p><strong>Booking Amount (5% of Total Price):</strong> {{booking_amount}}</p>
    <p><strong>Amount in Words:</strong> {{booking_amount_words}}</p>
    <p><strong>Booking Amount Payment Date:</strong> {{booking_amount_pct}}</p>
  </div>
</div>

<div class="section">
  <div class="section-title">5. PAYMENT PLAN</div>
  <div class="clause">
    <table>
      <thead>
        <tr>
          <th>S.No.</th>
          <th>Installment Description</th>
          <th>Percentage/Amount</th>
          <th>Due Date</th>
        </tr>
      </thead>
      <tbody>
        {{payment_plan_rows}}
      </tbody>
    </table>
  </div>
</div>

<div class="section page-break">
  <div class="section-title">6. POSSESSION AND HANDOVER</div>
  <div class="clause">
    <p>The Builder shall deliver possession of the said property within 60 months from the date of receipt of all approvals and commencement of construction on the date as defined in the project brochure.</p>
    <p>Possession shall be deemed to have been offered on the date the Builder intimates in writing to the Allottee that the property is ready for possession.</p>
  </div>
</div>

<div class="section">
  <div class="section-title">7. MAINTENANCE AND MANAGEMENT CHARGES</div>
  <div class="clause">
    <p>The Allottee shall pay monthly maintenance charges as decided by the Building Association for upkeep and maintenance of the Common Areas and for the services provided.</p>
  </div>
</div>

<div class="section">
  <div class="section-title">8. TERMS AND CONDITIONS</div>
  <div class="clause">
    <p>8.1 This Agreement is governed by the Real Estate (Regulation and Development) Act, 2016 (RERA) and all applicable laws in India.</p>
    <p>8.2 The Allottee shall not be entitled to transfer, sell, lease, or create any charge on the property without prior written permission from the Builder.</p>
    <p>8.3 The Builder shall complete the project as per the timeline mentioned in the project brochure.</p>
    <p>8.4 The Allottee shall abide by the Rules and Regulations of the Building and the Housing Society as framed from time to time.</p>
    <p>8.5 Any disputes arising from this Agreement shall be resolved through Arbitration as per the Arbitration and Conciliation Act, 1996.</p>
  </div>
</div>

<div class="section page-break">
  <div class="section-title">ANNEXURE A - FLOOR PLAN OF THE SAID FLAT</div>
  <div class="clause">
    <p>[Floor plan to be attached separately]</p>
  </div>
</div>

<div class="section">
  <div class="section-title">ANNEXURE B - PAYMENT PLAN SCHEDULE</div>
  <div class="clause">
    <table>
      <tr>
        <th>S.No.</th>
        <th>Installment Name</th>
        <th>Percentage/Amount</th>
        <th>Amount in Rupees</th>
        <th>Due Date from Booking</th>
      </tr>
      {{payment_plan_rows}}
    </table>
  </div>
</div>

<div class="section page-break">
  <div class="signature-block">
    <p><strong>IN WITNESS WHEREOF</strong> the parties have executed this Agreement on the date first written above.</p>

    <div style="margin-top: 2cm;">
      <p><strong>FOR THE BUILDER:</strong></p>
      <p>Signatory: {{auth_signatory_name}}</p>
      <p>Board Resolution Date: {{board_resolution_date}}</p>
      <div class="signature-line"></div>
      <div class="signature-name">Authorized Signatory of Builder</div>
    </div>

    <div style="margin-top: 2cm;">
      <p><strong>FOR THE ALLOTTEE:</strong></p>
      <div class="signature-line"></div>
      <div class="signature-name">{{allottee_name}}</div>
      <div class="signature-line"></div>
      <div class="signature-name">{{allottee_name}} (Witness 1)</div>
      <div class="signature-line"></div>
      <div class="signature-name">Witness 2</div>
    </div>
  </div>
</div>

<div class="footer">
  <p>This is a digitally generated document. Signatures may be affixed electronically.</p>
  <p>Generated on: {{agreement_date}}</p>
</div>

</body>
</html>$HTML$,
  ARRAY['allottee_name', 'allottee_relation', 'allottee_relative_name', 'allottee_address', 'allottee_age', 'allottee_aadhaar', 'allottee_pan', 'promoter_name', 'promoter_cin', 'promoter_pan', 'promoter_address', 'project_name', 'harera_reg_no', 'license_no', 'license_date', 'village_name', 'sector_name', 'district_name', 'env_clearance_no', 'env_clearance_date', 'building_plan_memo_no', 'building_plan_date', 'land_owner_name', 'land_owner_llpin', 'land_owner_pan', 'land_owner_address', 'land_owner_gpa_vasika_no', 'land_owner_gpa_date', 'sale_deed_no', 'sale_deed_date', 'collab_agreement_date', 'flat_no', 'tower_name', 'floor_no', 'unit_type', 'carpet_area', 'balcony_area', 'parking_no', 'total_price', 'total_price_words', 'basic_price', 'balcony_price', 'rate_per_sqft', 'balcony_rate', 'booking_amount', 'booking_amount_words', 'booking_amount_pct', 'application_no', 'agreement_date', 'auth_signatory_name', 'board_resolution_date', 'payment_plan_rows', 'sub_registrar_office', 'khasra_details'],
  1,
  NOW(),
  NOW()
);
