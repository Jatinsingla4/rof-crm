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
let dialogs: string[] = [];   // every alert/confirm text the screens showed
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
  page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
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
test.beforeEach(() => { problems = []; dialogs = []; });
test.afterEach(() => { expect(problems, 'Errors seen in the browser during this test').toEqual([]); });

const go = async (hash: string) => {
  if (/\.html/.test(new URL(page.url()).pathname)) { await page.goto('/#' + hash); return; }   // coming from a page of its own (pending cheques)
  await page.evaluate((h) => { location.hash = h; }, hash);
};
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
  await expect.poll(async () => (await byIndex(2)).status).not.toBe('pending');   // the toast of the 1st raise may still be on screen, so wait for the data
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

// ---------- Pending cheques screen (a page of its own): fetch, filters, clear, hold, release, bounce ----------
const pcClean = async () => { expect(await page.locator('body').innerText()).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]/); };
const pc = () => page.locator('#pc-tbody');
const pcRow = (no: string) => page.locator('#pc-tbody tr', { hasText: no });
const pcFetch = async () => { await page.getByRole('button', { name: 'FETCH', exact: true }).click(); await page.waitForTimeout(600); };
const pcOpen = async () => { await page.goto(`/pending-cheques.html?project_id=${S.project}`); await expect(page.locator('#pc-tbody')).not.toContainText('Loading'); await expect(page.locator('#pc-tbody tr').first()).toBeVisible(); };
const rcpt = async (id: string) => (await api('GET', `/payments/receipts/${id}`)).j.data;
const cheque = async (label: string, amount = 5000) => {
  const no = `LC${U}${label}`;
  const x = await api('POST', '/payments/receipts', { consumerId: S.consumer, amountReceivedInr: amount, paymentMode: 'cheque', chequeNo: no, chequeDate: today, bankName: 'HDFC', paymentDate: today });
  expect(x.s, JSON.stringify(x.j)).toBeLessThan(300);
  const id = x.j.receipt?.id || x.j.data?.id;
  return { id, no, rno: x.j.receipt?.receipt_number || x.j.data?.receipt_number as string };
};

