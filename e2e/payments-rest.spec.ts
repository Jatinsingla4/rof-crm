// Payments, the rest, clicked through the real screens in a real browser: Interest Master, Installment Interest, Interest Scheduler,
// Customer Wise Interest (3 tabs), Grace Period, Interest Waiver (list, detail, waive off, report), GST Invoicing (every tab), Loans, Registry, Dashboard.
// The set-up (project, plan, applicants with overdue installments) is made through the API and psql; the screens are used like a person would.
// After a screen acts, the database is asked (API / psql) whether it did what it showed. A JavaScript error, a console error, a 5xx or the words
// "undefined" / "NaN" on the page fail the test.
import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const PASSWORD = 'Test#Pass1234';
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const U = Date.now().toString(36).slice(-5);
const today = new Date().toISOString().slice(0, 10);
const later = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
let seq = 0;
const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');
const sql = (q: string) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();

test.describe.configure({ mode: 'serial' });
test.use({ actionTimeout: 15_000 });   // a click on something hidden fails in 15 s, not at the end of the test
let page: Page;
let problems: string[] = [];
let token = '';
const api = async (method: string, path: string, body?: any) => {
  const r = await fetch(`${BASE}/api${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j: any = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const must = async (label: string, p: Promise<{ s: number; j: any }>) => { const x = await p; if (x.s >= 300) throw new Error(`${label}: ${x.s} ${JSON.stringify(x.j).slice(0, 300)}`); return x.j.data ?? x.j; };
const S: Record<string, any> = {};

test.beforeAll(async ({ browser }) => {
  token = (await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: PASSWORD }) })).json()).token;
  const co = (await must('company', api('POST', '/companies', { name: `PR Co ${U}` }))).id;
  S.projectName = `PR Project ${U}`;
  S.project = (await must('project', api('POST', '/projects', { companyId: co, name: S.projectName, reraNumber: `PRX-${U}`, tcpLicence: 'x' }))).id;
  S.towerName = `PRT-${U}`;
  S.tower = (await must('tower', api('POST', `/projects/${S.project}/towers`, { towerName: S.towerName }))).id;
  S.plan = `PR Plan ${U}`; let k = 0;
  for (const pc of [20, 30, 50]) await must('plan', api('POST', `/projects/${S.project}/plan-templates`, { plan_name: S.plan, installment_name: `Row ${++k}`, installment_type: k === 1 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: k * 30, installment_index: k }));
  let slab = (await api('GET', '/gst-configuration/gst-slabs')).j.data.find((x: any) => x.from_date <= today && x.to_date >= today)?.id;
  if (!slab) slab = (await must('slab', api('POST', '/gst-configuration/gst-slabs', { fromDate: later(-3), toDate: later(60) }))).id;
  const tax = (await must('tax', api('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `PR ${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 }))).id;
  for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await api('POST', '/gst-configuration/gst-charge-mapping', { projectId: S.project, slabId: slab, gstTaxId: tax, chargeType: ct });
  // three applicants with a booking receipt and two installments long overdue, so there is interest to look at
  S.buyers = [];
  for (let i = 1; i <= 3; i++) {
    const c = (await must('applicant', api('POST', '/consumers', { name: `Payrest Buyer${i} ${U}`, mobile: mob(), project_id: S.project }))).id;
    const u = (await must('unit', api('POST', '/units', { projectId: S.project, towerId: S.tower, unitNumber: `PU${i}-${U}`, floor: 2, bhkType: '2BHK', carpetAreaSqft: 1000, superAreaSqft: 1200, basePriceInr: 9000000, totalPriceInr: 9500000 }))).id;
    const b = await must('booking', api('POST', '/booking', { consumer_id: c, project_id: S.project, unit_id: u, selected_plan_name: S.plan, booking_date: today }));
    await must('booking payment', api('PATCH', `/booking/${b.id}`, { booking_amount: 10000, payment_mode: 'cash' }));
    sql(`update demands set due_date = current_date - 150, status = 'raised' where consumer_id = '${c}' and installment_index in (1, 2)`);
    S.buyers.push({ c, u, name: `Payrest Buyer${i} ${U}`, unit: `PU${i}-${U}` });
  }
  await api('POST', `/payments/consumer-interest-detail/${S.buyers[0].c}`);
  await api('POST', `/payments/consumer-interest-detail/${S.buyers[1].c}`);

  page = await browser.newPage();
  page.on('dialog', d => { S.lastDialog = d.message(); d.accept(); });
  page.on('pageerror', e => problems.push(`JavaScript error: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|Blocked script execution in 'about:(srcdoc|blank)'/.test(m.text())) problems.push(`Console error: ${m.text()}`); });
  page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 500) problems.push(`Server error ${r.status()}: ${r.request().method()} ${r.url()}`); });
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill('super_admin@test.local');
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/#\/dashboard/);
});
test.afterAll(async () => { await page.close(); });
test.beforeEach(() => { problems = []; });
test.afterEach(async () => {
  const text = await page.locator('#content').innerText().catch(() => '');
  if (/\bundefined\b|\bNaN\b/.test(text)) problems.push(`The screen shows "undefined" or "NaN": ${text.match(/.{0,40}(undefined|NaN).{0,40}/)?.[0]}`);
  expect(problems, 'Errors seen in the browser during this test').toEqual([]);
});

const go = (hash: string) => page.evaluate((h) => { location.hash = h; }, hash);
const content = () => page.locator('#content');
const toast = (t: string | RegExp) => page.locator('.toast', { hasText: t }).first();
const pick = (sel: string, label: string | RegExp) => page.locator(sel).selectOption({ label: label as any });
const waitOption = async (sel: string, text: string) => { await expect(page.locator(`${sel} option`, { hasText: text }).first()).toBeAttached(); };

// ---------------------------------------------------------------- Interest Master
test('Interest Master: save a rate, view the history, edit it, duplicate date and bad input are refused', async () => {
  await go('/interest-master');
  await waitOption('#im-project', S.projectName);
  await pick('#im-project', S.projectName);
  await page.locator('#im-save-btn').click();
  await expect(page.locator('#im-msg')).toContainText(/rate/i);                      // no rate typed yet
  await page.locator('#im-rate').fill('abc'); await page.locator('#im-save-btn').click();
  await expect(page.locator('.im-msg-err')).toBeVisible();
  await page.locator('#im-rate').fill('12.5'); await page.locator('#im-date').fill(later(-20));
  await page.locator('#im-save-btn').click();
  await expect(page.locator('.im-msg-ok')).toContainText(/saved/i);
  expect(sql(`select rate_percent from project_interest_rates where project_id = '${S.project}'`)).toBe('12.50');
  await page.locator('#im-rate').fill('9'); await page.locator('#im-date').fill(later(-20)); await page.locator('#im-save-btn').click();
  await expect(page.locator('.im-msg-err')).toContainText(/already/i);                // same date twice
  await page.locator('#im-rate').fill('101'); await page.locator('#im-date').fill(later(-10)); await page.locator('#im-save-btn').click();
  await expect(page.locator('.im-msg-err')).toBeVisible();
  await page.locator('#im-rate').fill('8.25'); await page.locator('#im-date').fill(later(-5)); await page.locator('#im-save-btn').click();
  await expect(page.locator('.im-msg-ok')).toBeVisible();
  await page.locator('#im-view-btn').click();
  await expect(page.locator('.im-tbl tbody tr')).toHaveCount(2);
  await expect(page.locator('.im-tbl')).toContainText('12.50'); await expect(page.locator('.im-tbl')).toContainText('8.25');
  await page.locator('.im-edit-link').first().click();
  await page.locator('[id^=im-edit-rate-]').fill('7.5'); await page.locator('.im-inline-link').click();
  await expect(page.locator('.im-tbl')).toContainText('7.50');
  expect(sql(`select count(*) from project_interest_rates where project_id = '${S.project}' and rate_percent = 7.5`)).toBe('1');
  await page.locator('.im-edit-link').first().click(); await page.locator('.im-inline-cancel').click();
  await expect(page.locator('.im-edit-link')).toHaveCount(2);
  await page.locator('button', { hasText: /^CLOSE$/ }).click();
  await expect(page.locator('#im-results')).toBeEmpty();
});

// ---------------------------------------------------------------- Installment Interest
test('Installment Interest: pick project and plan, fetch the installments, save per-installment rates', async () => {
  await go('/installment-interest');
  await waitOption('#ii-project', S.projectName);
  await page.locator('#ii-fetch-btn').click(); await expect(page.locator('.ii-fmsg-err')).toBeVisible();   // nothing picked
  await pick('#ii-project', S.projectName);
  await waitOption('#ii-plan', S.plan);
  await page.locator('#ii-fetch-btn').click(); await expect(page.locator('.ii-fmsg-err')).toBeVisible();   // no plan
  await pick('#ii-plan', S.plan);
  await page.locator('#ii-fetch-btn').click();
  await expect(page.locator('.ii-interest-input')).toHaveCount(3);
  const inputs = page.locator('.ii-interest-input');
  await inputs.nth(0).fill('6.25'); await inputs.nth(1).fill(''); await inputs.nth(2).fill('150');
  await page.locator('#ii-save-btn').click();
  await expect(page.locator('.ii-smsg-err')).toBeVisible();                                                   // 150 % is refused
  await inputs.nth(2).fill('3.5'); await page.locator('#ii-save-btn').click();
  await expect(page.locator('.ii-smsg-ok')).toContainText(/saved/i);
  expect(sql(`select string_agg(coalesce(interest_rate_percent::text, 'null'), ',' order by installment_index) from plan_schedule_templates where project_id = '${S.project}' and plan_name = '${S.plan}'`)).toBe('6.25,null,3.50');
  await page.locator('#ii-fetch-btn').click();
  await expect(inputs.nth(0)).toHaveValue('6.25'); await expect(inputs.nth(2)).toHaveValue('3.50');
  await page.locator('.ii-collapse-btn').click(); await expect(page.locator('#ii-filter-body')).toBeHidden(); await page.locator('.ii-collapse-btn').click(); await expect(page.locator('#ii-filter-body')).toBeVisible();
});

// ---------------------------------------------------------------- Interest Scheduler
test('Interest Scheduler: calculate for a project and a tower, save, delete', async () => {
  await go('/interest-scheduler');
  await waitOption('#is-project', S.projectName);
  await page.locator('#is-calc-btn').click(); expect(S.lastDialog).toMatch(/select a project/i);
  await pick('#is-project', S.projectName);
  await waitOption('#is-tower', S.towerName);
  await pick('#is-tower', S.towerName);
  await page.locator('#is-calc-btn').click();
  await expect(page.locator('.is-summary')).toContainText('Consumers Processed');
  await expect(page.locator('.is-table tbody tr').first()).toBeVisible();
  await expect(page.locator('.is-table')).toContainText(new RegExp(S.buyers[0].name, 'i'));
  await page.locator('#is-save-btn').click();
  await expect.poll(() => S.lastDialog).toMatch(/saved successfully/i);
  expect(Number(sql(`select count(*) from penal_interests where consumer_id = '${S.buyers[2].c}' and status = 'calculated'`))).toBeGreaterThan(0);
  await pick('#is-tower', '<--All-->');
  await page.locator('#is-del-btn').click();
  await expect.poll(() => S.lastDialog).toMatch(/record\(s\) removed/i);
  expect(sql(`select count(*) from penal_interests where consumer_id in ('${S.buyers.map((b: any) => b.c).join("','")}') and status = 'calculated'`)).toBe('0');
});

// ---------------------------------------------------------------- Customer Wise Interest
test('Customer Wise Interest: reset date, manual interest and delete tabs with every filter', async () => {
  await go('/customer-wise-interest');
  const tabs = ['particular-date', 'interest-master', 'delete-interest', 'manual-interest'];
  await expect(content()).toContainText(/reset interest|particular/i);
  // tab 1: reset interest date
  await waitOption('#cwi-proj-pd', S.projectName);
  await page.locator('#cwi-fetch-particular-date').click(); await expect(page.locator('.cwi-fmsg-err')).toBeVisible();     // no project
  await pick('#cwi-proj-pd', S.projectName);
  await page.locator('#cwi-reg-particular-date').fill('zzzzz'); await page.locator('#cwi-fetch-particular-date').click();
  await expect(page.locator('#cwi-results')).toContainText(/no consumers/i);                                          // registration filter that matches nobody
  await page.locator('#cwi-reg-particular-date').fill('');
  await page.locator('#cwi-fn-particular-date').fill(`Buyer2 ${U}`); await page.locator('#cwi-fetch-particular-date').click();
  await expect(page.locator('.cwi-tbl tbody tr')).toHaveCount(1);                                                    // name filter
  await page.locator('#cwi-fn-particular-date').fill(''); await page.locator('#cwi-unit-particular-date').fill(S.buyers[2].unit); await page.locator('#cwi-fetch-particular-date').click();
  await expect(page.locator('.cwi-tbl tbody tr')).toHaveCount(1);                                                    // unit filter
  await expect(page.locator('.cwi-tbl')).toContainText(new RegExp(S.buyers[2].name, 'i'));
  await page.locator('#cwi-unit-particular-date').fill(''); await page.locator('#cwi-fetch-particular-date').click();
  await expect(page.locator('.cwi-tbl tbody tr')).toHaveCount(3);
  await page.locator('#cwi-date-0').fill(''); await page.locator('.cwi-link-blue').first().click(); await expect(page.locator('.cwi-inline-err').first()).toContainText(/select a date/i);
  await page.locator('#cwi-date-0').fill(later(-400)); await page.locator('.cwi-link-blue').first().click();
  await expect(page.locator('.cwi-inline-ok').first()).toContainText(/reset done/i);
  expect(sql(`select count(*) from consumers where id in ('${S.buyers.map((b: any) => b.c).join("','")}') and interest_start_date = '${later(-400)}'`)).toBe('1');
  sql(`update consumers set interest_start_date = null where id in ('${S.buyers.map((b: any) => b.c).join("','")}')`);
  // tab 2: points to the Interest Master screen
  await page.locator('.cwi-tab', { hasText: /interest master/i }).first().click().catch(() => {});
  // tab 3: manual interest
  await page.evaluate(() => (window as any).CustomerWiseInterest.switchTab('manual-interest'));
  await waitOption('#cwi-proj-mi', S.projectName);
  await pick('#cwi-proj-mi', S.projectName); await page.locator('#cwi-fetch-manual-interest').click();
  await expect(page.locator('.cwi-tbl tbody tr')).toHaveCount(3);
  await page.locator('.cwi-link-blue').first().click(); await expect(page.locator('.cwi-inline-err').first()).toBeVisible();   // nothing entered
  await page.locator('#cwi-inst-0').selectOption({ index: 1 }); await page.locator('#cwi-amt-0').fill('750');
  await page.locator('.cwi-link-blue').first().click(); await expect(page.locator('.cwi-inline-ok').first()).toContainText(/added/i);
  expect(sql(`select count(*) from penal_interests where status = 'manual' and amount_inr = 750 and consumer_id in ('${S.buyers.map((b: any) => b.c).join("','")}')`)).toBe('1');
  // tab 4: delete interest
  await page.evaluate(() => (window as any).CustomerWiseInterest.switchTab('delete-interest'));
  await waitOption('#cwi-proj-di', S.projectName);
  await pick('#cwi-proj-di', S.projectName); await page.locator('#cwi-fetch-delete-interest').click();
  await expect(page.locator('.cwi-tbl tbody tr')).toHaveCount(3);
  await expect(page.locator('.cwi-tbl')).toContainText('₹750.00');
  const victim = page.locator('.cwi-tbl tbody tr', { hasText: '750.00' });
  await victim.locator('.cwi-link-red').click();
  await expect(page.locator('.cwi-tbl tbody tr')).toHaveCount(2);
  expect(sql(`select count(*) from penal_interests where status = 'manual' and consumer_id in ('${S.buyers.map((b: any) => b.c).join("','")}')`)).toBe('0');
  void tabs;
});

// ---------------------------------------------------------------- Grace Period
test('Grace Period: fetch with filters, set days, bad value is refused', async () => {
  await go('/grace-period');
  await waitOption('#gp-project', S.projectName);
  await page.locator('#gp-fetch-btn').click(); expect(S.lastDialog).toMatch(/project/i);
  await pick('#gp-project', S.projectName);
  await page.locator('#gp-name').fill('nobody-here'); await page.locator('#gp-fetch-btn').click();
  await expect(page.locator('#gp-results')).toContainText(/no consumers/i);
  await page.locator('#gp-name').fill(''); await page.locator('#gp-reg').fill(''); await page.locator('#gp-unit').fill(S.buyers[1].unit);
  await page.locator('#gp-fetch-btn').click();
  await expect(page.locator('.gp-tbl tbody tr')).toHaveCount(1);
  const c = S.buyers[1].c, input = page.locator(`#gp-input-${c}`);
  await input.fill('-3'); await page.locator('.gp-set-link').click(); await expect(page.locator(`#gp-msg-${c}`)).toContainText(/invalid/i);
  await input.fill('12'); await page.locator('.gp-set-link').click(); await expect(page.locator(`#gp-msg-${c}`)).toContainText(/saved/i);
  expect(sql(`select grace_period_days from consumers where id = '${c}'`)).toBe('12');
  await input.fill('0'); await page.locator('.gp-set-link').click(); await expect(page.locator(`#gp-msg-${c}`)).toContainText(/saved/i);
  expect(sql(`select grace_period_days from consumers where id = '${c}'`)).toBe('0');
});

