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
    console.log('Applying migration 033: floor NOT NULL constraint on units...');

    // Backfill any nulls before adding constraint (safe default for legacy data)
    await client.query(`UPDATE units SET floor = 1 WHERE floor IS NULL`);

    await client.query(`ALTER TABLE units ALTER COLUMN floor SET NOT NULL`);

    console.log('Migration 033 complete.');
  } catch (err) {
    console.error('Migration 033 failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
