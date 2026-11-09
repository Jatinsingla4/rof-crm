// Receipt returns (a bank return of a CLEARED receipt) and customer credit allocations: owner decisions D4, D6, D7, D8.
// Maker-checker is strict (the maker cannot approve, super admin included), a return that would leave allocated credit uncovered is refused with the list and
// only goes through when the checker names the allocations to reverse (the system never picks one), instalment 1 keeps raised_at and due_date,
// duplicate requests and parallel approvals change the books once. Run against a local test API (psql must reach the same database).
import * as L from '../receipt-allocation/lib.mjs';
const { psql, today, U, t, tally } = L;
const E = await L.env();
const num = (v) => (v === '' || v == null ? 0 : Number(v));
let kn = 0; const key = () => `K${U}${++kn}${Math.random().toString(36).slice(2, 6)}`;
const par = (n, f) => Promise.all(Array.from({ length: n }, f));
const yesterday = () => psql(`select (now() at time zone 'Asia/Kolkata')::date - 1`);
const tomorrow2 = () => psql(`select (now() at time zone 'Asia/Kolkata')::date + 2`);

async function scenario(tag, amount = 400000) {
  const P = await L.project(E, { tag, plan: [10, 20, 30, 40] });
  const b = await L.booking(E, P, { price: 3000000, carpet: 500 });
  const r = await L.receipt(E, b, amount);
  if (r.step !== 'clear' || r.s2 !== 200) throw new Error('clear ' + JSON.stringify(r).slice(0, 200));
  const rid = r.j.data.id;
  const dem = (i) => psql(`select id from demands where consumer_id='${b.c}' and installment_index=${i} and status<>'cancelled' order by created_at limit 1`);
  return { P, b, rid, d: (i) => dem(i) };
}
const status = (s, i) => psql(`select status from demands where consumer_id='${s.b.c}' and installment_index=${i} and status<>'cancelled' order by created_at limit 1`);
const dates = (s, i) => psql(`select coalesce(raised_at::text,'')||'|'||coalesce(due_date::text,'') from demands where consumer_id='${s.b.c}' and installment_index=${i} and status<>'cancelled' order by created_at limit 1`);
const summary = async (s) => (await E.A('GET', `/payments/credit-allocations/summary?consumerId=${s.b.c}`)).j?.data?.[0];
const ledger = async (s, path, k) => { const r = await E.A('GET', `/reports/${path}?projectId=${s.P.proj}`); const row = (r.j?.data ?? []).find((x) => x.consumer_id === s.b.c); return row ? num(row[k]) : null; };
const requestReturn = (s, amount, o = {}, who = E.A) => who('POST', `/payments/receipts/${o.rid ?? s.rid}/returns`, { amount, reason: 'bank returned the cheque', bank_return_date: today(), idempotency_key: o.key ?? key(), ...o.extra });
const approveReturn = (id, ids, who = E.C) => who('POST', `/payments/receipt-returns/${id}/approve`, ids ? { reverse_allocation_ids: ids } : {});
const raise = (s, i) => E.A('PATCH', '/payments/demands/activate', { demandIds: [s.d(i)], installmentDate: today() });
const requestAlloc = (s, i, amount, o = {}, who = E.A) => who('POST', '/payments/credit-allocations', { demand_id: s.d(i), amount, reason: 'allocate credit', idempotency_key: o.key ?? key() });
const approveAlloc = (id, who = E.C) => who('POST', `/payments/credit-allocations/${id}/approve`, {});
const rows = (sql) => psql(sql);
const allocState = (s) => psql(`select coalesce(string_agg(id||':'||status||':'||version, ',' order by id),'') from credit_allocations where consumer_id='${s.b.c}'`);
const counts = (s) => psql(`select (select count(*) from credit_allocation_reversals r join credit_allocations a on a.id=r.allocation_id where a.consumer_id='${s.b.c}')||'/'||(select count(*) from receipt_returns where consumer_id='${s.b.c}' and status='approved')||'/'||(select count(*) from journal_entries where consumer_id='${s.b.c}' and ledger_head='Receipt Return')`);