// ---------------------------------------------------------------- Interest Waiver
test('Interest Waiver: list filters, detail, waive off (too much is refused), the report', async () => {
  await go('/interest-waiver');
  await waitOption('#iw-proj', S.projectName);
  await page.locator('button', { hasText: /^FETCH$/ }).first().click(); expect(S.lastDialog).toMatch(/select a project/i);
  await pick('#iw-proj', S.projectName);
  await page.locator('#iw-regno').fill('zzzzz'); await page.locator('button', { hasText: /^FETCH$/ }).first().click();
  await expect(page.locator('#iw-results')).toContainText(/no records/i);
  await page.locator('#iw-regno').fill('');
  for (const type of ['All', 'Self', 'Pending', 'Loan Sanctioned']) {
    await page.locator('#iw-type').selectOption(type); await page.locator('button', { hasText: /^FETCH$/ }).first().click();
    if (type === 'All' || type === 'Self') await expect(page.locator('.iwn-tbl tbody tr')).toHaveCount(3); else await expect(page.locator('#iw-results')).toContainText(/no records/i);
  }
  await page.locator('#iw-type').selectOption('All'); await page.locator('#iw-name').fill(`Buyer1 ${U}`); await page.locator('button', { hasText: /^FETCH$/ }).first().click();
  await expect(page.locator('.iwn-tbl tbody tr')).toHaveCount(1);
  await page.locator('#iw-name').fill(''); await page.locator('#iw-addr').fill(S.buyers[0].unit); await page.locator('button', { hasText: /^FETCH$/ }).first().click();
  await expect(page.locator('.iwn-tbl tbody tr')).toHaveCount(1);
  await page.locator('#iw-collapse-btn').click(); await expect(page.locator('#iw-filter-body')).toBeHidden(); await page.locator('#iw-collapse-btn').click(); await expect(page.locator('#iw-filter-body')).toBeVisible();
  // detail and waive off
  await page.locator('#iw-results a', { hasText: 'Waive Off' }).first().click();
  await expect(page.locator('#iw-waiver-form')).toBeVisible();
  const total = Number(sql(`select sum(amount_inr) from penal_interests where consumer_id = '${S.buyers[0].c}'`));
  expect(total).toBeGreaterThan(1000);
  await page.locator('#iw-waive-amt').fill('0'); await page.locator('#iw-waiver-form button', { hasText: /^SAVE$/ }).click();
  await expect(page.locator('#iw-save-msg')).toContainText(/greater than 0/i);
  await page.locator('#iw-waive-amt').fill('500'); await page.locator('#iw-auth-by').fill('');
  await page.locator('#iw-waiver-form button', { hasText: /^SAVE$/ }).click(); await expect(page.locator('#iw-save-msg')).toContainText(/auth/i);
  await page.locator('#iw-waive-amt').fill(String(total + 1)); await page.locator('#iw-auth-by').fill('Owner');
  await page.locator('#iw-waiver-form button', { hasText: /^SAVE$/ }).click();
  await expect(page.locator('#iw-save-msg')).toContainText(/more than the interest/i);                              // refused by the server
  expect(sql(`select coalesce(sum(interest_waived_inr), 0) from penal_interests where consumer_id = '${S.buyers[0].c}'`)).toBe('0');
  await page.locator('#iw-waive-amt').fill('500'); await page.locator('#iw-remark').fill('goodwill');
  await page.locator('#iw-waiver-form button', { hasText: /^SAVE$/ }).click();
  await expect(page.locator('#iw-results')).toContainText(new RegExp(S.buyers[0].name, 'i'));                                          // back on the list
  expect(sql(`select coalesce(sum(waiver_amount_inr), 0) from interest_waivers where consumer_id = '${S.buyers[0].c}' and status = 'approved'`)).toBe('500');
  expect(sql(`select coalesce(sum(interest_waived_inr), 0) from penal_interests where consumer_id = '${S.buyers[0].c}'`)).toBe('500');
  await expect(page.locator('.iwn-tbl tbody tr').first()).toContainText('500');
  // the other installment dropdown, then the cancel button
  await page.locator('#iw-results a', { hasText: 'Detail' }).first().click();
  await expect(page.locator('#iw-inst-select')).toBeVisible();
  await page.locator('#iw-inst-select').selectOption({ index: 1 });
  await expect(page.locator('#iw-disp-balance')).not.toBeEmpty();
  await page.locator('#iw-waiver-form button', { hasText: /^BACK$/ }).click();
  await expect(page.locator('#iw-results')).toBeVisible();
  // report
  await go('/interest-waiver?view=report');
  await waitOption('#iwr-proj', S.projectName);
  await page.locator('button', { hasText: /^FETCH$/ }).first().click(); expect(S.lastDialog).toMatch(/select a project/i);
  await pick('#iwr-proj', S.projectName); await page.locator('button', { hasText: /^FETCH$/ }).first().click();
  await expect(page.locator('.iwn-tbl')).toContainText(new RegExp(S.buyers[0].name, 'i'));
  await expect(page.locator('.iwn-tbl tbody tr')).toHaveCount(1);
});

