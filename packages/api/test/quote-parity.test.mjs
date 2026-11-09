// Parity test for src/utils/quote.ts. Run:  cd packages/api && npx tsx --test test/quote-parity.test.mjs
// Regenerate fixtures (only to record a deliberate, signed-off change):  UPDATE_GOLDEN=1 npx tsx --test test/quote-parity.test.mjs
//
// The "legacy" outputs come from the REAL source lines of the three existing paths, cut out of the files and run
// as they are (no copy of the formulas lives in this test). If someone edits those lines, the cut fails loudly
// ("source drifted"), so the golden fixtures cannot silently go stale.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { quoteLegacy } from '../src/utils/quote.ts';
import { computeBalconyCharge } from '../src/utils/balcony-charge.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.resolve(here, rel), 'utf8');
const BOOKING_TS = read('../src/routes/booking.ts');
const BOOKING_JS = read('../../web/public/js/pages/booking.js');
const GOLDEN = path.resolve(here, 'fixtures/quote-golden.json');

// cut the text from the line containing `from` to the end of the line containing `to`
function cut(src, from, to, label) {
  const a = src.indexOf(from);
  assert.ok(a >= 0, `source drifted: ${label} start not found`);
  const b = src.indexOf(to, a);
  assert.ok(b >= 0, `source drifted: ${label} end not found`);
  const end = src.indexOf('\n', b);
  return src.slice(src.lastIndexOf('\n', a) + 1, end);
}
const js = (code) => ts.transpileModule(code, { compilerOptions: { target: 'ES2020' } }).outputText;
const run = (code, vars, ret) => new Function(...Object.keys(vars), `${js(code)}\nreturn {${ret}};`)(...Object.values(vars));

// the exact lines of each path
const PREVIEW_SRC = [
  cut(BOOKING_JS, 'const basicCost          = basicPrice * carpetAreaNum;', 'basicPrice * carpetAreaNum;', 'preview basicCost'),
  cut(BOOKING_JS, 'const balconyInclusiveTotal =', 'balconySgstAmount;', 'preview balcony total'),
  cut(BOOKING_JS, 'const subTotal    =', 'otherAmt;', 'preview subTotal'),
  cut(BOOKING_JS, 'const cgstAmt     =', 'sgstPct / 100;', 'preview tax'),
  cut(BOOKING_JS, 'const inauguralDisc = parseFloat(qval(', '|| 0;', 'preview discount'),
  cut(BOOKING_JS, 'const grandTotal  =', 'balconyInclusiveTotal;', 'preview grandTotal'),
].join('\n');
const SAVE_SRC = [
  cut(BOOKING_TS, 'const basicCost = (bookingRate > 0 && trueCarpetArea > 0)', 'unitBasePriceInr;', 'save basicCost'),
  cut(BOOKING_TS, 'const totalAmount = basicCost', '+ balconyChargeAmount;', 'save totalAmount'),
].join('\n');
const SAVE_UNIT_PRICE_SRC = cut(BOOKING_TS, 'const unitBasePriceInr = parseInt(', 'base_price_inr || 0);', 'save unit price');
const FILE_SRC = cut(BOOKING_TS, 'const carpetArea       = parseFloat(b.carpet_area_sqft', 'const totalWithTax       = totalConsideration + totalTax;', 'file block');

