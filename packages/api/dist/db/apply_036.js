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
        console.log('Applying migration 036: add parity fields to co_applicants...');
        await client.query('BEGIN');
        await client.query(`
      ALTER TABLE co_applicants
        ADD COLUMN IF NOT EXISTS middle_name       VARCHAR(100),
        ADD COLUMN IF NOT EXISTS gender            VARCHAR(20),
        ADD COLUMN IF NOT EXISTS father_name       VARCHAR(200),
        ADD COLUMN IF NOT EXISTS anniversary_date  DATE,
        ADD COLUMN IF NOT EXISTS marital_status    VARCHAR(20) DEFAULT 'not_specified'
                                                   CHECK (marital_status IN ('married','unmarried','not_specified')),
        ADD COLUMN IF NOT EXISTS no_of_children    INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS passport_no       VARCHAR(50),
        ADD COLUMN IF NOT EXISTS email_2           VARCHAR(200),
        ADD COLUMN IF NOT EXISTS designation       VARCHAR(100),
        ADD COLUMN IF NOT EXISTS has_poa           BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS photo_url         TEXT,
        ADD COLUMN IF NOT EXISTS nationality       VARCHAR(50),
        ADD COLUMN IF NOT EXISTS profession        VARCHAR(100)
    `);
        await client.query('COMMIT');
        console.log('Migration 036 complete.');
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration 036 failed:', err);
        process.exit(1);
    }
    finally {
        client.release();
        await pool.end();
    }
}
migrate();
//# sourceMappingURL=apply_036.js.map