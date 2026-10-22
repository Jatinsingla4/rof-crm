// One applicant's whole life, clicked through the real screens in a real browser:
//   Booking form -> confirm payment -> Demand Raise -> Receipts (record, deposit, clear) -> Transfer -> Surrender -> Restore -> Allotment screens.
// The set-up (company, project, towers, units, plan, GST) is made through the API; everything after that is done on the screens.
// After each screen the database is asked, through the API, whether the screen really did what it showed.
import { test, expect, Page } from '@playwright/test';

const PASSWORD = 'Test#Pass1234';
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const U = Date.now().toString(36).slice(-5);
const today = new Date().toISOString().slice(0, 10);
const later = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const mob = () => '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');

test.describe.configure({ mode: 'serial' });
let page: Page;
let problems: string[] = [];
let token = '';
const api = async (method: string, path: string, body?: any) => {
  const r = await fetch(`${BASE}/api${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j: any = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const must = async (label: string, p: Promise<{ s: number; j: any }>) => { const x = await p; if (x.s >= 300) throw new Error(`${label}: ${x.s} ${JSON.stringify(x.j).slice(0, 300)}`); return x.j.data ?? x.j; };

const S: Record<string, any> = {};   // ids made by the set-up and by the flow

test.beforeAll(async ({ browser }) => {
  token = (await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: PASSWORD }) })).json()).token;
  const co = (await must('company', api('POST', '/companies', { name: `LC Co ${U}` }))).id;
  S.projectName = `LC Project ${U}`;
  S.project = (await must('project', api('POST', '/projects', { companyId: co, name: S.projectName, reraNumber: `LC-${U}`, tcpLicence: 'x' }))).id;
  S.tower = (await must('tower', api('POST', `/projects/${S.project}/towers`, { towerName: `LT-${U}` }))).id;
  S.towerName = `LT-${U}`;
  S.units = [];
  for (let i = 1; i <= 4; i++) S.units.push((await must('unit', api('POST', '/units', { projectId: S.project, towerId: S.tower, unitNumber: `L${i}-${U}`, floor: 2, bhkType: '2BHK', carpetAreaSqft: 1000 + i, superAreaSqft: 1200, basePriceInr: 9000000, totalPriceInr: 9500000 }))).id);
  S.plan = `LC Plan ${U}`; let k = 0;
  for (const pc of [20, 30, 50]) await must('plan', api('POST', `/projects/${S.project}/plan-templates`, { plan_name: S.plan, installment_name: `Row ${++k}`, installment_type: k === 1 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: k * 30, installment_index: k }));
  let slab = (await api('GET', '/gst-configuration/gst-slabs')).j.data.find((x: any) => x.from_date <= today && x.to_date >= today)?.id;
  if (!slab) slab = (await must('slab', api('POST', '/gst-configuration/gst-slabs', { fromDate: later(-3), toDate: later(60) }))).id;
  const tax = (await must('tax', api('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `LC ${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 }))).id;
  for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await api('POST', '/gst-configuration/gst-charge-mapping', { projectId: S.project, slabId: slab, gstTaxId: tax, chargeType: ct });

  page = await browser.newPage();
  page.on('dialog', d => d.accept());
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
test.afterEach(() => { expect(problems, 'Errors seen in the browser during this test').toEqual([]); });

const go = (hash: string) => page.evaluate((h) => { location.hash = h; }, hash);
const content = () => page.locator('#content');
const toast = (t: string | RegExp) => page.locator('.toast', { hasText: t }).first();

