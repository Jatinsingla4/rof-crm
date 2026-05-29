import fs from 'fs';
import path from 'path';
import { pool } from './pool';

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  console.log(`[MIGRATIONS] Running from: ${migrationsDir}`);

  try {
    // Get all .sql files in the migrations directory
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`[MIGRATIONS] Found ${files.length} migration files`);

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const migrationName = file.replace('.sql', '');

      console.log(`[MIGRATIONS] Running ${migrationName}...`);

      try {
        const sql = fs.readFileSync(filePath, 'utf-8');
        await pool.query(sql);
        console.log(`[MIGRATIONS] ✅ ${migrationName} completed`);
      } catch (error) {
        console.error(`[MIGRATIONS] ❌ ${migrationName} FAILED:`, (error as Error).message);
        throw error; // Stop on first error
      }
    }

    console.log('[MIGRATIONS] ✅ All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('[MIGRATIONS] ❌ Migration failed:', (error as Error).message);
    process.exit(1);
  }
}

runMigrations();