const legacy = (s) => {
  // what save wrote into booking_records, and what the preview endpoint returns, both via the shared balcony function
  const bal = computeBalconyCharge(s.trueBalconyArea, s.balconyRate, s.balconyCap, s.basicCgstFraction, s.basicSgstFraction, s.balconyMaxArea);
  const pv = run(PREVIEW_SRC, {
    basicPrice: s.formBasicRate, carpetAreaNum: s.formCarpetArea, plcAmt: s.plc, otherAmt: s.other,
    balconyChargeAmount: s.previewBalcony.charge, balconyCgstAmount: s.previewBalcony.cgst, balconySgstAmount: s.previewBalcony.sgst,
    cgstPct: s.formCgstPct, sgstPct: s.formSgstPct, qval: () => String(s.inauguralDiscount),
  }, 'basicCost, subTotal, cgstAmt, sgstAmt, balconyInclusiveTotal, grandTotal');
  const unitRow = { rows: [{ base_price_inr: s.unitBasePrice }] };
  const unitBasePriceInr = run(SAVE_UNIT_PRICE_SRC, { unitRow }, 'unitBasePriceInr').unitBasePriceInr;
  const sv = run(SAVE_SRC, {
    bookingRate: s.bookingRate, trueCarpetArea: s.trueCarpetArea, unitBasePriceInr,
    booking: { plc_amount: s.plc, other_charge_amount: s.other, company_inaugural_disc: s.inauguralDiscount, approved_rebate_amount: s.approvedRebate },
    balconyChargeAmount: bal.balconyChargeAmount,
  }, 'basicCost, totalAmount');
  const b = {
    carpet_area_sqft: s.trueCarpetArea, super_area_sqft: 0, balcony_area_sqft: s.trueBalconyArea, basic_rate_inr_sqft: s.bookingRate,
    base_price_inr: s.unitBasePrice, company_inaugural_disc: s.inauguralDiscount, plc_amount: s.plc, other_charge_amount: s.other,
    balcony_charge_amount: bal.balconyChargeAmount, balcony_cgst_amount: bal.balconyCgstAmount, balcony_sgst_amount: bal.balconySgstAmount,
    cgst_pct: s.fileCgstPct, sgst_pct: s.fileSgstPct, interest_amount: 0, booking_amount: 0,
  };
  const demands = s.activeDemandCount ? Array.from({ length: s.activeDemandCount }, (_, k) => ({
    status: 'pending', cgst_amount: k === 0 ? s.activeDemandCgstSum : 0, sgst_amount: k === 0 ? s.activeDemandSgstSum : 0,
  })) : [];
  const fl = run(FILE_SRC, {
    b, consumer: { nationality: s.isGstExempt ? 'NRI' : 'Indian' }, addonCharges: s.addonTotal ? [{ total_amount: s.addonTotal }] : [],
    demands, otherChargeCgstPct: s.otherChargeCgstPct, otherChargeSgstPct: s.otherChargeSgstPct,
  }, 'netBasicPrice, agreementValue, totalConsideration, cgst, sgst, totalTax, totalWithTax');
  return {
    preview: { basicCost: pv.basicCost, subTotal: pv.subTotal, cgst: pv.cgstAmt, sgst: pv.sgstAmt, balconyInclusiveTotal: pv.balconyInclusiveTotal, grandTotal: pv.grandTotal },
    save: { basicCost: sv.basicCost, balconyChargeAmount: bal.balconyChargeAmount, balconyCgstAmount: bal.balconyCgstAmount, balconySgstAmount: bal.balconySgstAmount, totalAmount: sv.totalAmount },
    file: fl,
  };
};

