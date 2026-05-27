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
        console.log('Applying migration 037: add applicant_number to co_applicants...');
        await client.query('BEGIN');
        await client.query(`
      ALTER TABLE co_applicants
        ADD COLUMN IF NOT EXISTS applicant_number INTEGER NOT NULL DEFAULT 1
    `);
        // Ensure all existing rows have applicant_number = 1
        await client.query(`
      UPDATE co_applicants SET applicant_number = 1 WHERE applicant_number IS NULL OR applicant_number = 0
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_co_applicants_consumer_order
        ON co_applicants(consumer_id, applicant_number)
    `);
        await client.query('COMMIT');
        console.log('Migration 037 complete.');
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration 037 failed:', err);
        process.exit(1);
    }
    finally {
        client.release();
        await pool.end();
    }
}
migrate();
//# sourceMappingURL=apply_037.js.map