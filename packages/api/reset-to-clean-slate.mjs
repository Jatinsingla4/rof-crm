/**
 * ROF CRM — Clean Slate Reset Script
 *
 * WHAT THIS DOES:
 *   Wipes ALL seed / demo / test data from every table.
 *   The schema (tables, indexes, types, enums, constraints) is untouched.
 *   Master / reference data is preserved (countries, states, cities, banks,
 *   salutations, professions, nationalities, sources_of_enquiry, document_types,
 *   document_templates, faq_categories, faq_articles, reminder_master, roles).
 *   The admin user (super_admin) is preserved; all other users are removed.
 *
 * WHAT IS PRESERVED:
 *   ✅ All table structures, indexes, enums, constraints
 *   ✅ countries, states, cities, banks
 *   ✅ salutations, professions, nationalities, sources_of_enquiry
 *   ✅ document_types, document_templates (system letter templates)
 *   ✅ faq_categories, faq_articles
 *   ✅ reminder_master (default reminder rules)
 *   ✅ roles
 *   ✅ Admin user: testuser@rof.com (super_admin)
 *
 * WHAT IS WIPED:
 *   ❌ All projects, towers, units, unit_locations, unit_status_history, unit_shifts
 *   ❌ All consumers, co_applicants, kyc_documents, remarks, application_history
 *   ❌ All allocations, allotment_letters, waitlists, cancellations, draw_refunds
 *   ❌ All payment_plans, demands, receipts, penal_interests
 *   ❌ All communications, whatsapps, emails, support_tickets
 *   ❌ All documents, document_vault, document_dispatch, consumer_folders
 *   ❌ All campaigns, broadcast_campaigns, campaign_metrics
 *   ❌ All brokers, broker_commissions, broker_applications
 *   ❌ All bookings, booking_forms, booking_records, applicant_details, applicant_addresses
 *   ❌ All parking_slots, parking_types
 *   ❌ All tasks, automation_rules
 *   ❌ All reports, construction_milestones, gst_invoices, gst_process_rights
 *   ❌ All bank_statement_imports, bank_transactions
 *   ❌ All conveyance_deeds, surrender_applications
 *   ❌ All import_history, audit_logs, custom_reports
 *   ❌ All plan_schedule_templates
 *   ❌ Non-admin users
 *
 * USAGE:
 *   node reset-to-clean-slate.mjs
 *   node reset-to-clean-slate.mjs --confirm     (skip the 10-second prompt)
 */

