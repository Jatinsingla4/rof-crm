// Reports, clicked through in a real browser: every report screen of the Reports menu, every filter option, every button (FETCH, Export CSV, With / Without Tax, Print, drill-downs).
// The set-up (company, bank accounts, project, plan, GST, applicants with raised, paid and late demands, a surrendered one) is made through the API and psql.
// What the screen shows is compared with the database (psql) and with the API: totals, counts, balances.
// A JavaScript error, a console error, a 5xx, or the words "undefined" / "NaN" / "[object Object]" on a report fail the test. EVERY_OPTION=1 clicks every option of every filter (default: the first five).
import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const PASSWORD = 'Test#Pass1234';
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const U = Date.now().toString(36).slice(-5);
const today = new Date().toISOString().slice(0, 10);
const later = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
let seq = 0;
const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');
const sql = (q: string) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8', maxBuffer: 1e8 }).trim();
const num = (q: string) => Number(sql(q) || 0);
const near = (a: number, b: number, e = 1.01) => { const ok = Math.abs(a - b) < e; if (!ok) console.log(`NEAR MISMATCH: screen/API ${a} vs database ${b}`); return ok; };

test.describe.configure({ mode: process.env.SERIAL ? 'serial' : 'default' });
test.use({ actionTimeout: 15_000 });
let page: Page;
let problems: string[] = [];
let token = '';
let downloads: string[] = [];
const api = async (method: string, path: string, body?: any) => {
  const r = await fetch(`${BASE}/api${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j: any = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const must = async (label: string, p: Promise<{ s: number; j: any }>) => { const x = await p; if (x.s >= 300) throw new Error(`${label}: ${x.s} ${JSON.stringify(x.j).slice(0, 300)}`); return x.j.data ?? x.j; };
declare const Utils: any;   // the screens' global helper object (used inside page.evaluate)
const S: Record<string, any> = {};

// ---- the screen text without the project / consumer pick lists (they hold every project name, also old test data) ----
const screenText = () => page.evaluate(() => {
  const el = document.querySelector('#rpt-main') as HTMLElement | null; if (!el) return '';
  const c = el.cloneNode(true) as HTMLElement; c.querySelectorAll('select, option, script, style').forEach(n => n.remove()); return c.innerText;
});
const badWords = async () => { const t = await screenText(); const m = t.match(/.{0,50}(\bundefined\b|\bNaN\b|\[object Object\]|\bInfinity\b).{0,30}/); return m ? m[0] : ''; };

test.beforeAll(async ({ browser }) => {
  token = (await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: PASSWORD }) })).json()).token;
  const co = (await must('company', api('POST', '/companies', { name: `RE Co ${U}` }))).id;
  S.co = co;
  S.bank = sql(`insert into company_bank_accounts (company_id, bank_name, account_number, is_active) values ('${co}', 'RE Bank ${U}', 'RE${U}', true) returning id`);
  let pn = 0;
  const mkProj = async (n: string) => (await must('project', api('POST', '/projects', { companyId: co, name: n, reraNumber: `RE${++pn}-${U}`, tcpLicence: 'x' }))).id;
  S.pn = `RE Project ${U}`; S.pn2 = `RE Second ${U}`;
  S.p1 = await mkProj(S.pn); S.p2 = await mkProj(S.pn2);
  S.tn = `RT1-${U}`; S.tn2 = `RT2-${U}`;
  S.t1 = (await must('tower', api('POST', `/projects/${S.p1}/towers`, { towerName: S.tn }))).id;
  S.t2 = (await must('tower', api('POST', `/projects/${S.p2}/towers`, { towerName: S.tn2 }))).id;
  S.plan = `RE Plan ${U}`; S.plan2 = `RE Plan B ${U}`;
  for (const [P, nm, rows] of [[S.p1, S.plan, [20, 30, 50]], [S.p2, S.plan2, [100]]] as [string, string, number[]][]) { let k = 0; for (const pc of rows) await must('plan', api('POST', `/projects/${P}/plan-templates`, { plan_name: nm, installment_name: `Row ${++k}`, installment_type: k === 1 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: k * 30, installment_index: k })); }
  let slab = (await api('GET', '/gst-configuration/gst-slabs')).j.data.find((x: any) => x.from_date <= today && x.to_date >= today)?.id;
  if (!slab) slab = (await must('slab', api('POST', '/gst-configuration/gst-slabs', { fromDate: later(-3), toDate: later(60) }))).id;
  const tax = (await must('tax', api('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `RE ${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 }))).id;
  for (const P of [S.p1, S.p2]) for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await api('POST', '/gst-configuration/gst-charge-mapping', { projectId: P, slabId: slab, gstTaxId: tax, chargeType: ct });
  // customers: a unit with a price (so GST has paise), a booking with its rate, the booking receipt left pending
  let un = 0, ap = 0;
  const buyer = async (P: string, T: string, planName: string, base: number) => {
    const c = (await must('applicant', api('POST', '/consumers', { name: `Rep Buyer${++ap} ${U}`, mobile: mob(), project_id: P }))).id;
    const u = (await must('unit', api('POST', '/units', { projectId: P, towerId: T, unitNumber: `RU${++un}-${U}`, floor: 2, bhkType: un % 2 ? '2BHK' : '3BHK', carpetAreaSqft: 1000, superAreaSqft: 1200, basePriceInr: base, totalPriceInr: base + 500000 }))).id;
    const b = await must('booking', api('POST', '/booking', { consumer_id: c, project_id: P, unit_id: u, selected_plan_name: planName, booking_date: today }));
    await must('booking payment', api('PATCH', `/booking/${b.id}`, { booking_amount: 10000, payment_mode: 'cash' }));
    sql(`update booking_records set basic_rate_inr_sqft = ${base / 1000}, plc_amount = 20000, other_charge_amount = 3000 where id = '${b.id}' returning 1`);
    return { c, u, b: b.id, name: `Rep Buyer${ap} ${U}`, plan: sql(`select id from payment_plans where consumer_id='${c}' order by created_at desc limit 1`), unit: `RU${un}-${U}` };
  };
  const raise = (B: any, idx: number, days: number) => sql(`update demands set status='demanded', due_date = current_date - ${days}, raised_at = now() where payment_plan_id='${B.plan}' and installment_index=${idx} returning 1`);
  const dem = (B: any, idx: number) => Number(sql(`select amount_due_inr + cgst_amount + sgst_amount from demands where payment_plan_id='${B.plan}' and installment_index=${idx}`));
  const rcp = async (B: any, amt: number, idx: number, st: 'clear' | 'bounce' | 'cancel' | 'pending', o: any = {}) => {
    const id = (await must('receipt', api('POST', '/payments/receipts', { consumerId: B.c, amountReceivedInr: amt, paymentMode: o.mode || 'neft', referenceNumber: `RE${U}-${++seq}`, paymentDate: today, installmentIndex: idx, companyBankAccountId: o.bank, ...(o.mode === 'cheque' ? { chequeNo: `RC${U}${seq}` } : {}) }))).id;
    if (st === 'clear') await must('clear', api('PATCH', `/payments/receipts/${id}/clear`, { clearing_date: today }));
    if (st === 'bounce') await must('bounce', api('PATCH', `/payments/receipts/${id}/bounce`, { reason: 'test' }));
    if (st === 'cancel') await must('cancel', api('POST', `/payments/receipts/${id}/cancel`, { reason: 'test' }));
    return id;
  };
  S.e1 = await buyer(S.p1, S.t1, S.plan, 7000000 + 12345); raise(S.e1, 1, 20); raise(S.e1, 2, 70);
  await rcp(S.e1, Math.floor(dem(S.e1, 1) / 2), 1, 'clear', { bank: S.bank }); await rcp(S.e1, 100000, 2, 'clear', { mode: 'cheque', bank: S.bank }); await rcp(S.e1, 55555, 2, 'bounce'); await rcp(S.e1, 44444, 2, 'cancel'); await rcp(S.e1, 33333, 2, 'pending');
  S.e2 = await buyer(S.p1, S.t1, S.plan, 5000000 + 54321); raise(S.e2, 1, 40); raise(S.e2, 2, -15);
  await rcp(S.e2, dem(S.e2, 1), 1, 'clear', { bank: S.bank }); await rcp(S.e2, Math.floor(dem(S.e2, 2) / 3), 2, 'clear');
  S.e3 = await buyer(S.p1, S.t1, S.plan, 6500000 + 999); raise(S.e3, 1, 200); raise(S.e3, 2, 100); raise(S.e3, 3, 5);
  S.e4 = await buyer(S.p1, S.t1, S.plan, 7500000 + 4321); raise(S.e4, 1, 30); await rcp(S.e4, 300000, 1, 'clear', { bank: S.bank });
  S.e5 = await buyer(S.p1, S.t1, S.plan, 4000000 + 777);
  S.f1 = await buyer(S.p2, S.t2, S.plan2, 3000000 + 2222); raise(S.f1, 1, 95); await rcp(S.f1, 50000, 1, 'bounce'); await rcp(S.f1, 20000, 1, 'cancel'); await rcp(S.f1, 90000, 1, 'clear', { mode: 'cheque' });
  // e4 gives the unit back: out of the dues reports, its cleared money stays in collection
  const al = sql(`select id from allocations where consumer_id='${S.e4.c}' and status not in ('cancelled','transferred') order by created_at desc limit 1`);
  await must('surrender', api('POST', '/surrender', { consumerId: S.e4.c, allocationId: al, bookingId: S.e4.b, unitId: S.e4.u, projectId: S.p1, type: 'surrender', surrenderDate: today }));
  S.live1 = [S.e1, S.e2, S.e3, S.e5];

  page = await browser.newPage({ acceptDownloads: true });
  await page.addInitScript(() => { (window as any).print = () => { (window as any).__printed = ((window as any).__printed || 0) + 1; }; });
  page.on('dialog', d => { d.accept(); });
  page.on('pageerror', e => problems.push(`JavaScript error: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|Blocked script execution in 'about:(srcdoc|blank)'/.test(m.text())) problems.push(`Console error: ${m.text()}`); });
  page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 500) problems.push(`Server error ${r.status()}: ${r.request().method()} ${r.url()}`); });
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill('super_admin@test.local');
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/#\/dashboard/);
});
test.afterAll(async () => {
  await page?.close();
  const ids = [S.e1, S.e2, S.e3, S.e4, S.e5, S.f1].filter(Boolean).map((x: any) => `'${x.c}'`).join(',');
  for (const q of [
    `delete from audit_logs where resource_type in ('surrender','cancellation') and resource_id in (select id from surrender_applications where consumer_id in (${ids}) union select id from cancellations where consumer_id in (${ids}))`,
    `delete from surrender_applications where consumer_id in (${ids})`, `delete from cancellations where consumer_id in (${ids})`,
    `delete from audit_logs where resource_type in ('receipt','demand') and resource_id in (select id from receipts where consumer_id in (${ids}) union select id from demands where consumer_id in (${ids}))`,
    `delete from cheque_bounce_logs where consumer_id in (${ids})`, `delete from booking_documents where consumer_id in (${ids})`, `delete from receipts where consumer_id in (${ids})`, `delete from penal_interests where consumer_id in (${ids})`, `delete from demands where consumer_id in (${ids})`,
    `delete from financial_audit_logs where consumer_id in (${ids})`, `delete from payment_plans where consumer_id in (${ids})`, `delete from allocations where consumer_id in (${ids})`,
    `delete from broker_commissions where consumer_id in (${ids})`, `delete from booking_payment_taxes where booking_record_id in (select id from booking_records where consumer_id in (${ids}))`,
    `delete from booking_records where consumer_id in (${ids})`, `delete from co_applicants where consumer_id in (${ids})`, `delete from consumers where id in (${ids})`,
    `delete from company_bank_accounts where id = '${S.bank}'`,
    ...[S.p1, S.p2].flatMap((p: string) => [`delete from plan_schedule_templates where project_id='${p}'`, `delete from gst_tax_charge_mapping where project_id='${p}'`, `delete from unit_status_history where unit_id in (select id from units where project_id='${p}')`, `delete from units where project_id='${p}'`, `delete from towers where project_id='${p}'`, `delete from projects where id='${p}'`]),
    `delete from companies where id='${S.co}'`,
  ]) { try { sql(q); } catch { /* leftovers are harmless, names carry the run id */ } }
});
test.beforeEach(() => { problems = []; downloads = []; });
test.afterEach(async () => { expect(problems, 'Errors seen in the browser during this test').toEqual([]); });

const go = async (hash: string) => { await page.evaluate((h) => { location.hash = h; }, hash); };
const openTab = async (tab: string) => { await go('/reports?tab=' + tab); await expect(page.locator('#rpt-main').locator('.sp, #apf-result, .empty-state, table').first()).toBeVisible(); await page.waitForTimeout(250); };
const fetchBtn = () => page.locator('#rpt-main button', { hasText: /^\s*FETCH\s*$/ }).first();
const settle = async () => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(250); };
const pressFetch = async () => { if (await fetchBtn().count()) { await fetchBtn().click(); await settle(); } };
const pickProject = async () => {   // the first pick list that knows the project of this run
  for (const sel of await page.locator('#rpt-main select').all()) {
    if (await sel.locator('option', { hasText: S.pn }).count()) { await sel.selectOption({ label: S.pn }); await page.waitForTimeout(200); return true; }
  }
  return false;
};
const kpi = async (label: string | RegExp) => {
  const t = await page.locator('.kpi-card', { hasText: label }).first().locator('.kpi-value').innerText();
  return Number(t.replace(/[^0-9.\-]/g, '')) || 0;
};
const cellNum = (t: string) => Number(String(t).replace(/[^0-9.\-]/g, '')) || 0;

// ---- SQL read of the base tables: simple on purpose (every receipt of the run is tied to an instalment, the booking receipts stay pending) ----
const LIVE = `b.status in ('complete','pending_payment','active')`;
const planSql = (P: string) => `(select distinct on (b.consumer_id, b.unit_id) (select id from payment_plans pp where pp.consumer_id=b.consumer_id and pp.unit_id=b.unit_id order by pp.created_at desc limit 1) from booking_records b join units u on u.id=b.unit_id where ${LIVE} and u.project_id='${P}' order by b.consumer_id, b.unit_id, b.created_at desc)`;
const demandedOf = (P: string) => num(`select coalesce(sum(d.amount_due_inr + d.cgst_amount + d.sgst_amount),0) from demands d where d.payment_plan_id in ${planSql(P)} and d.status in ('demanded','raised','paid')`);
const paidOf = (P: string) => num(`select coalesce(sum(least(d.amount_due_inr + d.cgst_amount + d.sgst_amount, coalesce((select sum(r.amount_received_inr) from receipts r where r.demand_id = d.id and r.status = 'cleared'),0))),0) from demands d where d.payment_plan_id in ${planSql(P)} and d.status in ('demanded','raised','paid')`);
const clearedOf = (P: string) => num(`select coalesce(sum(r.amount_received_inr),0) from receipts r join consumers c on c.id=r.consumer_id left join payment_plans pp on pp.id=r.payment_plan_id where r.status='cleared' and r.is_advance is not true and coalesce(pp.project_id, c.project_id)='${P}'`);
const liveClearedOf = (P: string) => num(`select coalesce(sum(r.amount_received_inr),0) from receipts r where r.status='cleared' and r.is_advance is not true and r.payment_plan_id in ${planSql(P)}`);
const liveCount = (P: string) => num(`select count(*) from (select distinct on (b.consumer_id, b.unit_id) 1 from booking_records b join units u on u.id=b.unit_id where ${LIVE} and u.project_id='${P}' order by b.consumer_id, b.unit_id, b.created_at desc) x`);
const overdueOf = (P: string, from: number, to: number) => num(`select coalesce(sum(d.amount_due_inr + d.cgst_amount + d.sgst_amount - least(d.amount_due_inr + d.cgst_amount + d.sgst_amount, coalesce((select sum(r.amount_received_inr) from receipts r where r.demand_id = d.id and r.status = 'cleared'),0))),0) from demands d where d.payment_plan_id in ${planSql(P)} and d.status in ('demanded','raised') and current_date - d.due_date between ${from} and ${to}`);

// =====================================================================================================================
// the money screens, number by number
// =====================================================================================================================
test('Customer Wise Balance: KPI totals, rows and footer match the database; the surrendered customer is not listed', async () => {
  await openTab('customer-balance'); await pickProject(); await pressFetch();
  const dem = demandedOf(S.p1), rec = liveClearedOf(S.p1);
  expect(await kpi('TOTAL CONSUMERS')).toBe(liveCount(S.p1));
  expect(near(await kpi('TOTAL RECEIVED'), rec)).toBe(true);
  expect(near(await kpi('TOTAL BALANCE'), dem - rec)).toBe(true);
  const body = page.locator('#rpt-result tbody tr');
  expect(await body.count()).toBe(liveCount(S.p1));
  await expect(page.locator('#rpt-result')).not.toContainText(new RegExp(S.e4.name, 'i'));
  for (const B of S.live1) await expect(page.locator('#rpt-result tbody tr', { hasText: B.name })).toHaveCount(1);
  // the footer carries the sum of the rows
  const foot = await page.locator('#rpt-result tfoot td').allInnerTexts();
  expect(foot.some(t => Math.abs(cellNum(t) - (dem - rec)) < 1.01)).toBe(true);
  // received % of e1 on its row = what the API says
  const api1 = (await api('GET', `/reports/customer-balance?projectId=${S.p1}`)).j.data.find((r: any) => r.consumer_id === S.e1.c);
  await expect(page.locator('#rpt-result tbody tr', { hasText: S.e1.name })).toContainText(`${Number(api1.received_pct).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`);
  expect(await badWords()).toBe('');
});

test('Customer Wise Balance: Outstanding Only and Overpaid filters keep the right customers', async () => {
  await openTab('customer-balance'); await pickProject();
  await page.locator('#f-balancetype').selectOption('outstanding'); await pressFetch();
  const out = await page.locator('#rpt-result tbody tr').count();
  const all = (await api('GET', `/reports/customer-balance?projectId=${S.p1}`)).j.data;
  expect(out).toBe(all.filter((r: any) => r.balance > 0).length);
  await page.locator('#f-balancetype').selectOption('overpaid'); await pressFetch();
  expect(await page.locator('#rpt-result tbody tr').count()).toBe(all.filter((r: any) => r.balance < 0).length);
  await page.locator('#f-balancetype').selectOption('all'); await page.locator('#f-regno').fill('%'); await pressFetch();
  await expect(page.locator('#rpt-result')).toContainText(/No records found/);   // % is a plain character, not a wildcard
  await page.locator('#f-regno').fill(''); await page.locator('#f-name').fill(`Buyer${S.e1.name.match(/Buyer(\d+)/)[1]} ${U}`); await pressFetch();
  await expect(page.locator('#rpt-result tbody tr')).toHaveCount(1);
});

test('Customer Wise Dues: dues, received, outstanding and credit of each customer; the summary table adds up', async () => {
  await openTab('customer-dues'); await pickProject(); await pressFetch();
  const api1 = (await api('GET', `/reports/customer-dues?projectId=${S.p1}`)).j;
  const rows = page.locator('#rpt-result tbody tr');
  expect(await page.locator('#rpt-result table').first().locator('tbody tr').count()).toBe(liveCount(S.p1));
  for (const B of S.live1) { const a = api1.data.find((r: any) => r.consumer_id === B.c); const row = page.locator('#rpt-result tbody tr', { hasText: B.name }); const t = await row.innerText(); for (const v of [a.dues_total, a.received_clear, a.outstanding_total]) expect(t.replace(/,/g, '')).toContain(Number(v).toFixed(2)); }
  // the summary block: Amount + CGST + SGST + Interest = Total, for pending, clear and total
  const sum = page.locator('#rpt-result table').last();
  const rowsTxt = await sum.locator('tbody tr').allInnerTexts();
  const grid = rowsTxt.map(r => r.split('\t').map(cellNum));
  for (let col = 1; col <= 3; col++) expect(near(grid[0][col] + grid[1][col] + grid[2][col] + grid[3][col], grid[4][col], 0.05)).toBe(true);
  expect(near(grid[4][2], liveClearedOf(S.p1), 0.05)).toBe(true);
  await page.locator('#cwd-tax-yes').click(); await settle(); expect(await badWords()).toBe('');
  await page.locator('#cwd-tax-no').click(); await settle();
  // each option of the filters
  for (const id of ['#f-duescriteria', '#f-bhk', '#f-custclass']) { const sel = page.locator(id); for (const o of await sel.locator('option').all()) { await sel.selectOption(await o.getAttribute('value') ?? { label: (await o.innerText()).trim() }); await pressFetch(); expect(await badWords()).toBe(''); } await sel.selectOption({ index: 0 }); }
  await page.locator('#f-duedate').fill(later(-60)); await pressFetch(); expect(await badWords()).toBe('');
  await page.locator('#f-inpct').fill('1'); await pressFetch(); expect(await badWords()).toBe('');
});

test('Due Report: every demand, its paid and balance; the summary bar and the footer match the database', async () => {
  await openTab('due-report'); await pickProject(); await pressFetch();
  const n = num(`select count(*) from demands d where d.payment_plan_id in ${planSql(S.p1)} and d.status <> 'cancelled'`);
  expect(await page.locator('#rpt-result tbody tr').count()).toBe(n);
  const bar = await page.locator('#dr-summary').innerText();
  expect(Number(bar.match(/TOTAL DEMANDS:\s*([\d,]+)/)![1].replace(/,/g, ''))).toBe(n);
  const totalWithGst = num(`select coalesce(sum(d.amount_due_inr + d.cgst_amount + d.sgst_amount),0) from demands d where d.payment_plan_id in ${planSql(S.p1)} and d.status <> 'cancelled'`);
  expect(near(cellNum(bar.match(/WITH GST:\s*(₹[\d,]+)/)![1]), totalWithGst)).toBe(true);
  await page.locator('#f-status').selectOption('demanded'); await pressFetch();
  expect(await page.locator('#rpt-result tbody tr').count()).toBe(num(`select count(*) from demands d where d.payment_plan_id in ${planSql(S.p1)} and d.status = 'demanded'`));
  await expect(page.locator('#rpt-result')).toContainText('DEMANDED');
  await page.locator('#f-status').selectOption('pending'); await pressFetch();
  expect(await page.locator('#rpt-result tbody tr').count()).toBe(num(`select count(*) from demands d where d.payment_plan_id in ${planSql(S.p1)} and d.status = 'pending'`));
  await page.locator('#f-status').selectOption(''); await page.locator('#f-instalment').selectOption('1'); await pressFetch();
  expect(await page.locator('#rpt-result tbody tr').count()).toBe(num(`select count(*) from demands d where d.payment_plan_id in ${planSql(S.p1)} and d.status <> 'cancelled' and d.installment_index = 1`));
  await page.locator('#f-instalment').selectOption(''); await page.locator('#f-from').fill(later(-120)); await page.locator('#f-to').fill(later(-30)); await pressFetch();
  expect(await page.locator('#rpt-result tbody tr').count()).toBe(num(`select count(*) from demands d where d.payment_plan_id in ${planSql(S.p1)} and d.status <> 'cancelled' and d.due_date between current_date - 120 and current_date - 30`));
  expect(await badWords()).toBe('');
});

test('Stage Wise Dues: per instalment demanded, received and outstanding match the database', async () => {
  await openTab('stage-wise-dues'); await pickProject(); await pressFetch();
  const api1 = (await api('GET', `/reports/stage-wise-dues?projectId=${S.p1}`)).j;
  expect(api1.data.length).toBe(num(`select count(distinct d.installment_index) from demands d where d.payment_plan_id in ${planSql(S.p1)} and d.status in ('demanded','raised','paid')`));
  expect(near(api1.totals.total_due, demandedOf(S.p1))).toBe(true);
  expect(near(api1.totals.total_received, paidOf(S.p1))).toBe(true);
  const txt = (await page.locator('#rpt-result').innerText()).replace(/,/g, '');
  expect(txt).toContain(Math.round(api1.totals.total_due).toString());
  expect(await badWords()).toBe('');
});

test('Percentage Wise Report: buckets hold the customers by received %, the totals match', async () => {
  await openTab('percentage-wise'); await pickProject(); await pressFetch();
  const api1 = (await api('GET', `/reports/percentage-wise-dues?projectId=${S.p1}`)).j;
  expect(api1.totals.total_consumers).toBe(liveCount(S.p1));
  expect(near(api1.totals.total_received, liveClearedOf(S.p1))).toBe(true);
  expect(await badWords()).toBe('');
  const buckets = await page.locator('#rpt-result tbody tr').count();
  expect(buckets).toBeGreaterThan(0);
});

test('Project Wise Dues (and tower, unit type, plan, broker): totals, With Tax toggle', async () => {
  for (const tab of ['project-wise-dues', 'tower-wise-dues', 'unit-type-wise-dues', 'plan-wise-dues', 'broker-wise-dues']) {
    await openTab(tab); await pickProject(); await pressFetch();
    const dem = demandedOf(S.p1), paid = paidOf(S.p1);
    await page.locator('#pwd-tax-yes').click(); await settle();
    expect(near(await kpi('TOTAL DEMANDED'), dem)).toBe(true);
    expect(near(await kpi('TOTAL OUTSTANDING'), dem - paid)).toBe(true);
    expect(near(await kpi('TOTAL RECEIVED'), liveClearedOf(S.p1) + num(`select coalesce(sum(r.amount_received_inr),0) from receipts r where r.status in ('pending','authorized','deposited','on_hold') and r.is_advance is not true and r.payment_plan_id in ${planSql(S.p1)}`))).toBe(true);
    await page.locator('#pwd-tax-no').click(); await settle();
    expect(await kpi('TOTAL DEMANDED')).toBeLessThan(dem);   // without GST
    // the pending / clear / total block: rows add up to the total
    const grid = (await page.locator('#rpt-result table').last().locator('tbody tr').allInnerTexts()).map(r => r.split('\t').map(cellNum));
    for (let col = 1; col <= 3; col++) expect(near(grid[0][col] + grid[1][col] + grid[2][col] + grid[3][col], grid[4][col], 0.05)).toBe(true);
    expect(await badWords()).toBe('');
  }
});

test('Dues Ageing (project, tower, plan, customer): due, received, outstanding and the age bands match the database', async () => {
  for (const tab of ['ageing-summary-project', 'ageing-summary-tower', 'ageing-summary-plan', 'ageing-summary-customer']) {
    await openTab(tab); await pickProject(); await pressFetch();
    const dem = demandedOf(S.p1), paid = paidOf(S.p1);
    expect(near(await kpi(/TOTAL DUE/), dem)).toBe(true);
    expect(near(await kpi(/TOTAL RECEIVED/), paid)).toBe(true);
    expect(near(await kpi(/TOTAL OUTSTANDING/), dem - paid)).toBe(true);
    const api1 = (await api('GET', `/reports/${tab}?projectId=${S.p1}`)).j.totals;
    expect(near(api1.bucket_0_30, overdueOf(S.p1, 1, 30))).toBe(true);
    expect(near(api1.bucket_31_60, overdueOf(S.p1, 31, 60))).toBe(true);
    expect(near(api1.bucket_61_120, overdueOf(S.p1, 61, 120))).toBe(true);
    expect(near(api1.bucket_121_180, overdueOf(S.p1, 121, 180))).toBe(true);
    expect(near(api1.bucket_180_plus, overdueOf(S.p1, 181, 99999))).toBe(true);
    await page.locator('#f-asondate').fill(later(-50)); await pressFetch(); expect(await badWords()).toBe('');
    expect(near(await kpi(/TOTAL OUTSTANDING/), (await api('GET', `/reports/${tab}?projectId=${S.p1}&asOnDate=${later(-50)}`)).j.totals.outstanding_amount)).toBe(true);
  }
});

test('Ageing (Project / Tower / Plan) and Installment Wise Dues: bands match the database', async () => {
  await openTab('ageing-project'); await pickProject(); await pressFetch();
  const a = (await api('GET', `/reports/ageing-project?projectId=${S.p1}`)).j.totals;
  expect(near(a.bucket_0_30, overdueOf(S.p1, 1, 30))).toBe(true); expect(near(a.bucket_31_60, overdueOf(S.p1, 31, 60))).toBe(true); expect(near(a.bucket_61_90, overdueOf(S.p1, 61, 90))).toBe(true); expect(near(a.bucket_91_180, overdueOf(S.p1, 91, 180))).toBe(true); expect(near(a.bucket_180_plus, overdueOf(S.p1, 181, 99999))).toBe(true);
  for (const b of await page.locator('#rpt-main button:has-text("Tower"), #rpt-main button:has-text("Plan"), #rpt-main button:has-text("Project")').all()) { await b.click(); await settle(); expect(await badWords()).toBe(''); }
  await openTab('ageing-installment'); await pickProject(); await pressFetch();
  const i = (await api('GET', `/reports/ageing-installment?projectId=${S.p1}`)).j.totals;
  expect(near(i.total_overdue, overdueOf(S.p1, 1, 99999))).toBe(true);
  expect(await badWords()).toBe('');
});

test('Month Wise Dues, Customer Wise crosstab, Forecasting, Customer Dues Details, Due Summary: no wrong numbers', async () => {
  await openTab('month-wise-dues'); await pickProject(); await pressFetch();
  const m = (await api('GET', `/reports/month-wise-dues?projectId=${S.p1}`)).j.totals;
  expect(near(m.total_due_with_gst, demandedOf(S.p1) - num(`select coalesce(sum(d.amount_due_inr + d.cgst_amount + d.sgst_amount),0) from demands d where d.payment_plan_id in ${planSql(S.p1)} and d.status = 'paid' and d.due_date is null`))).toBe(true);
  expect(near(m.total_outstanding, demandedOf(S.p1) - paidOf(S.p1))).toBe(true);
  expect(await badWords()).toBe('');
  await openTab('customer-dues-detail'); await pickProject(); await pressFetch();
  expect(await page.locator('#rpt-result tbody tr').count()).toBe(num(`select count(*) from demands d where d.payment_plan_id in ${planSql(S.p1)} and d.status <> 'cancelled'`));
  await openTab('customer-forecasting'); await pickProject(); await pressFetch(); expect(await badWords()).toBe('');
  await openTab('customer-due-summary'); await pickProject(); await pressFetch();
  expect(await page.locator('#rpt-result tbody tr').count()).toBeGreaterThan(0);
  for (const b of await page.locator('#rpt-main button[id^="cds-tab-"]').all()) { await b.click(); await settle(); expect(await badWords()).toBe(''); }
  expect(await badWords()).toBe('');
});

test('Collection: Project Wise, Year Month Wise, Receipt Wise (cleared money only; bounced and cancelled are counted apart)', async () => {
  await openTab('project-collection'); await pickProject(); await pressFetch();
  const a = (await api('GET', `/reports/project-collection?projectId=${S.p1}`)).j;
  expect(near(a.totals.total_amount, clearedOf(S.p1))).toBe(true);
  expect(a.totals.bounce_count).toBe(num(`select count(*) from receipts r join consumers c on c.id=r.consumer_id where c.project_id='${S.p1}' and r.status='bounced'`));
  expect(a.totals.cancel_count).toBe(num(`select count(*) from receipts r join consumers c on c.id=r.consumer_id where c.project_id='${S.p1}' and r.status='cancelled'`));
  expect((await page.locator('#rpt-result').innerText()).replace(/,/g, '')).toContain(String(Math.round(clearedOf(S.p1))));
  await openTab('year-month-collection'); await pickProject(); await pressFetch();
  expect((await page.locator('#rpt-result').innerText()).replace(/,/g, '')).toContain(String(Math.round(clearedOf(S.p1))));
  await openTab('receipt-wise-collection'); await pickProject(); await pressFetch();
  expect(await page.locator('#rpt-result tbody tr').count()).toBe(num(`select count(*) from receipts r join consumers c on c.id=r.consumer_id left join payment_plans pp on pp.id=r.payment_plan_id where coalesce(pp.project_id, c.project_id)='${S.p1}'`));
  for (const st of ['cleared', 'bounced', 'cancelled', 'pending']) {
    const sel = page.locator('#rpt-main select').filter({ has: page.locator(`option[value="${st}"]`) }).first();
    if (await sel.count()) { await sel.selectOption(st); await pressFetch(); expect(await page.locator('#rpt-result tbody tr').count()).toBe(num(`select count(*) from receipts r join consumers c on c.id=r.consumer_id left join payment_plans pp on pp.id=r.payment_plan_id where coalesce(pp.project_id, c.project_id)='${S.p1}' and r.status='${st}'`)); }
  }
  expect(await badWords()).toBe('');
});

test('Cash / Bank Summary and Bank Ledger: the bank account shows the cleared receipts as credit', async () => {
  await openTab('cash-bank-summary'); await pressFetch();
  const row = page.locator('#rpt-result tbody tr', { hasText: `RE Bank ${U}` });
  await expect(row).toHaveCount(1);
  const credit = num(`select coalesce(sum(amount_received_inr),0) from receipts where company_bank_account_id='${S.bank}' and status='cleared' and is_advance is not true`);
  expect(near(cellNum((await row.locator('td').nth(2).innerText())), credit)).toBe(true);
  await row.locator('td').first().click(); await settle();   // drill down: the monthly ledger of the account
  expect(await badWords()).toBe('');
  await expect(page.locator('#rpt-result')).toContainText(/Opening Balance/);
  await openTab('bank-wise-balance'); await pressFetch(); expect(await badWords()).toBe('');
  await openTab('bank-ledger'); await pickProject(); await pressFetch();
  expect(await page.locator('#rpt-result tbody tr').count()).toBe(num(`select count(*) from receipts r join consumers c on c.id=r.consumer_id left join payment_plans pp on pp.id=r.payment_plan_id where coalesce(pp.project_id, c.project_id)='${S.p1}' and r.is_advance is not true`));
});

test('Applicant Payment File: the row of each customer, Print and Download CSV', async () => {
  await openTab('payment-file'); await page.waitForTimeout(300);
  await pickProject();
  await page.locator('#rpt-main button', { hasText: /search|fetch|go/i }).first().click().catch(() => {}); await settle();
  const api1 = (await api('GET', `/reports/applicant-payment-file?projectId=${S.p1}`)).j;
  expect(api1.total).toBe(liveCount(S.p1));
  await expect(page.locator('#rpt-main')).toContainText(new RegExp(S.e1.name, 'i'));
  await expect(page.locator('#rpt-main')).not.toContainText(new RegExp(S.e4.name, 'i'));
  await page.locator('.apf-icon-btn[title="Print"]').click(); expect(await page.evaluate(() => (window as any).__printed)).toBeGreaterThan(0);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('.apf-icon-btn[title="Download CSV"]').click()]);
  const csv = require('node:fs').readFileSync(await dl.path(), 'utf8');
  expect(csv.split('\n').filter(Boolean).length).toBe(1 + liveCount(S.p1));
  expect(await badWords()).toBe('');
});

// =====================================================================================================================
// every report screen of the menu: every filter option, every text box, every button
// =====================================================================================================================
const TABS = ['project-details', 'inventory', 'date-booking-status', 'customer-wise', 'payment-file', 'opening-details', 'booking-auth', 'tds-status', 'unit-wise-plc', 'unit-sold-area', 'unit-cost', 'stock-report', 'summary-report',
  'project-collection', 'year-month-collection', 'receipt-wise-collection', 'customer-balance', 'customer-dues', 'due-report', 'date-wise-dues', 'stage-wise-dues', 'percentage-wise', 'ageing-project', 'ageing-installment', 'month-wise-dues',
  'month-wise-dues-customer', 'customer-forecasting', 'customer-dues-detail', 'customer-due-summary', 'project-wise-dues', 'tower-wise-dues', 'unit-type-wise-dues', 'plan-wise-dues', 'broker-wise-dues', 'ageing-summary-project', 'ageing-summary-tower',
  'ageing-summary-plan', 'ageing-summary-customer', 'conveyance-deed-date', 'other-charge-report', 'addon-charge-report', 'extra-addon-charge', 'tower-floor-sales', 'customer-payment-mismatch', 'booking-record', 'cash-bank-summary', 'bank-ledger',
  'unit-type-status', 'bank-wise-balance', 'inventory-details', 'all-applicants'];
const HOSTILE = ['%', "' OR '1'='1", '<img src=x onerror=window.__xss=1>', '=HYPERLINK("http://x")', '_', '\\'];
for (const tab of TABS) {
  test(`every control of the "${tab}" screen: each filter option, hostile text, dates, buttons, CSV`, async () => {
    await openTab(tab); await pickProject(); await pressFetch();
    expect(await badWords(), 'first fetch').toBe('');
    const limit = process.env.EVERY_OPTION ? 1000 : 5;
    // every pick list: its options
    const sels = await page.locator('#rpt-main .sp select').all();
    for (const sel of sels) {
      if (!(await sel.isVisible())) continue;
      if (await sel.locator('option', { hasText: S.pn }).count()) continue;   // the project list: the project of this run is used on every screen
      const opts = await sel.locator('option').all(); let n = 0;
      for (const o of opts) {
        if (n++ >= limit) break;
        const v = await o.getAttribute('value'); if (v === null) continue;
        await sel.selectOption(v).catch(() => {}); await pressFetch(); expect(await badWords(), `option ${v}`).toBe('');
      }
      await sel.selectOption({ index: 0 }).catch(() => {});
    }
    await pickProject();
    // every text box with hostile words
    for (const inp of await page.locator('#rpt-main .sp input[type=text], #rpt-main .sp input:not([type])').all()) {
      if (!(await inp.isVisible())) continue;
      for (const w of HOSTILE.slice(0, process.env.EVERY_OPTION ? 6 : 3)) { await inp.fill(w); await pressFetch(); expect(await badWords(), `text ${w}`).toBe(''); }
      await inp.fill('');
    }
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    // every date box
    for (const inp of await page.locator('#rpt-main .sp input[type=date]').all()) { if (!(await inp.isVisible())) continue; await inp.fill(later(-90)); await pressFetch(); expect(await badWords(), 'date').toBe(''); await inp.fill(''); }
    // the other buttons of the filter panel (tax toggles, view switches), and the CSV export
    for (const b of await page.locator('#rpt-main .sp button').all()) {
      const t = (await b.innerText()).trim();
      if (!t || /^FETCH$/i.test(t) || /export csv/i.test(t) || /delete|cancel|remove|clear all/i.test(t)) continue;
      if (!(await b.isVisible())) continue;
      await b.click(); await settle(); expect(await badWords(), `button ${t}`).toBe('');
    }
    const exp = page.locator('#rpt-main button', { hasText: /export csv/i }).first();
    if (await exp.count()) {
      await pressFetch();
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), exp.click()]);
      if (dl) {
        const csv = require('node:fs').readFileSync(await dl.path(), 'utf8');
        for (const line of csv.split('\n')) for (const cell of line.match(/"([^"]|"")*"/g) || []) expect(cell, 'a CSV cell must not start with a formula character').not.toMatch(/^"[=+@\-]\D/);
      }
    }
  });
}

test('CSV export: a cell that starts with = + - @ is neutralised (formula injection)', async () => {
  await openTab('customer-balance');
  const out = await page.evaluate(() => ['=SUM(A1)', '+1+1', '-cmd', '@x', 'plain', '5', '-5', '=cmd|calc'].map(v => Utils.csvCell(v)));
  expect(out).toEqual(['"\'=SUM(A1)"', '"\'+1+1"', '"\'-cmd"', '"\'@x"', '"plain"', '"5"', '"-5"', '"\'=cmd|calc"']);
});

test('A name with HTML in the data is shown as text on the screens (not run)', async () => {
  const name = `Rep <b id=bx>Bold</b> ${U}`;
  sql(`update consumers set first_name = '${name.replace(/'/g, "''")}', last_name = '' where id = '${S.e3.c}' returning 1`);
  sql(`update units set unit_number = unit_number where id = '${S.e3.u}' returning 1`);
  for (const tab of ['customer-balance', 'customer-dues', 'due-report', 'customer-due-summary', 'ageing-summary-customer', 'customer-dues-detail']) {
    await openTab(tab); await pickProject(); await pressFetch();
    expect(await page.locator('#rpt-main #bx').count(), tab).toBe(0);
  }
  await openTab('payment-file'); await pickProject(); await page.waitForTimeout(500); await settle();
  expect(await page.locator('#rpt-main #bx').count()).toBe(0);
});

