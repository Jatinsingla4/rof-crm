import fs from 'fs';
import path from 'path';
import { db } from './pool';

export async function runMigrations(): Promise<void> {
  const migrationsDir = path.join(__dirname, 'migrations');
  console.log(`[MIGRATIONS] Starting migration runner`);
  console.log(`[MIGRATIONS] Running from: ${migrationsDir}`);
  console.log(`[MIGRATIONS] Environment: ${process.env.NODE_ENV}`);
  console.log(`[MIGRATIONS] Database URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);

  try {
    // Test database connection
    console.log(`[MIGRATIONS] Testing database connection...`);
    const connTest = await db.query('SELECT NOW()');
    console.log(`[MIGRATIONS] ✅ Database connected at ${(connTest.rows[0] as any).now}`);

    // Get all .sql files in the migrations directory
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`[MIGRATIONS] Found ${files.length} migration files`);

    if (files.length === 0) {
      console.warn('[MIGRATIONS] ⚠️  WARNING: No SQL migration files found!');
      return;
    }

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const migrationName = file.replace('.sql', '');

      console.log(`[MIGRATIONS] Running ${migrationName}...`);

      try {
        const sql = fs.readFileSync(filePath, 'utf-8');
        if (!sql || sql.trim().length === 0) {
          console.warn(`[MIGRATIONS] ⚠️  Skipping empty migration: ${migrationName}`);
          continue;
        }

        await db.query(sql);
        console.log(`[MIGRATIONS] ✅ ${migrationName} completed`);
      } catch (error) {
        const errorMsg = (error as Error).message;
        console.error(`[MIGRATIONS] ❌ ${migrationName} FAILED:`, errorMsg);

        // Continue instead of stopping - some migrations might already be applied
        if (errorMsg.includes('already exists')) {
          console.log(`[MIGRATIONS] → Skipping (already applied)`);
        } else {
          // For template seeding, warn but don't fail
          if (migrationName.includes('seed') || migrationName.includes('template')) {
            console.warn(`[MIGRATIONS] → Warning: seeding issue (may not be critical)`);
          } else {
            throw error;
          }
        }
      }
    }

    console.log('[MIGRATIONS] ✅ All migrations completed!');
  } catch (error) {
    console.error('[MIGRATIONS] ❌ FATAL ERROR:', (error as Error).message);
    console.error('[MIGRATIONS] Stack:', (error as Error).stack);
    throw error;
  }
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
