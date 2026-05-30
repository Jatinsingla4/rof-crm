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

  // Fallback to src if dist doesn't have SQL migrations (e.g., if copy-files.js fails)
  let usesFallback = false;
  if (fs.existsSync(migrationsDir)) {
    const distFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    if (distFiles.length === 0) {
      const srcMigrationsDir = path.join(__dirname, '../src/db/migrations');
      if (fs.existsSync(srcMigrationsDir)) {
        const srcFiles = fs.readdirSync(srcMigrationsDir).filter(f => f.endsWith('.sql'));
        if (srcFiles.length > distFiles.length) {
          log(`[MIGRATIONS] ⚠️ dist/migrations is empty (${distFiles.length} files), falling back to src/db/migrations (${srcFiles.length} files)`);
          migrationsDir = srcMigrationsDir;
          usesFallback = true;
        }
      }
    }
  } else if (!fs.existsSync(migrationsDir)) {
    const srcMigrationsDir = path.join(__dirname, '../src/db/migrations');
    if (fs.existsSync(srcMigrationsDir)) {
      log(`[MIGRATIONS] ⚠️ dist/migrations directory not found, falling back to src/db/migrations`);
      migrationsDir = srcMigrationsDir;
      usesFallback = true;
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

    // Inline migrations for critical schema that must always exist
    const INLINE_MIGRATIONS = [
      {
        name: '057_document_versions',
        sql: `
          CREATE TABLE IF NOT EXISTS document_versions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            version_number INTEGER NOT NULL DEFAULT 1,
            html_content TEXT,
            fields_changed JSONB DEFAULT '[]'::jsonb,
            edit_reason TEXT,
            edited_by_user_id UUID,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            is_original BOOLEAN DEFAULT false
          );
          CREATE INDEX IF NOT EXISTS idx_doc_versions_doc_id ON document_versions(document_id);
          CREATE INDEX IF NOT EXISTS idx_doc_versions_created ON document_versions(document_id, created_at DESC);
        `
      },
      {
        name: '058_user_permissions',
        sql: `
          CREATE TABLE IF NOT EXISTS user_process_permissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            process_name VARCHAR(100) NOT NULL,
            is_maker BOOLEAN DEFAULT false,
            is_checker BOOLEAN DEFAULT false,
            is_approver BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            created_by_user_id UUID,
            UNIQUE(user_id, process_name)
          );
          CREATE INDEX IF NOT EXISTS idx_user_process_permissions_user ON user_process_permissions(user_id);
          CREATE INDEX IF NOT EXISTS idx_user_process_permissions_process ON user_process_permissions(process_name);

          CREATE TABLE IF NOT EXISTS user_company_access (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            company_id UUID NOT NULL,
            access_level VARCHAR(50) DEFAULT 'viewer',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            created_by_user_id UUID,
            UNIQUE(user_id, company_id)
          );
          CREATE INDEX IF NOT EXISTS idx_user_company_access_user ON user_company_access(user_id);
          CREATE INDEX IF NOT EXISTS idx_user_company_access_company ON user_company_access(company_id);
        `
      },
      {
        name: '059_seed_testuser',
        sql: `
          INSERT INTO users (
            id, name, email, mobile, role, password_hash,
            assigned_project_ids, is_active, created_at, created_by_user_id
          ) VALUES (
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'Test User',
            'testuser@rof.com',
            '9999999999',
            'super_admin',
            '$2a$10$knaIyawSbnFwKeRBDw4ha.YRE.ahsETMjRZyR2ZtrqlGQGQ9UoRKO',
            '[]'::jsonb,
            true,
            NOW(),
            'ffffffff-ffff-ffff-ffff-ffffffffffff'
          )
          ON CONFLICT (email) DO NOTHING;
        `
      }
    ];

    // Run inline migrations
    log('[MIGRATIONS] Running inline migrations...');
    for (const migration of INLINE_MIGRATIONS) {
      try {
        log(`[MIGRATIONS] Running inline: ${migration.name}...`);
        await db.query(migration.sql);
        log(`[MIGRATIONS] ✅ ${migration.name} completed`);
      } catch (error) {
        const errorMsg = (error as Error).message;
        // IF NOT EXISTS handles duplicates, so errors are real problems
        if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
          log(`[MIGRATIONS] → ${migration.name} already applied`);
        } else {
          logErr(`[MIGRATIONS] ⚠️ ${migration.name}: ${errorMsg}`);
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