// ---- scenarios. Synthetic numbers modelled on the QA Cycle 3 report; no real customer data.
const base = {
  formBasicRate: 7333.33349609375, formCarpetArea: 750, formCgstPct: 0.5, formSgstPct: 0.5,
  previewBalcony: { charge: 0, cgst: 0, sgst: 0 },
  bookingRate: 7333.33349609375, trueCarpetArea: 750, unitBasePrice: 5500000, trueBalconyArea: 100,
  plc: 0, other: 0, inauguralDiscount: 0, approvedRebate: 0, addonTotal: 0,
  balconyRate: 1300, balconyCap: 60600, balconyMaxArea: null,
  basicCgstFraction: 0.005, basicSgstFraction: 0.005,
  fileCgstPct: 0.5, fileSgstPct: 0.5, otherChargeCgstPct: 9, otherChargeSgstPct: 9,
  isGstExempt: false, activeDemandCgstSum: 0, activeDemandSgstSum: 0, activeDemandCount: 0,
};
const withPreviewBalcony = (s) => {
  const x = computeBalconyCharge(s.trueBalconyArea, s.balconyRate, s.balconyCap, s.basicCgstFraction, s.basicSgstFraction, s.balconyMaxArea);
  return { ...s, previewBalcony: { charge: x.balconyChargeAmount, cgst: x.balconyCgstAmount, sgst: x.balconySgstAmount } };
};
const SCENARIOS = {
  'cycle3-like: cap 60600, discount 1,00,000, balcony fetch OK': withPreviewBalcony({ ...base, inauguralDiscount: 100000 }),
  'cycle3-like: balcony preview fetch failed (silent 0), save still has balcony': { ...base, inauguralDiscount: 100000 },
  'cap 60000 variant (the Alpha/Beta file figure)': withPreviewBalcony({ ...base, balconyCap: 60000, inauguralDiscount: 100000 }),
  'no balcony area': withPreviewBalcony({ ...base, trueBalconyArea: 0 }),
  'PLC + other charge, no discount': withPreviewBalcony({ ...base, plc: 250000, other: 120000 }),
  'rebate and discount together': withPreviewBalcony({ ...base, inauguralDiscount: 100000, approvedRebate: 25000 }),
  'discount bigger than basic price (negative total)': withPreviewBalcony({ ...base, inauguralDiscount: 6000000 }),
  'rate 0: unit price fallback, fractional price (parseInt vs parseFloat)': withPreviewBalcony({ ...base, bookingRate: 0, formBasicRate: 0, unitBasePrice: 5500000.75 }),
  'NRI GST exempt in file; preview and save still tax': withPreviewBalcony({ ...base, isGstExempt: true }),
  'file uses demand sums when within 1000': withPreviewBalcony({ ...base, activeDemandCount: 3, activeDemandCgstSum: 27800, activeDemandSgstSum: 27800 }),
  'file ignores demand sums when more than 1000 away': withPreviewBalcony({ ...base, activeDemandCount: 3, activeDemandCgstSum: 40000, activeDemandSgstSum: 40000 }),
  'add-on charges present': withPreviewBalcony({ ...base, addonTotal: 15000, other: 50000 }),
  'balcony max chargeable area limited to 40 sqft': withPreviewBalcony({ ...base, balconyMaxArea: 40, balconyCap: null }),
};

const current = Object.fromEntries(Object.entries(SCENARIOS).map(([k, s]) => [k, { input: s, expected: legacy(s) }]));

if (process.env.UPDATE_GOLDEN) {
  fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
  fs.writeFileSync(GOLDEN, JSON.stringify(current, null, 2) + '\n');
}
const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));

test('scenario list matches the golden file', () => {
  assert.deepEqual(Object.keys(golden), Object.keys(SCENARIOS));
});

for (const name of Object.keys(SCENARIOS)) {
  test(`existing source lines still give the golden output: ${name}`, () => {
    assert.deepEqual(legacy(golden[name].input), golden[name].expected);
  });
  test(`quoteLegacy reproduces all three paths exactly: ${name}`, () => {
    assert.deepEqual(quoteLegacy(golden[name].input), golden[name].expected);
  });
}

// the documented differences must stay visible: they are the reason the three paths are not merged yet
test('documented differences are real in the golden data', () => {
  const g = golden['cycle3-like: cap 60600, discount 1,00,000, balcony fetch OK'].expected;
  assert.notEqual(g.preview.grandTotal, g.file.totalWithTax);      // preview is unrounded, the file rounds
  assert.equal(g.file.agreementValue, g.save.totalAmount);         // discount now subtracted in all three
  const f = golden['rate 0: unit price fallback, fractional price (parseInt vs parseFloat)'].expected;
  assert.equal(f.file.netBasicPrice - f.save.basicCost, 0.75);          // save truncates the unit price, the file keeps paise
});
