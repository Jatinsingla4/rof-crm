// Money integrity (owner decisions Q13, D1 to D8): only cleared money counts, a receipt never marks a demand paid by itself,
// the excess of a cleared receipt is customer credit (no ADV row), bounce / cancel / return never clear raised_at or due_date,
// surrender and the dashboard never count ADV copies. Each check fails on the code as it was before this change.
// Run against a local test API: BASE=http://localhost:3002/api node api-test-money-integrity.mjs   (psql must reach the same database)
import * as L from '../receipt-allocation/lib.mjs';
const { psql, today, U, t, tally } = L;
const E = await L.env();
const num = (v) => (v === '' || v == null ? 0 : Number(v));
const rid = (r) => r.j?.data?.id ?? r.j?.id;
const post = (b, amount, method = 'neft', ref) => E.A('POST', '/payments/receipts', { consumerId: b.c, bookingId: b.id, amountReceivedInr: amount, paymentMode: method, referenceNumber: ref ?? `MI${U}${Math.random().toString(36).slice(2, 8)}`, paymentDate: today(), ...(method === 'cheque' ? { chequeNo: ref, bankName: 'Test Bank', chequeDate: today() } : {}) });
const approve = (id) => E.C('PATCH', `/payments/receipts/${id}/approve`, {});
const deposit = (id) => E.C('PATCH', `/payments/receipts/${id}/deposit`, { deposit_date: today() });
const clear = (id) => E.C('PATCH', `/payments/receipts/${id}/clear`, { clearing_date: today() });
const bounce = (id) => E.C('PATCH', `/payments/receipts/${id}/bounce`, { reason: 'money integrity test' });
const cancel = (id) => E.A('POST', `/payments/receipts/${id}/cancel`, { reason: 'money integrity test' });
const cleared = async (b, amount) => { const r = await post(b, amount); await approve(rid(r)); const c = await clear(rid(r)); return { r, c }; };
const cheque = async (b, amount, upTo) => { const ref = `CQ${U}${Math.random().toString(36).slice(2, 7)}`; const r = await post(b, amount, 'cheque', ref); if (upTo >= 1) await approve(rid(r)); if (upTo >= 2) await deposit(rid(r)); return r; };
async function fresh(tag) {
  const P = await L.project(E, { tag, plan: [10, 20, 30, 40] });
  const b = await L.booking(E, P, { price: 3000000, carpet: 500 });
  if (!b.id) throw new Error('booking ' + JSON.stringify(b.r?.j)?.slice(0, 200));
  return { P, b };
}
const d1 = (s) => psql(`select status||'|'||coalesce(raised_at::text,'')||'|'||coalesce(due_date::text,'') from demands where consumer_id='${s.b.c}' and installment_index=1 and status<>'cancelled' order by created_at limit 1`).split('|');
const demandStatus = (s, i) => psql(`select status from demands where consumer_id='${s.b.c}' and installment_index=${i} and status<>'cancelled' order by created_at limit 1`);
const advRows = (s) => num(psql(`select count(*) from receipts where consumer_id='${s.b.c}' and coalesce(is_advance,false)`));
const totalPaid = async (s, i = 1) => { const r = await E.A('GET', `/payments/demands?projectId=${s.P.proj}&limit=500`); const row = (r.j?.data ?? []).find((x) => x.consumer_id === s.b.c && Number(x.installment_index) === i); return row ? num(row.total_paid) : null; };
const ledger = async (s, path, key) => { const r = await E.A('GET', `/reports/${path}?projectId=${s.P.proj}`); const row = (r.j?.data ?? []).find((x) => x.consumer_id === s.b.c); return row ? num(row[key]) : null; };
const projectCollection = async (s) => { const r = await E.A('GET', `/reports/project-collection?projectId=${s.P.proj}`); return num((r.j?.data ?? [])[0]?.total_amount); };
const dashCollected = async (s) => { const r = await E.A('GET', '/dashboard/daily-status'); const row = (r.j?.data ?? []).find((x) => x.project_id === s.P.proj); return row ? num(row.coll_total) : null; };
const allocId = (s) => psql(`select id from allocations where consumer_id='${s.b.c}' and unit_id='${s.b.u}' order by created_at desc limit 1`);
const surrender = (s, a) => E.A('POST', '/surrender', { consumerId: s.b.c, allocationId: allocId(s), bookingId: s.b.id, unitId: s.b.u, projectId: s.P.proj, type: 'surrender', surrenderDate: today(), ...a });
const legacyClearedAdv = (s, amount) => psql(`insert into receipts (consumer_id, payment_plan_id, installment_index, amount_received_inr, payment_method, received_date, receipt_number, status, approval_status, is_advance) select '${s.b.c}', id, 2, ${amount}, 'neft', current_date, 'MI-${U}-' || substr(md5(random()::text),1,6) || '-ADV', 'cleared', 'approved', true from payment_plans where consumer_id='${s.b.c}' order by created_at desc limit 1`);

