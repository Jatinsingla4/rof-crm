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
async function findCol() {
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT table_name FROM information_schema.columns WHERE column_name = 'registration_no'");
        console.log('Tables with registration_no:', res.rows.map(r => r.table_name).join(', '));
        const res2 = await client.query("SELECT table_name FROM information_schema.columns WHERE column_name ILIKE '%reg%'");
        console.log('Tables with column like reg:', res2.rows.map(r => `${r.table_name}`).join(', '));
    }
    finally {
        client.release();
        await pool.end();
    }
}
findCol();
//# sourceMappingURL=find_col.js.map