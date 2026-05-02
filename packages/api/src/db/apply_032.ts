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
    console.log('Applying migration 032 (Advanced Modules)...');
    
    // Registry
    await client.query(`CREATE TABLE IF NOT EXISTS registry_details (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        allocation_id UUID NOT NULL,
        unit_id UUID NOT NULL,
        consumer_id UUID NOT NULL,
        appointment_date DATE,
        registry_date DATE,
        stamp_duty_amount BIGINT DEFAULT 0,
        conveyance_deed_no VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        remarks TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // Loans
    await client.query(`CREATE TABLE IF NOT EXISTS loan_details (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        consumer_id UUID NOT NULL,
        bank_name VARCHAR(255),
        branch_name VARCHAR(255),
        loan_amount BIGINT DEFAULT 0,
        sanction_letter_date DATE,
        tpa_signed_date DATE,
        loan_status VARCHAR(50) DEFAULT 'applied',
        disbursement_percentage INT DEFAULT 0,
        bank_contact_person VARCHAR(100),
        bank_contact_mobile VARCHAR(20),
        remarks TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // Transfers
    await client.query(`CREATE TABLE IF NOT EXISTS ownership_transfers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_id UUID NOT NULL,
        old_consumer_id UUID NOT NULL,
        new_consumer_id UUID NOT NULL,
        transfer_date DATE DEFAULT CURRENT_DATE,
        transfer_fee_inr BIGINT DEFAULT 0,
        admin_charges_inr BIGINT DEFAULT 0,
        approval_status VARCHAR(50) DEFAULT 'pending',
        transfer_remarks TEXT,
        created_by_user_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // Bank Accounts
    await client.query(`CREATE TABLE IF NOT EXISTS bank_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID,
        bank_name VARCHAR(255) NOT NULL,
        account_number VARCHAR(50) NOT NULL,
        ifsc_code VARCHAR(20) NOT NULL,
        account_type VARCHAR(50),
        balance_inr BIGINT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // Cheque Bounce
    await client.query(`CREATE TABLE IF NOT EXISTS cheque_bounce_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        receipt_id UUID NOT NULL,
        consumer_id UUID NOT NULL,
        bounce_date DATE DEFAULT CURRENT_DATE,
        penalty_amount_inr BIGINT DEFAULT 500,
        reason TEXT,
        is_penalty_raised BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    console.log('Success: Advanced modules schema ready.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
