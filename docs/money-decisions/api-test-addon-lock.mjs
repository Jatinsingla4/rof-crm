// Owner decision U3: while a customer has an unresolved receipt (pending, authorized, deposited or on hold), the customer's add-on charges cannot be added,
// edited, cancelled or waived (409 naming the receipt); once the receipt is settled they can.  A cancelled or bounced receipt is settled.
// Run against a local test API (psql must reach the same database).
import * as L from '../receipt-allocation/lib.mjs';
const { psql, today, U, t, tally } = L;
const E = await L.env();
const P = await L.project(E, { tag: 'AL', plan: [10, 20, 30, 40] });
const b = await L.booking(E, P, { price: 3000000, carpet: 500 });
const open = () => psql(`select count(*) from receipts where consumer_id='${b.c}' and status in ('pending','authorized','deposited','on_hold') and is_advance is not true`);
const add = (name) => E.A('POST', '/addon-charges/consumer', { consumerId: b.c, projectId: P.proj, chargeName: name, amount: 1000, cgstPct: 9, sgstPct: 9 });

t('A0: the confirmed booking has its booking receipt still pending', open() === '1', open());
const x = await add('Lock ' + U);
t('A1: an add-on cannot be added while a receipt is unresolved (409, names the receipt)', x.s === 409 && /unresolved/.test(JSON.stringify(x.j)) && /REC-/.test(JSON.stringify(x.j)), x.s + ' ' + JSON.stringify(x.j).slice(0, 140));
const rid = psql(`select id from receipts where consumer_id='${b.c}' and status='pending' limit 1`);
await E.C('PATCH', `/payments/receipts/${rid}/approve`, {});
const x2 = await add('Lock ' + U);
t('A2: an authorized receipt still blocks it (409)', x2.s === 409, x2.s);
await E.C('PATCH', `/payments/receipts/${rid}/clear`, { clearing_date: today() });
t('A3: no receipt is unresolved after the checker cleared it', open() === '0', open());
const ok = await add('Lock ' + U); const id = ok.j?.data?.id;
t('A4: once the receipt is settled the add-on can be added (201)', ok.s === 201 && !!id, ok.s + ' ' + JSON.stringify(ok.j).slice(0, 120));
const r2 = await L.receipt(E, b, 5000, { clear: false }); const r2id = r2.j.data.id;
const e = await E.A('PATCH', `/addon-charges/consumer/${id}`, { amount: 2000 }), c = await E.A('PATCH', `/addon-charges/consumer/${id}/cancel`, {}), w = await E.A('PATCH', `/addon-charges/consumer/${id}/waive`, { waiveRemark: 'x' });
t('A5: with a new pending receipt, edit, cancel and waive-off are all refused (409)', e.s === 409 && c.s === 409 && w.s === 409, `${e.s} ${c.s} ${w.s}`);
await E.A('POST', `/payments/receipts/${r2id}/cancel`, { reason: 'A6' });
const e2 = await E.A('PATCH', `/addon-charges/consumer/${id}`, { amount: 2000 });
t('A6: a withdrawn (cancelled) receipt no longer blocks: the edit works (200)', e2.s === 200, e2.s + ' ' + JSON.stringify(e2.j).slice(0, 100));

console.log(`\nRESULT: ${tally()}`);
process.exit(/ 0 failed/.test(tally()) ? 0 : 1);
