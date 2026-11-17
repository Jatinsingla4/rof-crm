// ROF ALANTE A-101 reference figures (from the Client Data Audit brief), checked against the live quote and plain integer arithmetic.
// Only figures the brief states are used. The nine receipts (dates, amounts, allocations) are NOT in the brief, so they are not invented here:
// when the audit document is supplied, add them as rows in RECEIPTS below and the excess check will use them.
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

console.log(tally());
process.exit(0);
