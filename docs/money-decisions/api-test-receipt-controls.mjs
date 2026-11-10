// Owner decision D-RECEIPTCTRL: "authorized" means approved (approval_status = approved), the creator may withdraw a pending receipt, a checker may reject it,
// cancelling an authorized receipt needs another authorised user and a reason, deposit/hold/release are never by the creator, a pending receipt cannot be
// cleared directly, the creator cannot clear their own receipt, a cleared receipt is never cancelled (the return workflow handles it).
// Run against a local test API (psql must reach the same database).
import * as L from '../receipt-allocation/lib.mjs';
const { psql, today, U, t, tally } = L;
const E = await L.env();
const hash = psql(`select password_hash from users where email='super_admin@test.local'`);
const mkUser = (tag, role, maker, checker) => { const e = `rc_${tag}_${U}@test.local`; psql(`insert into users (email,name,role,password_hash,is_active,username) values ('${e}','RC ${tag} ${U}','${role}','${hash}',true,'rc${tag}${U}')`); const id = psql(`select id from users where email='${e}'`); psql(`insert into user_process_permissions (user_id, process_name, is_maker, is_checker, is_approver) values ('${id}','receipt',${maker},${checker},false)`); return { e, id }; };
const maker = mkUser('m', 'accounts_finance', true, false), checker = mkUser('k', 'accounts_finance', false, true);
const M = L.caller(await L.login(maker.e)), K = L.caller(await L.login(checker.e));
const P = await L.project(E, { tag: 'RC', plan: [10, 20, 30, 40] });
const b = await L.booking(E, P, { price: 3000000, carpet: 500 });
let n = 0;
const mk = (who, amount = 20000) => who('POST', '/payments/receipts', { consumerId: b.c, bookingId: b.id, amountReceivedInr: amount, paymentMode: 'neft', referenceNumber: `RC${U}${++n}${Math.random().toString(36).slice(2, 6)}`, paymentDate: today() });
const st = (id) => psql(`select status||'|'||coalesce(approval_status,'') from receipts where id='${id}'`);