// ---------- Q13: a receipt that is not cleared is not money ----------
for (const [label, upTo, method] of [['pending', 0, 'neft'], ['authorized', 1, 'neft'], ['deposited cheque', 2, 'cheque']]) {
  const s = await fresh('A' + upTo);
  const r = method === 'cheque' ? await cheque(s.b, 400000, upTo) : await (async () => { const x = await post(s.b, 400000); if (upTo >= 1) await approve(rid(x)); return x; })();
  t(`${label} Rs 4,00,000 is recorded`, r.s === 201, r.s + JSON.stringify(r.j).slice(0, 120));
  t(`${label}: instalment 1 is not paid`, demandStatus(s, 1) !== 'paid', demandStatus(s, 1));
  t(`${label}: the demand list shows nothing paid`, (await totalPaid(s)) === 0, String(await totalPaid(s)));
  t(`${label}: no ADV row is made from uncleared money`, advRows(s) === 0, String(advRows(s)));
  t(`${label}: the ledger shows received 0 and the full instalment outstanding`, (await ledger(s, 'customer-balance', 'total_received')) === 0 && (await ledger(s, 'customer-balance', 'balance')) === 315000, `${await ledger(s, 'customer-balance', 'total_received')}/${await ledger(s, 'customer-balance', 'balance')}`);
}

// ---------- cleared money: partial, paid, credit, no ADV ----------
{
  const s = await fresh('B1'); await cleared(s.b, 100000);
  t('cleared Rs 1,00,000 of Rs 3,15,000: instalment 1 is partial', demandStatus(s, 1) === 'partial', demandStatus(s, 1));
  t('cleared part payment: the demand list shows 1,00,000 paid', (await totalPaid(s)) === 100000, String(await totalPaid(s)));
  t('cleared part payment: the ledger shows received 1,00,000', (await ledger(s, 'customer-balance', 'total_received')) === 100000);
}
{
  const s = await fresh('B2'); const x = await cleared(s.b, 400000);
  t('cleared Rs 4,00,000: the clear is accepted', x.c.s === 200, x.c.s);
  t('cleared overpayment: instalment 1 is paid', demandStatus(s, 1) === 'paid', demandStatus(s, 1));
  t('cleared overpayment: instalment 2 is not touched', demandStatus(s, 2) !== 'paid' && demandStatus(s, 2) !== 'partial', demandStatus(s, 2));
  t('cleared overpayment: no ADV row is made', advRows(s) === 0, String(advRows(s)));
  t('cleared overpayment: the excess Rs 85,000 is customer credit (the pending Rs 10,000 booking receipt is not money)', (await ledger(s, 'customer-dues', 'credit_amount')) === 85000, String(await ledger(s, 'customer-dues', 'credit_amount')));
  t('cleared overpayment: the dashboard collection equals Project Collection', (await dashCollected(s)) === 400000 && (await projectCollection(s)) === 400000, `${await dashCollected(s)}/${await projectCollection(s)}`);
}
{
  const s = await fresh('B3'); await cleared(s.b, 700000);
  t('cleared Rs 7,00,000: instalment 1 paid, instalment 2 not paid, credit Rs 3,85,000, no ADV row', demandStatus(s, 1) === 'paid' && demandStatus(s, 2) !== 'paid' && (await ledger(s, 'customer-dues', 'credit_amount')) === 385000 && advRows(s) === 0, `${demandStatus(s, 1)}/${demandStatus(s, 2)}/${await ledger(s, 'customer-dues', 'credit_amount')}/${advRows(s)}`);
}

