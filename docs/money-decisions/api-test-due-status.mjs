// Owner decision on the scheduler and the due status: a demand whose due date has been reached is shown as demanded WITHOUT any write event (D1 at read time),
// the daily job (Vercel Cron, authenticated by CRON_SECRET) stores that status and can run twice with no second change, and a reminder is only for a formally
// raised demand.  The job part needs the server and this script to share CRON_SECRET; without it only the refusal is tested.
// Run against a local test API (psql must reach the same database).
import * as L from '../receipt-allocation/lib.mjs';
const { psql, U, t, tally } = L;
const E = await L.env();
const SECRET = process.env.CRON_SECRET;
const P = await L.project(E, { tag: 'DS', plan: [10, 20, 30, 40] });
const b = await L.booking(E, P, { price: 3000000, carpet: 500 });
const plan = psql(`select id from payment_plans where consumer_id='${b.c}' order by created_at desc limit 1`);
psql(`update demands set due_date=(now() at time zone 'Asia/Kolkata')::date - 5 where payment_plan_id='${plan}' and installment_index=2`);   // set-up: demand 2 never raised, due 5 days ago
const stored = () => psql(`select status from demands where payment_plan_id='${plan}' and installment_index=2`);
const shown = async () => ((await E.A('GET', `/payments/demands?consumerId=${b.c}`)).j?.data ?? []).find((r) => Number(r.installment_index) === 2)?.status;
const call = (auth) => fetch(L.B + '/cron/daily-status', { headers: auth ? { authorization: auth } : {} }).then(async (r) => ({ s: r.status, j: await r.json().catch(() => null) }));

t('D1: a never-raised demand whose due date has been reached is shown as demanded (no write event needed)', (await shown()) === 'demanded' && stored() === 'pending', `${await shown()} / stored ${stored()}`);
const none = await call(null);
t('D2: the daily job refuses a call without the secret (401, or 503 when the server has no CRON_SECRET)', none.s === 401 || none.s === 503, none.s);
if (!SECRET) { console.log('NOTE: CRON_SECRET is not set for this script, the job itself is not run'); }
else {
  const bad = await call('Bearer wrong-' + SECRET); t('D3: a wrong secret is refused (401)', bad.s === 401, bad.s);
  const audit0 = Number(psql(`select count(*) from financial_audit_logs where payment_plan_id='${plan}' and action_type='demand_status_recomputed'`));
  const a = await call('Bearer ' + SECRET);
  t('D4: with the secret the job stores the status already true by date (demand 2 becomes demanded)', a.s === 200 && stored() === 'demanded' && a.j?.demandsUpdated >= 1, `${a.s} ${JSON.stringify(a.j)} stored ${stored()}`);
  const audit1 = Number(psql(`select count(*) from financial_audit_logs where payment_plan_id='${plan}' and action_type='demand_status_recomputed'`));
  const again = await call('Bearer ' + SECRET); const audit2 = Number(psql(`select count(*) from financial_audit_logs where payment_plan_id='${plan}' and action_type='demand_status_recomputed'`));
  t('D5: running the job twice changes nothing the second time and writes no second audit row', again.s === 200 && audit1 === audit0 + 1 && audit2 === audit1, `audit ${audit0} ${audit1} ${audit2}`);
  t('D6: the date it was raised is untouched (raised_at stays empty: a due date is not a formal raise)', psql(`select raised_at is null from demands where payment_plan_id='${plan}' and installment_index=2`) === 't'); }

console.log(`\nRESULT: ${tally()}`);
process.exit(/ 0 failed/.test(tally()) ? 0 : 1);
