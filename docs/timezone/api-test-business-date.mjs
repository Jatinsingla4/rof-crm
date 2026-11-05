// Business calendar policy: instants are UTC, "today" and every date range are the Asia/Kolkata calendar, and neither the machine timezone
// nor the PostgreSQL session timezone takes part. Covers midnight IST (18:30 UTC) and the whole 00:00 to 05:30 IST window, the year and
// month boundaries, leap days, the SQL fragments under several session timezones, and a source scan that keeps the old patterns out.
// Needs the compiled helper (CI builds first; BIZ_DIST overrides) and psql (PSQL, PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE).
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = process.env.BIZ_DIST || process.env.P1_DIST || path.resolve(HERE, '../../packages/api/dist');
const B = await import(pathToFileURL(path.join(DIST, 'utils/business-date.js')).href);
const PSQL = process.env.PSQL || 'psql';
const sql = (q) => execFileSync(PSQL, ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : (fail++), console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const eq = (n, got, want) => t(`${n}: ${want}`, got === want, `got ${got}`);

// ---------- the helper, at fixed instants ----------
const at = (iso) => B.businessDate(new Date(iso));
eq('17:59 UTC (23:29 IST) is still the same day', at('2026-11-04T17:59:59Z'), '2026-11-04');
eq('18:29:59 UTC is 23:59:59 IST, still the 4th', at('2026-11-04T18:29:59Z'), '2026-11-04');
eq('18:30:00 UTC is 00:00:00 IST, the 5th starts', at('2026-11-04T18:30:00Z'), '2026-11-05');
eq('19:44 UTC (01:14 IST) is the 5th although the UTC date is the 4th', at('2026-11-04T19:44:00Z'), '2026-11-05');
eq('23:59:59 UTC (05:29:59 IST) is the 5th', at('2026-11-04T23:59:59Z'), '2026-11-05');
eq('00:00 UTC the 5th (05:30 IST): the 5th, the window ends and both calendars agree', at('2026-11-05T00:00:00Z'), '2026-11-05');
eq('year end: 2026-12-31 18:30 UTC is 1 January 2027 in India', at('2026-12-31T18:30:00Z'), '2027-01-01');
eq('month end: 2026-02-28 20:00 UTC is 1 March in India', at('2026-02-28T20:00:00Z'), '2026-03-01');
eq('leap day: 2028-02-28 19:00 UTC is 29 February in India', at('2028-02-28T19:00:00Z'), '2028-02-29');
eq('addDays across a month end', B.addDays('2026-01-31', 1), '2026-02-01');
eq('addDays backwards across a year', B.addDays('2026-01-01', -1), '2025-12-31');
eq('addYears clamps 29 February', B.addYears('2024-02-29', 1), '2025-02-28');
eq('addYears for the age check', B.addYears('2026-11-05', -18), '2008-11-05');
t('today is a YYYY-MM-DD text', /^\d{4}-\d{2}-\d{2}$/.test(B.businessToday()));
eq('tomorrow is today plus one calendar day', B.businessTomorrow(), B.addDays(B.businessToday(), 1));
eq('businessYear is the year of the business day', B.businessYear(), Number(B.businessToday().slice(0, 4)));
eq('businessDayStart is 00:00 UTC of the business day', B.businessDayStart().toISOString(), `${B.businessToday()}T00:00:00.000Z`);
eq('startOfBusinessDay of 01:14 IST on the 5th', B.startOfBusinessDay('2026-11-04T19:44:00Z').toISOString(), '2026-11-05T00:00:00.000Z');

// ---------- the machine timezone does not matter ----------
for (const tz of ['UTC', 'Asia/Kolkata', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e',
    `import { businessDate } from ${JSON.stringify(pathToFileURL(path.join(DIST, 'utils/business-date.js')).href)};
     console.log(['2026-11-04T18:29:59Z','2026-11-04T18:30:00Z','2026-12-31T18:30:00Z'].map((i) => businessDate(new Date(i))).join());`],
    { env: { ...process.env, TZ: tz }, encoding: 'utf8' }).trim();
  eq(`process TZ=${tz}: same business dates`, out, '2026-11-04,2026-11-05,2027-01-01');
}