test('Create New Report: the saved definition is listed with its name', async () => {
  await openTab('customer-balance');
  await page.locator('button', { hasText: '+ Create New Report' }).click();
  await page.locator('#report-name').fill(`RE saved ${U}`);
  await page.locator('#report-type').selectOption('collection');
  await page.locator('#create-report-modal button', { hasText: 'Create Report' }).click();
  await expect(page.locator('#saved-reports-list')).toContainText(`RE saved ${U}`);
  sql(`delete from custom_reports where name = 'RE saved ${U}'`);
});

test('Analytics Dashboard: the KPIs, collection trend and payment ageing show the numbers of the reports (they used to be 0)', async () => {
  await go('/analytics');
  await expect(page.locator('#an-kpis .kpi-val').first()).toBeVisible();
  await expect(page.locator('#an-collection-chart')).not.toContainText(/loading/i);
  await page.waitForLoadState('networkidle');
  const fin = (await api('GET', '/reports/financial-dashboard')).j.data.metrics;
  const rupees = (n: number) => '\u20b9' + Math.round(n).toLocaleString('en-IN');
  const kp = (label: string) => page.locator('#an-kpis .kpi', { has: page.locator('.kpi-lbl', { hasText: new RegExp(`^${label}$`) }) });
  await expect(kp('Collection')).toContainText(rupees(fin.total_collected));
  await expect(kp('Outstanding')).toContainText(rupees(fin.outstanding));
  expect(fin.total_collected).toBeGreaterThan(0);
  const ageing = (await api('GET', '/reports/payment-ageing')).j.data;
  for (const b of ageing) await expect(page.locator('#an-ageing')).toContainText(rupees(b.total_due_inr));
  const sales = (await api('GET', '/reports/sales-dashboard')).j.data.metrics;
  await page.locator('#an-from').fill(''); await page.locator('#an-to').fill(''); await page.locator('button', { hasText: 'APPLY' }).click(); await page.waitForLoadState('networkidle');
  await expect(kp('Total Leads')).toContainText(String(sales.total_leads));
  const text = await page.locator('#content').evaluate((e) => { const c = e.cloneNode(true) as HTMLElement; c.querySelectorAll('select,option').forEach(n => n.remove()); return c.innerText; });
  expect(text).not.toMatch(/undefined|NaN/);
});

