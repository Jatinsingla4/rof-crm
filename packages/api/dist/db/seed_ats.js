import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'rof_crm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});
async function seedATS() {
    const client = await pool.connect();
    try {
        const atsHtml = `
      <div style="font-family: Arial, sans-serif; padding: 40px; line-height: 1.6;">
        <h1 style="text-align: center; text-decoration: underline;">AGREEMENT TO SALE (ATS)</h1>
        <p style="text-align: right;">Date: {{currentDate}}</p>
        
        <p>This AGREEMENT TO SALE is made at Gurugram on this {{day}} day of {{month}}, {{year}}.</p>
        
        <h3>BETWEEN</h3>
        <p><b>ROF INFRATECH & HOUSING PVT. LTD.</b>, a company incorporated under the Companies Act, 1956, having its registered office at Plot No. 80, 1st Floor, Sector-44, Gurugram, Haryana-122003 (hereinafter referred to as the "Developer").</p>
        
        <h3>AND</h3>
        <p><b>{{consumerName}}</b>, S/o D/o W/o {{fatherName}}, R/o {{address}} (hereinafter referred to as the "Allottee").</p>
        
        <p>WHEREAS the Developer is developing a residential group housing colony under the name and style of <b>"{{projectName}}"</b> at Sector-{{projectSector}}, Gurugram.</p>
        
        <p>AND WHEREAS the Allottee has applied for allotment of a residential apartment in the said colony and has been allotted Apartment No. <b>{{unitNumber}}</b>, Category {{unitCategory}}, having a carpet area of {{carpetArea}} sq. ft.</p>
        
        <h3>TERMS & CONDITIONS:</h3>
        <ol>
          <li>The total price of the said Apartment is Rs. {{totalPrice}}/-.</li>
          <li>The Allottee has paid a sum of Rs. {{paidAmount}}/- as part payment towards the booking.</li>
          <li>The balance amount shall be paid as per the Payment Schedule annexed hereto.</li>
          <li>The possession of the Apartment is proposed to be offered within 4 years from the date of approval of building plans.</li>
        </ol>
        
        <br><br><br>
        <div style="display: flex; justify-content: space-between;">
          <div>___________________<br>Developer Signature</div>
          <div>___________________<br>Allottee Signature</div>
        </div>
      </div>
    `;
        const projectRes = await client.query("SELECT id FROM projects LIMIT 1");
        const projectId = projectRes.rows[0]?.id;
        await client.query(`INSERT INTO document_templates (project_id, document_type, name, body_html, merge_fields)
       VALUES ($1, 'buyer_builder_agreement', 'Standard Agreement to Sale (ATS)', $2, $3)`, [projectId, atsHtml, ['consumerName', 'fatherName', 'address', 'projectName', 'unitNumber', 'totalPrice', 'paidAmount']]);
        console.log('Success: ATS Template seeded.');
    }
    catch (err) {
        console.error('Seeding failed:', err);
    }
    finally {
        client.release();
        await pool.end();
    }
}
seedATS();
//# sourceMappingURL=seed_ats.js.map