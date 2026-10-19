// Checks for the fixes made on 2026-10-19. Run against a local test API: BASE=http://localhost:3002/api node api-test-fixes.mjs
const B = process.env.BASE || 'http://localhost:3002/api';
let pass = 0, fail = 0; const fails = [];
const t = (n, ok, x = '') => { ok ? pass++ : (fail++, fails.push(n + ' -> ' + x)); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async r => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: r + '@test.local', password: 'Test#Pass1234' }) })).json()).token;
const tokens = { A: await login('super_admin'), PM: await login('project_manager') };
const call = tok => async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const A = call(tokens.A), PM = call(tokens.PM);
const U = Date.now().toString(36).slice(-6);
const NIL = '00000000-0000-0000-0000-000000000000';
const CO = (await A('POST', '/companies', { name: 'Fx Co ' + U })).j.data.id; // every project needs a company

// X1: consumer PATCH works (partial body, name, lead stage) and keeps the name
const consumers = await A('GET', '/consumers?limit=1'); const c = (consumers.j?.data?.consumers || consumers.j?.data || [])[0];
let r = await A('PATCH', '/consumers/' + c.id, { leadStage: c.lead_stage || 'lead' }); t('consumer PATCH: lead stage only -> 200', r.s === 200, r.s + ' ' + JSON.stringify(r.j).slice(0, 100));
r = await A('PATCH', '/consumers/' + c.id, { salutation: 'Mr.' }); t('consumer PATCH: salutation only -> 200', r.s === 200, r.s);
r = await A('PATCH', '/consumers/' + c.id, { email: 'x' + U + '@example.com' }); t('consumer PATCH: email only keeps the name', r.s === 200 && r.j.data.name && r.j.data.name.trim() !== '', r.s + ' ' + JSON.stringify(r.j).slice(0, 120));
r = await A('PATCH', '/consumers/' + c.id, { first_name: 'raj', last_name: 'kumar' }); t('consumer PATCH: first and last name rebuild the name', r.s === 200 && r.j.data.name === 'Raj Kumar', JSON.stringify(r.j).slice(0, 120));
r = await A('PATCH', '/consumers/' + NIL, { email: 'a@b.co' }); t('consumer PATCH: unknown id -> 404', r.s === 404, r.s);

// S1: salutation limit 20; F8: plain field names in messages
r = await A('POST', '/master/salutations', { name: 'S'.repeat(21) }); t('salutation: 21 characters -> 400', r.s === 400 && /20/.test(r.j?.error), r.s + ' ' + JSON.stringify(r.j));
r = await A('POST', '/master/salutations', { name: 'S' + U }); t('salutation: short name ok', r.s === 201, r.s); const sid = r.j?.data?.id;
r = await A('PUT', '/master/salutations/' + sid, { name: 'S'.repeat(25) }); t('salutation: rename to 25 characters -> 400', r.s === 400, r.s);
await A('DELETE', '/master/salutations/' + sid);
r = await A('POST', '/master/professions', { name: '<b>x' }); t('message uses a plain label ("Name cannot contain")', r.s === 400 && r.j.error.startsWith('Name cannot'), JSON.stringify(r.j));

// project, towers, units
const pid = (await A('POST', '/projects', { companyId: CO, name: 'Fx-' + U, reraNumber: 'FXR-' + U, tcpLicence: 'x' })).j?.data?.id;
const other = (await A('POST', '/projects', { companyId: CO, name: 'Fo-' + U, reraNumber: 'FOR-' + U, tcpLicence: 'x' })).j?.data?.id;
const tid = (await A('POST', `/projects/${pid}/towers`, { towerName: 'T1' })).j?.data?.id;
r = await A('POST', `/projects/${pid}/towers`, { towerName: 't1' }); t('tower: same name other case -> 409', r.s === 409, r.s);
r = await A('POST', `/projects/${pid}/towers`, { towerName: '<i>' }); t('tower: markup message says "Tower name"', r.s === 400 && r.j.error.startsWith('Tower name'), JSON.stringify(r.j));
r = await A('DELETE', `/projects/${pid}/towers/${NIL}`); t('tower: delete unknown id -> 404', r.s === 404, r.s);

