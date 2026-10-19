// ROF CRM — Customized Letters: letter templates, making a letter for an applicant, and the register.
// Uses the Set Master pieces (SM.search, SM.filter, SM.empty, SM.ask, SM.run, SM.openForm) and its stylesheet.

const CLX = { screen: 'letters', can: {}, vars: null, editor: null, form: null };
const cx = (s) => Utils.esc(s);

CLX.NAV = [
  { id: 'letters', label: 'Letters' },
  { id: 'make', label: 'Make a Letter' },
  { id: 'register', label: 'Register' },
];

Pages.customLetters = async function (params = {}) {
  CLX.destroyEditor();
  CLX.screen = CLX.NAV.some((n) => n.id === params.tab) ? params.tab : 'letters';
  CLX.pick = params.letter || null;
  const rail = CLX.NAV.map((n) => `<button class="sm-rail-item${n.id === CLX.screen ? ' on' : ''}" onclick="Router.navigate('/custom-letters',{tab:'${n.id}'})"><span>${cx(n.label)}</span></button>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="sm-head"><h1>Customized Letters</h1><p>Letter templates for each project, the letters made from them, and the register of every letter.</p></div>
    <div class="sm"><nav class="sm-rail" aria-label="Customized Letters sections">${rail}</nav><section id="sm-main"><div class="sm-empty">Loading...</div></section></div>`;
  await CLX.screens[CLX.screen](document.getElementById('sm-main'));
};

CLX.fail = (el, e) => { el.innerHTML = SM.empty('Could not load', e.message); };
CLX.tag = (t, kind) => `<span class="sm-tag${kind ? ' sm-tag--' + kind : ''}">${cx(t)}</span>`;
CLX.destroyEditor = () => { try { CLX.editor?.destroy?.(); } catch { /* the page is going away */ } CLX.editor = null; };

CLX.screens = {};

// ---------------------------------------------------------------------------
// Letters (templates)
// ---------------------------------------------------------------------------
CLX.screens.letters = async (el) => {
  let res, projects;
  try { [res, projects] = await Promise.all([Api.get('/custom-letters'), Api.get('/projects')]); } catch (e) { return CLX.fail(el, e); }
  CLX.list = res.data || []; CLX.can = res.can || {};
  CLX.projects = projects.data || projects || [];
  el.innerHTML = `
    <div class="sm-panel">
      <div class="sm-panel-h">
        <div><div class="sm-panel-t">Letters</div><div class="sm-panel-s">${SM.plural(CLX.list.length, 'letter template')}. Each belongs to one project.</div></div>
        <div class="sm-tools">
          <select class="sm-input" id="cl-f-project" style="width:auto" aria-label="Project" onchange="CLX.filterList()"><option value="">All projects</option>${CLX.projects.map((p) => `<option value="${cx(p.id)}">${cx(p.name)}</option>`).join('')}</select>
          ${SM.search('letters', 'Search letters')}
          ${CLX.can.canManage ? '<button class="sm-btn sm-btn--primary" data-act="new">New letter</button>' : ''}
        </div>
      </div>
      ${CLX.list.length ? `<div class="sm-scroll" style="max-height:none"><table class="sm-tbl"><thead><tr><th>Letter</th><th>Project</th><th>Kind</th><th class="num">Version</th><th class="num">Made</th><th>Updated</th><th></th></tr></thead><tbody>
        ${CLX.list.map((l) => { const m = l.letter_meta || {}; return `<tr data-row data-project="${cx(l.project_id)}">
          <td><b>${cx(l.name)}</b><div class="sm-muted" style="font-size:12px">${cx(m.subject || '')}</div></td>
          <td>${cx(l.project_name || '')}</td>
          <td>${CLX.tag(m.letter_type || 'Other', 'info')} ${CLX.tag(m.letter_for || 'All')}${m.is_ref_no ? ' ' + CLX.tag('Ref. no.') : ''}</td>
          <td class="num">v${l.version_number || 1}</td><td class="num">${l.letters_made}</td>
          <td class="sm-muted">${cx(Utils.date(l.updated_at || l.created_at))}</td>
          <td class="act">${CLX.can.canGenerate ? `<button class="sm-btn sm-btn--quiet" data-act="make" data-id="${cx(l.id)}">Make letter</button>` : ''}
            ${CLX.can.canEdit ? `<button class="sm-btn sm-btn--quiet" data-act="edit" data-id="${cx(l.id)}">Edit</button>` : ''}
            ${CLX.can.canDelete ? `<button class="sm-btn sm-btn--quiet sm-btn--danger" data-act="del" data-id="${cx(l.id)}">Delete</button>` : ''}</td></tr>`; }).join('')}
      </tbody></table></div>` : SM.empty('No letters yet', CLX.can.canManage ? 'Create the first letter template for a project.' : 'Ask an admin to create letter templates.')}
    </div>`;
  const s = el.querySelector('.sm-search');
  if (s) s.oninput = () => CLX.filterList();
  el.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const l = CLX.list.find((x) => x.id === b.dataset.id);
    if (b.dataset.act === 'new') CLX.openEditor(null);
    if (b.dataset.act === 'edit') CLX.openEditor(l.id);
    if (b.dataset.act === 'make') Router.navigate('/custom-letters', { tab: 'make', letter: l.id });
    if (b.dataset.act === 'del') {
      const used = l.letters_made ? ` ${SM.plural(l.letters_made, 'letter')} made from it stay in the register.` : '';
      if (await SM.ask({ title: `Delete ${l.name}?`, text: `The template is removed.${used} This cannot be undone.` })
        && await SM.run(() => Api.delete(`/custom-letters/${l.id}`), 'Letter deleted')) Pages.customLetters({ tab: 'letters' });
    }
  };
};