test('Pending cheques: five new cheques show on the screen with the right unit, tower, amount and total', async () => {
  S.chq = {}; for (const l of ['A', 'B', 'C', 'D', 'E']) S.chq[l] = await cheque(l);
  await pcOpen();
  for (const l of Object.keys(S.chq)) {
    const r = pcRow(S.chq[l].no);
    await expect(r).toHaveCount(1);
    await expect(r).toContainText(S.reg); await expect(r).toContainText(`L1-${U}`); await expect(r).toContainText(S.towerName);
    await expect(r).toContainText('Pending'); await expect(r).toContainText('5,000');
  }
  await pcClean();
  const n = await page.locator('#pc-tbody tr').count();
  await expect(page.locator('#count-bar')).toContainText(`${n} record(s)`);
  const apiRows = (await api('GET', `/payments/receipts/pending-cheques?project_id=${S.project}`)).j.data;
  expect(apiRows.length).toBe(n);
  const sum = apiRows.reduce((s: number, r: any) => s + Number(r.amount), 0);
  expect((await page.locator('#pc-total-amt').innerText()).replace(/[^\d.]/g, '')).toBe(String(sum.toFixed(2)).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1').replace(/[^\d.]/g, '') || '0');
});

test('Pending cheques: every filter (tower, unit address, dates, wrong values) gives the right rows', async () => {
  const towers = await page.locator('#pc-tower option').evaluateAll(o => o.map((x: any) => x.value));
  expect(towers.length).toBeGreaterThan(1);
  await page.locator('#pc-tower').selectOption(S.tower); await pcFetch();
  await expect(pcRow(S.chq.A.no)).toHaveCount(1); await pcClean();
  await page.locator('#pc-tower').selectOption(''); 
  await page.locator('#pc-unit-address').fill(`L1-${U}`); await pcFetch();
  await expect(pcRow(S.chq.A.no)).toHaveCount(1);
  await page.locator('#pc-unit-address').fill(`L2-${U}`); await pcFetch();
  await expect(pcRow(S.chq.A.no)).toHaveCount(0); await expect(pc()).toContainText('No records found');
  await page.locator('#pc-unit-address').fill('%'); await pcFetch(); await expect(pcRow(S.chq.A.no)).toHaveCount(0); await pcClean();
  await page.locator('#pc-unit-address').fill("'; drop table receipts;--"); await pcFetch(); await pcClean();
  await page.locator('#pc-unit-address').fill('');
  await page.locator('#pc-date-from').fill(later(3)); await pcFetch(); await expect(pc()).toContainText('No records found');
  await page.locator('#pc-date-from').fill(today); await page.locator('#pc-date-to').fill(today); await pcFetch(); await expect(pcRow(S.chq.A.no)).toHaveCount(1);
  await page.locator('#pc-date-from').fill(later(2)); await page.locator('#pc-date-to').fill(later(1)); await pcFetch();
  await pcClean(); expect(await pc().innerText()).toMatch(/No records found|Error: .*from_date/);   // a backwards range is refused or empty, never a crash
  await page.locator('#pc-date-from').fill(''); await page.locator('#pc-date-to').fill('');
  await page.locator('#pc-tower').selectOption(S.tower); await page.locator('#pc-unit-address').fill(`L1-${U}`); await page.locator('#pc-date-from').fill(today); await pcFetch();
  await expect(pcRow(S.chq.A.no)).toHaveCount(1);
  expect(await page.locator('#pc-tbody tr').count()).toBeGreaterThanOrEqual(5);
  await page.locator('#pc-tower').selectOption(''); await page.locator('#pc-unit-address').fill(''); await page.locator('#pc-date-from').fill(''); await pcFetch();
});

test('Pending cheques: a deposited cheque shows Deposited with its date, and a deposit on a wrong state is refused', async () => {
  expect((await api('PATCH', `/payments/receipts/${S.chq.A.id}/deposit`, {})).s).toBe(400);
  expect((await api('PATCH', `/payments/receipts/${S.chq.A.id}/deposit`, { deposit_date: later(5) })).s).toBe(400);
  const ok = await api('PATCH', `/payments/receipts/${S.chq.A.id}/deposit`, { deposit_date: today });
  expect(ok.s).toBe(200);
  expect((await api('PATCH', `/payments/receipts/${S.chq.A.id}/deposit`, { deposit_date: today })).s).toBe(400);   // already deposited
  await pcOpen();
  const r = pcRow(S.chq.A.no);
  await expect(r).toContainText('Deposited');
  await expect(r.locator('.pc-deposit-date')).toHaveValue(new RegExp(`^(${today}|${later(-1)})$`));   // a DATE column is sent as midnight local time, so a non-UTC server shows the day before
  expect((await rcpt(S.chq.A.id)).status).toBe('deposited');
});

test('Pending cheques: CLEAR with nothing selected says so; CLEAR with a date and bank clears the cheque', async () => {
  await pcOpen();
  await page.getByRole('button', { name: /^CLEAR/ }).click();
  expect(dialogs.join()).toMatch(/select at least one/i);
  const bank = (await page.locator('.pc-clearing-bank').first().locator('option').evaluateAll(o => o.map((x: any) => x.value))).find(v => v);
  const r = pcRow(S.chq.A.no);
  await r.locator('.pc-cb').check();
  await r.locator('.pc-clearing-date').fill(today);
  if (bank) await r.locator('.pc-clearing-bank').selectOption(bank);
  dialogs = [];
  await page.getByRole('button', { name: /^CLEAR/ }).click();
  await expect.poll(() => dialogs.join()).toMatch(/Success: 1, Failed: 0/);
  await expect(pcRow(S.chq.A.no)).toHaveCount(0);
  const d = await rcpt(S.chq.A.id);
  expect(d.status).toBe('cleared'); expect([today, later(-1)]).toContain(String(d.clearing_date).slice(0, 10));
  if (bank) expect(d.clearing_bank_id).toBe(bank);
});

test('Pending cheques: CLEAR without a clearing date uses today (or says why), and never leaves the screen in a wrong state', async () => {
  await pcOpen();
  const r = pcRow(S.chq.D.no);
  await r.locator('.pc-cb').check();
  dialogs = [];
  await page.getByRole('button', { name: /^CLEAR/ }).click();
  await expect.poll(() => dialogs.length).toBeGreaterThan(0);
  const st = (await rcpt(S.chq.D.id)).status;
  // whichever way it goes, the message must match what the database holds
  if (/Success: 1/.test(dialogs.join())) expect(st).toBe('cleared'); else expect(st).toBe('pending');
  expect(dialogs.join()).not.toMatch(/undefined|NaN/);
  expect(st, 'a cheque cleared with the date left blank should clear with today as the date').toBe('cleared');
});

test('Pending cheques: Hold needs a remark, Hold puts it on hold, Release brings it back to pending', async () => {
  await pcOpen();
  const r = pcRow(S.chq.B.no);
  await r.getByRole('button', { name: 'Hold' }).click();
  await expect(page.locator('#pc-hold-modal')).toBeVisible();
  dialogs = [];
  await page.locator('.btn-hold-submit').click();
  expect(dialogs.join()).toMatch(/remark is required/i);
  await page.locator('#pc-hold-remark').fill('   ');
  await page.locator('.btn-hold-submit').click();
  expect(dialogs.join()).toMatch(/remark is required/i);
  expect((await rcpt(S.chq.B.id)).status).toBe('pending');
  await page.locator('#pc-hold-remark').fill('awaiting customer call');
  await page.locator('.btn-hold-submit').click();
  await expect.poll(async () => (await rcpt(S.chq.B.id)).status).toBe('on_hold');
  expect((await rcpt(S.chq.B.id)).hold_remark).toBe('awaiting customer call');
  await expect(pcRow(S.chq.B.no)).toContainText('On Hold');
  await expect(pcRow(S.chq.B.no)).toContainText('awaiting customer call');
  // a held cheque cannot be held again from a stale screen, but holding again with a new remark is allowed by the API: check the screen
  await expect(pcRow(S.chq.B.no).getByRole('button', { name: 'Release' })).toBeVisible();
  await pcRow(S.chq.B.no).getByRole('button', { name: 'Release' }).click();
  await expect.poll(async () => (await rcpt(S.chq.B.id)).status).toBe('pending');
  expect((await rcpt(S.chq.B.id)).hold_remark).toBeNull();
  await expect(pcRow(S.chq.B.no)).toContainText('Pending');
  await expect(pcRow(S.chq.B.no).getByRole('button', { name: 'Hold' })).toBeVisible();
});

test('Pending cheques: BOUNCE needs a reason, a reason bounces the cheque in the database', async () => {
  await pcOpen();
  const r = pcRow(S.chq.C.no);
  await r.locator('.pc-cb').check();
  dialogs = [];
  await page.getByRole('button', { name: 'BOUNCE', exact: true }).click();
  await expect.poll(() => dialogs.join()).toMatch(/skipped/i);
  expect((await rcpt(S.chq.C.id)).status).toBe('pending');
  const reasons = await r.locator('.pc-bounce-reason option').evaluateAll(o => o.map((x: any) => x.value).filter(Boolean));
  expect(reasons.length).toBe(13);
  await pcRow(S.chq.C.no).locator('.pc-bounce-reason').selectOption('Fund Insufficient');
  await pcRow(S.chq.C.no).locator('.pc-cb').check();   // the table reloads after each action, so the tick is gone
  dialogs = [];
  await page.getByRole('button', { name: 'BOUNCE', exact: true }).click();
  await expect.poll(() => dialogs.join()).toMatch(/Success: 1, Failed: 0/);
  await expect(pcRow(S.chq.C.no)).toHaveCount(0);
  expect((await rcpt(S.chq.C.id)).status).toBe('bounced');
});

test('Pending cheques: actions on a cheque that changed behind the screen fail with a clear message and change nothing', async () => {
  await pcOpen();                       // E still shows as Pending here
  expect((await api('PATCH', `/payments/receipts/${S.chq.E.id}/clear`, { clearing_date: today })).s).toBe(200);   // someone else clears it
  const r = pcRow(S.chq.E.no);
  await r.locator('.pc-cb').check();
  await r.locator('.pc-clearing-date').fill(today);
  dialogs = [];
  await page.getByRole('button', { name: /^CLEAR/ }).click();
  await expect.poll(() => dialogs.join()).toMatch(/Failed: 1/);
  expect(dialogs.join()).toMatch(/cleared/);
  await pcOpen(); await expect(pcRow(S.chq.E.no)).toHaveCount(0);
  // API-level wrong order on finished cheques
  for (const [l, p, b] of [['E', 'hold', { hold_remark: 'x' }], ['E', 'release-hold', {}], ['E', 'deposit', { deposit_date: today }], ['C', 'clear', { clearing_date: today }], ['C', 'hold', { hold_remark: 'x' }]] as any[]) {
    const x = await api('PATCH', `/payments/receipts/${S.chq[l].id}/${p}`, b);
    expect(x.s, `${l} ${p}`).toBe(400);
  }
  expect((await api('PATCH', `/payments/receipts/${S.chq.C.id}/bounce`, { reason: 'again' })).s).toBe(409);   // already bounced
  expect((await api('PATCH', `/payments/receipts/not-an-id/clear`, { clearing_date: today })).s).toBe(400);
  expect((await api('PATCH', `/payments/receipts/${S.chq.B.id}/clear`, { clearing_date: 'junk' })).s).toBe(400);
  expect((await rcpt(S.chq.B.id)).status).toBe('pending');
});

test('Pending cheques: select all, double click on CLEAR, and a mixed selection', async () => {
  const f = await cheque('F'), g = await cheque('G');
  expect((await api('PATCH', `/payments/receipts/${g.id}/hold`, { hold_remark: 'keep' })).s).toBe(200);
  await pcOpen();
  await page.locator('#pc-select-all').check();
  expect(await page.locator('.pc-cb:checked').count()).toBe(await page.locator('.pc-cb').count());
  await page.locator('#pc-select-all').uncheck();
  expect(await page.locator('.pc-cb:checked').count()).toBe(0);
  for (const x of [f, g]) { const r = pcRow(x.no); await r.locator('.pc-cb').check(); await r.locator('.pc-clearing-date').fill(today); }
  dialogs = [];
  await page.getByRole('button', { name: /^CLEAR/ }).dblclick();
  await expect.poll(() => dialogs.length).toBeGreaterThan(0);
  await page.waitForTimeout(800);
  expect((await rcpt(f.id)).status).toBe('cleared');
  expect((await rcpt(g.id)).status).toBe('cleared');     // a held cheque can be cleared directly
  expect(dialogs.join()).not.toMatch(/undefined|NaN/);
  const st: Record<string, string> = {}; for (const [l, c] of Object.entries<any>(S.chq)) st[l] = (await rcpt(c.id)).status;
  expect(st).toEqual({ A: 'cleared', B: 'pending', C: 'bounced', D: 'cleared', E: 'cleared' });
});

// ---------- Transfers: fee setup, search, transfer the unit to a new applicant, date edit, report, detail, letter ----------
const aadhaar = () => String(Math.floor(Math.random() * 7.9e11) + 2e11);   // 12 digits, not starting with 0 or 1
const inr = (n: number) => Number(n).toLocaleString('en-IN');
const trMsg = (id: string) => page.locator(`#${id}`);
const transfersOf = async () => (await api('GET', `/transfers/list?projectId=${S.project}&search=${S.reg}`)).j.data as any[];

test('Transfer Fee Setup: wrong input is refused, a saved fee is stored and comes back on re-open', async () => {
  await go('/transfer-fee-setup');
  await expect(page.locator('#tfs-project')).toBeVisible();
  await page.getByRole('button', { name: 'SAVE', exact: true }).click();
  await expect(page.locator('#tfs-msg')).toContainText(/select a project/i);
  await page.locator('#tfs-project').selectOption({ label: S.projectName });
  await page.waitForTimeout(500);
  expect((await api('GET', `/transfers/fee-master?projectId=${S.project}`)).s).toBe(404);   // nothing saved yet, screen shows defaults
  await expect(page.locator('#tfs-fee')).toHaveValue(new RegExp('^0(\\.0+)?$'));
  for (const [id, v] of [['tfs-fee', '-5'], ['tfs-cgst', '150'], ['tfs-admin', '2000000000'], ['tfs-stax', '-1']]) {
    await page.locator(`#${id}`).fill(v);
    await page.getByRole('button', { name: 'SAVE', exact: true }).click();
    await expect(page.locator('#tfs-msg')).toContainText(/error|must|not valid/i);
    await page.locator(`#${id}`).fill(id === 'tfs-stax' ? '0' : '0');
  }
  expect((await api('GET', `/transfers/fee-master?projectId=${S.project}`)).s).toBe(404);
  await page.locator('#tfs-fee').fill('5000'); await page.locator('#tfs-admin').fill('1000');
  await page.locator('#tfs-cgst').fill('9'); await page.locator('#tfs-sgst').fill('9'); await page.locator('#tfs-stax').fill('0');
  await page.locator('#tfs-effdate').fill(today);
  await page.getByRole('button', { name: 'SAVE', exact: true }).dblclick();
  await expect(page.locator('#tfs-msg')).toContainText(/saved/i);
  const fm = (await api('GET', `/transfers/fee-master?projectId=${S.project}`)).j.data;
  expect(Number(fm.transfer_fee_inr)).toBe(5000); expect(Number(fm.admin_charges_inr)).toBe(1000);
  expect(Number(fm.cgst_pct)).toBe(9); expect(Number(fm.sgst_pct)).toBe(9); expect(Number(fm.service_tax_pct)).toBe(0); expect(fm.is_foc).toBe(false);
  // FOC ticked zeroes the fees on screen
  await page.locator('#tfs-foc').check();
  await expect(page.locator('#tfs-fee')).toHaveValue(new RegExp('^0(\\.0+)?$')); await expect(page.locator('#tfs-admin')).toHaveValue(new RegExp('^0(\\.0+)?$'));
  await page.locator('#tfs-foc').uncheck();
  // re-open: the saved values are back
  await go('/transfer-fee-setup'); await page.locator('#tfs-project').selectOption({ label: S.projectName }); await page.waitForTimeout(600);
  await expect(page.locator('#tfs-fee')).toHaveValue(new RegExp('^5000(\\.0+)?$')); await expect(page.locator('#tfs-cgst')).toHaveValue(new RegExp('^9(\\.0+)?$'));
  await clean();
});

test('Transfers: before the unit is allotted the applicant is not on the transfer search; allot the unit', async () => {
  await go('/transfers');
  await expect(page.locator('#tr-f-regno')).toBeVisible();
  await page.locator('#tr-f-project').selectOption({ label: S.projectName }); await page.locator('#tr-f-regno').fill(S.reg);   // registration numbers repeat across projects
  await page.getByRole('button', { name: 'FETCH', exact: true }).first().click();
  await expect(page.locator('#tr-search-results')).toContainText(/No allotted consumers found/i);
  // wrong order: transferring a unit that is not allotted
  const early = await api('POST', '/transfers', { unitId: S.unit, oldConsumerId: S.consumer, newConsumerId: S.consumer });
  expect(early.s).toBe(400);
  // the applicant's unit is allotted (done here through the API; the Allotment screens are clicked through later on other applicants)
  const a = await api('POST', '/allocations', { consumerId: S.consumer, unitId: S.unit, projectId: S.project, allotmentDate: today });
  expect(a.s, JSON.stringify(a.j)).toBe(201);
  expect((await api('GET', `/consumers/${S.consumer}`)).j.data.allocated_unit_id).toBe(S.unit);
});

test('Transfers: search by project, registration number, name and unit; wrong values find nothing', async () => {
  await go('/transfers');
  const fetchBtn = page.getByRole('button', { name: 'FETCH', exact: true }).first();
  await page.locator('#tr-f-project').selectOption({ label: S.projectName });
  await fetchBtn.click(); await expect(page.locator('#tr-search-results')).toContainText(S.reg);
  await page.locator('#tr-f-project').selectOption({ label: S.projectName }); await page.locator('#tr-f-regno').fill(S.reg);   // registration numbers repeat across projects await fetchBtn.click();
  await expect(page.locator('#tr-search-results tbody tr')).toHaveCount(1);
  await page.locator('#tr-f-regno').fill(''); await page.locator('#tr-f-name').fill(`Lifecycle${U}`); await fetchBtn.click();
  await expect(page.locator('#tr-search-results')).toContainText(S.reg);
  await page.locator('#tr-f-name').fill(''); await page.locator('#tr-f-unit').fill(`L1-${U}`); await fetchBtn.click();
  await expect(page.locator('#tr-search-results')).toContainText(S.reg);
  for (const [id, v] of [['tr-f-regno', `NOPE${U}`], ['tr-f-name', '%'], ['tr-f-unit', "L1'; drop table units;--"], ['tr-f-regno', '<b>x</b>']]) {
    await page.locator(`#${id}`).fill(v); await fetchBtn.click(); await page.waitForTimeout(500);
    await expect(page.locator('#tr-search-results')).toContainText(/No allotted consumers found|Error/);
    await page.locator(`#${id}`).fill('');
  }
  await clean();
});

test('Transfers: the form is pre-filled from the fee setup, and the checks on both steps refuse wrong input', async () => {
  await page.locator('#tr-f-project').selectOption({ label: S.projectName }); await page.locator('#tr-f-regno').fill(S.reg);   // registration numbers repeat across projects
  await page.getByRole('button', { name: 'FETCH', exact: true }).first().click();
  await page.locator('#tr-search-results').getByRole('button', { name: 'TRANSFER' }).click();
  await expect(page.locator('#tr-regno')).toHaveValue(S.reg);
  await expect(content()).toContainText(`L1-${U}`);
  await expect(page.locator('#tr-fee')).toHaveValue(new RegExp('^5000(\\.0+)?$')); await expect(page.locator('#tr-admin')).toHaveValue(new RegExp('^1000(\\.0+)?$'));
  await expect(page.locator('#tr-cgst-amt')).toHaveValue(new RegExp('^540(\\.0+)?$')); await expect(page.locator('#tr-sgst-amt')).toHaveValue(new RegExp('^540(\\.0+)?$'));
  await page.locator('#tr-fee').fill('1000'); await expect(page.locator('#tr-cgst-amt')).toHaveValue(new RegExp('^180(\\.0+)?$'));   // taxes follow the fee
  await page.locator('#tr-fee').fill('5000');
  await page.locator('#tr-transfer-date').fill('');
  await page.getByRole('button', { name: /NEXT/ }).click();
  await expect(page.locator('#tr-form-msg')).toContainText(/Transfer Date is required/);
  await page.locator('#tr-transfer-date').fill(today);
  S.trNo = `LCT${U}1`;
  await page.locator('#tr-transfer-no').fill(S.trNo); await page.locator('#tr-receipt-no').fill(`LCR${U}`);
  await page.locator('#tr-transfer-amt').fill('50000'); await page.locator('#tr-gstin').fill('123');   // a wrong GSTIN, found out only on save
  await page.locator('#tr-remarks').fill('lifecycle transfer');
  await page.getByRole('button', { name: /NEXT/ }).click();
  await expect(page.locator('#tr-b-fname')).toBeVisible();
  // buyer step: empty and half filled
  const save = () => page.getByRole('button', { name: /SAVE TRANSFER/ }).click();
  await save(); await expect(page.locator('#tr-buyer-msg')).toContainText(/First Name is required/);
  await page.locator('#tr-b-fname').fill(`Buyer${U}`); await save(); await expect(page.locator('#tr-buyer-msg')).toContainText(/Mobile is required/);
  S.buyerMobile = mob(); S.buyerAadhaar = aadhaar();
  await page.locator('#tr-b-mobile').fill(S.buyerMobile); await save(); await expect(page.locator('#tr-buyer-msg')).toContainText(/Aadhaar No is required/);
  const before = (await api('GET', `/consumers?search=Buyer${U}`)).j;
  expect((before.consumers || before.data || []).length).toBe(0);   // nothing was created by the refused saves
  await clean();
});

test('Transfers: a transfer the server refuses changes nothing, and fixing it and saving again reuses the same buyer record', async () => {
  await page.locator('#tr-b-lname').fill('Owner');
  await page.locator('#tr-b-aadhaar').fill(S.buyerAadhaar);
  await page.locator('#tr-b-pan').fill('ABCDE1234F');
  await page.locator('#tr-b-email').fill(`buyer${U}@mail.test`);
  await page.locator('#tr-b-addr').fill('44 Buyer Lane'); await page.locator('#tr-b-city').fill('Gurugram'); await page.locator('#tr-b-pin').fill('122001');
  await page.getByRole('button', { name: /SAVE TRANSFER/ }).click();
  await expect(page.locator('#tr-buyer-msg')).toContainText(/Error/i);       // the GSTIN "123" is refused
  expect((await transfersOf()).length).toBe(0);
  expect((await api('GET', `/consumers/${S.consumer}`)).j.data.allocated_unit_id).toBe(S.unit);
  const buyers = async () => { const j = (await api('GET', `/consumers?search=Buyer${U}`)).j; return (j.consumers || j.data || []) as any[]; };
  const orphan = (await buyers()).length;
  // go back, correct the GSTIN, fill the buyer again, save
  await page.locator('.tr-btn-back').click();
  await expect(page.locator('#tr-transfer-no')).toHaveValue(S.trNo);   // going back keeps what was typed
  await expect(page.locator('#tr-remarks')).toHaveValue('lifecycle transfer');
  await expect(page.locator('#tr-transfer-amt')).toHaveValue(new RegExp('^50000(\\.0+)?$'));
  await page.locator('#tr-gstin').fill('');
  await page.getByRole('button', { name: /NEXT/ }).click();
  await page.locator('#tr-b-fname').fill(`Buyer${U}`); await page.locator('#tr-b-lname').fill('Owner');
  await page.locator('#tr-b-mobile').fill(S.buyerMobile); await page.locator('#tr-b-aadhaar').fill(S.buyerAadhaar);
  await page.locator('#tr-b-email').fill(`buyer${U}@mail.test`); await page.locator('#tr-b-addr').fill('44 Buyer Lane');
  await page.getByRole('button', { name: /SAVE TRANSFER/ }).click();
  await expect(page.locator('#tr-buyer-msg')).toContainText(/Transfer completed successfully/i);
  const t = (await transfersOf())[0];
  expect(t, 'the transfer is in the database').toBeTruthy();
  S.transfer = t.id; S.buyer = t.buyer_id;
  expect((await buyers()).length, 'only one buyer record exists after the retry').toBe(1);
  expect(orphan, 'the buyer record of the refused save is reused, not doubled').toBe(1);   // a refused transfer leaves the buyer as an ordinary applicant (enquiry); the retry finds it by mobile
});

test('Transfers: the database holds the transfer: new owner, old owner, unit, plan, receipts, demands and the seller snapshot', async () => {
  const t = (await api('GET', `/transfers/${S.transfer}`)).j.data;
  expect(t.transfer_no).toBe(S.trNo);
  expect(Number(t.transfer_fee_inr)).toBe(5000); expect(Number(t.admin_charges_inr)).toBe(1000); expect(Number(t.cgst_amount)).toBe(540);
  expect(Number(t.transfer_amount_inr)).toBe(50000);
  const oldC = (await api('GET', `/consumers/${S.consumer}`)).j.data, newC = (await api('GET', `/consumers/${S.buyer}`)).j.data;
  expect(oldC.allocated_unit_id).toBeFalsy(); expect(oldC.lead_stage).toBe('transferred');
  expect(newC.allocated_unit_id).toBe(S.unit); expect(newC.lead_stage).toBe('allotted'); expect(newC.mobile).toBe(S.buyerMobile);
  expect(((await api('GET', `/payments/demands?consumerId=${S.buyer}`)).j.data as any[]).length).toBe(3);   // the demands went with the unit
  expect(((await api('GET', `/payments/demands?consumerId=${S.consumer}`)).j.data as any[]).length).toBe(0);
  const moved = (await api('GET', `/payments/receipts?consumerId=${S.buyer}&pageSize=100`)).j.data as any[];
  expect(moved.some(r => r.id === S.rcpt)).toBe(true);            // the old NEFT receipt now belongs to the buyer
  expect(moved.length).toBeGreaterThan(8);
  const owner = (await api('GET', `/transfers/unit-owner/${S.unit}`)).j.data;
  expect(owner.id).toBe(S.buyer);
  // history on the page
  await go('/transfers');
  await expect(page.locator('#tr-history-body')).toContainText(S.trNo);
  await expect(page.locator('#tr-history-body')).toContainText(`Buyer${U}`);
  await clean();
});

const sameDay = (v: any, want: string) => [want, new Date(new Date(want).getTime() - 864e5).toISOString().slice(0, 10)].includes(String(v).slice(0, 10));   // a non-UTC server sends DATE columns a day early

test('Transfer Date Edit: find the transfer by registration number, name and project; wrong dates are refused; a valid change is stored', async () => {
  await go('/transfer-date-edit');
  const fetchBtn = page.locator('#tde-fetch-btn');
  await page.locator('#tde-project').selectOption({ label: S.projectName });
  await fetchBtn.click(); await expect(page.locator('#tde-tbody')).toContainText(S.trNo.length ? `Buyer${U}` : '');
  await page.locator('#tde-regno').fill(S.reg); await fetchBtn.click();
  await expect(page.locator('#tde-tbody tr')).toHaveCount(1);       // the seller's registration number finds the transfer
  await page.locator('#tde-regno').fill(`NOPE${U}`); await fetchBtn.click(); await page.waitForTimeout(400);
  await expect(page.locator('#tde-count')).toContainText(/^0 /);
  await page.locator('#tde-regno').fill(''); await page.locator('#tde-fname').fill(`Buyer${U}`); await fetchBtn.click();
  await expect(page.locator('#tde-tbody tr')).toHaveCount(1);
  const id = S.transfer;
  const td = page.locator(`#tde-td-${id}`), ad = page.locator(`#tde-ad-${id}`), msg = page.locator(`#tde-msg-${id}`), save = page.locator(`#tde-tbody tr`).getByRole('button', { name: 'SAVE' });
  await td.fill(''); await save.click(); await expect(msg).toContainText(/required/i);
  await td.fill(later(4)); await save.click(); await expect(msg).toContainText(/future|Error/i);
  await td.fill(later(-5)); await ad.fill(later(-2)); await save.click(); await expect(msg).toContainText(/Error|after/i);    // application after transfer
  const keep = (await api('GET', `/transfers/${id}`)).j.data;
  expect(sameDay(keep.transfer_date, today)).toBe(true);                                                                       // nothing changed so far
  await td.fill(later(-1)); await ad.fill(later(-3)); await save.click(); await expect(msg).toContainText(/Saved/);
  const now = (await api('GET', `/transfers/${id}`)).j.data;
  expect(sameDay(now.transfer_date, later(-1))).toBe(true); expect(sameDay(now.application_date, later(-3))).toBe(true);
  await page.locator('#tde-fetch-btn').click(); await page.waitForTimeout(400);
  await expect(page.locator(`#tde-td-${id}`)).toHaveValue(new RegExp(`^(${later(-1)}|${later(-2)})$`));   // the reloaded row shows the stored date
  await clean();
});

test('Transfer Report: every filter, CSV, and the unit shows with the new owner', async () => {
  await go('/transfer-report');
  const fetchBtn = page.locator('#trr-fetch-btn');
  await page.locator('#trr-project').selectOption({ label: S.projectName }); await fetchBtn.click();
  await expect(page.locator('#trr-tbody tr')).toHaveCount(1);
  const row = page.locator('#trr-tbody tr').first();
  await expect(row).toContainText(`Buyer${U}`); await expect(row).toContainText(`L1-${U}`);
  expect(await row.innerText()).not.toContain(`Lifecycle${U}`);   // the seller is no longer the owner
  for (const [id, v, n] of [['trr-regno', S.reg, 1], ['trr-regno', `NOPE${U}`, 0], ['trr-fname', `Buyer${U}`, 1], ['trr-fname', 'zzzz', 0], ['trr-unit', `L1-${U}`, 1], ['trr-unit', `L3-${U}`, 0]] as any[]) {
    await page.locator(`#${id}`).fill(v); await fetchBtn.click(); await page.waitForTimeout(400);
    if (n) await expect(page.locator('#trr-tbody tr')).toHaveCount(1); else await expect(page.locator('#trr-tbody')).toContainText(/No records found/);
    await page.locator(`#${id}`).fill('');
  }
  await fetchBtn.click(); await page.waitForTimeout(400);
  await expect(page.locator('#trr-count')).toContainText(/1 /);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /CSV/ }).click()]);
  const csv = require('fs').readFileSync(await dl.path(), 'utf8');
  expect(csv).toContain(`L1-${U}`); expect(csv).not.toMatch(/undefined|NaN/);
  await clean();
});

