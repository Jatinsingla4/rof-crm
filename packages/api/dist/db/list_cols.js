"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: 'packages/api/.env' });
const pool = new pg_1.Pool({
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
    }
    finally {
        client.release();
        await pool.end();
    }
}
listCols();
//# sourceMappingURL=list_cols.js.map