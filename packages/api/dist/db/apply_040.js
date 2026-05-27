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
        console.log('Applying migration 040: create booking_documents table...');
        await client.query('BEGIN');
        await client.query(`
      CREATE TABLE IF NOT EXISTS booking_documents (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_record_id     UUID NOT NULL REFERENCES booking_records(id) ON DELETE CASCADE,
        consumer_id           UUID NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
        applicant_number      INT NOT NULL DEFAULT 0,
        document_type         VARCHAR(100) NOT NULL,
        document_name         VARCHAR(255),
        barcode_no            VARCHAR(100),
        physical_storage_no   VARCHAR(100),
        scan_reference_no     VARCHAR(100),
        file_url              TEXT,
        file_original_name    VARCHAR(255),
        file_mime_type        VARCHAR(100),
        file_size_bytes       BIGINT,
        remarks               TEXT,
        created_by            UUID REFERENCES users(id),
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at            TIMESTAMPTZ,
        deleted_by            UUID REFERENCES users(id)
      )
    `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_booking_docs_booking_record ON booking_documents(booking_record_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_booking_docs_consumer ON booking_documents(consumer_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_booking_docs_applicant ON booking_documents(applicant_number)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_booking_docs_deleted ON booking_documents(deleted_at) WHERE deleted_at IS NULL`);
        await client.query('COMMIT');
        console.log('Migration 040 complete.');
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration 040 failed:', err);
        process.exit(1);
    }
    finally {
        client.release();
        await pool.end();
    }
}
migrate();
//# sourceMappingURL=apply_040.js.map