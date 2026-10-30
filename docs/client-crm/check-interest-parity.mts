// Run: cd packages/api && DB_HOST=/tmp/rofpg DB_PORT=5433 DB_NAME=none JWT_SECRET=x NODE_ENV=development PORT=3999 npx tsx ../../docs/client-crm/check-interest-parity.mts
// The client CRM shows this file's interest as 3,111 (15% ROI, base amounts, delay days -30 / -5 / 57). Ours must give the same.
// (index.ts is imported first only because payment-waterfall pulls in the whole app and needs it loaded in this order.)
await import('../../packages/api/src/index.ts');
const { buildInterestRows } = await import('../../packages/api/src/utils/payment-waterfall.ts');
const receipts = [
  { id: 'r1', amount_received_inr: 643571.42, demand_id: null, installment_index: null, status: 'cleared', received_date: '2023-01-23' },
  { id: 'r2', amount_received_inr: 337955.24, demand_id: null, installment_index: null, status: 'cleared', received_date: '2023-02-17' },
  { id: 'r3', amount_received_inr: 470778.58, demand_id: null, installment_index: null, status: 'cleared', received_date: '2023-04-20' },
];
const demands = [
  { id: 'd1', installment_index: 1, installment_name: 'At the time of booking', due_date: '2023-01-23', amount_due_inr: 527850 },
  { id: 'd2', installment_index: 2, installment_name: 'Within 30 Days of Booking', due_date: '2023-02-22', amount_due_inr: 586500 },
];
const rows = buildInterestRows(receipts as any, demands as any, 15, { asOfDate: new Date('2023-04-20') });
const total = Math.round(rows.reduce((a, r) => a + r.interest_amount, 0));
const days = rows.filter((r) => r.installment_index === 2).map((r) => r.delay_days).join(',');
const ok = total === 3111 && days === '0,0,57';
console.log(`interest ${total} (want 3111), installment 2 delay days ${days} (want 0,0,57)`);
console.log(`RESULT: ${ok ? 1 : 0} passed, ${ok ? 0 : 1} failed`);
process.exit(ok ? 0 : 1);
