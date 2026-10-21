// ROF CRM — Preferred Location Charges (Set Projects, Charge Master). A rate for each unit location of a project
// (flat, or per sq ft of carpet area) and the location of each unit. Booking offers the amount worked out from these.
// Uses the Set Master pieces (SM.ask, SM.run, SM.empty, SM.openForm). super_admin and project_manager change; everyone else looks.

const PLC = { projects: [], projectId: '', rates: [], locations: [], units: [], picked: new Set(), q: '' };
const pc = (s) => Utils.esc(s);
const rupees = (n) => '₹ ' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const rateText = (r) => (r.rate_type === 'flat' ? `${rupees(r.rate_value)} flat` : `${rupees(r.rate_value)} per sq ft`);

Pages.plcCharges = async function (params = {}) {
  PLC.can = Permissions.isSuperAdmin() || (Auth.getUser() || {}).role === 'project_manager';
  document.getElementById('content').innerHTML = `
    <div class="sm-head"><h1>Preferred Location Charges</h1><p>Units in a better location (park facing, corner, main road) can carry an extra charge. Set the rate for each location, then mark which units are there. Booking offers the amount; it can still be changed there.</p></div>
    <div class="sm"><section id="sm-main" style="grid-column:1/-1"><div class="sm-empty">Loading...</div></section></div>`;
  const el = document.getElementById('sm-main');
  try { PLC.projects = (await Api.get('/projects')).data || []; } catch (e) { return el.innerHTML = SM.empty('Could not load', e.message); }
  if (!PLC.projects.length) return el.innerHTML = SM.empty('No projects yet', 'Create a project first (Set Projects, Create Project).');
  PLC.projectId = PLC.projects.some((p) => p.id === params.project) ? params.project : (PLC.projects.some((p) => p.id === PLC.projectId) ? PLC.projectId : PLC.projects[0].id);
  PLC.picked = new Set();
  await PLC.draw(el);
};

