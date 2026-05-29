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
  'conveyance_deed',
  'Conveyance Deed - ROF ALANTE_TEST',
  $HTML$<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conveyance Deed</title>
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
    .whereas {
      margin-left: 1cm;
      margin-bottom: 0.3cm;
      text-align: justify;
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
  </style>
</head>
<body>

<div class="header">
  <h1>CONVEYANCE DEED</h1>
  <p>Date: {{deed_day}} {{deed_month}} {{deed_year}}</p>
</div>

<div class="section">
  <div class="section-title">WHEREAS RECITALS</div>
  <div class="whereas">
    <p><strong>WHEREAS,</strong> {{promoter_name}} (hereinafter called "the Vendor") is the owner and in lawful possession of immovable property described hereinbelow;</p>
    <p><strong>AND WHEREAS,</strong> {{vendee_name}} {{vendee_relation}} {{vendee_relative_name}} (hereinafter called "the Vendee") is desirous of acquiring the said property for valuable consideration;</p>
    <p><strong>AND WHEREAS,</strong> the Vendor and Vendee have agreed to transfer the said property on the terms and conditions hereinafter mentioned;</p>
    <p><strong>NOW THIS DEED WITNESSES</strong> as follows:</p>
  </div>
</div>

<div class="section">
  <div class="section-title">1. PROPERTY DESCRIPTION</div>
  <div class="clause">
    <p>The property hereby conveyed is described as follows:</p>
    <table>
      <tr>
        <td><strong>Property No./Flat No.:</strong></td>
        <td>{{property_no}}, {{tower_name}}</td>
      </tr>
      <tr>
        <td><strong>Floor:</strong></td>
        <td>{{floor_no}}</td>
      </tr>
      <tr>
        <td><strong>Carpet Area:</strong></td>
        <td>{{carpet_area}}</td>
      </tr>
      <tr>
        <td><strong>Balcony Area:</strong></td>
        <td>{{balcony_area}}</td>
      </tr>
      <tr>
        <td><strong>Parking No.:</strong></td>
        <td>{{parking_no}}</td>
      </tr>
      <tr>
        <td><strong>Project Name:</strong></td>
        <td>{{project_name}}</td>
      </tr>
      <tr>
        <td><strong>Village:</strong></td>
        <td>{{village_name}}</td>
      </tr>
      <tr>
        <td><strong>Sector:</strong></td>
        <td>{{sector_name}}</td>
      </tr>
      <tr>
        <td><strong>Khasra Details:</strong></td>
        <td>{{khasra_details}}</td>
      </tr>
    </table>
  </div>
</div>

<div class="section">
  <div class="section-title">2. PROJECT LEGAL DETAILS</div>
  <div class="clause">
    <p><strong>RERA Registration No.:</strong> {{harera_reg_no}}</p>
    <p><strong>License No.:</strong> {{license_no}}</p>
    <p><strong>Land Owner Name:</strong> {{land_owner_name}}</p>
    <p><strong>Land Owner LLPIN:</strong> {{land_owner_llpin}}</p>
    <p><strong>Land Owner PAN:</strong> {{land_owner_pan}}</p>
    <p><strong>Land Owner Address:</strong> {{land_owner_address}}</p>
    <p><strong>GPA/Vasika No.:</strong> {{land_owner_gpa_vasika_no}} dated {{land_owner_gpa_date}}</p>
    <p><strong>Sale Deed No.:</strong> {{sale_deed_no}} dated {{sale_deed_date}}</p>
    <p><strong>Collaboration Agreement Date:</strong> {{collab_agreement_date}}</p>
  </div>
</div>

<div class="section">
  <div class="section-title">3. CONSIDERATION</div>
  <div class="clause">
    <p><strong>Total Consideration:</strong> {{consideration}}</p>
    <p><strong>Amount in Words:</strong> {{consideration_words}}</p>
    <p><strong>Stamp Duty:</strong> {{stamp_duty}}</p>
    <p><strong>E-Stamp No.:</strong> {{e_stamp_no}}</p>
  </div>
</div>

<div class="section">
  <div class="section-title">4. OCCUPATION CERTIFICATE AND DEED OF DECLARATION</div>
  <div class="clause">
    <p><strong>OC Memo No.:</strong> {{oc_memo_no}}</p>
    <p><strong>OC Date:</strong> {{oc_date}}</p>
    <p><strong>Deed of Declaration Vasika No.:</strong> {{deed_of_declaration_vasika_no}}</p>
    <p><strong>Deed of Declaration Date:</strong> {{deed_of_declaration_date}}</p>
  </div>
</div>

<div class="section">
  <div class="section-title">5. ALLOTMENT LETTER DATE</div>
  <div class="clause">
    <p><strong>The Vendee has received allotment letter dated:</strong> {{allotment_letter_date}}</p>
  </div>
</div>

<div class="section">
  <div class="section-title">6. TERMS AND CONDITIONS</div>
  <div class="clause">
    <p>6.1 The Vendor hereby transfers, sells, and conveys the said property to the Vendee in absolute and full ownership for the said consideration amount.</p>
    <p>6.2 The Vendee shall pay the total consideration amount as agreed.</p>
    <p>6.3 The Vendor warrants that the property is free from all encumbrances and liabilities.</p>
    <p>6.4 The property shall be transferred with possession to the Vendee.</p>
    <p>6.5 This deed is executed in accordance with the Indian Registration Act, 1908 and applicable laws.</p>
  </div>
</div>

<div class="section page-break">
  <div class="section-title">7. POSSESSION</div>
  <div class="clause">
    <p>The Vendor shall deliver absolute and vacant possession of the said property to the Vendee at the time of registration of this deed.</p>
  </div>
</div>

<div class="section">
  <div class="section-title">8. VENDOR'S OBLIGATIONS</div>
  <div class="clause">
    <p>The Vendor shall:</p>
    <p>8.1 Remove all unauthorized structures and encroachments, if any.</p>
    <p>8.2 Clear all liabilities attached to the property.</p>
    <p>8.3 Provide all relevant documents including architectural plans, structural designs, and approvals.</p>
    <p>8.4 Obtain NOC from local authorities where required.</p>
  </div>
</div>

<div class="section">
  <div class="section-title">9. VENDEE'S OBLIGATIONS</div>
  <div class="clause">
    <p>The Vendee shall:</p>
    <p>9.1 Pay the total consideration amount as agreed.</p>
    <p>9.2 Bear all registration and transfer expenses.</p>
    <p>9.3 Pay property tax and other levies from the date of taking possession.</p>
    <p>9.4 Abide by the society rules and regulations after taking possession.</p>
  </div>
</div>

<div class="section">
  <div class="section-title">10. TITLE GUARANTEE</div>
  <div class="clause">
    <p>The Vendor hereby guarantees that the title to the said property is clear and free from all encumbrances and shall defend the same against all persons.</p>
  </div>
</div>

<div class="section">
  <div class="section-title">11. MAINTENANCE CHARGES</div>
  <div class="clause">
    <p>The Vendee shall be liable to pay maintenance charges and other levies as decided by the building association/society from the date of taking possession.</p>
  </div>
</div>

<div class="section">
  <div class="section-title">12. BUILDER'S LIABILITY</div>
  <div class="clause">
    <p>The Builder/Promoter ({{promoter_name}}) shall provide warranty for structural defects for a period of five years from the date of occupation certificate as per applicable laws.</p>
  </div>
</div>

<div class="section">
  <div class="section-title">13. STAMP DUTY AND REGISTRATION</div>
  <div class="clause">
    <p>This deed shall be stamped, notarized, and registered at the Sub-Registrar Office: {{sub_registrar_office}} in accordance with the Indian Registration Act, 1908 and the Stamp Act.</p>
  </div>
</div>

<div class="section">
  <div class="section-title">14. DISPUTE RESOLUTION</div>
  <div class="clause">
    <p>Any disputes arising out of this deed shall be resolved through Arbitration as per the Arbitration and Conciliation Act, 1996.</p>
  </div>
</div>

<div class="section">
  <div class="section-title">15. NOTICES</div>
  <div class="clause">
    <p>All notices shall be served on the addresses mentioned in this deed or as changed in writing by either party.</p>
  </div>
</div>

<div class="section">
  <div class="section-title">16. COMPLIANCE WITH LAWS</div>
  <div class="clause">
    <p>This deed is executed in compliance with all applicable laws, rules, and regulations in force in India.</p>
  </div>
</div>

<div class="section">
  <div class="section-title">17. ENTIRE AGREEMENT</div>
  <div class="clause">
    <p>This deed constitutes the entire agreement between the parties and supersedes all prior understandings and agreements.</p>
  </div>
</div>

<div class="section">
  <div class="section-title">18. AMENDMENT</div>
  <div class="clause">
    <p>This deed cannot be amended except by a written instrument executed by both parties.</p>
  </div>
</div>

<div class="section">
  <div class="section-title">19. GOVERNING LAW</div>
  <div class="clause">
    <p>This deed shall be governed by and construed in accordance with the laws of India.</p>
  </div>
</div>

<div class="section page-break">
  <div class="section-title">SCHEDULE-I: PROPERTY DETAILS</div>
  <div class="clause">
    <table>
      <tr>
        <td><strong>Property No.:</strong></td>
        <td>{{property_no}}</td>
      </tr>
      <tr>
        <td><strong>Tower/Block:</strong></td>
        <td>{{tower_name}}</td>
      </tr>
      <tr>
        <td><strong>Floor:</strong></td>
        <td>{{floor_no}}</td>
      </tr>
      <tr>
        <td><strong>Carpet Area:</strong></td>
        <td>{{carpet_area}}</td>
      </tr>
      <tr>
        <td><strong>Balcony Area:</strong></td>
        <td>{{balcony_area}}</td>
      </tr>
      <tr>
        <td><strong>Total Area:</strong></td>
        <td>Carpet + Balcony + Common</td>
      </tr>
      <tr>
        <td><strong>Parking Slot:</strong></td>
        <td>{{parking_no}}</td>
      </tr>
    </table>
  </div>
</div>

<div class="section page-break">
  <div class="signature-block">
    <p style="text-align: center;"><strong>IN WITNESS WHEREOF</strong> the parties have executed this Conveyance Deed on the date first written above.</p>

    <div style="margin-top: 2cm;">
      <p><strong>VENDOR (BUILDER/PROMOTER):</strong></p>
      <p>{{promoter_name}}</p>
      <p>CIN: {{promoter_cin}}</p>
      <p>Address: {{promoter_address}}</p>
      <p>PAN: {{promoter_pan}}</p>
      <div class="signature-line"></div>
      <div class="signature-name">Authorized Signatory ({{auth_signatory_name}})</div>
      <p style="font-size: 10pt; margin-top: 0.2cm;">Aadhaar: {{auth_signatory_aadhaar}}</p>
      <p style="font-size: 10pt;">Board Resolution Date: {{board_resolution_date}}</p>
    </div>

    <div style="margin-top: 2cm;">
      <p><strong>VENDEE:</strong></p>
      <p>Name: {{vendee_name}}</p>
      <p>{{vendee_relation}} {{vendee_relative_name}}</p>
      <p>Address: {{vendee_address}}</p>
      <p>Aadhaar: {{vendee_aadhaar}}</p>
      <p>PAN: {{vendee_pan}}</p>
      <div class="signature-line"></div>
      <div class="signature-name">{{vendee_name}}</div>
    </div>

    <div style="margin-top: 2cm;">
      <p><strong>WITNESSES:</strong></p>
      <div class="signature-line"></div>
      <div class="signature-name">Witness 1</div>
      <div class="signature-line"></div>
      <div class="signature-name">Witness 2</div>
    </div>
  </div>
</div>

</body>
</html>$HTML$,
  ARRAY['vendee_name', 'vendee_relation', 'vendee_relative_name', 'vendee_address', 'vendee_aadhaar', 'vendee_pan', 'property_no', 'tower_name', 'floor_no', 'carpet_area', 'balcony_area', 'parking_no', 'allotment_letter_date', 'consideration', 'consideration_words', 'stamp_duty', 'e_stamp_no', 'project_name', 'license_no', 'harera_reg_no', 'village_name', 'sector_name', 'khasra_details', 'sale_deed_no', 'sale_deed_date', 'collab_agreement_date', 'oc_memo_no', 'oc_date', 'deed_of_declaration_vasika_no', 'deed_of_declaration_date', 'deed_day', 'deed_month', 'deed_year', 'auth_signatory_name', 'auth_signatory_aadhaar', 'board_resolution_date', 'promoter_name', 'promoter_cin', 'promoter_address', 'promoter_pan', 'land_owner_name', 'land_owner_llpin', 'land_owner_pan', 'land_owner_address', 'land_owner_gpa_vasika_no', 'land_owner_gpa_date', 'sub_registrar_office'],
  1,
  NOW(),
  NOW()
);