// ---------- the database session timezone does not matter ----------
const FIX = { before: '2026-11-04 18:29:59+00', after: '2026-11-04 18:30:00+00' };
for (const tz of ['UTC', 'Asia/Kolkata', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
  const run = (q) => sql(`SET TIME ZONE '${tz}'; ${q}`).split('\n').pop();
  eq(`session ${tz}: SQL_TODAY equals the application's business today`, run(`SELECT ${B.SQL_TODAY}::text`), B.businessToday());
  eq(`session ${tz}: sqlDay of 18:29:59 UTC`, run(`SELECT ${B.sqlDay(`'${FIX.before}'::timestamptz`)}::text`), '2026-11-04');
  eq(`session ${tz}: sqlDay of 18:30:00 UTC`, run(`SELECT ${B.sqlDay(`'${FIX.after}'::timestamptz`)}::text`), '2026-11-05');
  eq(`session ${tz}: start of the business day 2026-11-05 is 18:30 UTC the day before`, run(`SELECT to_char(${B.sqlDayStart(`'2026-11-05'`)} AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')`), '2026-11-04 18:30');
  eq(`session ${tz}: end (exclusive) of the business day 2026-11-05`, run(`SELECT to_char(${B.sqlDayEnd(`'2026-11-05'`)} AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')`), '2026-11-05 18:30');
}
// a range filter built the way the routes build it keeps exactly the rows of that business day
const rows = (tz) => sql(`SET TIME ZONE '${tz}'; SELECT string_agg(x, ',' ORDER BY x) FROM (VALUES ('2026-11-04 18:29:59+00'::timestamptz), ('2026-11-04 18:30:00+00'), ('2026-11-05 18:29:59+00'), ('2026-11-05 18:30:00+00')) v(ts), LATERAL (SELECT to_char(ts AT TIME ZONE 'UTC','HH24:MI:SS DD') AS x) q WHERE ts >= ${B.sqlDayStart(`'2026-11-05'`)} AND ts < ${B.sqlDayEnd(`'2026-11-05'`)}`).split('\n').pop();
for (const tz of ['UTC', 'Asia/Kolkata', 'America/Los_Angeles']) eq(`range filter for 5 November under session ${tz}: the two rows of that Indian day`, rows(tz), '18:29:59 05,18:30:00 04');
// a DATE column is a calendar day: the session timezone never moves it
for (const tz of ['UTC', 'Asia/Kolkata', 'America/Los_Angeles']) eq(`DATE value under session ${tz} stays 2026-11-05`, sql(`SET TIME ZONE '${tz}'; SELECT DATE '2026-11-05'::text`).split('\n').pop(), '2026-11-05');

// ---------- the old patterns stay out of the source ----------
const SRC = path.resolve(HERE, '../../packages/api/src');
const FORBID = [
  [/\bCURRENT_DATE\b/, 'CURRENT_DATE (session timezone)'],
  [/\bNOW\(\)::date\b/i, 'NOW()::date (session timezone)'],
  [/new Date\(\)\.toISOString\(\)\.(slice|split)/, 'today from toISOString() (UTC day)'],
  [/new Date\(Date\.now\(\)[^)]*\)\.toISOString\(\)\.(slice|split)/, 'a day offset from toISOString() (UTC day)'],
  [/\b[a-z]{1,3}\.(created_at|updated_at|generated_at|calculated_at)::date/, 'timestamp cast to date (session timezone)'],
  [/\b(generated_at|created_at|edited_at)\s*(>=|<)\s*[^;\n]*::date/, 'timestamp compared with a bare date (session timezone)'],
];
const SKIP = new Set(['db', 'scripts', 'business-date.ts']);
const hits = [];
const walk = (d) => { for (const n of readdirSync(d)) { if (SKIP.has(n)) continue; const p = path.join(d, n); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.ts')) readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (/^\s*(\/\/|\*)/.test(l)) return; for (const [re, why] of FORBID) if (re.test(l)) hits.push(`${path.relative(SRC, p)}:${i + 1} ${why}`); }); } };
walk(SRC);
t('no route or helper uses the machine or session timezone for a business date', hits.length === 0, hits.slice(0, 8).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