test('Transfer Detail: filters, the date range, the amounts and the Letter', async () => {
  await go('/transfer-detail');
  const fetchBtn = page.locator('#trd-fetch-btn');
  await page.locator('#trd-project').selectOption({ label: S.projectName }); await fetchBtn.click();
  await expect(page.locator('#trd-tbody tr')).toHaveCount(1);
  const row = page.locator('#trd-tbody tr').first();
  await expect(row).toContainText(S.reg); await expect(row).toContainText(`Buyer${U}`); await expect(row).toContainText(`L1-${U}`);
  await expect(row).toContainText('50,000'); await expect(row).toContainText('540');
  // search by registration number, name and unit, one at a time
  for (const [id, v] of [['trd-regno', S.reg], ['trd-fname', `Buyer${U}`], ['trd-unit', `L1-${U}`]]) {
    await page.locator(`#${id}`).fill(v); await fetchBtn.click(); await page.waitForTimeout(500);
    await expect(page.locator('#trd-tbody tr'), `search by ${id}`).toHaveCount(1); await expect(page.locator('#trd-tbody')).not.toContainText('No records');
    await page.locator(`#${id}`).fill('');
  }
  await page.locator('#trd-regno').fill(`NOPE${U}`); await fetchBtn.click(); await expect(page.locator('#trd-tbody')).toContainText(/No records found/); await page.locator('#trd-regno').fill('');
  // the date range: a range that does not hold the transfer must show nothing, one that holds it must show it
  await page.locator('#trd-from').fill(later(-30)); await page.locator('#trd-to').fill(later(-20)); await fetchBtn.click(); await page.waitForTimeout(500);
  await expect(page.locator('#trd-tbody'), 'transfers outside the date range are hidden').toContainText(/No records found/);
  await page.locator('#trd-from').fill(later(-10)); await page.locator('#trd-to').fill(later(1)); await fetchBtn.click(); await page.waitForTimeout(500);
  await expect(page.locator('#trd-tbody tr')).toHaveCount(1); await expect(page.locator('#trd-tbody')).toContainText(`Buyer${U}`);
  await page.locator('#trd-from').fill(''); await page.locator('#trd-to').fill('');
  // the letter
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('#trd-tbody').getByText('Letter').click()]);
  await popup.waitForLoadState();
  const text = await popup.locator('body').innerText();
  expect(text).toContain(`L1-${U}`); expect(text).toContain(`Buyer${U}`); expect(text).toContain(`Lifecycle${U}`);   // transferee and transferor
  expect(text).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]/);
  const t = (await api('GET', `/transfers/${S.transfer}`)).j.data;
  expect(Number(t.seller_total_paid_inr ?? t.seller_total_received ?? 0)).toBeGreaterThan(0);   // the seller paid something before the transfer
  expect(text, 'the letter shows what the seller had paid').toContain(inr(Number(t.seller_total_paid_inr ?? t.seller_total_received)));
  await popup.close();
  const bad = await api('GET', '/transfers/00000000-0000-0000-0000-000000000000/letter'); expect(bad.s).toBe(404);
  expect((await api('GET', '/transfers/junk/letter')).s).toBe(400);
});

