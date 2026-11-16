// Phase 6: a paged list says how many rows there are in all, so a screen knows when it is showing only a part. For each list below: `total` is there, it does not change
// (in `pagination: { page, pageSize, total }`) with the page asked for or the page size, it equals the rows of the whole list (when that fits in one page), a page holds at most pageSize rows, page 2 continues page 1
// without repeating a row, and a page past the end is empty with the same total. Run against a local test API:
//   BASE=http://localhost:3096/api node api-test-pagination.mjs   (psql must reach the same database)
import { env, project, booking, receipt, t, tally } from '../receipt-allocation/lib.mjs';

const E = await env(); const P = await project(E, { tag: 'PG' });
// enough rows to page: five bookings, each with a booking receipt and one more receipt
for (let i = 0; i < 5; i++) { const b = await booking(E, P, { price: 1000000 + i * 1000 }); await receipt(E, b, 10000 + i); }

const totalOf = (j) => j?.pagination?.total;
const rowsOf = (j) => (Array.isArray(j?.data) ? j.data : []);
const key = (r) => r.id ?? r.unit_id ?? JSON.stringify(r);
const lists = [
  ['/booking', `project_id=${P.proj}`],
  ['/payments/receipts', ''],
  ['/units', `projectId=${P.proj}`],
  ['/users', ''],
  ['/users/audit-logs', ''],
  ['/consumers', ''],
  ['/payments/demands', ''],
];
for (const [path, q] of lists) {
  const get = (extra) => E.A('GET', `${path}?${[q, extra].filter(Boolean).join('&')}`);
  const whole = await get('pageSize=1000'), p1 = await get('pageSize=2&page=1'), p2 = await get('pageSize=2&page=2'), far = await get('pageSize=2&page=100000');
  const all = rowsOf(whole.j), a = rowsOf(p1.j), b2 = rowsOf(p2.j);
  t(`${path}: 200 and a numeric total`, whole.s === 200 && p1.s === 200 && Number.isFinite(Number(totalOf(p1.j))), `${whole.s}/${p1.s} total=${totalOf(p1.j)}`);
  t(`${path}: total is the same for every page and page size (${totalOf(p1.j)})`, totalOf(p1.j) === totalOf(p2.j) && totalOf(p1.j) === totalOf(whole.j) && totalOf(p1.j) === totalOf(far.j), `${totalOf(p1.j)}/${totalOf(p2.j)}/${totalOf(whole.j)}/${totalOf(far.j)}`);
  if (all.length < 500) t(`${path}: total equals the rows of the whole list (${all.length})`, Number(totalOf(whole.j)) === all.length, `${totalOf(whole.j)} vs ${all.length}`);   // 500 is the largest page of some lists
  t(`${path}: a page holds at most pageSize rows and page 2 does not repeat page 1`, a.length <= 2 && b2.length <= 2 && !a.some((r) => b2.some((x) => key(x) === key(r))), `${a.length}/${b2.length}`);
  t(`${path}: a page past the end is empty`, far.s === 200 && rowsOf(far.j).length === 0, `${far.s} ${rowsOf(far.j).length}`);
}
console.log(`\nRESULT: ${tally()}`);
process.exit(tally().includes(' 0 failed') ? 0 : 1);
