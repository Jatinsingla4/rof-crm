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
    console.log(`[MIGRATIONS] Running from: ${migrationsDir}`);
    try {
        // Get all .sql files in the migrations directory
        const files = fs_1.default.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();
        console.log(`[MIGRATIONS] Found ${files.length} migration files`);
        for (const file of files) {
            const filePath = path_1.default.join(migrationsDir, file);
            const migrationName = file.replace('.sql', '');
            console.log(`[MIGRATIONS] Running ${migrationName}...`);
            try {
                const sql = fs_1.default.readFileSync(filePath, 'utf-8');
                await pool_1.db.query(sql);
                console.log(`[MIGRATIONS] ✅ ${migrationName} completed`);
            }
            catch (error) {
                console.error(`[MIGRATIONS] ❌ ${migrationName} FAILED:`, error.message);
                throw error; // Stop on first error
            }
        }
        console.log('[MIGRATIONS] ✅ All migrations completed successfully!');
        process.exit(0);
    }
    catch (error) {
        console.error('[MIGRATIONS] ❌ Migration failed:', error.message);
        process.exit(1);
    }
}
runMigrations();
//# sourceMappingURL=migrations.js.map