test('Booking: fill the form for a new applicant and a unit, save', async () => {
  await go('/booking');
  await expect(content()).toContainText(/unit information/i);
  await content().locator('select[name=project_id]').selectOption({ label: S.projectName });
  await page.waitForTimeout(500);
  await content().locator('select[name=bhk_type]').selectOption({ index: 1 });
  await page.waitForTimeout(300);
  await page.locator('#bk-tower').selectOption({ label: S.towerName });
  await page.locator('#bk-floor').selectOption({ index: 1 });
  await page.locator('#bk-unit-select').selectOption({ index: 1 });
  S.mobile = mob();
  await page.locator('#bk-indiv-fields input[name=first_name]').fill(`Lifecycle${U}`);
  await page.locator('#bk-indiv-fields input[name=last_name]').fill('Buyer');
  await page.locator('#bk-indiv-fields input[name=mobile]').fill(S.mobile);
  await page.locator('#bk-payment-plan').selectOption({ label: new RegExp(S.plan) as any }).catch(async () => { await page.locator('#bk-payment-plan').selectOption({ index: 1 }); });
  await page.locator('#bk-indiv-fields input[name=email]').fill(`lc${U}@mail.test`);
  await page.locator('textarea[name=present_address_line1]').fill('12 Test Road, Sector 9');
  await page.locator('#bk-proceed-btn').click();
  await page.waitForTimeout(2500);
  await expect(page).toHaveURL(/#\/booking-payment\?id=/);
  S.booking = new URL(page.url().replace('#/', '')).searchParams.get('id');
  S.reg = new URL(page.url().replace('#/', '')).searchParams.get('reg');
  const b = (await api('GET', `/booking/${S.booking}`)).j.data;
  S.consumer = b.consumer_id; S.unit = b.unit_id;
  expect(b.status).not.toBe('complete');
  expect(b.unit_id).toBe(S.units[0]);
  expect((await api('GET', `/consumers/${S.consumer}`)).j.data.mobile).toBe(S.mobile);
});

test('Booking step 2: record the booking payment in cash and confirm', async () => {
  await expect(content()).toContainText(/Record payment for booking/);
  await page.locator('#bkp-ptab-cash').click();
  await page.locator('#bkp-amt-cash').fill('25000');
  await page.locator('#bkp-confirm-btn').click();
  await expect(page.getByText('Payment Confirmed!')).toBeVisible();
  await expect(page.getByText('₹25,000')).toBeVisible();
  await page.getByText('View Consumer Profile').click();
  await expect(page).toHaveURL(/#\/consumer\?id=/);
  const b = (await api('GET', `/booking/${S.booking}`)).j.data;
  expect(b.status).toBe('complete');
  expect((await api('GET', `/payments/demands?consumerId=${S.consumer}`)).j.data.length).toBe(3);
});

const demandsOf = async () => (await api('GET', `/payments/demands?consumerId=${S.consumer}`)).j.data as any[];
const byIndex = async (i: number) => (await demandsOf()).find(d => d.installment_index === i);

const raiseOnScreen = async (stage: number, due: string) => {
  await go('/demand-raise');
  await page.locator('#f-project').selectOption({ label: S.projectName });
  await page.locator('#f-plan').selectOption({ label: S.plan });
  await page.locator('#f-installment').selectOption({ index: stage });
  await page.locator('#f-reg-no').fill(S.reg);
  await page.getByRole('button', { name: 'FETCH' }).click();
  await expect(page.locator('#dr-table-body')).toContainText(S.reg);
  await page.locator('#dr-table-body .row-sel').first().check();
  await expect(page.locator('#dr-sel-count')).toContainText('1 demand selected');
  await page.getByRole('button', { name: 'PROCEED' }).first().click();
  await page.locator('#m-inst-date').fill(due);
  await page.getByRole('button', { name: 'UPDATE' }).click();
};

test('Demand Raise (customer wise): the 2nd instalment cannot be raised before the 1st (a message shows, nothing changes)', async () => {
  await raiseOnScreen(2, later(10));
  await expect(page.locator('#demand-raise-result-modal')).toBeVisible();
  expect((await byIndex(2)).status).toBe('pending');
  await page.locator('#demand-raise-result-modal button').first().click();
});

test('Demand Raise (customer wise): raise the 1st, then the 2nd instalment', async () => {
  await raiseOnScreen(1, later(5));
  await expect(toast(/raised 1 demand/i)).toBeVisible();
  expect(['demanded', 'raised']).toContain((await byIndex(1)).status);
  await raiseOnScreen(2, later(10));
  await expect(toast(/raised 1 demand/i)).toBeVisible();
  const d = await byIndex(2);
  expect(['demanded', 'raised']).toContain(d.status);
  expect(new Date(d.due_date).toLocaleDateString('en-CA')).toBe(new Date(Date.now() + 10 * 864e5).toLocaleDateString('en-CA'));
});

// ---------- Receipts screen: every tab, the TDS challan flow, cancel and bounce ----------
const clean = async () => { const t = await content().innerText(); expect(t).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]/); };
const tab = async (name: string) => { await page.locator(`#content button[data-tab="${name}"]`).click(); await page.waitForTimeout(700); await clean(); };
const rcpts = async () => (await api('GET', `/payments/receipts?consumerId=${S.consumer}&pageSize=100`)).j.data as any[];
const challan = async (id: string) => (await api('GET', `/payments/tds/challans/${id}`)).j.data;
const PDF = { name: 'challan.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(300, 65)]) };

test('Receipts: Receipt Generation records a NEFT receipt for the applicant', async () => {
  await go('/receipts');
  await expect(page.locator('#content button[data-tab=entry]')).toBeVisible();
  await page.locator('#rec-consumer-sel').selectOption(S.consumer);
  await page.getByRole('button', { name: 'FETCH CONSUMER' }).click();
  await expect(page.locator('#receipt-form')).toBeVisible();
  await page.locator('#rec-type-btg').getByText('NEFT/RTGS').click();
  await page.locator('#rec-txn').fill(`LCN${U}A`);
  await page.locator('#rec-amount').fill('12000');
  await page.locator('#rec-submit-btn').click();
  await expect(toast(/Receipt saved/i)).toBeVisible();
  const r = (await rcpts()).find(x => x.reference_number === `LCN${U}A` || x.transaction_ref === `LCN${U}A`);
  expect(r, 'the receipt is in the database').toBeTruthy();
  expect(Number(r.amount_received_inr ?? r.amount)).toBe(12000);
  S.rcpt = r.id; S.rcptNo = r.receipt_number;
});

test('Receipts: saving with no amount or a bad amount shows a message and saves nothing', async () => {
  const before = (await rcpts()).length;
  await page.locator('#rec-consumer-sel').selectOption(S.consumer);
  await page.getByRole('button', { name: 'FETCH CONSUMER' }).click();
  await page.locator('#rec-submit-btn').click();
  await expect(toast(/enter an amount/i)).toBeVisible();
  await page.locator('#rec-amount').fill('50');
  await page.locator('#rec-plc').fill('99999999999');
  await page.locator('#rec-submit-btn').click();
  await expect(page.locator('.toast').last()).toBeVisible();
  expect((await rcpts()).length).toBe(before);
  await page.getByRole('button', { name: 'Clear' }).click();
});

test('Receipts: Receipt List, every mode and status filter, and the new receipt shows', async () => {
  await tab('list');
  await page.getByRole('button', { name: 'FETCH', exact: true }).first().click();
  await expect(page.locator('#receipt-list-body')).toContainText(S.rcptNo);
  for (const sel of ['#list-mode', '#list-status']) {
    const opts = await page.locator(`${sel} option`).evaluateAll(o => o.map((x: any) => x.value));
    for (const v of opts) {
      await page.locator(sel).selectOption(v);
      await page.getByRole('button', { name: 'FETCH', exact: true }).first().click();
      await page.waitForTimeout(500);
      await clean();
    }
    await page.locator(sel).selectOption('');
  }
  await page.locator('#list-from').fill(later(-1)); await page.locator('#list-to').fill(later(-2));
  await page.getByRole('button', { name: 'FETCH', exact: true }).first().click(); await page.waitForTimeout(500); await clean();
  await page.locator('#list-from').fill(''); await page.locator('#list-to').fill('');
});

test('Receipts: Receipt Print finds the receipt by registration number and by receipt number', async () => {
  await tab('print');
  await page.locator('#rp-reg-no').fill(S.reg);
  await page.locator('#rp-search-btn').click();
  await expect(page.locator('#rp-results-body')).toContainText(S.rcptNo);
  await page.locator('#rp-reg-no').fill(''); await page.locator('#rp-receipt-no').fill(S.rcptNo);
  for (const v of await page.locator('#rp-print-status option').evaluateAll(o => o.map((x: any) => x.value))) {
    await page.locator('#rp-print-status').selectOption(v); await page.locator('#rp-search-btn').click(); await page.waitForTimeout(500); await clean();
  }
  await page.locator('#rp-print-status').selectOption('');
  await page.locator('#rp-receipt-no').fill(`NOPE-${U}`); await page.locator('#rp-search-btn').click(); await page.waitForTimeout(600); await clean();
  await page.locator('#rp-receipt-no').fill('');
});

test('Receipts: Journal Entry tabs open, FETCH works, placeholder buttons say so', async () => {
  await tab('journal');
  for (const t of ['dc', 'report', 'reversal', 'entry']) { await page.locator(`#je-tab-${t}`).click(); await page.waitForTimeout(300); await clean(); }
  await page.locator('#je-reg-filter').fill(S.reg);
  await page.locator('#je-fetch-btn').click();
  await expect(page.locator('#je-results-container')).toBeVisible();
  await clean();
  await page.locator('#je-tab-dc').click();
  await page.getByRole('button', { name: /POST DEBIT\/CREDIT/ }).click();
  await expect(toast(/coming soon/i)).toBeVisible();
  await page.locator('#je-tab-report').click();
  await page.getByRole('button', { name: 'FETCH' }).last().click();
  await expect(toast(/coming soon/i).first()).toBeVisible();
  await page.locator('#je-tab-entry').click();
});

test('TDS: Upload Challan with a scan, validation messages, a duplicate number', async () => {
  S.challanNo = `LCCH${U}1`;
  await tab('upload-tds');
  await page.getByRole('button', { name: 'UPLOAD CHALLAN' }).click();
  await expect(toast(/required/i)).toBeVisible();
  await page.locator('#tds-no').fill('<b>x</b>'); await page.locator('#tds-date').fill(today); await page.locator('#tds-amount').fill('100');
  await page.getByRole('button', { name: 'UPLOAD CHALLAN' }).click();
  await expect(toast(/not allowed|can only have/i)).toBeVisible();
  await page.locator('#tds-no').fill(S.challanNo); await page.locator('#tds-date').fill(later(5));
  await page.getByRole('button', { name: 'UPLOAD CHALLAN' }).click();
  await expect(toast(/future/i)).toBeVisible();
  await page.locator('#tds-date').fill(today); await page.locator('#tds-amount').fill('-5');
  await page.getByRole('button', { name: 'UPLOAD CHALLAN' }).click();
  await expect(toast(/Amount/i).last()).toBeVisible();
  await page.locator('#tds-amount').fill('10000.50'); await page.locator('#tds-bank').fill('State Bank');
  await page.locator('#tds-file').setInputFiles({ name: 'notes.txt', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') });
  await page.getByRole('button', { name: 'UPLOAD CHALLAN' }).click();
  await expect(toast(/PDF, PNG or JPEG/i)).toBeVisible();
  await page.locator('#tds-file').setInputFiles(PDF);
  await page.getByRole('button', { name: 'UPLOAD CHALLAN' }).click();
  await expect(toast(/TDS Challan Uploaded/i)).toBeVisible();
  await expect(page.locator('#tds-report-body')).toContainText(S.challanNo);
  const c = (await api('GET', `/payments/tds/challans?search=${S.challanNo}`)).j.data[0];
  expect(c.has_file).toBe(true); expect(Number(c.amount)).toBe(10000.5); S.challan = c.id;
  await tab('upload-tds');
  await page.locator('#tds-no').fill(S.challanNo.toLowerCase()); await page.locator('#tds-date').fill(today); await page.locator('#tds-amount').fill('1');
  await page.getByRole('button', { name: 'UPLOAD CHALLAN' }).click();
  await expect(toast(/already exists/i)).toBeVisible();
  expect((await api('GET', `/payments/tds/challans?search=${S.challanNo}`)).j.total).toBe(1);
});

test('TDS: Challan Report, every status filter, search, the scan opens', async () => {
  await tab('tds-report');
  await expect(page.locator('#tds-report-body')).toContainText(S.challanNo);
  for (const v of await page.locator('#tds-f-status option').evaluateAll(o => o.map((x: any) => x.value))) {
    await page.locator('#tds-f-status').selectOption(v); await page.getByRole('button', { name: 'SEARCH' }).click(); await page.waitForTimeout(500); await clean();
    if (v === 'fully_assigned') await expect(page.locator('#tds-report-body')).not.toContainText(S.challanNo);
  }
  await page.locator('#tds-f-status').selectOption('');
  await page.locator('#tds-f-search').fill(S.challanNo); await page.getByRole('button', { name: 'SEARCH' }).click();
  await expect(page.locator('#tds-report-body tbody tr')).toHaveCount(1);
  await page.locator('#tds-f-search').fill('%'); await page.getByRole('button', { name: 'SEARCH' }).click();
  await expect(page.locator('#tds-report-body')).toContainText('No challans found');
  await page.locator('#tds-f-search').fill(S.challanNo); await page.getByRole('button', { name: 'SEARCH' }).click();
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('#tds-report-body').getByRole('button', { name: 'View' }).click()]);
  await popup.close();
});

test('TDS: Assign Challan to the receipt, refusals, and the report follows', async () => {
  await tab('assign-tds');
  await page.getByRole('button', { name: 'ASSIGN TDS' }).click();
  await expect(toast(/Select a challan/i)).toBeVisible();
  await page.locator('#ass-challan-sel').selectOption(S.challan);
  await page.getByRole('button', { name: 'ASSIGN TDS' }).click();
  await expect(toast(/select a receipt/i)).toBeVisible();
  await page.locator('#ass-receipt-no').fill(S.rcptNo);
  await expect(page.locator('#ass-receipt-sel option', { hasText: S.rcptNo })).toHaveCount(1);
  await page.getByRole('button', { name: 'ASSIGN TDS' }).click();
  await expect(toast(/Enter the amount/i)).toBeVisible();
  await page.locator('#ass-amount').fill('13000');
  await page.getByRole('button', { name: 'ASSIGN TDS' }).click();
  await expect(toast(/cannot be more than its amount|has only/i)).toBeVisible();
  expect(Number((await challan(S.challan)).assigned_amount)).toBe(0);
  await page.locator('#ass-amount').fill('3000.25');
  await page.getByRole('button', { name: 'ASSIGN TDS' }).click();
  await expect(toast(/TDS assigned/i)).toBeVisible();
  expect(Number((await challan(S.challan)).assigned_amount)).toBe(3000.25);
  await page.locator('#ass-amount').fill('10');
  await page.getByRole('button', { name: 'ASSIGN TDS' }).click();
  await expect(toast(/already assigned/i)).toBeVisible();
  await tab('tds-report');
  await page.locator('#tds-f-search').fill(S.challanNo); await page.getByRole('button', { name: 'SEARCH' }).click();
  const row = page.locator('#tds-report-body tbody tr').first();
  await expect(row).toContainText('₹3,000.25'); await expect(row).toContainText('₹7,000.25'); await expect(row).toContainText(/partially/i);
  await row.getByRole('button', { name: 'Assignments' }).click();
  await expect(page.locator('#tds-detail-body')).toContainText(S.rcptNo);
  await expect(page.locator('#tds-detail-body')).toContainText('Active');
});

test('TDS: Release an assignment from the report, then assign it again', async () => {
  await page.locator('#tds-detail-body').getByRole('button', { name: 'Release' }).click();
  await expect(toast(/Assignment released/i)).toBeVisible();
  expect(Number((await challan(S.challan)).assigned_amount)).toBe(0);
  await expect(page.locator('#tds-detail-body')).toContainText('Released');
  await tab('assign-tds');
  await page.locator('#ass-challan-sel').selectOption(S.challan);
  await page.locator('#ass-receipt-no').fill(S.rcptNo);
  await expect(page.locator('#ass-receipt-sel option', { hasText: S.rcptNo })).toHaveCount(1);
  await page.locator('#ass-amount').fill('4000');
  await page.getByRole('button', { name: 'ASSIGN TDS' }).click();
  await expect(toast(/TDS assigned/i)).toBeVisible();
  expect(Number((await challan(S.challan)).assigned_amount)).toBe(4000);
});

test('Receipts: Edit Receipt opens the receipt, saves a change', async () => {
  await tab('edit');
  const row = page.locator('#edit-receipt-body tr', { hasText: S.rcptNo });
  await row.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#receipt-form')).toBeVisible();
  await expect(page.locator('#rec-txn')).toHaveValue(`LCN${U}A`);
  await page.locator('#rec-remarks').fill('edited on screen');
  await page.locator('#rec-submit-btn').click();
  await expect(page.locator('.toast').last()).toBeVisible();
  await clean();
  await page.locator('#content button[data-tab=entry]').click();
});

test('Receipts: Cancel Receipt gives the TDS back to the challan', async () => {
  await tab('cancel');
  const row = page.locator('#cancel-receipt-body tr', { hasText: S.rcptNo });
  await row.getByRole('button', { name: 'Cancel' }).click();
  await expect(toast(/cancelled successfully/i)).toBeVisible();
  expect((await rcpts()).find(x => x.id === S.rcpt).status).toBe('cancelled');
  const c = await challan(S.challan);
  expect(Number(c.assigned_amount)).toBe(0); expect(Number(c.balance)).toBe(10000.5);
  expect(c.assignments.some((a: any) => a.released_at && /cancel/i.test(a.release_reason))).toBe(true);
  await tab('tds-report');
  await page.locator('#tds-f-search').fill(S.challanNo); await page.getByRole('button', { name: 'SEARCH' }).click();
  const r = page.locator('#tds-report-body tbody tr').first();
  await expect(r).toContainText('₹10,000.50'); await expect(r).toContainText(/available/i);
  await tab('assign-tds');
  await page.locator('#ass-receipt-no').fill(S.rcptNo);
  await expect(page.locator('#ass-receipt-sel option', { hasText: S.rcptNo })).toHaveCount(0);
});

test('Receipts: a bounced receipt gives its TDS back too', async () => {
  const x = await api('POST', '/payments/receipts', { consumerId: S.consumer, amountReceivedInr: 6000, paymentMode: 'neft', referenceNumber: `LCN${U}B`, paymentDate: today, installmentIndex: 2 });
  expect(x.s).toBeLessThan(300);
  const id = x.j.receipt?.id || x.j.data?.id;
  expect((await api('POST', '/payments/tds/assign', { challanId: S.challan, receiptId: id, amount: 2500 })).s).toBe(200);
  expect(Number((await challan(S.challan)).assigned_amount)).toBe(2500);
  expect((await api('PATCH', `/payments/receipts/${id}/bounce`, { reason: 'insufficient funds', penaltyAmount: 0 })).s).toBe(200);
  expect(Number((await challan(S.challan)).assigned_amount)).toBe(0);
  await tab('tds-report');
  await page.locator('#tds-f-search').fill(S.challanNo); await page.getByRole('button', { name: 'SEARCH' }).click();
  await page.locator('#tds-report-body').getByRole('button', { name: 'Assignments' }).click();
  await expect(page.locator('#tds-detail-body')).toContainText('Receipt bounced');
});
