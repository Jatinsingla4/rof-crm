// Adds varied applicants to the LOCAL demo database (individual, company, joint, no project, different stages and cities), with remarks and KYC.
// Run:  BASE=http://localhost:3020/api node docs/demo-seed-applicants.mjs     (never against live)
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) throw new Error('demo seed runs on a local API only');
let tok = '', bad = 0;
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); const j = await r.json().catch(() => null); if (!r.ok) { bad++; console.log(`FAIL ${m} ${p} ${r.status} ${JSON.stringify(j)?.slice(0, 140)}`); } return j?.data ?? j; };
tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@demo.local', password: 'Demo#Pass1234' }) })).json()).token;
const proj = (await call('GET', '/projects')).find(p => /Grapes Greens/.test(p.name))?.id;
const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let n = 0;
const pan = () => { n++; return `${L[n % 24]}${L[(n * 7) % 24]}${L[(n * 3) % 24]}${L[(n * 5) % 24]}P${String(1000 + n * 37).slice(-4)}${L[(n * 11) % 24]}`; };
const people = [
  ['Rohit Bansal', 'Gurugram', 'Salaried', 'interested'], ['Meera Iyer', 'Noida', 'Doctor', 'enquiry'], ['Harpreet Gill', 'Chandigarh', 'Business', 'application_filed'],
  ['Vivek Arora', 'New Delhi', 'Engineer', 'enquiry'], ['Anjali Mishra', 'Faridabad', 'Chartered Accountant', 'interested'], ['Suresh Nair', 'Gurugram', 'Retired', 'enquiry'],
];
let i = 0;
for (const [nm, city, prof, stage] of people) {
  const [first, last] = nm.split(' '); i++;
  await call('POST', '/consumers', { name: nm, first_name: first, last_name: last, mobile: `98${String(10000000 + i * 111113).slice(-8)}`, email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`, pan_no: pan(), dob: `19${70 + i}-0${i}-1${i}`, gender: i % 3 ? 'male' : 'female', profession: prof, present_city: city, present_state: 'Haryana', present_pin: '122001', annual_income: 600000 * i, lead_stage: stage === 'enquiry' || stage === 'interested' ? stage : 'enquiry', project_id: proj, source_of_enquiry: 'Website' });
}
await call('POST', '/consumers', { name: 'Kapoor Infra Pvt Ltd', applicant_type: 'company', company_name: 'Kapoor Infra Pvt Ltd', company_gstin: '06AAACK1234F1Z4', authorized_person: 'Rakesh Kapoor', mobile: '9811100001', email: 'accounts@kapoorinfra.example.com', project_id: proj });
const joint = await call('POST', '/consumers', { name: 'Deepak Soni', first_name: 'Deepak', last_name: 'Soni', applicant_type: 'multiple', mobile: '9811100002', pan_no: pan(), project_id: proj, co_applicant_first_name: 'Kavita', co_applicant_last_name: 'Soni', co_applicant_relation: 'Spouse', co_applicant_pan_no: pan(), co_applicant_mobile: '9811100003' });
await call('POST', `/consumers/${joint.id}/multi-applicants`, { applicants: [{ first_name: 'Arjun', last_name: 'Soni', relation: 'Son', dob: '1998-04-04', mobile: '9811100004' }] });
await call('POST', `/consumers/${joint.id}/remarks`, { channel: 'call', subject: 'Site visit', notes: 'Visit planned for Saturday', followUpDate: '2026-11-05', tags: ['site-visit'] });
await call('POST', '/consumers', { name: 'Walk In Guest', mobile: '9811100005' });
console.log(`done, ${bad} failed calls`);