PLC.draw = async (el) => {
  try {
    const [rates, locs, units] = await Promise.all([
      Api.get('/plc-charges', { params: { projectId: PLC.projectId } }), Api.get(`/projects/${PLC.projectId}/unit-locations`), Api.get('/plc-charges/units', { params: { projectId: PLC.projectId } })]);
    PLC.rates = rates.data || []; PLC.locations = locs.data || []; PLC.units = units.data || [];
  } catch (e) { return el.innerHTML = SM.empty('Could not load', e.message); }
  const free = PLC.locations.filter((l) => !PLC.rates.some((r) => r.unit_location_id === l.id));
  const q = PLC.q.trim().toLowerCase();
  const shown = PLC.units.filter((u) => !q || `${u.unit_number} ${u.tower_name} ${u.location_name || ''} ${u.status}`.toLowerCase().includes(q));
  el.innerHTML = `
    <div class="sm-panel">
      <div class="sm-panel-h"><div><div class="sm-panel-t">PLC rates</div><div class="sm-panel-s">${SM.plural(PLC.rates.length, 'rate')} in this project. Locations are made in Set Projects, Project Set Up, Unit Location.</div></div>
        <div class="sm-tools"><select class="sm-input" id="plc-project" style="max-width:320px">${PLC.projects.map((p) => `<option value="${pc(p.id)}"${p.id === PLC.projectId ? ' selected' : ''}>${pc(p.name)}</option>`).join('')}</select>
        ${PLC.can ? `<button class="sm-btn sm-btn--primary" data-act="add"${free.length ? '' : ' disabled title="Every location already has a rate, or there are no locations yet"'}>Add PLC rate</button>` : ''}</div></div>
      ${PLC.rates.length ? `<div class="sm-scroll" style="max-height:none"><table class="sm-tbl"><thead><tr><th>Location</th><th>Charge</th><th>Status</th><th class="num">Units</th><th></th></tr></thead><tbody>
        ${PLC.rates.map((r) => `<tr data-row><td style="font-weight:700">${pc(r.location_name)}</td><td>${rateText(r)}</td>
          <td>${r.is_active ? '<span class="sm-tag sm-tag--ok">On</span>' : '<span class="sm-tag sm-tag--warn">Off</span>'}</td><td class="num">${r.unit_count}</td>
          <td class="act">${PLC.can ? `<button class="sm-btn sm-btn--quiet" data-act="edit" data-id="${pc(r.id)}">Edit</button><button class="sm-btn sm-btn--quiet" data-act="toggle" data-id="${pc(r.id)}">${r.is_active ? 'Turn off' : 'Turn on'}</button><button class="sm-btn sm-btn--quiet sm-btn--danger" data-act="del" data-id="${pc(r.id)}">Remove</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>` : SM.empty('No PLC rates yet', PLC.locations.length ? (PLC.can ? 'Add the first rate for one of the locations.' : 'Ask a project manager to add them.') : 'This project has no unit locations yet. Add them first (Project Set Up, Unit Location).')}
    </div>
    <div class="sm-panel" style="margin-top:14px">
      <div class="sm-panel-h"><div><div class="sm-panel-t">Unit locations</div><div class="sm-panel-s">${SM.plural(PLC.units.length, 'unit')}. Tick units and choose where they are.</div></div>
        <div class="sm-tools"><input class="sm-input" id="plc-q" placeholder="Search units" value="${pc(PLC.q)}" style="max-width:200px">
        ${PLC.can && PLC.locations.length ? `<select class="sm-input" id="plc-loc" style="max-width:220px">${PLC.locations.map((l) => `<option value="${pc(l.id)}">${pc(l.name)}</option>`).join('')}</select>
          <button class="sm-btn sm-btn--primary" data-act="assign">Set for ticked units</button><button class="sm-btn sm-btn--quiet" data-act="clear">Clear location</button>` : ''}</div></div>
      ${shown.length ? `<div class="sm-scroll"><table class="sm-tbl"><thead><tr>${PLC.can ? '<th><input type="checkbox" id="plc-all" aria-label="Tick all shown units"></th>' : ''}<th>Unit</th><th>Tower</th><th class="num">Floor</th><th>Status</th><th>Location</th></tr></thead><tbody>
        ${shown.map((u) => `<tr data-row>${PLC.can ? `<td><input type="checkbox" class="plc-pick" data-id="${pc(u.id)}"${PLC.picked.has(u.id) ? ' checked' : ''}></td>` : ''}<td style="font-weight:700">${pc(u.unit_number)}</td><td>${pc(u.tower_name)}</td><td class="num">${u.floor}</td><td>${pc(u.status.replace(/_/g, ' '))}</td><td>${u.location_name ? pc(u.location_name) : '<span style="color:var(--text3)">none</span>'}</td></tr>`).join('')}
        </tbody></table></div>` : SM.empty(PLC.units.length ? 'No unit matches' : 'No units yet', PLC.units.length ? 'Try another search.' : 'Add units first (Project Set Up, Add Unit).')}
    </div>`;
  el.querySelector('#plc-project').onchange = (e) => { PLC.projectId = e.target.value; PLC.picked = new Set(); PLC.q = ''; PLC.draw(el); };
  const search = el.querySelector('#plc-q');
  search.oninput = () => { PLC.q = search.value; PLC.draw(el).then(() => { const s = document.getElementById('plc-q'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }); };
  const all = el.querySelector('#plc-all');
  if (all) all.onchange = () => { el.querySelectorAll('.plc-pick').forEach((c) => { c.checked = all.checked; all.checked ? PLC.picked.add(c.dataset.id) : PLC.picked.delete(c.dataset.id); }); };
  el.onchange = (e) => { const c = e.target.closest('.plc-pick'); if (c) c.checked ? PLC.picked.add(c.dataset.id) : PLC.picked.delete(c.dataset.id); };
  el.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const rate = PLC.rates.find((r) => r.id === b.dataset.id);
    if (b.dataset.act === 'add') PLC.form(null, free);
    if (b.dataset.act === 'edit') PLC.form(rate, []);
    if (b.dataset.act === 'toggle') SM.run(() => Api.patch(`/plc-charges/${rate.id}`, { isActive: !rate.is_active }), rate.is_active ? 'Rate turned off' : 'Rate turned on').then((ok) => ok && PLC.draw(el));
    if (b.dataset.act === 'del') PLC.remove(rate, el);
    if (b.dataset.act === 'assign') PLC.assign(el, document.getElementById('plc-loc').value);
    if (b.dataset.act === 'clear') PLC.assign(el, null);
  };
};

PLC.form = (rate, free) => SM.openForm({
  title: rate ? `PLC for ${rate.location_name}` : 'Add PLC rate', submit: rate ? 'Save' : 'Add',
  fields: [
    ...(rate ? [] : [{ key: 'unitLocationId', label: 'Location', type: 'select', options: free.map((l) => ({ value: l.id, label: l.name })), required: true }]),
    { key: 'rateType', label: 'Charged as', type: 'select', options: [{ value: 'per_sqft', label: 'Per sq ft of carpet area' }, { value: 'flat', label: 'One fixed amount' }] },
    { key: 'rateValue', label: 'Rate (₹)', required: true, placeholder: 'e.g. 150', hint: 'Up to 2 decimals. Bookings already made keep the amount they were given.' },
  ],
  values: rate ? { rateType: rate.rate_type, rateValue: String(Number(rate.rate_value)) } : { rateType: 'per_sqft', unitLocationId: free[0]?.id },
  onSubmit: async (v) => {
    if (rate) await Api.patch(`/plc-charges/${rate.id}`, { rateType: v.rateType, rateValue: v.rateValue });
    else await Api.post('/plc-charges', { projectId: PLC.projectId, unitLocationId: v.unitLocationId, rateType: v.rateType, rateValue: v.rateValue });
    Utils.success(rate ? 'Rate saved' : 'Rate added');
    PLC.draw(document.getElementById('sm-main'));
  },
});

PLC.remove = async (rate, el) => {
  if (!(await SM.ask({ title: `Remove the PLC rate for ${rate.location_name}?`, text: 'Units keep their location. Bookings already made keep their amount.' }))) return;
  if (await SM.run(() => Api.delete(`/plc-charges/${rate.id}`), 'Rate removed')) PLC.draw(el);
};

PLC.assign = async (el, locationId) => {
  const ids = [...PLC.picked];
  if (!ids.length) return Utils.error('Tick at least one unit first');
  if (await SM.run(() => Api.post('/plc-charges/assign', { projectId: PLC.projectId, unitLocationId: locationId, unitIds: ids }), locationId ? `Location set for ${SM.plural(ids.length, 'unit')}` : 'Location cleared')) { PLC.picked = new Set(); PLC.draw(el); }
};
