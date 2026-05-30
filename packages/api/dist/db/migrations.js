"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pool_1 = require("./pool");
async function runMigrations() {
    const logs = [];
    const log = (msg) => {
        console.log(msg);
        logs.push(msg);
    };
    const logErr = (msg) => {
        console.error(msg);
        logs.push(`ERROR: ${msg}`);
    };
    const migrationsDir = path_1.default.join(__dirname, 'migrations');
    log(`[MIGRATIONS] Starting migration runner`);
    log(`[MIGRATIONS] Running from: ${migrationsDir}`);
    log(`[MIGRATIONS] Environment: ${process.env.NODE_ENV}`);
    log(`[MIGRATIONS] Database URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
    try {
        // Test database connection
        log(`[MIGRATIONS] Testing database connection...`);
        const connTest = await pool_1.db.query('SELECT NOW()');
        log(`[MIGRATIONS] ✅ Database connected at ${connTest.rows[0].now}`);
        // Get all .sql files in the migrations directory
        const files = fs_1.default.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();
        log(`[MIGRATIONS] Found ${files.length} migration files`);
        if (files.length === 0) {
            log('[MIGRATIONS] ⚠️  WARNING: No SQL migration files found!');
            return logs;
        }
        for (const file of files) {
            const filePath = path_1.default.join(migrationsDir, file);
            const migrationName = file.replace('.sql', '');
            log(`[MIGRATIONS] Running ${migrationName}...`);
            try {
                const sql = fs_1.default.readFileSync(filePath, 'utf-8');
                if (!sql || sql.trim().length === 0) {
                    log(`[MIGRATIONS] ⚠️  Skipping empty migration: ${migrationName}`);
                    continue;
                }
                await pool_1.db.query(sql);
                log(`[MIGRATIONS] ✅ ${migrationName} completed`);
            }
            catch (error) {
                const errorMsg = error.message;
                logErr(`[MIGRATIONS] ❌ ${migrationName} FAILED: ${errorMsg}`);
                // Continue instead of stopping - some migrations might already be applied
                if (errorMsg.includes('already exists')) {
                    log(`[MIGRATIONS] → Skipping (already applied)`);
                }
                else {
                    // For template seeding, warn but don't fail
                    if (migrationName.includes('seed') || migrationName.includes('template')) {
                        log(`[MIGRATIONS] → Warning: seeding issue (may not be critical)`);
                    }
                    else {
                        throw error;
                    }
                }
            }
        }
        log('[MIGRATIONS] ✅ All migrations completed!');
    }
    catch (error) {
        logErr('[MIGRATIONS] ❌ FATAL ERROR: ' + error.message);
        logErr('[MIGRATIONS] Stack: ' + error.stack);
        throw error;
    }
    return logs;
}
// When run as CLI, run migrations and exit
if (require.main === module) {
    runMigrations()
        .then(() => {
        console.log('[MIGRATIONS] ✅ CLI migration run completed');
        process.exit(0);
    })
        .catch((error) => {
        console.error('[MIGRATIONS] ❌ CLI migration run failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=migrations.js.map