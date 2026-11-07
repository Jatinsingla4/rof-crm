// Parity test for the instalment-schedule functions in src/utils/quote.ts (saveSchedule, manualSchedule, fileSchedule).
// Run:  cd packages/api && npx tsx --test test/quote-schedule.test.mjs      Regenerate (signed-off change only): UPDATE_GOLDEN=1
// Like quote-parity.test.mjs, the legacy outputs come from the REAL source lines cut out of booking.ts and demands.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { saveSchedule, manualSchedule, fileSchedule } from '../src/utils/quote.ts';
import { resolveGstForComponents, splitGstAcrossInstalments } from '../src/utils/gst-resolver.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const BOOKING = fs.readFileSync(path.resolve(here, '../src/routes/booking.ts'), 'utf8');
const DEMANDS = fs.readFileSync(path.resolve(here, '../src/routes/demands.ts'), 'utf8');
const GOLDEN = path.resolve(here, 'fixtures/quote-schedule-golden.json');

// text from the line holding `from` to the end of the first `end` found after `after`
function slice(src, from, after, end, label, searchFrom = 0) {
  const a = src.indexOf(from, searchFrom); assert.ok(a >= 0, `source drifted: ${label} start`);
  const m = src.indexOf(after, a); assert.ok(m >= 0, `source drifted: ${label} marker`);
  const e = src.indexOf(end, m); assert.ok(e >= 0, `source drifted: ${label} end`);
  return src.slice(src.lastIndexOf('\n', a) + 1, e + end.length);
}
const js = (c) => ts.transpileModule(c, { compilerOptions: { target: 'ES2020' } }).outputText;
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;

const SAVE_SRC = slice(BOOKING, 'const runShares: number[] = [];', "{ chargeType: 'BALCONY', amount: balconyPortion },", '\n              );', 'save schedule');
assert.ok(DEMANDS.includes('dueDate, Math.round(total * pct), cgstAmount, sgstAmount'), 'source drifted: manual amount expression');
const MANUAL_SRC = slice(DEMANDS, 'const total = Number(plan.total_amount_inr);', "{ chargeType: 'BALCONY', amount: Math.round(balcony * pct) },", '\n          ]);', 'manual schedule');
const P2 = BOOKING.indexOf('function buildApplicantPage2'); assert.ok(P2 > 0, 'source drifted: page 2 builder');
const FILE_SRC = slice(BOOKING, 'const pct        = parseFloat(t.percentage || 0);', 'const netDue     = instAmt', ';', 'file schedule row', P2);

const stubDb = (rates) => ({ query: async (sql, params) => {
  if (/FROM demands/.test(sql)) return { rows: [] };
  const r = rates[params[1]] || rates.BASIC; return { rows: [{ cgst_pct: r.cgstPct, sgst_pct: r.sgstPct }] };
} });

async function legacy(s) {
  const db = stubDb(s.rates);
  const templates = { rows: s.templates.map((t, i) => ({ installment_index: i + 1, installment_name: `I${i + 1}`, percentage: String(t.percentage), flat_amount_inr: t.flat_amount_inr ?? null })) };
  // confirmation path
  const saveRows = [];
  await new AsyncFn('templates', 'booking', 'client', 'projectName', 'bookingDateStr', 'isNri', 'basicCost', 'balconyChargeAmount', 'totalAmount', 'splitGstAcrossInstalments', 'resolveGstForComponents', 'saveRows',
    js(`${SAVE_SRC}\n saveRows.push({ amountDue, cgst: cgstAmount, sgst: sgstAmount }); }`).replace(/^/, ''))(
    templates, { project_id: 'p', plc_amount: s.plc, other_charge_amount: s.other }, db, 'p', '2026-01-01', s.isNri, s.basicCost, s.balconyCharge, s.totalAmount, splitGstAcrossInstalments, resolveGstForComponents, saveRows);
  // manual generator
  const manualRows = [];
  await new AsyncFn('plan', 'templates', 'c', 'projectName', 'businessToday', 'resolveGstForComponents', 'manualRows',
    js(`${MANUAL_SRC}\n manualRows.push({ amountDue: Math.round(total * pct), cgst: cgstAmount, sgst: sgstAmount }); }`).replace(/^/, ''))(
    { total_amount_inr: s.totalAmount, plc_amount: s.plc, other_charge_amount: s.other, balcony_charge_amount: s.balconyCharge, booking_date: '2026-01-01', nationality: s.manualNri ? 'NRI' : 'Indian', project_id: 'p', payment_plan_id: 'pp' },
    templates, db, 'p', () => '2026-01-01', resolveGstForComponents, manualRows);
  // applicant file page 2 rows
  const demandAmountMap = {};
  for (const [k, v] of Object.entries(s.demandRows || {})) demandAmountMap[k] = { amt: v.amt, cgst: v.cgst, sgst: v.sgst, addon: v.addon || 0, addonCgst: v.addonCgst || 0, addonSgst: v.addonSgst || 0 };
  const fileFn = new Function('t', 'basePrice', 'plcAmount', 'otherCharge', 'balconyChargeAmount', 'cgstPct', 'sgstPct', 'demandAmountMap',
    js(`${FILE_SRC}\n return { netBsp, otherInst, instAmt, balconyInst, instCgst, instSgst, netDue };`));
  const fileRows = templates.rows.map((t) => fileFn({ ...t, percentage: t.percentage }, s.basePrice, s.plc, s.other, s.balconyCharge, s.fileCgstPct, s.fileSgstPct, demandAmountMap));
  return { save: saveRows, manual: manualRows, file: fileRows };
}

