// Phase 7: the historical repair kit (docs/remediation/historical/*.sql and dist/scripts/historical-backfill.js), tried on the DISPOSABLE test database.
// For every repair: the dry run changes nothing, the apply writes only what was approved and only where the rule is met, no amount / status / date moves (money
// checksums before and after are identical), a second run changes nothing, and the rollback restores the earlier state. Never run against production or Neon.
//   BASE=http://localhost:3096/api node api-test-historical.mjs   (psql env set, and DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD for the node script)
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, project, booking, receipt, psql, t, tally } from '../receipt-allocation/lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), KIT = path.join(HERE, 'historical');
const SCRIPT = path.join(HERE, '..', '..', 'packages', 'api', 'dist', 'scripts', 'historical-backfill.js');
const work = mkdtempSync(path.join(tmpdir(), 'hist-'));
const dbEnv = { ...process.env, DB_HOST: process.env.DB_HOST || process.env.PGHOST, DB_PORT: process.env.DB_PORT || process.env.PGPORT, DB_NAME: process.env.DB_NAME || process.env.PGDATABASE, DB_USER: process.env.DB_USER || process.env.PGUSER, DB_PASSWORD: process.env.DB_PASSWORD || process.env.PGPASSWORD };
const sql = (file, { vars = {}, input, cwd = work } = {}) => spawnSync('psql', ['-q', ...Object.entries(vars).flatMap(([k, v]) => ['-v', `${k}=${v}`]), '-f', path.join(KIT, file)], { cwd, input, encoding: 'utf8', env: process.env });
const checksums = () => execFileSync('psql', ['-qAt', '-f', path.join(KIT, '00-checksums.sql')], { encoding: 'utf8' }).split('\n').filter((l) => l && !l.startsWith('info:')).join('\n');
const node = (args) => spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8', env: dbEnv });
const num = (s) => Number(s || 0);
const q1 = (s) => psql(s);

const E = await env(); const P = await project(E, { tag: 'HS' });
// fixture: A and B priced with a rate (what a snapshot needs), C with no rate, D with a rate that no longer matches its plan; every one has a cleared receipt
const rated = (price) => booking(E, P, { price, extra: { basic_price: price / 500 } });
const A = await rated(3000000), B = await rated(2000000), C = await booking(E, P, { price: 1000000 }), D = await rated(4000000);
for (const b of [A, B, C, D]) await receipt(E, b, 400000);
q1(`update booking_records set basic_rate_inr_sqft = basic_rate_inr_sqft + 1 where id='${D.id}'`);   // D: the quote now differs from what the plan bills
const demandsOf = (b) => q1(`select string_agg(id::text, ',') from demands where consumer_id='${b.c}'`).split(',');