// F4: unit types, case-insensitive duplicate and non-negative numbers
r = await A('POST', '/master/unit-types', { project_id: pid, name: 'Type-A', carpet_area_sqft: 500 }); t('unit type: add', r.s === 201, JSON.stringify(r.j)); const utid = r.j?.data?.id;
r = await A('POST', '/master/unit-types', { project_id: pid, name: 'type-a' }); t('unit type: same name other case -> 409', r.s === 409, r.s);
r = await A('POST', '/master/unit-types', { project_id: other, name: 'type-a' }); t('unit type: same name in another project ok', r.s === 201, r.s);
r = await A('POST', '/master/unit-types', { project_id: pid, name: 'Neg', base_rate_sqft: -1 }); t('unit type: negative rate -> 400', r.s === 400, r.s);
r = await A('POST', '/master/unit-types', { project_id: pid, name: 'Txt', carpet_area_sqft: 'abc' }); t('unit type: text number -> 400', r.s === 400, r.s);
r = await A('PUT', '/master/unit-types/' + utid, { base_rate_sqft: -5 }); t('unit type: edit to negative -> 400', r.s === 400, r.s);


// P10 / F7: project names are unique, a project needs an existing company, and two requests at once make one project
r = await A('POST', '/projects', { name: 'Fx-' + U.toUpperCase(), reraNumber: 'DUP-' + U, tcpLicence: 'x', companyId: CO }); t('project: same name other case -> 409', r.s === 409, r.s);
r = await A('POST', '/projects', { name: 'NoCo-' + U, reraNumber: 'NC-' + U, tcpLicence: 'x' }); t('project: no company -> 400', r.s === 400 && /companyId/.test(r.j?.error), r.s + ' ' + JSON.stringify(r.j));
r = await A('POST', '/projects', { name: 'BadCo-' + U, reraNumber: 'BC-' + U, tcpLicence: 'x', companyId: NIL }); t('project: unknown company -> 400', r.s === 400, r.s);
r = await A('PATCH', '/projects/' + other, { name: 'fx-' + U }); t('project: rename to an existing name -> 409', r.s === 409, r.s);
r = await A('PATCH', '/projects/' + pid, { name: 'Fx-' + U }); t('project: saving its own name again is fine', r.s === 200, r.s);
const racers = await Promise.all(Array.from({ length: 8 }, (_, i) => A('POST', '/projects', { name: 'Race-' + U, reraNumber: 'RC' + i + '-' + U, tcpLicence: 'x', companyId: CO })));
t('project: 8 requests at once with one name -> exactly one created', racers.filter(x => x.s === 201).length === 1 && racers.every(x => [201, 409].includes(x.s)), racers.map(x => x.s).join(','));

// P6 / F6: units
const unit = (o = {}) => ({ projectId: pid, towerId: tid, floor: 1, unitNumber: 'U' + Math.random().toString(36).slice(2, 7), bhkType: '2BHK', carpetAreaSqft: 500, ...o });
r = await A('POST', '/units', unit({ carpetAreaSqft: -5 })); t('unit: negative area -> 400', r.s === 400, r.s);
r = await A('POST', '/units', unit({ totalPriceInr: -1 })); t('unit: negative price -> 400', r.s === 400, r.s);
r = await A('POST', '/units', unit({ unitTypeId: utid, totalPriceInr: 5000000 })); t('unit: with unit type and price', r.s === 201 && String(r.j.data.total_price_inr) === '5000000', JSON.stringify(r.j));
const uid = r.j?.data?.id;
const list = await A('GET', '/units?projectId=' + pid); const row = (list.j?.data?.units || list.j?.data || []).find(x => x.id === uid); t('unit: unit type name shows as unit_group', row?.unit_group === 'Type-A', JSON.stringify(row?.unit_group));
const otherType = (await A('GET', '/master/unit-types?project_id=' + other)).j.data[0].id;
r = await A('POST', '/units', unit({ unitTypeId: otherType })); t('unit: unit type of another project -> 400', r.s === 400, r.s);
r = await A('PATCH', '/units/' + uid, { totalPriceInr: -3 }); t('unit edit: negative price -> 400', r.s === 400, r.s);

// F3: bulk imports count real inserts only and leave no empty tower
const csv = 'tower,floor,unitNumber,bhkType,carpetAreaSqft,superAreaSqft,balconyAreaSqft,basePriceInr,totalPriceInr,facing\n'
  + 'T1,1,CSV-1,2BHK,650,750,100,5000000,5000000,North\nT1,1,CSV-1,2BHK,650,750,100,5000000,5000000,North\nGhostTower,,CSV-3,2BHK,650,750,100,5000000,5000000,North\nT1,2,CSV-2,3BHK,900,1000,100,7000000,7000000,East';
