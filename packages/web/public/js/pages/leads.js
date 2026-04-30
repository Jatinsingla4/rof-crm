// ROF CRM — Leads Pipeline Page

Pages.leads = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Leads Pipeline</h1>
      <div class="breadcrumb">CRM / <b>Leads</b></div>
    </div>

    <!-- Filters -->
    <div class="sp" style="margin-bottom:12px">
      <div class="sp-hdr"><div class="sp-title">Filter Leads</div></div>
      <div class="sp-body">
        <div class="sp-grid">
          <div class="fg"><label class="fl">Search</label>
            <input class="fc" id="leads-search" placeholder="Name, mobile, email…">
          </div>
          <div class="fg"><label class="fl">Project</label>
            <select class="fc" id="leads-project">
              <option value="">— All Projects —</option>
            </select>
          </div>
          <div class="fg"><label class="fl">Stage</label>
            <select class="fc" id="leads-stage">
              <option value="">— All Stages —</option>
              <option value="enquiry">Enquiry</option>
              <option value="interested">Interested</option>
              <option value="application_filed">Application Filed</option>
              <option value="draw_entered">Draw Entered</option>
              <option value="allotted">Allotted</option>
              <option value="onboarded">Onboarded</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div class="fg"><label class="fl">Source</label>
            <select class="fc" id="leads-source">
              <option value="">— All Sources —</option>
              <option value="walk_in">Walk-in</option>
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="newspaper">Newspaper</option>
              <option value="broker">Broker</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <button class="btn btn-fetch" onclick="LeadsPage.load()">FETCH</button>
          <button class="btn btn-teal btn-sm" onclick="Router.navigate('/booking')">+ Add Lead</button>
          <div style="display:flex;gap:4px;margin-left:auto">
            <button class="btn btn-ghost btn-sm ${LeadsPage._view==='kanban'?'active':''}" onclick="LeadsPage.setView('kanban')">Kanban</button>
            <button class="btn btn-ghost btn-sm ${LeadsPage._view==='table'?'active':''}" onclick="LeadsPage.setView('table')">Table</button>
          </div>
        </div>
      </div>
    </div>

    <!-- KPI Cards (clickable to filter) -->
    <div class="kpi-row" id="leads-kpis">
      ${[...Array(6)].map(() => `<div class="kpi"><div class="page-loading"><div class="spinner"></div></div></div>`).join('')}
    </div>

    <!-- Pipeline view -->
    <div id="leads-body"><div class="page-loading"><div class="spinner"></div> Loading pipeline…</div></div>
  `;

  await LeadsPage.loadProjects();
  await LeadsPage.load();
};

const LeadsPage = {
  _list: [],
  _view: 'kanban',

  async loadProjects() {
    try {
      const res = await Api.get('/units', { params: { pageSize: 300 } });
      const units = res.data || res || [];
      const projects = [...new Map(
        units.filter(u => u.project_id || u.projectId)
             .map(u => [u.project_id || u.projectId, { id: u.project_id || u.projectId, name: u.project_name || u.projectName }])
      ).values()];
      const sel = document.getElementById('leads-project');
      if (sel) sel.innerHTML = '<option value="">— All Projects —</option>' +
        projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    } catch {}
  },

  async load() {
    const search = document.getElementById('leads-search')?.value;
    const projectId = document.getElementById('leads-project')?.value;
    const stage = document.getElementById('leads-stage')?.value;
    const source = document.getElementById('leads-source')?.value;

    try {
      const params = { pageSize: 500 };
      if (search) params.search = search;
      if (projectId) params.projectId = projectId;
      if (stage) params.leadStage = stage;
      if (source) params.leadSource = source;

      const res = await Api.get('/consumers', { params });
      this._list = res.data || res || [];
      this.renderKpis(this._list);

      if (this._view === 'kanban') this.renderKanban(this._list);
      else this.renderTable(this._list);
    } catch (err) {
      document.getElementById('leads-body').innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  renderKpis(list) {
    const stages = ROF.LEAD_STAGES;
    const counts = {};
    for (const s of stages) counts[s] = list.filter(c => (c.lead_stage||c.leadStage||'enquiry') === s).length;
    const el = document.getElementById('leads-kpis');
    if (!el) return;

    const kpiCls = ['c-accent','c-blue','c-teal','c-warn','c-green','c-red','c-purple'];
    const labels = { enquiry:'Enquiry', interested:'Interested', application_filed:'Applied', draw_entered:'In Draw', allotted:'Allotted', onboarded:'Onboarded', cancelled:'Cancelled' };
    el.innerHTML = stages.slice(0,6).map((s,i) => `
      <div class="kpi ${kpiCls[i]}" style="cursor:pointer" onclick="LeadsPage.filterStage('${s}')">
        <div class="kpi-lbl">${labels[s]||s}</div>
        <div class="kpi-val">${counts[s]||0}</div>
        <div class="kpi-sub">Click to filter</div>
      </div>
    `).join('');
  },

  filterStage(stage) {
    const sel = document.getElementById('leads-stage');
    if (sel) { sel.value = stage; this.load(); }
  },

  setView(v) {
    this._view = v;
    if (v === 'kanban') this.renderKanban(this._list);
    else this.renderTable(this._list);
  },

  renderKanban(list) {
    const el = document.getElementById('leads-body');
    if (!el) return;
    if (list.length === 0) { el.innerHTML = '<div class="empty-state"><h3>No leads found</h3></div>'; return; }

    const stages = [
      { key:'enquiry', label:'Enquiry', cls:'ch-gray' },
      { key:'interested', label:'Interested', cls:'ch-blue' },
      { key:'application_filed', label:'Applied', cls:'ch-warn' },
      { key:'draw_entered', label:'In Draw', cls:'ch-accent' },
      { key:'allotted', label:'Allotted', cls:'ch-green' },
      { key:'onboarded', label:'Onboarded', cls:'ch-teal' },
    ];

    el.innerHTML = `<div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:10px">` +
      stages.map(stage => {
        const leads = list.filter(c => (c.lead_stage||c.leadStage||'enquiry') === stage.key);
        return `
          <div style="min-width:200px;flex:1;max-width:240px">
            <div style="background:var(--bg2);border-radius:8px;padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600;font-size:12px">${stage.label}</span>
              <span class="chip ${stage.cls}">${leads.length}</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${leads.map(c => `
                <div class="sp" style="margin:0;cursor:pointer;padding:10px" onclick="Router.navigate('/consumer',{id:'${c.id}'})">
                  <div style="font-weight:600;font-size:12px">${c.first_name||''} ${c.last_name||''} ${(!c.first_name&&c.name)?c.name:''}</div>
                  <div style="font-size:11px;color:var(--text3);margin-top:2px">${c.mobile||c.phone||'—'}</div>
                  ${c.project_name||c.projectName ? `<div style="font-size:10px;color:var(--teal);margin-top:4px">${c.project_name||c.projectName}</div>` : ''}
                  <div style="display:flex;justify-content:flex-end;margin-top:6px">
                    <select class="fc" style="font-size:10px;padding:2px 4px;height:24px" onchange="LeadsPage.moveStage('${c.id}',this.value)" onclick="event.stopPropagation()">
                      ${ROF.LEAD_STAGES.map(s => `<option value="${s}" ${s===(c.lead_stage||c.leadStage)?'selected':''}>${s.replace(/_/g,' ')}</option>`).join('')}
                    </select>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('') + `</div>`;
  },

  renderTable(list) {
    const el = document.getElementById('leads-body');
    if (!el) return;
    if (list.length === 0) { el.innerHTML = '<div class="empty-state"><h3>No leads found</h3></div>'; return; }

    el.innerHTML = `
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>S.No.</th><th>Name</th><th>Mobile</th><th>Project</th><th>Stage</th><th>Source</th><th>Added</th><th>Action</th></tr></thead>
          <tbody>
            ${list.map((c,i) => `<tr>
              <td>${i+1}</td>
              <td class="td-bold">${c.first_name||''} ${c.last_name||''} ${(!c.first_name&&c.name)?c.name:''}</td>
              <td>${c.mobile||c.phone||'—'}</td>
              <td style="font-size:10.5px">${c.project_name||c.projectName||'—'}</td>
              <td>${Utils.chip(c.lead_stage||c.leadStage||'enquiry')}</td>
              <td style="font-size:10.5px">${(c.lead_source||c.leadSource||'—').replace(/_/g,' ')}</td>
              <td style="font-size:10.5px">${Utils.date(c.created_at||c.createdAt)}</td>
              <td><button class="btn btn-ghost btn-sm" onclick="Router.navigate('/consumer',{id:'${c.id}'})">View</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async moveStage(consumerId, newStage) {
    try {
      await Api.patch(`/consumers/${consumerId}`, { leadStage: newStage });
      Utils.success('Stage updated');
      await this.load();
    } catch (err) { Utils.error(err.message); }
  },
};
