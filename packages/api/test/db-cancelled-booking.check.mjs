// DB-backed check for QA-012 / QA-015. Needs a throwaway DB (scripts/make-test-db.sh rof_remed_b1, migrations 096+, then test/fixtures/cancelled-booking-fixture.sql). Run: npx tsx test/db-cancelled-booking.check.mjs
import pg from 'pg';
import { planIsCancelled, cancelledPlanSql } from '../src/utils/booking-state.ts';
const db = new pg.Pool({ host: 'localhost', user: 'postgres', password: 'postgres', database: process.env.DB_NAME || 'rof_remed_b1' });
const plans = (await db.query(`SELECT pp.id, co.name FROM payment_plans pp JOIN consumers co ON co.id = pp.consumer_id ORDER BY co.name`)).rows;
let failed = 0; const ok = (n, c) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); if (!c) failed++; };
for (const p of plans) ok(`${p.name}: planIsCancelled is ${p.name === 'Cancelled Cust'}`, (await planIsCancelled(db, p.id)) === (p.name === 'Cancelled Cust'));
const rows = (await db.query(`SELECT r.amount_received_inr AS amt, r.payment_method AS m, ${cancelledPlanSql('pp')} AS cancelled FROM receipts r JOIN payment_plans pp ON pp.id = r.payment_plan_id ORDER BY r.amount_received_inr`)).rows;
ok('cancelledPlanSql marks only the cancelled booking receipt', rows.filter((r) => r.cancelled).length === 1 && rows.find((r) => r.cancelled).amt === '500');
// QA-015: pending cheques panel rule
const chq = (await db.query(`SELECT COUNT(*)::int n, COALESCE(SUM(r.amount_received_inr),0)::int amt FROM receipts r JOIN payment_plans pp ON pp.id = r.payment_plan_id
  WHERE r.status NOT IN ('cancelled','bounced','cleared') AND r.payment_method::text = 'cheque' AND NOT ${cancelledPlanSql('pp')}`)).rows[0];
ok('pending cheques: live cheque only (no transfer, no cancelled-booking cheque)', chq.n === 1 && chq.amt === 100);
await db.end();
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
