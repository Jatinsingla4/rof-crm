// ROF CRM — Automation Rules Page

Pages.automation = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <style>
      .aut { --bg2:var(--surface2); --text1:var(--text); max-width:1360px; margin-left:auto; margin-right:auto }
      .aut .tabs-line { display:flex; gap:8px; flex-wrap:wrap; border-bottom:none; margin-bottom:16px }
      .aut .tab-line { padding:7px 16px; font-size:12.5px; border:1px solid var(--border2); border-radius:999px; background:var(--surface); color:var(--text2); cursor:pointer; transition:.15s }
      .aut .tab-line:hover { border-color:var(--teal); color:var(--teal) }
      .aut .tab-line.active { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600 }
      .aut .sp { border-radius:10px; overflow:hidden }
      .aut .sp-hdr { padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      .aut .sp-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .aut .sp-body { padding:18px }
      .aut .fg { gap:6px }
      .aut .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      .aut .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .aut .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .aut .btn-teal, .aut .btn-fetch { background:var(--teal) !important; color:#fff !important; border:none; padding:9px 22px; border-radius:8px; font-size:12.5px; font-weight:600; min-height:38px; cursor:pointer }
      .aut .btn-teal:hover, .aut .btn-fetch:hover { filter:brightness(.92) }
      .aut .btn-teal.btn-sm { min-height:30px; padding:5px 14px; font-size:12px; border-radius:6px }
      .aut .btn-ghost { border-radius:8px; min-height:38px; padding:9px 18px; font-size:12.5px }
      .aut .btn-ghost.btn-sm { min-height:30px; padding:5px 12px; font-size:12px; border-radius:6px }
      .aut .btn-ghost.active { background:var(--teal-bg); color:var(--teal); border-color:var(--teal) }
      .aut .tbl-hdr { background:var(--teal-bg); border:1px solid var(--border2); border-radius:10px; padding:12px 18px; flex-wrap:wrap }
      .aut .tbl-wrap > .tbl-hdr { border:none; border-bottom:1px solid var(--border); border-radius:0 }
      .aut .tbl-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .aut .tbl-actions { margin-left:auto; display:flex; gap:8px; flex-wrap:wrap }
      .aut .tbl-wrap { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:auto }
      .aut table { width:100%; border-collapse:collapse; font-size:12.5px }
      .aut table th { background:var(--surface2); color:var(--text3); font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; padding:10px 14px; text-align:left; white-space:nowrap; border-bottom:1px solid var(--border2) }
      .aut table td { padding:9px 14px; border-bottom:1px solid var(--border); color:var(--text) }
      .aut table tbody tr:hover td { background:var(--surface2) }
      .aut .kpi { border:1px solid var(--border2); border-left:3px solid var(--teal); border-radius:10px }
      .aut .empty-state { padding:36px 18px; text-align:center; color:var(--text3) }
      .aut .empty-state h3 { font-size:14px; font-weight:600; color:var(--text2); margin:0 0 4px }
      .aut .btg-item { border-radius:8px }
    </style>
    <style>
      .aut .btg { display:flex; gap:6px; flex-wrap:wrap }
      .aut .modal { display:none }
      .aut .modal[style*="display: block"] { display:block; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:601 }
      .aut input[type=checkbox] { accent-color:var(--teal) }
    </style>
    <div class="aut">
    <div class="page-hdr">
      <h1>Automation</h1>
      <div class="breadcrumb">CRM / <b>Automation Rules</b></div>
    </div>

    <div class="tbl-hdr" style="margin-bottom:12px">
      <div style="display:flex;flex-direction:column;gap:2px">
        <div class="tbl-title">Automation Rules</div>
        <div style="font-size:11px;color:var(--text3)">Rules run automatically when triggers fire. Active rules execute in order.</div>
      </div>
      <div class="tbl-actions">
        <button class="btn btn-teal btn-sm" onclick="AutomationPage.showCreateModal()">+ Create Rule</button>
        <button class="btn btn-ghost btn-sm" onclick="AutomationPage.runAll()">Run All Active</button>
        <button class="btn btn-ghost btn-sm" onclick="AutomationPage.load()">Refresh</button>
      </div>
    </div>

    <!-- Built-in rules summary -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-bottom:16px">
      <div class="sp" style="border-left:3px solid var(--teal)">
        <div class="sp-body" style="padding:10px 12px">
          <div style="font-size:11px;font-weight:600">Demand Reminders</div>
          <div style="font-size:10.5px;color:var(--text3);margin-top:2px">Auto-send demand letters 15/7/3 days before due</div>
          <span class="chip ch-green" style="margin-top:6px;display:inline-block">System</span>
        </div>
      </div>
      <div class="sp" style="border-left:3px solid var(--accent)">
        <div class="sp-body" style="padding:10px 12px">
          <div style="font-size:11px;font-weight:600">Overdue Escalation</div>
          <div style="font-size:10.5px;color:var(--text3);margin-top:2px">Escalate to manager after 7 days overdue</div>
          <span class="chip ch-green" style="margin-top:6px;display:inline-block">System</span>
        </div>
      </div>
      <div class="sp" style="border-left:3px solid var(--blue)">
        <div class="sp-body" style="padding:10px 12px">
          <div style="font-size:11px;font-weight:600">Welcome Message</div>
          <div style="font-size:10.5px;color:var(--text3);margin-top:2px">Send welcome WhatsApp on new lead capture</div>
          <span class="chip ch-green" style="margin-top:6px;display:inline-block">System</span>
        </div>
      </div>
      <div class="sp" style="border-left:3px solid var(--warn)">
        <div class="sp-body" style="padding:10px 12px">
          <div style="font-size:11px;font-weight:600">Allotment Letter</div>
          <div style="font-size:10.5px;color:var(--text3);margin-top:2px">Auto-generate allotment letter on unit allotment</div>
          <span class="chip ch-green" style="margin-top:6px;display:inline-block">System</span>
        </div>
      </div>
    </div>

    <!-- Custom rules table -->
    <div class="tbl-wrap">
      <div class="tbl-hdr"><div class="tbl-title">Custom Rules</div></div>
      <div id="automation-body"><div class="page-loading"><div class="spinner"></div> Loading…</div></div>
    </div>

    <!-- Create Rule Modal -->
    <div class="overlay" id="auto-overlay" onclick="closeOverlay('auto-overlay')"></div>
    <div class="modal" id="auto-modal" style="max-width:560px">
      <div class="modal-hdr">
        <div class="modal-title">Create Automation Rule</div>
        <button class="modal-close" onclick="closeOverlay('auto-overlay');document.getElementById('auto-modal').style.display='none'">✕</button>
      </div>
      <div class="modal-body">
        <div class="fg" style="margin-bottom:8px"><label class="fl"><span class="r">*</span>Rule Name</label>
          <input class="fc" id="auto-name" placeholder="e.g. Send welcome SMS on enquiry">
        </div>
        <div class="fg" style="margin-bottom:8px"><label class="fl"><span class="r">*</span>Trigger</label>
          <select class="fc" id="auto-trigger">
            <option value="">— Select Trigger —</option>
            <option value="lead_created">New Lead Created</option>
            <option value="lead_stage_changed">Lead Stage Changed</option>
            <option value="payment_received">Payment Received</option>
            <option value="payment_overdue">Payment Overdue</option>
            <option value="unit_allotted">Unit Allotted</option>
            <option value="document_uploaded">Document Uploaded</option>
            <option value="task_due">Task Due Today</option>
          </select>
        </div>
        <div class="fg" style="margin-bottom:8px"><label class="fl"><span class="r">*</span>Action</label>
          <select class="fc" id="auto-action">
            <option value="">— Select Action —</option>
            <option value="send_whatsapp">Send WhatsApp Message</option>
            <option value="send_email">Send Email</option>
            <option value="send_sms">Send SMS</option>
            <option value="create_task">Create Task</option>
            <option value="update_stage">Update Lead Stage</option>
            <option value="generate_document">Generate Document</option>
            <option value="notify_manager">Notify Manager</option>
          </select>
        </div>
        <div class="fg" style="margin-bottom:8px"><label class="fl">Message Template</label>
          <textarea class="fc" id="auto-template" rows="3" placeholder="Use {{consumer_name}}, {{unit_number}}, {{amount}} as variables"></textarea>
        </div>
        <div class="fg" style="margin-bottom:12px"><label class="fl">Delay (minutes)</label>
          <input type="number" class="fc" id="auto-delay" value="0" placeholder="0 = immediate">
        </div>
        <button class="btn btn-teal" style="width:100%" onclick="AutomationPage.create()">Create Rule</button>
      </div>
    </div>
    </div>
  `;

  await AutomationPage.load();
};

const AutomationPage = {
  _list: [],

  async load() {
    const el = document.getElementById('automation-body');
    if (!el) return;
    try {
      const res = await Api.get('/automation', { params: { pageSize: 100 } });
      const list = res.data || res || [];
      this._list = list;

      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><h3>No custom rules yet</h3><p>Create a rule to automate repetitive tasks.</p></div>'
        : `<table>
            <thead><tr><th>Rule Name</th><th>Trigger</th><th>Action</th><th>Executions</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              ${list.map(r => `<tr>
                <td class="td-bold">${Utils.esc(r.name||r.rule_name||'—')}</td>
                <td style="font-size:10.5px">${(r.trigger||r.trigger_event||'—').replace(/_/g,' ')}</td>
                <td style="font-size:10.5px">${(r.action||r.action_type||'—').replace(/_/g,' ')}</td>
                <td style="text-align:center">${r.execution_count||r.executionCount||0}</td>
                <td>
                  <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                    <input type="checkbox" ${r.is_active||r.isActive?'checked':''} onchange="AutomationPage.toggle('${r.id}',this.checked)">
                    <span style="font-size:11px">${r.is_active||r.isActive?'Active':'Inactive'}</span>
                  </label>
                </td>
                <td><div style="display:flex;gap:4px">
                  <button class="btn btn-ghost btn-sm" onclick="AutomationPage.run('${r.id}')">Run Now</button>
                  <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="AutomationPage.delete('${r.id}')">Delete</button>
                </div></td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) {
      el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  showCreateModal() {
    showOverlay('auto-overlay');
    document.getElementById('auto-modal').style.display = 'block';
  },

  async create() {
    const name = document.getElementById('auto-name')?.value?.trim();
    const trigger = document.getElementById('auto-trigger')?.value;
    const action = document.getElementById('auto-action')?.value;
    const template = document.getElementById('auto-template')?.value?.trim();
    const delay = parseInt(document.getElementById('auto-delay')?.value || '0');

    if (!name) { Utils.warn('Please enter a rule name'); return; }
    if (!trigger) { Utils.warn('Please select a trigger'); return; }
    if (!action) { Utils.warn('Please select an action'); return; }

    try {
      await Api.post('/automation', { name, triggerEvent: trigger, actionType: action, messageTemplate: template, delayMinutes: delay });
      Utils.success('Automation rule created');
      closeOverlay('auto-overlay');
      document.getElementById('auto-modal').style.display = 'none';
      await this.load();
    } catch (err) { Utils.error(err.message); }
  },

  async toggle(ruleId, active) {
    try {
      await Api.patch(`/automation/${ruleId}`, { isActive: active });
    } catch (err) { Utils.error(err.message); await this.load(); }
  },

  async run(ruleId) {
    try {
      const res = await Api.post(`/automation/${ruleId}/run`, {});
      Utils.info(res?.data?.message || 'Rule marked as run. Rules are not executed automatically yet, so nothing was sent.');
    } catch (err) { Utils.error(err.message); }
  },

  async runAll() {
    const active = this._list.filter(r => r.is_active || r.isActive);
    if (!active.length) { Utils.info('No active rules to run'); return; }
    Utils.confirm(`Run all ${active.length} active rules now?`, async () => {
      let ok = 0;
      for (const r of active) {
        try { await Api.post(`/automation/${r.id}/run`, {}); ok++; } catch {}
      }
      Utils.info(`${ok} of ${active.length} rules marked as run. Rules are not executed automatically yet, so nothing was sent.`);
    });
  },

  async delete(ruleId) {
    Utils.confirm('Delete this automation rule?', async () => {
      try {
        await Api.delete(`/automation/${ruleId}`);
        Utils.success('Rule deleted');
        await this.load();
      } catch (err) { Utils.error(err.message); }
    });
  },
};