import { Pool } from 'pg';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const db = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'rof_crm',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// ─── Tables to wipe, in dependency order (children before parents) ────────────
// Using TRUNCATE ... RESTART IDENTITY CASCADE handles FK chains automatically,
// but we still list in order for clarity and explicit control.
const WIPE_TABLES = [
  // ── Deepest leaves first ──────────────────────────────────────────────────
  'bank_transactions',          // refs bank_statement_imports, demands, receipts, users
  'bank_statement_imports',     // refs projects, users
  'campaign_metrics',           // refs campaigns
  'allotment_letters',          // refs allocations
  'cancellations',              // refs allocations, consumers
  'surrender_applications',     // refs allocations, consumers, projects, units
  'draw_refunds',               // refs consumers, projects
  'unit_status_history',        // refs units
  'unit_shifts',                // refs units, consumers, users
  'penal_interests',            // refs payment_plans, consumers
  'gst_invoices',               // refs payment_plans, consumers, projects, units
  'gst_process_rights',         // refs users
  'conveyance_deeds',           // refs consumers, projects, units
  'broker_commissions',         // refs brokers, consumers, projects, units
  'head_wise_costs',            // refs booking_forms
  'applicant_addresses',        // refs applicant_details
  'applicant_details',          // refs booking_forms
  'booking_forms',              // refs consumers, projects, units, payment_plans, broker_applications
  'booking_records',            // refs consumers, projects, units, users
  'broker_applications',        // refs brokers
  // ── Communications & support ──────────────────────────────────────────────
  'whatsapps',                  // refs consumers
  'emails',                     // refs consumers
  'communications',             // refs consumers, users
  'support_tickets',            // refs consumers, users
  // ── Documents & files ─────────────────────────────────────────────────────
  'document_vault',             // refs allocations, consumers, consumer_folders, users
  'documents',                  // refs allocations, consumers, document_templates, users
  'document_dispatch',          // refs consumers, users
  'consumer_folders',           // refs consumers, users (self-ref parent_folder_id)
  // ── Finance ───────────────────────────────────────────────────────────────
  'receipts',                   // refs payment_plans, consumers
  'demands',                    // refs payment_plans, consumers
  'payment_plans',              // refs allocations, consumers, units, projects
  // ── Allocations & waitlists ───────────────────────────────────────────────
  'waitlists',                  // refs consumers, projects
  'allocations',                // refs consumers, units, projects
  // ── Consumer related ──────────────────────────────────────────────────────
  'co_applicants',              // refs consumers
  'kyc_documents',              // refs consumers
  'remarks',                    // refs consumers
  'application_history',        // refs consumers
  'tasks',                      // refs consumers, users
  // ── Units & project structure ─────────────────────────────────────────────
  'parking_slots',              // refs projects, consumers, units
  'parking_types',              // standalone
  'plan_schedule_templates',    // refs projects, users
  'unit_locations',             // refs projects
  'units',                      // refs towers
  'towers',                     // refs projects
  // ── Project campaigns & marketing ─────────────────────────────────────────
  'broadcast_campaigns',        // refs projects, users
  'campaigns',                  // refs projects, users
  // ── Brokers ───────────────────────────────────────────────────────────────
  'brokers',                    // refs users
  // ── Project reporting & construction ──────────────────────────────────────
  'construction_milestones',    // refs projects, users
  'custom_reports',             // refs projects, users
  // ── Consumers (finally) ───────────────────────────────────────────────────
  'consumers',                  // refs projects, units, campaigns
  // ── Projects ──────────────────────────────────────────────────────────────
  'projects',
  // ── System / operations ───────────────────────────────────────────────────
  'automation_rules',           // refs users
  'import_history',             // refs users
  'audit_logs',                 // standalone
];

// Tables we deliberately KEEP (reference / master data + admin user)
const KEEP_TABLES = [
  'users',                // kept — but non-admin rows deleted separately
  'countries',
  'states',
  'cities',
  'banks',
  'salutations',
  'professions',
  'nationalities',
  'sources_of_enquiry',
  'document_types',
  'document_templates',
  'faq_categories',
  'faq_articles',
  'reminder_master',
  'roles',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
  return String(n).padStart(5);
}

async function countRows(client, table) {
  try {
    const r = await client.query(`SELECT COUNT(*) FROM ${table}`);
    return parseInt(r.rows[0].count);
  } catch { return -1; }
}

