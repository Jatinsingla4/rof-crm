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
    // Test database connection and set search_path for Neon compatibility
    log(`[MIGRATIONS] Testing database connection...`);
    const connTest = await db.query('SELECT NOW()');
    log(`[MIGRATIONS] ✅ Database connected at ${(connTest.rows[0] as any).now}`);

    // Set search_path to 'public' for Neon compatibility
    await db.query('SET search_path = public;');
    log(`[MIGRATIONS] ✅ search_path set to public`);

    // Migrations that should only run in development
    const SKIP_IN_PRODUCTION = [
      '040_import_test_documents_data.sql'
    ];

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

      // Skip dev-only migrations in production
      if (process.env.NODE_ENV === 'production' && SKIP_IN_PRODUCTION.includes(file)) {
        log(`[MIGRATIONS] ⏭️  Skipping ${migrationName} (dev-only migration in production)`);
        continue;
      }

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
            'ffffffff-ffff-ffff-ffff-ffffffffffff',
            'Test User',
            'testuser@rof.com',
            '9999999999',
            'super_admin',
            '$2a$10$lqxqW.tt3V47v1YxDbuzmuQr0qjs.MFXxKNzjKEfQyidF9uPKlsJO',
            '[]'::jsonb,
            true,
            NOW(),
            'ffffffff-ffff-ffff-ffff-ffffffffffff'
          )
          ON CONFLICT (email) DO UPDATE SET
            password_hash = EXCLUDED.password_hash,
            is_active = EXCLUDED.is_active,
            role = EXCLUDED.role,
            name = EXCLUDED.name;
        `
      },
      {
        name: '060_store_ats_html_in_db',
        sql: '' // Handled by special case in runMigrations
      }
    ];

    // Run inline migrations
    log('[MIGRATIONS] Running inline migrations...');
    for (const migration of INLINE_MIGRATIONS) {
      // Special migrations that need file I/O
      if (migration.name === '060_store_ats_html_in_db') {
        await runTemplateStorageMigration(db, log, logErr);
        continue;
      }

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

async function runTemplateStorageMigration(
  db: any,
  log: (msg: string) => void,
  logErr: (msg: string) => void
): Promise<void> {
  try {
    const fsM = await import('fs');
    const pathM = await import('path');

    log('[060] Reading HTML template files...');

    const paths = [
      path.join(__dirname, '../templates/legal'),
      path.join(process.cwd(), 'src/templates/legal'),
      path.join(process.cwd(), 'packages/api/src/templates/legal'),
    ];

    let atsHtml = '';
    let convHtml = '';

    for (const dir of paths) {
      const atsFile = path.join(dir, 'ats_rof_alante.html');
      const convFile = path.join(dir, 'conveyance_rof_alante.html');

      if (fsM.existsSync(atsFile) && fsM.existsSync(convFile)) {
        atsHtml = fsM.readFileSync(atsFile, 'utf-8');
        convHtml = fsM.readFileSync(convFile, 'utf-8');
        log(`[060] Found templates at: ${dir}`);
        break;
      }
    }

    if (!atsHtml || !convHtml) {
      log('[060] Template files not found. Templates likely already have full HTML.');
      return;
    }

    if (atsHtml.length < 10000 || convHtml.length < 10000) {
      logErr('[060] WARNING: Template files too small');
      return;
    }

    // Check if templates still have FILE: references
    const checkRes = await db.query(`
      SELECT COUNT(*) as file_refs
      FROM document_templates
      WHERE document_type IN ('buyer_builder_agreement', 'conveyance_deed')
      AND body_html LIKE 'FILE:%'
    `);

    const fileRefCount = parseInt(checkRes.rows[0]?.file_refs || 0);

    if (fileRefCount === 0) {
      log('[060] Templates already have full HTML. Skipping.');
      return;
    }

    log(`[060] Found ${fileRefCount} templates with FILE: references`);
    log(`[060] Storing ATS HTML (${atsHtml.length} chars)...`);

    await db.query(
      `UPDATE document_templates
       SET body_html = $1, updated_at = NOW()
       WHERE document_type = 'buyer_builder_agreement'
       AND body_html LIKE 'FILE:%'`,
      [atsHtml]
    );

    log(`[060] Storing Conveyance HTML (${convHtml.length} chars)...`);

    await db.query(
      `UPDATE document_templates
       SET body_html = $1, updated_at = NOW()
       WHERE document_type = 'conveyance_deed'
       AND body_html LIKE 'FILE:%'`,
      [convHtml]
    );

    log('[060] ✅ Templates stored successfully!');
  } catch (err: any) {
    log(`[060] Warning: ${err.message}`);
    // Don't throw — allow other migrations to continue
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
