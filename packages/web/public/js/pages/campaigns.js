// ROF CRM — Campaigns Page

Pages.campaigns = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Campaigns</h1>
      <div class="breadcrumb">CRM / <b>Campaigns</b></div>
    </div>
    <div class="tbl-hdr" style="margin-bottom:12px">
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
                      <div style="flex:1;background:var(--bg2);border-radius:3px;height:6px"><div style="background:var(--teal);border-radius:3px;width:${pct}%;height:100%"></div></div>
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

    if (!name) { Utils.warn('Please enter a campaign name'); return; }
    if (!message) { Utils.warn('Please enter a message'); return; }

    try {
      await Api.post('/communications/campaigns', { name, message, segment, projectId, channel: 'whatsapp' });
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
