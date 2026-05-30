import fs from 'fs';
import path from 'path';
import { db } from './pool';

export async function runMigrations(): Promise<string[]> {
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };
  const logErr = (msg: string) => {
    console.error(msg);
    logs.push(`ERROR: ${msg}`);
  };

  let migrationsDir = path.join(__dirname, 'migrations');
  log(`[MIGRATIONS] Starting migration runner`);
  log(`[MIGRATIONS] Running from: ${migrationsDir}`);

  // Fallback to src if dist doesn't have migrations (e.g., if copy-files.js fails)
  if (!fs.existsSync(migrationsDir)) {
    const srcMigrationsDir = path.join(__dirname, '../src/db/migrations');
    if (fs.existsSync(srcMigrationsDir)) {
      log(`[MIGRATIONS] ⚠️ dist/migrations not found, falling back to src/db/migrations`);
      migrationsDir = srcMigrationsDir;
    }
  }

  log(`[MIGRATIONS] Environment: ${process.env.NODE_ENV}`);
  log(`[MIGRATIONS] Database URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);

  try {
    // Test database connection
    log(`[MIGRATIONS] Testing database connection...`);
    const connTest = await db.query('SELECT NOW()');
    log(`[MIGRATIONS] ✅ Database connected at ${(connTest.rows[0] as any).now}`);

    // Get all .sql files in the migrations directory
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    log(`[MIGRATIONS] Found ${files.length} migration files`);

    if (files.length === 0) {
      log('[MIGRATIONS] ⚠️  WARNING: No SQL migration files found!');
      return logs;
    }

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const migrationName = file.replace('.sql', '');

      log(`[MIGRATIONS] Running ${migrationName}...`);

      try {
        const sql = fs.readFileSync(filePath, 'utf-8');
        if (!sql || sql.trim().length === 0) {
          log(`[MIGRATIONS] ⚠️  Skipping empty migration: ${migrationName}`);
          continue;
        }

        await db.query(sql);
        log(`[MIGRATIONS] ✅ ${migrationName} completed`);
      } catch (error) {
        const errorMsg = (error as Error).message;
        logErr(`[MIGRATIONS] ❌ ${migrationName} FAILED: ${errorMsg}`);

        // Continue instead of stopping - some migrations might already be applied
        if (errorMsg.includes('already exists')) {
          log(`[MIGRATIONS] → Skipping (already applied)`);
        } else {
          // For template seeding, warn but don't fail
          if (migrationName.includes('seed') || migrationName.includes('template')) {
            log(`[MIGRATIONS] → Warning: seeding issue (may not be critical)`);
          } else {
            throw error;
          }
        }
      }
    }

    log('[MIGRATIONS] ✅ All migrations completed!');
  } catch (error) {
    logErr('[MIGRATIONS] ❌ FATAL ERROR: ' + (error as Error).message);
    logErr('[MIGRATIONS] Stack: ' + (error as Error).stack);
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
