// ROF CRM - Set Master: document checklist and dispatch log (screens of set-master.js)

(function () {
'use strict';
const SM = window.SM;
const esc = (s) => Utils.esc(s);

const STAGES = ['On Booking', 'On Allotment', 'On Agreement', 'On Possession', 'On Demand', 'Other'];
const FROM = ['Individual', 'Firm or Company'];
const MODES = ['Courier', 'Speed Post', 'Registered Post', 'Hand Delivery', 'Email', 'Other'];

SM.EP.projects = '/projects';

// ---------------------------------------------------------------------------
// Document checklist
// ---------------------------------------------------------------------------
SM.screens.checklist = (root) => {
  const projects = SM.d.projects || [];
  const types = SM.d.doctypes || [];
  const f = SM.docFilter || (SM.docFilter = '');
  const canAdd = SM.can('create'), canEdit = SM.can('edit'), canDel = SM.can('delete');
  const shown = types.filter((t) => f === '' || (f === 'global' ? !t.project_id : t.project_id === f));
  const groups = {};
  shown.forEach((t) => { (groups[t.project_name || 'All projects'] = groups[t.project_name || 'All projects'] || []).push(t); });
  const names = Object.keys(groups).sort((a, b) => (a === 'All projects' ? -1 : b === 'All projects' ? 1 : a.localeCompare(b)));
  root.innerHTML = `<div class="sm-panel">
    <div class="sm-panel-h">
      <div><div class="sm-panel-t">Document checklist</div>
        <div class="sm-panel-s">Papers a buyer gives, by project and stage.</div></div>
      <div class="sm-tools">
        <select class="sm-input" style="width:auto" aria-label="Project" onchange="SM.docFilter=this.value;SM.paint()">
          <option value="">All projects</option><option value="global"${f === 'global' ? ' selected' : ''}>Global only</option>
          ${projects.map((p) => `<option value="${esc(p.id)}"${f === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        ${SM.search('docs', 'Search')}
        ${canAdd ? '<button class="sm-btn sm-btn--primary" data-act="add" data-kind="doc">Add document</button>' : ''}
      </div></div>
    <div class="sm-note" style="margin:12px 16px 0">This list is a reference today. The Booking screen uses its own fixed document list and does not enforce stage, mandatory or project here.</div>
    ${names.length ? names.map((n) => `<div data-row><div class="sm-proj"><span>${esc(n)}</span><span class="sm-count">${groups[n].length}</span></div>
      <table class="sm-tbl"><thead><tr><th>Document</th><th>Stage</th><th>From</th><th>Mandatory</th><th></th></tr></thead><tbody>
      ${groups[n].map((t) => `<tr data-row><td>${esc(t.name)}${t.description ? `<div class="sm-muted" style="font-size:12px">${esc(t.description)}</div>` : ''}</td>
        <td>${t.required_at ? `<span class="sm-tag sm-tag--info">${esc(t.required_at)}</span>` : '<span class="sm-muted">-</span>'}</td>
        <td>${esc(t.document_from || '-')}</td>
        <td>${t.is_mandatory ? '<span class="sm-tag sm-tag--warn">Mandatory</span>' : '<span class="sm-muted">Optional</span>'}</td>
        <td class="act">${canEdit ? `<button class="sm-btn sm-btn--quiet" data-act="edit" data-kind="doc" data-id="${esc(t.id)}">Edit</button>` : ''}
          ${canDel ? `<button class="sm-btn sm-btn--quiet sm-btn--danger" data-act="del" data-kind="doc" data-id="${esc(t.id)}">Delete</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>`).join('')
      : SM.empty('No documents yet', 'Add the papers a buyer must provide, for example PAN card or Aadhaar card.')}
  </div>`;
  SM.wire(root, SM.docAction);
};

SM.docAction = async (kind, id, act) => {
  const row = (SM.d.doctypes || []).find((t) => t.id === id);
  if (act === 'del') {
    const yes = await SM.ask({ title: `Delete ${row.name}?`, text: 'Dispatch records that use this name block the delete. The change is recorded in the audit log.' });
    if (yes && await SM.run(() => Api.delete(`${SM.EP.doctypes}/${id}`), 'Deleted')) await SM.reload('doctypes');
    return;
  }
  const editing = act === 'edit';
  const values = editing ? { ...row, is_mandatory: row.is_mandatory ? 'yes' : 'no', project_id: row.project_id || '' }
    : { document_from: 'Individual', is_mandatory: 'no', project_id: SM.docFilter && SM.docFilter !== 'global' ? SM.docFilter : '' };
  SM.openForm({
    title: editing ? 'Edit document' : 'Add document', values, submit: editing ? 'Save changes' : 'Add document',
    fields: [
      { key: 'name', label: 'Document name', required: true, maxlength: 150, placeholder: 'PAN card', hint: 'Names are unique across all projects.' },
      { key: 'project_id', label: 'Project', type: 'select', hint: 'Leave blank to apply to every project.', options: (SM.d.projects || []).map((p) => ({ value: p.id, label: p.name })) },
      { key: 'required_at', label: 'Stage', type: 'select', required: true, options: STAGES.map((s) => ({ value: s, label: s })) },
      { key: 'document_from', label: 'Document from', type: 'select', required: true, options: FROM.map((s) => ({ value: s, label: s })) },
      { key: 'is_mandatory', label: 'Mandatory', type: 'select', required: true, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      { key: 'description', label: 'Description', type: 'textarea', maxlength: 500 },
    ],
    onSubmit: async (v) => {
      const body = { ...v, project_id: v.project_id || null, description: v.description || null, is_mandatory: v.is_mandatory === 'yes' };
      if (editing) await Api.put(`${SM.EP.doctypes}/${id}`, body); else await Api.post(SM.EP.doctypes, body);
      Utils.success(editing ? 'Saved' : 'Document added');
      await SM.reload('doctypes');
    },
  });
};

// ---------------------------------------------------------------------------
// Dispatch log
// ---------------------------------------------------------------------------
SM.screens.dispatch = async (root) => {
  const canAdd = SM.can('create'), canDel = SM.can('delete');
  root.innerHTML = '<div class="sm-panel"><div class="sm-empty">Loading...</div></div>';
  const rows = (await SM.get('/master/document-dispatch')) || [];
  if (SM.screen !== 'dispatch') return;
  SM.d.dispatch = rows;
  const names = [...new Set([...(SM.d.doctypes || []).map((t) => t.name)])];
  root.innerHTML = `<div class="sm-panel">
    <div class="sm-panel-h"><div><div class="sm-panel-t">Dispatch log</div>
      <div class="sm-panel-s">Proof that a notice or letter was sent. Latest 100 entries.</div></div>
      <div class="sm-tools">${SM.search('dispatch', 'Search')}</div></div>
    ${canAdd ? `<form id="sm-dispatch-form" class="sm-panel-b" style="border-bottom:1px solid var(--border);background:var(--surface2)" novalidate>
      <div class="sm-grid3">
        <div class="sm-field"><label class="sm-label" for="dd-doc">Document <i>*</i></label>
          <input class="sm-input" id="dd-doc" name="document_type" list="dd-docs" maxlength="150" autocomplete="off" placeholder="Demand letter">
          <datalist id="dd-docs">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist></div>
        <div class="sm-field"><label class="sm-label" for="dd-mode">Mode <i>*</i></label>
          <select class="sm-input" id="dd-mode" name="dispatch_mode"><option value="">Select</option>${MODES.map((m) => `<option>${esc(m)}</option>`).join('')}</select></div>
        <div class="sm-field"><label class="sm-label" for="dd-track">Tracking number</label>
          <input class="sm-input" id="dd-track" name="tracking_no" maxlength="100" autocomplete="off"></div>
        <div class="sm-field" style="position:relative"><label class="sm-label" for="dd-cons">Consumer</label>
          <input class="sm-input" id="dd-cons" autocomplete="off" placeholder="Type 2 letters of the name">
          <input type="hidden" name="consumer_id">
          <div id="dd-sug" style="position:absolute;left:0;right:0;top:100%;z-index:5;background:var(--surface);border:1px solid var(--border3);border-radius:6px;display:none;max-height:200px;overflow:auto"></div></div>
        <div class="sm-field"><label class="sm-label" for="dd-date">Date dispatched</label>
          <input class="sm-input" id="dd-date" name="dispatched_at" type="date" value="${esc(Utils.today())}"></div>
        <div class="sm-field" style="align-self:end"><button class="sm-btn sm-btn--primary" type="submit">Log dispatch</button></div>
      </div><div class="sm-err" id="dd-err" role="alert"></div></form>` : ''}
    ${rows.length ? `<table class="sm-tbl"><thead><tr><th>Date</th><th>Document</th><th>Mode</th><th>Tracking</th><th>Consumer</th><th></th></tr></thead><tbody>
      ${rows.map((r) => `<tr data-row><td class="mono">${esc(Utils.date(r.dispatched_at || r.created_at))}</td><td>${esc(r.document_type || '-')}</td>
        <td><span class="sm-tag">${esc(r.dispatch_mode || '-')}</span></td><td class="mono">${esc(r.tracking_no || '-')}</td>
        <td>${esc(r.consumer_name || '-')}</td>
        <td class="act">${canDel ? `<button class="sm-btn sm-btn--quiet sm-btn--danger" data-act="del" data-kind="dispatch" data-id="${esc(r.id)}">Delete</button>` : ''}</td></tr>`).join('')}
      </tbody></table>` : SM.empty('No dispatches logged', 'Log the first one above.')}
  </div>`;
  SM.wire(root, async (kind, id, act) => {
    if (act !== 'del') return;
    const yes = await SM.ask({ title: 'Delete this dispatch entry?', text: 'This cannot be undone. The change is recorded in the audit log.' });
    if (yes && await SM.run(() => Api.delete(`/master/document-dispatch/${id}`), 'Deleted')) SM.paint();
  });
  root.querySelectorAll('.sm-search').forEach((i) => { i.value = SM.q[i.dataset.q] || ''; if (i.value) SM.filter(i); });
  SM.initDispatchForm(root.querySelector('#sm-dispatch-form'));
};

SM.initDispatchForm = (form) => {
  if (!form) return;
  const box = form.querySelector('#dd-cons'), id = form.elements.consumer_id, sug = form.querySelector('#dd-sug');
  let timer;
  box.oninput = () => {
    id.value = '';
    clearTimeout(timer);
    const q = box.value.trim();
    if (q.length < 2) { sug.style.display = 'none'; return; }
    timer = setTimeout(async () => {
      try {
        const res = await Api.get('/consumers', { params: { search: q, pageSize: 8 } });
        const list = res.data || [];
        sug.innerHTML = list.length ? list.map((c) => `<div class="sm-pick" data-id="${esc(c.id)}" data-name="${esc(c.name)}">
          <span class="sm-pick-main">${esc(c.name)}<small>${esc(c.mobile || '')}</small></span></div>`).join('') : '<div class="sm-empty" style="padding:12px">No match</div>';
        sug.style.display = 'block';
      } catch (e) { sug.style.display = 'none'; }
    }, 250);
  };
  sug.onclick = (e) => {
    const p = e.target.closest('[data-id]');
    if (!p) return;
    id.value = p.dataset.id; box.value = p.dataset.name; sug.style.display = 'none';
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const err = form.querySelector('#dd-err');
    const body = {};
    [...form.elements].forEach((el) => { if (el.name) body[el.name] = el.value.trim(); });
    if (!body.document_type || !body.dispatch_mode) { err.textContent = 'Document and mode are required'; return; }
    if (box.value.trim() && !body.consumer_id) { err.textContent = 'Pick the consumer from the list, or clear the field'; return; }
    err.textContent = '';
    if (await SM.run(() => Api.post('/master/document-dispatch', body), 'Dispatch logged')) SM.paint();
  };
};

})();
