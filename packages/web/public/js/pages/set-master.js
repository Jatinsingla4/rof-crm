// ROF CRM - Set Master (reference data)
// Six screens: locations, lists, banks (this file), checklist and dispatch (set-master-docs.js),
// companies (set-master-company.js). SMPage is declared in constants.js.

(function () {
'use strict';
const SM = SMPage;
window.SM = SM;       // inline onclick handlers call SM.*
SM.screens = {};
SM.d = {};            // data cache, filled by SM.loadAll and SM.reload
SM.sel = {};          // selected country and state on the Locations screen
SM.q = {};            // search text per box, kept across redraws
SM.screen = 'locations';
SM.list = 'salutations';

const esc = (s) => Utils.esc(s);

SM.NAV = [
  { group: 'Geography',      items: [{ id: 'locations', label: 'Locations' }] },
  { group: 'Applicant data', items: [{ id: 'lists', label: 'Applicant lists' }] },
  { group: 'Finance',        items: [{ id: 'banks', label: 'Banks' }, { id: 'companies', label: 'Companies' }] },
  { group: 'Documents',      items: [{ id: 'checklist', label: 'Document checklist' }, { id: 'dispatch', label: 'Dispatch log' }] },
];

SM.LISTS = {
  salutations:   { label: 'Salutations',        one: 'salutation',        url: '/master/salutations',        usage: 'salutations',   hint: 'for example Mr., Mrs., Dr.' },
  professions:   { label: 'Professions',        one: 'profession',        url: '/master/professions',        usage: 'professions',   hint: 'for example Engineer' },
  nationalities: { label: 'Nationalities',      one: 'nationality',       url: '/master/nationalities',      usage: 'nationalities', hint: 'for example Indian',
                   note: 'Nationality decides GST on receipts and letters (NRI, OCI and PIO are treated differently). Do not rename or remove these without Accounts.' },
  sources:       { label: 'Sources of enquiry', one: 'source of enquiry', url: '/master/sources-of-enquiry', usage: 'sources',       hint: 'for example Walk-in', desc: true },
};

SM.EP = {
  countries: '/master/countries', states: '/master/states', cities: '/master/cities',
  salutations: '/master/salutations', professions: '/master/professions', nationalities: '/master/nationalities',
  sources: '/master/sources-of-enquiry', banks: '/master/banks', doctypes: '/master/document-types', companies: '/companies',
};

// Links from the top menu use the old tab names
SM.OLD_TABS = {
  country: ['locations'], state: ['locations'], city: ['locations'],
  salutation: ['lists', 'salutations'], profession: ['lists', 'professions'], nationality: ['lists', 'nationalities'], source: ['lists', 'sources'],
  bank: ['banks'], company: ['companies'], doctype: ['checklist'], dispatch: ['dispatch'],
};

// Same rules as the server (master_data permission): super_admin all, project_manager create and edit
SM.role = () => (Auth.getUser() || {}).role;
SM.can = (action) => SM.role() === 'super_admin' || (SM.role() === 'project_manager' && action !== 'delete');
SM.canCompany = () => SM.role() === 'super_admin';

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------
Pages.setMaster = async function (params = {}) {
  const legacy = SM.OLD_TABS[params.tab];
  SM.screen = params.screen || (legacy && legacy[0]) || 'locations';
  SM.list = params.list || (legacy && legacy[1]) || SM.list;
  // Moving between screens reuses data loaded in the last 30 seconds; every change reloads what it touched
  if (!SM.loadedAt || Date.now() - SM.loadedAt > 30000) {
    document.getElementById('content').innerHTML = '<div class="sm-empty">Loading...</div>';
    await SM.loadAll();
  }
  SM.paint();
};

SM.get = async (path) => {
  try { return (await Api.get(path)).data; } catch (e) { SM.failed.push(path); return null; }
};

SM.loadAll = async () => {
  SM.failed = [];
  const keys = Object.keys(SM.EP);
  const results = await Promise.all(keys.map((k) => SM.get(SM.EP[k])));
  keys.forEach((k, i) => { SM.d[k] = results[i] || []; });
  SM.d.usage = (await SM.get('/master/usage')) || {};
  SM.loadedAt = Date.now();
};

SM.reload = async (...keys) => {
  await Promise.all(keys.map(async (k) => { SM.d[k] = (await SM.get(SM.EP[k])) || SM.d[k] || []; }));
  SM.d.usage = (await SM.get('/master/usage')) || SM.d.usage || {};
  SM.paint();
};

SM.paint = () => {
  const d = SM.d;
  const counts = {
    locations: d.countries.length,
    lists: d.salutations.length + d.professions.length + d.nationalities.length + d.sources.length,
    banks: d.banks.length, companies: d.companies.length, checklist: d.doctypes.length,
  };
  const warn = { companies: d.companies.some((c) => !c.primary_accounts) };
  const rail = SM.NAV.map((g) => `
    <div class="sm-rail-group">${esc(g.group)}</div>
    ${g.items.map((i) => `<button class="sm-rail-item${i.id === SM.screen ? ' on' : ''}" onclick="SM.go('${i.id}')">
      <span>${esc(i.label)}</span>
      <span>${warn[i.id] ? '<span class="sm-dot" title="Setup incomplete"></span> ' : ''}${counts[i.id] != null ? `<span class="sm-count">${counts[i.id]}</span>` : ''}</span>
    </button>`).join('')}`).join('');
  const failed = SM.failed.length ? `<div class="sm-note">Some data could not be loaded (${SM.failed.map(esc).join(', ')}). Refresh the page.</div>` : '';
  document.getElementById('content').innerHTML = `
    <div class="sm-head"><h1>Set Master</h1><p>Reference data that every booking, receipt and letter depends on.</p></div>
    ${failed}
    <div class="sm"><nav class="sm-rail" aria-label="Set Master sections">${rail}</nav><section id="sm-main"></section></div>`;
  const main = document.getElementById('sm-main');
  (SM.screens[SM.screen] || SM.screens.locations)(main);
  main.querySelectorAll('.sm-search').forEach((i) => { i.value = SM.q[i.dataset.q] || ''; if (i.value) SM.filter(i); });
};

SM.go = (screen, list) => Router.navigate('/set-master', list ? { screen, list } : { screen });

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------
SM.plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;

SM.search = (id, placeholder = 'Search') =>
  `<input class="sm-input sm-search" data-q="${id}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" oninput="SM.filter(this)">`;

// Hides rows that do not contain the text; rows are marked data-row
SM.filter = (input) => {
  SM.q[input.dataset.q] = input.value;
  const q = input.value.trim().toLowerCase();
  const scope = input.closest('.sm-panel');
  scope.querySelectorAll('[data-row]').forEach((r) => { r.style.display = !q || r.textContent.toLowerCase().includes(q) ? '' : 'none'; });
};

SM.empty = (title, text, action) =>
  `<div class="sm-empty"><b>${esc(title)}</b>${esc(text || '')}${action ? `<div style="margin-top:12px">${action}</div>` : ''}</div>`;

SM.run = async (fn, ok) => {
  try { await fn(); if (ok) Utils.success(ok); return true; }
  catch (e) { Utils.error(e.message); return false; }
};

// Confirm dialog. Resolves true when the user confirms. Focus starts on Cancel.
SM.ask = ({ title, text, ok = 'Delete', danger = true }) => new Promise((resolve) => {
  const back = document.activeElement;
  const box = document.createElement('div');
  box.innerHTML = `<div class="sm-veil" style="z-index:902"></div>
    <div class="sm-dialog" role="alertdialog" aria-modal="true" aria-label="${esc(title)}">
      <h2>${esc(title)}</h2><p>${esc(text)}</p>
      <div class="sm-dialog-f"><button class="sm-btn" data-r="0">Cancel</button>
      <button class="sm-btn ${danger ? 'sm-btn--danger' : 'sm-btn--primary'}" data-r="1">${esc(ok)}</button></div></div>`;
  document.body.appendChild(box);
  const done = (v) => { document.removeEventListener('keydown', onKey, true); box.remove(); if (back && back.focus) back.focus(); resolve(v); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
  document.addEventListener('keydown', onKey, true);
  box.querySelectorAll('[data-r]').forEach((b) => { b.onclick = () => done(b.dataset.r === '1'); });
  box.querySelector('.sm-veil').onclick = () => done(false);
  box.querySelector('[data-r="0"]').focus();
});

// Side drawer with a form. fields: { key, label, type: text|textarea|select, required, placeholder, maxlength, options, hint, disabled }
// onSubmit(values) may throw; the message is shown in the drawer and the drawer stays open.
SM.openForm = ({ title, fields, values = {}, submit = 'Save', onSubmit }) => {
  SM.closeForm();
  SM._back = document.activeElement;
  const input = (f) => {
    const v = values[f.key] == null ? '' : values[f.key];
    const common = `id="smf-${f.key}" name="${f.key}" class="sm-input" ${f.disabled ? 'disabled' : ''} ${f.maxlength ? `maxlength="${f.maxlength}"` : ''} placeholder="${esc(f.placeholder || '')}"`;
    if (f.type === 'select') {
      return `<select ${common}><option value="">Select</option>${(f.options || []).map((o) =>
        `<option value="${esc(o.value)}"${String(o.value) === String(v) ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
    }
    if (f.type === 'textarea') return `<textarea ${common} rows="3">${esc(v)}</textarea>`;
    if (f.type === 'date') return `<input ${common} type="date" value="${esc(v)}">`;
    return `<input ${common} type="text" value="${esc(v)}" autocomplete="off">`;
  };
  const host = document.createElement('div');
  host.id = 'sm-drawer-host';
  host.innerHTML = `<div class="sm-veil" data-close></div>
    <aside class="sm-drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sm-drawer-h"><h2>${esc(title)}</h2><button class="sm-btn sm-btn--quiet" type="button" data-close>Close</button></div>
      <form id="sm-form" novalidate style="display:flex;flex-direction:column;flex:1;min-height:0">
        <div class="sm-drawer-b">
          ${fields.map((f) => `<div class="sm-field"><label class="sm-label" for="smf-${f.key}">${esc(f.label)}${f.required ? ' <i>*</i>' : ''}</label>${input(f)}
            ${f.hint ? `<div class="sm-hint">${esc(f.hint)}</div>` : ''}<div class="sm-err" id="smf-err-${f.key}"></div></div>`).join('')}
          <div class="sm-err" id="sm-form-err" role="alert"></div>
        </div>
        <div class="sm-drawer-f"><button class="sm-btn" type="button" data-close>Cancel</button><button class="sm-btn sm-btn--primary" type="submit">${esc(submit)}</button></div>
      </form></aside>`;
  document.body.appendChild(host);
  host.querySelectorAll('[data-close]').forEach((b) => { b.onclick = SM.closeForm; });
  SM._onKey = (e) => { if (e.key === 'Escape') SM.closeForm(); };
  document.addEventListener('keydown', SM._onKey);
  const form = host.querySelector('#sm-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const out = {};
    let ok = true;
    fields.forEach((f) => {
      const el = form.elements[f.key];
      const v = el.value.trim();
      out[f.key] = v;
      const bad = f.required && !v;
      el.classList.toggle('bad', bad);
      host.querySelector(`#smf-err-${f.key}`).textContent = bad ? `${f.label} is required` : '';
      if (bad) ok = false;
    });
    if (!ok) { form.querySelector('.bad')?.focus(); return; }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    host.querySelector('#sm-form-err').textContent = '';
    try { await onSubmit(out); SM.closeForm(); }
    catch (err) { host.querySelector('#sm-form-err').textContent = err.message; btn.disabled = false; }
  };
  form.querySelector('input:not([disabled]), select:not([disabled]), textarea')?.focus();
};

SM.closeForm = () => {
  document.getElementById('sm-drawer-host')?.remove();
  if (SM._onKey) { document.removeEventListener('keydown', SM._onKey); SM._onKey = null; }
  if (SM._back && SM._back.focus && document.contains(SM._back)) SM._back.focus();
};

const rowActions = (kind, id, { canEdit, canDelete, deleteTitle } = {}) => `
  ${canEdit ? `<button class="sm-btn sm-btn--quiet" data-act="edit" data-kind="${kind}" data-id="${esc(id)}">Edit</button>` : ''}
  ${canDelete ? `<button class="sm-btn sm-btn--quiet sm-btn--danger" data-act="del" data-kind="${kind}" data-id="${esc(id)}"
    ${deleteTitle ? `disabled title="${esc(deleteTitle)}"` : ''}>Delete</button>` : ''}`;

// One click handler per screen: finds the button and calls handler(kind, id, action)
SM.wire = (root, handler) => {
  root.onclick = (e) => {
    const btn = e.target.closest('[data-act]');
    if (btn) { e.stopPropagation(); handler(btn.dataset.kind, btn.dataset.id, btn.dataset.act); return; }
    const pick = e.target.closest('[data-pick]');
    if (pick) handler(pick.dataset.kind, pick.dataset.id, 'pick');
  };
  root.onkeydown = (e) => {
    const pick = e.target.closest && e.target.closest('[data-pick]');
    if (pick && (e.key === 'Enter' || e.key === ' ') && e.target === pick) { e.preventDefault(); handler(pick.dataset.kind, pick.dataset.id, 'pick'); }
  };
};

SM.deleteItem = async (url, id, label, key) => {
  const yes = await SM.ask({ title: `Delete ${label}?`, text: 'This cannot be undone. The change is recorded in the audit log.' });
  if (!yes) return;
  if (await SM.run(() => Api.delete(`${url}/${id}`), 'Deleted')) await SM.reload(...key);
};

// ---------------------------------------------------------------------------
// Screen 1: Locations (country > state > city)
// ---------------------------------------------------------------------------
SM.screens.locations = (root) => {
  const d = SM.d, sel = SM.sel;
  const states = () => d.states.filter((s) => s.country_id === sel.country);
  if (!d.countries.some((c) => c.id === sel.country)) sel.country = d.countries[0]?.id || null;
  if (!states().some((s) => s.id === sel.state)) sel.state = states()[0]?.id || null;
  const cities = d.cities.filter((c) => c.state_id === sel.state);
  const canAdd = SM.can('create'), canEdit = SM.can('edit'), canDel = SM.can('delete');
  const stateCount = (cid) => d.states.filter((s) => s.country_id === cid).length;
  const cityCount = (sid) => d.cities.filter((c) => c.state_id === sid).length;
  const addBtn = (kind, label, off) => canAdd ? `<button class="sm-btn sm-btn--primary" data-act="add" data-kind="${kind}" ${off ? 'disabled' : ''}>${label}</button>` : '';
  const pickRow = (kind, r, on, meta) => `<div class="sm-pick${on ? ' on' : ''}" data-row data-pick data-kind="${kind}" data-id="${esc(r.id)}" tabindex="0" role="option" aria-selected="${on}">
      <span class="sm-pick-main">${esc(r.name)}${r.code ? ` <small>${esc(r.code)}</small>` : ''}<small>${meta}</small></span>
      <span style="white-space:nowrap">${rowActions(kind, r.id, { canEdit, canDelete: canDel })}</span></div>`;
  const panel = (title, sub, add, body, searchId) => `<div class="sm-panel">
      <div class="sm-panel-h"><div><div class="sm-panel-t">${title}</div><div class="sm-panel-s">${sub}</div></div>
      <div class="sm-tools">${searchId ? SM.search(searchId, 'Find') : ''}${add}</div></div>
      <div class="sm-scroll" role="listbox">${body}</div></div>`;
  const country = d.countries.find((c) => c.id === sel.country), state = d.states.find((s) => s.id === sel.state);
  root.innerHTML = `<div class="sm-cols">
    ${panel('Countries', SM.plural(d.countries.length, 'country', 'countries'), addBtn('country', 'Add country'),
      d.countries.length ? d.countries.map((c) => pickRow('country', c, c.id === sel.country, SM.plural(stateCount(c.id), 'state'))).join('')
        : SM.empty('No countries yet', 'Add India first, then its states.'), 'loc-country')}
    ${panel('States', country ? esc(country.name) : 'Select a country', addBtn('state', 'Add state', !country),
      !country ? SM.empty('Select a country', 'Its states appear here.')
        : states().length ? states().map((s) => pickRow('state', s, s.id === sel.state, SM.plural(cityCount(s.id), 'city', 'cities'))).join('')
        : SM.empty('No states', `${country.name} has no states yet.`), 'loc-state')}
    ${panel('Cities', state ? esc(state.name) : 'Select a state', addBtn('city', 'Add city', !state),
      !state ? SM.empty('Select a state', 'Its cities appear here.')
        : cities.length ? cities.map((c) => `<div class="sm-pick" data-row><span class="sm-pick-main">${esc(c.name)}</span>
            <span style="white-space:nowrap">${rowActions('city', c.id, { canEdit, canDelete: canDel })}</span></div>`).join('')
        : SM.empty('No cities', `${state.name} has no cities yet.`), 'loc-city')}
  </div>`;
  SM.wire(root, SM.locAction);
};

SM.locAction = async (kind, id, act) => {
  const d = SM.d, sel = SM.sel;
  const find = { country: d.countries, state: d.states, city: d.cities }[kind];
  const row = find && find.find((r) => r.id === id);
  if (act === 'pick') {
    if (kind === 'country') { sel.country = id; sel.state = null; } else sel.state = id;
    return SM.paint();
  }
  const stateOpts = d.states.map((s) => ({ value: s.id, label: `${s.name} (${s.country_name || ''})` }));
  const countryOpts = d.countries.map((c) => ({ value: c.id, label: c.name }));
  const spec = {
    country: { label: 'country', url: SM.EP.countries, key: ['countries', 'states', 'cities'], fields: [
      { key: 'name', label: 'Country name', required: true, maxlength: 150, placeholder: 'India' },
      { key: 'code', label: 'ISO code', maxlength: 10, placeholder: 'IN' }] },
    state: { label: 'state', url: SM.EP.states, key: ['states', 'cities'], fields: [
      { key: 'name', label: 'State name', required: true, maxlength: 150, placeholder: 'Haryana' },
      { key: 'country_id', label: 'Country', type: 'select', required: true, options: countryOpts },
      { key: 'code', label: 'State code', maxlength: 10, placeholder: 'HR' }] },
    city: { label: 'city', url: SM.EP.cities, key: ['cities'], fields: [
      { key: 'name', label: 'City name', required: true, maxlength: 150, placeholder: 'Gurugram' },
      { key: 'state_id', label: 'State', type: 'select', required: true, options: stateOpts }] },
  }[kind];
  if (act === 'del') {
    return SM.deleteItem(spec.url, id, row.name, spec.key);
  }
  const values = act === 'edit' ? row : { country_id: sel.country, state_id: sel.state };
  SM.openForm({
    title: `${act === 'edit' ? 'Edit' : 'Add'} ${spec.label}`, fields: spec.fields, values,
    submit: act === 'edit' ? 'Save changes' : `Add ${spec.label}`,
    onSubmit: async (v) => {
      const res = act === 'edit' ? await Api.put(`${spec.url}/${id}`, v) : await Api.post(spec.url, v);
      if (act === 'add' && kind === 'country') sel.country = res.data.id;
      if (act === 'add' && kind === 'state') { sel.country = v.country_id; sel.state = res.data.id; }
      if (act === 'add' && kind === 'city') sel.state = v.state_id;
      Utils.success(act === 'edit' ? 'Saved' : `${spec.label[0].toUpperCase() + spec.label.slice(1)} added`);
      await SM.reload(...spec.key);
    },
  });
};

// ---------------------------------------------------------------------------
// Screen 2: Applicant lists (salutation, profession, nationality, source of enquiry)
// ---------------------------------------------------------------------------
SM.screens.lists = (root) => {
  const L = SM.LISTS[SM.list] || SM.LISTS.salutations;
  const rows = SM.d[SM.list] || [];
  const used = (SM.d.usage || {})[L.usage] || {};
  const canAdd = SM.can('create'), canEdit = SM.can('edit'), canDel = SM.can('delete');
  root.innerHTML = `<div class="sm-panel">
    <div class="sm-panel-h">
      <div class="sm-seg" role="tablist">${Object.entries(SM.LISTS).map(([k, v]) =>
        `<button role="tab" class="${k === SM.list ? 'on' : ''}" onclick="SM.go('lists','${k}')">${esc(v.label)}</button>`).join('')}</div>
      <div class="sm-tools"><span class="sm-count">${SM.plural(rows.length, 'item')}</span>${SM.search('lists', 'Search')}</div>
    </div>
    ${L.note ? `<div class="sm-note" style="margin:12px 16px 0">${esc(L.note)}</div>` : ''}
    ${canAdd ? `<form class="sm-addrow${L.desc ? ' two' : ''}" id="sm-add" novalidate>
      <input class="sm-input" name="name" maxlength="150" placeholder="New ${esc(L.one)}, ${esc(L.hint)}" aria-label="New ${esc(L.one)}" autocomplete="off">
      ${L.desc ? '<input class="sm-input" name="description" placeholder="Description (optional)" aria-label="Description" autocomplete="off">' : ''}
      <button class="sm-btn sm-btn--primary" type="submit">Add</button></form>` : ''}
    ${rows.length ? `<table class="sm-tbl"><thead><tr><th>Name</th>${L.desc ? '<th>Description</th>' : ''}<th class="num">Used on</th><th></th></tr></thead><tbody>
      ${rows.map((r) => { const n = used[r.name] || 0; return `<tr data-row><td>${esc(r.name)}</td>${L.desc ? `<td class="sm-muted">${esc(r.description || '-')}</td>` : ''}
        <td class="num">${n ? SM.plural(n, 'record') : '<span class="sm-muted">-</span>'}</td>
        <td class="act">${rowActions('list', r.id, { canEdit, canDelete: canDel, deleteTitle: n ? `In use on ${n} record(s)` : '' })}</td></tr>`; }).join('')}
      </tbody></table>` : SM.empty(`No ${L.label.toLowerCase()} yet`, 'Type a name above and press Enter.')}
  </div>`;
  SM.wire(root, SM.listAction);
  const form = root.querySelector('#sm-add');
  if (form) form.onsubmit = async (e) => {
    e.preventDefault();
    const body = {};
    [...form.elements].forEach((el) => { if (el.name) body[el.name] = el.value.trim(); });
    if (!body.name) { form.elements.name.focus(); return; }
    if (await SM.run(() => Api.post(L.url, body), `${L.one[0].toUpperCase() + L.one.slice(1)} added`)) {
      await SM.reload(SM.list);
      document.querySelector('#sm-add [name=name]')?.focus();
    }
  };
};

SM.listAction = async (kind, id, act) => {
  const L = SM.LISTS[SM.list], row = SM.d[SM.list].find((r) => r.id === id);
  if (act === 'del') return SM.deleteItem(L.url, id, row.name, [SM.list]);
  SM.openForm({
    title: `Edit ${L.one}`, values: row, submit: 'Save changes',
    fields: [{ key: 'name', label: 'Name', required: true, maxlength: 150 },
      ...(L.desc ? [{ key: 'description', label: 'Description', type: 'textarea' }] : [])],
    onSubmit: async (v) => { await Api.put(`${L.url}/${id}`, v); Utils.success('Saved'); await SM.reload(SM.list); },
  });
};

// ---------------------------------------------------------------------------
// Screen 3: Banks
// ---------------------------------------------------------------------------
SM.screens.banks = (root) => {
  const rows = SM.d.banks || [];
  const used = (SM.d.usage || {}).banks || {};
  const canAdd = SM.can('create'), canEdit = SM.can('edit'), canDel = SM.can('delete');
  root.innerHTML = `<div class="sm-panel">
    <div class="sm-panel-h"><div><div class="sm-panel-t">Banks</div><div class="sm-panel-s">Banks used for cheques and clearing. Company bank accounts are under Companies.</div></div>
      <div class="sm-tools"><span class="sm-count">${SM.plural(rows.length, 'bank')}</span>${SM.search('banks', 'Search')}</div></div>
    ${canAdd ? `<form class="sm-addrow multi" id="sm-add" novalidate>
      <input class="sm-input" name="name" maxlength="200" placeholder="Bank name" aria-label="Bank name" autocomplete="off">
      <input class="sm-input" name="ifsc_prefix" maxlength="10" placeholder="IFSC prefix, for example HDFC" aria-label="IFSC prefix" autocomplete="off">
      <input class="sm-input" name="branch" maxlength="200" placeholder="Branch (optional)" aria-label="Branch" autocomplete="off">
      <button class="sm-btn sm-btn--primary" type="submit">Add</button></form>` : ''}
    ${rows.length ? `<table class="sm-tbl"><thead><tr><th>Bank</th><th>IFSC prefix</th><th>Branch</th><th class="num">Receipts</th><th></th></tr></thead><tbody>
      ${rows.map((r) => { const n = used[r.id] || 0; return `<tr data-row><td>${esc(r.name)}</td><td class="mono">${esc(r.ifsc_prefix || '-')}</td><td class="sm-muted">${esc(r.branch || '-')}</td>
        <td class="num">${n || '<span class="sm-muted">-</span>'}</td>
        <td class="act">${rowActions('bank', r.id, { canEdit, canDelete: canDel, deleteTitle: n ? `Clearing bank on ${n} receipt(s)` : '' })}</td></tr>`; }).join('')}
      </tbody></table>` : SM.empty('No banks yet', 'Add a bank above.')}
  </div>`;
  SM.wire(root, SM.bankAction);
  const form = root.querySelector('#sm-add');
  if (form) form.onsubmit = async (e) => {
    e.preventDefault();
    const body = {};
    [...form.elements].forEach((el) => { if (el.name) body[el.name] = el.value.trim(); });
    if (!body.name) { form.elements.name.focus(); return; }
    if (await SM.run(() => Api.post(SM.EP.banks, body), 'Bank added')) { await SM.reload('banks'); document.querySelector('#sm-add [name=name]')?.focus(); }
  };
};

SM.bankAction = async (kind, id, act) => {
  const row = SM.d.banks.find((r) => r.id === id);
  if (act === 'del') return SM.deleteItem(SM.EP.banks, id, row.name, ['banks']);
  SM.openForm({
    title: 'Edit bank', values: row, submit: 'Save changes',
    fields: [{ key: 'name', label: 'Bank name', required: true, maxlength: 200 },
      { key: 'ifsc_prefix', label: 'IFSC prefix', maxlength: 10, hint: 'First four letters of the IFSC code' },
      { key: 'branch', label: 'Branch', maxlength: 200 }],
    onSubmit: async (v) => { await Api.put(`${SM.EP.banks}/${id}`, v); Utils.success('Saved'); await SM.reload('banks'); },
  });
};

})();