CLX.filterList = () => {
  const root = document.getElementById('sm-main');
  const q = root.querySelector('.sm-search').value.trim().toLowerCase();
  const p = document.getElementById('cl-f-project').value;
  root.querySelectorAll('[data-row]').forEach((r) => { r.style.display = (!q || r.textContent.toLowerCase().includes(q)) && (!p || r.dataset.project === p) ? '' : 'none'; });
};

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------
CLX.seg = (key, options, value) => `<div class="sm-seg" role="group" aria-label="${cx(key)}" data-seg="${key}">${options.map((o) =>
  `<button type="button" data-v="${cx(o.v)}" class="${String(o.v) === String(value) ? 'on' : ''}">${cx(o.t)}</button>`).join('')}</div>`;

CLX.loadEditorScript = () => new Promise((resolve) => {
  if (window.ClassicEditor) return resolve(true);
  const s = document.createElement('script');
  s.src = 'https://cdn.ckeditor.com/ckeditor5/41.4.2/classic/ckeditor.js';
  s.onload = () => resolve(true); s.onerror = () => resolve(false);
  document.head.appendChild(s);
});

CLX.openEditor = async (id) => {
  const el = document.getElementById('sm-main');
  el.innerHTML = '<div class="sm-empty">Loading...</div>';
  let l = null;
  try {
    if (id) l = (await Api.get(`/custom-letters/${id}`)).data;
    if (!CLX.vars) CLX.vars = (await Api.get('/custom-letters/variables')).data;
  } catch (e) { return CLX.fail(el, e); }
  const m = (l && l.letter_meta) || {};
  const f = CLX.form = {
    header_type: m.header_type || 'Own Header', letter_for: m.letter_for || 'All', letter_type: m.letter_type || 'Other',
    is_ref_no: !!m.is_ref_no, is_duplicate: !!m.is_duplicate,
  };
  const ok = await CLX.loadEditorScript();
  el.innerHTML = `
    <div class="sm-panel">
      <div class="sm-panel-h"><div><div class="sm-panel-t">${l ? 'Edit letter' : 'New letter'}</div><div class="sm-panel-s">Click a variable on the right to put it in the letter. It is filled in for each applicant.</div></div>
        <div class="sm-tools"><button class="sm-btn" id="cle-cancel">Cancel</button><button class="sm-btn sm-btn--primary" id="cle-save">${l ? 'Save changes' : 'Save letter'}</button></div></div>
      <div class="sm-panel-b" style="display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:20px;align-items:start">
        <div>
          <div class="sm-grid2">
            <div class="sm-field"><label class="sm-label" for="cle-project">Project <i>*</i></label><select class="sm-input" id="cle-project"><option value="">Select</option>${CLX.projects.map((p) => `<option value="${cx(p.id)}"${l && l.project_id === p.id ? ' selected' : ''}>${cx(p.name)}</option>`).join('')}</select></div>
            <div class="sm-field"><label class="sm-label" for="cle-name">Letter name <i>*</i></label><input class="sm-input" id="cle-name" maxlength="150" value="${cx(l?.name || '')}" placeholder="Welcome letter"></div>
          </div>
          <div class="sm-field"><label class="sm-label" for="cle-subject">Subject <i>*</i></label><input class="sm-input" id="cle-subject" maxlength="255" value="${cx(m.subject || '')}"></div>
          <div class="sm-grid3">
            <div class="sm-field"><span class="sm-label">Letter for</span>${CLX.seg('letter_for', ['All', 'Loan', 'Self'].map((v) => ({ v, t: v })), f.letter_for)}<div class="sm-hint">Loan or Self letters are made only for those bookings.</div></div>
            <div class="sm-field"><span class="sm-label">Letter type</span>${CLX.seg('letter_type', ['Other', 'PTM', 'TPA'].map((v) => ({ v, t: v })), f.letter_type)}</div>
            <div class="sm-field"><span class="sm-label">Header</span>${CLX.seg('header_type', [{ v: 'Own Header', t: 'Own letterhead' }, { v: 'Computer Generated', t: 'Computer made' }], f.header_type)}</div>
          </div>
          <div class="sm-grid3">
            <div class="sm-field"><label class="sm-label" for="cle-width">Blank space at top (px)</label><input class="sm-input" id="cle-width" type="number" min="0" max="500" value="${cx(m.header_width || '70')}"><div class="sm-hint">For printing on a letterhead. Not used for a computer made header.</div></div>
            <div class="sm-field"><span class="sm-label">Reference number</span>${CLX.seg('is_ref_no', [{ v: 'false', t: 'No' }, { v: 'true', t: 'Yes' }], String(f.is_ref_no))}<div class="sm-hint">Numbered by year: PREFIX/2026-27/0001.</div></div>
            <div class="sm-field"><label class="sm-label" for="cle-prefix">Reference prefix</label><input class="sm-input" id="cle-prefix" maxlength="30" value="${cx(m.prefix_ref || '')}" placeholder="ROF/WEL"></div>
          </div>
          <div class="sm-field"><span class="sm-label">Reprint as duplicate</span>${CLX.seg('is_duplicate', [{ v: 'false', t: 'No' }, { v: 'true', t: 'Yes' }], String(f.is_duplicate))}<div class="sm-hint">Yes: making the same letter again for an applicant keeps the first reference number and marks the copy DUPLICATE.</div></div>
          <div class="sm-field"><label class="sm-label" for="cle-body">Letter <i>*</i></label>
            ${ok ? '' : '<div class="sm-note">The editor could not be loaded (no internet?). Type the letter as plain text or HTML below.</div>'}
            <textarea id="cle-body" class="sm-input" rows="18">${cx(l?.body_html || '')}</textarea></div>
          <div class="sm-err" id="cle-err" role="alert"></div>
        </div>
        <aside><div class="sm-label">Variables</div><div id="cle-vars" style="max-height:640px;overflow:auto;border:1px solid var(--border2);border-radius:6px"></div></aside>
      </div>
    </div>`;
  if (ok) {
    try { CLX.editor = await ClassicEditor.create(el.querySelector('#cle-body'), { toolbar: ['heading', '|', 'bold', 'italic', 'underline', '|', 'bulletedList', 'numberedList', '|', 'alignment', '|', 'link', 'insertTable', 'blockQuote', '|', 'undo', 'redo', '|', 'sourceEditing'] }); }
    catch { CLX.editor = null; }
  }
  el.querySelectorAll('[data-seg]').forEach((g) => { g.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    f[g.dataset.seg] = ['is_ref_no', 'is_duplicate'].includes(g.dataset.seg) ? b.dataset.v === 'true' : b.dataset.v;
    g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  }; });
  el.querySelector('#cle-vars').innerHTML = CLX.vars.map((g) => `<div class="sm-proj"><span>${cx(g.cat)}</span><span class="sm-count">${g.vars.length}</span></div>
    ${g.vars.map((v) => `<button type="button" class="sm-pick" data-var="${cx(v.key)}" style="width:100%;text-align:left;background:none;border:0"><span class="sm-pick-main">${cx(v.label)}<small>{{${cx(v.key)}}}</small></span></button>`).join('')}`).join('');
  el.querySelector('#cle-vars').onclick = (e) => { const b = e.target.closest('[data-var]'); if (b) CLX.insertVar(b.dataset.var); };
  el.querySelector('#cle-cancel').onclick = () => Pages.customLetters({ tab: 'letters' });
  el.querySelector('#cle-save').onclick = () => CLX.save(l);
};

