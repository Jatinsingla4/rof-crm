"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: '.env' });
const pool = new pg_1.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'rof_crm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});
async function seedDemandLetter() {
    const client = await pool.connect();
    try {
        const demandHtml = `
      <div style="font-family: 'Inter', sans-serif; padding: 20px; color: #1a1a1c; line-height: 1.4;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
          <img src="https://rof.co.in/assets/images/logo.png" style="height: 60px;">
          <div style="text-align: center;">
            <h1 style="margin: 0; font-size: 24px; letter-spacing: 1px;">NANI RESORTS & FLORICULTURE PVT. LTD.</h1>
            <div style="font-size: 11px;">CIN : U55101DL1999PTC098037</div>
            <div style="font-size: 10px; margin-top: 4px;">Corporate Office : Building No. 80, 1st Floor, Sector - 44, Gurugram - 122003</div>
          </div>
        </div>

        <div style="text-align: center; text-decoration: underline; font-weight: 700; margin-bottom: 20px;">DEMAND LETTER</div>

        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 20px;">
          <div>
            <b>{{consumerName}}</b><br>
            {{address}}<br>
            (M): {{mobile}}<br>
            Email: {{email}}
          </div>
          <div style="display: grid; grid-template-columns: 120px 1fr; gap: 4px;">
            <span>Customer ID</span><span>: {{customerId}}</span>
            <span>GSTIN</span><span>: 06AABCN4603L1ZK</span>
            <span>Rera Regd. No.</span><span>: {{reraNo}}</span>
            <span>Invoice Date</span><span>: {{currentDate}}</span>
            <span>Project Name</span><span>: {{projectName}}</span>
            <span>Unit No.</span><span>: {{unitNumber}}</span>
            <span>Area</span><span>: {{carpetArea}} Sq. Ft.</span>
          </div>
        </div>

        <div style="font-size: 11px; margin-bottom: 15px;">
          <b>Subject:- Demand of installment in respect of your allotment of Unit No. {{unitNumber}} in our project "{{projectName}}".</b>
        </div>

        <p style="font-size: 11px;">Dear Sir/Madam,</p>
        <p style="font-size: 11px;">This is with reference to the above said allotment in our project "{{projectName}}" wherein you have been allotted Unit No. {{unitNumber}} admeasuring area {{carpetArea}} Sq. Ft. and in view of the same your next installment has become due, as per the payment plan agreed and accepted by you.</p>

        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f4f4f4;">
              <th style="border: 1px solid #000; padding: 6px;">S.No.</th>
              <th style="border: 1px solid #000; padding: 6px;">Particulars</th>
              <th style="border: 1px solid #000; padding: 6px;">Due Date</th>
              <th style="border: 1px solid #000; padding: 6px;">Installment</th>
              <th style="border: 1px solid #000; padding: 6px;">CGST</th>
              <th style="border: 1px solid #000; padding: 6px;">SGST</th>
              <th style="border: 1px solid #000; padding: 6px;">Total GST</th>
              <th style="border: 1px solid #000; padding: 6px;">Amount Due</th>
              <th style="border: 1px solid #000; padding: 6px;">Amount Paid</th>
              <th style="border: 1px solid #000; padding: 6px;">Amount Payable</th>
            </tr>
          </thead>
          <tbody>
            {{demandRows}}
          </tbody>
          <tfoot>
            <tr style="font-weight: 700;">
              <td colspan="7" style="border: 1px solid #000; padding: 6px; text-align: right;">Total Amount</td>
              <td style="border: 1px solid #000; padding: 6px;">{{totalDue}}</td>
              <td style="border: 1px solid #000; padding: 6px;">{{totalPaid}}</td>
              <td style="border: 1px solid #000; padding: 6px;">{{totalPayable}}</td>
            </tr>
          </tfoot>
        </table>

        <div style="font-size: 11px; margin-bottom: 20px;">
          <b>Total Outstanding Amount (In Words):</b> {{totalPayableWords}}
        </div>

        <div style="background: #f9f9f9; padding: 15px; border: 1px solid #ddd; font-size: 10px;">
          <b>RTGS Details:</b><br>
          Company Name: NANI RESORTS AND FLORICULTURE PVT. LTD.<br>
          A/c No: 185205000400<br>
          IFSC Code: ICIC0001852<br>
          Bank Name: ICICI Bank<br>
          Place: Gurugram
        </div>

        <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px;">
          <div>
            Authorized Signatory
          </div>
          <div style="text-align: center;">
            <div style="border-top: 1px solid #000; width: 150px; margin-bottom: 4px;"></div>
            Customer Signature
          </div>
        </div>
      </div>
    `;
        const projectRes = await client.query("SELECT id FROM projects LIMIT 1");
        const projectId = projectRes.rows[0]?.id;
        await client.query(`INSERT INTO document_templates (project_id, document_type, name, body_html, merge_fields)
       VALUES ($1, 'demand_letter', 'Standard Demand Letter (Legacy Format)', $2, $3)`, [projectId, demandHtml, ['consumerName', 'address', 'mobile', 'email', 'customerId', 'reraNo', 'projectName', 'unitNumber', 'carpetArea', 'demandRows', 'totalDue', 'totalPaid', 'totalPayable', 'totalPayableWords']]);
        console.log('Success: Demand Letter Template seeded.');
    }
    catch (err) {
        console.error('Seeding failed:', err);
    }
    finally {
        client.release();
        await pool.end();
    }
}
seedDemandLetter();
//# sourceMappingURL=seed_demand_letter.js.map