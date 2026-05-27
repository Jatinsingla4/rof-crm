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
        console.log('Applying migration 038: add other costs columns to booking_records...');
        await client.query('BEGIN');
        await client.query(`
      ALTER TABLE booking_records
        ADD COLUMN IF NOT EXISTS has_plc             BOOLEAN      NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS plc_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS has_other_charge    BOOLEAN      NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS other_charge_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS other_charge_desc   TEXT
    `);
        await client.query('COMMIT');
        console.log('Migration 038 complete.');
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration 038 failed:', err);
        process.exit(1);
    }
    finally {
        client.release();
        await pool.end();
    }
}
migrate();
//# sourceMappingURL=apply_038.js.map