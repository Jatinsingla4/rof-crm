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
        console.log('Applying demand raise schema fixes...');
        // Add missing columns to demands
        await client.query(`ALTER TABLE demands ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(15,2) DEFAULT 0`);
        await client.query(`ALTER TABLE demands ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(15,2) DEFAULT 0`);
        await client.query(`ALTER TABLE demands ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'`);
        await client.query(`ALTER TABLE demands ADD COLUMN IF NOT EXISTS demand_type VARCHAR(100)`);
        await client.query(`ALTER TABLE demands ADD COLUMN IF NOT EXISTS raised_at TIMESTAMPTZ`);
        await client.query(`ALTER TABLE demands ADD COLUMN IF NOT EXISTS raised_by UUID REFERENCES users(id)`);
        // Add status to receipts
        await client.query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'`);
        console.log('Success: Schema updated.');
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
//# sourceMappingURL=fix_schema.js.map