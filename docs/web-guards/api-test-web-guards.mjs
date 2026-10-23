// Guards that read the code (no server needed). They stop the kinds of mistakes the module checks kept finding by hand:
//  1. every API path a screen calls exists on the server (a button that calls a route nobody wrote: Campaign Launch, Receipt Reject, ...)
//  2. no screen builds its project list out of the units (a project without a unit, or past the first 300 units, was missing)
//  3. no screen keeps business data in the browser (localStorage), it would differ per person and per browser
//  4. no screen puts a project name or a customer name into the page without escaping in a pick list built from /projects or /consumers
// Run:  node api-test-web-guards.mjs      (last line: RESULT: N passed, M failed)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const API = path.join(ROOT, 'packages/api/src'), PAGES = path.join(ROOT, 'packages/web/public/js/pages');
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };

// ---------- the route table of the server, read from the code ----------
const idx = fs.readFileSync(path.join(API, 'index.ts'), 'utf8');
const files = {};
for (const m of idx.matchAll(/import (\w+) from '\.\/routes\/([\w.-]+?)(?:\.js)?'/g)) files[m[1]] = path.join(API, 'routes', m[2] + '.ts');
const toRe = (p) => new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, (c) => (c === '/' ? c : '\\' + c)).replace(/:[A-Za-z_]+/g, '[^/]+').replace(/\//g, '\\/') + '/?$');
const routes = [];
for (const m of idx.matchAll(/app\.(get|post|put|patch|delete)\('(\/api[^']*)'/g)) routes.push({ method: m[1].toUpperCase(), re: toRe(m[2]) });
// the routes of one file under a base path; a router that mounts other routers (router.use(other)) is followed
const collect = (file, base, seen = new Set()) => {
  if (seen.has(file) || !fs.existsSync(file)) return;
  seen.add(file);
  const src = fs.readFileSync(file, 'utf8');
  for (const r of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*(?:'([^']*)'|`([^`]*)`)/g)) {
    const p = (r[2] ?? r[3]).replace(/\$\{[^}]*\}/g, ':x');
    routes.push({ method: r[1].toUpperCase(), re: toRe(base + (p === '/' ? '' : p)) });
  }
  const local = {};
  for (const m of src.matchAll(/import (\w+) from '\.\/([\w.-]+?)(?:\.js)?'/g)) local[m[1]] = path.join(path.dirname(file), m[2] + '.ts');
  for (const m of src.matchAll(/router\.use\(\s*(?:'([^']*)',\s*)?([\w\s,]+)\)/g)) for (const n of m[2].split(',').map((x) => x.trim())) if (local[n]) collect(local[n], base + (m[1] || ''), seen);
};
// each app.use('/api/...') block runs until the next top-level app. / comment / const line, so a mount that spans lines (a small wrapper before the router) is read whole
for (const m of idx.matchAll(/^app\.use\('(\/api\/[\w/-]+)',([\s\S]*?)(?=^app\.|^\/\/ |^const |^export |^await |$(?![\s\S]))/gm)) {
  for (const name of [...new Set([...m[2].matchAll(/\b(\w+)\b/g)].map((x) => x[1]).filter((n) => files[n]))]) collect(files[name], m[1]);
}
t('the route table of the server was read (a sanity check of this guard)', routes.length > 300, routes.length);

// ---------- what the screens call ----------
const pages = fs.readdirSync(PAGES).filter((f) => f.endsWith('.js'));
const calls = [];
for (const f of pages) {
  const s = fs.readFileSync(path.join(PAGES, f), 'utf8');
  for (const m of s.matchAll(/Api\.(get|post|put|patch|delete)\(\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/g)) {
    const p = m[3].replace(/\$\{[^}]*\}/g, ':x').split('?')[0];
    if (p.startsWith('/')) calls.push({ f, method: m[1].toUpperCase(), p });
  }
}
t('the calls of the screens were read (a sanity check of this guard)', calls.length > 300, calls.length);
// Calls this guard cannot read (a path joined from variables), each with who checks them. A new entry here needs a reason; the list should only get shorter.
const KNOWN_DEAD = {
  'receipts.js PATCH /payments/receipts/': 'the path is joined from a variable (PATCH /payments/receipts/ + id), not readable here; the Receipts tests call it',
  'reports.js GET /reports/:x': 'the endpoint comes from the report list of the screen; every report endpoint is called by docs/reports/api-test-reports.mjs and e2e/reports.spec.ts',
};
const dead = calls.filter((c) => !routes.some((r) => r.method === c.method && r.re.test('/api' + c.p) || r.method === c.method && r.re.test('/api' + c.p.replace(/:x$/, ''))))
  .filter((c) => !KNOWN_DEAD[`${c.f} ${c.method} ${c.p}`]);
t('every API path a screen calls exists on the server', dead.length === 0, [...new Set(dead.map((d) => `${d.f} ${d.method} ${d.p}`))].join(' | '));

// ---------- no project list out of the units ----------
const fromUnits = pages.filter((f) => /\[\s*u\.project_id\s*\|\|\s*u\.projectId\s*,/.test(fs.readFileSync(path.join(PAGES, f), 'utf8')));
t('no screen builds its project list from the units (use Utils.projectOptions)', fromUnits.length === 0, fromUnits.join(', '));

// ---------- no business data in the browser ----------
const local = pages.filter((f) => /localStorage\.setItem/.test(fs.readFileSync(path.join(PAGES, f), 'utf8')));
t('no screen keeps data in localStorage', local.length === 0, local.join(', '));

// ---------- the pick lists made of projects or customers escape what they show ----------
const raw = [];
for (const f of pages) {
  const s = fs.readFileSync(path.join(PAGES, f), 'utf8');
  for (const m of s.matchAll(/<option value="\$\{p\.id\}">\$\{p\.name\}<\/option>/g)) raw.push(`${f}: ${m[0]}`);
}
t('a project pick list never shows ${p.name} without escaping', raw.length === 0, raw.slice(0, 5).join(' | '));

// ---------- today's date comes from Utils.today(), not from toISOString() (UTC: yesterday between midnight and 5:30 in India) ----------
const utc = pages.filter((f) => /new Date\(\)\.toISOString\(\)\s*\.(?:slice\(0,\s*10\)|split\('T'\)\[0\])/.test(fs.readFileSync(path.join(PAGES, f), 'utf8')));
t('no screen takes today\'s date from toISOString() (use Utils.today())', utc.length === 0, utc.join(', '));
// the email template screen has its own API; the legal letter table is not for email wording
t('the email template screen does not use the legal letter templates', !/documents\/templates/.test(fs.readFileSync(path.join(PAGES, 'email-templates.js'), 'utf8')));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
