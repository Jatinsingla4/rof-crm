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
async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Applying migration 043: UNIQUE constraints on payment_ref and transaction_ref...');
        await client.query('BEGIN');
        // ── Migration A: booking_records.payment_ref ──────────────────────────────
        // NULL values are always allowed — PostgreSQL UNIQUE constraints permit
        // multiple NULLs. Only non-null duplicate values are rejected.
        await client.query(`
      ALTER TABLE booking_records
        ADD CONSTRAINT uq_booking_records_payment_ref
        UNIQUE (payment_ref)
    `);
        // ── Migration B: receipts.transaction_ref ─────────────────────────────────
        await client.query(`
      ALTER TABLE receipts
        ADD CONSTRAINT uq_receipts_transaction_ref
        UNIQUE (transaction_ref)
    `);
        await client.query('COMMIT');
        console.log('Migration 043 complete.');
        // ── Verification ──────────────────────────────────────────────────────────
        const check = await pool.query(`
      SELECT tc.table_name, tc.constraint_name, tc.constraint_type
      FROM information_schema.table_constraints tc
      WHERE tc.constraint_name IN (
        'uq_booking_records_payment_ref',
        'uq_receipts_transaction_ref'
      )
      ORDER BY tc.table_name
    `);
        console.log('Constraints confirmed:');
        check.rows.forEach(r => console.log(`  ${r.table_name}.${r.constraint_name} [${r.constraint_type}]`));
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration 043 failed:', err);
        process.exit(1);
    }
    finally {
        client.release();
        await pool.end();
    }
}
migrate();
//# sourceMappingURL=apply_043.js.map