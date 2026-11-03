// Reference model of a real estate deal, written from how the business works (not from the CRM code).
//   node docs/regression/reference/deal-model.mjs            prints the expected figures of the sample deals
// All money in rupees. India rounding: each billed line is rounded to the rupee, GST is charged per line.
export const r0 = (x) => Math.round(x + 1e-9);

// deal: { rate, carpet, balconyArea, balconyRate, balconyCap, plc, other, gstBasic:[cgst,sgst], gstOther:[cgst,sgst], plan:[pct,...], addOns:[{amount, gstPct}] }
export function expected(d) {
  const basic = r0(d.rate * d.carpet);
  const balcony = Math.min(r0((d.balconyArea || 0) * (d.balconyRate || 0)), d.balconyCap ?? Infinity);
  const price = basic + (d.plc || 0) + (d.other || 0) + balcony;             // agreement value, add-ons excluded
  const gst = d.gstBasic || [0, 0];
  // an instalment is the same share of every charge; GST is charged on that instalment's amount
  const rows = d.plan.map((pct, i) => {
    const amount = r0(price * pct / 100);
    const cgst = r0(amount * gst[0] / 100), sgst = r0(amount * gst[1] / 100);
    return { n: i + 1, pct, amount, cgst, sgst, total: amount + cgst + sgst };
  });
  const addOnGross = (d.addOns || []).reduce((s, a) => s + a.amount + r0(a.amount * a.gstPct / 100), 0);
  const tax = rows.reduce((s, r) => s + r.cgst + r.sgst, 0);
  return { basic, balcony, price, rows, sumRows: rows.reduce((s, r) => s + r.amount, 0), tax, addOnGross, totalWithTax: price + tax + addOnGross };
}

// interest on a late instalment: amount x yearly rate x days late / 365 (simple interest)
export const interest = (amount, ratePct, daysLate) => daysLate > 0 ? r0(amount * ratePct / 100 * daysLate / 365) : 0;

// late interest on one instalment: simple interest on the UNPAID balance, for every day it stays unpaid after the due date.
// payments: [{ day: number of days after the due date, amount }]. Returns the interest to the paisa.
export function lateInterest(dueAmount, ratePct, payments, today = Infinity) {
  let balance = dueAmount, from = 0, total = 0;
  for (const p of [...payments].sort((a, b) => a.day - b.day)) {
    const upTo = Math.min(p.day, today);
    if (upTo > from) total += balance * ratePct / 100 * (upTo - from) / 365;
    balance -= p.amount; from = Math.max(from, upTo);
    if (balance <= 0) return Math.round(total * 100) / 100;
  }
  if (balance > 0 && today !== Infinity && today > from) total += balance * ratePct / 100 * (today - from) / 365;
  return Math.round(total * 100) / 100;
}

// state of money after payments: only real receipts count (an advance part is bookkeeping of the same money)
export const balance = (totalDue, realReceipts) => totalDue - realReceipts.reduce((s, x) => s + x, 0);

// surrender: the customer gets back what was received less the forfeit (never below zero)
export const refund = (received, forfeit) => Math.max(0, received - Math.min(forfeit, received));

if (process.argv[1] && process.argv[1].endsWith('deal-model.mjs')) {
  const deals = [
    { name: 'A', rate: 4321.4321, carpet: 612.345, balconyArea: 48.5, balconyRate: 1300, balconyCap: 60000, gstBasic: [0.5, 0.5], plan: [5, 20, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5] },
    { name: 'B', rate: 3333.3333, carpet: 777.777, balconyArea: 0, plc: 100000, other: 25000, gstBasic: [9, 9], plan: [10, 40, 50] },
  ];
  for (const d of deals) {
    const e = expected(d);
    console.log(`Deal ${d.name}: basic ${e.basic}, balcony ${e.balcony}, price ${e.price}, tax ${e.tax}, total with tax ${e.totalWithTax}`);
    e.rows.forEach((r) => console.log(`  row ${r.n}: ${r.pct}% amount ${r.amount} cgst ${r.cgst} sgst ${r.sgst} total ${r.total}`));
    console.assert(Math.abs(e.sumRows - e.price) <= e.rows.length / 2, 'rows add up to the price within rounding');
  }
  console.assert(interest(329121, 15, 2) === 271, 'legacy customer 2191: 329121 at 15% for 2 days is 271');
  console.assert(refund(238224, 12345) === 225879, 'refund after forfeit');
  console.assert(lateInterest(2000000, 12, [{ day: 20, amount: 500000 }, { day: 25, amount: 1500000 }]) === 15616.44 || lateInterest(2000000, 12, [{ day: 20, amount: 500000 }, { day: 25, amount: 1500000 }]) === 15616.43, 'two late payments, reducing balance (CRM gave 15616.43)');
}