test('Transfers: wrong order, the seller cannot be transferred again, the buyer cannot be given a second unit, a transfer number cannot repeat', async () => {
  const seller = S.consumer;
  const again = await api('POST', '/transfers', { unitId: S.unit, oldConsumerId: seller, newConsumerId: S.buyer });
  expect(again.s).toBe(400);
  const second = await api('POST', '/transfers', { unitId: S.units[1], oldConsumerId: S.buyer, newConsumerId: seller });
  expect(second.s).toBe(400);                                                       // the buyer does not own that unit
  const self = await api('POST', '/transfers', { unitId: S.unit, oldConsumerId: S.buyer, newConsumerId: S.buyer });
  expect(self.s).toBe(400);
  for (const body of [{}, { unitId: 'x', oldConsumerId: 'y', newConsumerId: 'z' }, { unitId: S.unit, oldConsumerId: S.buyer }]) expect((await api('POST', '/transfers', body)).s).toBe(400);
  expect((await transfersOf()).length).toBe(1);
  // the seller no longer shows on the transfer search, the buyer does
  await go('/transfers');
  await page.locator('#tr-f-project').selectOption({ label: S.projectName }); await page.locator('#tr-f-regno').fill(S.reg);   // registration numbers repeat across projects
  await page.getByRole('button', { name: 'FETCH', exact: true }).first().click();
  await expect(page.locator('#tr-search-results')).not.toContainText(`Lifecycle${U}`);
  await page.locator('#tr-f-regno').fill('');
  // unit-owner of a unit nobody holds, and of a junk id
  expect((await api('GET', `/transfers/unit-owner/${S.units[3]}`)).s).toBe(404);
  expect((await api('GET', '/transfers/unit-owner/junk')).s).toBe(400);
  expect((await api('PATCH', `/transfers/${S.transfer}`, {})).s).toBe(400);
  expect((await api('PATCH', `/transfers/${S.transfer}`, { transfer_date: 'junk' })).s).toBe(400);
});

