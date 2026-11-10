// Defects found in the S5 QA batches that need no policy decision: the interest save route takes the same role as the scheduler's save (DEF-12), the unit status
// history is complete and not duplicated (DEF-15), the Leads Source filter works (DEF-16), a name-and-mobile applicant can be rebooked on the same project (DEF-18),
// a cancelled booking prints no receipt (DEF-19), a name-only applicant has a first and last name (DEF-20), and unknown or out-of-range input is told clearly (DEF-22).
// Run against a local test API (psql must reach the same database).
import * as L from '../receipt-allocation/lib.mjs';
const { psql, today, U, t, tally } = L;
const E = await L.env();
const P = await L.project(E, { tag: 'SF' });

{ // DEF-12
  const b = await L.booking(E, P, {}); const plan = psql(`select id from payment_plans where consumer_id='${b.c}' order by created_at desc limit 1`);
  psql(`update demands set status='demanded', raised_at=now(), due_date=(now() at time zone 'Asia/Kolkata')::date - 30 where payment_plan_id='${plan}' and installment_index=1`);
  const before = psql(`select count(*) from penal_interests where consumer_id='${b.c}'`);
  const pm = await E.PM('POST', `/payments/consumer-interest-detail/${b.c}`, {});
  t('S1: a project manager cannot save interest through consumer-interest-detail (403), like the scheduler save', pm.s === 403 && psql(`select count(*) from penal_interests where consumer_id='${b.c}'`) === before, pm.s);
  const af = await E.AF('POST', `/payments/consumer-interest-detail/${b.c}`, {});
  t('S1b: accounts finance still can', af.s === 200, af.s + ' ' + JSON.stringify(af.j).slice(0, 80)); }
{ // DEF-15
  const b = await L.booking(E, P, {}); const h = psql(`select string_agg(previous_status||'>'||new_status, ',' order by changed_at, id) from unit_status_history where unit_id='${b.u}'`);
  t('S2: the unit history is available>locked then locked>booked, with no duplicate row', h === 'available>locked,locked>booked', h); }
{ // DEF-16
  const pr = await L.project(E, { tag: 'SF2' }); const a = await E.A('POST', '/consumers', { name: 'Src One', mobile: '9' + String(Math.random()).slice(2, 11), project_id: pr.proj, source_of_enquiry: 'Walk In' });
  await L.applicant(E, pr, 'Src2');
  const all = await E.A('GET', `/consumers?projectId=${pr.proj}`), none = await E.A('GET', `/consumers?projectId=${pr.proj}&leadSource=zzz-${U}`), one = await E.A('GET', `/consumers?projectId=${pr.proj}&leadSource=walk_in`);
  const n = (r) => (r.j?.data ?? []).length;
  t('S3: the Leads Source filter narrows the list (unknown source: none; walk_in: the one that has it)', a.s === 201 && n(all) === 2 && n(none) === 0 && n(one) === 1, `${a.s} all ${n(all)} none ${n(none)} walk_in ${n(one)}`); }
{ // DEF-18
  const pr = await L.project(E, { tag: 'SF3' }); const u = await L.unit(E, pr, {}); const c = (await E.A('POST', '/consumers', { name: `NoProj ${U}`, mobile: '9' + String(Math.random()).slice(2, 11) })).j.data.id;
  const bk = (proj, unit) => E.A('POST', '/booking', { consumer_id: c, project_id: proj, unit_id: unit, selected_plan_name: pr.planName, booking_date: today(), booking_amount: 10000, payment_mode: 'cash' });
  const b1 = await bk(pr.proj, u); await E.A('POST', `/booking/${b1.j.data.id}/cancel`, { reason: 'SF3' }); const b2 = await bk(pr.proj, u);
  t('S4: name-and-mobile applicant: book, cancel, rebook on the same project all succeed', b1.s === 201 && b2.s === 201, `${b1.s} ${b2.s} ${JSON.stringify(b2.j).slice(0, 80)}`);
  t('S4b: the project is now stored on the applicant', psql(`select project_id::text from consumers where id='${c}'`) === pr.proj);
  await E.A('POST', `/booking/${b2.j.data.id}/cancel`, { reason: 'SF3b' });
  const other = await L.project(E, { tag: 'SF3b' }); const u2 = await L.unit(E, other, {});
  const b3 = await E.A('POST', '/booking', { consumer_id: c, project_id: other.proj, unit_id: u2, selected_plan_name: other.planName, booking_date: today(), booking_amount: 10000, payment_mode: 'cash' });
  t('S4c: a booking on a different project is still refused (409)', b3.s === 409, b3.s); }
{ // DEF-19
  const pr = await L.project(E, { tag: 'SF4' }); const b = await L.booking(E, pr, { complete: false }); await E.A('POST', `/booking/${b.id}/cancel`, { reason: 'SF4' });
  const tok = await L.login('super_admin@test.local'); const r = await fetch(`${L.B}/booking/${b.id}/receipt-html`, { headers: { authorization: 'Bearer ' + (tok?.token ?? tok) } });
  t('S5: the receipt page of a cancelled booking is refused (409)', r.status === 409, r.status); }
{ // DEF-20
  const c = await E.A('POST', '/consumers', { name: 'Solo Name Person', mobile: '9' + String(Math.random()).slice(2, 11), project_id: P.proj });
  const r = psql(`select coalesce(first_name,'NULL')||'|'||coalesce(last_name,'NULL') from consumers where id='${c.j.data.id}'`);
  t('S6: a name given alone also fills first and last name', r === 'Solo|Name Person', r);
  const one = await E.A('POST', '/consumers', { name: 'Madonna', mobile: '9' + String(Math.random()).slice(2, 11), project_id: P.proj });
  t('S6b: a single word is the first name, last name stays empty', psql(`select coalesce(first_name,'NULL')||'|'||coalesce(last_name,'NULL') from consumers where id='${one.j.data.id}'`) === 'Madonna|NULL'); }
{ // DEF-22
  const u = await L.unit(E, P, {}); const c = await L.applicant(E, P, 'D22');
  const d = await E.A('POST', '/booking', { consumer_id: c, project_id: P.proj, unit_id: u, selected_plan_name: P.planName, booking_date: today(), booking_amount: 10000, payment_mode: 'cash', discount_value: -1000 });
  t('S7: an unused field discount_value is refused with a clear message (400)', d.s === 400 && /discount_value/.test(JSON.stringify(d.j)), d.s + ' ' + JSON.stringify(d.j).slice(0, 100));
  const b = await L.booking(E, P, {}); const m = [];
  for (const dt of ['1900-01-01', '2999-12-31']) { const r = await E.A('POST', '/payments/receipts', { consumerId: b.c, bookingId: b.id, amountReceivedInr: 1000, paymentMode: 'neft', referenceNumber: `SF${U}${dt.slice(0, 4)}`, paymentDate: dt }); m.push(r.s + ' ' + (r.j?.error || '')); }
  t('S7b: a date outside 1990-2100 says it is out of range', m.every((x) => x.startsWith('400') && /out of range/.test(x)), m.join(' | '));
  const bad = await E.A('POST', '/payments/receipts', { consumerId: b.c, bookingId: b.id, amountReceivedInr: 1000, paymentMode: 'neft', referenceNumber: `SF${U}x`, paymentDate: '2026-02-30' });
  t('S7c: an impossible date still says it is not a real date', bad.s === 400 && /real date/.test(bad.j?.error || ''), bad.s + ' ' + bad.j?.error); }

{ // DEF-21 / decision 14
  const pr = await L.project(E, { tag: 'SF5' }); const b = await L.booking(E, pr, {});
  const cb = await E.A('GET', `/reports/customer-balance?projectId=${pr.proj}`), ds = await E.A('GET', `/reports/customer-due-summary?projectId=${pr.proj}`);
  const a = (cb.j?.data ?? []).find((x) => x.consumer_id === b.c)?.total_cost, d = (ds.j?.data ?? []).find((x) => x.consumer_id === b.c)?.total_cost_with_gst;
  t('S8: total cost with GST is the same in the balance report and the due summary', a !== undefined && Number(a) === Number(d), `balance ${a} due-summary ${d}`); }

console.log(`\nRESULT: ${tally()}`);
process.exit(/ 0 failed/.test(tally()) ? 0 : 1);