// ================= demand -> booking =================
const before = checksums();
{
  const rep = sql('01-exceptions-report.sql');
  t('exceptions report: runs read-only and writes its CSV files', rep.status === 0 && existsSync(path.join(work, 'exc-demand-booking.csv')) && /demand_booking_single/.test(rep.stdout), rep.stderr);
  const csv = readFileSync(path.join(work, 'exc-demand-booking.csv'), 'utf8');
  t('exceptions report: lists the demands of the fixture applicants with their one candidate booking', [A, B, C, D].every((b) => csv.includes(b.c) && csv.includes(b.id)));
  t('exceptions report: the booking with no rate is listed as an exception', readFileSync(path.join(work, 'exc-booking-no-rate-or-area.csv'), 'utf8').includes(C.id));
  t('exceptions report: changed nothing (money checksums identical)', checksums() === before);
  const dry = spawnSync('psql', ['-q', '-f', path.join(HERE, 'backfill-demand-booking-DRYRUN.sql')], { cwd: work, encoding: 'utf8', env: process.env });
  t('dry run: changes nothing, no demand is linked', dry.status === 0 && num(q1(`select count(*) from demands where booking_id is not null`)) === 0 && checksums() === before, dry.stderr);
}
{
  // finance approves A's and B's demands, and also D's demand 1 after the applicant's plan was pointed at another unit (no booking matches it: "unlinked")
  const otherUnit = q1(`select id from units where id <> '${D.u}' limit 1`);
  q1(`update payment_plans set unit_id='${otherUnit}' where id=(select payment_plan_id from demands where consumer_id='${D.c}' limit 1)`);
  const approved = [...demandsOf(A), ...demandsOf(B), ...demandsOf(D).slice(0, 1)];
  writeFileSync(path.join(work, 'approved.csv'), 'demand_id\n' + approved.join('\n') + '\n');
  const input = readFileSync(path.join(work, 'approved.csv'), 'utf8');
  const noName = sql('02-demand-booking-APPLY.sql', { input });
  t('apply: refused without who approved it, nothing written', /Refused/.test(noName.stdout + noName.stderr) && num(q1(`select count(*) from demands where booking_id is not null`)) === 0);
  const ap = sql('02-demand-booking-APPLY.sql', { vars: { approved_by: 'QA Finance', log_file: path.join(work, 'applied.csv') }, input });
  t('apply: ran in one transaction and wrote a log', ap.status === 0 && existsSync(path.join(work, 'applied.csv')), ap.stderr + ap.stdout);
  const linked = (b) => num(q1(`select count(*) from demands where consumer_id='${b.c}' and booking_id='${b.id}'`));
  t('apply: every approved demand of A and B is linked to its own booking', linked(A) === demandsOf(A).length && linked(B) === demandsOf(B).length, `${linked(A)}/${demandsOf(A).length} ${linked(B)}/${demandsOf(B).length}`);
  t('apply: the unapproved demands (C) stay unlinked', num(q1(`select count(*) from demands where consumer_id='${C.c}' and booking_id is not null`)) === 0);
  t('apply: an approved demand with no matching booking is skipped, not guessed', num(q1(`select count(*) from demands where consumer_id='${D.c}' and booking_id is not null`)) === 0);
  t('apply: no amount, status or date moved (money checksums identical)', checksums() === before);
  const again = sql('02-demand-booking-APPLY.sql', { vars: { approved_by: 'QA Finance', log_file: path.join(work, 'applied2.csv') }, input });
  t('apply: a second run links nothing more', /will_link/.test(again.stdout) && / 0\s*$/m.test(again.stdout.split('will_link')[1] || '') || num(q1(`select count(*) from demands where booking_id is not null`)) === demandsOf(A).length + demandsOf(B).length, again.stdout);
  const rb = sql('03-demand-booking-ROLLBACK.sql', { input: readFileSync(path.join(work, 'applied.csv'), 'utf8') });
  t('rollback: clears exactly the links the apply wrote', rb.status === 0 && num(q1(`select count(*) from demands where booking_id is not null`)) === 0, rb.stderr + rb.stdout);
  t('rollback: money checksums identical to the start', checksums() === before);
}

// ================= agreement snapshots =================
{
  const n0 = num(q1(`select count(*) from booking_agreement`)), total0 = q1(`select string_agg(id::text || ':' || coalesce(total_price_inr::text,''), ',' order by id) from booking_records where id in ('${A.id}','${B.id}','${C.id}','${D.id}')`);
  const dry = node(['snapshots', '--project', P.proj, '--out', path.join(work, 'snap-dry')]);
  const rows = readFileSync(path.join(work, 'snap-dry', 'agreement-snapshot-review.csv'), 'utf8').split('\n').slice(1).filter(Boolean);
  const verdict = (id) => (rows.find((r) => r.startsWith(id)) || '').split(',')[7];
  t('snapshots dry run: nothing written', dry.status === 0 && num(q1(`select count(*) from booking_agreement`)) === n0 && checksums() === before, dry.stderr + dry.stdout);
  t('snapshots dry run: A and B would be written (quote = plan), C (no rate) and D (quote differs) are exceptions', verdict(A.id) === 'would_write' && verdict(B.id) === 'would_write' && verdict(C.id) === 'exception' && verdict(D.id) === 'exception', rows.filter((r) => [A.id, B.id, C.id, D.id].some((i) => r.startsWith(i))).join(' | '));
  const noName = node(['snapshots', '--apply', '--project', P.proj, '--out', path.join(work, 'snap-x')]);
  t('snapshots apply: refused without --approved-by (exit 2), nothing written', noName.status === 2 && num(q1(`select count(*) from booking_agreement`)) === n0);
  const ap = node(['snapshots', '--apply', '--approved-by', 'QA Finance', '--project', P.proj, '--out', path.join(work, 'snap-apply')]);
  t('snapshots apply: A and B get one current version 1 with the backfill reason; C and D get none', ap.status === 0
    && [A, B].every((b) => num(q1(`select count(*) from booking_agreement where booking_id='${b.id}' and is_current and version=1 and reason='historical backfill (Phase 7)' and created_by is null`)) === 1)
    && [C, D].every((b) => num(q1(`select count(*) from booking_agreement where booking_id='${b.id}'`)) === 0), ap.stderr + ap.stdout);
  t('snapshots apply: no money moved (total_price_inr and every checksum identical)', checksums() === before && q1(`select string_agg(id::text || ':' || coalesce(total_price_inr::text,''), ',' order by id) from booking_records where id in ('${A.id}','${B.id}','${C.id}','${D.id}')`) === total0);
  t('snapshots apply: the snapshot value equals what the plan bills', num(q1(`select ba.agreement_value_inr - pp.total_amount_inr from booking_agreement ba join booking_records br on br.id=ba.booking_id join allocations a on a.consumer_id=br.consumer_id and a.unit_id=br.unit_id and a.status not in ('cancelled','transferred') join payment_plans pp on pp.allocation_id=a.id where ba.booking_id='${A.id}'`)) === 0);
  const written = num(q1(`select count(*) from booking_agreement`)) - n0;
  const again = node(['snapshots', '--apply', '--approved-by', 'QA Finance', '--project', P.proj, '--out', path.join(work, 'snap-again')]);
  t('snapshots apply: a second run writes nothing more', again.status === 0 && num(q1(`select count(*) from booking_agreement`)) - n0 === written);
  const imm = (() => { try { q1(`update booking_agreement set rate_inr_sqft = rate_inr_sqft + 1 where booking_id='${A.id}'`); return false; } catch { return true; } })();
  t('snapshots: the written rows are immutable like any other', imm);
  const rb = sql('05-snapshot-ROLLBACK.sql', { vars: { confirm: 'yes' } });
  t('snapshots rollback: removes the rows the backfill wrote and switches the immutability trigger back on', rb.status === 0 && num(q1(`select count(*) from booking_agreement`)) === n0 && q1(`select tgenabled from pg_trigger where tgname='booking_agreement_immutable'`) === 'O', rb.stderr + rb.stdout);
  t('snapshots rollback: money checksums identical to the start', checksums() === before);
}

