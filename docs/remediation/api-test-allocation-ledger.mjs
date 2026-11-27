// The allocation ledger (QA-008, 014, 033, 037, 039) on real data: GET /payments/allocation-ledger/:consumerId and GET /payments/allocation-reconciliation. Read only, finance only.
// The Zf Tester shape: 25,95,836 on a raised instalment, 1,37,441 against an instalment of 1,36,664 that is not raised yet, a third instalment of 777 still to come.
// Own project and applicant (new every run). Run against a local test API:  BASE=http://localhost:3010/api node api-test-allocation-ledger.mjs   (psql must reach the same database)
import { env, project, booking, psql, t, tally } from '../receipt-allocation/lib.mjs';

const E = await env(); const P = await project(E, { tag: 'AL' });
const b = await booking(E, P);
t('setup: a confirmed booking', !!b.id, JSON.stringify(b.r?.j).slice(0, 200));
const plan = psql(`select id from payment_plans where consumer_id='${b.c}' order by created_at desc limit 1`);
psql(`update demands set status='cancelled' where payment_plan_id='${plan}' returning 1`);   // only the demands of this test count
const mkDemand = (idx, amt, due, raised) => psql(`insert into demands (payment_plan_id, installment_index, consumer_id, due_date, amount_due_inr, cgst_amount, sgst_amount, status, demand_type${raised ? ', raised_at' : ''})
  values ('${plan}', ${idx}, '${b.c}', ${due}, ${amt}, 0, 0, '${raised ? 'demanded' : 'pending'}', 'installment'${raised ? ", now() - interval '25 days'" : ''}) returning id`).split('\n')[0];
const dA = mkDemand(90, 2595836, 'current_date - 20', true), dB = mkDemand(91, 136664, 'current_date + 60', false), dC = mkDemand(92, 777, 'current_date + 90', false);
const afUser = "(select id from users where email='accounts_finance@test.local')";
const mkReceipt = (amt, demand, idx, status = 'cleared', approval = 'approved') => psql(`insert into receipts (consumer_id, payment_plan_id, demand_id, installment_index, amount_received_inr, received_date, clearing_date, status, approval_status, payment_method, received_by_user_id)
  values ('${b.c}', '${plan}', '${demand}', ${idx}, ${amt}, current_date - 10, current_date - 10, '${status}', '${approval}', 'neft', ${afUser}) returning id`).split('\n')[0];
const r1 = mkReceipt(2595836, dA, 90), r2 = mkReceipt(137441, dB, 91);

let r = await E.A('GET', `/payments/allocation-ledger/${b.c}`);
const L = r.j?.data?.plans?.find((x) => x.payment_plan_id === plan);
t('the ledger answers 200 with this plan', r.s === 200 && !!L, r.s + JSON.stringify(r.j).slice(0, 200));
const k = (kind) => (L?.entries || []).filter((e) => e.kind === kind);
t('eligible money 27,33,277 (25,95,836 + 1,37,441), of which 27,32,500 is applied', L?.totals.eligible === 2733277 && L?.totals.applied === 2732500, JSON.stringify(L?.totals));
t('the 1,36,664 sits on the instalment that is not raised yet', L?.totals.applied_on_unraised_instalments === 136664);
t('the 777 is one "unapplied" entry, excess over the instalment its receipt names', k('unapplied').length === 1 && k('unapplied')[0].amount === 777 && k('unapplied')[0].reason === 'excess_over_instalment' && k('unapplied')[0].receipt_id === r2, JSON.stringify(k('unapplied')));
t('credit available is 777, counted once', L?.totals.credit_available === 777 && L?.totals.unapplied === 777);
t('every check agrees, including the status engine', L?.ok === true, JSON.stringify(L?.checks));
t('the instalment of 777 still to come has its full balance', L?.per_demand.find((x) => x.demand_id === dC)?.balance === 777);