// ---------- receipt return: request ----------
{
  const s = await scenario('R1');
  const noClear = await L.receipt(E, s.b, 5000, { clear: false });
  const x0 = await requestReturn(s, 1000, { rid: noClear.j.data.id });
  t('return: a receipt that has not cleared cannot be returned -> 409', x0.s === 409, x0.s + JSON.stringify(x0.j).slice(0, 120));
  for (const [label, o] of [['no reason', { extra: { reason: '' } }], ['no bank date', { extra: { bank_return_date: undefined } }], ['future bank date', { extra: { bank_return_date: tomorrow2() } }], ['bank date before the clearing date', { extra: { bank_return_date: yesterday() } }], ['no idempotency key', { extra: { idempotency_key: '' } }], ['paise', { extra: {} }]]) {
    const r = await requestReturn(s, label === 'paise' ? 1000.5 : 1000, { ...o, key: o.extra?.idempotency_key === '' ? '' : undefined });
    t(`return: ${label} -> 400`, r.s === 400, r.s + JSON.stringify(r.j).slice(0, 120));
  }
  const k1 = key(); const r1 = await requestReturn(s, 150000, { key: k1 });
  t('return: a request is recorded as pending with both dates (bank date now, no posting date yet)', r1.s === 201 && r1.j.data.status === 'pending' && r1.j.data.bank_return_date === today() && r1.j.data.posted_at === null, r1.s + JSON.stringify(r1.j).slice(0, 160));
  const r1b = await requestReturn(s, 150000, { key: k1 });
  t('return: the same request again (same key) returns the same return, nothing doubled', r1b.s === 200 && r1b.j.replay === true && r1b.j.data.id === r1.j.data.id && num(rows(`select count(*) from receipt_returns where receipt_id='${s.rid}'`)) === 1);
  const r1c = await requestReturn(s, 140000, { key: k1 });
  t('return: the same key for a different amount -> 409', r1c.s === 409, r1c.s);
  const r2 = await requestReturn(s, 1000);
  t('return: a second return waiting on the same receipt -> 409', r2.s === 409, r2.s + JSON.stringify(r2.j).slice(0, 100));
  const r3 = await requestReturn(s, 150000, {}, E.AF);
  t('return: accounts_finance without the receipt maker right -> 403', r3.s === 403, r3.s);
  const before = psql(`select status||'|'||amount_received_inr||'|'||coalesce(clearing_date::text,'')||'|'||receipt_number from receipts where id='${s.rid}'`);
  const own = await approveReturn(r1.j.data.id, undefined, E.A);
  t('return: the requester cannot approve their own return, super admin included -> 403', own.s === 403, own.s + JSON.stringify(own.j).slice(0, 100));
  const rawDates = dates(s, 1);
  const ok = await approveReturn(r1.j.data.id);
  t('return: an independent checker approves it', ok.s === 200 && ok.j.data.status === 'approved' && ok.j.data.posted_at !== null && ok.j.data.journal_entry_id, ok.s + JSON.stringify(ok.j).slice(0, 160));
  t('return: the cleared receipt itself is unchanged (status, amount, clearing date, number)', psql(`select status||'|'||amount_received_inr||'|'||coalesce(clearing_date::text,'')||'|'||receipt_number from receipts where id='${s.rid}'`) === before);
  t('return: the bank return date and the posting time are kept apart', psql(`select (bank_return_date = current_date)::text||'|'||(posted_at is not null)::text from receipt_returns where id='${r1.j.data.id}'`) === 'true|true');
  t('return: instalment 1 (3,15,000) is partly covered by the 2,50,000 that is left: partial', status(s, 1) === 'partial', status(s, 1));
  t('return: raised_at and due_date of instalment 1 are untouched (D8)', dates(s, 1) === rawDates, `${rawDates} -> ${dates(s, 1)}`);
  t('return: the ledger shows received 2,50,000 and no credit', (await ledger(s, 'customer-balance', 'total_received')) === 250000 && (await ledger(s, 'customer-dues', 'credit_amount')) === 0, `${await ledger(s, 'customer-balance', 'total_received')}/${await ledger(s, 'customer-dues', 'credit_amount')}`);
  const again = await approveReturn(r1.j.data.id);
  t('return: approving twice -> 409', again.s === 409, again.s);
  const over = await requestReturn(s, 250001);
  t('return: more than what is left of the receipt (4,00,000 less 1,50,000 returned) -> 409', over.s === 409, over.s + JSON.stringify(over.j).slice(0, 100));
  const fine = await requestReturn(s, 250000);
  t('return: exactly what is left is accepted', fine.s === 201, fine.s);
  const rej = await approveReturn(fine.j.data.id, undefined, E.A);
  const rj = await E.C('POST', `/payments/receipt-returns/${fine.j.data.id}/reject`, { reason: 'wrong cheque' });
  t('return: a checker rejects a return and the money does not move', rj.s === 200 && rj.j.data.status === 'rejected' && (await ledger(s, 'customer-balance', 'total_received')) === 250000 && rej.s === 403, rj.s + JSON.stringify(rj.j).slice(0, 100));
}