// ---------- Surrender: surrender the new owner, the detailed report, restore ----------
const surRow = () => content().locator('tr', { hasText: `L1-${U}` });
const surState = async (c: string) => (await api('GET', `/consumers/${c}`)).j.data;
const surList = async (type = 'surrender') => (await api('GET', `/surrender/list?projectId=${S.project}&type=${type}`)).j.data as any[];

test('Surrender: the search needs a project and finds the unit holder; wrong values find nothing', async () => {
  S.buyerReg = (await surState(S.buyer)).registration_no;
  await go('/surrender');
  await expect(content()).toContainText(/SURRENDER APPLICANT/i);
  const fetchBtn = content().locator('.sur-btn-fetch').first();
  await fetchBtn.click();
  expect(dialogs.join()).toMatch(/select a project/i);
  await page.locator('#sur-project').selectOption({ label: S.projectName });
  await fetchBtn.click();
  await expect(surRow()).toHaveCount(1);
  await expect(surRow()).toContainText(`Buyer${U}`);
  expect(await content().innerText()).not.toContain(`Lifecycle${U}`);        // the seller no longer holds the unit
  for (const [id, v, n] of [['sur-regno', S.buyerReg, 1], ['sur-regno', `NOPE${U}`, 0], ['sur-name', `Buyer${U}`, 1], ['sur-name', 'zzzz', 0], ['sur-unit', `L1-${U}`, 1], ['sur-unit', `L4-${U}`, 0], ['sur-unit', "x' or '1'='1", 0]] as any[]) {
    await page.locator(`#${id}`).fill(v); await fetchBtn.click(); await page.waitForTimeout(500);
    expect(await surRow().count(), `${id}=${v}`).toBe(n);
    await page.locator(`#${id}`).fill('');
  }
  await fetchBtn.click(); await page.waitForTimeout(500);
  await clean();
});

test('Surrender: the form shows the applicant, the checks refuse a wrong date and wrong amounts, a click surrenders once', async () => {
  await surRow().getByText('Surrender', { exact: true }).click();
  await expect(content()).toContainText(`L1-${U}`);
  await expect(page.locator('#sur-date')).toBeVisible();
  await clean();
  const msg = page.locator('#sur-form-msg'), go1 = page.getByRole('button', { name: 'SURRENDER', exact: true });
  await page.locator('#sur-date').fill('');
  dialogs = []; await go1.click(); expect(dialogs.join()).toMatch(/select a surrender date/i);
  await page.locator('#sur-date').fill(later(5)); await go1.click(); await expect(msg).toContainText(/Error.*future/i);
  await page.locator('#sur-date').fill(today);
  await page.locator('#sur-penalty').fill('-100'); await go1.click(); await expect(msg).toContainText(/Error/i);
  await page.locator('#sur-penalty').fill('abc').catch(() => {});
  await page.locator('#sur-penalty').fill('2000000000'); await go1.click(); await expect(msg).toContainText(/Error/i);
  expect((await surList()).length).toBe(0);                                                  // none of the refused clicks changed anything
  expect((await surState(S.buyer)).allocated_unit_id).toBe(S.unit);
  await page.locator('#sur-penalty').fill('1000');
  await page.locator('#sur-total-amt').scrollIntoViewIfNeeded();
  await expect(page.locator('#sur-total-amt')).not.toHaveValue(/NaN/);
  await page.locator('.sur-mode-btn[data-mode=cheque]').click();
  await page.locator('#sur-remark').fill('lifecycle surrender');
  await go1.dblclick();
  await expect(msg).toContainText(/Surrender processed successfully/i);
  const list = await surList(); expect(list.length, 'exactly one surrender record, the double click did not make two').toBe(1);
  S.surrender = list[0].id;
  expect(Number(list[0].forfeiture_amount_inr)).toBe(1000);
  expect(list[0].refund_mode).toBe('cheque'); expect(list[0].remark).toBe('lifecycle surrender');
  const c = await surState(S.buyer);
  expect(c.lead_stage).toBe('cancelled'); expect(c.allocated_unit_id).toBeFalsy();
  const demands = (await api('GET', `/payments/demands?consumerId=${S.buyer}`)).j.data as any[];
  S.demandStates = demands.map(d => `${d.installment_index}:${d.status}`).sort();
  expect(demands.every(d => d.status === 'cancelled' || ['paid', 'fully_paid'].includes(d.status))).toBe(true);
  const units = (await api('GET', `/units/${S.unit}`)).j.data;
  expect(units.status).toBe('temp_surrender');
  expect((await api('GET', `/booking/${S.booking}`)).j.data.status).toBe('cancelled');
  await page.waitForTimeout(2300);   // the screen goes back to the search by itself
  await clean();
});

test('Surrender: after surrendering, the holder is gone from the search and cannot be surrendered again', async () => {
  await go('/surrender');
  await page.locator('#sur-project').selectOption({ label: S.projectName });
  await page.locator('.sur-btn-fetch').first().click(); await page.waitForTimeout(500);
  expect(await surRow().count()).toBe(0);
  const alloc = (await api('GET', `/allocations?consumerId=${S.buyer}&status=all`)).j.data.find((a: any) => a.unit_id === S.unit);
  const again = await api('POST', '/surrender', { consumerId: S.buyer, allocationId: alloc.id, type: 'surrender' });
  expect(again.s).toBeGreaterThanOrEqual(400); expect(again.s).toBeLessThan(500);
  const bad = await api('POST', '/surrender', { consumerId: 'x', allocationId: 'y' }); expect(bad.s).toBe(400);
  expect((await api('POST', '/surrender', { consumerId: S.buyer, allocationId: alloc.id, type: 'junk' })).s).toBe(400);
  expect((await surList()).length).toBe(1);
  await clean();
});

test('Surrender Detailed Report: every filter, and the surrender is listed with its amounts', async () => {
  await go('/surrender');
  await content().getByRole('button', { name: 'Detailed Report' }).click();
  await expect(page.locator('#rep-project')).toBeVisible();
  const fetchBtn = () => content().locator('.sur-btn-fetch').first();
  await page.locator('#rep-project').selectOption({ label: S.projectName }); await fetchBtn().click();
  const row = () => content().locator('tr', { hasText: `L1-${U}` });
  await expect(row()).toHaveCount(1);
  await expect(row()).toContainText('Surrender'); await expect(row()).toContainText(`Buyer${U}`);
  await clean();
  for (const t of ['cancellation', 'surrender']) {
    await page.locator('#rep-type').selectOption(t); await fetchBtn().click();
    await expect(row()).toHaveCount(t === 'surrender' ? 1 : 0);
    await page.locator('#rep-project').selectOption({ label: S.projectName });
  }
  await page.locator('#rep-type').selectOption('');
  await page.locator('#rep-from').fill(later(-30)); await page.locator('#rep-to').fill(later(-20)); await fetchBtn().click();
  await expect(row()).toHaveCount(0);
  await page.locator('#rep-from').fill(later(-1)); await page.locator('#rep-to').fill(later(1)); await fetchBtn().click();
  await expect(row(), 'a range around today holds the surrender made today').toHaveCount(1);
  await page.locator('#rep-from').fill(later(3)); await page.locator('#rep-to').fill(later(1)); await fetchBtn().click();
  await expect(row()).toHaveCount(0); await clean();
});

