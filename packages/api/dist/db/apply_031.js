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
        console.log('Applying migration 031...');
        await client.query(`ALTER TABLE allocations ADD COLUMN IF NOT EXISTS remarks TEXT`);
        await client.query(`ALTER TABLE allocations ADD COLUMN IF NOT EXISTS allotment_date DATE`);
        await client.query(`ALTER TABLE allotment_letters ADD COLUMN IF NOT EXISTS remarks TEXT`);
        await client.query(`ALTER TABLE penal_interests ADD COLUMN IF NOT EXISTS interest_waived_inr BIGINT DEFAULT 0`);
        await client.query(`CREATE TABLE IF NOT EXISTS global_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
        await client.query(`INSERT INTO global_settings (key, value, description)
        VALUES ('penal_interest_rate_percent', '15.0', 'Annual interest rate for late payments (Legacy standard)')
        ON CONFLICT (key) DO UPDATE SET value = '15.0'`);
        console.log('Success: Schema updated to version 031.');
    }
    catch (err) {
        console.error('Migration failed:', err);
    }
    finally {
        client.release();
        await pool.end();
    }
}
migrate();
//# sourceMappingURL=apply_031.js.map