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
        console.log('Applying migration 039: add plc_amount to receipts...');
        await client.query('BEGIN');
        await client.query(`
      ALTER TABLE receipts
        ADD COLUMN IF NOT EXISTS plc_amount NUMERIC(12,2) NOT NULL DEFAULT 0
    `);
        await client.query('COMMIT');
        console.log('Migration 039 complete.');
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration 039 failed:', err);
        process.exit(1);
    }
    finally {
        client.release();
        await pool.end();
    }
}
migrate();
//# sourceMappingURL=apply_039.js.map