// ---------- parallel approvals and retries ----------
{
  const s = await scenario('R2');
  const rq = await requestReturn(s, 100000);
  const res = await par(5, () => approveReturn(rq.j.data.id));
  t(`return: 5 approvals at the same moment -> exactly one 200, no 5xx (${res.map((x) => x.s).join(',')})`, res.filter((x) => x.s === 200).length === 1 && res.every((x) => x.s < 500), res.map((x) => x.s).join());
  t('return: one journal entry and one approved return', counts(s) === '0/1/1', counts(s));
  const ks = key();
  const dup = await par(5, () => requestReturn(s, 1000, { key: ks }));
  t(`return: 5 identical requests at once leave one pending return (${dup.map((x) => x.s).join(',')})`, num(rows(`select count(*) from receipt_returns where receipt_id='${s.rid}' and status='pending'`)) === 1 && dup.every((x) => x.s < 500), dup.map((x) => x.s).join());
}

// ---------- customer credit allocation (D4) ----------
{
  const s = await scenario('C1');
  const sm0 = await summary(s);
  t('credit: cleared 4,00,000 on a 3,15,000 instalment leaves Rs 85,000 of customer credit and no ADV row', num(sm0?.credit) === 85000 && num(rows(`select count(*) from receipts where consumer_id='${s.b.c}' and is_advance`)) === 0, JSON.stringify(sm0));
  const notDue = await requestAlloc(s, 3, 1000);
  t('credit: a demand that is not due cannot take credit -> 409', notDue.s === 409, notDue.s + JSON.stringify(notDue.j).slice(0, 100));
  const toPaid = await requestAlloc(s, 1, 1000);
  t('credit: a paid demand cannot take credit -> 409', toPaid.s === 409, toPaid.s);
  t('credit: instalment 2 is raised by staff (an explicit action)', (await raise(s, 2)).s === 200 && ['demanded', 'raised'].includes(status(s, 2)), status(s, 2));
  const tooMuch = await requestAlloc(s, 2, 90000);
  t('credit: more than the credit available -> 409', tooMuch.s === 409, tooMuch.s + JSON.stringify(tooMuch.j).slice(0, 100));
  const k1 = key(); const a1 = await requestAlloc(s, 2, 80000, { key: k1 });
  t('credit: a request is recorded as pending and changes nothing yet', a1.s === 201 && a1.j.data.status === 'pending' && status(s, 2) !== 'partial' && num((await summary(s)).credit) === 85000, a1.s + JSON.stringify(a1.j).slice(0, 120));
  const a1b = await requestAlloc(s, 2, 80000, { key: k1 });
  t('credit: the same request again returns the same allocation', a1b.s === 200 && a1b.j.data.id === a1.j.data.id && num(rows(`select count(*) from credit_allocations where consumer_id='${s.b.c}'`)) === 1, a1b.s);
  const noRight = await requestAlloc(s, 2, 1000, {}, E.AF);
  t('credit: accounts_finance without the credit allocation maker right -> 403', noRight.s === 403, noRight.s);
  const own = await approveAlloc(a1.j.data.id, E.A);
  t('credit: the maker cannot approve their own allocation, super admin included -> 403', own.s === 403, own.s + JSON.stringify(own.j).slice(0, 100));
  const noChecker = await approveAlloc(a1.j.data.id, E.AF);
  t('credit: a user without the checker right cannot approve -> 403', noChecker.s === 403, noChecker.s);
  const dts = dates(s, 2);
  const ok = await approveAlloc(a1.j.data.id);
  t('credit: an independent checker approves it', ok.s === 200 && ok.j.data.status === 'approved' && ok.j.data.posted_at, ok.s + JSON.stringify(ok.j).slice(0, 120));
  t('credit: instalment 2 is now partial (Rs 80,000 of 6,30,000+GST), credit left Rs 5,000, raise date untouched', status(s, 2) === 'partial' && num((await summary(s)).credit) === 5000 && dates(s, 2) === dts, `${status(s, 2)}/${(await summary(s)).credit}`);
  const race = await par(4, () => requestAlloc(s, 2, 5000));
  const raceOk = race.filter((x) => x.s === 201).map((x) => x.j.data.id);
  const apr = await par(raceOk.length, (_, i) => approveAlloc(raceOk[i]));
  t(`credit: ${raceOk.length} requests of Rs 5,000 on Rs 5,000 of credit approved at once -> exactly one 200, no 5xx (${apr.map((x) => x.s).join(',')})`, apr.filter((x) => x.s === 200).length === 1 && apr.every((x) => x.s < 500), apr.map((x) => x.s).join());
  const live = rows(`select id from credit_allocations where consumer_id='${s.b.c}' and status='approved' order by amount desc limit 1`);
  const rv = await E.A('POST', `/payments/credit-allocations/${live}/reversal`, { reason: 'wrong demand', idempotency_key: key() });
  t('credit: a reversal is requested by a maker', rv.s === 201 && rv.j.data.status === 'pending', rv.s + JSON.stringify(rv.j).slice(0, 100));
  const rv2 = await E.A('POST', `/payments/credit-allocations/${live}/reversal`, { reason: 'again', idempotency_key: key() });
  t('credit: a second reversal of the same allocation -> 409', rv2.s === 409, rv2.s);
  const rvOwn = await E.A('POST', `/payments/credit-allocation-reversals/${rv.j.data.id}/approve`, {});
  t('credit: the maker cannot approve their own reversal -> 403', rvOwn.s === 403, rvOwn.s);
  const rvOk = await E.C('POST', `/payments/credit-allocation-reversals/${rv.j.data.id}/approve`, {});
  t('credit: an independent checker approves the reversal, the allocation is reversed and the credit is back', rvOk.s === 200 && psql(`select status from credit_allocations where id='${live}'`) === 'reversed' && num((await summary(s)).credit) >= 80000, rvOk.s + JSON.stringify(await summary(s)));
}