CLX.insertVar = (key) => {
  const token = `{{${key}}}`;
  if (CLX.editor) {
    CLX.editor.model.change((w) => CLX.editor.model.insertContent(w.createText(token)));
    CLX.editor.editing.view.focus();
  } else {
    const t = document.getElementById('cle-body');
    t.setRangeText(token, t.selectionStart, t.selectionEnd, 'end'); t.focus();
  }
};

CLX.save = async (l) => {
  const q = (id) => document.getElementById(id);
  const err = q('cle-err'), btn = q('cle-save');
  const f = CLX.form;
  const body_html = CLX.editor ? CLX.editor.getData() : q('cle-body').value;
  const payload = {
    project_id: q('cle-project').value, name: q('cle-name').value.trim(), subject: q('cle-subject').value.trim(), body_html,
    header_type: f.header_type, header_width: Number(q('cle-width').value || 0), letter_for: f.letter_for, letter_type: f.letter_type,
    is_ref_no: f.is_ref_no, is_duplicate: f.is_duplicate, prefix_ref: q('cle-prefix').value.trim(),
  };
  err.textContent = '';
  if (!payload.project_id) { err.textContent = 'Select the project'; return; }
  if (!payload.name) { err.textContent = 'Letter name is required'; return; }
  if (!payload.subject) { err.textContent = 'Subject is required'; return; }
  btn.disabled = true;
  try {
    if (l) await Api.put(`/custom-letters/${l.id}`, payload); else await Api.post('/custom-letters', payload);
    Utils.success(l ? 'Letter updated' : 'Letter created');
    Pages.customLetters({ tab: 'letters' });
  } catch (e) { err.textContent = e.message; btn.disabled = false; }
};

