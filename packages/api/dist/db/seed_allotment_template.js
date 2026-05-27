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
const allotmentLetterHtml = `
<div style="font-family: 'Times New Roman', Times, serif; line-height: 1.5; padding: 40px; color: #333;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="text-decoration: underline; text-transform: uppercase; margin: 0;">ALLOTMENT LETTER</h2>
    <div style="text-align: right; margin-top: -20px;">Date: {{letter_date}}</div>
  </div>

  <div style="margin-bottom: 20px;">
    <strong>Rera Regd. No.:</strong> {{rera_reg_no}}<br>
    <strong>Customer ID:</strong> {{registration_no}}<br>
    <strong>Mr. {{consumer_name}}</strong><br>
    {{consumer_address}}<br>
    <strong>(M):</strong> {{consumer_mobile}}<br>
    <strong>EMail:</strong> {{consumer_email}}
  </div>

  <div style="margin-bottom: 20px;">
    <strong>SUB: Allotment of Residential Unit in Project "{{project_name}}", {{project_location}}.</strong>
  </div>

  <p>Dear Sir/Madam,</p>

  <p>This has reference to your Application No. {{registration_no}} for allotment of a residential apartment in our project <strong>"{{project_name}}"</strong> located at {{project_location}}, in terms of the Affordable Group Housing Policy 2013 dated 19/08/2013 (as amended from time to time) issued by the Town and Country Planning Department, Government of Haryana <strong>("Policy")</strong>.</p>

  <p>We are pleased to inform you that you have been allotted Unit No. <strong>{{unit_number}}</strong> on <strong>{{floor_number}} Floor</strong> in <strong>Tower {{tower_name}}</strong> having Carpet area of <strong>{{carpet_area}} Sq. Ft.</strong> and Balcony area of <strong>{{balcony_area}} Sq. Ft.</strong> together with one (1) two wheeler parking site in the Project (the <strong>"Said Apartment"</strong>), on the terms and conditions prescribed in the Policy and the Apartment Buyer's Agreement. Kindly note that this allotment does not entitle you to any rights in the Said Apartment and/or the Project till execution of the Apartment Buyer's Agreement.</p>

  <p>Please quote your customer code number in all your future correspondence with us.</p>

  <p>Thank you for choosing us to serve you. Assuring you best of our services at all times!</p>

  <p>For <strong>{{company_name}}</strong></p>

  <div style="margin-top: 50px; display: flex; justify-content: space-between;">
    <div><strong>Manager (Accounts and Finance)</strong></div>
    <div><strong>Manager</strong></div>
  </div>
</div>
`;
async function seedTemplate() {
    const client = await pool.connect();
    try {
        console.log('Seeding Allotment Letter template...');
        // Get a project ID to link to (or handle generically)
        const projectRes = await client.query("SELECT id FROM projects LIMIT 1");
        if (projectRes.rows.length === 0) {
            console.error('No projects found. Seed projects first.');
            return;
        }
        const projectId = projectRes.rows[0].id;
        await client.query(`
      INSERT INTO document_templates (project_id, document_type, name, body_html, merge_fields)
      VALUES ($1, 'ALLOTMENT_LETTER', 'Official Allotment Letter', $2, $3)
      ON CONFLICT DO NOTHING
    `, [
            projectId,
            allotmentLetterHtml,
            ['letter_date', 'rera_reg_no', 'registration_no', 'consumer_name', 'consumer_address', 'consumer_mobile', 'consumer_email', 'project_name', 'project_location', 'unit_number', 'floor_number', 'tower_name', 'carpet_area', 'balcony_area', 'company_name']
        ]);
        console.log('Success: Template seeded.');
    }
    catch (err) {
        console.error('Seeding failed:', err);
    }
    finally {
        client.release();
        await pool.end();
    }
}
seedTemplate();
//# sourceMappingURL=seed_allotment_template.js.map