const PLAN9 = [5, 20, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 0].map((percentage) => ({ percentage }));
const RATES = { BASIC: { cgstPct: 0.5, sgstPct: 0.5 }, PLC: { cgstPct: 0.5, sgstPct: 0.5 }, 'OTHER CHARGE': { cgstPct: 9, sgstPct: 9 }, BALCONY: { cgstPct: 0.5, sgstPct: 0.5 } };
const base = { templates: PLAN9, totalAmount: 5460000, basicCost: 5500000, plc: 0, other: 0, balconyCharge: 60000, isNri: false, manualNri: false, rates: RATES, basePrice: 5500000, fileCgstPct: 0.5, fileSgstPct: 0.5 };
const withDemands = async (s) => ({ ...s, demandRows: Object.fromEntries((await saveSchedule(s)).map((r, i) => [i + 1, { amt: r.amountDue, cgst: r.cgst, sgst: r.sgst }])) });
const SCENARIOS = {
  'Alpha-like: discount 1,00,000, 9-row plan (file rows from stored demands)': await withDemands(base),
  'Alpha-like: same, no stored demands (file falls back to its own arithmetic)': base,
  'Beta-like: no discount, total 55,60,000': await withDemands({ ...base, totalAmount: 5560000 }),
  'plan adds to 95%, so no running-share split': await withDemands({ ...base, templates: PLAN9.map((t, i) => (i === 1 ? { percentage: 15 } : t)) }),
  'flat amount instalment present': { ...base, templates: [{ percentage: 0, flat_amount_inr: 100000 }, ...PLAN9.slice(1)] },
  'PLC and other charge present': await withDemands({ ...base, plc: 250000, other: 120000, totalAmount: 5830000 }),
  'OCI consumer (save and file zero GST, manual path taxes)': { ...base, isNri: true, manualNri: false },
  'NRI consumer (all paths zero GST)': { ...base, isNri: true, manualNri: true },
};
const current = {};
for (const [k, s] of Object.entries(SCENARIOS)) current[k] = { input: s, expected: await legacy(s) };
if (process.env.UPDATE_GOLDEN) fs.writeFileSync(GOLDEN, JSON.stringify(current, null, 2) + '\n');
const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));

test('schedule scenario list matches the golden file', () => assert.deepEqual(Object.keys(golden), Object.keys(SCENARIOS)));
for (const name of Object.keys(SCENARIOS)) {
  test(`existing source lines still give the golden schedule: ${name}`, async () => assert.deepEqual(await legacy(golden[name].input), golden[name].expected));
  test(`saveSchedule, manualSchedule and fileSchedule reproduce them exactly: ${name}`, async () => {
    const i = golden[name].input;
    assert.deepEqual({ save: await saveSchedule(i), manual: await manualSchedule(i), file: fileSchedule({ ...i, templates: i.templates.map((t, k) => ({ ...t, installment_index: k + 1 })) }) }, golden[name].expected);
  });
}
test('documented schedule differences are real in the golden data', () => {
  const g = golden['Alpha-like: discount 1,00,000, 9-row plan (file rows from stored demands)'].expected;
  const sum = (rows, k) => rows.reduce((a, r) => a + r[k], 0);
  assert.equal(sum(g.save, 'amountDue'), 5460000);               // rows add up to the whole discounted total
  assert.equal(sum(g.save, 'cgst') + sum(g.save, 'sgst'), 55600); // GST on the PRE-discount basic price (55,000) + balcony (600)
  assert.ok(sum(g.manual, 'cgst') + sum(g.manual, 'sgst') < 55600); // manual generator taxes the post-discount basic price
  assert.ok(sum(g.file, 'netBsp') > sum(g.file, 'instAmt'));       // NET BSP column is pre-discount, INST AMT is post-discount
});
