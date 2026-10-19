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
SM.dispatchQuery = SM.dispatchQuery || { q: '', from: '', to: '' };

SM.screens.dispatch = async (root) => {
  const canAdd = SM.can('create'), canEdit = SM.can('edit'), canDel = SM.can('delete');
  root.innerHTML = '<div class="sm-panel"><div class="sm-empty">Loading...</div></div>';
  const fq = SM.dispatchQuery;
  const load = async (page) => {
    const res = await Api.get('/master/document-dispatch', { params: { ...fq, page, pageSize: 50 } });
    return { rows: res.data || [], more: !!res.has_more };
  };
  let first;
  try { first = await load(1); } catch (e) { root.innerHTML = SM.empty('Could not load', e.message); return; }
  if (SM.screen !== 'dispatch') return;
  let rows = first.rows, more = first.more, page = 1;
  SM.d.dispatch = rows;
  const names = [...new Set([...(SM.d.doctypes || []).map((t) => t.name)])];
  const rowHtml = (r) => `<tr data-row><td class="mono">${esc(Utils.date(r.dispatched_at || r.created_at))}</td><td>${esc(r.document_type || '-')}</td>
        <td><span class="sm-tag">${esc(r.dispatch_mode || '-')}</span></td><td class="mono">${esc(r.tracking_no || '-')}</td>
        <td>${esc(r.consumer_name || '-')}</td>
        <td class="act">${canEdit ? `<button class="sm-btn sm-btn--quiet" data-act="edit" data-kind="dispatch" data-id="${esc(r.id)}">Edit</button>` : ''}
          ${canDel ? `<button class="sm-btn sm-btn--quiet sm-btn--danger" data-act="del" data-kind="dispatch" data-id="${esc(r.id)}">Delete</button>` : ''}</td></tr>`;
  root.innerHTML = `<div class="sm-panel">
    <div class="sm-panel-h"><div><div class="sm-panel-t">Dispatch log</div>
      <div class="sm-panel-s">Proof that a notice or letter was sent, newest first.</div></div></div>
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
          <input class="sm-input" id="dd-date" name="dispatched_at" type="date" max="${esc(Utils.today())}" value="${esc(Utils.today())}"></div>
        <div class="sm-field" style="align-self:end"><button class="sm-btn sm-btn--primary" type="submit">Log dispatch</button></div>
      </div><div class="sm-err" id="dd-err" role="alert"></div></form>` : ''}
    <div class="sm-addrow multi" style="grid-template-columns:2fr 1fr 1fr auto;align-items:end">
      <div><label class="sm-label" for="df-q">Search</label><input class="sm-input" id="df-q" value="${esc(fq.q)}" placeholder="Document, tracking number or consumer"></div>
      <div><label class="sm-label" for="df-from">From</label><input class="sm-input" type="date" id="df-from" value="${esc(fq.from)}"></div>
      <div><label class="sm-label" for="df-to">To</label><input class="sm-input" type="date" id="df-to" value="${esc(fq.to)}"></div>
      <button class="sm-btn" id="df-go">Search</button></div>
    <div id="dd-list">${rows.length ? `<table class="sm-tbl"><thead><tr><th>Date</th><th>Document</th><th>Mode</th><th>Tracking</th><th>Consumer</th><th></th></tr></thead><tbody id="dd-rows">${rows.map(rowHtml).join('')}</tbody></table>
      ${more ? '<div style="padding:12px 16px"><button class="sm-btn" id="dd-more">Load more</button></div>' : ''}` : SM.empty('No dispatches found', canAdd ? 'Log the first one above.' : 'Nothing matches.')}</div>
  </div>`;
  const go = () => { Object.assign(fq, { q: root.querySelector('#df-q').value.trim(), from: root.querySelector('#df-from').value, to: root.querySelector('#df-to').value }); SM.paint(); };
  root.querySelector('#df-go').onclick = go;
  root.querySelector('#df-q').onkeydown = (e) => { if (e.key === 'Enter') go(); };
  const moreBtn = root.querySelector('#dd-more');
  if (moreBtn) moreBtn.onclick = async () => {
    moreBtn.disabled = true;
    try {
      const next = await load(++page);
      rows = rows.concat(next.rows); SM.d.dispatch = rows;
      root.querySelector('#dd-rows').insertAdjacentHTML('beforeend', next.rows.map(rowHtml).join(''));
      if (!next.more) moreBtn.remove(); else moreBtn.disabled = false;
    } catch (e) { Utils.error(e.message); moreBtn.disabled = false; }
  };
  SM.wire(root, async (kind, id, act) => {
    const row = rows.find((r) => r.id === id);
    if (act === 'del') {
      const yes = await SM.ask({ title: 'Delete this dispatch entry?', text: 'This cannot be undone. The change is recorded in the audit log.' });
      if (yes && await SM.run(() => Api.delete(`/master/document-dispatch/${id}`), 'Deleted')) SM.paint();
    }
    if (act === 'edit') SM.openForm({
      title: 'Edit dispatch', submit: 'Save changes',
      values: { document_type: row.document_type, dispatch_mode: row.dispatch_mode, tracking_no: row.tracking_no || '', dispatched_at: String(row.dispatched_at || '').slice(0, 10) },
      fields: [
        { key: 'document_type', label: 'Document', required: true, maxlength: 150 },
        { key: 'dispatch_mode', label: 'Mode', type: 'select', required: true, options: MODES.map((m) => ({ value: m, label: m })) },
        { key: 'tracking_no', label: 'Tracking number', maxlength: 100 },
        { key: 'dispatched_at', label: 'Date dispatched', placeholder: 'YYYY-MM-DD' },
      ],
      onSubmit: async (v) => { await Api.put(`/master/document-dispatch/${id}`, { ...v, tracking_no: v.tracking_no || null, dispatched_at: v.dispatched_at || null }); Utils.success('Saved'); SM.paint(); },
    });
  });
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
