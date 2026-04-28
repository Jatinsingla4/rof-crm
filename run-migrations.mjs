import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const migrations = [
  'packages/api/src/db/schema.sql',
  'packages/api/src/db/migrations/001_add_support_tickets_table.sql',
  'packages/api/src/db/migrations/002_add_custom_reports_table.sql',
  'packages/api/src/db/migrations/003_add_documents_and_vault_tables.sql',
  'packages/api/src/db/migrations/004_add_campaigns_and_metrics_tables.sql',
  'packages/api/src/db/migrations/005_add_ppp_unique_index.sql',
  'packages/api/src/db/migrations/006_seed_document_templates.sql',
  'packages/api/src/db/migrations/007_add_faq_knowledge_base.sql',
  'packages/api/src/db/migrations/008_add_bank_reconciliation.sql',
  'packages/api/src/db/migrations/009_add_consumer_folders.sql',
  'packages/api/src/db/migrations/010_remove_legacy_tables.sql',
];

const dbConfig = {
  user: 'postgres',
  host: 'localhost',
  database: 'rof_crm',
  password: 'postgres',
  port: 5432,
};

console.log('Starting migrations...\n');

for (const migration of migrations) {
  const fullPath = path.resolve(migration);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ ${migration} - FILE NOT FOUND`);
    continue;
  }

  console.log(`Running: ${migration}`);
  try {
    const sql = fs.readFileSync(fullPath, 'utf-8');
    // Use psql to execute
    const connStr = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

    // Write SQL to temp file and execute
    const tempFile = `/tmp/migration-${Date.now()}.sql`;
    fs.writeFileSync(tempFile, sql);

    try {
      execSync(`psql ${connStr} -f ${tempFile}`, { stdio: 'pipe', encoding: 'utf-8' });
      console.log(`✅ ${migration} - SUCCESS\n`);
    } catch (e) {
      console.error(`❌ ${migration} - FAILED`);
      console.error(e.stdout ? e.stdout.toString().slice(0, 500) : e.message);
      console.error('');
    }
  } catch (e) {
    console.error(`❌ ${migration} - ERROR: ${e.message}\n`);
  }
}

console.log('Migrations complete.');
