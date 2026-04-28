-- Migration 006: Seed 9 pre-built document templates
-- Document types: Allotment, Demand, Receipt, BBA, NOC, Possession, Cancellation, Welcome, Custom
-- All templates use {{fieldName}} merge field syntax for dynamic content
-- These are base templates to be customized per-project in the application

-- NOTE: Templates are seeded with project_id = '00000000-0000-0000-0000-000000000001'
-- This is a placeholder representing "ROF Standard Templates" that should be copied per actual project
-- Admins can override and create project-specific variations after seeding

-- Create default project if it doesn't exist
INSERT INTO projects (id, name, rera_number, tcp_licence, location)
VALUES ('00000000-0000-0000-0000-000000000001', 'ROF Standard Templates', 'STANDARD-001', 'ROF-LIC-001', 'System')
ON CONFLICT DO NOTHING;

INSERT INTO document_templates (project_id, document_type, name, body_html, merge_fields, version_number, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'allotment_letter',
  'Allotment Letter',
  E'<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Garamond, serif; color: #333; margin: 0; padding: 0; }
    .container { max-width: 900px; margin: 40px auto; padding: 40px; border: 1px solid #999; background-color: #fafafa; }
    .header { text-align: center; border-bottom: 3px solid #1a5490; padding-bottom: 20px; margin-bottom: 30px; }
    .company-name { font-size: 24px; font-weight: bold; color: #1a5490; }
    .tagline { font-size: 12px; color: #666; font-style: italic; margin-top: 5px; }
    .letter-title { text-align: center; font-size: 16px; font-weight: bold; margin: 30px 0 20px 0; text-transform: uppercase; }
    .date-line { text-align: right; margin-bottom: 20px; }
    .content { line-height: 1.8; }
    .section-title { font-weight: bold; margin-top: 20px; margin-bottom: 10px; text-transform: uppercase; font-size: 12px; }
    .row { margin-bottom: 12px; }
    .label { font-weight: bold; width: 150px; display: inline-block; }
    .value { display: inline-block; }
    .payment-schedule { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .payment-schedule th, .payment-schedule td { border: 1px solid #999; padding: 8px; text-align: left; }
    .payment-schedule th { background-color: #e8e8e8; font-weight: bold; }
    .payment-schedule td { background-color: #f9f9f9; }
    .terms { margin-top: 30px; line-height: 1.6; font-size: 11px; }
    .terms-title { font-weight: bold; margin-bottom: 10px; }
    .signature-block { margin-top: 40px; }
    .signature-line { margin-top: 40px; margin-bottom: 5px; border-top: 1px solid #333; }
    .signature-label { font-size: 11px; }
    .footer { text-align: center; margin-top: 40px; font-size: 10px; color: #666; border-top: 1px solid #999; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-name">ROF GROUP</div>
      <div class="tagline">Building Dreams, Delivering Homes</div>
    </div>

    <div class="letter-title">ALLOTMENT LETTER</div>

    <div class="date-line">Date: {{letterDate}}</div>

    <div class="content">
      <div class="row">
        <strong>To,</strong>
      </div>
      <div class="row">
        {{consumerName}}<br>
        {{consumerEmail}}<br>
        {{consumerMobile}}
      </div>

      <div class="row" style="margin-top: 30px;">
        <strong>Re: Allotment of Unit - {{projectName}} (RERA: {{projectRERANumber}})</strong>
      </div>

      <div class="row" style="margin-top: 20px;">
        Dear {{consumerName}},
      </div>

      <div class="row">
        We are pleased to inform you that Unit No. {{unitNumber}}, {{towerBlock}}, Floor {{floorNumber}}, consisting of {{bhkType}} apartment having carpet area of {{carpetAreaSqFt}} Sq.Ft., in the project {{projectName}} has been allotted to you.
      </div>

      <div class="section-title">Allotment Details</div>
      <div class="row">
        <span class="label">Allotment Date:</span>
        <span class="value">{{allotmentDate}}</span>
      </div>
      <div class="row">
        <span class="label">Unit:</span>
        <span class="value">{{unitNumber}}, {{towerBlock}}, Floor {{floorNumber}}</span>
      </div>
      <div class="row">
        <span class="label">Unit Type:</span>
        <span class="value">{{bhkType}}</span>
      </div>
      <div class="row">
        <span class="label">Built-up Area:</span>
        <span class="value">{{carpetAreaSqFt}} Sq.Ft.</span>
      </div>
      <div class="row">
        <span class="label">Total Price:</span>
        <span class="value">₹{{totalPriceInr}}</span>
      </div>

      <div class="section-title">Payment Schedule (AHP Compliant)</div>
      <table class="payment-schedule">
        <tr>
          <th>Installment</th>
          <th>Amount</th>
          <th>Due Date</th>
          <th>Percentage</th>
        </tr>
        <tr>
          <td>Booking (Paid)</td>
          <td>₹{{bookingAmountInr}}</td>
          <td>{{allotmentDate}}</td>
          <td>5%</td>
        </tr>
        <tr>
          <td>Allotment</td>
          <td>₹{{allotmentAmountInr}}</td>
          <td>Within 15 days of allotment</td>
          <td>20%</td>
        </tr>
        <tr>
          <td>6 Half-Yearly Installments</td>
          <td>₹{{installmentAmountInr}} each</td>
          <td>Quarterly</td>
          <td>12.5% each</td>
        </tr>
      </table>

      <div class="section-title">Terms & Conditions</div>
      <div class="terms">
        <div class="terms-title">IMPORTANT - PLEASE READ CAREFULLY</div>
        <div class="row">
          1. This allotment is subject to the buyer signing the Buyer-Builder Agreement (BBA) within 30 days of this letter.<br><br>
          2. The payment schedule must be adhered to strictly. Any default may result in cancellation with forfeiture as per policy.<br><br>
          3. The Unit is allotted as per Haryana Affordable Housing Policy and TCP (Town &amp; Country Planning) rules.<br><br>
          4. Buyer must provide valid identity and income proof documents within 10 days of allotment.<br><br>
          5. Construction and possession timelines are subject to regulatory approvals and force majeure events.<br><br>
          6. The allotment is non-transferable until the Buyer-Builder Agreement is executed and registered.<br><br>
          7. The price is exclusive of GST, registration, stamp duty, and municipal taxes as applicable.<br><br>
          8. For queries or payment-related issues, contact our Accounts Team at {{contactPhone}}.
        </div>
      </div>

      <div class="row" style="margin-top: 30px;">
        This allotment is final and binding on both parties. We are excited to be part of your home-buying journey!
      </div>

      <div class="signature-block">
        <div style="display: flex; justify-content: space-between; margin-top: 60px;">
          <div>
            <div class="signature-line"></div>
            <div class="signature-label"><strong>For ROF Group</strong><br>Authorized Signatory<br>Date: {{letterDate}}</div>
          </div>
          <div>
            <div class="signature-line"></div>
            <div class="signature-label"><strong>Allottee Acknowledgement</strong><br>{{consumerName}}<br>Date: _______________</div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      This is an electronically generated document. Valid with ROF Group seal and authorized signatory.<br>
      RERA Registration: {{projectRERANumber}} | Project: {{projectName}}
    </div>
  </div>
</body>
</html>',
  ARRAY['consumerName', 'consumerEmail', 'consumerMobile', 'projectName', 'projectRERANumber', 'unitNumber', 'towerBlock', 'floorNumber', 'bhkType', 'carpetAreaSqFt', 'totalPriceInr', 'allotmentDate', 'letterDate', 'bookingAmountInr', 'allotmentAmountInr', 'installmentAmountInr', 'contactPhone'],
  1,
  NOW(),
  NOW()
);

INSERT INTO document_templates (project_id, document_type, name, body_html, merge_fields, version_number, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demand_letter',
  'Demand Letter',
  E'<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Garamond, serif; color: #333; margin: 0; padding: 0; }
    .container { max-width: 900px; margin: 40px auto; padding: 40px; border: 1px solid #999; background-color: #fafafa; }
    .header { text-align: center; border-bottom: 3px solid #c41e3a; padding-bottom: 20px; margin-bottom: 30px; }
    .company-name { font-size: 24px; font-weight: bold; color: #c41e3a; }
    .tagline { font-size: 12px; color: #666; font-style: italic; margin-top: 5px; }
    .letter-title { text-align: center; font-size: 16px; font-weight: bold; margin: 30px 0 20px 0; text-transform: uppercase; color: #c41e3a; }
    .date-line { text-align: right; margin-bottom: 20px; }
    .content { line-height: 1.8; }
    .alert-box { background-color: #fff3cd; border-left: 4px solid #c41e3a; padding: 15px; margin: 20px 0; }
    .alert-title { font-weight: bold; color: #c41e3a; }
    .section-title { font-weight: bold; margin-top: 20px; margin-bottom: 10px; text-transform: uppercase; font-size: 12px; }
    .row { margin-bottom: 12px; }
    .label { font-weight: bold; width: 150px; display: inline-block; }
    .value { display: inline-block; }
    .amount-box { background-color: #ffe6e6; padding: 15px; border: 2px solid #c41e3a; margin: 20px 0; text-align: center; }
    .amount-value { font-size: 24px; font-weight: bold; color: #c41e3a; }
    .bank-details { background-color: #f0f0f0; padding: 15px; margin: 20px 0; border: 1px solid #999; }
    .bank-details-title { font-weight: bold; margin-bottom: 10px; }
    .bank-row { margin-bottom: 8px; }
    .penal-interest { background-color: #fff0f0; padding: 15px; margin: 20px 0; border-left: 4px solid #c41e3a; font-size: 11px; line-height: 1.6; }
    .penal-title { font-weight: bold; color: #c41e3a; }
    .footer { text-align: center; margin-top: 40px; font-size: 10px; color: #666; border-top: 1px solid #999; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-name">ROF GROUP</div>
      <div class="tagline">Building Dreams, Delivering Homes</div>
    </div>

    <div class="letter-title">DEMAND LETTER - PAYMENT NOTICE</div>

    <div class="date-line">Date: {{letterDate}}</div>

    <div class="content">
      <div class="row">
        <strong>TO,</strong>
      </div>
      <div class="row">
        {{consumerName}}<br>
        Mobile: {{consumerMobile}}<br>
        Email: {{consumerEmail}}
      </div>

      <div class="row" style="margin-top: 30px;">
        <strong>RE: PAYMENT DEMAND - Unit {{unitNumber}}, {{projectName}}</strong>
      </div>

      <div class="alert-box">
        <div class="alert-title">⚠ URGENT: PAYMENT DUE</div>
        <div style="margin-top: 10px;">
          This is a formal demand for payment of the outstanding installment on your allotted unit. Please arrange payment immediately to avoid penalties and interest charges.
        </div>
      </div>

      <div class="section-title">Demand Details</div>
      <div class="row">
        <span class="label">Demand Number:</span>
        <span class="value">{{demandNumber}}</span>
      </div>
      <div class="row">
        <span class="label">Unit Allotted:</span>
        <span class="value">{{unitNumber}}, {{towerBlock}}, Floor {{floorNumber}}</span>
      </div>
      <div class="row">
        <span class="label">Unit Type:</span>
        <span class="value">{{bhkType}}</span>
      </div>
      <div class="row">
        <span class="label">Project:</span>
        <span class="value">{{projectName}}</span>
      </div>
      <div class="row">
        <span class="label">Due Date:</span>
        <span class="value"><strong>{{dueDate}}</strong></span>
      </div>

      <div class="amount-box">
        <div style="font-size: 12px; margin-bottom: 10px;">AMOUNT DUE</div>
        <div class="amount-value">₹{{demandAmountInr}}</div>
        <div style="font-size: 11px; color: #666; margin-top: 5px;">Outstanding Balance</div>
      </div>

      <div class="bank-details">
        <div class="bank-details-title">PAYMENT INSTRUCTIONS</div>
        <div class="bank-row">
          <strong>Bank Account Details:</strong>
        </div>
        <div class="bank-row">
          Account Holder: {{bankAccountName}}<br>
          Account Number: {{bankAccountNumber}}<br>
          IFSC Code: {{bankIFSC}}<br>
          Bank Name: {{bankName}}
        </div>
        <div class="bank-row" style="margin-top: 15px;">
          <strong>Payment Methods:</strong> Bank Transfer, NEFT, RTGS, Online Payment
        </div>
        <div class="bank-row" style="margin-top: 10px;">
          <strong>Please include your Unit Number ({{unitNumber}}) in the payment reference.</strong>
        </div>
      </div>

      <div class="penal-interest">
        <div class="penal-title">HRERA RULE 15 - LATE PAYMENT PENALTY</div>
        <div style="margin-top: 10px;">
          As per HRERA (Haryana Real Estate Regulatory Authority) Rule 15, if payment is not made by the due date, penal interest at the rate of 11.10% per annum will be charged on the outstanding amount. The outstanding balance as on {{letterDate}} is ₹{{demandAmountInr}}, for which interest will be calculated daily if payment is delayed.
        </div>
      </div>

      <div class="row" style="margin-top: 30px;">
        <strong>Payment Confirmation:</strong> Once payment is received, you will receive a payment receipt and updated payment schedule via email and WhatsApp.
      </div>

      <div class="row" style="margin-top: 20px;">
        <strong>For Queries:</strong> Contact our Accounts Department at {{contactEmail}} or {{contactPhone}}.
      </div>

      <div class="row" style="margin-top: 30px; background-color: #f9f9f9; padding: 15px; border-left: 4px solid #999;">
        <em>This is an electronically generated demand notice. It is valid and binding. For any disputes or payment plan modifications, please contact us within 7 days of this notice.</em>
      </div>
    </div>

    <div class="footer">
      ROF GROUP | RERA Registration: {{projectRERANumber}}<br>
      {{letterDate}}
    </div>
  </div>
</body>
</html>',
  ARRAY['consumerName', 'consumerMobile', 'consumerEmail', 'unitNumber', 'towerBlock', 'floorNumber', 'bhkType', 'projectName', 'letterDate', 'demandNumber', 'dueDate', 'demandAmountInr', 'bankAccountName', 'bankAccountNumber', 'bankIFSC', 'bankName', 'contactEmail', 'contactPhone', 'projectRERANumber'],
  1,
  NOW(),
  NOW()
);

INSERT INTO document_templates (project_id, document_type, name, body_html, merge_fields, version_number, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'payment_receipt',
  'Payment Receipt',
  E'<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Courier New, monospace; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 800px; margin: 20px auto; padding: 30px; background-color: white; border: 2px solid #1a5490; }
    .header { text-align: center; border-bottom: 2px solid #1a5490; padding-bottom: 15px; margin-bottom: 20px; }
    .company-name { font-size: 20px; font-weight: bold; color: #1a5490; }
    .tagline { font-size: 11px; color: #666; margin-top: 5px; }
    .receipt-title { text-align: center; font-size: 14px; font-weight: bold; margin: 20px 0; text-transform: uppercase; }
    .receipt-number { text-align: center; font-size: 12px; margin-bottom: 20px; }
    .row { display: flex; margin-bottom: 8px; }
    .label { width: 180px; font-weight: bold; }
    .value { flex: 1; }
    .line { border-bottom: 1px dashed #999; margin: 15px 0; }
    .amount-section { background-color: #f0f0f0; padding: 15px; margin: 20px 0; border: 1px solid #999; }
    .amount-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .amount-row-label { font-weight: bold; }
    .total-amount { display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 2px solid #333; font-size: 14px; font-weight: bold; }
    .section-title { font-weight: bold; margin-top: 20px; margin-bottom: 10px; text-transform: uppercase; font-size: 11px; }
    .details-box { background-color: #fafafa; padding: 12px; border: 1px solid #ddd; margin: 15px 0; font-size: 11px; line-height: 1.6; }
    .signature-area { margin-top: 40px; }
    .signature-line { margin-top: 30px; margin-bottom: 5px; border-top: 1px solid #333; }
    .signature-label { font-size: 10px; }
    .footer { text-align: center; margin-top: 30px; font-size: 9px; color: #666; border-top: 1px dashed #999; padding-top: 15px; }
    .stamp-area { text-align: right; margin-top: 40px; font-size: 11px; color: #999; font-style: italic; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-name">ROF GROUP</div>
      <div class="tagline">Building Dreams, Delivering Homes</div>
    </div>

    <div class="receipt-title">PAYMENT RECEIPT</div>
    <div class="receipt-number">Receipt No. {{receiptNumber}}</div>

    <div class="row">
      <div class="label">Received From:</div>
      <div class="value">{{consumerName}}</div>
    </div>
    <div class="row">
      <div class="label">Mobile:</div>
      <div class="value">{{consumerMobile}}</div>
    </div>
    <div class="row">
      <div class="label">Email:</div>
      <div class="value">{{consumerEmail}}</div>
    </div>

    <div class="line"></div>

    <div class="section-title">Unit Details</div>
    <div class="row">
      <div class="label">Unit Number:</div>
      <div class="value">{{unitNumber}}, {{towerBlock}}, Floor {{floorNumber}}</div>
    </div>
    <div class="row">
      <div class="label">Unit Type:</div>
      <div class="value">{{bhkType}}</div>
    </div>
    <div class="row">
      <div class="label">Project:</div>
      <div class="value">{{projectName}}</div>
    </div>

    <div class="line"></div>

    <div class="section-title">Payment Details</div>
    <div class="row">
      <div class="label">Payment Date:</div>
      <div class="value">{{paymentDate}}</div>
    </div>
    <div class="row">
      <div class="label">Payment Method:</div>
      <div class="value">{{paymentMethod}}</div>
    </div>
    <div class="row">
      <div class="label">Transaction Ref:</div>
      <div class="value">{{transactionRef}}</div>
    </div>

    <div class="amount-section">
      <div class="amount-row">
        <span class="amount-row-label">Amount Received:</span>
        <span>₹{{amountPaidInr}}</span>
      </div>
      <div class="line" style="margin: 10px 0;"></div>
      <div class="total-amount">
        <span>TOTAL RECEIVED:</span>
        <span>₹{{amountPaidInr}}</span>
      </div>
    </div>

    <div class="section-title">Payment Status</div>
    <div class="details-box">
      Outstanding Balance: ₹{{outstandingAmountInr}}<br>
      Total Project Value: ₹{{totalPriceInr}}<br>
      Amount Paid to Date: ₹{{totalAmountPaidInr}}<br>
      Next Installment Due: {{nextDueDate}}
    </div>

    <div class="signature-area">
      <div style="display: flex; justify-content: space-between;">
        <div>
          <div class="signature-line"></div>
          <div class="signature-label">Authorized Officer<br>ROF GROUP<br>{{paymentDate}}</div>
        </div>
        <div class="stamp-area">
          [STAMP/SEAL]
        </div>
      </div>
    </div>

    <div class="footer">
      This receipt is valid proof of payment. Please retain for your records.<br>
      For queries contact: {{contactEmail}} | {{contactPhone}}<br>
      RERA Registration: {{projectRERANumber}}
    </div>
  </div>
</body>
</html>',
  ARRAY['receiptNumber', 'consumerName', 'consumerMobile', 'consumerEmail', 'unitNumber', 'towerBlock', 'floorNumber', 'bhkType', 'projectName', 'paymentDate', 'paymentMethod', 'transactionRef', 'amountPaidInr', 'outstandingAmountInr', 'totalPriceInr', 'totalAmountPaidInr', 'nextDueDate', 'contactEmail', 'contactPhone', 'projectRERANumber'],
  1,
  NOW(),
  NOW()
);

INSERT INTO document_templates (project_id, document_type, name, body_html, merge_fields, version_number, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'bba',
  'Buyer-Builder Agreement (BBA)',
  E'<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Garamond, serif; color: #333; margin: 0; padding: 0; }
    .container { max-width: 900px; margin: 30px auto; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; }
    .company-name { font-size: 20px; font-weight: bold; color: #1a5490; }
    .letter-title { text-align: center; font-size: 16px; font-weight: bold; margin: 30px 0 20px 0; text-transform: uppercase; }
    .content { line-height: 1.8; }
    .section-number { font-weight: bold; text-transform: uppercase; margin-top: 25px; margin-bottom: 10px; }
    .row { margin-bottom: 12px; }
    .label { font-weight: bold; width: 120px; display: inline-block; }
    .indent { margin-left: 30px; }
    .clause { margin-bottom: 15px; text-align: justify; }
    .signature-block { margin-top: 50px; }
    .party-section { margin-top: 30px; }
    .signature-line { margin-top: 35px; margin-bottom: 5px; border-top: 1px solid #333; }
    .signature-label { font-size: 11px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-name">ROF GROUP</div>
      <div style="font-style: italic; font-size: 12px; margin-top: 5px;">Building Dreams, Delivering Homes</div>
    </div>

    <div class="letter-title">BUYER-BUILDER AGREEMENT (BBA)</div>

    <div style="text-align: center; margin: 20px 0;">
      This Agreement made on {{agreementDate}}
    </div>

    <div class="content">
      <div class="clause">
        <strong>BETWEEN</strong>
      </div>

      <div class="clause indent">
        <strong>ROF INFRATECH & HOUSING PVT. LTD.</strong>, a company duly registered under the Companies Act, 1956, having its registered office at ROF Group, Gurugram, Haryana (hereinafter called "the <strong>BUILDER</strong>")
      </div>

      <div class="clause">
        <strong>AND</strong>
      </div>

      <div class="clause indent">
        <strong>{{consumerName}}</strong>, son/daughter of {{coApplicantName}}, residing at {{consumerAddress}}, Aadhar: {{consumerAadhaar}}, PAN: {{consumerPAN}}, Income Category: {{incomeCategory}} (hereinafter called "the <strong>BUYER</strong>")
      </div>

      <div class="section-number">1. DEFINITIONS AND INTERPRETATION</div>
      <div class="clause">
        The project is known as "{{projectName}}" registered with HRERA under Registration No. {{projectRERANumber}}, located at {{projectLocation}}.
      </div>

      <div class="section-number">2. THE PROPERTY</div>
      <div class="clause">
        <div class="row">
          <span class="label">Unit Number:</span>
          <span>{{unitNumber}}, {{towerBlock}}, Floor {{floorNumber}}</span>
        </div>
        <div class="row">
          <span class="label">Unit Type:</span>
          <span>{{bhkType}}</span>
        </div>
        <div class="row">
          <span class="label">Carpet Area:</span>
          <span>{{carpetAreaSqFt}} Sq.Ft.</span>
        </div>
        <div class="row">
          <span class="label">Total Consideration:</span>
          <span>₹{{totalPriceInr}}</span>
        </div>
      </div>

      <div class="section-number">3. PAYMENT SCHEDULE</div>
      <div class="clause">
        <div style="margin: 15px 0;">
          The BUYER shall pay the total consideration amount in the following manner:
        </div>
        <div class="indent">
          (a) Booking Amount (5%): ₹{{bookingAmountInr}} - Paid on or before allotment date<br>
          (b) Allotment Amount (20%): ₹{{allotmentAmountInr}} - Due within 15 days of allotment<br>
          (c) Six (6) Installments of 12.5% each: ₹{{installmentAmountInr}} each - Due on quarterly basis (6, 12, 18, 24, 30, 36 months from allotment)
        </div>
      </div>

      <div class="section-number">4. POSSESSION</div>
      <div class="clause">
        The BUILDER shall hand over possession of the Unit to the BUYER after completion of construction and all regulatory approvals, or by {{possessionDate}}, whichever is earlier. Possession shall be handed over within 30 days of the Possession Letter.
      </div>

      <div class="section-number">5. DEFAULT AND CANCELLATION</div>
      <div class="clause">
        <div class="indent">
          (a) If the BUYER defaults in payment of any installment for more than 30 days, the BUILDER may cancel the allotment after giving 15 days written notice.<br><br>
          (b) If the BUYER wishes to cancel after allotment, a forfeiture of ₹29,500 (Rupees Twenty-Nine Thousand Five Hundred Only) plus applicable GST shall be deducted from the amount paid.<br><br>
          (c) Refund of the balance amount shall be processed within 60 days of cancellation.
        </div>
      </div>

      <div class="section-number">6. HRERA COMPLIANCE</div>
      <div class="clause">
        This agreement is subject to the provisions of the Real Estate (Regulation and Development) Act, 2016 (RERA) and Haryana Affordable Housing Policy. The BUYER acknowledges receipt of the RERA registration details and project completion schedule.
      </div>

      <div class="section-number">7. PENALTY FOR DELAYS</div>
      <div class="clause">
        As per HRERA Rule 15, if the BUILDER delays in handing over possession beyond the agreed date, the BUYER shall be entitled to receive a refund of 10% per annum interest on all payments made.
      </div>

      <div class="section-number">8. GENERAL CONDITIONS</div>
      <div class="clause">
        <div class="indent">
          (a) The BUYER is responsible for paying all statutory charges including registration, stamp duty, municipal taxes, etc.<br><br>
          (b) The Unit is sold on "as-is-where-is" basis after completion.<br><br>
          (c) The price is exclusive of GST (where applicable) and other levies.<br><br>
          (d) Any structural or material defect must be reported within 30 days of possession.
        </div>
      </div>

      <div class="signature-block">
        <div style="display: flex; justify-content: space-between; margin-top: 60px;">
          <div class="party-section">
            <strong>FOR THE BUILDER:</strong>
            <div class="signature-line"></div>
            <div class="signature-label">{{builderSignatoryName}}<br>Authorized Signatory<br>ROF Group<br>Date: {{agreementDate}}</div>
          </div>
          <div class="party-section">
            <strong>FOR THE BUYER:</strong>
            <div class="signature-line"></div>
            <div class="signature-label">{{consumerName}}<br>Buyer<br>Date: _______________</div>
          </div>
        </div>

        <div style="margin-top: 50px; text-align: center;">
          <strong>WITNESS</strong>
        </div>
        <div style="display: flex; justify-content: space-around; margin-top: 40px;">
          <div>
            <div class="signature-line" style="width: 150px;"></div>
            <div class="signature-label" style="text-align: center;">Witness 1<br>Date: _______________</div>
          </div>
          <div>
            <div class="signature-line" style="width: 150px;"></div>
            <div class="signature-label" style="text-align: center;">Witness 2<br>Date: _______________</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>',
  ARRAY['agreementDate', 'consumerName', 'coApplicantName', 'consumerAddress', 'consumerAadhaar', 'consumerPAN', 'incomeCategory', 'projectName', 'projectRERANumber', 'projectLocation', 'unitNumber', 'towerBlock', 'floorNumber', 'bhkType', 'carpetAreaSqFt', 'totalPriceInr', 'bookingAmountInr', 'allotmentAmountInr', 'installmentAmountInr', 'possessionDate', 'builderSignatoryName'],
  1,
  NOW(),
  NOW()
);

INSERT INTO document_templates (project_id, document_type, name, body_html, merge_fields, version_number, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'noc',
  'No Objection Certificate (NOC)',
  E'<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Garamond, serif; color: #333; margin: 0; padding: 0; }
    .container { max-width: 850px; margin: 40px auto; padding: 50px; border: 2px solid #1a5490; background-color: #fafafa; text-align: center; }
    .header { margin-bottom: 40px; }
    .company-name { font-size: 22px; font-weight: bold; color: #1a5490; }
    .tagline { font-size: 12px; color: #666; font-style: italic; margin-top: 8px; }
    .document-title { font-size: 18px; font-weight: bold; margin: 40px 0 10px 0; text-transform: uppercase; color: #1a5490; }
    .noc-date { font-size: 12px; margin-bottom: 40px; }
    .content { text-align: left; line-height: 1.9; }
    .recipient { text-align: center; margin: 30px 0; }
    .recipient-name { font-weight: bold; font-size: 14px; }
    .main-text { margin: 30px 0; text-align: center; }
    .details-box { background-color: #f0f0f0; padding: 20px; border: 1px solid #999; margin: 30px 0; }
    .detail-row { margin: 10px 0; }
    .detail-label { font-weight: bold; width: 140px; display: inline-block; }
    .detail-value { display: inline-block; }
    .certificate-text { margin: 40px 0; text-align: center; font-weight: bold; font-size: 14px; }
    .declaration { background-color: #ffffcc; padding: 20px; margin: 30px 0; border-left: 4px solid #1a5490; text-align: center; font-style: italic; }
    .signature-section { margin-top: 50px; text-align: center; }
    .signature-line { margin-top: 30px; margin-bottom: 5px; border-top: 1px solid #333; width: 250px; margin-left: auto; margin-right: auto; }
    .signature-label { font-size: 11px; }
    .footer { text-align: center; margin-top: 40px; font-size: 10px; color: #666; border-top: 1px solid #999; padding-top: 20px; }
    .seal-area { text-align: right; margin-top: 30px; font-size: 11px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-name">ROF GROUP</div>
      <div class="tagline">Building Dreams, Delivering Homes</div>
    </div>

    <div class="document-title">No Objection Certificate</div>
    <div class="noc-date">(NOC) dated {{nocDate}}</div>

    <div class="recipient">
      <div class="recipient-name">{{consumerName}}</div>
      <div style="font-size: 12px; margin-top: 10px;">
        {{consumerAddress}}<br>
        Mobile: {{consumerMobile}} | Email: {{consumerEmail}}
      </div>
    </div>

    <div class="main-text">
      <strong>RE: NO OBJECTION CERTIFICATE FOR UNIT {{unitNumber}}</strong>
    </div>

    <div class="certificate-text">
      This is to certify that
    </div>

    <div class="details-box">
      <div class="detail-row">
        <span class="detail-label">Name of Allottee:</span>
        <span class="detail-value">{{consumerName}}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Aadhar Number:</span>
        <span class="detail-value">{{consumerAadhaar}}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">PAN:</span>
        <span class="detail-value">{{consumerPAN}}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Unit Number:</span>
        <span class="detail-value">{{unitNumber}}, {{towerBlock}}, Floor {{floorNumber}}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Project:</span>
        <span class="detail-value">{{projectName}} (RERA: {{projectRERANumber}})</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Total Price:</span>
        <span class="detail-value">₹{{totalPriceInr}}</span>
      </div>
    </div>

    <div class="content">
      <div style="text-align: center; margin: 30px 0;">
        <strong>HAS PAID ALL DUE PAYMENTS AND OUTSTANDING AMOUNTS</strong>
      </div>

      <div style="text-align: center; margin: 25px 0;">
        ROF INFRATECH & HOUSING PVT. LTD. hereby certifies that all outstanding dues, payments, and charges relating to the above-mentioned unit have been cleared as on {{nocDate}}. There are no pending demands or liabilities against the allottee.
      </div>

      <div class="declaration">
        This NOC is issued for the purpose of property transfer, registration, or other legal requirements. The allottee is now free and clear to proceed with any further transactions related to this unit.
      </div>

      <div style="text-align: center; margin: 25px 0; line-height: 1.8;">
        This certificate is valid for a period of 6 months from the date of issue. Any claims arising after this period shall be the responsibility of the allottee.
      </div>
    </div>

    <div class="signature-section">
      <div class="signature-line"></div>
      <div class="signature-label">
        <strong>Authorized Signatory</strong><br>
        ROF GROUP<br>
        Date: {{nocDate}}<br>
        Seal/Stamp: [SEAL]
      </div>
    </div>

    <div class="seal-area">
      [COMPANY SEAL]
    </div>

    <div class="footer">
      ROF INFRATECH & HOUSING PVT. LTD.<br>
      RERA Registration: {{projectRERANumber}}<br>
      {{nocDate}}
    </div>
  </div>
</body>
</html>',
  ARRAY['nocDate', 'consumerName', 'consumerAddress', 'consumerMobile', 'consumerEmail', 'consumerAadhaar', 'consumerPAN', 'unitNumber', 'towerBlock', 'floorNumber', 'projectName', 'projectRERANumber', 'totalPriceInr'],
  1,
  NOW(),
  NOW()
);

INSERT INTO document_templates (project_id, document_type, name, body_html, merge_fields, version_number, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'possession_letter',
  'Possession Letter',
  E'<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Garamond, serif; color: #333; margin: 0; padding: 0; }
    .container { max-width: 900px; margin: 40px auto; padding: 40px; border: 1px solid #2a7f2a; background-color: #f5fff5; }
    .header { text-align: center; border-bottom: 3px solid #2a7f2a; padding-bottom: 20px; margin-bottom: 30px; }
    .company-name { font-size: 24px; font-weight: bold; color: #2a7f2a; }
    .tagline { font-size: 12px; color: #666; font-style: italic; margin-top: 5px; }
    .letter-title { text-align: center; font-size: 16px; font-weight: bold; margin: 30px 0 20px 0; text-transform: uppercase; color: #2a7f2a; }
    .date-line { text-align: right; margin-bottom: 20px; }
    .content { line-height: 1.8; }
    .section-title { font-weight: bold; margin-top: 20px; margin-bottom: 10px; text-transform: uppercase; font-size: 12px; }
    .row { margin-bottom: 12px; }
    .label { font-weight: bold; width: 150px; display: inline-block; }
    .value { display: inline-block; }
    .checklist { background-color: #ffffcc; padding: 15px; margin: 20px 0; border-left: 4px solid #2a7f2a; }
    .checklist-title { font-weight: bold; margin-bottom: 10px; }
    .checklist-item { margin: 5px 0; }
    .success-box { background-color: #e8f5e9; padding: 15px; border: 2px solid #2a7f2a; margin: 20px 0; text-align: center; }
    .success-text { font-size: 14px; font-weight: bold; color: #2a7f2a; }
    .instructions { background-color: #f0f0f0; padding: 15px; margin: 20px 0; border: 1px solid #999; line-height: 1.6; }
    .instructions-title { font-weight: bold; margin-bottom: 10px; }
    .signature-block { margin-top: 40px; }
    .signature-line { margin-top: 40px; margin-bottom: 5px; border-top: 1px solid #333; }
    .signature-label { font-size: 11px; }
    .footer { text-align: center; margin-top: 40px; font-size: 10px; color: #666; border-top: 1px solid #999; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-name">ROF GROUP</div>
      <div class="tagline">Building Dreams, Delivering Homes</div>
    </div>

    <div class="letter-title">POSSESSION LETTER</div>

    <div class="date-line">Date: {{possessionDate}}</div>

    <div class="content">
      <div class="row">
        <strong>To,</strong>
      </div>
      <div class="row">
        {{consumerName}}<br>
        {{consumerEmail}}<br>
        {{consumerMobile}}
      </div>

      <div class="row" style="margin-top: 30px;">
        <strong>RE: POSSESSION OF UNIT - {{projectName}}</strong>
      </div>

      <div class="success-box">
        <div class="success-text">🎉 CONGRATULATIONS! YOUR UNIT IS READY FOR POSSESSION</div>
      </div>

      <div class="row" style="margin-top: 20px;">
        Dear {{consumerName}},
      </div>

      <div class="row">
        We are delighted to inform you that construction of Unit No. {{unitNumber}}, {{towerBlock}}, Floor {{floorNumber}}, {{projectName}}, has been completed in accordance with the approved plan and regulations. The unit is now ready for handover and possession.
      </div>

      <div class="section-title">Unit Details</div>
      <div class="row">
        <span class="label">Unit Number:</span>
        <span class="value">{{unitNumber}}, {{towerBlock}}, Floor {{floorNumber}}</span>
      </div>
      <div class="row">
        <span class="label">Unit Type:</span>
        <span class="value">{{bhkType}}</span>
      </div>
      <div class="row">
        <span class="label">Carpet Area:</span>
        <span class="value">{{carpetAreaSqFt}} Sq.Ft.</span>
      </div>
      <div class="row">
        <span class="label">Possession Date:</span>
        <span class="value">{{possessionDate}}</span>
      </div>
      <div class="row">
        <span class="label">OC (Occupancy Certificate):</span>
        <span class="value">Issued on {{ocDate}}</span>
      </div>

      <div class="section-title">Possession Handover Checklist</div>
      <div class="checklist">
        <div class="checklist-title">Please ensure the following items are covered during possession handover:</div>
        <div class="checklist-item">✓ Physical inspection of the unit for any damage or defects</div>
        <div class="checklist-item">✓ Verification of all fixtures, fittings, and color finishes</div>
        <div class="checklist-item">✓ Confirmation of water and electrical supply connections</div>
        <div class="checklist-item">✓ Receipt of keys and entry cards</div>
        <div class="checklist-item">✓ Signature on the Possession Handover Form</div>
        <div class="checklist-item">✓ Receipt of Building Completion Certificate and OC</div>
        <div class="checklist-item">✓ Clarification on Maintenance Account procedures</div>
      </div>

      <div class="section-title">Next Steps</div>
      <div class="instructions">
        <div class="instructions-title">Important Actions to Complete:</div>
        <div style="margin: 10px 0;">
          1. <strong>Schedule Possession:</strong> Contact our Possession Team to schedule your unit inspection and key handover appointment within 30 days of this letter.<br><br>
          2. <strong>Final Inspection:</strong> Conduct a thorough inspection to identify any defects. Submit a list of defects within 10 days of possession for rectification.<br><br>
          3. <strong>Registration:</strong> Register the unit with the local municipality and arrange for property registration as per applicable laws.<br><br>
          4. <strong>Maintenance Account:</strong> Contribute to the building maintenance fund and complete the Bye-laws registration.<br><br>
          5. <strong>Utility Connections:</strong> Apply for water meter, electricity connection, and other utility services in your name.
        </div>
      </div>

      <div class="row" style="margin-top: 30px;">
        <strong>Contact Information:</strong><br>
        Possession Team: {{contactPhone}}<br>
        Email: {{contactEmail}}<br>
        Office Hours: Monday - Saturday, 10:00 AM - 6:00 PM
      </div>

      <div class="row" style="margin-top: 25px; background-color: #f9f9f9; padding: 15px; border-left: 4px solid #2a7f2a;">
        Thank you for choosing ROF Group. We are committed to ensuring a smooth and pleasant handover experience. Your dream home is now ready!
      </div>

      <div class="signature-block">
        <div style="display: flex; justify-content: space-between; margin-top: 60px;">
          <div>
            <div class="signature-line"></div>
            <div class="signature-label"><strong>For ROF Group</strong><br>Authorized Signatory<br>Date: {{possessionDate}}</div>
          </div>
          <div>
            <div class="signature-line"></div>
            <div class="signature-label"><strong>Allottee Acknowledgement</strong><br>{{consumerName}}<br>Date: _______________</div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      ROF GROUP | RERA Registration: {{projectRERANumber}}<br>
      Building Dreams, Delivering Homes | {{possessionDate}}
    </div>
  </div>
</body>
</html>',
  ARRAY['possessionDate', 'consumerName', 'consumerEmail', 'consumerMobile', 'projectName', 'unitNumber', 'towerBlock', 'floorNumber', 'bhkType', 'carpetAreaSqFt', 'ocDate', 'contactPhone', 'contactEmail', 'projectRERANumber'],
  1,
  NOW(),
  NOW()
);

INSERT INTO document_templates (project_id, document_type, name, body_html, merge_fields, version_number, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'cancellation_letter',
  'Cancellation/Surrender Letter',
  E'<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Garamond, serif; color: #333; margin: 0; padding: 0; }
    .container { max-width: 900px; margin: 40px auto; padding: 40px; border: 1px solid #d32f2f; background-color: #fff5f5; }
    .header { text-align: center; border-bottom: 3px solid #d32f2f; padding-bottom: 20px; margin-bottom: 30px; }
    .company-name { font-size: 24px; font-weight: bold; color: #d32f2f; }
    .tagline { font-size: 12px; color: #666; font-style: italic; margin-top: 5px; }
    .letter-title { text-align: center; font-size: 16px; font-weight: bold; margin: 30px 0 20px 0; text-transform: uppercase; color: #d32f2f; }
    .date-line { text-align: right; margin-bottom: 20px; }
    .content { line-height: 1.8; }
    .section-title { font-weight: bold; margin-top: 20px; margin-bottom: 10px; text-transform: uppercase; font-size: 12px; }
    .row { margin-bottom: 12px; }
    .label { font-weight: bold; width: 150px; display: inline-block; }
    .value { display: inline-block; }
    .alert-box { background-color: #ffe0e0; padding: 15px; border-left: 4px solid #d32f2f; margin: 20px 0; }
    .alert-title { font-weight: bold; color: #d32f2f; }
    .financial-details { background-color: #f0f0f0; padding: 20px; border: 1px solid #999; margin: 20px 0; }
    .financial-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .financial-row-label { font-weight: bold; }
    .total-row { display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 2px solid #333; font-weight: bold; }
    .terms { margin-top: 25px; line-height: 1.6; font-size: 11px; }
    .signature-block { margin-top: 40px; }
    .signature-line { margin-top: 35px; margin-bottom: 5px; border-top: 1px solid #333; }
    .signature-label { font-size: 11px; }
    .footer { text-align: center; margin-top: 40px; font-size: 10px; color: #666; border-top: 1px solid #999; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-name">ROF GROUP</div>
      <div class="tagline">Building Dreams, Delivering Homes</div>
    </div>

    <div class="letter-title">ALLOTMENT CANCELLATION & SURRENDER LETTER</div>

    <div class="date-line">Date: {{cancellationDate}}</div>

    <div class="content">
      <div class="row">
        <strong>To,</strong>
      </div>
      <div class="row">
        {{consumerName}}<br>
        {{consumerEmail}}<br>
        {{consumerMobile}}
      </div>

      <div class="row" style="margin-top: 30px;">
        <strong>RE: CANCELLATION OF ALLOTMENT - {{projectName}}, Unit {{unitNumber}}</strong>
      </div>

      <div class="alert-box">
        <div class="alert-title">⚠ ALLOTMENT CANCELLED</div>
        <div style="margin-top: 10px;">
          This letter confirms that your allotment for the above unit has been cancelled as per your request/builder action. Please note the financial settlement details below.
        </div>
      </div>

      <div class="section-title">Cancellation Details</div>
      <div class="row">
        <span class="label">Cancellation Date:</span>
        <span class="value">{{cancellationDate}}</span>
      </div>
      <div class="row">
        <span class="label">Unit:</span>
        <span class="value">{{unitNumber}}, {{towerBlock}}, Floor {{floorNumber}}</span>
      </div>
      <div class="row">
        <span class="label">Reason for Cancellation:</span>
        <span class="value">{{cancellationReason}}</span>
      </div>

      <div class="section-title">Financial Settlement (As per AHP Policy)</div>
      <div class="financial-details">
        <div class="financial-row">
          <span class="financial-row-label">Total Amount Paid:</span>
          <span>₹{{totalAmountPaidInr}}</span>
        </div>
        <div class="financial-row">
          <span class="financial-row-label">Forfeiture (₹25,000 + 18% GST):</span>
          <span>₹{{forfeitureAmountInr}}</span>
        </div>
        <div class="financial-row">
          <span class="financial-row-label">Less: TDS/Taxes (if applicable):</span>
          <span>₹{{tdsAmountInr}}</span>
        </div>
        <div class="total-row">
          <span>NET REFUND DUE:</span>
          <span>₹{{refundAmountInr}}</span>
        </div>
      </div>

      <div class="row" style="margin-top: 20px;">
        <strong>Refund Timeline:</strong> The above refund amount shall be processed within 60 days of this letter via bank transfer to your registered account.
      </div>

      <div class="section-title">Refund Processing</div>
      <div class="row">
        <span class="label">Refund Status:</span>
        <span class="value">{{refundStatus}}</span>
      </div>
      <div class="row">
        <span class="label">Expected Refund Date:</span>
        <span class="value">{{expectedRefundDate}}</span>
      </div>
      <div class="row">
        <span class="label">Refund Method:</span>
        <span class="value">NEFT/Bank Transfer to registered account</span>
      </div>

      <div class="terms">
        <strong>IMPORTANT TERMS & CONDITIONS:</strong><br><br>
        1. Upon receipt of this letter, all rights and claims on the allotted unit are hereby relinquished by the allottee.<br><br>
        2. The Unit stands surrendered to ROF Group for re-allotment or disposal as per company policy.<br><br>
        3. The forfeiture amount of ₹{{forfeitureAmountInr}} is as per Haryana Affordable Housing Policy and is non-refundable.<br><br>
        4. The allottee shall not make any further claims or demands beyond the net refund mentioned above.<br><br>
        5. All documents, including the Allotment Letter and Buyer-Builder Agreement (if signed), are now null and void.<br><br>
        6. The allottee agrees to execute all necessary documents to facilitate the cancellation and re-allotment process.
      </div>

      <div class="signature-block">
        <div style="display: flex; justify-content: space-between; margin-top: 60px;">
          <div>
            <div class="signature-line"></div>
            <div class="signature-label"><strong>For ROF Group</strong><br>Authorized Signatory<br>Date: {{cancellationDate}}</div>
          </div>
          <div>
            <div class="signature-line"></div>
            <div class="signature-label"><strong>Allottee Acknowledgement</strong><br>{{consumerName}}<br>Date: _______________</div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      ROF GROUP | RERA Registration: {{projectRERANumber}}<br>
      For queries contact: {{contactEmail}} | {{contactPhone}}<br>
      {{cancellationDate}}
    </div>
  </div>
</body>
</html>',
  ARRAY['cancellationDate', 'consumerName', 'consumerEmail', 'consumerMobile', 'projectName', 'unitNumber', 'towerBlock', 'floorNumber', 'cancellationReason', 'totalAmountPaidInr', 'forfeitureAmountInr', 'tdsAmountInr', 'refundAmountInr', 'refundStatus', 'expectedRefundDate', 'projectRERANumber', 'contactEmail', 'contactPhone'],
  1,
  NOW(),
  NOW()
);

INSERT INTO document_templates (project_id, document_type, name, body_html, merge_fields, version_number, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'welcome_letter',
  'Welcome Letter',
  E'<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Garamond, serif; color: #333; margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .container { max-width: 800px; margin: 40px auto; padding: 50px; background-color: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 40px; }
    .company-name { font-size: 32px; font-weight: bold; color: #667eea; }
    .tagline { font-size: 13px; color: #666; font-style: italic; margin-top: 8px; letter-spacing: 1px; }
    .greeting { text-align: center; font-size: 18px; margin: 40px 0 20px 0; }
    .greeting-name { color: #667eea; font-weight: bold; }
    .content { line-height: 1.9; font-size: 14px; }
    .intro-box { background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 20px; border-radius: 8px; margin: 25px 0; }
    .intro-text { text-align: center; font-size: 16px; color: #333; }
    .milestone-section { margin: 35px 0; }
    .milestone-title { font-size: 14px; font-weight: bold; color: #667eea; text-transform: uppercase; margin-bottom: 15px; }
    .milestone-item { margin: 12px 0 12px 20px; }
    .milestone-bullet { color: #667eea; font-weight: bold; }
    .unit-highlight { background-color: #f0f4ff; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; }
    .unit-detail { margin: 8px 0; }
    .unit-label { font-weight: bold; color: #667eea; }
    .cta-box { background-color: #667eea; color: white; padding: 20px; border-radius: 8px; margin: 30px 0; text-align: center; }
    .cta-text { font-size: 16px; }
    .cta-contact { margin-top: 15px; font-size: 13px; }
    .closing { text-align: center; margin: 40px 0; font-style: italic; color: #666; }
    .signature { text-align: center; margin-top: 40px; }
    .signature-line { font-size: 30px; color: #667eea; margin: 10px 0; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-name">ROF GROUP</div>
      <div class="tagline">Building Dreams, Delivering Homes</div>
    </div>

    <div class="greeting">
      Welcome to the ROF Family, <span class="greeting-name">{{consumerName}}!</span>
    </div>

    <div class="intro-box">
      <div class="intro-text">
        We are thrilled to welcome you as a proud member of the {{projectName}} community!
      </div>
    </div>

    <div class="content">
      <div style="margin: 25px 0;">
        Dear {{consumerName}},
      </div>

      <div style="margin: 20px 0; text-align: justify;">
        On behalf of ROF Group, we extend a warm welcome to you and your family. The allotment of your unit marks the beginning of an exciting journey towards owning your dream home. We are committed to ensuring that your experience with us is smooth, transparent, and delightful at every step.
      </div>

      <div class="unit-highlight">
        <div style="font-weight: bold; color: #667eea; margin-bottom: 10px;">YOUR NEW HOME</div>
        <div class="unit-detail">
          <span class="unit-label">Unit:</span> {{unitNumber}}, {{towerBlock}}, Floor {{floorNumber}}
        </div>
        <div class="unit-detail">
          <span class="unit-label">Type:</span> {{bhkType}} Apartment
        </div>
        <div class="unit-detail">
          <span class="unit-label">Area:</span> {{carpetAreaSqFt}} Sq.Ft. Carpet Area
        </div>
        <div class="unit-detail">
          <span class="unit-label">Project:</span> {{projectName}}
        </div>
      </div>

      <div class="milestone-section">
        <div class="milestone-title">🎯 What Happens Next?</div>
        <div class="milestone-item">
          <span class="milestone-bullet">1.</span> Sign the Buyer-Builder Agreement (BBA) within 30 days
        </div>
        <div class="milestone-item">
          <span class="milestone-bullet">2.</span> Complete your payment obligations as per the payment schedule
        </div>
        <div class="milestone-item">
          <span class="milestone-bullet">3.</span> Receive regular construction progress updates
        </div>
        <div class="milestone-item">
          <span class="milestone-bullet">4.</span> Complete KYC documentation and verification
        </div>
        <div class="milestone-item">
          <span class="milestone-bullet">5.</span> Prepare for possession by {{possessionDate}} (tentative)
        </div>
      </div>

      <div class="milestone-section">
        <div class="milestone-title">📋 Payment Schedule Summary</div>
        <div class="milestone-item">
          <span class="milestone-bullet">Booking:</span> ₹{{bookingAmountInr}} (Already Paid ✓)
        </div>
        <div class="milestone-item">
          <span class="milestone-bullet">Allotment:</span> ₹{{allotmentAmountInr}} (Due within 15 days)
        </div>
        <div class="milestone-item">
          <span class="milestone-bullet">Installments:</span> 6 quarterly payments of ₹{{installmentAmountInr}} each
        </div>
      </div>

      <div style="margin: 25px 0; background-color: #fff9e6; padding: 15px; border-radius: 5px;">
        <strong style="color: #d4a017;">💡 Did You Know?</strong><br>
        {{projectName}} is approved under the Haryana Affordable Housing Policy (AHP) with full RERA compliance. This ensures transparency, buyer protection, and adherence to all regulatory standards.
      </div>

      <div class="cta-box">
        <div class="cta-text">Questions? We're Here to Help!</div>
        <div class="cta-contact">
          {{contactEmail}} | {{contactPhone}}<br>
          Office Hours: Monday - Saturday, 10 AM - 6 PM
        </div>
      </div>

      <div style="margin: 30px 0;">
        We have assembled a dedicated team to support you throughout your journey with ROF Group. From documentation to construction updates to possession, our team will keep you informed and engaged at every milestone.
      </div>

      <div class="closing">
        Thank you for choosing ROF Group. We look forward to welcoming you home!
      </div>

      <div class="signature">
        <div style="color: #667eea; font-size: 16px; margin: 15px 0;">Warm Regards,</div>
        <div class="signature-line">ROF</div>
        <div style="font-size: 12px; color: #999;">ROF Group Family</div>
      </div>
    </div>

    <div class="footer">
      ROF INFRATECH & HOUSING PVT. LTD.<br>
      RERA Registration: {{projectRERANumber}} | {{projectLocation}}<br>
      Building Dreams, Delivering Homes
    </div>
  </div>
</body>
</html>',
  ARRAY['consumerName', 'projectName', 'unitNumber', 'towerBlock', 'floorNumber', 'bhkType', 'carpetAreaSqFt', 'possessionDate', 'bookingAmountInr', 'allotmentAmountInr', 'installmentAmountInr', 'contactEmail', 'contactPhone', 'projectRERANumber', 'projectLocation'],
  1,
  NOW(),
  NOW()
);

INSERT INTO document_templates (project_id, document_type, name, body_html, merge_fields, version_number, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'custom_letter',
  'Custom/Ad-hoc Letter',
  E'<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Garamond, serif; color: #333; margin: 0; padding: 0; }
    .container { max-width: 900px; margin: 40px auto; padding: 40px; border: 1px solid #999; background-color: #fafafa; }
    .header { text-align: center; border-bottom: 2px solid #1a5490; padding-bottom: 20px; margin-bottom: 30px; }
    .company-name { font-size: 24px; font-weight: bold; color: #1a5490; }
    .tagline { font-size: 12px; color: #666; font-style: italic; margin-top: 5px; }
    .date-line { text-align: right; margin-bottom: 20px; font-size: 12px; }
    .recipient { margin-bottom: 25px; }
    .content { line-height: 1.8; }
    .salutation { margin: 20px 0; }
    .body-text { margin: 20px 0; text-align: justify; }
    .sections { margin: 30px 0; }
    .section-title { font-weight: bold; margin-top: 25px; margin-bottom: 10px; text-transform: uppercase; font-size: 12px; }
    .section-content { margin: 15px 0; }
    .list-item { margin: 8px 0 8px 20px; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .table th, .table td { border: 1px solid #999; padding: 10px; text-align: left; }
    .table th { background-color: #e8e8e8; font-weight: bold; }
    .closing { margin: 40px 0; }
    .signature-block { margin-top: 50px; }
    .signature-line { margin-top: 35px; margin-bottom: 5px; border-top: 1px solid #333; }
    .signature-label { font-size: 11px; }
    .footer { text-align: center; margin-top: 40px; font-size: 10px; color: #666; border-top: 1px solid #999; padding-top: 20px; }
    .placeholder { background-color: #fffacd; padding: 10px; margin: 10px 0; border-left: 3px solid #1a5490; font-style: italic; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-name">ROF GROUP</div>
      <div class="tagline">Building Dreams, Delivering Homes</div>
    </div>

    <div class="date-line">Date: {{letterDate}}</div>

    <div class="recipient">
      To,<br>
      {{consumerName}}<br>
      {{consumerEmail}}<br>
      {{consumerMobile}}
    </div>

    <div class="content">
      <div class="salutation">
        Dear {{consumerName}},
      </div>

      <div class="placeholder">
        [INSERT LETTER SUBJECT / RE LINE HERE]<br>
        Example: RE: Project Update - {{projectName}}, Unit {{unitNumber}}
      </div>

      <div class="body-text">
        {{letterBodyContent}}
      </div>

      <div class="sections">
        <div class="section-title">Additional Information</div>
        <div class="section-content">
          <div class="placeholder">
            [INSERT RELEVANT DETAILS]<br>
            Insert project information, unit details, financial information, or any other required content.
          </div>
          <div class="list-item">• {{consumerName}} - Allottee</div>
          <div class="list-item">• Unit: {{unitNumber}}, {{towerBlock}}, Floor {{floorNumber}}</div>
          <div class="list-item">• Project: {{projectName}} (RERA: {{projectRERANumber}})</div>
          <div class="list-item">• Total Consideration: ₹{{totalPriceInr}}</div>
        </div>
      </div>

      <div class="sections">
        <div class="section-title">Common Merge Fields Available</div>
        <div class="placeholder">
          The following merge fields can be customized for this letter template:
        </div>
        <table class="table">
          <tr>
            <th>Consumer Fields</th>
            <th>Project/Unit Fields</th>
          </tr>
          <tr>
            <td>{{consumerName}}<br>{{consumerMobile}}<br>{{consumerEmail}}<br>{{consumerAadhaar}}<br>{{consumerPAN}}<br>{{incomeCategory}}</td>
            <td>{{projectName}}<br>{{projectRERANumber}}<br>{{unitNumber}}<br>{{towerBlock}}<br>{{floorNumber}}<br>{{bhkType}}<br>{{carpetAreaSqFt}}<br>{{totalPriceInr}}</td>
          </tr>
          <tr>
            <th>Payment Fields</th>
            <th>Date/Reference Fields</th>
          </tr>
          <tr>
            <td>{{totalAmountInr}}<br>{{bookingAmountInr}}<br>{{allotmentAmountInr}}<br>{{installmentAmountInr}}<br>{{dueDate}}<br>{{demandNumber}}<br>{{receiptNumber}}<br>{{paymentDate}}<br>{{paymentMethod}}<br>{{amountPaidInr}}<br>{{outstandingAmountInr}}</td>
            <td>{{allotmentDate}}<br>{{possessionDate}}<br>{{letterDate}}<br>{{referenceNumber}}<br>{{forfeitureAmountInr}}</td>
          </tr>
        </table>
      </div>

      <div class="closing">
        <div class="placeholder">
          [INSERT CLOSING MESSAGE]<br>
          Example: We look forward to your response. For any queries, please contact our team.
        </div>
      </div>

      <div class="signature-block">
        <div style="display: flex; justify-content: space-between; margin-top: 60px;">
          <div>
            <div class="signature-line"></div>
            <div class="signature-label"><strong>For ROF Group</strong><br>Authorized Signatory<br>{{signatoryName}}<br>Date: {{letterDate}}</div>
          </div>
          <div>
            <div class="signature-line"></div>
            <div class="signature-label"><strong>Recipient / Acknowledgement</strong><br>___________________<br>Name & Signature<br>Date: _______________</div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      ROF GROUP | RERA Registration: {{projectRERANumber}}<br>
      Building Dreams, Delivering Homes
    </div>
  </div>
</body>
</html>',
  ARRAY['letterDate', 'consumerName', 'consumerEmail', 'consumerMobile', 'letterBodyContent', 'projectName', 'projectRERANumber', 'unitNumber', 'towerBlock', 'floorNumber', 'bhkType', 'carpetAreaSqFt', 'totalPriceInr', 'consumerAadhaar', 'consumerPAN', 'incomeCategory', 'totalAmountInr', 'bookingAmountInr', 'allotmentAmountInr', 'installmentAmountInr', 'dueDate', 'demandNumber', 'receiptNumber', 'paymentDate', 'paymentMethod', 'amountPaidInr', 'outstandingAmountInr', 'allotmentDate', 'possessionDate', 'referenceNumber', 'forfeitureAmountInr', 'signatoryName'],
  1,
  NOW(),
  NOW()
);
