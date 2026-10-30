// Fills a LOCAL demo database through the API, in the Set Master order:
// Security, Employees, Set Up lists, Documents, then one project with towers and units.
// Run:  BASE=http://localhost:3020/api node docs/demo-seed.mjs     (never against live)
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) throw new Error('demo seed runs on a local API only');
const PW = 'Demo#Pass1234';
let tok = '', bad = 0;
const call = async (m, p, b) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const j = await r.json().catch(() => null);
  if (!r.ok) { bad++; console.log(`FAIL ${m} ${p} ${r.status} ${JSON.stringify(j)?.slice(0, 160)}`); }
  return j?.data ?? j;
};
tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@demo.local', password: PW }) })).json()).token;

// ---- 1. Security: a custom role, then logins ----
const pages = Object.values(await call('GET', '/roles/nav-pages')).flat();
const pid = r => pages.find(p => p.route === r)?.id;
await call('POST', '/roles', { name: 'collection_executive', label: 'Collection Executive', description: 'Follows up dues and receipts', baseRole: 'accounts_finance', pageIds: ['/dashboard', '/consumers', '/receipts', '/demands'].map(pid).filter(Boolean) });
const people = [
  ['rajesh.sharma', 'Rajesh Sharma', 'project_manager', 'Vice President Sales'],
  ['neha.verma', 'Neha Verma', 'project_manager', 'Sales Manager'],
  ['amit.kumar', 'Amit Kumar', 'sales_executive', 'Sales Executive'],
  ['pooja.singh', 'Pooja Singh', 'sales_executive', 'Sales Executive'],
  ['vikas.gupta', 'Vikas Gupta', 'accounts_finance', 'Accounts Manager'],
  ['sunita.rao', 'Sunita Rao', 'collection_executive', 'Collection Executive'],
  ['manoj.yadav', 'Manoj Yadav', 'support_agent', 'CRM Executive'],
  ['kiran.mehta', 'Kiran Mehta', 'read_only_viewer', 'Auditor'],
];
const uid = {};
for (const [u, , role] of people) {
  const x = await call('POST', '/users/employee-login', { username: u.replace('.', '_'), email: `${u}@demo.local`, password: PW, confirmPassword: PW, role });
  uid[u] = x?.userId;
}

// ---- 2. Employees: departments, profiles with managers, teams ----
const dep = {};
for (const [n, d, head] of [['Sales', 'Booking and site sales', 'rajesh.sharma'], ['Accounts', 'Receipts, demands and GST', 'vikas.gupta'], ['CRM and Support', 'Customer service and documents', 'manoj.yadav'], ['Collections', 'Dues follow-up', 'sunita.rao']]) {
  dep[n] = (await call('POST', '/employees/departments', { name: n, description: d, head_user_id: uid[head] }))?.id;
}
const prof = [
  ['rajesh.sharma', 'EMP001', 'Vice President Sales', 'Sales', null, '2018-04-02'],
  ['neha.verma', 'EMP002', 'Sales Manager', 'Sales', 'rajesh.sharma', '2020-07-15'],
  ['amit.kumar', 'EMP003', 'Sales Executive', 'Sales', 'neha.verma', '2022-01-10'],
  ['pooja.singh', 'EMP004', 'Sales Executive', 'Sales', 'neha.verma', '2022-09-05'],
  ['vikas.gupta', 'EMP005', 'Accounts Manager', 'Accounts', 'rajesh.sharma', '2019-06-01'],
  ['sunita.rao', 'EMP006', 'Collection Executive', 'Collections', 'vikas.gupta', '2023-02-20'],
  ['manoj.yadav', 'EMP007', 'CRM Executive', 'CRM and Support', 'rajesh.sharma', '2021-11-08'],
  ['kiran.mehta', 'EMP008', 'Internal Auditor', 'Accounts', 'vikas.gupta', '2024-03-18'],
];
const eid = {};
for (const [u, code, des, d, mgr, join] of prof) {
  eid[u] = (await call('POST', '/employees', { user_id: uid[u], employee_code: code, designation: des, department_id: dep[d], manager_id: mgr ? uid[mgr] : null, mobile_office: '98100' + code.replace(/\D/g, '').padStart(5, '0'), joining_date: join }))?.id;
}
const team = (await call('POST', '/employees/teams', { name: 'Gurugram Site Sales', department_id: dep.Sales, team_head_id: uid['neha.verma'] }))?.id;
for (const [u, role] of [['amit.kumar', 'Closer'], ['pooja.singh', 'Walk-in desk']]) await call('POST', `/employees/teams/${team}/members`, { user_id: uid[u], role_in_team: role });