// ---------------------------------------------------------------------------
// Make a letter
// ---------------------------------------------------------------------------
CLX.screens.make = async (el) => {
  let res;
  try { res = await Api.get('/custom-letters'); } catch (e) { return CLX.fail(el, e); }
  CLX.list = res.data || []; CLX.can = res.can || {};
  if (!CLX.can.canGenerate) { el.innerHTML = SM.empty('No access', 'Your role cannot make letters. Ask an admin.'); return; }
  const byProject = {};
  CLX.list.forEach((l) => (byProject[l.project_name || 'No project'] ||= []).push(l));
  el.innerHTML = `
    <div class="sm-panel">
      <div class="sm-panel-h"><div><div class="sm-panel-t">Make a letter</div><div class="sm-panel-s">Pick the letter and the applicant. The letter is filled in, numbered if it needs a reference, and entered in the register.</div></div></div>
      <div class="sm-panel-b"><div class="sm-grid2">
        <div class="sm-field"><label class="sm-label" for="mk-letter">Letter <i>*</i></label><select class="sm-input" id="mk-letter"><option value="">Select</option>
          ${Object.entries(byProject).map(([p, ls]) => `<optgroup label="${cx(p)}">${ls.map((l) => `<option value="${cx(l.id)}"${CLX.pick === l.id ? ' selected' : ''}>${cx(l.name)}</option>`).join('')}</optgroup>`).join('')}</select></div>
        <div class="sm-field" style="position:relative"><label class="sm-label" for="mk-cons">Applicant <i>*</i></label>
          <input class="sm-input" id="mk-cons" autocomplete="off" placeholder="Type 2 letters of the name"><input type="hidden" id="mk-cid">
          <div id="mk-sug" style="position:absolute;left:0;right:0;top:100%;z-index:5;background:var(--surface);border:1px solid var(--border3);border-radius:6px;display:none;max-height:200px;overflow:auto"></div></div>
      </div>
      <button class="sm-btn sm-btn--primary" id="mk-go">Make letter</button><div class="sm-err" id="mk-err" role="alert"></div></div>
      <div id="mk-out"></div>
    </div>`;
  const box = el.querySelector('#mk-cons'), cid = el.querySelector('#mk-cid'), sug = el.querySelector('#mk-sug');
  let timer;
  box.oninput = () => {
    cid.value = ''; clearTimeout(timer);
    const q = box.value.trim();
    if (q.length < 2) { sug.style.display = 'none'; return; }
    timer = setTimeout(async () => {
      try {
        const r = await Api.get('/consumers', { params: { search: q, pageSize: 8 } });
        const list = r.data || [];
        sug.innerHTML = list.length ? list.map((c) => `<div class="sm-pick" data-id="${cx(c.id)}" data-name="${cx(c.name)}"><span class="sm-pick-main">${cx(c.name)}<small>${cx(c.mobile || '')}</small></span></div>`).join('') : '<div class="sm-empty" style="padding:12px">No match</div>';
        sug.style.display = 'block';
      } catch { sug.style.display = 'none'; }
    }, 250);
  };
  sug.onclick = (e) => { const p = e.target.closest('[data-id]'); if (!p) return; cid.value = p.dataset.id; box.value = p.dataset.name; sug.style.display = 'none'; };
  el.querySelector('#mk-go').onclick = () => CLX.make(el);
};