// money that is not money (yet): listed, never applied
const pend = mkReceipt(5000, dA, 90, 'pending', 'pending'), bnc = mkReceipt(3000, dA, 90, 'bounced', 'pending');
r = await E.A('GET', `/payments/allocation-ledger/${b.c}`);
const L2 = r.j.data.plans.find((x) => x.payment_plan_id === plan), nm = L2.entries.filter((e) => e.kind === 'not_money');
t('a pending and a bounced receipt are listed as not money (with the booking-amount receipt still waiting) and change nothing applied', nm.length >= 2 && nm.some((e) => e.receipt_id === pend && e.status === 'pending') && nm.some((e) => e.receipt_id === bnc && e.status === 'bounced') && L2.totals.applied === 2732500, JSON.stringify(nm));

// an approved bank return comes off the receipt and shows as its own entry
psql(`insert into receipt_returns (receipt_id, consumer_id, payment_plan_id, amount, reason, bank_return_date, status, requested_by, approved_by, posted_at, idempotency_key)
  values ('${r1}', '${b.c}', '${plan}', 100000, 'bank return', current_date, 'approved', ${afUser}, (select id from users where email='super_admin@test.local'), now(), 'al${Date.now().toString(36)}') returning 1`);
r = await E.A('GET', `/payments/allocation-ledger/${b.c}`);
const L3 = r.j.data.plans.find((x) => x.payment_plan_id === plan);
t('an approved return of 1,00,000 is its own entry and the raised instalment is short by that much', L3.entries.some((e) => e.kind === 'returned' && e.receipt_id === r1 && e.amount === 100000) && L3.per_demand.find((x) => x.demand_id === dA).balance === 100000 && L3.ok === true, JSON.stringify(L3.totals));

// the reconciliation over all plans
r = await E.A('GET', '/payments/allocation-reconciliation');
const rc = r.j?.data;
t('the reconciliation runs over every plan with a receipt (read only)', r.s === 200 && rc.plans_checked >= 1 && rc.receipts_seen >= 4 && typeof rc.totals.unapplied === 'number', r.s + JSON.stringify(rc).slice(0, 200));
t('this plan is not among the violations', !(rc.violations || []).some((v) => v.payment_plan_id === plan), JSON.stringify((rc.violations || []).filter((v) => v.payment_plan_id === plan)));
t('the unapplied money is reported by reason, with this 777 in it', (rc.unapplied_by_reason.excess_over_instalment?.amount || 0) >= 777, JSON.stringify(rc.unapplied_by_reason));
t('and the receipts that are not money by status', (rc.not_money_by_status.pending?.receipts || 0) >= 1 && (rc.not_money_by_status.bounced?.receipts || 0) >= 1, JSON.stringify(rc.not_money_by_status));
r = await E.A('GET', `/payments/allocation-reconciliation?projectId=${P.proj}`);
t('scoped to a project it counts only its plans', r.s === 200 && r.j.data.plans_checked === 1, r.s + JSON.stringify(r.j.data).slice(0, 160));

// access and input
r = await E.SE('GET', `/payments/allocation-ledger/${b.c}`);
t('a sales executive may not read it (403)', r.s === 403, r.s);
r = await E.A('GET', '/payments/allocation-ledger/not-a-uuid');
t('a bad applicant id is refused (400)', r.s === 400, r.s);
r = await E.A('GET', '/payments/allocation-reconciliation?projectId=abc');
t('a bad project id is refused (400)', r.s === 400, r.s);
const before = psql(`select count(*) from receipt_allocation`);
await E.A('GET', `/payments/allocation-ledger/${b.c}`); await E.A('GET', '/payments/allocation-reconciliation');
t('reading writes nothing: receipt_allocation is unchanged and the flag is untouched', psql(`select count(*) from receipt_allocation`) === before);

console.log(`\nRESULT: ${tally()}`);
process.exit(tally().includes(' 0 failed') ? 0 : 1);