// ---------- D7: a return while credit is allocated ----------
{
  const s = await scenario('D7');
  await raise(s, 2);
  const a1 = await requestAlloc(s, 2, 50000); await approveAlloc(a1.j.data.id);
  const a2 = await requestAlloc(s, 2, 30000); await approveAlloc(a2.j.data.id);
  t('D7 set-up: two allocations of Rs 50,000 and Rs 30,000 are approved, credit left Rs 5,000', num((await summary(s)).credit) === 5000, JSON.stringify(await summary(s)));
  const small = await requestReturn(s, 4000);
  const idsOnly = await approveReturn(small.j.data.id, [a1.j.data.id]);
  t('D7: reverse_allocation_ids sent although no allocation has to be reversed -> 400, nothing changed', idsOnly.s === 400 && counts(s) === '0/0/0', idsOnly.s + JSON.stringify(idsOnly.j).slice(0, 120));
  const smallOk = await approveReturn(small.j.data.id);
  t('D7: a return that the credit can absorb (Rs 4,000 of Rs 5,000) is approved without any reversal', smallOk.s === 200 && smallOk.j.reversed_allocation_ids.length === 0 && allocState(s).split(',').every((x) => x.includes(':approved:')), smallOk.s + JSON.stringify(smallOk.j).slice(0, 100));
  const big = await requestReturn(s, 100000);
  const dts = dates(s, 1); const st0 = allocState(s), c0 = counts(s);
  const r409 = await approveReturn(big.j.data.id);
  t('D7: a return that would leave allocated credit uncovered is refused with 409', r409.s === 409, r409.s + JSON.stringify(r409.j).slice(0, 160));
  const listed = (r409.j?.affected_allocations || []).map((a) => a.id);
  t('D7: the answer lists the affected allocations and the shortfall', listed.includes(a1.j.data.id) && listed.includes(a2.j.data.id) && num(r409.j?.shortfall) > 0, JSON.stringify(r409.j).slice(0, 200));
  t('D7: nothing was written: allocations, reversals, returns, journals and the return itself are as before; no automatic reversal', allocState(s) === st0 && counts(s) === c0 && psql(`select status from receipt_returns where id='${big.j.data.id}'`) === 'pending');
  const unknown = await approveReturn(big.j.data.id, ['00000000-0000-4000-8000-000000000000']);
  t('D7: an id that is not an allocation of this plan -> 400, nothing changed', unknown.s === 400 && allocState(s) === st0, unknown.s + JSON.stringify(unknown.j).slice(0, 100));
  const partial = await approveReturn(big.j.data.id, [a2.j.data.id]);
  t('D7: selected reversals that do not restore the money invariant -> 409, nothing written (the system does not add the other allocation itself)', partial.s === 409 && allocState(s) === st0 && counts(s) === c0, partial.s + JSON.stringify(partial.j).slice(0, 140));
  const noRight = await approveReturn(big.j.data.id, [a1.j.data.id, a2.j.data.id], E.AF);
  t('D7: a checker without the receipt checker right cannot approve at all -> 403', noRight.s === 403 && allocState(s) === st0, noRight.s);
  const both = await approveReturn(big.j.data.id, [a1.j.data.id, a2.j.data.id]);
  t('D7: with both allocations named by the checker the return is approved and they are reversed in the same transaction', both.s === 200 && both.j.reversed_allocation_ids.length === 2, both.s + JSON.stringify(both.j).slice(0, 160));
  t('D7: each reversal is an ordinary reversal record linked to the return (maker = the return requester, checker = the approver)', psql(`select count(*) from credit_allocation_reversals r where r.origin_return_id='${big.j.data.id}' and r.status='approved' and r.requested_by=(select requested_by from receipt_returns where id='${big.j.data.id}') and r.approved_by=(select approved_by from receipt_returns where id='${big.j.data.id}') and r.requested_by <> r.approved_by`) === '2');
  const sm = await summary(s);
  t('D7: the books are consistent after the return (credit is not negative, no allocation left approved)', num(sm.credit) >= 0 && num(sm.allocated) === 0, JSON.stringify(sm));
  t('D7: instalment 1 keeps raised_at and due_date after the return (D8)', dates(s, 1) === dts, `${dts} -> ${dates(s, 1)}`);
}

// ---------- D8: bounce and cancel keep the dates of instalment 1 (the deposited-cheque path) ----------
{
  const s = await scenario('D8');
  const dts = dates(s, 1);
  const pend = await L.receipt(E, s.b, 20000, { clear: false });
  const ca = await E.A('POST', `/payments/receipts/${pend.j.data.id}/cancel`, { reason: 'test' });
  t('D8: cancelling another receipt of the applicant leaves instalment 1 dates and every allocation as they were', ca.s === 200 && dates(s, 1) === dts && allocState(s) === '', ca.s + ' ' + dates(s, 1));
}

console.log(`\nRESULT: ${tally()}`);
process.exit(/ 0 failed/.test(tally()) ? 0 : 1);
