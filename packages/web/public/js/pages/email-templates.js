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
          <div style="font-size:11px;color:var(--text3);margin-bottom:10px">
            Available merge fields: <code>{{consumer_name}}</code> <code>{{unit_number}}</code> <code>{{amount}}</code> <code>{{due_date}}</code> <code>{{project_name}}</code> <code>{{allotment_date}}</code>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-teal" onclick="EmailTemplatesPage.save()">Save Template</button>
            <button class="btn btn-ghost" onclick="EmailTemplatesPage.preview()">Preview</button>
            <button class="btn btn-ghost" style="margin-left:auto;color:var(--red)" onclick="EmailTemplatesPage.delete()">Delete</button>
          </div>
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

  async load() {
    const el = document.getElementById('et-list');
    if (!el) return;
    try {
      const res = await Api.get('/documents/templates', { params: { pageSize: 50 } });
      const list = res.data || res || [];

      // Add built-in system templates if list is empty
      const display = list.length > 0 ? list : [
        { id: '__allotment__', name: 'Allotment Letter', document_type: 'allotment_letter' },
        { id: '__demand__', name: 'Demand Letter', document_type: 'demand_letter' },
        { id: '__receipt__', name: 'Payment Receipt', document_type: 'payment_receipt' },
        { id: '__welcome__', name: 'Welcome Email', document_type: 'welcome' },
      ];

      el.innerHTML = display.map(t => `
        <div style="padding:10px 12px;border:1px solid ${this._activeId===t.id?'var(--teal)':'var(--border)'};cursor:pointer;border-radius:8px;margin-bottom:6px;background:${this._activeId===t.id?'var(--teal-bg)':'var(--surface)'}"
          onclick="EmailTemplatesPage.select('${t.id}','${(t.name||'').replace(/'/g,'\\x27')}','${t.document_type||t.documentType||'general'}')">
          <div style="font-weight:600;font-size:12px">${t.name||'—'}</div>
          <div style="margin-top:3px">${Utils.chip(t.document_type||t.documentType||'general')}</div>
          ${t.id.startsWith('__') ? '<span style="font-size:9px;color:var(--text3)">System template</span>' : ''}
        </div>
      `).join('');
    } catch (err) {
      el.innerHTML = `<div style="padding:12px;color:var(--red);font-size:11px">${err.message}</div>`;
    }
  },

  select(id, name, type) {
    this._activeId = id;
    document.getElementById('et-empty-editor').style.display = 'none';
    document.getElementById('et-editor-panel').style.display = 'block';
    document.getElementById('et-name').value = name;
    const typeSel = document.getElementById('et-type');
    if (typeSel) typeSel.value = type || 'general';

    // Pre-fill system templates
    const defaults = {
      '__allotment__': { subject: 'Allotment Letter - Unit {{unit_number}}', body: 'Dear {{consumer_name}},\n\nCongratulations! You have been allotted Unit {{unit_number}} in {{project_name}}.\n\nAllotment Date: {{allotment_date}}\n\nPlease complete the payment of 20% (₹{{amount}}) within 15 days.\n\nRegards,\nROF Infratech & Housing Pvt. Ltd.' },
      '__demand__': { subject: 'Payment Demand Notice - Unit {{unit_number}}', body: 'Dear {{consumer_name}},\n\nThis is a reminder that your instalment of ₹{{amount}} is due on {{due_date}}.\n\nUnit: {{unit_number}} | Project: {{project_name}}\n\nPlease make the payment to avoid penal interest under HRERA Rule 15.\n\nRegards,\nROF Infratech' },
      '__receipt__': { subject: 'Payment Receipt - ₹{{amount}}', body: 'Dear {{consumer_name}},\n\nWe have received your payment of ₹{{amount}}.\n\nUnit: {{unit_number}} | Project: {{project_name}}\n\nThank you for your timely payment.\n\nRegards,\nROF Infratech' },
      '__welcome__': { subject: 'Welcome to ROF Infratech!', body: 'Dear {{consumer_name}},\n\nWelcome to ROF Infratech & Housing Pvt. Ltd.!\n\nYour application has been registered successfully.\n\nProject: {{project_name}}\n\nFor any queries, contact our support team.\n\nRegards,\nROF Infratech' },
    };

    if (defaults[id]) {
      document.getElementById('et-subject').value = defaults[id].subject;
      document.getElementById('et-body').value = defaults[id].body;
    } else {
      // Could load from API
      document.getElementById('et-subject').value = '';
      document.getElementById('et-body').value = '';
    }

    this.load(); // re-render list to show active state
  },

  showEditor() {
    this._activeId = null;
    document.getElementById('et-empty-editor').style.display = 'none';
    document.getElementById('et-editor-panel').style.display = 'block';
    document.getElementById('et-name').value = '';
    document.getElementById('et-subject').value = '';
    document.getElementById('et-body').value = '';
  },

  async save() {
    const name = document.getElementById('et-name')?.value?.trim();
    const subject = document.getElementById('et-subject')?.value?.trim();
    const body = document.getElementById('et-body')?.value?.trim();
    const type = document.getElementById('et-type')?.value;

    if (!name) { Utils.warn('Please enter a template name'); return; }

    if (this._activeId?.startsWith('__')) {
      Utils.info('System templates cannot be modified. Create a custom template instead.');
      return;
    }

    try {
      if (this._activeId) {
        await Api.patch(`/documents/templates/${this._activeId}`, { name, subject, body: body, documentType: type });
      } else {
        await Api.post('/documents/templates', { name, subject, body: body, documentType: type });
      }
      Utils.success('Template saved');
      await this.load();
    } catch (err) { Utils.error(err.message); }
  },

  preview() {
    const body = document.getElementById('et-body')?.value || '';
    const name = document.getElementById('et-name')?.value || 'Preview';
    const preview = body
      .replace(/{{consumer_name}}/g, 'Mr. Rajesh Kumar')
      .replace(/{{unit_number}}/g, 'A-304')
      .replace(/{{project_name}}/g, 'ROF Aalayas')
      .replace(/{{amount}}/g, '2,45,000')
      .replace(/{{due_date}}/g, '15 May 2026')
      .replace(/{{allotment_date}}/g, '01 Apr 2026');
    const win = window.open('', '_blank');
    if (win) win.document.write(`<html><head><title>${name} - Preview</title></head><body style="font-family:Arial;padding:30px;max-width:600px;margin:0 auto"><h3>${name}</h3><pre style="white-space:pre-wrap;font-family:Arial">${preview}</pre></body></html>`);
  },

  async delete() {
    if (!this._activeId || this._activeId.startsWith('__')) {
      Utils.info('Cannot delete system templates');
      return;
    }
    Utils.confirm('Delete this template?', async () => {
      try {
        await Api.delete(`/documents/templates/${this._activeId}`);
        Utils.success('Template deleted');
        this._activeId = null;
        document.getElementById('et-editor-panel').style.display = 'none';
        document.getElementById('et-empty-editor').style.display = 'flex';
        await this.load();
      } catch (err) { Utils.error(err.message); }
    });
  },
};
