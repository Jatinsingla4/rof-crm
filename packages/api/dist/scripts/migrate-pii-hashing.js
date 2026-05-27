"use strict";
/**
 * Data Migration: Re-hash PII from Base64 to HMAC-SHA256
 *
 * Context:
 * - Phase 2 Fix 5 changed hashing from Base64 to HMAC-SHA256
 * - Any records created BEFORE the fix have Base64-encoded aadhaar_hash and pan_hash
 * - This script identifies and re-hashes those records securely
 * - Script is idempotent: safe to run multiple times
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pool = new pg_1.Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});
const HASH_SECRET = process.env.HASH_SECRET;
if (!HASH_SECRET) {
    throw new Error('HASH_SECRET not set in environment');
}
const hashPII = (value) => {
    return crypto_1.default
        .createHmac('sha256', HASH_SECRET)
        .update(value.toLowerCase().trim())
        .digest('hex');
};
const isBase64 = (str) => {
    // SHA256 hex is always 64 chars of 0-9a-f
    // Base64 is shorter and/or contains +/= chars
    return str.length !== 64 || !/^[0-9a-f]{64}$/.test(str);
};
const decodeBase64 = (str) => {
    try {
        return Buffer.from(str, 'base64').toString('utf8');
    }
    catch (err) {
        throw new Error(`Failed to decode Base64: ${str}`);
    }
};
async function migrateHashing() {
    const client = await pool.connect();
    try {
        console.log('🔄 Starting PII hashing migration...\n');
        // Get all consumers with potentially Base64 hashes
        const result = await client.query(`
      SELECT id, aadhaar_hash, pan_hash, name
      FROM consumers
      WHERE (aadhaar_hash IS NOT NULL
             AND LENGTH(aadhaar_hash) != 64)
         OR (pan_hash IS NOT NULL
             AND LENGTH(pan_hash) != 64)
      ORDER BY created_at ASC
    `);
        console.log(`✓ Found ${result.rows.length} records to migrate\n`);
        if (result.rows.length === 0) {
            console.log('✅ All PII records already use SHA256 hashing. No migration needed.\n');
            return;
        }
        let migrated = 0;
        let skipped = 0;
        let errors = 0;
        for (const row of result.rows) {
            try {
                let newAadhaarHash = row.aadhaar_hash;
                let newPanHash = row.pan_hash;
                let requiresUpdate = false;
                // Re-hash aadhaar if Base64
                if (row.aadhaar_hash && isBase64(row.aadhaar_hash)) {
                    try {
                        const decoded = decodeBase64(row.aadhaar_hash);
                        // Only re-hash if decoded value looks like a valid Aadhaar (12 digits) or similar
                        if (decoded.length >= 10 && /^[\d]{10,12}/.test(decoded)) {
                            newAadhaarHash = hashPII(decoded);
                            requiresUpdate = true;
                            console.log(`  ✓ Migrating aadhaar for: ${row.name} (${row.id})`);
                        }
                        else {
                            console.log(`  ⊘ Skipping suspicious aadhaar for: ${row.name} (decoded: ${decoded.length} chars)`);
                            skipped++;
                            continue;
                        }
                    }
                    catch (decodeErr) {
                        console.log(`  ✗ Could not decode aadhaar for: ${row.name} (${row.id})`);
                        errors++;
                        continue;
                    }
                }
                // Re-hash PAN if Base64
                if (row.pan_hash && isBase64(row.pan_hash)) {
                    try {
                        const decoded = decodeBase64(row.pan_hash);
                        if (decoded.length >= 10 && /^[A-Z]{5}[0-9]{4}[A-Z]{1}/.test(decoded)) {
                            newPanHash = hashPII(decoded);
                            requiresUpdate = true;
                            console.log(`  ✓ Migrating PAN for: ${row.name} (${row.id})`);
                        }
                        else {
                            console.log(`  ⊘ Skipping suspicious PAN for: ${row.name}`);
                            skipped++;
                            continue;
                        }
                    }
                    catch (decodeErr) {
                        console.log(`  ✗ Could not decode PAN for: ${row.name} (${row.id})`);
                        errors++;
                        continue;
                    }
                }
                // Update the record only if changes needed
                if (requiresUpdate) {
                    await client.query(`UPDATE consumers
             SET aadhaar_hash = COALESCE($1, aadhaar_hash),
                 pan_hash = COALESCE($2, pan_hash),
                 updated_at = NOW()
             WHERE id = $3`, [newAadhaarHash, newPanHash, row.id]);
                    migrated++;
                }
            }
            catch (err) {
                console.error(`  ✗ Error migrating ${row.id}: ${err.message}`);
                errors++;
            }
        }
        console.log('\n╔═══════════════════════════════════════╗');
        console.log('║      Migration Complete               ║');
        console.log('╚═══════════════════════════════════════╝');
        console.log(`Total found:      ${result.rows.length}`);
        console.log(`Migrated:         ${migrated}`);
        console.log(`Skipped:          ${skipped}`);
        console.log(`Errors:           ${errors}`);
        // Final verification
        const verification = await client.query(`
      SELECT COUNT(*) as remaining_base64
      FROM consumers
      WHERE (aadhaar_hash IS NOT NULL
             AND LENGTH(aadhaar_hash) != 64)
         OR (pan_hash IS NOT NULL
             AND LENGTH(pan_hash) != 64)
    `);
        const remaining = parseInt(verification.rows[0].remaining_base64);
        console.log(`\nRemaining Base64: ${remaining}`);
        if (remaining === 0) {
            console.log('✅ All PII records now use SHA256 hashing\n');
        }
        else {
            console.log(`⚠️  ${remaining} records could not be migrated\n`);
        }
    }
    finally {
        client.release();
        await pool.end();
    }
}
migrateHashing().catch((err) => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
//# sourceMappingURL=migrate-pii-hashing.js.map