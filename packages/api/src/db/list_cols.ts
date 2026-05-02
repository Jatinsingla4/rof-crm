import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: 'packages/api/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'rof_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function listCols() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'units'");
    console.log('Columns:', res.rows.map(r => r.column_name).join(', '));
  } finally {
    client.release();
    await pool.end();
  }
}

listCols();