// ---------- D8: bounce and cancel keep raised_at and due_date ----------
{
  const s = await fresh('C1'); const before = d1(s);
  t('instalment 1 is raised by the first receipt (D2)', before[0] === 'demanded' && before[1] !== '', before.join('|'));
  const r = await cheque(s.b, 400000, 2); const bo = await bounce(rid(r));
  t('bounce of a deposited cheque is accepted', bo.s === 200, bo.s + JSON.stringify(bo.j).slice(0, 100));
  const after = d1(s);
  t('bounce: raised_at and due_date are unchanged (D8)', after[1] === before[1] && after[2] === before[2], `${before.join('|')} -> ${after.join('|')}`);
  t('bounce: instalment 1 is demanded and the full amount is outstanding', after[0] === 'demanded' && (await ledger(s, 'customer-balance', 'balance')) === 315000, `${after[0]}/${await ledger(s, 'customer-balance', 'balance')}`);
}
{
  const s = await fresh('C2'); const before = d1(s);
  const r = await post(s.b, 400000); const ca = await cancel(rid(r));
  t('cancel of a pending receipt is accepted', ca.s === 200, ca.s);
  const after = d1(s);
  t('cancel: raised_at and due_date are unchanged (D8)', after[1] === before[1] && after[2] === before[2], `${before.join('|')} -> ${after.join('|')}`);
  t('cancel: instalment 1 is demanded, outstanding is the full amount', after[0] === 'demanded' && (await ledger(s, 'customer-balance', 'balance')) === 315000, `${after[0]}/${await ledger(s, 'customer-balance', 'balance')}`);
}

// ---------- decision 3: a cleared receipt is never bounced or cancelled ----------
{
  const s = await fresh('D1'); const x = await cleared(s.b, 400000);
  const ca = await cancel(rid(x.r)); t('cancel of a cleared receipt -> 409', ca.s === 409 && psql(`select status from receipts where id='${rid(x.r)}'`) === 'cleared', ca.s + JSON.stringify(ca.j).slice(0, 100));
  const bo = await bounce(rid(x.r)); t('bounce of a cleared receipt -> 409', bo.s === 409, bo.s + JSON.stringify(bo.j).slice(0, 100));
  t('the cleared receipt stays cleared and instalment 1 stays paid', psql(`select status from receipts where id='${rid(x.r)}'`) === 'cleared' && demandStatus(s, 1) === 'paid');
}

// ---------- surrender and dashboard never count ADV copies (legacy rows stay in the database) ----------
{
  const s = await fresh('E1'); await cleared(s.b, 400000); legacyClearedAdv(s, 95000);
  const cash = num(psql(`select coalesce(sum(amount_received_inr),0) from receipts where consumer_id='${s.b.c}' and status='cleared' and not coalesce(is_advance,false)`));
  t('legacy cleared ADV row exists next to Rs 4,00,000 of real cash', cash === 400000 && num(psql(`select coalesce(sum(amount_received_inr),0) from receipts where consumer_id='${s.b.c}' and status='cleared' and is_advance`)) === 95000);
  t('dashboard collection ignores the legacy ADV row', (await dashCollected(s)) === 400000, String(await dashCollected(s)));
  const r1 = await surrender(s, { refundAmount: cash + 95000 });
  t('surrender refund above eligible cash (counting the ADV row) is refused', r1.s === 400, r1.s + JSON.stringify(r1.j).slice(0, 120));
  const r2 = await surrender(s, { forfeitureAmount: cash, refundAmount: 95000 });
  t('forfeiture + refund above eligible cash is refused', r2.s === 400, r2.s + JSON.stringify(r2.j).slice(0, 120));
  const r3 = await surrender(s, { refundAmount: cash + 1 });
  t('the existing Rs 1 tolerance still accepts cash + 1', r3.s === 201, r3.s + JSON.stringify(r3.j).slice(0, 120));
}

console.log(`\nRESULT: ${tally()}`);
process.exit(/ 0 failed/.test(tally()) ? 0 : 1);
