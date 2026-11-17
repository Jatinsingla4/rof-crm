// QA report of 17 November 2026: regression tests for what could be reproduced from the code.
//  QA-007 Interest Summary PAID is the cleared money only (it printed the total interest as paid)
//  QA-001 a GST gap between the booking rate and the schedule is called "Rounding" only when it is within 1 rupee per instalment
//  QA-016 First Name search filters (the tab sent "name", which the API ignored), and the list returns the unit type
//  QA-012 a cancelled booking is not listed on Demand Status
//  QA-013 Customer Wise Balance says how much cleared money is outside its rows (cancelled booking / no plan)
// Run against a local test API:  BASE=http://localhost:3097/api node api-test-qa17.mjs   (psql must reach the same database)
import { env, project, booking, receipt, psql, t, tally } from '../receipt-allocation/lib.mjs';

const E = await env(); const P = await project(E, { tag: 'Q17' });
const num = (s) => Number(String(s ?? '').replace(/[^0-9.\-]/g, '')) || 0;

// ---- QA-007 + QA-001: the applicant file of a booking that has no cleared receipt ----
const b = await booking(E, P, { price: 3000000 });
psql(`update demands set raised_at = now(), due_date = (now() at time zone 'Asia/Kolkata')::date - 40 where consumer_id = '${b.c}' and installment_index = 1 and status <> 'cancelled'`);
const file = async () => (await E.A('GET', `/consumers/${b.c}/applicant-file`)).txt || '';
let html = await file();
t('applicant file opens (200 html)', /Interest Summary/.test(html), html.slice(0, 120));
const cells = (h) => ((/Interest Summary[\s\S]*?<tbody><tr>([\s\S]*?)<\/tr>/.exec(h) || [])[1] || '').split(/<\/td>/).map((c) => num(c.replace(/<[^>]*>/g, ''))).slice(0, 6);
let [totalI, waived, paidI, , , balI] = cells(html);
const cleared = num(psql(`select coalesce(sum(interest_amount),0) from receipts where consumer_id = '${b.c}' and status = 'cleared'`));
t('precondition: this booking owes interest (an overdue unpaid instalment), so PAID = 0 is a real check', totalI > 0, `total interest ${totalI}`);
t('interest PAID equals the interest on cleared receipts (0 here), not the total interest', paidI === cleared && paidI === 0, `total ${totalI} paid ${paidI} cleared ${cleared}`);
t('interest BALANCE = total - waived - paid', Math.abs(balI - Math.max(0, totalI - waived - paidI)) < 0.011, `${balI} vs ${totalI}-${waived}-${paidI}`);

// a GST gap of 800 on one instalment is a real difference, not rounding; a 1 rupee gap is rounding
const dem = psql(`select id from demands where consumer_id = '${b.c}' and status <> 'cancelled' order by installment_index limit 1`);
psql(`update demands set cgst_amount = cgst_amount + 800 where id = '${dem}'`);
html = await file();
t('QA-001: an 800 GST gap is labelled DIFFERENCE, NOT ROUNDING', /DIFFERENCE, NOT ROUNDING/.test(html) && !/Rounding \(tax billed/.test(html));
psql(`update demands set cgst_amount = cgst_amount - 800 where id = '${dem}'`);
html = await file();
t('QA-001: with the schedule GST back, the gap is not called a difference', !/DIFFERENCE, NOT ROUNDING/.test(html));

// ---- QA-016: first name search and unit type ----
const tag = 'Zorvak' + Math.random().toString(36).slice(2, 6);
const mob = () => '9' + String(Math.random()).slice(2, 11);
const c1 = await E.A('POST', '/consumers', { name: `${tag} Alpha`, mobile: mob(), project_id: P.proj });
await E.A('POST', '/consumers', { name: `Other Person`, mobile: mob(), project_id: P.proj });
let r = await E.A('GET', `/consumers?projectId=${P.proj}&firstName=${tag}&pageSize=100`);
t('first name filter: only the matching customer comes back', r.s === 200 && r.j.data.length === 1 && r.j.data[0].id === c1.j?.data?.id, r.s + ' ' + (r.j?.data || []).length);
r = await E.A('GET', `/consumers?projectId=${P.proj}&firstName=Xyzqqq${tag}&pageSize=100`);
t('first name filter: no match gives an empty list, not everyone', r.s === 200 && r.j.data.length === 0 && r.j.pagination.total === 0, r.s + ' ' + (r.j?.data || []).length);
r = await E.A('GET', `/consumers?projectId=${P.proj}&firstName=${tag.toLowerCase()}&pageSize=100`);
t('first name filter: case-insensitive', r.s === 200 && r.j.data.length === 1, (r.j?.data || []).length);
const bn = psql(`select name from consumers where id = '${b.c}'`);
r = await E.A('GET', `/consumers?projectId=${P.proj}&firstName=${encodeURIComponent(bn.split(' ')[0])}&lastName=${encodeURIComponent(bn.split(' ').slice(-1)[0])}&pageSize=100`);
const row = (r.j?.data || []).find((x) => x.id === b.c);
t('the list row of a booked customer carries the unit type (the Type column was always a dash)', !!row && (!row.unit_number || row.bhk_type === '2BHK'), JSON.stringify(row && { u: row.unit_number, t: row.bhk_type }));

// ---- QA-012: a cancelled booking is not on Demand Status ----
const q = () => E.A('GET', `/payments/demand-status?project_id=${P.proj}&name=${encodeURIComponent(bn)}&limit=50`);
r = await q();
t('demand status lists the live booking', r.s === 200 && (r.j.data || []).some((x) => x.consumer_id === b.c), r.s + ' ' + (r.j?.data || []).length);
psql(`update booking_records set status = 'cancelled' where id = '${b.id}'`);
r = await q();
t('demand status no longer lists it once cancelled', r.s === 200 && !(r.j.data || []).some((x) => x.consumer_id === b.c), (r.j?.data || []).length);

// ---- QA-013: Customer Wise Balance shows the cleared money that is not in its rows ----
const P2 = await project(E, { tag: 'Q17B' });
const b2 = await booking(E, P2, { price: 2000000 }); await receipt(E, b2, 50000);
psql(`update booking_records set status = 'cancelled' where id = '${b2.id}'`);
const expected = num(psql(`select coalesce(sum(r.amount_received_inr),0) from receipts r join consumers c on c.id = r.consumer_id where c.project_id = '${P2.proj}' and r.status = 'cleared' and r.is_advance is not true and not exists (select 1 from booking_records br where br.consumer_id = c.id and br.status in ('complete','pending_payment','active'))`));
r = await E.A('GET', `/reports/customer-balance?projectId=${P2.proj}`);
t('customer balance: the cleared money of the cancelled booking is reported outside the rows', r.s === 200 && expected >= 50000 && Math.abs(num(r.j.summary?.receivedNotInRows) - expected) < 0.011, `${r.j?.summary?.receivedNotInRows} vs ${expected}`);
t('customer balance: no row for the cancelled booking', r.s === 200 && !(r.j.data || []).some((x) => x.consumer_id === b2.c), (r.j?.data || []).length);

console.log(tally());
process.exit(0);