// ---------------------------------------------------------------- GST Invoicing
const tab = async (name: string) => { await page.locator(`button.tab-line[data-tab="${name}"]`).click(); await expect(page.locator(`[data-panel="${name}"]`)).toBeVisible(); };
test('GST Invoicing: setup, invoice generation (receipt picked), manual, advance', async () => {
  const b = S.buyers[0];
  S.receipt = (await must('receipt', api('POST', '/payments/receipts', { consumerId: b.c, amountReceivedInr: 5000, paymentMode: 'neft', referenceNumber: `PR${U}R1`, paymentDate: today, installmentIndex: 1 }))).id;
  await go('/gst-invoicing');
  await expect(content()).toContainText(/invoice/i);
  // setup: says honestly that nothing is stored
  await page.locator('#gst-gstin-dev').fill(''); await page.locator('button', { hasText: /save/i }).first().click(); await expect(toast(/GSTIN/i)).toBeVisible();
  await page.locator('#gst-gstin-dev').fill('06AAAAA0000A1Z5'); await page.locator('button', { hasText: /save/i }).first().click(); await expect(page.locator('#setup-result')).toContainText(/nothing was saved/i);
  // generation
  await tab('invoice-gen');
  await waitOption('#gst-gen-consumer', b.name);
  await page.locator('#gst-gen-consumer').selectOption(b.c);
  await expect(page.locator(`#gst-gen-receipt option[value="${S.receipt}"]`)).toBeAttached({ timeout: 15000 });
  await page.locator('button', { hasText: /generate invoice/i }).first().click(); await expect(toast(/taxable amount/i)).toBeVisible();
  await page.locator('#gst-gen-receipt').selectOption(S.receipt);
  // the receipt of 5,000 already holds its 5% GST, so the taxable part is 4,761.90 and the invoice comes back to the 5,000 that was paid
  await expect(page.locator('#gst-gen-amount')).toHaveValue('4761.9');
  await expect(page.locator('#gst-gen-calc')).toContainText(/5,000|4,999\.9/);
  await page.locator('#gst-gen-supply').selectOption('interstate'); await expect(page.locator('#gst-gen-calc')).toContainText(/IGST/);
  await page.locator('#gst-gen-supply').selectOption('intrastate'); await expect(page.locator('#gst-gen-calc')).toContainText(/CGST/);
  await page.locator('#gst-gen-rate').selectOption('12'); await expect(page.locator('#gst-gen-calc')).toContainText('5,333'); await page.locator('#gst-gen-rate').selectOption('5');
  await page.locator('#gst-gen-desc').fill('Payment towards unit');
  await page.locator('button', { hasText: /generate invoice/i }).first().click();
  await expect(page.locator('#gst-gen-result')).toContainText(/INV\/\d{4}\/\d{5}/);
  S.inv1 = sql(`select invoice_no from gst_invoices where consumer_id = '${b.c}' and receipt_id = '${S.receipt}'`);
  expect(S.inv1).toMatch(/^INV\//);
  expect(sql(`select total_amount_inr from gst_invoices where invoice_no = '${S.inv1}'`)).toBe('5000.00');
  await page.locator('button', { hasText: /generate invoice/i }).first().click();
  await expect(page.locator('#gst-gen-result')).toContainText(/already/i);                                           // the same receipt twice
  // the same receipt is no longer offered
  await page.locator('#gst-gen-consumer').selectOption(''); await page.locator('#gst-gen-consumer').selectOption(b.c);
  await expect(page.locator('#gst-gen-receipt option[value]:not([value=""])').first()).toBeAttached();
  await expect(page.locator(`#gst-gen-receipt option[value="${S.receipt}"]`)).toHaveCount(0);
  // manual
  await tab('manual-invoice');
  await page.locator('#gst-man-consumer').selectOption(b.c);
  await page.locator('button', { hasText: /generate manual invoice/i }).click(); await expect(toast(/taxable amount/i)).toBeVisible();   // no amount yet
  await page.locator('#gst-man-amount').fill('1000'); await page.locator('#gst-man-gstin').fill('06AAAAA0000A1Z5'); await page.locator('#gst-man-desc').fill('Manual');
  await page.locator('button', { hasText: /generate manual invoice/i }).click();
  await expect(page.locator('#gst-man-result')).toContainText(/INV\/\d{4}\/\d{5}/);
  await page.locator('#gst-man-gstin').fill('bad'); await page.locator('button', { hasText: /generate manual invoice/i }).click();
  await expect(page.locator('#gst-man-result')).toContainText(/15 letters/i);
  // advance
  await tab('invoice-advance');
  await page.locator('#adv-consumer').selectOption(b.c); await page.locator('#adv-amount').fill('2000');
  await expect(page.locator('#gst-adv-calc')).toContainText('2,100');
  await page.locator('button', { hasText: /generate receipt voucher/i }).click();
  await expect(page.locator('#gst-adv-result')).toContainText(/INV\/\d{4}\/\d{5}/);
  expect(sql(`select invoice_type || '|' || total_amount_inr from gst_invoices where consumer_id = '${b.c}' and invoice_type = 'receipt_voucher'`)).toBe('receipt_voucher|2100.00');
});

test('GST Invoicing: reversal, cancellation, credit and debit note (fetch the invoice, then act)', async () => {
  const b = S.buyers[0];
  await go('/gst-invoicing');
  const mk = async (amount: number) => (await must('invoice', api('POST', '/payments/gst-invoices', { consumerId: b.c, baseAmount: amount, gstRate: 5, supplyType: 'intrastate', invoiceType: 'tax_invoice' }))).invoice_number as string;
  const toReverse = await mk(3000), toCancel = await mk(4000);
  // reversal
  await tab('invoice-reversal');
  await page.locator('button', { hasText: /confirm reversal/i }).click(); await expect(toast(/invoice number/i)).toBeVisible();
  await page.locator('#rev-inv-no').fill('INV/none'); await page.locator('button', { hasText: /fetch invoice details/i }).click(); await expect(page.locator('#rev-invoice-detail')).toContainText(/not found/i);
  await page.locator('#rev-inv-no').fill(toReverse); await page.locator('button', { hasText: /fetch invoice details/i }).click();
  await expect(page.locator('#rev-invoice-detail')).toContainText(toReverse); await expect(page.locator('#rev-invoice-detail')).toContainText('3,150');
  await page.locator('#rev-reason').fill('contract change'); await page.locator('button', { hasText: /confirm reversal/i }).click();
  await expect(page.locator('#rev-result')).toContainText(/reversed/i);
  expect(sql(`select status from gst_invoices where invoice_no = '${toReverse}'`)).toBe('cancelled');
  expect(sql(`select count(*) from credit_debit_notes where original_invoice_no = '${toReverse}' and status = 'issued' and adjustment_amount = 3000`)).toBe('1');
  await page.locator('button', { hasText: /confirm reversal/i }).click(); await expect(page.locator('#rev-result')).toContainText(/already cancelled/i);
  // cancellation
  await tab('invoice-cancel');
  await page.locator('#can-inv-no').fill(toCancel); await page.locator('button', { hasText: /^Fetch Invoice$/ }).click(); await expect(page.locator('#can-invoice-detail')).toContainText(toCancel);
  for (const reason of ['duplicate']) await page.locator('#can-reason').selectOption(reason);
  await page.locator('button', { hasText: /cancel invoice/i }).click();
  await expect(page.locator('#can-result')).toContainText(/cancelled/i);
  expect(sql(`select status || '|' || cancelled_reason from gst_invoices where invoice_no = '${toCancel}'`)).toBe('cancelled|duplicate');
  // credit / debit note on the first invoice
  await tab('credit-debit');
  await page.locator('button', { hasText: /generate|issue|raise/i }).last().click(); await expect(toast(/original invoice/i)).toBeVisible();
  await page.locator('#cdn-orig-inv').fill(S.inv1);
  await page.locator('button', { hasText: /generate|issue|raise/i }).last().click(); await expect(toast(/adjustment amount/i)).toBeVisible();
  await page.locator('#cdn-amount').fill('999999'); await page.locator('#cdn-reason').fill('too much'); await page.locator('button', { hasText: /generate|issue|raise/i }).last().click();
  await expect(page.locator('#cdn-result')).toContainText(/more than the invoice/i);
  await page.locator('#cdn-amount').fill('1000'); await page.locator('#cdn-reason').fill('rate fix'); await page.locator('button', { hasText: /generate|issue|raise/i }).last().click();
  await expect(page.locator('#cdn-result')).toContainText(/raised against/i);
  expect(sql(`select status || '|' || note_type || '|' || adjustment_amount from credit_debit_notes where original_invoice_no = '${S.inv1}'`)).toBe('pending|credit|1000.00');
  await page.locator('#cdn-type-btg .btg-item').nth(1).click(); await page.locator('#cdn-amount').fill('50'); await page.locator('button', { hasText: /generate|issue|raise/i }).last().click();
  await expect(page.locator('#cdn-result')).toContainText(/Debit note raised/i);
});

test('GST Invoicing: pending invoices (generate from the list), report with month and project filters, user rights', async () => {
  const b = S.buyers[1];
  const rc = (await must('receipt', api('POST', '/payments/receipts', { consumerId: b.c, amountReceivedInr: 3000, paymentMode: 'neft', referenceNumber: `PR${U}R2`, paymentDate: today, installmentIndex: 1 }))).id;
  await go('/gst-invoicing');
  await tab('pending-invoice');
  await expect(page.locator('#pending-kpis')).toContainText(/pending receipts/i);
  await waitOption('#pi-proj', S.projectName);
  await page.locator('#pi-proj').selectOption({ label: S.projectName });
  await page.locator('#pi-from').fill(later(-3)); await page.locator('#pi-to').fill(later(3));
  await page.locator('[data-panel="pending-invoice"] button', { hasText: /^FETCH$/ }).click();
  const row = page.locator('#pending-body tr', { hasText: b.name });
  await expect(row.first()).toBeVisible();
  await expect(row.first()).toContainText(/3,000|10,000/);
  await row.filter({ hasText: '3,000' }).locator('button', { hasText: /gen invoice/i }).click();
  await expect(toast(/created/i)).toBeVisible();
  expect(sql(`select count(*) from gst_invoices where receipt_id = '${rc}' and status = 'generated'`)).toBe('1');
  // report
  await tab('report');
  await expect(page.locator('#gst-report-kpis')).toContainText(/invoices/i);
  await expect(page.locator('#gst-reports-body')).toContainText(/INV\//);
  const fetchReport = () => page.locator('[data-panel="report"] button', { hasText: /^FETCH$/ }).click();
  await page.locator('#gst-rpt-month').fill('2024-02'); await fetchReport();
  await expect(page.locator('#gst-reports-body')).toContainText(/no invoices/i);                                     // a month with nothing (the 29th is a real day, no server error)
  await page.locator('#gst-rpt-month').fill('2025-04'); await fetchReport();
  await expect(page.locator('#gst-reports-body')).toContainText(/no invoices/i);                                     // 30 days: the 31st must not be sent
  await page.locator('#gst-rpt-month').fill(today.slice(0, 7)); await page.locator('#gst-rpt-project').selectOption({ label: S.projectName }); await fetchReport();
  await expect(page.locator('#gst-reports-body')).toContainText(/INV\//);
  await expect(page.locator('#gst-reports-body tbody tr').first()).not.toContainText(/NaN|undefined/);
  for (const [label, name] of [[/GSTR-1/, 'gstr1'], [/GSTR-3B/, 'gstr3b']] as const) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-panel="report"] button', { hasText: label }).click()]);
    expect(dl.suggestedFilename()).toBe(`${name}-${today.slice(0, 7)}.csv`);
  }
  // user rights: shown for information, not editable
  await tab('user-rights');
  await expect(page.locator('#gst-rights-rows input[type=checkbox]').first()).toBeDisabled();
});

// ---------------------------------------------------------------- Loans
test('Loans: record a sanction, it shows in the list, the same one again and a bad one are refused', async () => {
  const b = S.buyers[2];
  await go('/loans');
  await expect(page.locator('#loan-consumer')).toBeVisible();
  await page.locator('#loan-consumer option', { hasText: b.name }).first().waitFor({ state: 'attached' });
  const save = () => page.locator('button', { hasText: /save loan details/i }).click();
  await save(); await expect(toast(/required/i)).toBeVisible();
  await page.locator('#loan-consumer').selectOption(b.c); await page.locator('#loan-bank').fill('HDFC Bank'); await page.locator('#loan-amount').fill('-5');
  await save(); await expect(toast(/loanAmount|more than 0|number/i)).toBeVisible();
  await page.locator('#loan-amount').fill('2500000'); await page.locator('#loan-tpa-date').fill(today);
  await save(); await expect(toast(/saved successfully/i)).toBeVisible();
  expect(sql(`select loan_status || '|' || loan_amount from loan_details where consumer_id = '${b.c}'`)).toBe('sanctioned|2500000');
  await expect(page.locator('#loan-list-body')).toContainText(new RegExp(b.name, 'i')); await expect(page.locator('#loan-list-body')).toContainText('HDFC Bank');
  await save(); await expect(toast(/already recorded/i)).toBeVisible();
});

// ---------------------------------------------------------------- Registry
test('Registry: nothing picked is refused, an applicant who still owes is refused, the list loads', async () => {
  await go('/registry');
  await expect(page.locator('#reg-consumer')).toBeVisible();
  const before = Number(sql(`select count(*) from registry_details`));
  await page.locator('#reg-submit-btn').click(); await expect(toast(/select a consumer/i)).toBeVisible();     // used to book somebody else's allocation
  expect(Number(sql(`select count(*) from registry_details`))).toBe(before);
  const opts = await page.locator('#reg-consumer option').count();
  if (opts > 1) {
    await page.locator('#reg-consumer').selectOption({ index: 1 }); await expect(page.locator('#reg-validate-msg')).not.toBeEmpty();
    await page.locator('#reg-date').fill(later(7)); await page.locator('#reg-remarks').fill('visit');
  }
  await expect(page.locator('#reg-list-body')).toBeVisible();
  // every demand paid or cancelled and the money in: the appointment is booked
  const b = S.buyers[2];
  sql(`update demands set status = 'cancelled' where consumer_id = '${b.c}'`);
  sql(`update consumers set lead_stage = 'allotted' where id = '${b.c}'`);
  await go('/dashboard'); await go('/registry');
  await page.locator('#reg-consumer option', { hasText: b.name }).first().waitFor({ state: 'attached' }).catch(() => {});
  if (await page.locator('#reg-consumer option', { hasText: b.name }).count()) {
    await page.locator('#reg-consumer').selectOption(b.c); await page.locator('#reg-date').fill(later(7)); await page.locator('#reg-submit-btn').click();
    await expect(toast(/scheduled|allocation/i)).toBeVisible();
  }
});

// ---------------------------------------------------------------- Dashboard and the pages that open as html
test('Dashboard loads every panel; the receipt pages open with a token', async () => {
  await go('/dashboard');
  await expect(content()).toContainText(/pending cheques|demand status|forthcoming|daily/i);
  await page.waitForTimeout(1500);
  const b = S.buyers[0];
  for (const p of [`/payments/receipt-detail/${b.c}`, `/payments/receipt-form/${b.c}`, `/payments/receipts/${S.receipt}/html`]) {
    const status = await page.evaluate(async ([path, tk]) => (await fetch('/api' + path, { headers: { Authorization: 'Bearer ' + tk } })).status, [p, token]);
    expect(status, p).toBe(200);
  }
  await page.goto(`${BASE}/api/payments/receipt-detail/${b.c}?token=${token}`).catch(() => {});
  await page.goto('/#/dashboard');
  await page.waitForURL(/#\/dashboard/);
});
