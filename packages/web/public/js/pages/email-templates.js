// ROF CRM — Email Templates Page

Pages.emailTemplates = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <style>
      .emt { --bg2:var(--surface2); --text1:var(--text); max-width:1360px; margin-left:auto; margin-right:auto }
      .emt .tabs-line { display:flex; gap:8px; flex-wrap:wrap; border-bottom:none; margin-bottom:16px }
      .emt .tab-line { padding:7px 16px; font-size:12.5px; border:1px solid var(--border2); border-radius:999px; background:var(--surface); color:var(--text2); cursor:pointer; transition:.15s }
      .emt .tab-line:hover { border-color:var(--teal); color:var(--teal) }
      .emt .tab-line.active { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600 }
      .emt .sp { border-radius:10px; overflow:hidden }
      .emt .sp-hdr { padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      .emt .sp-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .emt .sp-body { padding:18px }
      .emt .fg { gap:6px }
      .emt .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      .emt .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .emt .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .emt .btn-teal, .emt .btn-fetch { background:var(--teal) !important; color:#fff !important; border:none; padding:9px 22px; border-radius:8px; font-size:12.5px; font-weight:600; min-height:38px; cursor:pointer }
      .emt .btn-teal:hover, .emt .btn-fetch:hover { filter:brightness(.92) }
      .emt .btn-teal.btn-sm { min-height:30px; padding:5px 14px; font-size:12px; border-radius:6px }
      .emt .btn-ghost { border-radius:8px; min-height:38px; padding:9px 18px; font-size:12.5px }
      .emt .btn-ghost.btn-sm { min-height:30px; padding:5px 12px; font-size:12px; border-radius:6px }
      .emt .btn-ghost.active { background:var(--teal-bg); color:var(--teal); border-color:var(--teal) }
      .emt .tbl-hdr { background:var(--teal-bg); border:1px solid var(--border2); border-radius:10px; padding:12px 18px; flex-wrap:wrap }
      .emt .tbl-wrap > .tbl-hdr { border:none; border-bottom:1px solid var(--border); border-radius:0 }
      .emt .tbl-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .emt .tbl-actions { margin-left:auto; display:flex; gap:8px; flex-wrap:wrap }
      .emt .tbl-wrap { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:auto }
      .emt table { width:100%; border-collapse:collapse; font-size:12.5px }
      .emt table th { background:var(--surface2); color:var(--text3); font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; padding:10px 14px; text-align:left; white-space:nowrap; border-bottom:1px solid var(--border2) }
      .emt table td { padding:9px 14px; border-bottom:1px solid var(--border); color:var(--text) }
      .emt table tbody tr:hover td { background:var(--surface2) }
      .emt .kpi { border:1px solid var(--border2); border-left:3px solid var(--teal); border-radius:10px }
      .emt .empty-state { padding:36px 18px; text-align:center; color:var(--text3) }
      .emt .empty-state h3 { font-size:14px; font-weight:600; color:var(--text2); margin:0 0 4px }
      .emt .btg-item { border-radius:8px }
    </style>
    <style>
      .emt code { background:var(--surface2); color:var(--teal); padding:1px 6px; border-radius:4px; font-size:11px }
      .emt #et-list { background:var(--surface); border:1px solid var(--border2); border-radius:10px; padding:8px }
      .emt .emt-cols { display:grid; grid-template-columns:280px 1fr; gap:16px; align-items:start }
      @media (max-width:900px) { .emt .emt-cols { grid-template-columns:minmax(0,1fr) } }
    </style>
    <div class="emt">
    <div class="page-hdr">
      <h1>Email Templates</h1>
      <div class="breadcrumb">CRM / <b>Email Templates</b></div>
    </div>
    <div class="tbl-hdr" style="margin-bottom:12px">
      <div class="tbl-title">Templates</div>
      <div class="tbl-actions">
        <input class="fc" id="et-search" placeholder="Search name or subject" style="width:200px;min-height:30px;padding:5px 10px" oninput="EmailTemplatesPage.search()">
        <select class="fc" id="et-filter-type" style="width:170px;min-height:30px;padding:5px 10px" onchange="EmailTemplatesPage.load()">
          <option value="">All types</option>
          <option value="general">General</option>
          <option value="allotment_letter">Allotment Letter</option>
          <option value="demand_letter">Demand Letter</option>
          <option value="payment_receipt">Payment Receipt</option>
          <option value="welcome">Welcome Email</option>
          <option value="reminder">Payment Reminder</option>
        </select>
        <button class="btn btn-teal btn-sm" onclick="EmailTemplatesPage.showEditor()">+ Create Template</button>
        <button class="btn btn-ghost btn-sm" onclick="EmailTemplatesPage.load()">Refresh</button>
      </div>
    </div>

    <div class="emt-cols">
      <!-- Template list -->
      <div>
        <div id="et-list"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>

      <!-- Editor / Preview -->
      <div class="sp" id="et-editor-panel" style="display:none">
        <div class="sp-hdr">
          <input class="fc" id="et-name" placeholder="Template name" style="flex:1;margin-right:8px">
          <select class="fc" id="et-type" style="width:180px">
            <option value="general">General</option>
            <option value="allotment_letter">Allotment Letter</option>
            <option value="demand_letter">Demand Letter</option>
            <option value="payment_receipt">Payment Receipt</option>
            <option value="welcome">Welcome Email</option>
            <option value="reminder">Payment Reminder</option>
          </select>
        </div>
        <div class="sp-body">
          <div class="fg" style="margin-bottom:8px"><label class="fl">Subject Line</label>
            <input class="fc" id="et-subject" placeholder="Email subject">
          </div>
          <div class="fg" style="margin-bottom:8px"><label class="fl">Body</label>
            <textarea class="fc" id="et-body" rows="12" placeholder="Email body. Use {{consumer_name}}, {{unit_number}}, {{amount}}, {{due_date}}, {{project_name}} as merge fields."></textarea>
          </div>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:10px;cursor:pointer"><input type="checkbox" id="et-active" checked> Active</label>
          <div style="font-size:11px;color:var(--text3);margin-bottom:10px">
            Available merge fields: <code>{{consumer_name}}</code> <code>{{unit_number}}</code> <code>{{amount}}</code> <code>{{due_date}}</code> <code>{{project_name}}</code> <code>{{allotment_date}}</code>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-teal" onclick="EmailTemplatesPage.save()">Save Template</button>
            <button class="btn btn-ghost" onclick="EmailTemplatesPage.preview()">Preview</button>
            <button class="btn btn-ghost" id="et-delete" style="margin-left:auto;color:var(--red)" onclick="EmailTemplatesPage.delete()">Delete</button>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:10px">Templates are wording only. No email sender is connected yet, so nothing is sent from here.</div>
          <div id="et-preview" style="display:none;margin-top:14px;border:1px dashed var(--border2);border-radius:8px;padding:14px"></div>
        </div>
      </div>

      <!-- Empty state -->
      <div id="et-empty-editor" style="display:flex;align-items:center;justify-content:center">
        <div class="empty-state">
          <h3>Select or create a template</h3>
          <p>Click a template from the list to edit it, or create a new one.</p>
        </div>
      </div>
    </div>
    </div>
  `;

  await EmailTemplatesPage.load();
};

const EmailTemplatesPage = {
  _activeId: null,
  _list: [],
  _timer: null,
  _SAMPLE: { consumer_name: 'Mr. Rajesh Kumar', unit_number: 'A-304', project_name: 'Sample Project', amount: '2,45,000', due_date: '15 May 2026', allotment_date: '01 Apr 2026' },

  search() { clearTimeout(this._timer); this._timer = setTimeout(() => this.load(), 300); },

  async load() {
    const el = document.getElementById('et-list');
    if (!el) return;
    try {
      const params = { pageSize: 200 };
      const q = document.getElementById('et-search')?.value?.trim(); if (q) params.q = q;
      const type = document.getElementById('et-filter-type')?.value; if (type) params.type = type;
      const res = await Api.get('/email-templates', { params });
      if (!document.getElementById('et-list')) return;
      this._list = res.data || [];
      el.innerHTML = this._list.length === 0
        ? '<div style="padding:14px;font-size:12px;color:var(--text3)">No template matches.</div>'
        : this._list.map(t => `
        <div class="et-item" data-id="${Utils.esc(t.id)}" style="padding:10px 12px;border:1px solid ${this._activeId===t.id?'var(--teal)':'var(--border)'};cursor:pointer;border-radius:8px;margin-bottom:6px;background:${this._activeId===t.id?'var(--teal-bg)':'var(--surface)'}${t.is_active?'':';opacity:.6'}"
          onclick="EmailTemplatesPage.select('${Utils.esc(t.id)}')">
          <div style="font-weight:600;font-size:12px">${Utils.esc(t.name || '—')}</div>
          <div style="margin-top:3px">${Utils.chip(t.template_type || 'general')}</div>
          ${t.is_system ? '<span style="font-size:9px;color:var(--text3)">Starting template</span> ' : ''}${t.is_active ? '' : '<span style="font-size:9px;color:var(--red)">Inactive</span>'}
        </div>`).join('');
    } catch (err) {
      el.innerHTML = `<div style="padding:12px;color:var(--red);font-size:11px">${Utils.esc(err.message)}</div>`;
    }
  },

  _show(t) {
    document.getElementById('et-empty-editor').style.display = 'none';
    document.getElementById('et-editor-panel').style.display = 'block';
    document.getElementById('et-name').value = t.name || '';
    document.getElementById('et-type').value = t.template_type || 'general';
    document.getElementById('et-subject').value = t.subject || '';
    document.getElementById('et-body').value = t.body || '';
    document.getElementById('et-active').checked = t.is_active !== false;
    document.getElementById('et-delete').disabled = !t.id || !!t.is_system;
    document.getElementById('et-preview').style.display = 'none';
  },

  async select(id) {
    try {
      const res = await Api.get(`/email-templates/${id}`);   // the stored wording, not a copy from the list
      this._activeId = id;
      this._show(res.data);
      this.load();
    } catch (err) { Utils.error(err.message); }
  },

  showEditor() {
    this._activeId = null;
    this._show({ template_type: 'general', is_active: true });
    this.load();
  },

  async save() {
    const name = document.getElementById('et-name')?.value?.trim();
    const subject = document.getElementById('et-subject')?.value?.trim();
    const body = document.getElementById('et-body')?.value?.trim();
    if (!name) { Utils.warn('Please enter a template name'); return; }
    if (!body) { Utils.warn('Please enter the body of the email'); return; }
    const payload = { name, subject, body, templateType: document.getElementById('et-type').value, isActive: document.getElementById('et-active').checked };
    try {
      if (this._activeId) {
        await Api.patch(`/email-templates/${this._activeId}`, payload);
      } else {
        const res = await Api.post('/email-templates', payload);
        this._activeId = res.data.id;
        document.getElementById('et-delete').disabled = false;
      }
      Utils.success('Template saved');
      await this.load();
    } catch (err) { Utils.error(err.message); }
  },

  // the sample values are filled in and everything is shown as text, so a "<" typed in the body cannot run as markup
  preview() {
    const fill = (t) => t.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k) => this._SAMPLE[k] ?? m);
    const box = document.getElementById('et-preview');
    box.innerHTML = '<div style="font-size:11px;color:var(--text3);margin-bottom:6px">Preview with sample values</div><div id="et-pv-sub" style="font-weight:600;margin-bottom:8px"></div><pre id="et-pv-body" style="white-space:pre-wrap;font-family:inherit;margin:0"></pre>';
    box.querySelector('#et-pv-sub').textContent = fill(document.getElementById('et-subject').value || '(no subject)');
    box.querySelector('#et-pv-body').textContent = fill(document.getElementById('et-body').value || '');
    box.style.display = 'block';
  },

  async delete() {
    if (!this._activeId) { Utils.info('This template is not saved yet'); return; }
    Utils.confirm('Delete this template?', async () => {
      try {
        await Api.delete(`/email-templates/${this._activeId}`);
        Utils.success('Template deleted');
        this._activeId = null;
        document.getElementById('et-editor-panel').style.display = 'none';
        document.getElementById('et-empty-editor').style.display = 'flex';
        await this.load();
      } catch (err) { Utils.error(err.message); }
    });
  },
};
