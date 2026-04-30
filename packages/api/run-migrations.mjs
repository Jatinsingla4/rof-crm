import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const migrations = [
  'src/db/schema.sql',
  'src/db/migrations/001_add_support_tickets_table.sql',
  'src/db/migrations/002_add_custom_reports_table.sql',
  'src/db/migrations/003_add_documents_and_vault_tables.sql',
  'src/db/migrations/004_add_campaigns_and_metrics_tables.sql',
  'src/db/migrations/005_add_ppp_unique_index.sql',
  'src/db/migrations/006_seed_document_templates.sql',
  'src/db/migrations/007_add_faq_knowledge_base.sql',
  'src/db/migrations/008_add_bank_reconciliation.sql',
  'src/db/migrations/009_add_consumer_folders.sql',
  'src/db/migrations/010_remove_legacy_tables.sql',
  'src/db/migrations/011_add_draw_refunds.sql',
  'src/db/migrations/012_add_milestones.sql',
  'src/db/migrations/013_add_communications_table.sql',
  'src/db/migrations/014_add_broadcast_campaigns_table.sql',
  'src/db/migrations/015_add_users_auth_columns.sql',
  'src/db/migrations/016_rehash_user_passwords_bcrypt.sql',
  'src/db/migrations/017_add_missing_phase2_tables.sql',
  'src/db/migrations/018_reference_crm_full_schema.sql',
  'src/db/migrations/019_master_data_geo_banks.sql',
  'src/db/migrations/020_booking_form_consumer_fields.sql',
  'src/db/migrations/021_add_unit_shifts_table.sql',
  'src/db/migrations/022_add_unit_locations_reminder_master.sql',
  'src/db/migrations/023_add_plan_schedule_templates.sql',
];

const dbConfig = {
  user: 'postgres',
  host: 'localhost',
  database: 'rof_crm',
  password: 'postgres',
  port: 5432,
};

const db = new Pool(dbConfig);

console.log('Starting migrations using Node.js pg client...\n');

async function runMigrations() {
  for (const migration of migrations) {
    const fullPath = path.resolve(__dirname, migration);

    if (!fs.existsSync(fullPath)) {
      console.error(`❌ ${migration} - FILE NOT FOUND`);
      continue;
    }

    console.log(`Running: ${migration}`);
    try {
      const sql = fs.readFileSync(fullPath, 'utf-8');

      // Execute the SQL directly through the pool
      const result = await db.query(sql);
      console.log(`✅ ${migration} - SUCCESS\n`);
    } catch (e) {
      console.error(`❌ ${migration} - FAILED`);
      console.error('Error:', e.message);
      console.error('');
    }
  }

  console.log('Migrations complete.');
  await db.end();
}

runMigrations().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