// ================= receipt allocation =================
{
  const flag0 = q1(`select value from global_settings where key='receipt_allocation_v1'`), n0 = num(q1(`select count(*) from receipt_allocation`));
  const dry = node(['allocations', '--project', P.proj, '--out', path.join(work, 'al-dry')]);
  const summary = (out) => JSON.parse((out.match(/^\{.*\}$/m) || ['{}'])[0]);
  t('allocations dry run: nothing written, the shadow report agrees with the status rules on every demand', dry.status === 0 && num(q1(`select count(*) from receipt_allocation`)) === n0 && summary(dry.stdout).mismatch_count === 0, dry.stderr + dry.stdout);
  const noName = node(['allocations', '--apply', '--project', P.proj, '--out', path.join(work, 'al-x')]);
  t('allocations apply: refused without --approved-by', noName.status === 2 && num(q1(`select count(*) from receipt_allocation`)) === n0);
  const ap = node(['allocations', '--apply', '--approved-by', 'QA Finance', '--project', P.proj, '--out', path.join(work, 'al-apply')]);
  const s = summary(ap.stdout);
  t(`allocations apply: ${s.rows_written} rows written, equal to what the shadow planned`, ap.status === 0 && s.applied === true && s.rows_written === s.rows_planned && num(q1(`select count(*) from receipt_allocation`)) === n0 + s.rows_written, ap.stderr + ap.stdout);
  t('allocations apply: the receipts of the fixture are allocated, and none is allocated more than it received', [A, B, C, D].every((b) => num(q1(`select coalesce(sum(a.principal + a.cgst + a.sgst),0) from receipt_allocation a join receipts r on r.id=a.receipt_id where r.consumer_id='${b.c}'`)) > 0)
    && num(q1(`select count(*) from (select r.id from receipts r join receipt_allocation a on a.receipt_id=r.id group by r.id, r.amount_received_inr having sum(a.principal + a.cgst + a.sgst) > r.amount_received_inr + 0.01) x`)) === 0);
  t('allocations apply: no money moved, and the flag is untouched', checksums() === before && q1(`select value from global_settings where key='receipt_allocation_v1'`) === flag0);
  const again = node(['allocations', '--apply', '--approved-by', 'QA Finance', '--project', P.proj, '--out', path.join(work, 'al-again')]);
  t('allocations apply: a second run leaves the same number of rows (rebuilt, not doubled)', again.status === 0 && num(q1(`select count(*) from receipt_allocation`)) === n0 + s.rows_written);
  const refuse = sql('04-allocation-ROLLBACK.sql');
  t('allocations rollback: refused without -v confirm=yes', /Refused/.test(refuse.stdout) && num(q1(`select count(*) from receipt_allocation`)) === n0 + s.rows_written);
  const rb = sql('04-allocation-ROLLBACK.sql', { vars: { confirm: 'yes' } });
  t('allocations rollback: the derived rows are cleared, money checksums identical to the start', rb.status === 0 && num(q1(`select count(*) from receipt_allocation`)) === 0 && checksums() === before, rb.stderr);
}
console.log(`\nRESULT: ${tally()}`);
process.exit(tally().includes(' 0 failed') ? 0 : 1);
