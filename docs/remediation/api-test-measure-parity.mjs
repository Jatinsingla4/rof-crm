// Report definitions (QA-013, 043): the screens that show "outstanding" measure different things on purpose, and the relation between them is exact. One booking with a raised instalment that is
// part paid and a later instalment that is not raised yet:
//   overdue list  = the unpaid part of the RAISED, past-due instalment
//   customer balance (billed) = raised demands less cleared money, the same figure
//   Demand Status "contract balance" = ALL instalments (raised and not) less cleared money = overdue + the instalment not raised yet
// Own project and applicant (new every run). Run against a local test API:  BASE=http://localhost:3010/api node api-test-measure-parity.mjs   (psql must reach the same database)
import { env, project, booking, psql, t, tally, today } from '../receipt-allocation/lib.mjs';

const E = await env(); const P = await project(E, { tag: 'MP' });
const b = await booking(E, P);
t('setup: a confirmed booking', !!b.id, JSON.stringify(b.r?.j).slice(0, 200));
const plan = psql(`select id from payment_plans where consumer_id='${b.c}' order by created_at desc limit 1`);
const RAISED = 100000, LATER = 60000, PAID = 30000;
// only the two demands of this test count: the others of the plan are put aside
psql(`update demands set status='cancelled' where payment_plan_id='${plan}' returning 1`);
const d1 = psql(`insert into demands (payment_plan_id, installment_index, consumer_id, due_date, amount_due_inr, cgst_amount, sgst_amount, status, demand_type, raised_at)
  values ('${plan}', 90, '${b.c}', current_date - 20, ${RAISED}, 0, 0, 'demanded', 'installment', now() - interval '25 days') returning id`).split('\n')[0];
psql(`insert into demands (payment_plan_id, installment_index, consumer_id, due_date, amount_due_inr, cgst_amount, sgst_amount, status, demand_type)
  values ('${plan}', 91, '${b.c}', current_date + 60, ${LATER}, 0, 0, 'pending', 'installment') returning id`);
psql(`insert into receipts (consumer_id, payment_plan_id, demand_id, installment_index, amount_received_inr, received_date, clearing_date, status, approval_status, payment_method, received_by_user_id)
  select '${b.c}', '${plan}', '${d1}', 90, ${PAID}, current_date - 10, current_date - 10, 'cleared', 'approved', 'neft', id from users where email='accounts_finance@test.local' returning id`);

const overdue = (await E.A('GET', '/payments/overdue')).j?.data || [];
const mine = overdue.filter((x) => x.consumer_id === b.c);
const overdueSum = mine.reduce((s, x) => s + Number(x.amount_due_inr), 0);
t(`overdue list: the raised instalment shows what is still unpaid (${RAISED - PAID}), the unraised one is not on it`, mine.length === 1 && overdueSum === RAISED - PAID, JSON.stringify(mine.map((x) => [x.id, x.amount_due_inr])));

const ds = ((await E.A('GET', `/payments/demand-status?project_id=${P.proj}`)).j?.data || []).find((x) => x.consumer_id === b.c);
t(`Demand Status contract balance counts every instalment less the money paid (${RAISED + LATER - PAID})`, Number(ds?.balance_amount) === RAISED + LATER - PAID, JSON.stringify(ds || {}).slice(0, 300));
t('the relation: contract balance = overdue list + the instalment not raised yet', Number(ds?.balance_amount) === overdueSum + LATER);

const cb = ((await E.A('GET', `/reports/customer-balance?projectId=${P.proj}`)).j?.data || []).find((x) => x.consumer_id === b.c);
t(`customer balance (billed) = raised demands less cleared money = the overdue list (${RAISED - PAID})`, Number(cb?.balance) === overdueSum, JSON.stringify(cb || {}).slice(0, 300));

const m = (await E.A('GET', `/reports/financial-measures?projectId=${P.proj}`)).j?.data || {};
t('financial measures: billed outstanding = the overdue list, contract balance = the Demand Status figure', Number(m.billed_outstanding) === overdueSum && Number(m.contract_balance) === Number(ds?.balance_amount), JSON.stringify([m.billed_outstanding, m.contract_balance]));

const dash = (await E.A('GET', `/payments/dashboard?projectId=${P.proj}`)).j?.data?.kpis || {};
t('payments dashboard: outstanding is the contract balance, billed outstanding the overdue figure, one overdue instalment', Number(dash.outstanding) === Number(m.contract_balance) && Number(dash.billedOutstanding) === overdueSum && dash.overdueCount === 1, JSON.stringify(dash));

// a cancelled booking is out of all of them
psql(`update booking_records set status='cancelled' where id='${b.id}' returning 1`);
const after = (await E.A('GET', '/payments/overdue')).j?.data || [];
t('after the booking is cancelled it is no longer on the overdue list', !after.some((x) => x.consumer_id === b.c));
const dash2 = (await E.A('GET', `/payments/dashboard?projectId=${P.proj}`)).j?.data?.kpis || {};
t('and it is out of the payments dashboard totals (it used to stay in)', Number(dash2.totalReceivables) === 0 && Number(dash2.overdueCount) === 0, JSON.stringify(dash2));

console.log(`\nRESULT: ${tally()}`);
process.exit(tally().includes(' 0 failed') ? 0 : 1);
