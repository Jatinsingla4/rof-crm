// Statutory configuration readiness (QA-003, 029, 046, 049): GET /gst-configuration/readiness lists, read only, what finance has not configured for a date range and who has to act.
// Own company and project (new every run). Run against a local test API:  BASE=http://localhost:3010/api node api-test-readiness.mjs   (psql must reach the same database)
import { env, project, psql, t, tally, today } from '../receipt-allocation/lib.mjs';

const E = await env(); const P = await project(E, { tag: 'SR' });
const get = async (q) => (await E.A('GET', `/gst-configuration/readiness?${q}`));
const td = today(), from = psql(`select ('${td}'::date - 3)::text`);
const itemsOf = (r, key) => (r.j?.data?.projects?.[0]?.items || []).filter((i) => i.key === key);
const one = (r, key) => itemsOf(r, key)[0];

let r = await get(`projectId=${P.proj}&from=${from}&to=${td}`);
t('readiness answers 200 with this project and the global items', r.s === 200 && r.j.data.projects.length === 1 && r.j.data.projects[0].project_id === P.proj && Array.isArray(r.j.data.global.items), r.s + JSON.stringify(r.j).slice(0, 200));
t('the test project has a BASIC rate mapped for the slab in the range (ok)', one(r, 'gst_mapping_basic')?.status === 'ok', JSON.stringify(one(r, 'gst_mapping_basic')));
t('seller GSTIN: the fixture value fails the check-character test and is reported as a conflict for finance', one(r, 'project_gstin')?.status === 'conflict' && one(r, 'project_gstin')?.owner === 'client configuration', JSON.stringify(one(r, 'project_gstin')));
t('the company has no GSTIN: missing, a client configuration item', one(r, 'company_gstin')?.status === 'missing' && one(r, 'company_gstin')?.owner === 'client configuration', JSON.stringify(one(r, 'company_gstin')));
t('HSN/SAC: nothing assigned: missing, and the message says the old default 9972 is not a configured master', one(r, 'hsn_sac')?.status === 'missing' && /9972/.test(one(r, 'hsn_sac')?.message || ''), JSON.stringify(one(r, 'hsn_sac')));
t('RERA: the project has a real number: ok', one(r, 'rera_number')?.status === 'ok', JSON.stringify(one(r, 'rera_number')));
const gl = (k) => r.j.data.global.items.find((i) => i.key === k);
t('global: the invoice number series is listed as a decision', gl('invoice_number_series')?.status === 'decision' && gl('invoice_number_series')?.owner === 'decision');

// the same questions after finance configures: HSN assigned, RERA tab with another number
const hs = psql(`insert into hsn_sac_codes (code, type) values ('995411', 'Service') on conflict (code) do update set is_active = true returning id`).split('\n')[0];
psql(`insert into hsn_sac_code_assign (hsn_sac_id, project_id, charge_type) values ('${hs}', '${P.proj}', 'BASIC') on conflict (project_id, charge_type) do update set hsn_sac_id = excluded.hsn_sac_id returning 1`);
psql(`insert into project_rera_numbers (project_id, rera_number) values ('${P.proj}', 'OTHER-RERA-777') returning 1`);
r = await get(`projectId=${P.proj}&from=${from}&to=${td}`);
t('HSN/SAC assigned: ok', one(r, 'hsn_sac')?.status === 'ok' && /995411/.test(one(r, 'hsn_sac')?.message || ''), JSON.stringify(one(r, 'hsn_sac')));
t('RERA tab holds a different number than the project: reported as a software conflict (no output reads that tab)', one(r, 'rera_tab_unused')?.status === 'conflict' && one(r, 'rera_tab_unused')?.owner === 'software', JSON.stringify(one(r, 'rera_tab_unused')));
psql(`delete from project_rera_numbers where project_id = '${P.proj}' returning 1`);
psql(`delete from hsn_sac_code_assign where project_id = '${P.proj}' returning 1`);

// a range nobody configured: the gaps are named
r = await get(`projectId=${P.proj}&from=2001-01-01&to=2001-12-31`);
const sg = r.j?.data?.global?.items?.find((i) => i.key === 'gst_slabs_cover_range'), fg = r.j?.data?.global?.items?.find((i) => i.key === 'financial_years_cover_range');
t('a range with no GST slab: missing, the gap is the whole range', sg?.status === 'missing' && sg.detail?.gaps?.[0]?.from === '2001-01-01' && sg.detail.gaps[0].to === '2001-12-31', JSON.stringify(sg));
t('a range with no financial year: missing', fg?.status === 'missing' && fg.owner === 'client configuration', JSON.stringify(fg));
t('and no BASIC rate can be mapped there', itemsOf(r, 'gst_mapping_basic')[0]?.status === 'missing');

r = await get(`projectId=${P.proj}&from=${td}&to=2001-01-01`);
t('from after to is refused (400)', r.s === 400, r.s);
r = await get('projectId=abc');
t('a bad projectId is refused (400)', r.s === 400, r.s);
r = await E.SE('GET', `/gst-configuration/readiness?projectId=${P.proj}&from=${from}&to=${td}`);
t('reading is open to a signed-in user (sales executive, 200)', r.s === 200, r.s);
r = await E.NONE('GET', `/gst-configuration/readiness?projectId=${P.proj}`);
t('no login: 401', r.s === 401, r.s);

console.log(`\nRESULT: ${tally()}`);
process.exit(tally().includes(' 0 failed') ? 0 : 1);
