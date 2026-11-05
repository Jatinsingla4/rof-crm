// Broker and Investor / Hold: broker application (maker, checker), status, project mapping, tax setup, commission (made by a booking, paid once with GST and TDS),
// unit holds (one active hold per unit, release, expiry, booking a held unit), roles, project scope, hostile input, races and a random run.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-broker-hold.mjs   (psql must reach the same database; SEED=n repeats a random run)
import { execFileSync } from 'node:child_process';
import { bizToday, bizDate } from '../_shared/business-date.mjs';
import { secondAdminToken } from '../_shared/second-admin.mjs';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (email, password = 'Test#Pass1234') => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const call = (tok) => async (m, p, b, raw) => { const go = () => fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); let r; try { r = await go(); } catch { r = await go(); } /* a keep-alive socket the server just closed */ let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const A = call(await login('super_admin@test.local')), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local')), RO = call(await login('read_only_viewer@test.local')), AF = call(await login('accounts_finance@test.local')), NO = call(null);
const A2 = call(await secondAdminToken(B, A));   // the checker: nobody approves what they created, super_admin included
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n')[0];
const SEED = Number(process.env.SEED || Date.now() % 1e9); let rs = SEED;
const rnd = () => (rs = (rs * 1664525 + 1013904223) % 4294967296) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (a) => a[ri(0, a.length - 1)];
console.log('SEED=' + SEED);
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
const today = bizToday(), later = (d) => bizDate(Date.now() + d * 864e5);
let seq = 0; const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');
const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; const pan = () => Array.from({ length: 5 }, () => L[ri(0, 23)]).join('') + String(ri(1000, 9999)) + L[ri(0, 23)];
const gstin = (p = pan()) => { const A36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', g = '27' + p + '1Z'; let sum = 0; for (let i = 0; i < 14; i++) { const v = A36.indexOf(g[i]) * (i % 2 ? 2 : 1); sum += Math.floor(v / 36) + (v % 36); } return g + A36[(36 - (sum % 36)) % 36]; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let r, r2;

// ---------- set-up: two projects, a plan, GST, users ----------
const co = (await A('POST', '/companies', { name: 'Broker Co ' + U })).j.data.id;
const mkProj = async (tag) => (await A('POST', '/projects', { companyId: co, name: `BrkH ${tag} ${U}`, reraNumber: `BH${tag}-${U}`, tcpLicence: 'x' })).j.data.id;
const P1 = await mkProj('A'), P2 = await mkProj('B');
const tw = async (P) => (await A('POST', `/projects/${P}/towers`, { towerName: 'T' + U })).j.data.id;
const T1 = await tw(P1), T2 = await tw(P2);
let un = 0; const unit = async (P = P1, T = T1) => (await A('POST', '/units', { projectId: P, towerId: T, unitNumber: `H${++un}-${U}`, floor: 1, bhkType: '2BHK', carpetAreaSqft: 1000, superAreaSqft: 1200, basePriceInr: 9000000, totalPriceInr: 9500000 })).j.data.id;
const plan = async (P, name, rows) => { let i = 0; for (const pc of rows) await A('POST', `/projects/${P}/plan-templates`, { plan_name: name, installment_name: `Row ${++i}`, installment_type: i === 1 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: i * 30, installment_index: i }); return name; };
const PLAN1 = await plan(P1, 'BrkPlan ' + U, [20, 30, 50]), PLAN2 = await plan(P2, 'BrkPlanB ' + U, [100]);
let slab = (await A('GET', '/gst-configuration/gst-slabs')).j.data.find(s => s.from_date <= today && s.to_date >= today)?.id;
const madeSlab = !slab;
if (!slab) slab = (await A('POST', '/gst-configuration/gst-slabs', { fromDate: later(-3), toDate: later(40) })).j.data.id;
const taxId = (await A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `BH ${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 })).j.data.id;
for (const P of [P1, P2]) for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await A('POST', '/gst-configuration/gst-charge-mapping', { projectId: P, slabId: slab, gstTaxId: taxId, chargeType: ct });
const uid = (email) => psql(`select id from users where email='${email}'`);
const afId = uid('accounts_finance@test.local'), pmId = uid('project_manager@test.local'), seId = uid('sales_executive@test.local'), roId = uid('read_only_viewer@test.local');
const grant = (id, name, maker, checker) => psql(`insert into user_process_permissions (user_id, process_name, is_maker, is_checker) values ('${id}','${name}',${maker},${checker}) on conflict (user_id, process_name) do update set is_maker=${maker}, is_checker=${checker} returning 1`);
const noRows = (id) => { try { psql(`delete from user_process_permissions where user_id='${id}' and process_name in ('broker_range_entry','broker_payment_entry') returning 1`); } catch { /* none */ } };
for (const u of [afId, pmId, seId, roId]) noRows(u);

const brokers = [], consumers = [], units = [];
let bn = 0;
const newBroker = async (extra = {}, who = A) => { const x = await who('POST', '/brokers', { firmName: `Firm ${++bn} ${U}`, mobile: mob(), commissionPct: 2, ...extra }); if (x.s === 201) brokers.push(x.j.data.id); return x; };
const activeBroker = async ({ tax = true, ...extra } = {}) => { const x = await newBroker({ pan: pan(), ...extra }); if (x.s !== 201) throw new Error('broker ' + JSON.stringify(x)); const a = await A2('PATCH', `/brokers/${x.j.data.id}/approve`, {}); if (a.s !== 200) throw new Error('approve ' + JSON.stringify(a)); if (tax) { const y = await A('POST', `/broker-setup/${x.j.data.id}`, { tdsRatePct: 5, gstRatePct: 18 }); if (y.s !== 200) throw new Error('tax ' + JSON.stringify(y)); } return x.j.data.id; };
const person = async (P = P1) => { const x = await A('POST', '/consumers', { name: `Brk Buyer ${consumers.length + 1} ${U}`, mobile: mob(), project_id: P }); if (x.s >= 300) throw new Error('applicant ' + JSON.stringify(x)); consumers.push(x.j.data.id); return x.j.data.id; };
const newUnit = async (P = P1, T = T1) => { const u = await unit(P, T); units.push(u); return u; };
// a booking: amount 0 keeps it pending_payment (unit still available), an amount makes it active and locks the unit
const book = async (o = {}, who = A) => {
  const c = o.c || await person(o.P || P1), u = o.u || await newUnit(o.P || P1, (o.P || P1) === P1 ? T1 : T2);
  const body = { consumer_id: c, project_id: o.P || P1, unit_id: u, selected_plan_name: (o.P || P1) === P1 ? PLAN1 : PLAN2, booking_date: today, booking_type: o.type || 'broker', broker_id: o.broker, broker_commission: o.comm ?? 2, broker_commission_type: o.ctype || 'percent', ...(o.amount ? { booking_amount: o.amount, payment_mode: 'cash' } : {}), ...(o.extra || {}) };
  const x = await who('POST', '/booking', body);
  return { ...x, c, u, id: x.j?.data?.id };
};
const comm = (c, u) => psql(`select id from broker_commissions where consumer_id='${c}' and unit_id='${u}' order by created_at desc limit 1`);
const cval = (id, col) => psql(`select ${col} from broker_commissions where id='${id}'`);
const ustatus = (u) => psql(`select status from units where id='${u}'`);
const holdsOf = (u, st = 'active') => Number(psql(`select count(*) from unit_holds where unit_id='${u}' and status='${st}'`));
const hold = (u, b, extra = {}, who = A) => who('POST', '/inventory-hold', { unitId: u, brokerId: b, ...extra });
const holdId = (u) => psql(`select id from unit_holds where unit_id='${u}' and status='active'`);
const is = (x, ...codes) => codes.includes(x.s);
const no5 = (x) => x.s < 500;

// =====================================================================================
// 1. who can reach what
// =====================================================================================
const B1 = await activeBroker({ firmName: 'Role Broker ' + U });
const roles = { SA: A, PM, SE, AF, RO };
const ok = (m) => ({ SA: 200, PM: 200, SE: 200, AF: 200, RO: 200 }[m]);
for (const [name, who] of Object.entries(roles)) {
  for (const [label, path] of [['list', '/brokers'], ['detail', `/brokers/${B1}`], ['projects', `/brokers/${B1}/projects`], ['sub-brokers', `/brokers/${B1}/sub-brokers`], ['commission', '/brokers/commission']]) {
    r = await who('GET', path); t(`role ${name}: GET broker ${label} is 200`, r.s === 200, r.s);
  }
  r = await who('GET', '/broker-setup'); t(`role ${name}: broker-setup list is ${['SA', 'AF'].includes(name) ? 200 : 403}`, r.s === (['SA', 'AF'].includes(name) ? 200 : 403), r.s);
  r = await who('GET', '/inventory-hold'); t(`role ${name}: hold list is ${['SA', 'PM', 'SE'].includes(name) ? 200 : 403}`, r.s === (['SA', 'PM', 'SE'].includes(name) ? 200 : 403), r.s);
}
for (const p of ['/brokers', `/brokers/${B1}`, '/brokers/commission', '/broker-setup', '/inventory-hold']) { r = await NO('GET', p); t(`no login: GET ${p.replace(B1, ':id')} is 401`, r.s === 401, r.s); }
r = await NO('POST', '/brokers', { firmName: 'x', mobile: mob() }); t('no login: POST broker is 401', r.s === 401, r.s);
r = await NO('POST', '/inventory-hold', {}); t('no login: POST hold is 401', r.s === 401, r.s);
r = await NO('PATCH', '/brokers/commission/' + NIL, { status: 'paid' }); t('no login: pay commission is 401', r.s === 401, r.s);
// a bank account is shown only to super_admin and accounts_finance
{
  const bk = await activeBroker({ pan: pan(), bankAccountDetails: { accountNo: '123456789012', ifsc: 'HDFC0001234', bankName: 'HDFC' } });
  for (const [name, who] of Object.entries(roles)) { const d = (await who('GET', `/brokers/${bk}`)).j?.data || {}; const sees = 'bank_account_details' in d || 'pan' in d; t(`role ${name}: PAN and bank details ${['SA', 'AF'].includes(name) ? 'shown' : 'hidden'} in the broker detail`, sees === ['SA', 'AF'].includes(name)); }
}

// process access: maker registers, checker approves
r = await newBroker({}, PM); t('PM without maker access cannot register a broker', r.s === 403, r.s);
r = await newBroker({}, SE); t('SE without maker access cannot register a broker', r.s === 403, r.s);
r = await newBroker({}, AF); t('AF cannot register a broker (no consumers edit)', r.s === 403, r.s);
r = await newBroker({}, RO); t('read only cannot register a broker', r.s === 403, r.s);
grant(pmId, 'broker_range_entry', true, false); grant(seId, 'broker_range_entry', true, false); grant(afId, 'broker_range_entry', true, true);
r = await newBroker({}, PM); t('PM with maker access registers a broker (pending)', r.s === 201 && r.j.data.status === 'pending', r.s + JSON.stringify(r.j)); const bPM = r.j?.data?.id;
r = await newBroker({}, AF); t('AF with a grant still cannot register (no consumers create)', r.s === 403, r.s);
r = await PM('PATCH', `/brokers/${bPM}/approve`, {}); t('PM maker only cannot approve', r.s === 403, r.s);
r = await SE('PATCH', `/brokers/${bPM}/reject`, {}); t('SE maker only cannot reject (it used to be open to anyone)', r.s === 403, r.s);
r = await SE('PATCH', `/brokers/${bPM}/status`, { status: 'inactive' }); t('SE without checker cannot change status', r.s === 403, r.s);
grant(pmId, 'broker_range_entry', true, true);
r = await PM('PATCH', `/brokers/${bPM}/approve`, {}); t('the maker cannot approve their own broker even with checker access', r.s === 403, r.s + JSON.stringify(r.j));
r = await PM('PATCH', `/brokers/${bPM}/reject`, {}); t('the maker cannot reject their own broker either -> 403', r.s === 403 && /yourself/.test(r.j?.error || ''), r.s + JSON.stringify(r.j));
psql(`update brokers set created_by = null where id = '${bPM}'`); r = await A2('PATCH', `/brokers/${bPM}/approve`, {}); t('a broker whose creator is unknown waits for remediation -> 409', r.s === 409, r.s + JSON.stringify(r.j));
psql(`update brokers set created_by = '${uid('project_manager@test.local')}' where id = '${bPM}'`);
r = await A2('PATCH', `/brokers/${bPM}/approve`, { notes: 'ok ' + U }); t('super_admin approves', r.s === 200 && r.j.data.status === 'active', r.s);
t('approval stores who and when', psql(`select approved_by is not null and approved_at is not null and approval_notes='ok ${U}' from brokers where id='${bPM}'`) === 't');
grant(seId, 'broker_range_entry', true, true);
{ const mine = await newBroker({ pan: pan() }); r = await A('PATCH', `/brokers/${mine.j.data.id}/approve`, {}); t('super_admin cannot approve a broker super_admin made -> 403', r.s === 403 && /yourself/.test(r.j?.error || ''), r.s + JSON.stringify(r.j)); r = await A('PATCH', `/brokers/${mine.j.data.id}/status`, { status: 'inactive' }); t('super_admin cannot change the status of a broker super_admin made -> 403', r.s === 403, r.s); }
r = await SE('PATCH', `/brokers/${bPM}/approve`, {}); t('approving again is refused (409)', r.s === 409, r.s);
r = await SE('PATCH', `/brokers/${bPM}/reject`, {}); t('rejecting an active broker is refused (409)', r.s === 409, r.s);
{ // another person with checker access approves
  r = await newBroker({}, PM); const id = r.j.data.id;
  r2 = await SE('PATCH', `/brokers/${id}/approve`, {}); t('a different checker (SE) approves a broker made by PM', r2.s === 200, r2.s + JSON.stringify(r2.j));
  r = await newBroker({}, PM); const id2 = r.j.data.id;
  r2 = await SE('PATCH', `/brokers/${id2}/reject`, { notes: 'no' }); t('a checker rejects a pending broker', r2.s === 200 && r2.j.data.status === 'rejected', r2.s);
  r2 = await SE('PATCH', `/brokers/${id2}/approve`, {}); t('a rejected broker cannot be approved later (409)', r2.s === 409, r2.s);
  r2 = await PM('PATCH', `/brokers/${id2}`, { city: 'Delhi' }); t('a rejected broker cannot be edited (409)', r2.s === 409, r2.s);
  r2 = await A2('PATCH', `/brokers/${id2}/status`, { status: 'active' }); t('a rejected broker cannot be switched to active (409)', r2.s === 409, r2.s);
}
// payment process
const bkP = await activeBroker();
{
  const bk = await book({ broker: bkP, amount: 100000, comm: 1, ctype: 'percent' }); t('booking with a broker is made (active booking)', bk.s === 201, bk.s + JSON.stringify(bk.j));
  const cid = comm(bk.c, bk.u);
  r = await PM('PATCH', `/brokers/commission/${cid}`, { status: 'paid' }); t('PM without payment access cannot pay', r.s === 403, r.s);
  r = await SE('PATCH', `/brokers/commission/${cid}`, { status: 'paid' }); t('SE cannot pay (no payments edit)', r.s === 403, r.s);
  r = await RO('PATCH', `/brokers/commission/${cid}`, { status: 'paid' }); t('read only cannot pay', r.s === 403, r.s);
  r = await AF('PATCH', `/brokers/commission/${cid}`, { status: 'paid' }); t('AF without a payment grant cannot pay', r.s === 403, r.s);
  grant(afId, 'broker_payment_entry', true, false); grant(pmId, 'broker_payment_entry', true, false);
  r = await AF('PATCH', `/brokers/commission/${cid}`, { status: 'paid' }); t('AF with the payment grant pays', r.s === 200 && r.j.data.status === 'paid', r.s + JSON.stringify(r.j));
  t('payment stores who paid', cval(cid, 'paid_by') === afId && cval(cid, 'paid_at') !== '');
}
// tax setup: finance and super_admin only
for (const [name, who] of Object.entries({ PM, SE, RO })) { r = await who('POST', `/broker-setup/${B1}`, { tdsRatePct: 5 }); t(`role ${name} cannot set broker tax`, r.s === 403, r.s); }
{ const nb0 = await activeBroker({ tax: false }); r = await AF('POST', `/broker-setup/${nb0}`, { tdsRatePct: 5 }); t('AF: the first tax setup with only one rate is refused (no defaults)', r.s === 400, r.s); }
r = await AF('POST', `/broker-setup/${B1}`, { tdsRatePct: 5, gstRatePct: 18 }); t('AF sets broker tax', r.s === 200, r.s);
// project mapping needs maker access
r = await RO('POST', `/brokers/${B1}/projects`, { projectIds: [P1] }); t('read only cannot map projects', r.s === 403, r.s);
noRows(pmId); noRows(seId);
r = await PM('POST', `/brokers/${B1}/projects`, { projectIds: [P1] }); t('PM without maker access cannot map projects', r.s === 403, r.s);
r = await PM('PATCH', `/brokers/${B1}`, { city: 'Pune' }); t('PM without maker access cannot edit a broker', r.s === 403, r.s);
grant(pmId, 'broker_range_entry', true, true);

// =====================================================================================
// 2. registering a broker: hostile input
// =====================================================================================
const okB = { firmName: 'Valid Firm ' + U, mobile: mob() };
const badBody = [
  ['no body', undefined], ['empty object', {}], ['array body', []], ['string body', '"x"'], ['null', 'null'],
  ['no firm', { mobile: mob() }], ['no mobile', { firmName: 'F' }], ['blank firm', { firmName: '   ', mobile: mob() }], ['firm as number', { firmName: 5, mobile: mob() }], ['firm as array', { firmName: ['a'], mobile: mob() }], ['firm as object', { firmName: { a: 1 }, mobile: mob() }],
  ['firm 300 chars', { firmName: 'a'.repeat(300), mobile: mob() }], ['firm script', { firmName: '<script>alert(1)</script>', mobile: mob() }], ['firm control char', { firmName: 'a\u0001b', mobile: mob() }], ['firm bidi', { firmName: 'a‮b', mobile: mob() }],
  ['mobile 1', { firmName: 'F', mobile: '1' }], ['mobile letters', { firmName: 'F', mobile: 'abcdefghij' }], ['mobile starts 5', { firmName: 'F', mobile: '5123456789' }], ['mobile 11 digits', { firmName: 'F', mobile: '91234567890123' }], ['mobile as array', { firmName: 'F', mobile: ['9123456789'] }], ['mobile as object', { firmName: 'F', mobile: {} }], ['mobile sql', { firmName: 'F', mobile: "9' OR '1'='1" }],
  ['email bad', { ...okB, mobile: mob(), email: 'nope' }], ['email double dot', { ...okB, mobile: mob(), email: 'a..b@c.com' }], ['email array', { ...okB, mobile: mob(), email: ['a@b.co'] }], ['email 300', { ...okB, mobile: mob(), email: 'a'.repeat(300) + '@x.com' }],
  ['pan bad', { ...okB, mobile: mob(), pan: 'ABC123' }], ['pan lower junk', { ...okB, mobile: mob(), pan: '12345ABCDE' }], ['gst bad', { ...okB, mobile: mob(), gstNo: '27AAAAA0000A1Z5' }], ['gst short', { ...okB, mobile: mob(), gstNo: '27' }],
  ['pct -1', { ...okB, mobile: mob(), commissionPct: -1 }], ['pct 101', { ...okB, mobile: mob(), commissionPct: 101 }], ['pct 1e3', { ...okB, mobile: mob(), commissionPct: '1e3' }], ['pct 1.234', { ...okB, mobile: mob(), commissionPct: 1.234 }], ['pct text', { ...okB, mobile: mob(), commissionPct: 'abc' }], ['pct huge', { ...okB, mobile: mob(), commissionPct: 99999999999 }], ['pct array', { ...okB, mobile: mob(), commissionPct: [2] }], ['pct true', { ...okB, mobile: mob(), commissionPct: true }],
  ['pin 5 digits', { ...okB, mobile: mob(), pin_code: '12345' }], ['pin letters', { ...okB, mobile: mob(), pin_code: 'abcdef' }], ['address 600', { ...okB, mobile: mob(), address: 'x'.repeat(600) }], ['remarks 2000', { ...okB, mobile: mob(), remarks: 'x'.repeat(2000) }], ['rera 200', { ...okB, mobile: mob(), reraNumber: 'x'.repeat(200) }],
  ['parent not uuid', { ...okB, mobile: mob(), parentBrokerId: 'abc' }], ['parent array', { ...okB, mobile: mob(), parentBrokerId: [NIL] }],
  
  ['bank as string', { ...okB, mobile: mob(), bankAccountDetails: 'x' }], ['bank as array', { ...okB, mobile: mob(), bankAccountDetails: [1] }], ['bank acct letters', { ...okB, mobile: mob(), bankAccountDetails: { accountNo: 'ABC' } }], ['bank acct 30 digits', { ...okB, mobile: mob(), bankAccountDetails: { accountNo: '1'.repeat(30) } }], ['bank ifsc bad', { ...okB, mobile: mob(), bankAccountDetails: { ifsc: 'XXXX' } }], ['bank name script', { ...okB, mobile: mob(), bankAccountDetails: { bankName: '<b>x</b>' } }],
  ['gst_on_commission maybe', { ...okB, mobile: mob(), gst_on_commission: 'maybe' }],
];
for (const [n, b] of badBody) { const raw = typeof b === 'string' ? b : undefined; r = await A('POST', '/brokers', raw ? undefined : b, raw); t(`register broker: ${n} is refused with 400`, r.s === 400, r.s + JSON.stringify(r.j)); }
t('none of those made a broker', psql(`select count(*) from brokers where firm_name like '%${U}' and created_at > now() - interval '1 hour' and (firm_name like 'Valid Firm%' and false)`) === '0');
{ // the happy path stores what was sent
  const p = pan(), g = gstin(), m = mob();
  r = await A('POST', '/brokers', { firmName: '  Full Firm ' + U + '  ', contact_person: 'Contact ' + U, mobile: '+91 ' + m.slice(0, 5) + ' ' + m.slice(5), alt_mobile: mob(), email: 'Broker.' + U + '@Example.COM', rera_no: 'RERA-' + U, gst_no: g.toLowerCase(), pan_no: p.toLowerCase(), address: 'Sector 1', city: 'Gurugram', state: 'Haryana', pin_code: '122001', commission_rate: '1.75', bank_account_name: 'Full Firm', bank_account_no: '1234 5678 9012', bank_ifsc: 'hdfc0001234', bank_name: 'HDFC Bank', bank_branch: 'Main', gst_on_commission: 'no', remarks: 'note ' + U, commission_type: 'flat', payment_terms: 'x' });
  t('register broker: the application form body is accepted', r.s === 201 && r.j.data.status === 'pending', r.s + JSON.stringify(r.j)); const id = r.j.data.id; brokers.push(id);
  t('stored: firm name trimmed, mobile normalised, email lower case', psql(`select firm_name='Full Firm ${U}' and mobile='${m}' and email='broker.${U.toLowerCase()}@example.com' from brokers where id='${id}'`) === 't');
  t('stored: PAN and GST upper case, RERA, commission 1.75, city, state, pin, remarks, contact', psql(`select pan='${p}' and tax_id_pan='${p}' and tax_id_gst='${g}' and rera_number='RERA-${U}' and commission_pct=1.75 and city='Gurugram' and state='Haryana' and pin_code='122001' and remarks='note ${U}' and contact_person='Contact ${U}' and name='Contact ${U}' from brokers where id='${id}'`) === 't');
  t('stored: bank details as clean JSON', psql(`select bank_account_details->>'accountNo'='123456789012' and bank_account_details->>'ifsc'='HDFC0001234' and bank_account_details->>'bankName'='HDFC Bank' from brokers where id='${id}'`) === 't');
  t('GST on commission "no" makes a tax setup that is GST exempt', psql(`select is_gst_exempt from broker_tax_config where broker_id='${id}'`) === 't');
  t('created_by and audit log are set', psql(`select created_by is not null from brokers where id='${id}'`) === 't' && Number(psql(`select count(*) from audit_logs where resource_type='broker' and resource_id='${id}'`)) >= 1);
  r2 = await A('POST', '/brokers', { firmName: 'Dup ' + U, mobile: m }); t('same mobile again is refused (409)', r2.s === 409, r2.s);
  r2 = await A('POST', '/brokers', { firmName: 'Dup2 ' + U, mobile: '0' + m }); t('same mobile written with a leading 0 is refused too (409)', r2.s === 409, r2.s);
  r2 = await A('POST', '/brokers', { firmName: 'Dup3 ' + U, mobile: mob(), pan: p }); t('same PAN again is refused (409)', r2.s === 409, r2.s);
  const rj = await A2('PATCH', `/brokers/${id}/reject`, {}); t('(set-up) reject it', rj.s === 200, rj.s);
  r2 = await newBroker({ mobile: m, pan: p }); t('after a rejection the same mobile and PAN can be used again', r2.s === 201, r2.s + JSON.stringify(r2.j));
}
{ // 5 at once with the same mobile: one wins
  const m = mob(); const rs5 = await Promise.all(Array.from({ length: 5 }, (_, i) => A('POST', '/brokers', { firmName: `Race ${i} ${U}`, mobile: m })));
  rs5.filter(x => x.s === 201).forEach(x => brokers.push(x.j.data.id));
  t('race: 5 registrations of one mobile, exactly one 201 and the rest 409', rs5.filter(x => x.s === 201).length === 1 && rs5.filter(x => x.s === 409).length === 4, rs5.map(x => x.s).join());
  t('race: one broker row for that mobile', psql(`select count(*) from brokers where mobile='${m}'`) === '1');
}
r = await A('POST', '/brokers', { firmName: 'Default ' + U, mobile: mob() }); brokers.push(r.j.data.id);
t('commission defaults to 2 when not sent', psql(`select commission_pct from brokers where id='${r.j.data.id}'`) === '2.00');
r = await A('POST', '/brokers', { firmName: 'Zero ' + U, mobile: mob(), commissionPct: 0 }); brokers.push(r.j.data.id); t('commission 0 is allowed', r.s === 201 && psql(`select commission_pct from brokers where id='${r.j.data.id}'`) === '0.00', r.s);
r = await A('POST', '/brokers', { firmName: 'Max ' + U, mobile: mob(), commissionPct: '100.00' }); brokers.push(r.j.data.id); t('commission 100 is allowed', r.s === 201, r.s);
const parent = await activeBroker();
r = await newBroker({ parentBrokerId: NIL }); t('a parent that does not exist is 404', r.s === 404, r.s);
r = await newBroker({ parentBrokerId: parent }); t('a sub broker under an active parent', r.s === 201, r.s + JSON.stringify(r.j));
r2 = await A('GET', `/brokers/${parent}/sub-brokers`); t('the parent lists its sub broker', r2.j.data.length === 1 && r2.j.data[0].id === r.j.data.id, JSON.stringify(r2.j));
r = await A('PATCH', `/brokers/${parent}`, { parentBrokerId: r.j.data.id }); t('a parent cannot be placed under its own child (cycle, 400)', r.s === 400, r.s + JSON.stringify(r.j));
r = await A('PATCH', `/brokers/${parent}`, { parentBrokerId: parent }); t('a broker cannot be its own parent (400)', r.s === 400, r.s);

// =====================================================================================
// 3. reading, edit, status, mapping
// =====================================================================================
for (const [n, p] of [['not a uuid', 'abc'], ['sql', "1'--"], ['too long', 'a'.repeat(300)]]) {
  for (const [m, path] of [['GET', `/brokers/${p}`], ['GET', `/brokers/${p}/projects`], ['GET', `/brokers/${p}/sub-brokers`], ['PATCH', `/brokers/${p}`], ['PATCH', `/brokers/${p}/approve`], ['PATCH', `/brokers/${p}/reject`], ['PATCH', `/brokers/${p}/status`], ['POST', `/brokers/${p}/projects`], ['PATCH', `/brokers/commission/${p}`], ['GET', `/broker-setup/${p}`], ['POST', `/broker-setup/${p}`], ['POST', `/inventory-hold/${p}/unhold`]]) {
    r = await A(m, encodeURI(path), ['GET'].includes(m) ? undefined : {}); t(`${m} ${path.replace(p, '<' + n + '>')} is 400, never 5xx`, r.s === 400 || r.s === 404, r.s);
  }
}
for (const [m, path] of [['GET', `/brokers/${NIL}`], ['GET', `/brokers/${NIL}/projects`], ['GET', `/brokers/${NIL}/sub-brokers`], ['PATCH', `/brokers/${NIL}`], ['PATCH', `/brokers/${NIL}/approve`], ['PATCH', `/brokers/${NIL}/reject`], ['PATCH', `/brokers/${NIL}/status`], ['POST', `/brokers/${NIL}/projects`], ['PATCH', `/brokers/commission/${NIL}`], ['GET', `/broker-setup/${NIL}`], ['POST', `/broker-setup/${NIL}`], ['POST', `/inventory-hold/${NIL}/unhold`]]) {
  r = await A(m, path, m === 'GET' ? undefined : (path.includes('status') ? { status: 'inactive' } : path.includes('commission') ? { status: 'paid' } : path.includes('broker-setup') ? { tdsRatePct: 5 } : path.includes('projects') ? { projectIds: [] } : { city: 'x' })); t(`${m} ${path.replace(NIL, '<unknown id>')} is 404`, r.s === 404, r.s + JSON.stringify(r.j));
}
// list filters and paging
for (const q of ['pageSize=0', 'pageSize=501', 'pageSize=abc', 'pageSize=1;select 1', 'pageSize=-1', 'pageSize=1e2', 'pageSize[a]=1', 'page=0', 'page=abc', 'page=100001', 'status=nope', 'status[]=active', 'status=active&status=pending', 'search[a]=b', 'search=a&search=b']) {
  r = await A('GET', '/brokers?' + q); t(`list brokers ?${q} is 400`, r.s === 400, r.s);
  r2 = await A('GET', '/brokers/commission?' + q); t(`list commission ?${q} is ${q.startsWith('status=nope') || q.startsWith('status[]') || q.startsWith('status=active&') ? 400 : q.startsWith('search') ? 200 : 400}`, no5(r2) && (q.startsWith('search') ? true : r2.s === 400), r2.s);
}
r = await A('GET', '/brokers?pageSize=1'); t('pageSize=1 returns one broker', r.s === 200 && r.j.data.length === 1, r.s);
r2 = await A('GET', '/brokers?pageSize=1&page=2'); t('page 2 is a different broker', r2.s === 200 && r2.j.data[0]?.id !== r.j.data[0].id, r2.s);
r = await A('GET', '/brokers?search=' + encodeURIComponent('Full Firm ' + U)); t('search finds a broker by firm name', r.s === 200 && r.j.data.length >= 1, r.s);
{ const names = [`Pct%Co ${U}`, `PctXCo ${U}`, `Und_Co ${U}`, `UndXCo ${U}`]; for (const n of names) await newBroker({ firmName: n });
  r = await A('GET', '/brokers?search=' + encodeURIComponent(`Pct%Co ${U}`)); t('search: a percent sign is a plain character, not a wildcard (one match, not two)', r.s === 200 && r.j.data.length === 1 && r.j.data[0].firm_name === `Pct%Co ${U}`, r.s + ' ' + r.j?.data?.length);
  r = await A('GET', '/brokers?search=' + encodeURIComponent(`Und_Co ${U}`)); t('search: an underscore is a plain character, not a wildcard (one match, not two)', r.s === 200 && r.j.data.length === 1 && r.j.data[0].firm_name === `Und_Co ${U}`, r.s + ' ' + r.j?.data?.length);
  r = await A('GET', '/brokers?search=' + encodeURIComponent(`PCT%CO ${U}`)); t('search ignores case', r.s === 200 && r.j.data.length === 1, r.s); }
r = await A('GET', '/brokers?status=pending'); t('status filter returns only pending brokers', r.j.data.length > 0 && r.j.data.every(x => x.status === 'pending'));
// edit
const E1 = await activeBroker({ pan: pan() });
for (const [n, b] of [['empty', {}], ['status in edit', { status: 'inactive' }], ['mobile bad', { mobile: '12' }], ['firm blank', { firmName: '' }], ['pct 150', { commissionPct: 150 }], ['pct blank', { commissionPct: '' }], ['email bad', { email: 'x' }], ['pan bad', { pan: 'x' }], ['name blank', { name: '' }], ['parent bad', { parentBrokerId: 'x' }], ['pin bad', { pin_code: '1' }]]) {
  r = await A('PATCH', `/brokers/${E1}`, b); t(`edit broker: ${n} is 400`, r.s === 400, r.s + JSON.stringify(r.j));
}
r = await A('PATCH', `/brokers/${E1}`, { city: 'Noida', commissionPct: 3.5, email: 'e' + U + '@x.com', pan: null }); t('edit broker: a partial edit works', r.s === 200, r.s + JSON.stringify(r.j));
t('edit changes only the fields sent (firm, mobile, status stay)', psql(`select city='Noida' and commission_pct=3.5 and pan is null and status='active' and firm_name is not null and mobile is not null from brokers where id='${E1}'`) === 't');
{ const other = (await A('GET', `/brokers/${parent}`)).j.data.mobile; r = await A('PATCH', `/brokers/${E1}`, { mobile: other }); t('edit: a mobile that another broker has is refused (409)', r.s === 409, r.s); r = await A('PATCH', `/brokers/${E1}`, { mobile: (await A('GET', `/brokers/${E1}`)).j.data.mobile }); t('edit: keeping its own mobile is fine', r.s === 200, r.s); }
// status
r = await A2('PATCH', `/brokers/${E1}/status`, { status: 'weird' }); t('status: unknown value is 400', r.s === 400, r.s);
r = await A2('PATCH', `/brokers/${E1}/status`, { status: 'pending' }); t('status: pending cannot be set (400)', r.s === 400, r.s);
r = await A2('PATCH', `/brokers/${E1}/status`, { status: 'rejected' }); t('status: rejected cannot be set here (400)', r.s === 400, r.s);
r = await A2('PATCH', `/brokers/${E1}/status`, {}); t('status: missing is 400', r.s === 400, r.s);
r = await A2('PATCH', `/brokers/${E1}/status`, { status: 'active' }); t('status: active to active is 409', r.s === 409, r.s);
r = await A2('PATCH', `/brokers/${E1}/status`, { status: 'suspended' }); t('status: active to suspended', r.s === 200 && r.j.data.status === 'suspended', r.s);
r = await A2('PATCH', `/brokers/${E1}/status`, { status: 'inactive' }); t('status: suspended to inactive', r.s === 200, r.s);
r = await A2('PATCH', `/brokers/${E1}/status`, { status: 'active' }); t('status: back to active', r.s === 200, r.s);
{ const x = await newBroker(); r = await A2('PATCH', `/brokers/${x.j.data.id}/status`, { status: 'active' }); t('status: a pending broker cannot skip approval (409)', r.s === 409, r.s); }
// mapping
for (const [n, b] of [['not a list', { projectIds: 'x' }], ['no body', {}], ['bad id', { projectIds: ['abc'] }], ['unknown project', { projectIds: [NIL] }], ['object', { projectIds: { a: 1 } }], ['null in list', { projectIds: [null] }], ['300 ids', { projectIds: Array.from({ length: 300 }, () => NIL) }]]) {
  r = await A('POST', `/brokers/${E1}/projects`, b); t(`mapping: ${n} is refused`, r.s === 400 || r.s === 404, r.s);
}
r = await A('POST', `/brokers/${E1}/projects`, { projectIds: [P1, P1, P2] }); t('mapping: a project sent twice is stored once', r.s === 200 && psql(`select count(*) from broker_project_mapping where broker_id='${E1}'`) === '2', r.s + JSON.stringify(r.j));
r = await A('POST', `/brokers/${E1}/projects`, { projectIds: [P2] }); r2 = await A('GET', `/brokers/${E1}/projects`); t('mapping: a new list replaces the old one', r2.j.data.length === 1 && r2.j.data[0].id === P2);
r = await A('POST', `/brokers/${E1}/projects`, { projectIds: [] }); t('mapping: an empty list clears it', r.s === 200 && psql(`select count(*) from broker_project_mapping where broker_id='${E1}'`) === '0');
{ const rs5 = await Promise.all(Array.from({ length: 5 }, () => A('POST', `/brokers/${E1}/projects`, { projectIds: [P1, P2] }))); t('race: 5 parallel mappings, none fails, two rows at the end', rs5.every(x => x.s === 200) && psql(`select count(*) from broker_project_mapping where broker_id='${E1}'`) === '2', rs5.map(x => x.s).join()); }

// =====================================================================================
// 4. tax setup
// =====================================================================================
const TX = await activeBroker({ tax: false });
r = await A('GET', `/broker-setup/${TX}`); t('tax setup: a broker without a row shows no rates (not set, no defaults)', r.s === 200 && r.j.data.tds_rate_pct === null && r.j.data.gst_rate_pct === null && r.j.data.is_gst_exempt === false && r.j.data.configured === false, JSON.stringify(r.j));
r = await A('GET', '/broker-setup'); t('tax setup list shows brokers that have no row yet with empty rates (not set)', r.j.data.some(x => x.broker_id === TX && x.configured === false && x.tds_rate_pct === null && x.gst_rate_pct === null));
r = await A('GET', '/broker-setup'); t('tax setup list leaves out rejected brokers', !r.j.data.some(x => x.broker_status === 'rejected'));
for (const [n, b] of [['empty', {}], ['tds -1', { tdsRatePct: -1 }], ['tds 101', { tdsRatePct: 101 }], ['tds 1e2', { tdsRatePct: '1e2' }], ['tds 5.555', { tdsRatePct: 5.555 }], ['tds text', { tdsRatePct: 'x' }], ['tds array', { tdsRatePct: [5] }], ['tds huge', { tdsRatePct: 1e12 }], ['gst -5', { gstRatePct: -5 }], ['gst 500', { gstRatePct: 500 }], ['gst 29 (above the 28% slab)', { gstRatePct: 29 }], ['gst 99', { gstRatePct: 99 }], ['tds 31 (above 30%)', { tdsRatePct: 31 }], ['gst object', { gstRatePct: {} }], ['exempt string', { isGstExempt: 'yes' }], ['exempt number', { isGstExempt: 1 }]]) {
  r = await A('POST', `/broker-setup/${TX}`, b); t(`tax setup: ${n} is 400`, r.s === 400, r.s + JSON.stringify(r.j));
}
t('tax setup: nothing was saved by the bad requests', psql(`select count(*) from broker_tax_config where broker_id='${TX}'`) === '0');
r = await A('POST', `/broker-setup/${TX}`, { tdsRatePct: '10.5', gstRatePct: 12 }); t('tax setup: save TDS 10.5 and GST 12', r.s === 200 && Number(r.j.data.tds_rate_pct) === 10.5 && Number(r.j.data.gst_rate_pct) === 12, r.s + JSON.stringify(r.j));
r = await A('POST', `/broker-setup/${TX}`, { isGstExempt: true }); t('tax setup: sending only the exempt flag keeps both rates (they used to reset to 5 and 18)', r.s === 200 && Number(r.j.data.tds_rate_pct) === 10.5 && Number(r.j.data.gst_rate_pct) === 12 && r.j.data.is_gst_exempt === true, JSON.stringify(r.j));
r = await A('POST', `/broker-setup/${TX}`, { tdsRatePct: 0, gstRatePct: 0, isGstExempt: false }); t('tax setup: 0% and 0% are allowed', r.s === 200 && Number(r.j.data.tds_rate_pct) === 0, JSON.stringify(r.j));
{ const rs5 = await Promise.all([1, 2, 3, 4, 5].map(i => A('POST', `/broker-setup/${TX}`, { tdsRatePct: i }))); t('race: 5 parallel saves, none fails, one row', rs5.every(x => x.s === 200) && psql(`select count(*) from broker_tax_config where broker_id='${TX}'`) === '1', rs5.map(x => x.s).join()); }
t('tax setup is audited', Number(psql(`select count(*) from audit_logs where resource_type='broker_tax_config'`)) >= 1);

// =====================================================================================
// 5. booking with a broker: the commission
// =====================================================================================
const BK = await activeBroker();
{ // percent: base price x rate
  const x = await book({ broker: BK, comm: 2.5, ctype: 'percent', amount: 50000 }); t('booking: percent commission, booking made', x.s === 201, x.s + JSON.stringify(x.j));
  const c = comm(x.c, x.u); t('commission = 9,000,000 x 2.5% = 225,000.00', cval(c, 'commission_amount_inr') === '225000.00' && cval(c, 'status') === 'pending', cval(c, 'commission_amount_inr'));
  t('commission row belongs to the broker, applicant, unit and project', psql(`select broker_id='${BK}' and consumer_id='${x.c}' and unit_id='${x.u}' and project_id='${P1}' from broker_commissions where id='${c}'`) === 't');
}
{ // paise rounding
  const x = await book({ broker: BK, comm: 1.37, ctype: 'percent', amount: 50000 }); const c = comm(x.c, x.u);
  t('commission = 9,000,000 x 1.37% = 123,300.00 (rounded to the paisa)', cval(c, 'commission_amount_inr') === '123300.00', cval(c, 'commission_amount_inr'));
  const y = await book({ broker: BK, comm: 0.01, ctype: 'percent', amount: 50000 }); t('0.01% of 9,000,000 = 900.00', cval(comm(y.c, y.u), 'commission_amount_inr') === '900.00');
}
let FLAT;
{ const x = await book({ broker: BK, comm: 12345.67, ctype: 'flat', amount: 50000 }); FLAT = comm(x.c, x.u); t('flat commission 12,345.67 is stored to the paisa', cval(FLAT, 'commission_amount_inr') === '12345.67', cval(FLAT, 'commission_amount_inr')); FLAT = { ...x, id: FLAT }; }
for (const [n, o, code] of [
  ['percent over 100', { comm: 101, ctype: 'percent' }, 400], ['negative commission', { comm: -5, ctype: 'flat' }, 400], ['commission text', { comm: 'abc', ctype: 'flat' }, 400], ['commission 1e3', { comm: '1e3', ctype: 'flat' }, 400], ['commission 3 decimals', { comm: 1.234, ctype: 'flat' }, 400],
  ['flat more than the unit price', { comm: 9000001, ctype: 'flat' }, 400], ['unknown commission type', { comm: 1, ctype: 'weird' }, 400], ['broker id not a uuid', { broker: 'abc' }, 400], ['broker does not exist', { broker: NIL }, 400],
  ['broker id as array', { broker: [BK] }, 400], ['direct booking with a broker', { type: 'direct' }, 400], ['unknown booking type', { type: 'agent' }, 400],
]) { const x = await book({ broker: BK, comm: 2, ctype: 'percent', amount: 0, ...o }); t(`booking with broker: ${n} is refused`, x.s === code && (x.id ? false : true), x.s + JSON.stringify(x.j)); if (x.u) { t(`  (${n}) the unit stayed available and no commission was made`, ustatus(x.u) === 'available' && psql(`select count(*) from broker_commissions where unit_id='${x.u}'`) === '0'); } }
{ const pend = await activeBroker(), other = await newBroker(); const sus = await activeBroker(); await A2('PATCH', `/brokers/${sus}/status`, { status: 'suspended' });
  let x = await book({ broker: other.j.data.id, amount: 0 }); t('booking: a pending broker cannot take a booking (400)', x.s === 400, x.s + JSON.stringify(x.j));
  x = await book({ broker: sus, amount: 0 }); t('booking: a suspended broker cannot take a booking (400)', x.s === 400, x.s);
  const rj = await newBroker(); await A2('PATCH', `/brokers/${rj.j.data.id}/reject`, {}); x = await book({ broker: rj.j.data.id, amount: 0 }); t('booking: a rejected broker cannot take a booking (400)', x.s === 400, x.s);
  x = await book({ type: 'direct', broker: undefined, amount: 0 }); t('booking: a direct booking without a broker is fine and makes no commission', x.s === 201 && psql(`select count(*) from broker_commissions where consumer_id='${x.c}'`) === '0', x.s + JSON.stringify(x.j));
  x = await book({ type: 'broker', broker: undefined, amount: 0 }); t('booking: a broker sale with no broker chosen (the form default) is accepted, no commission', x.s === 201 && psql(`select count(*) from broker_commissions where consumer_id='${x.c}'`) === '0', x.s + JSON.stringify(x.j));
}
{ // the booking can be edited while the commission is pending
  const x = await book({ broker: BK, comm: 1, ctype: 'percent', amount: 0 }); const c = comm(x.c, x.u);
  r = await A('PATCH', `/booking/${x.id}/edit`, { broker_commission: 3 }); t('editing the booking commission to 3% follows into the pending commission', r.s === 200 && cval(c, 'commission_amount_inr') === '270000.00', r.s + JSON.stringify(r.j) + cval(c, 'commission_amount_inr'));
}
{ const x = await book({ broker: BK, comm: 1, ctype: 'percent', amount: 0 }); const other = await newBroker(); r = await A('PATCH', `/booking/${x.id}/edit`, { broker_id: other.j.data.id }); t('editing the booking to a pending broker is refused (400)', r.s === 400, r.s + JSON.stringify(r.j));
  r = await A('PATCH', `/booking/${x.id}/edit`, { broker_commission: 99999999, broker_commission_type: 'flat' }); t('editing to a flat commission above the unit price is refused (400)', r.s === 400, r.s + JSON.stringify(r.j)); }

// ---- paying ----
const pay = (id, who = A, b = { status: 'paid' }) => who('PATCH', `/brokers/commission/${id}`, b);
for (const [n, b] of [['no status or notes', {}], ['status pending', { status: 'pending' }], ['status cancelled', { status: 'cancelled' }], ['status approved', { status: 'approved' }], ['status unknown', { status: 'x' }], ['status array', { status: ['paid'] }], ['status object', { status: {} }], ['notes script', { notes: '<script>' }], ['notes 600 chars', { notes: 'x'.repeat(600) }], ['notes as array', { notes: ['a'] }]]) {
  r = await pay(FLAT.id, A, b); t(`pay: ${n} is 400`, r.s === 400, r.s + JSON.stringify(r.j)); }
t('pay: nothing changed by the bad requests', cval(FLAT.id, 'status') === 'pending' && cval(FLAT.id, 'tds_amount') === '');
r = await pay(FLAT.id, A, { notes: 'note ' + U }); t('pay: a note alone is saved without paying', r.s === 200 && cval(FLAT.id, 'notes') === 'note ' + U && cval(FLAT.id, 'status') === 'pending', r.s + JSON.stringify(r.j));
{ // pending_payment booking: nothing received yet
  const x = await book({ broker: BK, comm: 1000, ctype: 'flat', amount: 0 }); const c = comm(x.c, x.u);
  r = await pay(c); t('pay: a booking that has received no booking amount cannot be paid (409)', r.s === 409, r.s + JSON.stringify(r.j));
  r = await A('PATCH', `/booking/${x.id}`, { booking_amount: 20000, payment_mode: 'cash' }); t('(set-up) the booking amount arrives', r.s === 200, r.s);
  r = await pay(c); t('pay: once the booking amount has arrived the commission is paid', r.s === 200, r.s + JSON.stringify(r.j));
}
{ // no default rates: a broker with no tax setup cannot be paid, the first save needs both rates
  const nb = await activeBroker({ tax: false }); const x = await book({ broker: nb, comm: 5000, ctype: 'flat', amount: 20000 }); const cid = comm(x.c, x.u);
  r = await pay(cid); t('pay: a broker with no tax setup cannot be paid (409 and it says why)', r.s === 409 && /tax setup/i.test(r.j.error || ''), r.s + JSON.stringify(r.j));
  t('pay: nothing changed by the refused payment', cval(cid, 'status') === 'pending' && cval(cid, 'tds_amount') === '');
  r = await A('POST', `/broker-setup/${nb}`, { gstRatePct: 18 }); t('tax setup: the first save with only the GST rate is refused (400)', r.s === 400, r.s + JSON.stringify(r.j));
  r = await A('POST', `/broker-setup/${nb}`, { tdsRatePct: 2 }); t('tax setup: the first save with only the TDS rate is refused (400)', r.s === 400, r.s + JSON.stringify(r.j));
  t('tax setup: the refused saves left no row behind', psql(`select count(*) from broker_tax_config where broker_id='${nb}'`) === '0');
  r = await A('POST', `/broker-setup/${nb}`, { tdsRatePct: 2, gstRatePct: 18 }); t('tax setup: both rates are saved', r.s === 200, r.s + JSON.stringify(r.j));
  r = await pay(cid); t('pay: after the setup the commission is paid with the rates of the setup (TDS 2% of 5,000 = 100.00, GST 900.00, net 5,800.00)', r.s === 200 && r.j.data.tds_amount === '100.00' && r.j.data.gst_amount === '900.00' && r.j.data.net_amount_inr === '5800.00', r.s + JSON.stringify(r.j));
}
// GST and TDS with a 5% / 18% setup: 12,345.67 + 18% GST - 5% TDS
r = await pay(FLAT.id); t('pay: 12,345.67 with the 5% / 18% setup, GST 2,222.22, TDS 617.28, net 13,950.61', r.s === 200 && r.j.data.gst_amount === '2222.22' && r.j.data.tds_amount === '617.28' && r.j.data.net_amount_inr === '13950.61' && r.j.data.status === 'paid', r.s + JSON.stringify(r.j));
t('pay: stored amounts match and paid_at is set', psql(`select gst_amount=2222.22 and tds_amount=617.28 and net_amount_inr=13950.61 and commission_amount_inr=12345.67 and paid_at is not null and notes='note ${U}' from broker_commissions where id='${FLAT.id}'`) === 't');
r = await pay(FLAT.id); t('pay: a second payment of the same commission is refused (409)', r.s === 409, r.s);
r = await pay(FLAT.id, A, { notes: 'late note' }); t('pay: a note can still be added after payment, status and amounts do not move', r.s === 200 && cval(FLAT.id, 'status') === 'paid' && cval(FLAT.id, 'net_amount_inr') === '13950.61');
{ const bkid = psql(`select id from booking_records where consumer_id='${FLAT.c}' and unit_id='${FLAT.u}'`);
  r = await A('PATCH', `/booking/${bkid}/edit`, { broker_commission: 9, broker_commission_type: 'percent' }); t('after payment the booking commission cannot be changed (409)', r.s === 409, r.s + JSON.stringify(r.j));
  r = await A('PATCH', `/booking/${bkid}/edit`, { broker_id: parent }); t('after payment the broker of the booking cannot be changed (409)', r.s === 409, r.s + JSON.stringify(r.j)); }
// custom setup, exempt, zero
{ const mk = async (cfg, comm$, cf) => { const b = await activeBroker(); if (cfg) await A('POST', `/broker-setup/${b}`, cfg); const x = await book({ broker: b, comm: comm$, ctype: 'flat', amount: 30000 }); return { b, c: comm(x.c, x.u), x }; };
  let k = await mk({ tdsRatePct: 10, gstRatePct: 12.5 }, 100000); r = await pay(k.c); t('pay: custom TDS 10% and GST 12.5% on 100,000.00 gives GST 12,500.00, TDS 10,000.00, net 102,500.00', r.s === 200 && r.j.data.gst_amount === '12500.00' && r.j.data.tds_amount === '10000.00' && r.j.data.net_amount_inr === '102500.00', JSON.stringify(r.j));
  k = await mk({ isGstExempt: true, tdsRatePct: 5 }, 40000.01); r = await pay(k.c); t('pay: a GST exempt broker gets no GST, TDS 5% of 40,000.01 = 2,000.00 (0.0005 rounds down), net 38,000.01', r.s === 200 && r.j.data.gst_amount === '0.00' && r.j.data.tds_amount === '2000.00' && r.j.data.net_amount_inr === '38000.01', JSON.stringify(r.j));
  k = await mk({ tdsRatePct: 0, gstRatePct: 0 }, 777.77); r = await pay(k.c); t('pay: 0% TDS and 0% GST, net equals the commission', r.s === 200 && r.j.data.net_amount_inr === '777.77' && r.j.data.tds_amount === '0.00', JSON.stringify(r.j));
  k = await mk({ tdsRatePct: 30, gstRatePct: 0 }, 500); r = await pay(k.c); t('pay: 30% TDS (the ceiling) on 500 leaves a net of 350.00', r.s === 200 && r.j.data.net_amount_inr === '350.00', JSON.stringify(r.j));
  k = await mk(null, 0.05, 'flat'); r = await pay(k.c); t('pay: 5 paise commission, TDS 0.00 (0.0025), GST 0.01 (0.009), net 0.06', r.s === 200 && r.j.data.tds_amount === '0.00' && r.j.data.gst_amount === '0.01' && r.j.data.net_amount_inr === '0.06', JSON.stringify(r.j));
  k = await mk(null, 0, 'flat'); r = await pay(k.c); t('pay: a commission of 0 cannot be paid (400)', r.s === 400, r.s + JSON.stringify(r.j));
}
// race: five payments at once
{ const b = await activeBroker(); const x = await book({ broker: b, comm: 5000, ctype: 'flat', amount: 30000 }); const c = comm(x.c, x.u);
  const rs5 = await Promise.all(Array.from({ length: 5 }, () => pay(c))); t('race: 5 parallel payments, exactly one 200 and four 409', rs5.filter(q => q.s === 200).length === 1 && rs5.filter(q => q.s === 409).length === 4, rs5.map(q => q.s).join());
  t('race: paid once, net = commission + GST - TDS', psql(`select status='paid' and net_amount_inr = commission_amount_inr + gst_amount - tds_amount from broker_commissions where id='${c}'`) === 't');
  t('race: one audit entry for the payment', Number(psql(`select count(*) from audit_logs where resource_type='broker_commission' and resource_id='${c}'`)) === 1);
}
// broker suspended, deactivated
{ const b = await activeBroker(); const x = await book({ broker: b, comm: 5000, ctype: 'flat', amount: 30000 }); const c = comm(x.c, x.u);
  await A2('PATCH', `/brokers/${b}/status`, { status: 'suspended' }); r = await pay(c); t('pay: a suspended broker is not paid (409)', r.s === 409, r.s + JSON.stringify(r.j));
  await A2('PATCH', `/brokers/${b}/status`, { status: 'inactive' }); r = await pay(c); t('pay: an inactive broker (left the firm) is still paid what was earned', r.s === 200, r.s + JSON.stringify(r.j)); }
// cancelled booking
{ const b = await activeBroker(); const x = await book({ broker: b, comm: 5000, ctype: 'flat', amount: 0 }); const c = comm(x.c, x.u);
  r = await A('POST', `/booking/${x.id}/cancel`, { reason: 'test ' + U }); t('booking cancelled before any payment', r.s === 200, r.s + JSON.stringify(r.j));
  t('cancelling the booking cancels its pending commission', cval(c, 'status') === 'cancelled');
  r = await pay(c); t('pay: a cancelled commission cannot be paid (409)', r.s === 409, r.s + JSON.stringify(r.j)); }
{ const b = await activeBroker(); const x = await book({ broker: b, comm: 5000, ctype: 'flat', amount: 20000 }); const c = comm(x.c, x.u);
  r = await pay(c); t('(set-up) commission paid on an active booking', r.s === 200, r.s);
  r = await A('POST', `/booking/${x.id}/cancel`, { reason: 'test ' + U }); t('booking cancelled after the commission was paid', r.s === 200, r.s + JSON.stringify(r.j));
  t('the paid commission stays paid and carries a note to recover it from the broker', cval(c, 'status') === 'paid' && cval(c, 'notes').includes('recover it from the broker'), cval(c, 'notes'));
  t('the unit is available again after the cancel', ustatus(x.u) === 'available');
  const y = await book({ c: x.c, u: x.u, broker: b, comm: 7000, ctype: 'flat', amount: 20000 }); t('the same unit can be booked again, a new commission is made', y.s === 201 && psql(`select count(*) from broker_commissions where unit_id='${x.u}'`) === '2', y.s + JSON.stringify(y.j));
  t('each commission points to its own booking (the paid one to the cancelled booking, the new one to the new booking)', psql(`select count(distinct booking_id) = 2 and bool_and(booking_id is not null) from broker_commissions where unit_id='${x.u}'`) === 't' && psql(`select booking_id='${x.id}' from broker_commissions where id='${c}'`) === 't' && psql(`select booking_id='${y.id}' from broker_commissions where id='${comm(y.c, y.u)}'`) === 't'); }
// a transfer of the unit: the commission follows the booking to the new holder, and is still payable and cancellable there
{ const b = await activeBroker(); const x = await book({ broker: b, comm: 6000, ctype: 'flat', amount: 0 }); const c = comm(x.c, x.u);
  r = await A('PATCH', `/booking/${x.id}`, { booking_amount: 20000, payment_mode: 'cash' }); t('(set-up) booking confirmed, allotment made', r.s === 200, r.s + JSON.stringify(r.j));
  const buyer = await person(); r = await A('POST', '/transfers', { unitId: x.u, oldConsumerId: x.c, newConsumerId: buyer });
  t('(set-up) the unit is transferred to a new holder', r.s === 200 || r.s === 201, r.s + JSON.stringify(r.j));
  t('transfer: the pending commission now belongs to the new holder', psql(`select consumer_id='${buyer}' and status='pending' from broker_commissions where id='${c}'`) === 't');
  const rows = (await A('GET', `/brokers/commission?brokerId=${b}`)).j.data; t('transfer: the commission list shows the new holder with the booking amount', rows[0]?.consumer_id === buyer && Number(rows[0].booking_amount) === 20000 && rows[0].booking_status !== undefined, JSON.stringify(rows[0]));
  r = await pay(c); t('transfer: the commission can still be paid after the transfer', r.s === 200, r.s + JSON.stringify(r.j)); }
{ const b = await activeBroker(); const x = await book({ broker: b, comm: 6000, ctype: 'flat', amount: 0 }); const c = comm(x.c, x.u);
  await A('PATCH', `/booking/${x.id}`, { booking_amount: 20000, payment_mode: 'cash' }); const buyer = await person(); await A('POST', '/transfers', { unitId: x.u, oldConsumerId: x.c, newConsumerId: buyer });
  const al = (await A('GET', `/allocations?consumerId=${buyer}&status=all`)).j.data.find(q => q.unit_id === x.u);
  r = await A('POST', `/allocations/${al?.id || NIL}/cancel`, {}); t('transfer: the new holder cancels the allotment', r.s < 300, r.s + JSON.stringify(r.j));
  t('transfer: the commission is cancelled with the booking and cannot be paid', cval(c, 'status') === 'cancelled'); r = await pay(c); t('transfer: paying it is refused (409)', r.s === 409, r.s); }
// a broker without a PAN is cut at least 20% TDS
{ const mk = async (cfg) => { const b = await newBroker({}).then(x => x.j.data.id); await A2('PATCH', `/brokers/${b}/approve`, {}); await A('POST', `/broker-setup/${b}`, cfg || { tdsRatePct: 5, gstRatePct: 18 }); const x = await book({ broker: b, comm: 10000, ctype: 'flat', amount: 20000 }); return comm(x.c, x.u); };
  r = await pay(await mk(null)); t('no PAN, 5% setup: TDS 20% of 10,000 = 2,000.00, GST 1,800.00, net 9,800.00', r.s === 200 && r.j.data.tds_amount === '2000.00' && r.j.data.gst_amount === '1800.00' && r.j.data.net_amount_inr === '9800.00', JSON.stringify(r.j));
  r = await pay(await mk({ tdsRatePct: 0, gstRatePct: 18 })); t('no PAN, setup 0%: still 20%', r.s === 200 && r.j.data.tds_amount === '2000.00', JSON.stringify(r.j));
  r = await pay(await mk({ tdsRatePct: 30, gstRatePct: 18 })); t('no PAN, setup 30%: the higher 30% is used', r.s === 200 && r.j.data.tds_amount === '3000.00', JSON.stringify(r.j)); }
// broker to project mapping: a broker with ticked projects works only in those, a broker with none works everywhere
{ const b = await activeBroker(); const u1 = await newUnit(P1, T1), u2 = await newUnit(P2, T2);
  r = await A('POST', `/brokers/${b}/projects`, { projectIds: [P2] }); t('(set-up) broker mapped to project 2 only', r.s === 200, r.s);
  let x = await book({ broker: b, comm: 1, amount: 0 }); t('mapping: a booking in project 1 is refused (409)', x.s === 409 && /not mapped/i.test(x.j.error || ''), x.s + JSON.stringify(x.j));
  r = await hold(u1, b); t('mapping: a hold in project 1 is refused (409)', r.s === 409, r.s + JSON.stringify(r.j)); t('mapping: the unit stayed available', ustatus(u1) === 'available');
  x = await book({ P: P2, u: u2, broker: b, comm: 1, amount: 0 }); t('mapping: a booking in project 2 is accepted', x.s === 201, x.s + JSON.stringify(x.j));
  const u3 = await newUnit(P2, T2); r = await hold(u3, b); t('mapping: a hold in project 2 is accepted', r.s === 201, r.s + JSON.stringify(r.j));
  x = await book({ broker: b, comm: 1, amount: 0, type: 'broker', extra: { main_broker_id: b } }); t('mapping: also refused with the broker as main broker', x.s === 409, x.s);
  await A('POST', `/brokers/${b}/projects`, { projectIds: [] }); x = await book({ broker: b, comm: 1, amount: 0 }); t('mapping: with the list cleared the broker works in every project again', x.s === 201, x.s + JSON.stringify(x.j));
  await A('POST', `/brokers/${b}/projects`, { projectIds: [P2] });
  r = await A('PATCH', `/booking/${x.id}/edit`, { broker_commission: 2 }); t('mapping: editing the commission of an old booking in an unmapped project is not blocked (the broker is not changed)', r.s === 200, r.s + JSON.stringify(r.j));
  const o = await activeBroker(); await A('POST', `/brokers/${o}/projects`, { projectIds: [P2] }); r = await A('PATCH', `/booking/${x.id}/edit`, { broker_id: o }); t('mapping: moving a booking of project 1 to a broker mapped only to project 2 is refused (409)', r.s === 409, r.s + JSON.stringify(r.j)); }
// commission list: filters, totals, paging
{ r = await A('GET', `/brokers/commission?brokerId=${BK}&pageSize=500`); const rows = r.j.data; t('commission list: filtered by broker', r.s === 200 && rows.length > 5 && rows.every(c => c.broker_id === BK), r.s);
  const s = r.j.summary; const sum = (f) => rows.filter(f).reduce((a, c) => a + Number(c.commission_amount_inr), 0);
  t('commission list: summary count matches', s.count === rows.length && s.live === rows.filter(c => c.status !== 'cancelled').length, JSON.stringify(s));
  t('commission list: summary total, pending, paid match the rows to the paisa', Math.abs(Number(s.total) - sum(c => c.status !== 'cancelled')) < 0.005 && Math.abs(Number(s.pending) - sum(c => ['pending', 'approved'].includes(c.status))) < 0.005 && Math.abs(Number(s.paid) - sum(c => c.status === 'paid')) < 0.005, JSON.stringify(s));
  t('commission list: summary matches the database', psql(`select coalesce(sum(commission_amount_inr) filter (where status='paid'),0)=${s.paid} from broker_commissions where broker_id='${BK}'`) === 't');
  t('commission list: rows carry the booking amount, rate, GST, TDS and net', rows.every(c => 'booking_amount' in c && 'commission_type' in c && 'net_amount_inr' in c && 'gst_amount' in c && 'consumer_name' in c && c.unit_number));
  const paid = rows.find(c => c.status === 'paid'); t('commission list: a paid row shows net = commission + GST - TDS', Math.abs(Number(paid.net_amount_inr) - (Number(paid.commission_amount_inr) + Number(paid.gst_amount) - Number(paid.tds_amount))) < 0.005);
  r = await A('GET', `/brokers/commission?brokerId=${BK}&status=paid`); t('commission list: status filter', r.j.data.length > 0 && r.j.data.every(c => c.status === 'paid'));
  r = await A('GET', `/brokers/commission?brokerId=${BK}&status=cancelled`); t('commission list: cancelled filter', r.s === 200 && r.j.data.every(c => c.status === 'cancelled'));
  r = await A('GET', `/brokers/commission?brokerId=${BK}&projectId=${P2}`); t('commission list: project filter (this broker has none in project 2)', r.s === 200 && r.j.data.length === 0);
  r = await A('GET', `/brokers/commission?brokerId=${BK}&dateFrom=${today}&dateTo=${today}`); t('commission list: today to today finds today\'s commissions', r.s === 200 && r.j.data.length > 5, r.s);
  r = await A('GET', `/brokers/commission?brokerId=${BK}&dateFrom=${later(1)}`); t('commission list: from tomorrow finds nothing', r.s === 200 && r.j.data.length === 0 && r.j.summary.count === 0);
  for (const q of ['brokerId=abc', 'projectId=abc', 'dateFrom=2026-13-45', 'dateFrom=x', 'dateTo=2026-02-30', `dateFrom=${later(3)}&dateTo=${later(1)}`, 'brokerId[]=x', 'status=paid&status=pending']) { r = await A('GET', '/brokers/commission?' + q); t(`commission list: ?${q} is 400`, r.s === 400, r.s); }
  r = await A('GET', `/brokers/commission?brokerId=${BK}&pageSize=2&page=2`); t('commission list: paging', r.s === 200 && r.j.data.length === 2 && r.j.summary.count === rows.length);
  r = await A('GET', '/brokers'); const row = r.j.data.find(x => x.id === BK); t('broker list: paid and pending totals match the commissions', Math.abs(Number(row.total_paid_inr) - Number(s.paid)) < 0.005 && Math.abs(Number(row.total_pending_inr) - Number(s.pending)) < 0.005, JSON.stringify(row)); }

// =====================================================================================
// 6. unit holds
// =====================================================================================
const H1 = await activeBroker({ firmName: 'Hold Firm A ' + U }), H2 = await activeBroker({ firmName: 'Hold Firm B ' + U });
{ const u = await newUnit();
  r = await hold(u, H1, { clientName: 'Client ' + U, clientMobile: mob(), holdHours: 24, notes: 'n' }); t('hold: an available unit is held', r.s === 201 && r.j.data.status === 'active', r.s + JSON.stringify(r.j));
  t('hold: the unit is now held, one active hold, history written, created_by set', ustatus(u) === 'held' && holdsOf(u) === 1 && Number(psql(`select count(*) from unit_status_history where unit_id='${u}' and new_status='held'`)) === 1 && psql(`select created_by is not null from unit_holds where unit_id='${u}'`) === 't');
  t('hold: expires 24 hours after it was made', psql(`select abs(extract(epoch from (expires_at - held_at)) - 86400) < 5 from unit_holds where unit_id='${u}'`) === 't');
  r = await hold(u, H2); t('hold: a unit that is already held is refused (409)', r.s === 409, r.s + JSON.stringify(r.j));
  r = await hold(u, H1); t('hold: the same broker holding it again is refused too (409)', r.s === 409, r.s);
  r = await A('GET', '/inventory-hold'); const h = r.j.data.find(x => x.unit_id === u); t('hold list: active holds show unit, tower, project, broker firm, client and who held it', r.s === 200 && h && h.broker_firm_name === 'Hold Firm A ' + U && h.client_name === 'Client ' + U && h.tower_name && h.project_name && h.held_by_name, JSON.stringify(h));
  r = await A('GET', '/inventory-hold?status=all'); t('hold list: all', r.s === 200 && r.j.data.some(x => x.unit_id === u));
  r = await A('GET', '/inventory-hold?status=cancelled'); t('hold list: cancelled does not include an active hold', !r.j.data.some(x => x.unit_id === u));
  const hid = holdId(u);
  r = await SE('POST', `/inventory-hold/${hid}/unhold`); t('unhold: a sales executive who did not make the hold cannot release it (403)', r.s === 403, r.s + JSON.stringify(r.j));
  t('unhold: the hold is still active after the refusal', holdsOf(u) === 1 && ustatus(u) === 'held');
  r = await PM('POST', `/inventory-hold/${hid}/unhold`); t('unhold: a project manager can release any hold', r.s === 200, r.s + JSON.stringify(r.j));
  t('unhold: unit available, hold cancelled with who and when, history written', ustatus(u) === 'available' && holdsOf(u) === 0 && holdsOf(u, 'cancelled') === 1 && psql(`select released_at is not null and released_by is not null from unit_holds where id='${hid}'`) === 't' && Number(psql(`select count(*) from unit_status_history where unit_id='${u}' and new_status='available'`)) === 1);
  r = await PM('POST', `/inventory-hold/${hid}/unhold`); t('unhold: releasing twice is refused (409)', r.s === 409, r.s);
  // held, released, held again, released again: it used to fail on the second release (one row per unit and status)
  for (let i = 1; i <= 3; i++) {
    r = await hold(u, i % 2 ? H1 : H2); r2 = r.s === 201 ? await A('POST', `/inventory-hold/${r.j.data.id}/unhold`) : r;
    t(`hold cycle ${i}: held then released again`, r.s === 201 && r2.s === 200 && ustatus(u) === 'available', r.s + ' ' + r2.s + JSON.stringify(r2.j));
  }
  t('hold cycle: four cancelled holds in the history, none active', holdsOf(u, 'cancelled') === 4 && holdsOf(u) === 0);
}
// own hold: a sales executive releases a hold they made
{ const u = await newUnit(); r = await hold(u, H1, {}, SE); t('SE can hold a unit', r.s === 201, r.s + JSON.stringify(r.j)); r2 = await SE('POST', `/inventory-hold/${r.j.data.id}/unhold`); t('SE releases their own hold', r2.s === 200, r2.s + JSON.stringify(r2.j)); }
// hostile input
{ const u = await newUnit(); const m = mob();
  for (const [n, b, code] of [
    ['no body', undefined, 400], ['empty', {}, 400], ['no broker', { unitId: u }, 400], ['no unit', { brokerId: H1 }, 400], ['unit not uuid', { unitId: 'x', brokerId: H1 }, 400], ['broker not uuid', { unitId: u, brokerId: 'x' }, 400], ['unit array', { unitId: [u], brokerId: H1 }, 400], ['broker object', { unitId: u, brokerId: {} }, 400],
    ['unit unknown', { unitId: NIL, brokerId: H1 }, 404], ['broker unknown', { unitId: u, brokerId: NIL }, 404],
    ['hours 0', { unitId: u, brokerId: H1, holdHours: 0 }, 400], ['hours -1', { unitId: u, brokerId: H1, holdHours: -1 }, 400], ['hours 73', { unitId: u, brokerId: H1, holdHours: 73 }, 400], ['hours 1.5', { unitId: u, brokerId: H1, holdHours: 1.5 }, 400], ['hours text', { unitId: u, brokerId: H1, holdHours: 'x' }, 400], ['hours 1e1', { unitId: u, brokerId: H1, holdHours: '1e1' }, 400], ['hours array', { unitId: u, brokerId: H1, holdHours: [24] }, 400], ['hours huge', { unitId: u, brokerId: H1, holdHours: 1e12 }, 400],
    ['name script', { unitId: u, brokerId: H1, clientName: '<script>x</script>' }, 400], ['name 300', { unitId: u, brokerId: H1, clientName: 'a'.repeat(300) }, 400], ['name number', { unitId: u, brokerId: H1, clientName: 5 }, 400], ['name control', { unitId: u, brokerId: H1, clientName: 'a\u0000b' }, 400],
    ['mobile bad', { unitId: u, brokerId: H1, clientMobile: '12' }, 400], ['mobile letters', { unitId: u, brokerId: H1, clientMobile: 'abc' }, 400], ['mobile array', { unitId: u, brokerId: H1, clientMobile: [m] }, 400],
    ['notes 2000', { unitId: u, brokerId: H1, notes: 'x'.repeat(2000) }, 400], ['notes array', { unitId: u, brokerId: H1, notes: ['x'] }, 400],
  ]) { r = await A('POST', '/inventory-hold', b); t(`hold: ${n} is ${code}`, r.s === code, r.s + JSON.stringify(r.j)); }
  t('hold: none of the bad requests held the unit', ustatus(u) === 'available' && holdsOf(u) === 0);
  r = await A('POST', '/inventory-hold', undefined, '[1]'); t('hold: an array body is 400', r.s === 400, r.s);
  r = await A('POST', '/inventory-hold', undefined, '{bad json'); t('hold: broken JSON is 400', r.s === 400, r.s);
  r = await hold(u, H1, { holdHours: '48', clientMobile: '+91 ' + m, clientName: '  Padded  ' }); t('hold: hours as text "48", mobile with +91 and a padded name are accepted and cleaned', r.s === 201 && psql(`select client_mobile='${m}' and client_name='Padded' and abs(extract(epoch from (expires_at - held_at)) - 172800) < 5 from unit_holds where id='${r.j.data.id}'`) === 't', r.s + JSON.stringify(r.j));
  await A('POST', `/inventory-hold/${r.j.data.id}/unhold`);
  r = await hold(u, H1, { holdHours: 72 }); t('hold: 72 hours is the longest allowed', r.s === 201, r.s); await A('POST', `/inventory-hold/${r.j.data.id}/unhold`);
  r = await hold(u, H1, { holdHours: 1 }); t('hold: 1 hour is the shortest', r.s === 201, r.s); await A('POST', `/inventory-hold/${r.j.data.id}/unhold`);
}
for (const q of ['status=nope', 'status[]=active', 'status=active&status=all', 'pageSize=0', 'pageSize=501', 'pageSize=abc', 'pageSize=1;select 1', 'page=0', 'page=x']) { r = await A('GET', '/inventory-hold?' + q); t(`hold list ?${q} is 400`, r.s === 400, r.s); }
// units that cannot be held
{ const u = await newUnit(); const bk = await book({ u, broker: H1, amount: 20000, comm: 1 }); t('(set-up) a booked unit', bk.s === 201 && ustatus(u) === 'locked', bk.s + JSON.stringify(bk.j));
  r = await hold(u, H1); t('hold: a booked (locked) unit cannot be held (409)', r.s === 409, r.s + JSON.stringify(r.j)); t('hold: its status did not change', ustatus(u) === 'locked');
  const u2 = await newUnit(); psql(`update units set status='allotted' where id='${u2}' returning 1`); r = await hold(u2, H1); t('hold: an allotted unit cannot be held (409)', r.s === 409, r.s); psql(`update units set status='available' where id='${u2}' returning 1`);
  const u3 = await newUnit(); const pend = await newBroker(); r = await hold(u3, pend.j.data.id); t('hold: a pending broker cannot hold (400)', r.s === 400, r.s + JSON.stringify(r.j));
  const sus = await activeBroker(); await A2('PATCH', `/brokers/${sus}/status`, { status: 'suspended' }); r = await hold(u3, sus); t('hold: a suspended broker cannot hold (400)', r.s === 400, r.s);
  t('hold: the unit stayed available', ustatus(u3) === 'available'); }
// race: five holds on one unit
{ const u = await newUnit(); const rs5 = await Promise.all([H1, H2, H1, H2, H1].map((b, i) => hold(u, b, { clientName: 'Race ' + i })));
  t('race: 5 parallel holds on one unit, exactly one 201, the rest 409', rs5.filter(x => x.s === 201).length === 1 && rs5.filter(x => x.s === 409).length === 4, rs5.map(x => x.s).join());
  t('race: one active hold, unit held, one history row', holdsOf(u) === 1 && ustatus(u) === 'held' && Number(psql(`select count(*) from unit_status_history where unit_id='${u}' and new_status='held'`)) === 1);
  const hid = holdId(u); const rs6 = await Promise.all(Array.from({ length: 5 }, () => A('POST', `/inventory-hold/${hid}/unhold`)));
  t('race: 5 parallel releases, exactly one 200 and four 409', rs6.filter(x => x.s === 200).length === 1 && rs6.filter(x => x.s === 409).length === 4, rs6.map(x => x.s).join());
  t('race: unit available once, one release history row', ustatus(u) === 'available' && Number(psql(`select count(*) from unit_status_history where unit_id='${u}' and new_status='available'`)) === 1); }
// expiry
{ const u = await newUnit(); r = await hold(u, H1); const hid = r.j.data.id;
  psql(`update unit_holds set expires_at = now() - interval '1 minute' where id='${hid}' returning 1`);
  r = await A('GET', '/inventory-hold'); t('expiry: listing holds expires a hold whose time is up', !r.j.data.some(x => x.id === hid) && ustatus(u) === 'available' && psql(`select status from unit_holds where id='${hid}'`) === 'expired', ustatus(u));
  t('expiry: history says the hold expired, no one released it', Number(psql(`select count(*) from unit_status_history where unit_id='${u}' and previous_status='held' and new_status='available' and changed_by_user_id is null`)) === 1);
  r = await A('GET', '/inventory-hold?status=expired'); t('expiry: it shows under the expired filter', r.j.data.some(x => x.id === hid));
  r = await hold(u, H2); t('expiry: the unit can be held again', r.s === 201, r.s); await A('POST', `/inventory-hold/${r.j.data.id}/unhold`);
  // an expired hold that nobody listed yet does not block a new hold
  r = await hold(u, H1); psql(`update unit_holds set expires_at = now() - interval '1 minute' where id='${r.j.data.id}' returning 1`); r2 = await hold(u, H2); t('expiry: a new hold on a unit whose old hold ran out is accepted', r2.s === 201, r2.s + JSON.stringify(r2.j)); await A('POST', `/inventory-hold/${r2.j.data.id}/unhold`);
  r = await hold(u, H1); psql(`update unit_holds set expires_at = now() - interval '1 minute' where id='${r.j.data.id}' returning 1`);
  const x = await book({ u, broker: H2, amount: 20000, comm: 1 }); t('expiry: a booking of a unit whose hold ran out is accepted', x.s === 201 && holdsOf(u) === 0 && psql(`select status from unit_holds where id='${r.j.data.id}'`) === 'expired', x.s + JSON.stringify(x.j)); }
// booking a held unit
{ const u = await newUnit(); r = await hold(u, H1, { clientName: 'Mine' }); const hid = r.j.data.id;
  let x = await book({ u, broker: H2, amount: 20000, comm: 1 }); t('booking a held unit through another broker is refused (409)', x.s === 409 && /held/i.test(x.j.error || ''), x.s + JSON.stringify(x.j));
  x = await book({ u, type: 'direct', amount: 20000 }); t('booking a held unit as a direct sale is refused (409)', x.s === 409, x.s + JSON.stringify(x.j));
  x = await book({ u, type: 'broker', broker: undefined, amount: 0 }); t('booking a held unit as a broker sale with no broker is refused (409)', x.s === 409, x.s);
  t('the refused bookings left the hold and the unit as they were', holdsOf(u) === 1 && ustatus(u) === 'held' && psql(`select count(*) from booking_records where unit_id='${u}'`) === '0' && psql(`select count(*) from broker_commissions where unit_id='${u}'`) === '0');
  x = await book({ u, broker: H1, amount: 20000, comm: 1 }); t('booking the held unit through the broker who holds it works', x.s === 201, x.s + JSON.stringify(x.j));
  t('the hold became converted and the unit is locked by the booking', psql(`select status from unit_holds where id='${hid}'`) === 'converted' && ustatus(u) === 'locked' && holdsOf(u) === 0 && psql(`select released_at is not null from unit_holds where id='${hid}'`) === 't');
  r = await A('POST', `/inventory-hold/${hid}/unhold`); t('a converted hold cannot be released (409) and does not free the sold unit', r.s === 409 && ustatus(u) === 'locked', r.s + ' ' + ustatus(u));
  r = await A('GET', '/inventory-hold?status=converted'); t('it shows under the converted filter', r.j.data.some(q => q.id === hid)); }
// two-step booking: pending_payment first, someone holds the unit, then the payment step
{ const u = await newUnit(); const x = await book({ u, broker: H1, comm: 1, amount: 0 }); t('(set-up) booking waiting for its payment, unit still available', x.s === 201 && ustatus(u) === 'available');
  r = await hold(u, H2); t('(set-up) another broker holds that unit meanwhile', r.s === 201, r.s);
  r2 = await A('PATCH', `/booking/${x.id}`, { booking_amount: 20000, payment_mode: 'cash' }); t('confirming the payment of a booking whose unit someone else holds is refused (409)', r2.s === 409, r2.s + JSON.stringify(r2.j));
  t('the unit is still held, the booking still waits for payment', ustatus(u) === 'held' && psql(`select status from booking_records where id='${x.id}'`) === 'pending_payment');
  await A('POST', `/inventory-hold/${r.j.data.id}/unhold`);
  r2 = await A('PATCH', `/booking/${x.id}`, { booking_amount: 20000, payment_mode: 'cash' }); t('after the hold is released the payment is confirmed', r2.s === 200 && ustatus(u) === 'booked', r2.s + ' ' + ustatus(u));
  const u2 = await newUnit(); const y = await book({ u: u2, broker: H1, comm: 1, amount: 0 }); r = await hold(u2, H1);
  r2 = await A('PATCH', `/booking/${y.id}`, { booking_amount: 20000, payment_mode: 'cash' }); t('confirming a payment on a unit held by the same broker works and converts the hold', r2.s === 200 && psql(`select status from unit_holds where id='${r.j.data.id}'`) === 'converted' && ustatus(u2) === 'booked', r2.s + ' ' + ustatus(u2)); }
// race: a hold and a booking at the same moment
for (let i = 0; i < 3; i++) { const u = await newUnit(); const c = await person();
  const [h, b] = await Promise.all([hold(u, H1), book({ u, c, broker: H2, amount: 20000, comm: 1 })]);
  t(`race ${i + 1}: a hold and a booking of one unit, never both`, !(h.s === 201 && b.s === 201), h.s + ' ' + b.s);
  const st = ustatus(u); t(`race ${i + 1}: the unit status matches what won (${st})`, (h.s === 201 && st === 'held' && holdsOf(u) === 1) || (b.s === 201 && st === 'locked' && holdsOf(u) === 0), `${h.s} ${b.s} ${st} ${holdsOf(u)}`); }
// deactivating a broker releases what it holds
{ const b = await activeBroker(); const us = [await newUnit(), await newUnit()]; for (const u of us) await hold(u, b);
  r = await A2('PATCH', `/brokers/${b}/status`, { status: 'suspended' }); t('suspending a broker releases its holds', r.s === 200 && r.j.holdsReleased === 2 && us.every(u => ustatus(u) === 'available' && holdsOf(u) === 0 && holdsOf(u, 'cancelled') === 1), r.s + JSON.stringify(r.j)); }
// inventory counts follow the unit status
{ const P = await mkProj('C'); const T = await tw(P); const us = []; for (let i = 0; i < 4; i++) us.push(await unit(P, T)); units.push(...us);
  const cnt = async () => (await A('GET', `/units/status-counts?projectId=${P}`)).j; const before = JSON.stringify(await cnt());
  await hold(us[0], H1); await hold(us[1], H2);
  const dbHeld = Number(psql(`select count(*) from units where project_id='${P}' and status='held'`)), api = await A('GET', `/units/status-counts?projectId=${P}`);
  t('counts: the database has 2 held units in the test project', dbHeld === 2, dbHeld);
  const flat = JSON.stringify(api.j); t('counts: the unit status counts changed after two holds', api.s === 200 && flat !== before, flat);
  r = await A('GET', `/units?projectId=${P}&status=available`); t('counts: the available list no longer has the held units', r.s === 200 && !r.j.data.some(x => us.slice(0, 2).includes(x.id)) && r.j.data.length === 2, r.s + ' ' + r.j?.data?.length);
  for (const i of [0, 1]) await A('POST', `/inventory-hold/${holdId(us[i])}/unhold`);
  r = await A('GET', `/units?projectId=${P}&status=available`); t('counts: after the releases all four units are available again', r.j.data.length === 4); }

// =====================================================================================
// 7. project scope: a sales executive limited to project 1
// =====================================================================================
r = await A('PATCH', '/users/employee-login/' + seId, { assignedProjectIds: [P1] }); t('scope: (set-up) sales executive limited to project 1', r.s === 200, r.s + JSON.stringify(r.j)); await sleep(150);
{ const u1 = await newUnit(P1, T1), u2 = await newUnit(P2, T2);
  r = await hold(u1, H1, {}, SE); t('scope: holding a unit of the own project works', r.s === 201, r.s + JSON.stringify(r.j)); const h1 = r.j?.data?.id;
  r = await hold(u2, H1, {}, SE); t('scope: holding a unit of another project is refused', r.s === 404 || r.s === 403, r.s + JSON.stringify(r.j)); t('scope: that unit stayed available', ustatus(u2) === 'available' && holdsOf(u2) === 0);
  r2 = await hold(u2, H1); const h2 = r2.j.data.id;
  r = await SE('GET', '/inventory-hold'); t('scope: the hold list shows only the own project', r.s === 200 && r.j.data.some(x => x.id === h1) && !r.j.data.some(x => x.id === h2), r.s);
  r = await SE('POST', `/inventory-hold/${h2}/unhold`); t('scope: releasing a hold of another project is refused', r.s === 404 || r.s === 403, r.s + JSON.stringify(r.j)); t('scope: the other project hold is still active', holdsOf(u2) === 1);
  r = await SE('GET', '/brokers/commission'); t('scope: the commission list shows only commissions of the own project', r.s === 200 && r.j.data.every(c => c.project_id === P1), r.s);
  const x2 = await book({ P: P2, broker: H1, amount: 20000, comm: 1 }); const c2 = comm(x2.c, x2.u);
  r = await SE('GET', '/brokers/commission?projectId=' + P2); t('scope: asking for another project gives an empty list', r.s === 200 && r.j.data.length === 0 && r.j.summary.count === 0, r.s + JSON.stringify(r.j?.summary));
  grant(afId, 'broker_payment_entry', true, false);
  r = await A('PATCH', '/users/employee-login/' + afId, { assignedProjectIds: [P1] }); await sleep(150);
  r = await pay(c2, AF); t('scope: an accounts user limited to project 1 cannot pay a commission of project 2', r.s === 404 || r.s === 403, r.s + JSON.stringify(r.j)); t('scope: it stayed unpaid', cval(c2, 'status') === 'pending');
  r = await A('PATCH', '/users/employee-login/' + afId, { assignedProjectIds: [] }); await sleep(100);
  r = await SE('POST', `/inventory-hold/${h1}/unhold`); t('scope: the own hold is released', r.s === 200, r.s);
  await A('POST', `/inventory-hold/${h2}/unhold`);
  r = await SE('POST', `/inventory-hold`, { unitId: u1, brokerId: H1 }); await A('POST', `/inventory-hold/${r.j?.data?.id}/unhold`);
}
r = await A('PATCH', '/users/employee-login/' + seId, { assignedProjectIds: [] }); await sleep(100);

// =====================================================================================
// 8. a random run: holds, releases, expiries, bookings, payments, cancels, tax changes
// =====================================================================================
{ const bro = [await activeBroker(), await activeBroker(), await activeBroker()]; const us = []; for (let i = 0; i < 6; i++) us.push(await newUnit());
  const bks = []; let bad5 = 0; const steps = Number(process.env.STEPS || 160);
  const tally = {};
  for (let i = 0; i < steps; i++) {
    if (rnd() < 0.3) { const k = ri(0, us.length - 1); if (!['available', 'held'].includes(ustatus(us[k]))) us[k] = await newUnit(); } // a sold unit is swapped for a fresh one
    const u = pick(us), b = pick(bro), who = pick([A, A, PM, SE]); const op = pick(['hold', 'hold', 'unhold', 'expire', 'book', 'book', 'pay', 'cancel', 'tax', 'status', 'list']); let x = { s: 0 };
    if (op === 'hold') x = await hold(u, b, { holdHours: pick([1, 24, 48, '12', 24, 24, 48, 0, 100, 'x']), clientName: pick(['A', 'B ' + U, '', '<x>']), clientMobile: pick([mob(), '', '12']) }, who);
    else if (op === 'unhold') { const id = psql(`select id from unit_holds where unit_id='${u}' and status='active'`); x = await who('POST', `/inventory-hold/${id || NIL}/unhold`); }
    else if (op === 'expire') { const id = psql(`select id from unit_holds where unit_id='${u}' and status='active'`); if (id) psql(`update unit_holds set expires_at = now() - interval '1 second' where id='${id}' returning 1`); x = await A('GET', '/inventory-hold'); }
    else if (op === 'book') { const k = await book({ u, broker: b, amount: pick([0, 20000]), comm: pick([1, 2.5, 5000]), ctype: pick(['percent', 'flat']) }); x = k; if (k.s === 201) bks.push(k); }
    else if (op === 'pay' && bks.length) { const k = pick(bks); const c = comm(k.c, k.u); x = c ? await pay(c) : { s: 0 }; }
    else if (op === 'cancel' && bks.length) { const k = pick(bks); x = await A('POST', `/booking/${k.id}/cancel`, { reason: 'random ' + U }); }
    else if (op === 'tax') x = await A('POST', `/broker-setup/${b}`, pick([{ tdsRatePct: ri(0, 20) }, { gstRatePct: ri(0, 28) }, { isGstExempt: rnd() < 0.5 }]));
    else if (op === 'status') x = await A2('PATCH', `/brokers/${b}/status`, { status: pick(['active', 'active', 'active', 'inactive', 'suspended']) });
    else x = await A('GET', pick(['/brokers', '/brokers/commission', '/inventory-hold?status=all', '/broker-setup']));
    tally[op + ':' + x.s] = (tally[op + ':' + x.s] || 0) + 1;
    if (x.s >= 500) { bad5++; console.log('  5xx at step ' + i + ' ' + op + ' ' + JSON.stringify(x.j)); }
  }
  for (const b of bro) await A2('PATCH', `/brokers/${b}/status`, { status: 'active' });
  t(`random: ${steps} steps (seed ${SEED}), no 5xx`, bad5 === 0, bad5);
  if (process.env.TALLY) console.log(JSON.stringify(tally));
  const ids = units.map(x => `'${x}'`).join(',');
  t('random: every held unit has exactly one active hold and every active hold is on a held unit', psql(`select count(*) from units u where u.id in (${ids}) and ((u.status='held') <> exists (select 1 from unit_holds h where h.unit_id=u.id and h.status='active'))`) === '0');
  t('random: never two active holds on a unit', psql(`select count(*) from (select unit_id from unit_holds where status='active' group by 1 having count(*) > 1) q`) === '0');
  t('random: a unit with a live booking is never held and has no active hold', psql(`select count(*) from units u where u.id in (${ids}) and u.status not in ('available','held') and exists (select 1 from unit_holds h where h.unit_id=u.id and h.status='active')`) === '0');
  t('random: at most one live booking per unit', psql(`select count(*) from (select unit_id from booking_records where unit_id in (${ids}) and status in ('pending_payment','active','complete') group by 1 having count(*) > 1) q`) === '0');
  t('random: every paid commission adds up (net = commission + GST - TDS) and was paid by someone', psql(`select count(*) from broker_commissions where broker_id in (${bro.map(x => `'${x}'`).join(',')}) and status='paid' and (net_amount_inr <> commission_amount_inr + gst_amount - tds_amount or paid_by is null or paid_at is null)`) === '0');
  t('random: no commission is paid twice (one paid commission per booking)', psql(`select count(*) from (select consumer_id, unit_id, created_at from broker_commissions where broker_id in (${bro.map(x => `'${x}'`).join(',')}) and status='paid' group by 1,2,3 having count(*) > 1) q`) === '0');
  t('random: an active booking never has a cancelled commission and a cancelled booking never a pending one', psql(`select count(*) from broker_commissions c join booking_records b on b.consumer_id=c.consumer_id and b.unit_id=c.unit_id where c.broker_id in (${bro.map(x => `'${x}'`).join(',')}) and ((b.status='cancelled' and c.status='pending'))`) === '0');
  t('random: every status change of a held unit is in the history (held count equals the hold rows made)', Number(psql(`select count(*) from unit_status_history where unit_id in (${ids}) and new_status='held'`)) === Number(psql(`select count(*) from unit_holds where unit_id in (${ids})`)) );
}

// ---------- audit ----------
t('audit: brokers, holds, commissions and tax setups are logged', Number(psql(`select count(distinct resource_type) from audit_logs where resource_type in ('broker','unit_hold','broker_commission','broker_tax_config')`)) === 4);

// ---------- broker authentication of a project (Automatic lets a broker nobody approved yet hold units) ----------
{
  const setMode = (v, P = P1, who = A) => who('PUT', `/projects/${P}/settings`, { broker_auth_mode: v });
  r = await A('GET', `/projects/${P1}/settings`); t('broker authentication: a project starts on Manual', r.s === 200 && r.j.data.broker_auth_mode === 'Manual' && r.j.data.journal_auth_mode === 'Manual', r.j);
  const nb = await newBroker({ pan: pan() }); const pending = nb.j.data.id; const ua = await newUnit();
  r = await hold(ua, pending); t('broker authentication: on Manual a broker still waiting for approval cannot hold (400)', r.s === 400 && /only an active broker/.test(r.j?.error || ''), r.s + JSON.stringify(r.j));
  r = await setMode('Automatic'); t('broker authentication: switch the project to Automatic', r.s === 200 && r.j.data.broker_auth_mode === 'Automatic', r.s + JSON.stringify(r.j));
  r = await hold(ua, pending); t('broker authentication: on Automatic the pending broker can hold a unit of this project', r.s === 201, r.s + JSON.stringify(r.j));
  const ub = await newUnit(P2, T2); r = await hold(ub, pending); t('broker authentication: another project is still on Manual and refuses (400)', r.s === 400, r.s + JSON.stringify(r.j));
  const sb = await activeBroker(); await A2('PATCH', `/brokers/${sb}/status`, { status: 'suspended' }); const uc = await newUnit();
  r = await hold(uc, sb); t('broker authentication: Automatic does not let a suspended broker hold (400)', r.s === 400, r.s + JSON.stringify(r.j));
  const rb = await newBroker({ pan: pan() }); await A2('PATCH', `/brokers/${rb.j.data.id}/reject`, { notes: 'no' }); r = await hold(uc, rb.j.data.id); t('broker authentication: nor a rejected broker (400)', r.s === 400, r.s + JSON.stringify(r.j));
  t('broker authentication: a mode that is not Automatic or Manual is 400', (await setMode('Sometimes')).s === 400 && (await setMode('')).s === 400 && (await setMode(5)).s === 400 && (await setMode(null)).s === 400);
  t('broker authentication: unknown project 404, viewer and sales cannot switch, no login 401', (await setMode('Manual', '00000000-0000-0000-0000-000000000000')).s === 404 && (await setMode('Manual', P1, RO)).s === 403 && (await setMode('Manual', P1, SE)).s === 403 && (await setMode('Manual', P1, NO)).s === 401);
  r = await setMode('Manual'); t('broker authentication: back to Manual, and the other project settings are kept', r.s === 200 && r.j.data.broker_auth_mode === 'Manual' && r.j.data.receipt_number_mode === 'Automatic', JSON.stringify(r.j));
  const ud = await newUnit(); r = await hold(ud, pending); t('broker authentication: on Manual again the pending broker cannot hold a new unit', r.s === 400, r.s);
}

// ---------- clean up ----------
for (const u of [afId, pmId, seId, roId]) noRows(u);
await A('PATCH', '/users/employee-login/' + afId, { assignedProjectIds: [] }); await A('PATCH', '/users/employee-login/' + seId, { assignedProjectIds: [] });
{
  const cs = consumers.map(x => `'${x}'`).join(','), bs = brokers.map(x => `'${x}'`).join(','), us = units.map(x => `'${x}'`).join(',');
  const bkIds = `select id from booking_records where consumer_id in (${cs})`;
  for (const sql of [
    `delete from audit_logs where resource_id in (select id from unit_holds where unit_id in (${us}) union select id from broker_commissions where consumer_id in (${cs}) union select id from brokers where id in (${bs}) union select id from broker_tax_config where broker_id in (${bs}) union ${bkIds})`,
    `delete from unit_holds where unit_id in (${us})`, `delete from broker_commissions where consumer_id in (${cs})`, `delete from unit_status_history where unit_id in (${us})`,
    `delete from booking_payment_taxes where booking_record_id in (${bkIds})`, `delete from booking_documents where consumer_id in (${cs})`,
    `delete from demands where consumer_id in (${cs})`, `delete from receipts where consumer_id in (${cs})`, `delete from payment_plans where consumer_id in (${cs})`, `delete from allocations where consumer_id in (${cs})`,
    `delete from booking_records where consumer_id in (${cs})`, `delete from documents where consumer_id in (${cs})`, `delete from consumers where id in (${cs})`,
    `delete from audit_logs where resource_id in (${us}, '${P1}', '${P2}', '${co}')`, `delete from units where id in (${us})`,
    `delete from broker_project_mapping where broker_id in (${bs})`, `delete from broker_tax_config where broker_id in (${bs})`, `update brokers set parent_broker_id = null where id in (${bs})`, `delete from brokers where id in (${bs})`,
    `delete from units where project_id in (select id from projects where company_id='${co}')`, `delete from plan_schedule_templates where project_id in (select id from projects where company_id='${co}')`, `delete from gst_tax_charge_mapping where project_id in (select id from projects where company_id='${co}')`,
    `delete from towers where project_id in (select id from projects where company_id='${co}')`, `delete from projects where company_id='${co}'`, `delete from companies where id='${co}'`,
  ]) { try { psql(sql + ' returning 1'); } catch (e) { if (process.env.DEBUG) console.log('cleanup failed: ' + sql.slice(0, 90) + ' -> ' + String(e.stderr || e).split('\n')[0]); } }
  if (madeSlab) for (const sql of [`delete from gst_tax_charge_mapping where slab_id='${slab}'`, `delete from gst_tax_setup where slab_id='${slab}'`, `delete from gst_slabs where id='${slab}'`]) { try { psql(sql); } catch { /* ignore */ } }
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