// The letter is shown in a frame that cannot run scripts, so nothing in it can act on the CRM
CLX.docOf = (html) => `<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#000;background:#fff;margin:28px 44px}
  table{border-collapse:collapse}td,th{border:1px solid #888;padding:4px 8px}img{max-width:100%}
  @media print{body{margin:0}}</style></head><body>${html}</body></html>`;

CLX.make = async (el) => {
  const err = el.querySelector('#mk-err'), out = el.querySelector('#mk-out'), btn = el.querySelector('#mk-go');
  const template = el.querySelector('#mk-letter').value, consumer = el.querySelector('#mk-cid').value;
  err.textContent = ''; out.innerHTML = '';
  if (!template) { err.textContent = 'Select the letter'; return; }
  if (!consumer) { err.textContent = el.querySelector('#mk-cons').value.trim() ? 'Pick the applicant from the list' : 'Select the applicant'; return; }
  btn.disabled = true;
  let r;
  try { r = (await Api.post(`/custom-letters/${template}/generate`, { consumer_id: consumer })).data; }
  catch (e) { err.textContent = e.message; btn.disabled = false; return; }
  btn.disabled = false;
  out.innerHTML = `<div class="sm-panel-b" style="border-top:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
      <div><b>${cx(r.template_name)}</b> for <b>${cx(r.consumer_name)}</b>${r.ref_no ? ` ${CLX.tag('Ref. ' + r.ref_no, 'ok')}` : ''}${r.duplicate ? ' ' + CLX.tag('Duplicate copy', 'warn') : ''}</div>
      <div class="sm-tools"><button class="sm-btn sm-btn--primary" id="mk-print">Print</button>${CLX.can.canManage ? '<button class="sm-btn" id="mk-dispatch">Log dispatch</button>' : ''}</div></div>
    ${r.unresolved.length ? `<div class="sm-note">These variables are not known and were left as written: ${r.unresolved.map((u) => cx('{{' + u + '}}')).join(', ')}. Fix the template.</div>` : ''}
    <iframe id="mk-frame" title="Letter preview" sandbox="allow-same-origin" style="width:100%;height:560px;border:1px solid var(--border2);border-radius:6px;background:#fff"></iframe></div>`;
  const frame = out.querySelector('#mk-frame');
  frame.srcdoc = CLX.docOf(r.html);
  out.querySelector('#mk-print').onclick = () => frame.contentWindow.print();
  out.querySelector('#mk-dispatch')?.addEventListener('click', () => SM.openForm({
    title: 'Log dispatch', submit: 'Log dispatch', values: { dispatched_at: Utils.today() },
    fields: [
      { key: 'dispatch_mode', label: 'Mode', type: 'select', required: true, options: ['Courier', 'Speed Post', 'Registered Post', 'Hand Delivery', 'Email', 'Other'].map((m) => ({ value: m, label: m })) },
      { key: 'tracking_no', label: 'Tracking number', maxlength: 100 },
      { key: 'dispatched_at', label: 'Date dispatched', required: true, placeholder: 'YYYY-MM-DD' },
    ],
    onSubmit: async (v) => {
      await Api.post('/master/document-dispatch', { document_type: r.template_name, dispatch_mode: v.dispatch_mode, tracking_no: v.tracking_no || null, consumer_id: consumer, dispatched_at: v.dispatched_at });
      Utils.success('Dispatch logged');
    },
  }));
};

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------
CLX.reg = { page: 1, rows: [] };

