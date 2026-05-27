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
async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Applying migration 042: payment detail columns + booking_payment_taxes table...');
        await client.query('BEGIN');
        // ── Migration A: Add 12 columns to booking_records ───────────────────────
        await client.query(`
      ALTER TABLE booking_records
        ADD COLUMN IF NOT EXISTS bank_branch              VARCHAR(200),
        ADD COLUMN IF NOT EXISTS received_for             VARCHAR(255),
        ADD COLUMN IF NOT EXISTS account_holder           VARCHAR(255),
        ADD COLUMN IF NOT EXISTS on_account_of            VARCHAR(100)  DEFAULT 'Booking',
        ADD COLUMN IF NOT EXISTS invoice_date_by          VARCHAR(20)   DEFAULT 'receipt_date',
        ADD COLUMN IF NOT EXISTS interest_type            VARCHAR(20)   DEFAULT 'exclusive',
        ADD COLUMN IF NOT EXISTS extra_add_on_type        VARCHAR(20)   DEFAULT 'exclusive',
        ADD COLUMN IF NOT EXISTS tds_type                 VARCHAR(20)   DEFAULT 'not_calculate',
        ADD COLUMN IF NOT EXISTS self_or_loan             VARCHAR(10)   DEFAULT 'self',
        ADD COLUMN IF NOT EXISTS interest_amount          NUMERIC(12,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS dealer_adjustment_amount NUMERIC(12,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tds_challan_id           UUID REFERENCES tds_challans(id) ON DELETE SET NULL
    `);
        // ── Migration B: Create booking_payment_taxes table ───────────────────────
        await client.query(`
      CREATE TABLE IF NOT EXISTS booking_payment_taxes (
        id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_record_id UUID        NOT NULL REFERENCES booking_records(id) ON DELETE CASCADE,
        s_tax_pct         NUMERIC(5,2) DEFAULT 0,
        cgst_pct          NUMERIC(5,2) DEFAULT 0,
        sgst_pct          NUMERIC(5,2) DEFAULT 0,
        gst_interest_pct  NUMERIC(5,2) DEFAULT 0,
        cgst_amount       NUMERIC(12,2) DEFAULT 0,
        sgst_amount       NUMERIC(12,2) DEFAULT 0,
        tds_amount        NUMERIC(12,2) DEFAULT 0,
        created_at        TIMESTAMPTZ  DEFAULT now()
      )
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_booking_payment_taxes_booking
      ON booking_payment_taxes(booking_record_id)
    `);
        await client.query('COMMIT');
        console.log('Migration 042 complete.');
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration 042 failed:', err);
        process.exit(1);
    }
    finally {
        client.release();
        await pool.end();
    }
}
migrate();
//# sourceMappingURL=apply_042.js.map