r = await A('POST', '/import', { csvText: csv, projectId: pid, importType: 'units', fileName: 't.csv' });
t('import: 2 created, 2 skipped (duplicate and blank floor)', r.j?.data?.created === 2 && r.j?.data?.skipped === 2, JSON.stringify(r.j?.data));
const towers = (await A('GET', `/projects/${pid}/towers`)).j.data.map(x => x.tower_name);
t('import: blank-floor row leaves no empty tower', !towers.includes('GhostTower'), towers.join(','));
r = await A('POST', '/units/bulk-import', { projectId: pid, rows: [{ tower: 'T1', floor: 1, unitNumber: 'CSV-1', bhkType: '2BHK' }, { tower: 'T1', floor: 3, unitNumber: 'BULK-9', bhkType: '2BHK' }] });
t('bulk-import: duplicate is skipped, not counted as created', r.j?.data?.created === 1 && r.j?.data?.skipped === 1, JSON.stringify(r.j?.data));

// P7 / P8: unit locations
r = await A('POST', `/projects/${pid}/unit-locations`, { name: 'Park Facing' }); const lid = r.j?.data?.id;
r = await A('POST', `/projects/${pid}/unit-locations`, { name: 'park facing' }); t('location: same name other case -> 409', r.s === 409, r.s);
r = await A('POST', `/projects/${other}/unit-locations`, { name: 'park facing' }); t('location: same name in another project ok', r.s === 201, r.s);
await A('DELETE', `/projects/${pid}/unit-locations/${lid}`); r = await A('DELETE', `/projects/${pid}/unit-locations/${lid}`); t('location: delete twice -> 404', r.s === 404, r.s);

// P6 / P7 / P9: reminders
r = await A('POST', '/master/reminder-master', { name: 'Same day ' + U, days_before: 0 }); t('reminder: 0 days allowed', r.s === 201, JSON.stringify(r.j)); const rid = r.j?.data?.id;
r = await A('POST', '/master/reminder-master', { name: 'Neg ' + U, days_before: -2 }); t('reminder: negative days -> 400', r.s === 400, r.s);
r = await A('POST', '/master/reminder-master', { name: 'Frac ' + U, days_before: 1.5 }); t('reminder: fractional days -> 400', r.s === 400, r.s);
r = await A('POST', '/master/reminder-master', { name: ('same DAY ' + U), days_before: 0 }); t('reminder: same name and days -> 409', r.s === 409, r.s);
r = await A('POST', '/master/reminder-master', { name: 'Same day ' + U, days_before: 3 }); t('reminder: same name, other days ok', r.s === 201, r.s); const rid2 = r.j?.data?.id;
await A('DELETE', '/master/reminder-master/' + rid); await A('DELETE', '/master/reminder-master/' + rid2);

// S5: logo bytes are checked and a bad file never replaces the current logo
const co = (await A('POST', '/companies', { name: 'Logo Co ' + U })).j?.data?.id;
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const up = async (bytes, type, name) => { const fd = new FormData(); fd.append('logo', new Blob([bytes], { type }), name); const r = await fetch(`${B}/companies/${co}/logo`, { method: 'POST', headers: { authorization: 'Bearer ' + tokens.A }, body: fd }); return { s: r.status, j: await r.json().catch(() => null) }; };
r = await up(png, 'image/png', 'logo.png'); t('logo: real PNG -> 200 .png', r.s === 200 && r.j.logo_url.endsWith('.png'), JSON.stringify(r));
const url = r.j?.logo_url; const before = await (await fetch(B.replace('/api', '') + url)).arrayBuffer();
r = await up(Buffer.from('<html><script>alert(1)</script></html>'), 'image/png', 'evil.png'); t('logo: HTML sent as image/png -> 400', r.s === 400, JSON.stringify(r));
const after = await (await fetch(B.replace('/api', '') + url)).arrayBuffer(); t('logo: the current logo is unchanged after a bad upload', Buffer.compare(Buffer.from(before), Buffer.from(after)) === 0);
r = await up(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]), 'image/png', 'real.jpg.png'); t('logo: JPEG bytes sent as image/png are saved as .jpg', r.s === 200 && r.j.logo_url.endsWith('.jpg'), JSON.stringify(r));
r = await fetch(B.replace('/api', '') + url); t('logo: the old .png file was removed', r.status !== 200 || !(r.headers.get('content-type') || '').startsWith('image/'), r.status);
r = await PM('POST', `/companies/${co}/logo`); t('logo: project_manager still blocked', r.s === 403, r.s);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`); if (fails.length) console.log('FAILED:\n' + fails.join('\n'));
process.exit(fail ? 1 : 0);
