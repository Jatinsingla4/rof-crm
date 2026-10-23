// Letter shells (demand letter, check list) and the Indian number/date formatters the letters use.
export function numberToWordsIndian(num: number): string {
  if (num === 0) return 'Rupees Zero Only';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
                 'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
                 'Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '');
    if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+convert(n%100) : '');
    if (n < 100000) return convert(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+convert(n%1000) : '');
    if (n < 10000000) return convert(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+convert(n%100000) : '');
    return convert(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' '+convert(n%10000000) : '');
  }
  const intPart = Math.floor(Math.abs(num));
  const decPart = Math.round((Math.abs(num) - intPart) * 100);
  let result = 'Rupees ' + convert(intPart);
  if (decPart > 0) result += ' and ' + convert(decPart) + ' Paise';
  return result + ' Only';
}

export function ordinalFloor(n: number | null): string {
  if (!n) return 'Ground Floor';
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]) + ' Floor';
}

export function fmtDateIndia(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d as string);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtIndianNumber(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}

// Decimal-aware formatter -- used ONLY for ATS's balcony_price/balcony_rate/
// total_price merge fields (Phase 2 paise-precision), since those now carry
// real paisa-level decimals. fmtIndianNumber above is intentionally left
// untouched, as it is shared by 35 other call sites across demand letters,
// allotment letters, and conveyance deeds.
export function fmtIndianNumberDecimal(n: number): string {
  return (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtIndianMoneyDecimal(n: number): string {
  return (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtIndianAreaDecimal(n: number): string {
  return (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

// Get the professional demand letter HTML shell (bypasses template DB lookup)
export function getDemandLetterShell(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Demand Letter</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10.5pt; color: #000; background: #fff; }
  .page { max-width: 820px; margin: 0 auto; padding: 20px 28px; }
  .print-bar { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 14px; }
  @media print { .print-bar { display: none; } }
  .btn-print { background: #333; color: #fff; border: none; padding: 7px 18px; border-radius: 3px; cursor: pointer; font-size: 10pt; }
  .btn-close  { background: #ddd; color: #333; border: none; padding: 7px 14px; border-radius: 3px; cursor: pointer; font-size: 10pt; }
  .co-header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
  .co-name { font-size: 14pt; font-weight: 700; text-align: center; letter-spacing: 0.5px; }
  .co-cin  { font-size: 8.5pt; text-align: center; color: #333; margin-top: 1px; }
  .co-addr { font-size: 8.5pt; text-align: center; color: #333; margin-top: 3px; line-height: 1.5; }
  .co-ref-row { display: flex; justify-content: space-between; margin-top: 6px; font-size: 8.5pt; }
  .doc-title { text-align: center; border: 2px solid #000; font-size: 12pt; font-weight: 700; letter-spacing: 3px; padding: 5px 0; margin: 8px 0; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #000; margin-bottom: 8px; }
  .info-col { padding: 7px 10px; }
  .info-col:first-child { border-right: 1px solid #000; }
  .col-title { font-weight: 700; font-size: 9.5pt; border-bottom: 1px solid #000; margin-bottom: 5px; padding-bottom: 3px; }
  .info-row { display: flex; margin-bottom: 2px; font-size: 9pt; }
  .info-lbl { color: #444; width: 115px; flex-shrink: 0; }
  .info-val { font-weight: 600; }
  .subject { font-weight: 700; font-size: 10pt; margin: 6px 0; }
  .subject u { text-decoration: underline; }
  .body-para { font-size: 10pt; line-height: 1.6; margin: 5px 0; text-align: justify; }
  .demand-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 8.5pt; }
  .demand-table th { background: #000; color: #fff; padding: 5px 3px; border: 1px solid #555; text-align: center; font-size: 8pt; font-weight: 700; }
  .demand-table td { border: 1px solid #999; padding: 4px 3px; }
  .demand-table tbody tr:nth-child(4n+3) td, .demand-table tbody tr:nth-child(4n+4) td { background: #f5f5f5; }
  .demand-table tfoot td { font-weight: 700; background: #e8e8e8; border: 1px solid #666; }
  .tc { text-align: center; }
  .tr { text-align: right; }
  .bold { font-weight: 700; }
  .amt-words { border: 1px solid #999; padding: 7px 12px; margin: 6px 0; font-size: 10pt; }
  .pay-para { font-size: 10pt; line-height: 1.6; margin: 6px 0; text-align: justify; }
  .sign-off { margin: 14px 0 6px; }
  .sign-off p { font-size: 10pt; line-height: 1.8; }
  .sign-space { height: 38px; }
  .sign-name { font-weight: 700; font-size: 10pt; }
  .sign-title { font-size: 9pt; color: #333; }
  .rtgs-box { border: 1px solid #000; padding: 8px 12px; margin: 8px 0; }
  .rtgs-title { font-weight: 700; font-size: 10pt; margin-bottom: 5px; text-decoration: underline; }
  .rtgs-grid { display: grid; grid-template-columns: 150px 1fr; gap: 2px 6px; font-size: 9pt; }
  .rtgs-lbl { color: #444; }
  .rtgs-val { font-weight: 600; }
  .notes-section { margin: 8px 0; }
  .notes-title { font-weight: 700; font-size: 10pt; margin-bottom: 3px; }
  .notes-section ol { padding-left: 16px; }
  .notes-section ol li { font-size: 9pt; line-height: 1.6; margin-bottom: 2px; }
  .doc-footer { border-top: 1px solid #999; margin-top: 10px; padding-top: 5px; text-align: center; font-size: 8pt; color: #666; }
</style>
</head>
<body>
<div class="page">
  <div class="print-bar">
    <button class="btn-close" onclick="window.close()">Close</button>
    <button class="btn-print" onclick="window.print()">&#128438; Print / Save PDF</button>
  </div>
  <div class="co-header">
    <div class="co-name">{{companyName}}</div>
    <div class="co-cin">CIN: {{companyCin}}</div>
    <div class="co-addr">
      Corporate Office: {{companyAddress}}<br/>
      Registered Office: {{companyRegAddr}}<br/>
      T: {{companyPhone}} &nbsp;|&nbsp; W: {{companyWebsite}} &nbsp;|&nbsp; E: {{companyEmail}}
    </div>
    <div class="co-ref-row">
      <div>GSTIN: {{companyGstin}} &nbsp;|&nbsp; Place of Supply: {{placeOfSupply}}</div>
      <div>Customer ID: {{customerId}} &nbsp;|&nbsp; Invoice Date: {{invoiceDate}}</div>
    </div>
  </div>
  <div class="doc-title">DEMAND LETTER</div>
  <div class="info-grid">
    <div class="info-col">
      <div class="col-title">Allottee Details</div>
      <div class="info-row"><span class="info-lbl">Name</span><span class="info-val">{{consumerName}}</span></div>
      <div class="info-row"><span class="info-lbl">S/o, D/o, W/o</span><span class="info-val">{{fatherName}}</span></div>
      {{coApplicantRow}}
      <div class="info-row"><span class="info-lbl">Mobile</span><span class="info-val">{{mobile}}</span></div>
      <div class="info-row"><span class="info-lbl">Address</span><span class="info-val">{{address}}</span></div>
      <div class="info-row"><span class="info-lbl">Booking Date</span><span class="info-val">{{bookingDate}}</span></div>
    </div>
    <div class="info-col">
      <div class="col-title">Unit Details</div>
      <div class="info-row"><span class="info-lbl">Project</span><span class="info-val">{{projectName}}</span></div>
      <div class="info-row"><span class="info-lbl">Tower</span><span class="info-val">{{towerName}}</span></div>
      <div class="info-row"><span class="info-lbl">Floor</span><span class="info-val">{{floorNo}}</span></div>
      <div class="info-row"><span class="info-lbl">Unit No.</span><span class="info-val">{{unitNumber}}</span></div>
      <div class="info-row"><span class="info-lbl">Carpet Area (sq.ft.)</span><span class="info-val">{{carpetArea}}</span></div>
      <div class="info-row"><span class="info-lbl">Balcony Area (sq.ft.)</span><span class="info-val">{{balconyArea}}</span></div>
      <div class="info-row"><span class="info-lbl">Type</span><span class="info-val">{{unitCategory}}</span></div>
      <div class="info-row"><span class="info-lbl">RERA Regd. No.</span><span class="info-val">{{reraNo}}</span></div>
      <div class="info-row"><span class="info-lbl">Rate (&#8377;/sq.ft.)</span><span class="info-val">{{ratePerSqft}}</span></div>
      <div class="info-row"><span class="info-lbl">Payment Plan</span><span class="info-val">{{planName}}</span></div>
      <div class="info-row"><span class="info-lbl">Total Agreement Value</span><span class="info-val">&#8377;{{totalAmount}}</span></div>
    </div>
  </div>
  <div class="subject">
    Subject: <u>Demand Notice for Payment of Installment(s) — {{projectName}}, Unit No. {{unitNumber}}</u>
  </div>
  <p class="body-para">
    Dear <strong>{{consumerName}}</strong>,<br/>
    With reference to the allotment of Unit No. <strong>{{unitNumber}}</strong> admeasuring Carpet Area <strong>{{carpetArea}} Sq. Ft.</strong> and Balcony Area <strong>{{balconyArea}} Sq. Ft.</strong> in <strong>{{projectName}}</strong>, and as per the payment schedule agreed at the time of allotment, we wish to bring to your kind attention that the following installment(s) are due / overdue for payment. You are requested to make the payment on or before <strong>{{dueDate}}</strong> to avoid penal interest under HRERA Rule 15 @ <strong>{{penalRate}}%</strong> per annum on the outstanding amount.
  </p>
  <table class="demand-table">
    <thead>
      <tr>
        <th style="width:28px">S.No.</th>
        <th>Particulars</th>
        <th>Charge Type</th>
        <th style="width:68px">Due Date</th>
        <th style="width:72px">Basic Amt (&#8377;)</th>
        <th style="width:42px">CGST %</th>
        <th style="width:62px">CGST (&#8377;)</th>
        <th style="width:42px">SGST %</th>
        <th style="width:62px">SGST (&#8377;)</th>
        <th style="width:72px">Total Due (&#8377;)</th>
        <th style="width:68px">Paid (&#8377;)</th>
        <th style="width:72px">Payable (&#8377;)</th>
      </tr>
    </thead>
    <tbody>
      {{demandRows}}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4" class="tr bold">TOTAL</td>
        <td class="tr bold">—</td>
        <td class="tc bold">—</td>
        <td class="tr bold">{{totalCgst}}</td>
        <td class="tc bold">—</td>
        <td class="tr bold">{{totalSgst}}</td>
        <td class="tr bold">{{totalDue}}</td>
        <td class="tr bold">{{totalPaid}}</td>
        <td class="tr bold">{{totalPayable}}</td>
      </tr>
    </tfoot>
  </table>
  <div class="amt-words">
    <strong>Amount Payable in Words:</strong> {{amountInWords}}
  </div>
  <p class="pay-para">
    Kindly ensure payment is made via NEFT / RTGS / Cheque / Demand Draft in favour of the details given below. Please note that cheque is subject to realisation. In case of delayed payment, penal interest @ <strong>{{penalRate}}%</strong> per annum will be charged as per HRERA Rule 15. Failure to pay within the stipulated time may result in cancellation of allotment and forfeiture of deposited amount as per the Buyer-Builder Agreement.
  </p>
  <div class="sign-off">
    <p>Yours faithfully,<br/>For <strong>{{companyName}}</strong></p>
    <div class="sign-space"></div>
    <div class="sign-name">Authorised Signatory</div>
    <div class="sign-title">Accounts &amp; Finance Department</div>
  </div>
  <div class="rtgs-box">
    <div class="rtgs-title">Payment / RTGS Details</div>
    <div class="rtgs-grid">
      <span class="rtgs-lbl">Account Name</span><span class="rtgs-val">{{bankCompanyName}}</span>
      <span class="rtgs-lbl">Account Number</span><span class="rtgs-val">{{bankAccountNo}}</span>
      <span class="rtgs-lbl">IFSC Code</span><span class="rtgs-val">{{bankIfsc}}</span>
      <span class="rtgs-lbl">Bank Name</span><span class="rtgs-val">{{bankName}}</span>
      <span class="rtgs-lbl">Branch</span><span class="rtgs-val">{{bankBranch}}</span>
    </div>
  </div>
  <div class="notes-section">
    <div class="notes-title">Important Notes:</div>
    <ol>
      <li>{{demandNote1}}</li>
      <li>{{demandNote2}}</li>
      <li>{{demandNote3}}</li>
      <li>{{demandNote4}}</li>
    </ol>
  </div>
  <div class="doc-footer">
    This is a computer-generated document. No signature required. Generated on {{currentDate}}. | {{companyName}}
  </div>
</div>
</body>
</html>`;
}


// Get the Check List HTML shell (bypasses template DB lookup)
export function getCheckListShell(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Check List</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10.5pt; color: #000; background: #fff; }
  .page { max-width: 820px; margin: 0 auto; padding: 20px 28px; }
  .print-bar { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 14px; }
  @media print { .print-bar { display: none; } .page-break { page-break-before: always; } }
  .btn-print { background: #333; color: #fff; border: none; padding: 7px 18px; border-radius: 3px; cursor: pointer; font-size: 10pt; }
  .btn-close  { background: #ddd; color: #333; border: none; padding: 7px 14px; border-radius: 3px; cursor: pointer; font-size: 10pt; }
  .co-header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
  .co-name { font-size: 14pt; font-weight: 700; text-align: center; letter-spacing: 0.5px; }
  .co-cin  { font-size: 8.5pt; text-align: center; color: #333; margin-top: 1px; }
  .co-addr { font-size: 8.5pt; text-align: center; color: #333; margin-top: 3px; line-height: 1.5; }
  .doc-title { text-align: center; border: 2px solid #000; font-size: 12pt; font-weight: 700; letter-spacing: 3px; padding: 5px 0; margin: 8px 0; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #000; margin-bottom: 8px; }
  .info-col { padding: 7px 10px; }
  .info-col:first-child { border-right: 1px solid #000; }
  .info-row { display: flex; margin-bottom: 2px; font-size: 9pt; }
  .info-lbl { color: #444; width: 120px; flex-shrink: 0; }
  .info-val { font-weight: 600; }
  .section-title { font-weight: 700; font-size: 10.5pt; margin: 10px 0 4px; text-decoration: underline; }
  .chk-table, .fin-table, .svc-table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 8.5pt; }
  .chk-table th, .fin-table th, .svc-table th { background: #000; color: #fff; padding: 5px 3px; border: 1px solid #555; text-align: center; font-size: 8pt; font-weight: 700; }
  .chk-table td, .fin-table td, .svc-table td { border: 1px solid #999; padding: 4px 5px; }
  .fin-table tfoot td { font-weight: 700; background: #e8e8e8; border: 1px solid #666; }
  .dept-row td { background: #f0f0f0; font-weight: 700; }
  .tc { text-align: center; }
  .tr { text-align: right; }
  .bold { font-weight: 700; }
  .amt-words { border: 1px solid #999; padding: 7px 12px; margin: 8px 0; font-size: 10pt; }
  .op-para { font-size: 10pt; line-height: 1.7; margin: 10px 0; text-align: justify; }
  .blank-line { display: inline-block; min-width: 160px; border-bottom: 1px solid #000; }
  .sign-grid { display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 30px; border: 1px solid #000; border-bottom: none; }
  .sign-block { border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 10px 8px 26px; font-size: 9.5pt; font-weight: 600; text-align: center; }
  .sign-block:nth-child(4n) { border-right: none; }
  .sign-block.empty { border-right: none; }
</style>
</head>
<body>
<div class="page">
  <div class="print-bar">
    <button class="btn-close" onclick="window.close()">Close</button>
    <button class="btn-print" onclick="window.print()">&#128438; Print / Save PDF</button>
  </div>
  <div class="co-header">
    <div class="co-name">NANI RESORTS AND FLORICULTURE PVT. LTD.</div>
    <div class="co-addr">Building No. 80, 1st Floor, Sector-44, Gurugram, Haryana-122003</div>
  </div>
  <div class="doc-title">FINAL STATEMENT OF ACCOUNT CHECK LIST</div>
  <div class="info-grid">
    <div class="info-col">
      <div class="info-row"><span class="info-lbl">Customer Code</span><span class="info-val">{{customerId}}</span></div>
      <div class="info-row"><span class="info-lbl">First Applicant</span><span class="info-val">{{consumerName}}</span></div>
      <div class="info-row"><span class="info-lbl">Co Applicants</span><span class="info-val">{{coApplicants}}</span></div>
      <div class="info-row"><span class="info-lbl">Payment Mode</span><span class="info-val">{{paymentMode}}</span></div>
      <div class="info-row"><span class="info-lbl">Carpet Area (sq.ft.)</span><span class="info-val">{{carpetArea}}</span></div>
    </div>
    <div class="info-col">
      <div class="info-row"><span class="info-lbl">Print Date</span><span class="info-val">{{printDate}}</span></div>
      <div class="info-row"><span class="info-lbl">Booking Date</span><span class="info-val">{{bookingDate}}</span></div>
      <div class="info-row"><span class="info-lbl">Project</span><span class="info-val">{{projectName}}</span></div>
      <div class="info-row"><span class="info-lbl">Unit No</span><span class="info-val">{{unitNumber}}</span></div>
      <div class="info-row"><span class="info-lbl">Balcony Area (sq.ft.)</span><span class="info-val">{{balconyArea}}</span></div>
    </div>
  </div>

  <table class="chk-table">
    <thead>
      <tr><th style="width:28px">S.No.</th><th>Particular</th><th style="width:110px">Status</th></tr>
    </thead>
    <tbody>
      <tr><td class="tc">1</td><td>Applicant ledger</td><td class="tc">Yes ( ) / No ( )</td></tr>
      <tr><td class="tc">2</td><td>Interest ledger</td><td class="tc">Yes ( ) / No ( )</td></tr>
      <tr><td class="tc">3</td><td>IFUD confirmation</td><td class="tc">Yes ( ) / No ( )</td></tr>
      <tr><td class="tc">4</td><td>Operational charges received (if applicable)</td><td class="tc">Yes ( ) / No ( )</td></tr>
      <tr class="dept-row"><td colspan="3">Account dept.</td></tr>
      <tr><td class="tc">1</td><td>Tally Ledger By Account's</td><td class="tc">Yes ( ) / No ( )</td></tr>
      <tr class="dept-row"><td colspan="3">Loan Dept.</td></tr>
      <tr><td class="tc">1</td><td>Bank Loan</td><td class="tc">Yes ( ) / No ( )</td></tr>
      <tr><td class="tc">2</td><td>Bank Loan NOC (If applicable)</td><td class="tc">Yes ( ) / No ( )</td></tr>
      <tr><td class="tc">3</td><td>Bank Statement (With Customer Name)</td><td class="tc">Yes ( ) / No ( )</td></tr>
      <tr class="dept-row"><td colspan="3">CRM Dept.</td></tr>
      <tr><td class="tc">1</td><td>Demand Letter</td><td class="tc">Yes ( ) / No ( )</td></tr>
      <tr><td class="tc">2</td><td>Manual Ledger</td><td class="tc">Yes ( ) / No ( )</td></tr>
      <tr><td class="tc">3</td><td>Interest waiver checklist (if applicable)</td><td class="tc">Yes ( ) / No ( )</td></tr>
      <tr><td class="tc">4</td><td>Operational Charges Start Date Email Received</td><td class="tc">Yes ( ) / No ( )</td></tr>
      <tr><td class="tc">5</td><td>Client Undertaking</td><td class="tc">Yes ( ) / No ( )</td></tr>
    </tbody>
  </table>

  <table class="fin-table">
    <thead>
      <tr>
        <th>Particular</th>
        <th>Due (Rs.) With Tax</th>
        <th>Receive A (Rs.)</th>
        <th>Due Int. With Tax (Rs.)</th>
        <th>Receive Int. B (Rs.) With Tax</th>
        <th>Waiver Int. (Rs.)</th>
        <th>Balance Int. (Rs.)</th>
        <th>Balance</th>
      </tr>
    </thead>
    <tbody>
      {{financeRows}}
    </tbody>
  </table>
  <div class="amt-words">
    <strong>Total Amount Received (A+B):-</strong> Rs. {{totalAmountReceivedAB}}/-
  </div>

  <div class="page-break"></div>
  <div class="section-title">Services Dues Received</div>
  <table class="svc-table">
    <thead>
      <tr><th>Services</th><th>Dues</th><th>Received</th></tr>
    </thead>
    <tbody>
      <tr><td>IFUD Charge</td><td></td><td></td></tr>
      <tr><td>Operational Charges</td><td></td><td></td></tr>
    </tbody>
  </table>
  <p class="op-para">
    Operational Charges received from <span class="blank-line">&nbsp;</span> to <span class="blank-line">&nbsp;</span> @3.93 Per SQFT. + 18% GST
  </p>
  <p class="op-para">
    Operational Charges start from 1st February 2025.
  </p>

  <div class="sign-grid">
    <div class="sign-block">Prepared by (CRM)</div>
    <div class="sign-block">Verified by (ERP)</div>
    <div class="sign-block">Checked by (TL)</div>
    <div class="sign-block">DGM</div>
    <div class="sign-block">Legal</div>
    <div class="sign-block">Finance</div>
    <div class="sign-block">M.D.</div>
    <div class="sign-block empty"></div>
  </div>
</div>
</body>
</html>`;
}
