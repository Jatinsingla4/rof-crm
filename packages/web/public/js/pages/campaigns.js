// ROF CRM — Campaigns Page

Pages.campaigns = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <style>
      .cmp { --bg2:var(--surface2); --text1:var(--text); max-width:1360px; margin-left:auto; margin-right:auto }
      .cmp .tabs-line { display:flex; gap:8px; flex-wrap:wrap; border-bottom:none; margin-bottom:16px }
      .cmp .tab-line { padding:7px 16px; font-size:12.5px; border:1px solid var(--border2); border-radius:999px; background:var(--surface); color:var(--text2); cursor:pointer; transition:.15s }
      .cmp .tab-line:hover { border-color:var(--teal); color:var(--teal) }
      .cmp .tab-line.active { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600 }
      .cmp .sp { border-radius:10px; overflow:hidden }
      .cmp .sp-hdr { padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      .cmp .sp-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .cmp .sp-body { padding:18px }
      .cmp .fg { gap:6px }
      .cmp .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      .cmp .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .cmp .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .cmp .btn-teal, .cmp .btn-fetch { background:var(--teal) !important; color:#fff !important; border:none; padding:9px 22px; border-radius:8px; font-size:12.5px; font-weight:600; min-height:38px; cursor:pointer }
      .cmp .btn-teal:hover, .cmp .btn-fetch:hover { filter:brightness(.92) }
      .cmp .btn-teal.btn-sm { min-height:30px; padding:5px 14px; font-size:12px; border-radius:6px }
      .cmp .btn-ghost { border-radius:8px; min-height:38px; padding:9px 18px; font-size:12.5px }
      .cmp .btn-ghost.btn-sm { min-height:30px; padding:5px 12px; font-size:12px; border-radius:6px }
      .cmp .btn-ghost.active { background:var(--teal-bg); color:var(--teal); border-color:var(--teal) }
      .cmp .tbl-hdr { background:var(--teal-bg); border:1px solid var(--border2); border-radius:10px; padding:12px 18px; flex-wrap:wrap }
      .cmp .tbl-wrap > .tbl-hdr { border:none; border-bottom:1px solid var(--border); border-radius:0 }
      .cmp .tbl-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .cmp .tbl-actions { margin-left:auto; display:flex; gap:8px; flex-wrap:wrap }
      .cmp .tbl-wrap { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:auto }
      .cmp table { width:100%; border-collapse:collapse; font-size:12.5px }
      .cmp table th { background:var(--surface2); color:var(--text3); font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; padding:10px 14px; text-align:left; white-space:nowrap; border-bottom:1px solid var(--border2) }
      .cmp table td { padding:9px 14px; border-bottom:1px solid var(--border); color:var(--text) }
      .cmp table tbody tr:hover td { background:var(--surface2) }
      .cmp .kpi { border:1px solid var(--border2); border-left:3px solid var(--teal); border-radius:10px }
      .cmp .empty-state { padding:36px 18px; text-align:center; color:var(--text3) }
      .cmp .empty-state h3 { font-size:14px; font-weight:600; color:var(--text2); margin:0 0 4px }
      .cmp .btg-item { border-radius:8px }
    </style>
    <style>
      .cmp .btg { display:flex; gap:6px; flex-wrap:wrap }
      .cmp .modal { display:none }
      .cmp .modal[style*="display: block"] { display:block; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:601 }
      #camp-body { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:auto }
    </style>
    <div class="cmp">
    <div class="page-hdr">
      <h1>Campaigns</h1>
      <div class="breadcrumb">CRM / <b>Campaigns</b></div>
    </div>
    <div class="tbl-hdr" style="margin-bottom:14px">
      <div class="tbl-title">Marketing Campaigns</div>
      <div class="tbl-actions">
        <button class="btn btn-teal btn-sm" onclick="CampaignsPage.showCreateModal()">+ Create Campaign</button>
        <button class="btn btn-ghost btn-sm" onclick="CampaignsPage.load()">Refresh</button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-row" id="camp-kpis" style="margin-bottom:16px">
      ${[...Array(4)].map(() => `<div class="kpi"><div class="page-loading"><div class="spinner"></div></div></div>`).join('')}
    </div>

    <div id="camp-body"><div class="page-loading"><div class="spinner"></div> Loading…</div></div>

    <!-- Create Campaign Modal -->
    <div class="overlay" id="camp-overlay" onclick="closeOverlay('camp-overlay')"></div>
    <div class="modal" id="camp-modal" style="max-width:540px">
      <div class="modal-hdr">
        <div class="modal-title">Create Campaign</div>
        <button class="modal-close" onclick="closeOverlay('camp-overlay');document.getElementById('camp-modal').style.display='none'">✕</button>
      </div>
      <div class="modal-body">
        <div class="fg" style="margin-bottom:8px"><label class="fl"><span class="r">*</span>Campaign Name</label>
          <input class="fc" id="camp-name" placeholder="e.g. Diwali Offer 2026">
        </div>
        <div class="fg" style="margin-bottom:8px"><label class="fl"><span class="r">*</span>Channel</label>
          <div class="btg">
            <button type="button" class="btg-item on" onclick="btgSelect(this)">WhatsApp</button>
            <button type="button" class="btg-item" onclick="btgSelect(this)">Email</button>
            <button type="button" class="btg-item" onclick="btgSelect(this)">SMS</button>
          </div>
        </div>
        <div class="fg" style="margin-bottom:8px"><label class="fl">Target Segment</label>
          <select class="fc" id="camp-segment">
            <option value="all">All Consumers</option>
            <option value="enquiry">Enquiry Stage</option>
            <option value="interested">Interested Stage</option>
            <option value="application_filed">Application Filed</option>
            <option value="allotted">Allotted</option>
          </select>
        </div>
        <div class="fg" style="margin-bottom:8px"><label class="fl">Project Filter</label>
          <select class="fc" id="camp-project">
            <option value="">— All Projects —</option>
          </select>
        </div>
        <div class="fg" style="margin-bottom:8px"><label class="fl"><span class="r">*</span>Message</label>
          <textarea class="fc" id="camp-message" rows="4" placeholder="Use {{consumer_name}}, {{project_name}} as merge fields…"></textarea>
        </div>
        <div class="fg" style="margin-bottom:12px"><label class="fl">Schedule</label>
          <div class="btg">
            <button type="button" class="btg-item on" onclick="btgSelect(this)">Send Now</button>
            <button type="button" class="btg-item" onclick="btgSelect(this)">Schedule Later</button>
          </div>
        </div>
        <button class="btn btn-teal" style="width:100%" onclick="CampaignsPage.create()">Launch Campaign</button>
      </div>
    </div>
    </div>
  `;

  await CampaignsPage.init();
};

const CampaignsPage = {
  async init() {
    await Promise.allSettled([this.load(), this.loadProjects()]);
  },

  async loadProjects() {
    try {
      const res = await Api.get('/units', { params: { pageSize: 300 } });
      const units = res.data || res || [];
      const projects = [...new Map(
        units.filter(u => u.project_id||u.projectId)
             .map(u => [u.project_id||u.projectId, { id: u.project_id||u.projectId, name: u.project_name||u.projectName }])
      ).values()];
      const sel = document.getElementById('camp-project');
      if (sel) sel.innerHTML = '<option value="">— All Projects —</option>' +
        projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    } catch {}
  },

  async load() {
    try {
      const res = await Api.get('/communications/campaigns', { params: { pageSize: 50 } });
      const list = res.data || res || [];

      const total = list.length;
      const active = list.filter(c => c.status === 'running' || c.status === 'active').length;
      const completed = list.filter(c => c.status === 'completed').length;
      const totalReach = list.reduce((s,c) => s + (c.total_recipients||c.totalRecipients||0), 0);

      const kpiEl = document.getElementById('camp-kpis');
      if (kpiEl) kpiEl.innerHTML = `
        <div class="kpi c-accent"><div class="kpi-lbl">Total Campaigns</div><div class="kpi-val">${total}</div></div>
        <div class="kpi c-green"><div class="kpi-lbl">Active</div><div class="kpi-val">${active}</div></div>
        <div class="kpi c-blue"><div class="kpi-lbl">Completed</div><div class="kpi-val">${completed}</div></div>
        <div class="kpi c-teal"><div class="kpi-lbl">Total Reach</div><div class="kpi-val">${totalReach.toLocaleString('en-IN')}</div></div>
      `;

      const el = document.getElementById('camp-body');
      if (!el) return;
      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><h3>No campaigns yet</h3><p>Create your first campaign to reach consumers at scale.</p></div>'
        : `<table>
            <thead><tr><th>Campaign</th><th>Channel</th><th>Recipients</th><th>Delivered</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
            <tbody>
              ${list.map(c => {
                const delivered = c.delivered_count || c.deliveredCount || 0;
                const total = c.total_recipients || c.totalRecipients || 0;
                const pct = total ? Math.round(delivered/total*100) : 0;
                return `<tr>
                  <td class="td-bold">${c.name||c.campaign_name||'—'}</td>
                  <td><span class="chip ch-blue">${(c.channel||'—').toUpperCase()}</span></td>
                  <td>${total}</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:6px">
                      <div style="flex:1;background:var(--surface2);border-radius:3px;height:6px"><div style="background:var(--teal);border-radius:3px;width:${pct}%;height:100%"></div></div>
                      <span style="font-size:10px">${pct}%</span>
                    </div>
                  </td>
                  <td>${Utils.chip(c.status||'draft')}</td>
                  <td style="font-size:10.5px">${Utils.date(c.created_at||c.createdAt)}</td>
                  <td><div style="display:flex;gap:4px">
                    <button class="btn btn-ghost btn-sm" onclick="CampaignsPage.view('${c.id}')">Details</button>
                    ${c.status==='draft' ? `<button class="btn btn-teal btn-sm" onclick="CampaignsPage.launch('${c.id}')">Launch</button>` : ''}
                  </div></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>`;
    } catch (err) {
      const el = document.getElementById('camp-body');
      if (el) el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  showCreateModal() {
    showOverlay('camp-overlay');
    document.getElementById('camp-modal').style.display = 'block';
  },

  async create() {
    const name = document.getElementById('camp-name')?.value?.trim();
    const message = document.getElementById('camp-message')?.value?.trim();
    const segment = document.getElementById('camp-segment')?.value;
    const projectId = document.getElementById('camp-project')?.value;
    const channelBtn = document.querySelector('.btg:has(> button:first-child) .btg-item.on')?.textContent?.trim().toLowerCase();
    const channel = channelBtn || 'whatsapp';

    if (!name) { Utils.warn('Please enter a campaign name'); return; }
    if (!message) { Utils.warn('Please enter a message'); return; }

    try {
      await Api.post('/communications/campaigns', { name, message, segment, projectId, channel });
      Utils.success(`Campaign "${name}" created and queued`);
      closeOverlay('camp-overlay');
      document.getElementById('camp-modal').style.display = 'none';
      await this.load();
    } catch (err) { Utils.error(err.message); }
  },

  view(id) {
    Utils.info(`Campaign details view coming soon — Campaign ID: ${id.slice(0,8)}`);
  },

  async launch(id) {
    Utils.confirm('Launch this campaign now?', async () => {
      try {
        await Api.post(`/communications/campaigns/${id}/launch`, {});
        Utils.success('Campaign launched');
        await this.load();
      } catch (err) { Utils.error(err.message); }
    });
  },
};