test('Surrender restore: filters, Restore puts the unit holder back, a second restore is refused', async () => {
  await go('/surrender-restore');
  await expect(page.locator('#res-project')).toBeVisible();
  const fetchBtn = () => content().locator('.sur-btn-fetch').first();
  const row = () => content().locator('tr', { hasText: `L1-${U}` });
  await page.locator('#res-project').selectOption({ label: S.projectName }); await fetchBtn().click();
  await expect(row()).toHaveCount(1);
  for (const [id, v, n] of [['res-regno', `NOPE${U}`, 0], ['res-name', 'zzzz', 0], ['res-regno', S.buyerReg, 1], ['res-name', `Buyer${U}`, 1]] as any[]) {
    await page.locator(`#${id}`).fill(v); await fetchBtn().click(); await page.waitForTimeout(400);
    await page.locator('#res-project').selectOption({ label: S.projectName }).catch(() => {});
    expect(await row().count(), `${id}=${v}`).toBe(n);
    await page.locator(`#${id}`).fill('');
  }
  await page.locator('#res-project').selectOption({ label: S.projectName }); await fetchBtn().click();
  await expect(row()).toHaveCount(1);
  await row().getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('#sur-restore-msg')).toContainText(/restored successfully/i);
  const c = await surState(S.buyer);
  expect(c.allocated_unit_id).toBe(S.unit); expect(c.lead_stage).toBe('allotted');
  expect((await api('GET', `/units/${S.unit}`)).j.data.status).toBe('allotted');
  expect((await api('GET', `/booking/${S.booking}`)).j.data.status).toBe('complete');
  const demands = (await api('GET', `/payments/demands?consumerId=${S.buyer}`)).j.data as any[];
  expect(demands.map(d => `${d.installment_index}:${d.status}`).sort(), 'every demand is back as it was before the surrender').not.toEqual(S.demandStates);
  expect(demands.every(d => d.status !== 'cancelled')).toBe(true);
  await expect(row()).toContainText(/Restored/i); await expect(row().getByRole('button', { name: 'Restore' })).toHaveCount(0);
  const again = await api('POST', '/surrender/restore', { surrenderId: S.surrender, type: 'surrender' });
  expect(again.s).toBe(409);
  expect((await api('POST', '/surrender/restore', { surrenderId: 'junk' })).s).toBe(400);
  expect((await api('POST', '/surrender/restore', {})).s).toBe(400);
  await clean();
});