{ const r = await mk(M); const id = r.j.data.id; const a = await E.C('PATCH', `/payments/receipts/${id}/approve`, {});
  t('R1: approving sets status authorized AND approval_status approved', a.s === 200 && st(id) === 'authorized|approved', a.s + ' ' + st(id));
  const e = await M('PATCH', `/payments/receipts/${id}`, { bankName: 'X' });
  t('R1b: an approved receipt can no longer be edited', e.s === 403, e.s); }
{ const r = await mk(M); const id = r.j.data.id; const w = await M('POST', `/payments/receipts/${id}/cancel`, {});
  t('R2: the creator withdraws their own pending receipt (no reason needed, audited)', w.s === 200 && st(id).startsWith('cancelled'), w.s + ' ' + st(id));
  t('R2b: the withdrawal is written to the financial audit log', Number(psql(`select count(*) from financial_audit_logs where action_type='RECEIPT_CANCEL' and remarks like 'withdrawn by its creator%' and consumer_id='${b.c}'`)) >= 1); }
{ const r = await mk(M); const id = r.j.data.id;
  const x1 = await K('POST', `/payments/receipts/${id}/cancel`, {});
  t('R3: a checker rejecting a pending receipt must give a reason (400)', x1.s === 400, x1.s);
  const x2 = await K('POST', `/payments/receipts/${id}/cancel`, { reason: 'wrong amount' });
  t('R3b: a checker rejects a pending receipt with a reason', x2.s === 200 && st(id).startsWith('cancelled'), x2.s + ' ' + st(id)); }
{ const r = await mk(M); const id = r.j.data.id; const af = L.caller(await L.login('accounts_finance@test.local'));
  const x = await af('POST', `/payments/receipts/${id}/cancel`, { reason: 'no right' });
  t('R4: a user with payment access but no receipt checker right cannot reject or cancel (403)', x.s === 403, x.s + ' ' + JSON.stringify(x.j).slice(0, 80)); }
{ const r = await mk(M); const id = r.j.data.id; await E.C('PATCH', `/payments/receipts/${id}/approve`, {});
  const own = await M('POST', `/payments/receipts/${id}/cancel`, { reason: 'mine' });
  t('R5: the creator cannot cancel their own authorized receipt (403)', own.s === 403, own.s);
  const nr = await K('POST', `/payments/receipts/${id}/cancel`, {});
  t('R5b: cancelling an authorized receipt needs a reason (400)', nr.s === 400, nr.s);
  const ok = await K('POST', `/payments/receipts/${id}/cancel`, { reason: 'duplicate entry' });
  t('R5c: another authorised user cancels an authorized receipt with a reason', ok.s === 200 && st(id).startsWith('cancelled'), ok.s + ' ' + st(id)); }
{ const r = await mk(E.A); const id = r.j.data.id; await E.C('PATCH', `/payments/receipts/${id}/approve`, {});
  const d = await E.A('PATCH', `/payments/receipts/${id}/deposit`, { deposit_date: today() });
  t('R6: the creator cannot deposit their own receipt (403, super admin included)', d.s === 403, d.s);
  const h = await E.A('PATCH', `/payments/receipts/${id}/hold`, { hold_remark: 'x' });
  t('R6b: the creator cannot hold their own receipt (403)', h.s === 403, h.s);
  const dd = await E.C('PATCH', `/payments/receipts/${id}/deposit`, { deposit_date: today() });
  const hh = await E.C('PATCH', `/payments/receipts/${id}/hold`, { hold_remark: 'bank query' });
  const rr = await E.A('PATCH', `/payments/receipts/${id}/release-hold`, {});
  t('R6c: the creator cannot release a hold either (403)', rr.s === 403, rr.s);
  const ro = await E.C('PATCH', `/payments/receipts/${id}/release-hold`, {});
  t('R6d: another user deposits, holds and releases; an authorized receipt returns to authorized', dd.s === 200 && hh.s === 200 && ro.s === 200 && st(id) === 'authorized|approved', [dd.s, hh.s, ro.s, st(id)].join(' ')); }
{ const r = await mk(E.A); const id = r.j.data.id;
  const c0 = await E.C('PATCH', `/payments/receipts/${id}/clear`, { clearing_date: today() });
  t('R7: a pending receipt cannot be cleared directly (409)', c0.s === 409 || c0.s === 400, c0.s + ' ' + JSON.stringify(c0.j).slice(0, 100));
  await E.C('PATCH', `/payments/receipts/${id}/approve`, {});
  const own = await E.A('PATCH', `/payments/receipts/${id}/clear`, { clearing_date: today() });
  t('R7b: the creator cannot clear their own authorized receipt (403)', own.s === 403, own.s);
  const ok = await E.C('PATCH', `/payments/receipts/${id}/clear`, { clearing_date: today() });
  t('R7c: another checker clears the authorized receipt', ok.s === 200 && st(id).startsWith('cleared'), ok.s + ' ' + st(id));
  const cn = await E.C('POST', `/payments/receipts/${id}/cancel`, { reason: 'try' });
  t('R7d: a cleared receipt is never cancelled (409)', cn.s === 409, cn.s); }
{ // a receipt that was held while still pending keeps no authorisation, so it cannot be cleared from the hold
  const r = await mk(E.A); const id = r.j.data.id; await E.C('PATCH', `/payments/receipts/${id}/hold`, { hold_remark: 'x' });
  const c0 = await E.C('PATCH', `/payments/receipts/${id}/clear`, { clearing_date: today() });
  t('R8: a receipt held while pending cannot be cleared from the hold without being authorized (409)', c0.s === 409, c0.s);
  const rel = await E.C('PATCH', `/payments/receipts/${id}/release-hold`, {});
  t('R8b: releasing a never-authorized receipt returns it to pending', rel.s === 200 && st(id).startsWith('pending'), rel.s + ' ' + st(id)); }
t('R9: no receipt was authorized by the user who recorded it', psql(`select count(*) from receipts where authorized_by is not null and authorized_by = received_by_user_id`) === '0');

console.log(`\nRESULT: ${tally()}`);
process.exit(/ 0 failed/.test(tally()) ? 0 : 1);
