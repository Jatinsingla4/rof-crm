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
        console.log('Applying migration 034: replace discount columns with company discount fields...');
        await client.query('BEGIN');
        // Add 4 new company discount columns
        await client.query(`
      ALTER TABLE booking_records
        ADD COLUMN IF NOT EXISTS company_inaugural_disc NUMERIC(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS company_rebate_rs      NUMERIC(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS company_rebate_sqft    NUMERIC(10,4) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS company_rebate_pct     NUMERIC(5,2)  NOT NULL DEFAULT 0
    `);
        // Drop FK before dropping the column it references
        await client.query(`
      ALTER TABLE booking_records
        DROP CONSTRAINT IF EXISTS booking_records_discount_authorized_by_fkey
    `);
        // Drop the old discount columns
        await client.query(`
      ALTER TABLE booking_records
        DROP COLUMN IF EXISTS discount_value,
        DROP COLUMN IF EXISTS discount_reason,
        DROP COLUMN IF EXISTS discount_authorized_by
    `);
        await client.query('COMMIT');
        console.log('Migration 034 complete.');
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration 034 failed:', err);
        process.exit(1);
    }
    finally {
        client.release();
        await pool.end();
    }
}
migrate();
//# sourceMappingURL=apply_034.js.map