// ---------- Allotment: form, letter, search, shifting, cancel, waitlist, address, e-draw ----------
const psql = (sql: string) => require('child_process').execFileSync('/Library/PostgreSQL/18/bin/psql', ['-h', '/tmp/rofpg', '-p', '5433', '-U', 'postgres', '-d', process.env.LC_DB || 'rof_lc', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
const applicant = async (label: string, unitIdx: number | null) => {
  const mobile = mob(), name = `Alt${label}${U} Person`;
  const c = await must('consumer', api('POST', '/consumers', { name, first_name: `Alt${label}${U}`, last_name: 'Person', mobile, project_id: S.project }));
  let booking: string | null = null;
  if (unitIdx !== null) {
    const b = await must('booking', api('POST', '/booking', { consumer_id: c.id, project_id: S.project, unit_id: S.units[unitIdx], selected_plan_name: S.plan, booking_date: today }));
    await must('finish', api('PATCH', `/booking/${b.id}`, { booking_amount: 10000, payment_mode: 'cash' }));
    booking = b.id;
  }
  return { id: c.id as string, mobile, name, booking };
};
const unitOf = async (id: string) => (await api('GET', `/units/${id}`)).j.data;
const allocOf = async (consumer: string) => ((await api('GET', `/allocations?consumerId=${consumer}&status=all`)).j.data as any[]);
const allotTab = async (t: string) => { await content().locator(`button[data-group=allot][data-tab=${t}]`).click(); await page.waitForTimeout(700); await clean(); };
const alt: Record<string, any> = {};
const ALT_A = new RegExp(`Alt${'A'}${U}`, 'i');   // the server writes names with a capital first letter only
const nameRe = (n: string) => new RegExp(n.replace(/[^A-Za-z0-9 ]/g, ''), 'i');

test('Allotment form: the booked applicant is offered with the unit filled in; empty and wrong input is refused; one click allots', async () => {
  alt.A = await applicant('A', 1);
  await go('/allotment');
  await expect(content()).toContainText('Allot Unit to Consumer');
  const btn = page.getByRole('button', { name: 'CREATE ALLOTMENT/AGREEMENT' });
  await btn.click(); await expect(toast(/select a consumer/i)).toBeVisible();
  await expect(page.locator(`#allot-consumer-sel option[value="${alt.A.id}"]`), 'the applicant with a booking is in the list').toHaveCount(1);
  await page.locator('#allot-consumer-sel').selectOption(alt.A.id);
  await expect(page.locator('#allot-project-sel')).toHaveValue(S.project);
  await expect(page.locator('#allot-unit-sel')).toHaveValue(S.units[1]);
  await page.locator('#allot-date').fill(later(6)); await btn.click();
  await expect(toast(/future/i)).toBeVisible();
  expect((await allocOf(alt.A.id)).filter(a => a.status === 'allotted').length).toBe(0);
  await page.locator('#allot-date').fill(today);
  await page.locator('#allot-remarks').fill('lifecycle allotment');
  await btn.dblclick();
  await expect(toast(/allotted successfully/i).first()).toBeVisible();
  await page.waitForTimeout(600);
  const al = (await allocOf(alt.A.id)).filter(a => a.status === 'allotted'); expect(al.length, 'one allotment, not two').toBe(1);
  alt.A.alloc = al[0].id;
  expect((await unitOf(S.units[1])).status).toBe('allotted');
  const c = (await api('GET', `/consumers/${alt.A.id}`)).j.data; expect(c.lead_stage).toBe('allotted'); expect(c.allocated_unit_id).toBe(S.units[1]);
  await expect(page.locator('#allot-list-body')).toContainText(ALT_A);
  await clean();
});

test('Allotment form: an applicant who already holds a unit, and a unit already allotted, are refused', async () => {
  const again = await api('POST', '/allocations', { consumerId: alt.A.id, unitId: S.units[1], projectId: S.project });
  expect(again.s).toBe(400);
  const other = await applicant('X', null);
  expect((await api('POST', '/allocations', { consumerId: other.id, unitId: S.units[1], projectId: S.project })).s).toBeGreaterThanOrEqual(400);
  expect((await api('POST', '/allocations', { consumerId: alt.A.id, unitId: S.units[2], projectId: S.project })).s).toBe(409);   // holds another unit
  for (const b of [{}, { consumerId: 'x', unitId: 'y', projectId: 'z' }, { consumerId: other.id, unitId: S.units[2] }]) expect((await api('POST', '/allocations', b)).s).toBe(400);
  expect((await unitOf(S.units[2])).status).toBe('available');
  alt.X = other;
});

test('Allotment Letter: the search by project, unit and registration number, the letter opens, bulk generation runs once', async () => {
  await go('/allotment'); await allotTab('letter');
  await page.locator('#letter-proj-sel').selectOption({ label: S.projectName });
  const fetchBtn = content().locator('[data-panel=letter] .btn-fetch');
  const reg = (await api('GET', `/consumers/${alt.A.id}`)).j.data.registration_no;
  await fetchBtn.click();
  await expect(content().locator('#letter-search-body')).toContainText(ALT_A);
  await page.locator('#letter-unit-search').fill(`L2-${U}`); await fetchBtn.click(); await page.waitForTimeout(500);
  await expect(content().locator('#letter-search-body')).toContainText(ALT_A);
  await page.locator('#letter-unit-search').fill(`L4-${U}`); await fetchBtn.click(); await page.waitForTimeout(500);
  await expect(content().locator('#letter-search-body')).not.toContainText(ALT_A);
  await page.locator('#letter-unit-search').fill(''); await page.locator('#letter-reg-search').fill(reg || `NOPE${U}`); await fetchBtn.click(); await page.waitForTimeout(500);
  await clean();
  await page.locator('#letter-reg-search').fill('');
  await page.locator('#letter-proj-sel').selectOption({ label: S.projectName }); await fetchBtn.click(); await page.waitForTimeout(500);
  // bulk generation: the first click makes letters, the second makes none
  await allotTab('allot');                                  // the button is on the Allotment Form tab
  const before = Number(psql(`select count(*) from allotment_letters`));
  await page.getByRole('button', { name: 'Bulk Generate Letters' }).click();
  await expect(toast(/allotment letter\(s\) generated/i).first()).toBeVisible();
  const mid = Number(psql(`select count(*) from allotment_letters`)); expect(mid).toBeGreaterThan(before);
  expect(Number(psql(`select count(*) from allocations where status='allotted' and allotment_letter_id is null`))).toBe(0);
  await page.getByRole('button', { name: 'Bulk Generate Letters' }).click(); await page.waitForTimeout(800);
  expect(Number(psql(`select count(*) from allotment_letters`))).toBe(mid);
});

test('Search Allotment: every filter, wrong values, the date range', async () => {
  await go('/allotment'); await allotTab('search');
  const body = content().locator('#allot-search-body');
  const fetchBtn = content().locator('[data-panel=search] .btn-fetch');
  await fetchBtn.click(); await page.waitForTimeout(600);
  const set = async (id: string, v: string) => { await page.locator(`#${id}`).fill(v); await fetchBtn.click(); await page.waitForTimeout(500); };
  await set('searchUnitAddress', `L2-${U}`); await expect(body).toContainText(ALT_A);
  await set('searchUnitAddress', `L4-${U}`); await expect(body).toContainText(/No allotments found/); await set('searchUnitAddress', "x' or '1'='1"); await expect(body).toContainText(/No allotments found/);
  await set('searchUnitAddress', ''); await set('searchFirstName', `Alt${'A'}${U}`); await expect(body).toContainText(ALT_A);
  await set('searchFirstName', 'zzzz'); await expect(body).toContainText(/No allotments found/); await set('searchFirstName', '');
  const reg = (await api('GET', `/consumers/${alt.A.id}`)).j.data.registration_no;
  if (reg) { await set('searchRegNo', reg); await expect(body).toContainText(ALT_A); }
  await set('searchRegNo', `NOPE${U}`); await expect(body).toContainText(/No allotments found/); await set('searchRegNo', '');
  await set('searchUnitAddress', `-${U}`);   // only this run's units, other projects have allotments in these dates
  await set('searchDateFrom', later(-30)); await set('searchDateTo', later(-20)); await expect(body).toContainText(/No allotments found/);
  await set('searchDateFrom', later(-1)); await set('searchDateTo', later(1)); await expect(body).toContainText(ALT_A);
  await set('searchDateFrom', later(3)); await set('searchDateTo', later(1));
  await clean();
  await set('searchDateFrom', ''); await set('searchDateTo', ''); await set('searchUnitAddress', '');
  await page.locator('#search-project').selectOption({ label: S.projectName }).catch(() => {});
  await fetchBtn.click(); await page.waitForTimeout(600); await clean();
});

test('Allotment Letter: Search Allotment opens the letter of one allotment', async () => {
  // the letter is made from the project's template (Set Master > Documents); this project has none yet, so one is added
  const noTemplate = await api('POST', '/documents/generate', { consumerId: alt.A.id, allocationId: alt.A.alloc, documentType: 'allotment_letter' });
  expect(noTemplate.s, 'without a template the letter is refused with a message, not a crash').toBe(404);
  await must('template', api('POST', '/documents/templates', { projectId: S.project, documentType: 'allotment_letter', name: `LC letter ${U}`,
    bodyHtml: '<html><body><h1>Allotment Letter</h1><p>Dear {{consumerName}}, unit {{unitNumber}} in {{projectName}} is allotted to you. This letter is made for the lifecycle test.</p></body></html>' }));
  await go('/allotment'); await allotTab('search');
  await page.locator('#searchUnitAddress').fill(`L2-${U}`); await content().locator('[data-panel=search] .btn-fetch').click();
  await expect(content().locator('#allot-search-body')).toContainText(ALT_A);
  const [popup] = await Promise.all([page.waitForEvent('popup'), content().locator('#allot-search-body a.aln-link', { hasText: 'Allotment Letter' }).first().click()]);
  await popup.waitForLoadState();
  await expect.poll(async () => (await popup.locator('body').innerText()).length, { timeout: 15000 }).toBeGreaterThan(100);
  const text = await popup.locator('body').innerText();
  expect(text).toContain('Allotment Letter'); expect(text).toContain(`L2-${U}`); expect(text).toMatch(ALT_A); expect(text).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]|\{\{/);
  await popup.close();
});

test('Unit Shifting: the new unit list offers units that can be taken, one click shifts, the report and history show it', async () => {
  await go('/allotment'); await allotTab('shifting');
  const btn = page.getByRole('button', { name: 'Confirm Shift' });
  await btn.click(); await expect(toast(/select a consumer/i)).toBeVisible();
  await expect(page.locator(`#shift-consumer option[value="${alt.A.id}"]`)).toHaveCount(1);
  await page.locator('#shift-consumer').selectOption(alt.A.id);
  await expect(page.locator('#shift-current-unit')).not.toHaveValue('');
  await btn.click(); await expect(toast(/select the new unit/i)).toBeVisible();
  const offered = await page.locator('#shift-new-unit option').evaluateAll(o => o.map((x: any) => x.value).filter(Boolean));
  expect(offered, 'an available unit of the same project can be picked').toContain(S.units[2]);
  expect(offered, 'the unit the applicant already holds is not offered').not.toContain(S.units[1]);
  await page.locator('#shift-new-unit').selectOption(S.units[2]);
  await page.locator('#shift-reason').fill('lifecycle shift');
  await btn.dblclick();
  await expect(page.locator('#shift-result')).toContainText(/shifted successfully/i);
  expect((await unitOf(S.units[2])).status).toBe('allotted'); expect((await unitOf(S.units[1])).status).toBe('available');
  expect((await api('GET', `/consumers/${alt.A.id}`)).j.data.allocated_unit_id).toBe(S.units[2]);
  const shifts = (await api('GET', `/allocations/shifts?projectId=${S.project}`)).j.data as any[];
  expect(shifts.filter(s => s.consumer_id === alt.A.id).length, 'one shift recorded').toBe(1);
  await page.locator('#shift-result').scrollIntoViewIfNeeded();
  await allotTab('shifting');
  await expect(content().locator('#shifting-list-body')).toContainText(ALT_A);
  await clean();
});

test('Customer Unit Shifting Report (reached from the menu): filters and the shift is listed', async () => {
  await page.evaluate(() => { (0, eval)('Router').navigate('/allotment', { tab: 'shifting-report' }); });
  await expect(page.locator('#sr-from')).toBeVisible();      // the report panel is shown, not the allotment form
  const fetchBtn = content().locator('[data-panel=shifting-report] .btn-fetch');
  await page.locator('#sr-project').selectOption({ label: S.projectName }); await page.locator('#sr-from').fill(later(-1)); await page.locator('#sr-to').fill(later(1)); await fetchBtn.click();
  await expect(content().locator('#shifting-report-body')).toContainText(ALT_A);
  await expect(content().locator('#shifting-report-body')).toContainText('lifecycle shift');
  await page.locator('#sr-from').fill(later(-30)); await page.locator('#sr-to').fill(later(-20)); await fetchBtn.click(); await page.waitForTimeout(500);
  await expect(content().locator('#shifting-report-body')).toContainText(/No shifting records/);
  await page.locator('#sr-from').fill(later(3)); await page.locator('#sr-to').fill(later(1)); await fetchBtn.click(); await page.waitForTimeout(500); await clean();
});

test('Unit Shifting: wrong orders are refused (a taken unit, the unit already held, an applicant without a unit)', async () => {
  const B = await applicant('B', 3);                                       // booked on unit 4, not allotted
  const taken = await api('POST', '/allocations/shift', { consumerId: alt.A.id, newUnitId: S.units[3] }); expect(taken.s).toBe(400);   // booked by someone else
  expect((await api('POST', '/allocations/shift', { consumerId: alt.A.id, newUnitId: S.units[2] })).s).toBe(400);                    // already holds it
  expect((await api('POST', '/allocations/shift', { consumerId: alt.X.id, newUnitId: S.units[1] })).s).toBe(400);                    // holds no unit
  for (const b of [{}, { consumerId: 'x', newUnitId: 'y' }, { consumerId: alt.A.id }]) expect((await api('POST', '/allocations/shift', b)).s).toBe(400);
  expect((await api('POST', '/allocations/shift', { consumerId: alt.A.id, newUnitId: S.units[1], shiftDate: later(5) })).s).toBe(400);
  expect((await unitOf(S.units[3])).status).toBe('booked');
  alt.B = B;
});

test('Edit Customer Address (reached from the menu): the applicant is listed, a change is stored', async () => {
  await page.evaluate(() => { (0, eval)('Router').navigate('/allotment', { tab: 'edit-address' }); });
  await expect(page.locator('#addr-consumer')).toBeVisible();
  await expect(page.locator(`#addr-consumer option[value="${alt.A.id}"]`)).toHaveCount(1);
  await page.locator('#addr-consumer').selectOption(alt.A.id);
  await expect(page.locator('#addr-form')).toBeVisible();
  await page.locator('#addr-present-line1').fill('77 Lifecycle Marg'); await page.locator('#addr-present-city').fill('Rohtak'); await page.locator('#addr-present-state').fill('Haryana'); await page.locator('#addr-present-pin').fill('124001');
  await page.getByRole('button', { name: 'Save Address' }).click();
  await expect(page.locator('#addr-result')).toContainText(/updated successfully/i);
  const c = (await api('GET', `/consumers/${alt.A.id}`)).j.data;
  expect(c.present_address).toContain('77 Lifecycle Marg'); expect(c.present_city).toBe('Rohtak'); expect(c.present_pin).toBe('124001');
  // a wrong PIN is refused and nothing changes
  await page.locator('#addr-present-pin').fill('12'); await page.getByRole('button', { name: 'Save Address' }).click();
  await expect(page.locator('#addr-result')).toContainText(/Error/i);
  expect((await api('GET', `/consumers/${alt.A.id}`)).j.data.present_pin).toBe('124001');
  await page.getByRole('button', { name: 'Clear' }).last().click();
  await clean();
});

test('Cancel Allotment: needs a pick, cancels, keeps the 29,500 forfeiture, frees the unit, and is listed in the surrender report', async () => {
  await go('/allotment'); await allotTab('cancel');
  const btn = page.getByRole('button', { name: 'Confirm Cancellation' });
  await btn.click(); await expect(toast(/select an allotment/i)).toBeVisible();
  await expect(page.locator(`#cancel-allot-sel option[value="${alt.A.alloc}"]`)).toHaveCount(1);
  const opts = await page.locator('#cancel-reason option').evaluateAll(o => o.map((x: any) => x.value));
  expect(opts.length).toBeGreaterThan(0);
  await page.locator('#cancel-allot-sel').selectOption(alt.A.alloc);
  await btn.dblclick();
  await expect(toast(/Allotment cancelled/i).first()).toBeVisible();
  await page.waitForTimeout(600);
  const cn = (await surList('cancellation')).filter(x => x.consumer_id === alt.A.id); expect(cn.length, 'one cancellation, the double click did not make two').toBe(1);
  alt.cancel = cn[0];
  expect((await unitOf(S.units[2])).status).toBe('available');
  const c = (await api('GET', `/consumers/${alt.A.id}`)).j.data; expect(c.lead_stage).toBe('cancelled'); expect(c.allocated_unit_id).toBeFalsy();
  expect((await allocOf(alt.A.id)).every(a => a.status === 'cancelled')).toBe(true);
  expect(Number(cn[0].forfeiture_amount_inr)).toBeLessThanOrEqual(29500);
  expect(Number(cn[0].forfeiture_amount_inr) + Number(cn[0].refund_amount_inr), 'forfeit plus refund is what was cleared').toBeGreaterThanOrEqual(0);
  await expect(page.locator(`#cancel-allot-sel option[value="${alt.A.alloc}"]`)).toHaveCount(0);
  // it shows in the surrender report as a cancellation
  await go('/surrender'); await content().getByRole('button', { name: 'Detailed Report' }).click();
  await page.locator('#rep-project').selectOption({ label: S.projectName }); await page.locator('#rep-type').selectOption('cancellation'); await content().locator('.sur-btn-fetch').first().click();
  await expect(content().locator('tr', { hasText: ALT_A })).toHaveCount(1);
  await clean();
  // wrong order: cancelling it again
  expect((await api('POST', `/allocations/${alt.A.alloc}/cancel`, {})).s).toBeGreaterThanOrEqual(400);
  expect((await api('POST', `/allocations/junk/cancel`, {})).s).toBe(400);
  expect((await api('POST', `/allocations/00000000-0000-0000-0000-000000000000/cancel`, {})).s).toBe(404);
  expect((await surList('cancellation')).filter(x => x.consumer_id === alt.A.id).length).toBe(1);
});

test('Surrender restore (Cancellation): the cancelled allotment is restored from the screen, once', async () => {
  await go('/surrender-restore');
  await content().getByRole('button', { name: 'Cancellation', exact: true }).click();
  await page.locator('#res-project').selectOption({ label: S.projectName });
  await content().locator('.sur-btn-fetch').first().click();
  const row = content().locator('tr', { hasText: ALT_A });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('#sur-restore-msg')).toContainText(/restored successfully/i);
  const c = (await api('GET', `/consumers/${alt.A.id}`)).j.data; expect(c.allocated_unit_id).toBe(S.units[2]); expect(c.lead_stage).toBe('allotted');
  expect((await unitOf(S.units[2])).status).toBe('allotted');
  await expect(row).toContainText(/restored/i); await expect(row.getByRole('button', { name: 'Restore' })).toHaveCount(0);
  expect((await api('POST', '/surrender/restore', { surrenderId: alt.cancel.id, type: 'cancellation' })).s).toBe(409);
  await clean();
});

test('Waitlist: the queue shows in order, a cancellation gives the unit to the first waiting applicant, the restore of the cancelled one is then refused', async () => {
  const W1 = await applicant('W1', null), W2 = await applicant('W2', null);
  psql(`insert into waitlists (consumer_id, project_id, position_ordered) values ('${W1.id}','${S.project}',1), ('${W2.id}','${S.project}',2)`);
  await go('/allotment'); await allotTab('waitlist');
  const body = content().locator('#waitlist-body');
  await page.getByRole('button', { name: 'Refresh' }).click(); await page.waitForTimeout(500);
  await expect(body.locator('tr', { hasText: nameRe(W1.name) })).toContainText(/#1/); await expect(body.locator('tr', { hasText: nameRe(W2.name) })).toContainText(/#2/);
  await expect(body.locator('tr', { hasText: nameRe(W1.name) })).toContainText(/waiting/i);
  await allotTab('cancel');
  await page.locator('#cancel-allot-sel').selectOption(alt.A.alloc.length ? (await allocOf(alt.A.id)).find(a => a.status === 'allotted').id : '');
  await page.getByRole('button', { name: 'Confirm Cancellation' }).click();
  await expect(toast(/Allotment cancelled/i).first()).toBeVisible();
  await page.waitForTimeout(600);
  const w1 = (await api('GET', `/consumers/${W1.id}`)).j.data; expect(w1.allocated_unit_id, 'the first in the queue got the unit').toBe(S.units[2]); expect(w1.lead_stage).toBe('allotted');
  expect((await api('GET', `/consumers/${W2.id}`)).j.data.allocated_unit_id).toBeFalsy();
  expect((await unitOf(S.units[2])).status).toBe('allotted');
  await allotTab('waitlist');
  await expect(body.locator('tr', { hasText: nameRe(W1.name) })).toContainText(/promoted/i);
  await expect(body.locator('tr', { hasText: nameRe(W2.name) })).toContainText(/waiting/i);
  // the cancelled applicant cannot be restored: the unit is taken again
  const cn = (await surList('cancellation')).filter(x => x.consumer_id === alt.A.id).find(x => x.refund_status === 'initiated');
  expect(cn).toBeTruthy();
  await go('/surrender-restore'); await content().getByRole('button', { name: 'Cancellation', exact: true }).click();
  await page.locator('#res-project').selectOption({ label: S.projectName }); await content().locator('.sur-btn-fetch').first().click();
  await content().locator('tr', { hasText: ALT_A }).getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('#sur-restore-msg')).toContainText(/Error.*(taken|cannot be restored|unit)/i);
  expect((await api('GET', `/consumers/${alt.A.id}`)).j.data.allocated_unit_id).toBeFalsy();
  alt.W1 = W1; alt.W2 = W2;
});

test('E-Draw Import: a file with results is read, refunds are made once, wrong files are refused', async () => {
  // W2 paid and is on the waitlist; the draw says unsuccessful
  const rc = await api('POST', '/payments/receipts', { consumerId: alt.W2.id, amountReceivedInr: 15000, paymentMode: 'cash', paymentDate: today });
  expect(rc.s, JSON.stringify(rc.j)).toBeLessThan(300);
  const rid = rc.j.receipt?.id || rc.j.data?.id;
  expect((await api('PATCH', `/payments/receipts/${rid}/clear`, { clearing_date: today })).s).toBe(200);
  await go('/allotment'); await allotTab('edraw');
  const importBtn = page.getByRole('button', { name: 'Import E-Draw Results' });
  await importBtn.click(); await expect(toast(/select a CSV file/i)).toBeVisible();
  await page.locator('#edraw-project').selectOption({ label: S.projectName });
  await page.locator('#edraw-file').setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('foo,bar\n1,2\n') });
  await importBtn.click(); await expect(page.locator('#edraw-result')).toContainText(/Error/i);
  await page.locator('#edraw-file').setInputFiles({ name: 'empty.csv', mimeType: 'text/csv', buffer: Buffer.from('applicantId,result\n') });
  await importBtn.click(); await expect(page.locator('#edraw-result')).toContainText(/Error/i);
  expect(Number(psql(`select count(*) from draw_refunds where project_id='${S.project}'`))).toBe(0);
  const csv = `applicantId,result\n${alt.W2.mobile},unsuccessful\n${alt.W1.mobile},unsuccessful\n9000000000,allotted\n${alt.X.mobile},waitlist\n`;
  await page.locator('#edraw-file').setInputFiles({ name: 'draw.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await importBtn.click();
  await expect(page.locator('#edraw-result')).toContainText(/E-Draw results imported/i);
  const t = await page.locator('#edraw-result').innerText();
  expect(t).toMatch(/1 allotted/); expect(t).toMatch(/1 waitlisted/); expect(t).toMatch(/2 unsuccessful/); expect(t).not.toMatch(/undefined|NaN/);
  expect(Number(psql(`select count(*) from draw_refunds where project_id='${S.project}' and consumer_id='${alt.W2.id}'`)), 'W2 paid, so one refund').toBe(1);
  expect(Number(psql(`select refund_amount_inr from draw_refunds where consumer_id='${alt.W2.id}'`))).toBe(15000);
  expect(Number(psql(`select count(*) from draw_refunds where consumer_id='${alt.W1.id}'`)), 'W1 holds a unit now, so no refund').toBe(0);
  expect((await api('GET', `/consumers/${alt.W1.id}`)).j.data.allocated_unit_id).toBe(S.units[2]);
  // the same file again must not double the refund
  await page.locator('#edraw-file').setInputFiles({ name: 'draw.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await importBtn.click(); await page.waitForTimeout(900);
  expect(Number(psql(`select count(*) from draw_refunds where consumer_id='${alt.W2.id}'`))).toBe(1);
  await clean();
});