test('Unit Status (project wise and tower wise): the counts on screen are the units of the database', async () => {
  const total = num(`select count(*) from units where project_id='${S.p1}'`), avail = num(`select count(*) from units where project_id='${S.p1}' and status='available'`);
  await go('/unit-status');
  await expect(page.locator('#us-project')).toBeVisible();
  await expect(page.locator('#us-project option', { hasText: S.pn })).toBeAttached();   // every project is in the list, however many units the database has
  await page.locator('#us-project').selectOption({ label: S.pn }); await page.locator('.us-fetch').click(); await settle();
  await expect(page.locator('#us-stats')).toContainText(new RegExp(`Total Unit : ${total}\\b`));
  await expect(page.locator('#us-stats')).toContainText(new RegExp(`Available Unit : ${avail}\\b`));
  for (const key of ['available', 'booked', 'hold', 'allotted', 'temp_surrender', 'all']) { await page.locator(`#us-status-btns [data-key="${key}"]`).click(); await settle(); }
  await go('/unit-status?view=tower'); await settle();
  const sel = page.locator('#tw-project'); await expect(sel).toBeVisible();
  await expect(sel.locator('option', { hasText: S.pn })).toBeAttached();
  await sel.selectOption({ label: S.pn }); await page.locator('#tw-fetch-btn').click(); await settle();
  await expect(page.locator('#content')).toContainText(S.tn);
});