// ---- 3. Set Up lists ----
const India = (await call('POST', '/master/countries', { name: 'India', code: 'IN', abbreviation: 'In', iso_code: 'IN', isd_code: '91', mobile_digits: 10 }))?.id;
const states = {};
for (const [n, c] of [['Haryana', 'HR'], ['Delhi', 'DL'], ['Uttar Pradesh', 'UP'], ['Punjab', 'PB']]) states[n] = (await call('POST', '/master/states', { name: n, code: c, country_id: India }))?.id;
for (const [s, cs] of [['Haryana', ['Gurugram', 'Faridabad', 'Panipat', 'Karnal']], ['Delhi', ['New Delhi']], ['Uttar Pradesh', ['Noida', 'Ghaziabad']], ['Punjab', ['Chandigarh', 'Mohali']]]) for (const c of cs) await call('POST', '/master/cities', { name: c, state_id: states[s] });
for (const n of ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'M/s']) await call('POST', '/master/salutations', { name: n });
for (const n of ['Salaried', 'Self Employed', 'Business', 'Doctor', 'Engineer', 'Chartered Accountant', 'Retired']) await call('POST', '/master/professions', { name: n });
for (const n of ['Indian', 'NRI', 'OCI']) await call('POST', '/master/nationalities', { name: n });
for (const [n, d] of [['Walk-in', 'Visited the site office'], ['Broker / Channel Partner', 'Came through a broker'], ['Website', 'Website enquiry form'], ['Facebook / Instagram', 'Social media ads'], ['Newspaper', 'Print advertisement'], ['Referral', 'Existing customer reference']]) await call('POST', '/master/sources-of-enquiry', { name: n, description: d });
for (const [n, i, br] of [['State Bank of India', 'SBIN', 'Sector 14 Gurugram'], ['HDFC Bank', 'HDFC', 'Sector 29 Gurugram'], ['ICICI Bank', 'ICIC', 'MG Road Gurugram'], ['Axis Bank', 'UTIB', 'Sohna Road Gurugram'], ['Punjab National Bank', 'PUNB', 'Civil Lines Gurugram']]) await call('POST', '/master/banks', { name: n, ifsc_prefix: i, branch: br });
const co = (await call('POST', '/companies', { name: 'Grapes Realty Pvt Ltd', code: 'GRP', group_name: 'Grapes Group', address1: 'Plot 14, Sector 44', city: 'Gurugram', state: 'Haryana', pin_code: '122003', phone: '01244000000', email: 'accounts@grapesrealty.example.com', gstin: '06AAACG1234F1Z5', pan_no: 'AAACG1234F', cin: 'U70100HR2015PTC012345', place_of_supply: 'Haryana' }))?.id;

// ---- 4. Documents: checklist and dispatch log ----
for (const [n, at, from] of [['PAN Card', 'On Booking', 'Individual'], ['Aadhaar Card', 'On Booking', 'Individual'], ['Passport size photographs', 'On Booking', 'Individual'], ['Address proof', 'On Booking', 'Individual'], ['Board resolution and company PAN', 'On Booking', 'Firm or Company'], ['Allotment Letter', 'On Allotment', 'Individual'], ['Builder Buyer Agreement', 'On Agreement', 'Individual'], ['Sanction letter', 'Other', 'Individual']]) await call('POST', '/master/document-types', { name: n, required_at: at, document_from: from });

// ---- 5. One project with towers and units ----
const proj = (await call('POST', '/projects', { companyId: co, name: 'Grapes Greens', reraNumber: 'RC/REP/HARERA/GGM/2024/101', tcpLicence: '123 of 2023', location: 'Sector 79, Gurugram', totalUnits: 24, possessionDate: '2028-12-31' }))?.id;
const towers = {};
for (const t of ['Tower A', 'Tower B']) towers[t] = (await call('POST', `/projects/${proj}/towers`, { towerName: t }))?.id;
let n = 0;
for (const [t, tid] of Object.entries(towers)) for (let f = 1; f <= 4; f++) for (const [s, bhk, area, price] of [['01', '2BHK', 1050, 9500000], ['02', '3BHK', 1480, 14200000], ['03', '3BHK', 1520, 14900000]]) {
  const x = await call('POST', '/units', { projectId: proj, towerId: tid, unitNumber: `${t.slice(-1)}-${f}${s}`, floor: f, bhkType: bhk, carpetAreaSqft: area - 200, superAreaSqft: area, basePriceInr: price, totalPriceInr: price + f * 50000, facing: f % 2 ? 'East' : 'North' });
  if (x) n++;
}

// ---- 6. Applicants (for letters and dispatch) and letters ----
const cons = [];
for (const [nm, m] of [['Anil Malhotra', '9810011111'], ['Priya Kapoor', '9810022222'], ['Sandeep Chauhan', '9810033333']]) cons.push((await call('POST', '/consumers', { name: nm, mobile: m }))?.id);
await call('POST', '/master/document-dispatch', { document_type: 'Allotment Letter', dispatch_mode: 'Courier', tracking_no: 'DTDC10045', consumer_id: cons[0], dispatched_at: '2026-10-10' });
await call('POST', '/master/document-dispatch', { document_type: 'Builder Buyer Agreement', dispatch_mode: 'Hand Delivery', consumer_id: cons[1], dispatched_at: '2026-10-14' });
await call('POST', '/custom-letters', { project_id: proj, name: 'Welcome Letter', subject: 'Welcome to {{projectName}}', body_html: '<p>Dear {{consumerName}},</p><p>Welcome to the Grapes family. We thank you for choosing {{projectName}}.</p>', is_ref_no: true, ref_prefix: 'GG/WL' });
await call('POST', '/custom-letters', { project_id: proj, name: 'Payment Reminder', subject: 'Payment reminder for {{projectName}}', body_html: '<p>Dear {{consumerName}}, this is a gentle reminder about your pending instalment.</p>' });

console.log(`done: ${n} units, ${bad} failed calls`);