CLX.screens.register = async (el) => {
  el.innerHTML = `
    <div class="sm-panel">
      <div class="sm-panel-h"><div><div class="sm-panel-t">Register</div><div class="sm-panel-s">Every letter made: reference number, applicant, who made it and when.</div></div></div>
      <div class="sm-addrow multi" style="grid-template-columns:2fr 1fr 1fr auto;align-items:end">
        <div><label class="sm-label" for="rg-q">Search</label><input class="sm-input" id="rg-q" placeholder="Reference, applicant or letter"></div>
        <div><label class="sm-label" for="rg-from">From</label><input class="sm-input" type="date" id="rg-from"></div>
        <div><label class="sm-label" for="rg-to">To</label><input class="sm-input" type="date" id="rg-to" value="${cx(Utils.today())}"></div>
        <button class="sm-btn sm-btn--primary" id="rg-go">Show</button>
      </div><div id="rg-body"></div></div>`;
  el.querySelector('#rg-go').onclick = () => CLX.loadRegister(true);
  el.querySelector('#rg-q').onkeydown = (e) => { if (e.key === 'Enter') CLX.loadRegister(true); };
  CLX.loadRegister(true);
};

CLX.loadRegister = async (fresh) => {
  const body = document.getElementById('rg-body');
  if (!body) return;
  if (fresh) CLX.reg = { page: 1, rows: [] };
  const v = (id) => document.getElementById(id).value;
  try {
    const res = await Api.get('/custom-letters/log', { params: { q: v('rg-q'), from: v('rg-from'), to: v('rg-to'), pageSize: 50, page: CLX.reg.page } });
    CLX.reg.rows = CLX.reg.rows.concat(res.data || []);
    CLX.reg.more = (res.data || []).length === 50;
  } catch (e) { body.innerHTML = SM.empty('Could not load', e.message); return; }
  body.innerHTML = CLX.reg.rows.length ? `<div class="sm-scroll" style="max-height:none"><table class="sm-tbl"><thead><tr><th>Date</th><th>Reference</th><th>Letter</th><th>Applicant</th><th>Project</th><th>Made by</th></tr></thead><tbody>
    ${CLX.reg.rows.map((r) => `<tr><td class="sm-muted">${cx(Utils.dateTime(r.generated_at))}</td><td class="sm-mono">${cx(r.ref_no || '—')}${r.is_duplicate ? ' ' + CLX.tag('Duplicate', 'warn') : ''}</td>
      <td>${cx(r.template_name)}</td><td>${cx(r.consumer_name)}</td><td class="sm-muted">${cx(r.project_name || '')}</td><td class="sm-muted">${cx(r.generated_by_name || '')}</td></tr>`).join('')}</tbody></table></div>
    ${CLX.reg.more ? '<div style="padding:12px 16px"><button class="sm-btn" onclick="CLX.reg.page++;CLX.loadRegister()">Load more</button></div>' : ''}`
    : SM.empty('No letters yet', 'Letters you make appear here.');
};
