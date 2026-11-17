// ROF ALANTE A-101 reference figures (from the Client Data Audit brief), checked against the live quote and plain integer arithmetic.
// Only figures stated in the client documents are used; nothing is invented.
// the nine receipts are now taken from the QA report of 17 Nov 2026 (section F); entering them in the CRM at their dates is pending ROF decisions (see the NOTE it prints).
// Run against a local test API:  BASE=http://localhost:3096/api node api-test-a101.mjs   (psql must reach the same database)
import { env, project, unit, t, tally, today } from '../receipt-allocation/lib.mjs';

const E = await env(); const P = await project(E, { tag: 'A1' });
const CARPET = 645.743, RATE = 4000, BALCONY = 50000;
const u = await unit(E, P, { price: Math.round(CARPET * RATE), carpet: CARPET });

// 1. price: rate x the true carpet area, to the rupee
const q = await E.A('POST', '/booking/quote', { unit_id: u, basic_price: RATE, plc_amount: BALCONY, booking_date: today() });
const d = q.j?.data || {};
t('quote answers 200', q.s === 200, q.s + JSON.stringify(q.j));
t('basic price = 645.743 x 4,000 = 25,82,972', d.basic_inr === 2582972, d.basic_inr);
// the 50,000 balcony charge is entered as a flat head here, only its sum with the basic price is checked
t('agreement value = 25,82,972 + 50,000 = 26,32,972', d.agreement_value_inr === 2632972, d.agreement_value_inr);

// 2. the brief's own totals, in integer rupees
const AGREEMENT = 2632972, ADDON = 127915, TOTAL_INCL_GST = 2810241, RECEIPTS_TOTAL = 2810787, INT = 271, INT_GST = 3, STATED_EXCESS = 269;
const gstAndAddons = TOTAL_INCL_GST - AGREEMENT;
t('total with GST - agreement - add-ons leaves 49,354 for GST on everything', gstAndAddons - ADDON === 49354, gstAndAddons - ADDON);
const over = RECEIPTS_TOTAL - TOTAL_INCL_GST;
t('receipts exceed the total consideration by 546', over === 546, over);
const computedExcess = over - INT - INT_GST;
// The brief says the excess is 269 and calls it provisional. The arithmetic of its own figures gives 272. That is a finding for finance, not something to force.
t('excess after interest and its GST, worked from the brief figures, is 272', computedExcess === 272, computedExcess);
console.log(`NOTE: the brief states an excess of ${STATED_EXCESS}; its own figures give ${computedExcess} (difference ${computedExcess - STATED_EXCESS}). Not forced; finance to confirm which interest or GST figure the brief meant.`);

// 3. the nine receipts of the client statement (QA report of 17 Nov 2026, section F, read from "Customer info File.pdf"): net rupees, in paise so the sum is exact
const RECEIPTS = [
  ['REC/0129', '2019-12-18', 13164000], ['REC/1029', '2020-03-17', 53318543], ['REC/1432', '2020-09-01', 33241357],
  ['REC/2484', '2021-03-02', 33241300], ['REC/3881', '2021-09-03', 33241400], ['REC/4449', '2022-03-02', 33241300],
  ['REC/5401', '2022-09-05', 33246200], ['REC/6299', '2023-03-01', 33263500], ['REC/7103', '2024-10-05', 15121100],
];
const sumPaise = RECEIPTS.reduce((a, r) => a + r[2], 0);
t('the nine receipts add up to 28,10,787.00', sumPaise === 281078700, sumPaise);
t('the nine receipts are in date order', RECEIPTS.every((r, i) => i === 0 || RECEIPTS[i - 1][1] <= r[1]));
// two bases for the same customer, both arithmetically right (QA report section F): the schedule billed 26,59,305 + add-ons 1,50,939; the contract requires 28,10,241
const BILLED = 2659305 + 150939, CONTRACT = TOTAL_INCL_GST;
t('billed basis: liability 28,10,244, raw excess 543, after interest and its GST 269', BILLED === 2810244 && RECEIPTS_TOTAL - BILLED === 543 && RECEIPTS_TOTAL - BILLED - INT - INT_GST === 269, RECEIPTS_TOTAL - BILLED);
t('contract basis: liability 28,10,241, raw excess 546, after interest and its GST 272', RECEIPTS_TOTAL - CONTRACT === 546 && RECEIPTS_TOTAL - CONTRACT - INT - INT_GST === 272);
t('the 3 rupee gap between the bases is the instalment rounding (schedule 26,32,975 against agreement 26,32,972)', 2632975 - 2632972 === 3 && BILLED - CONTRACT === 3);
console.log('NOTE: the nine receipts cannot be entered in the CRM at their historical dates yet: financial years and GST slabs before FY 2026-27 and a project GSTIN are not configured, and ROF has to decide the historical GST treatment, the weekend due date rule (BR-05) and the allotment date. Pending ROF.');

console.log(tally());
process.exit(0);