async function confirm() {
  if (process.argv.includes('--confirm')) return true;

  console.log('\n⚠️  WARNING: This will PERMANENTLY DELETE all ROF CRM seed/demo data.');
  console.log('   Schema, master data, and the admin user will be kept.');
  console.log('   Type YES (all caps) within 30 seconds to proceed:\n');

  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const timer = setTimeout(() => {
      rl.close();
      console.log('\nTimed out. Aborting.');
      resolve(false);
    }, 30000);

    rl.question('> ', (answer) => {
      clearTimeout(timer);
      rl.close();
      resolve(answer.trim() === 'YES');
    });
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  ROF CRM — Clean Slate Reset');
  console.log('══════════════════════════════════════════════════════════\n');

  // Show what will be deleted
  const client = await db.connect();
  try {
    console.log('Current record counts (before reset):\n');
    for (const t of WIPE_TABLES) {
      const n = await countRows(client, t);
      if (n > 0) console.log(`  ${fmt(n)}  ${t}`);
    }

    // Non-admin users
    const userRes = await client.query(`SELECT COUNT(*) FROM users WHERE role != 'super_admin'`);
    const nonAdminCount = parseInt(userRes.rows[0].count);
    if (nonAdminCount > 0) console.log(`  ${fmt(nonAdminCount)}  users (non-admin)`);

    console.log('\nThe following will be KEPT:');
    for (const t of KEEP_TABLES) {
      const n = await countRows(client, t);
      console.log(`  ${fmt(n)}  ${t}`);
    }

    // Admin user info
    const adminRes = await client.query(`SELECT email, role FROM users WHERE role = 'super_admin' LIMIT 1`);
    if (adminRes.rows[0]) {
      console.log(`\n  Admin user kept: ${adminRes.rows[0].email} (${adminRes.rows[0].role})`);
    }

    const ok = await confirm();
    if (!ok) {
      console.log('\nAborted. No data was changed.\n');
      return;
    }

    console.log('\n── Wiping data ──────────────────────────────────────────\n');

    await client.query('BEGIN');

    // Disable FK checks so we can delete in any order without violating constraints.
    // We use DELETE (not TRUNCATE CASCADE) so we never accidentally cascade
    // into reference/master tables that are not in our wipe list.
    await client.query('SET session_replication_role = replica');

    let totalDeleted = 0;
    for (const table of WIPE_TABLES) {
      try {
        const before = await countRows(client, table);
        if (before > 0) {
          await client.query(`DELETE FROM ${table}`);
          console.log(`  ✅ Wiped ${fmt(before)} rows from ${table}`);
          totalDeleted += before;
        } else {
          console.log(`  ·  (empty)           ${table}`);
        }
      } catch (err) {
        console.error(`  ❌ Failed: ${table} — ${err.message}`);
        await client.query('ROLLBACK');
        await client.query('SET session_replication_role = DEFAULT');
        throw err;
      }
    }

    // Delete non-admin users separately (keep super_admin)
    const delUsers = await client.query(`DELETE FROM users WHERE role != 'super_admin'`);
    if (delUsers.rowCount > 0) {
      console.log(`  ✅ Removed ${fmt(delUsers.rowCount)} non-admin users`);
      totalDeleted += delUsers.rowCount;
    }

    // Re-enable FK checks
    await client.query('SET session_replication_role = DEFAULT');

    await client.query('COMMIT');

    console.log('\n── Verification ─────────────────────────────────────────\n');

    let allClear = true;
    for (const table of WIPE_TABLES) {
      const n = await countRows(client, table);
      if (n > 0) {
        console.log(`  ⚠️  ${table} still has ${n} rows`);
        allClear = false;
      }
    }

    // Verify kept tables still have data
    console.log('\nPreserved reference data:\n');
    for (const t of KEEP_TABLES) {
      const n = await countRows(client, t);
      const icon = n > 0 ? '✅' : '⚠️ ';
      console.log(`  ${icon}  ${fmt(n)}  ${t}`);
    }

    const adminCheck = await client.query(`SELECT email, name, role FROM users WHERE role = 'super_admin'`);
    if (adminCheck.rows[0]) {
      console.log(`\n  ✅ Admin user intact: ${adminCheck.rows[0].name} <${adminCheck.rows[0].email}>`);
    } else {
      console.log('\n  ⚠️  Admin user not found — you may need to recreate it');
    }

    console.log('\n══════════════════════════════════════════════════════════');
    if (allClear) {
      console.log(`  ✅ Reset complete. ${totalDeleted.toLocaleString()} rows deleted.`);
      console.log('  Database is now clean and ready for real ROF data.');
    } else {
      console.log('  ⚠️  Reset completed with warnings. Check above.');
    }
    console.log('══════════════════════════════════════════════════════════\n');

  } finally {
    client.release();
    await db.end();
  }
}

run().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
