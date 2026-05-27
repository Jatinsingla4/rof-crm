"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: '.env' });
const pool = new pg_1.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'rof_crm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});
async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Applying migration 035: add legacy applicant fields to consumers...');
        await client.query('BEGIN');
        await client.query(`
      ALTER TABLE consumers
        ADD COLUMN IF NOT EXISTS father_name       VARCHAR(200),
        ADD COLUMN IF NOT EXISTS anniversary_date  DATE,
        ADD COLUMN IF NOT EXISTS marital_status    VARCHAR(20) DEFAULT 'not_specified'
                                                   CHECK (marital_status IN ('married','unmarried','not_specified')),
        ADD COLUMN IF NOT EXISTS no_of_children    INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS passport_no       VARCHAR(50),
        ADD COLUMN IF NOT EXISTS email_2           VARCHAR(200),
        ADD COLUMN IF NOT EXISTS designation       VARCHAR(100),
        ADD COLUMN IF NOT EXISTS has_poa           BOOLEAN DEFAULT false
    `);
        await client.query('COMMIT');
        console.log('Migration 035 complete.');
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration 035 failed:', err);
        process.exit(1);
    }
    finally {
        client.release();
        await pool.end();
    }
}
migrate();
//# sourceMappingURL=apply_035.js.map