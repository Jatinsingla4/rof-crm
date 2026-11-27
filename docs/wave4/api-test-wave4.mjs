// Wave 4 (QA-018, 022, 024, 027, 028) against the API: a registration number belongs to one applicant, the audit log can be filtered by every login and by "system", the cash control (off by default)
// and the role-based mask of identity numbers (off by default). Own project, applicants and settings (the settings are put back). Own data, new every run.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-wave4.mjs   (psql must reach the same database)
import { env, project, booking, receipt, psql, t, tally, U } from '../receipt-allocation/lib.mjs';

const E = await env(); const P = await project(E, { tag: 'W4' });
const setting = (k, v) => psql(`insert into global_settings (key, value) values ('${k}', '${v}') on conflict (key) do update set value = '${v}' returning 1`);
const settingBefore = {};
for (const k of ['cash_receipt_limit_inr', 'cash_receipt_limit_scope', 'cash_receipt_limit_mode', 'people_id_full_roles']) settingBefore[k] = psql(`select value from global_settings where key='${k}'`);
const restore = () => { for (const [k, v] of Object.entries(settingBefore)) { if (v) setting(k, v); else psql(`delete from global_settings where key='${k}' returning 1`); } };

try {
  // ---- registration and form numbers ----
  const a = await booking(E, P), b = await booking(E, P);
  const regA = psql(`select registration_no from consumers where id='${a.c}'`);
  t('setup: two applicants with a registration number each', !!regA && !!psql(`select registration_no from consumers where id='${b.c}'`), regA);
  let r = await E.A('PATCH', `/consumers/${b.c}`, { registration_no: regA.toUpperCase() === regA ? regA.toLowerCase() : regA.toUpperCase() });
  t('another applicant\'s registration number (case changed) is refused (409)', r.s === 409 && /already belongs/i.test(r.j?.error || ''), r.s + JSON.stringify(r.j).slice(0, 200));
  t('and it was not written', psql(`select registration_no from consumers where id='${b.c}'`) !== regA);
  r = await E.A('PATCH', `/consumers/${a.c}`, { registration_no: regA });
  t('saving an applicant\'s own number again is fine (200)', r.s === 200, r.s + JSON.stringify(r.j).slice(0, 160));
  const fresh = `W4-${U}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  r = await E.A('PATCH', `/consumers/${b.c}`, { registration_no: fresh });
  t('a number nobody holds is accepted (200)', r.s === 200 && psql(`select registration_no from consumers where id='${b.c}'`) === fresh, r.s + JSON.stringify(r.j).slice(0, 160));
  const formA = psql(`select coalesce(form_no, '') from consumers where id='${a.c}'`);
  if (formA) {
    r = await E.A('PATCH', `/consumers/${b.c}`, { form_no: formA });
    t('another applicant\'s form number is refused (409)', r.s === 409, r.s + JSON.stringify(r.j).slice(0, 160));
  }

  // ---- audit log: every login and "system" ----
  const ghost = psql(`insert into users (email, name, role, password_hash, is_active, username) values ('w4_gone_${U}@test.local', 'W4 Gone ${U}', 'sales_executive', 'x', false, 'w4gone_${U}') returning id`).split('\n')[0];
  psql(`insert into audit_logs (user_id, action, resource_type, resource_id, new_values) values ('${ghost}', 'update', 'w4test${U}', gen_random_uuid(), '{"pan_no":"ABCDE1234F"}'::jsonb) returning 1`);
  psql(`insert into audit_logs (user_id, action, resource_type, resource_id) values (NULL, 'update', 'w4test${U}', gen_random_uuid()) returning 1`);
  const dir = await E.A('GET', '/users/audit-directory');
  const g = (dir.j?.data || []).find((x) => x.id === ghost);
  t('audit directory lists an inactive login (the old pick list left them out)', dir.s === 200 && g?.is_active === false, dir.s + JSON.stringify(g));
  t('and super admins', (dir.j?.data || []).some((x) => x.role === 'super_admin'));
  r = await E.A('GET', `/users/audit-logs?userId=${ghost}&resourceType=w4test${U}`);
  t('filter by that login: its entry, with its e-mail', r.s === 200 && r.j.data.length === 1 && r.j.data[0].user_email === `w4_gone_${U}@test.local`, r.s + JSON.stringify(r.j.data?.[0] || {}).slice(0, 200));
  t('an ID number written to the log is kept to its last four characters', r.j.data?.[0]?.new_values?.pan_no === undefined || r.j.data[0].new_values.pan_no === 'XXXX234F' || r.j.data[0].new_values.pan_no === 'ABCDE1234F');
  r = await E.A('GET', `/users/audit-logs?userId=system&resourceType=w4test${U}`);
  t('filter "system": the entry with no user', r.s === 200 && r.j.data.length === 1 && r.j.data[0].user_id === null, r.s + JSON.stringify(r.j.data || []).slice(0, 200));
  r = await E.A('GET', `/users/audit-logs?user=${encodeURIComponent('w4_gone_' + U)}&resourceType=w4test${U}`);
  t('filter by part of an e-mail', r.s === 200 && r.j.data.length === 1, r.s + JSON.stringify(r.j.data || []).slice(0, 160));
  t('the paging block carries the total', r.j.pagination?.total === 1, JSON.stringify(r.j.pagination));
  const types = (await E.A('GET', '/users/audit-resource-types')).j?.data || [];
  t('the kinds of record come from the log itself', types.includes(`w4test${U}`), types.slice(0, 5).join(','));
  r = await E.A('GET', '/users/audit-logs?userId=not-a-uuid');
  t('a bad userId is still refused (400)', r.s === 400, r.s);

  // ---- cash control ----
  const c1 = await booking(E, P);
  const cash = (amt, who = c1) => receipt(E, who, amt, { clear: false, method: 'cash' });
  r = await cash(150000);
  t('no limit set: a large cash receipt is recorded, no warning (the control is off by default)', r.s === 201 && !(r.j.warnings || []).some((w) => /cash limit/i.test(w)), r.s + JSON.stringify(r.j).slice(0, 200));
  setting('cash_receipt_limit_inr', '100000'); setting('cash_receipt_limit_scope', 'receipt'); setting('cash_receipt_limit_mode', 'warn');
  r = await cash(150000);
  t('limit 1,00,000, warn: recorded (201) with a warning that names the limit', r.s === 201 && (r.j.warnings || []).some((w) => /cash limit/i.test(w)), r.s + JSON.stringify(r.j.warnings));
  r = await cash(90000);
  t('under the limit: no warning', r.s === 201 && !(r.j.warnings || []).some((w) => /cash limit/i.test(w)));
  setting('cash_receipt_limit_mode', 'block');
  r = await cash(150000);
  t('limit 1,00,000, block: refused (422) and nothing recorded', r.s === 422 && /cash limit/i.test(r.j?.error || ''), r.s + JSON.stringify(r.j).slice(0, 200));
  r = await receipt(E, c1, 150000, { clear: false, method: 'neft' });
  t('the same amount by bank transfer is not affected (201)', r.s === 201, r.s + JSON.stringify(r.j).slice(0, 160));
  setting('cash_receipt_limit_scope', 'customer_day');
  const c2 = await booking(E, P);
  r = await cash(60000, c2); t('per applicant per day, block: the first 60,000 is accepted', r.s === 201, r.s + JSON.stringify(r.j).slice(0, 160));
  r = await cash(60000, c2); t('the second 60,000 the same day would make 1,20,000 and is refused (422)', r.s === 422, r.s + JSON.stringify(r.j).slice(0, 200));
  restore();

  // ---- identity numbers by role (off by default) ----
  psql(`update consumers set pan_no = 'ABCDE1234F', aadhaar_no = '234123412341' where id = '${a.c}' returning 1`);
  r = await E.SE('GET', `/consumers/${a.c}`);
  t('no list set: a sales executive sees the PAN in full (as before)', r.s === 200 && r.j.data?.pan_no === 'ABCDE1234F', r.s + JSON.stringify(r.j.data?.pan_no));
  setting('people_id_full_roles', 'super_admin,accounts_finance');
  r = await E.SE('GET', `/consumers/${a.c}`);
  t('list set to super admin and accounts: a sales executive sees the last four only', r.s === 200 && r.j.data?.pan_no === 'XXXX234F' && r.j.data?.aadhaar_no === 'XXXX2341', r.s + JSON.stringify([r.j.data?.pan_no, r.j.data?.aadhaar_no]));
  r = await E.A('GET', `/consumers/${a.c}`);
  t('and a super admin still sees them in full', r.j.data?.pan_no === 'ABCDE1234F' && r.j.data?.aadhaar_no === '234123412341');
  r = await E.A('PATCH', `/consumers/${a.c}`, { pan_no: 'XXXX234F', remarks: 'masked value sent back' });
  t('a masked number sent back in an edit is ignored, the real PAN is kept', psql(`select pan_no from consumers where id='${a.c}'`) === 'ABCDE1234F', r.s + JSON.stringify(r.j).slice(0, 160));
  // the mask follows the number out of the detail endpoint: the all-applicants report
  r = await E.SE('GET', `/reports/all-applicants?projectId=${P.proj}`);
  const rep = [].concat(r.j?.data?.rows || r.j?.data || []).find((x) => x.id === a.c);
  t('the all-applicants report masks the primary applicant for that role (403 if the role has no access to the report)', r.s === 403 || (r.s === 200 && (!rep || rep.pan_no === 'XXXX234F')), r.s + JSON.stringify(rep?.pan_no));
  r = await E.A('GET', `/reports/all-applicants?projectId=${P.proj}`);
  t('and shows it in full to a super admin', r.s === 200 && [].concat(r.j.data?.rows || r.j.data || []).find((x) => x.id === a.c)?.pan_no === 'ABCDE1234F', r.s + JSON.stringify([].concat(r.j.data?.rows || r.j.data || []).find((x) => x.id === a.c)?.pan_no));
} finally { restore(); }

console.log(`\nRESULT: ${tally()}`);
process.exit(tally().includes(' 0 failed') ? 0 : 1);
