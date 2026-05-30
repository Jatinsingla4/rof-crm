"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pool_1 = require("./pool");
async function runMigrations() {
    const migrationsDir = path_1.default.join(__dirname, 'migrations');
    console.log(`[MIGRATIONS] Starting migration runner`);
    console.log(`[MIGRATIONS] Running from: ${migrationsDir}`);
    console.log(`[MIGRATIONS] Environment: ${process.env.NODE_ENV}`);
    console.log(`[MIGRATIONS] Database URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
    try {
        // Test database connection
        console.log(`[MIGRATIONS] Testing database connection...`);
        const connTest = await pool_1.db.query('SELECT NOW()');
        console.log(`[MIGRATIONS] ✅ Database connected at ${connTest.rows[0].now}`);
        // Get all .sql files in the migrations directory
        const files = fs_1.default.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();
        console.log(`[MIGRATIONS] Found ${files.length} migration files`);
        if (files.length === 0) {
            console.warn('[MIGRATIONS] ⚠️  WARNING: No SQL migration files found!');
        }
        for (const file of files) {
            const filePath = path_1.default.join(migrationsDir, file);
            const migrationName = file.replace('.sql', '');
            console.log(`[MIGRATIONS] Running ${migrationName}...`);
            try {
                const sql = fs_1.default.readFileSync(filePath, 'utf-8');
                if (!sql || sql.trim().length === 0) {
                    console.warn(`[MIGRATIONS] ⚠️  Skipping empty migration: ${migrationName}`);
                    continue;
                }
                await pool_1.db.query(sql);
                console.log(`[MIGRATIONS] ✅ ${migrationName} completed`);
            }
            catch (error) {
                const errorMsg = error.message;
                console.error(`[MIGRATIONS] ❌ ${migrationName} FAILED:`, errorMsg);
                // Continue instead of stopping - some migrations might already be applied
                if (errorMsg.includes('already exists')) {
                    console.log(`[MIGRATIONS] → Skipping (already applied)`);
                }
                else {
                    // For template seeding, warn but don't fail
                    if (migrationName.includes('seed') || migrationName.includes('template')) {
                        console.warn(`[MIGRATIONS] → Warning: seeding issue (may not be critical)`);
                    }
                    else {
                        throw error;
                    }
                }
            }
        }
        console.log('[MIGRATIONS] ✅ All migrations completed!');
        process.exit(0);
    }
    catch (error) {
        console.error('[MIGRATIONS] ❌ FATAL ERROR:', error.message);
        console.error('[MIGRATIONS] Stack:', error.stack);
        process.exit(1);
    }
}
runMigrations();
//# sourceMappingURL=migrations.js.map