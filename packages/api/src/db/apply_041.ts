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
    console.log('Applying migration 041: add phone/fax fields to consumers, full address + type to co_applicants...');
    await client.query('BEGIN');

    // ── Migration A: consumers table ─────────────────────────────────────────
    await client.query(`
      ALTER TABLE consumers
        ADD COLUMN IF NOT EXISTS phone_no           VARCHAR(30),
        ADD COLUMN IF NOT EXISTS fax_no             VARCHAR(30),
        ADD COLUMN IF NOT EXISTS present_phone_no   VARCHAR(30),
        ADD COLUMN IF NOT EXISTS present_fax_no     VARCHAR(30),
        ADD COLUMN IF NOT EXISTS present_mobile_no  VARCHAR(20),
        ADD COLUMN IF NOT EXISTS office_country     VARCHAR(100) DEFAULT 'India',
        ADD COLUMN IF NOT EXISTS office_phone_no    VARCHAR(30),
        ADD COLUMN IF NOT EXISTS office_fax_no      VARCHAR(30),
        ADD COLUMN IF NOT EXISTS office_mobile_no   VARCHAR(20),
        ADD COLUMN IF NOT EXISTS perm_phone_no      VARCHAR(30),
        ADD COLUMN IF NOT EXISTS perm_fax_no        VARCHAR(30),
        ADD COLUMN IF NOT EXISTS perm_mobile_no     VARCHAR(20),
        ADD COLUMN IF NOT EXISTS comm_phone_no      VARCHAR(30),
        ADD COLUMN IF NOT EXISTS comm_fax_no        VARCHAR(30),
        ADD COLUMN IF NOT EXISTS comm_mobile_no     VARCHAR(20)
    `);

    // ── Migration B: co_applicants table ─────────────────────────────────────
    await client.query(`
      ALTER TABLE co_applicants
        ADD COLUMN IF NOT EXISTS applicant_type       VARCHAR(20) DEFAULT 'co_applicant',
        ADD COLUMN IF NOT EXISTS present_address      TEXT,
        ADD COLUMN IF NOT EXISTS present_city         VARCHAR(100),
        ADD COLUMN IF NOT EXISTS present_state        VARCHAR(100),
        ADD COLUMN IF NOT EXISTS present_pin          VARCHAR(10),
        ADD COLUMN IF NOT EXISTS present_country      VARCHAR(100) DEFAULT 'India',
        ADD COLUMN IF NOT EXISTS present_phone_no     VARCHAR(30),
        ADD COLUMN IF NOT EXISTS present_fax_no       VARCHAR(30),
        ADD COLUMN IF NOT EXISTS present_mobile_no    VARCHAR(20),
        ADD COLUMN IF NOT EXISTS office_address       TEXT,
        ADD COLUMN IF NOT EXISTS office_city          VARCHAR(100),
        ADD COLUMN IF NOT EXISTS office_state         VARCHAR(100),
        ADD COLUMN IF NOT EXISTS office_pin           VARCHAR(10),
        ADD COLUMN IF NOT EXISTS office_country       VARCHAR(100) DEFAULT 'India',
        ADD COLUMN IF NOT EXISTS office_phone_no      VARCHAR(30),
        ADD COLUMN IF NOT EXISTS office_fax_no        VARCHAR(30),
        ADD COLUMN IF NOT EXISTS office_mobile_no     VARCHAR(20),
        ADD COLUMN IF NOT EXISTS perm_address         TEXT,
        ADD COLUMN IF NOT EXISTS perm_city            VARCHAR(100),
        ADD COLUMN IF NOT EXISTS perm_state           VARCHAR(100),
        ADD COLUMN IF NOT EXISTS perm_pin             VARCHAR(10),
        ADD COLUMN IF NOT EXISTS perm_country         VARCHAR(100) DEFAULT 'India',
        ADD COLUMN IF NOT EXISTS perm_phone_no        VARCHAR(30),
        ADD COLUMN IF NOT EXISTS perm_fax_no          VARCHAR(30),
        ADD COLUMN IF NOT EXISTS perm_mobile_no       VARCHAR(20),
        ADD COLUMN IF NOT EXISTS mailing_address_type VARCHAR(20) DEFAULT 'present',
        ADD COLUMN IF NOT EXISTS communication_mode   VARCHAR(20) DEFAULT 'email',
        ADD COLUMN IF NOT EXISTS poa_details          TEXT
    `);

    // CHECK constraint on applicant_type (add only if not already present)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.check_constraints
          WHERE constraint_name = 'co_applicants_applicant_type_check'
        ) THEN
          ALTER TABLE co_applicants
            ADD CONSTRAINT co_applicants_applicant_type_check
            CHECK (applicant_type IN ('co_applicant','nominee'));
        END IF;
      END$$
    `);

    await client.query('COMMIT');
    console.log('Migration 041 complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 041 failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
