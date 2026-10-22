// ROF CRM — Unit Documents (Two-panel: unit picker + doc viewer)

Pages.unitDocuments = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <style>
      #content:has(.udn) { margin-left:auto; margin-right:auto; width:100% }
      .udn { max-width:1400px; margin:0 auto }
      .udn-cols { display:grid; grid-template-columns:320px 1fr; gap:16px; align-items:start }
      .udn .sp, .udn .tbl-wrap { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
      .udn .sp-hdr { padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap }
      .udn .sp-title, .udn .tbl-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .udn .sp-body { padding:18px }
      .udn .tbl-hdr { padding:12px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      .udn .fg { gap:6px }
      .udn .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      .udn .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .udn .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .udn input[type=file].fc { padding:6px 10px }
      .udn .btn-teal { background:var(--teal); color:#fff; border:none; padding:9px 24px; border-radius:8px; font-size:12.5px; font-weight:600; min-height:38px; cursor:pointer }
      .udn .btn-teal:hover { filter:brightness(.92) }
      .udn .btn-ghost.btn-sm { min-height:28px; padding:4px 12px; font-size:12px; border-radius:6px }
      .udn-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px }
      .udn-stat { background:var(--surface2); border:1px solid var(--border2); border-radius:10px; padding:12px 14px }
      .udn-stat-l { font-size:10.5px; color:var(--text3); text-transform:uppercase; letter-spacing:.4px }
      .udn-stat-v { font-size:15px; font-weight:700; color:var(--text); margin-top:4px; font-variant-numeric:tabular-nums }
      .udn-sub { font-size:12px; color:var(--text3); margin-top:3px; font-weight:400; text-transform:none; letter-spacing:0 }
      .udn table { width:100%; border-collapse:collapse; font-size:12.5px }
      .udn table th { background:var(--surface2); color:var(--text3); font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; padding:10px 18px; text-align:left; border-bottom:1px solid var(--border2) }
      .udn table td { padding:10px 18px; border-bottom:1px solid var(--border); color:var(--text) }
      .udn table tbody tr:hover td { background:var(--surface2) }
      .udn .empty-state { padding:44px 18px; text-align:center; color:var(--text3); background:var(--surface); border:1px solid var(--border2); border-radius:10px }
      .udn .empty-state h3 { font-size:14px; font-weight:600; color:var(--text2); margin:0 0 4px }
      .udn .empty-state p { font-size:12px; margin:0 }
      .udn .tbl-wrap .empty-state { border:none; border-radius:0 }
      @media (max-width:900px) { .udn-cols { grid-template-columns:minmax(0,1fr) } }
    </style>
    <div class="udn">
    <div class="page-hdr">
      <h1>Unit Documents</h1>
      <div class="breadcrumb">Documents / <b>Unit Documents</b></div>
    </div>

    <div class="udn-cols">
      <!-- Unit selector panel -->
      <div>
        <div class="sp">
          <div class="sp-hdr"><div class="sp-title">Select Unit</div></div>
          <div class="sp-body">
            <div class="fg" style="margin-bottom:14px"><label class="fl">Project</label>
              <select class="fc" id="ud-project" onchange="UnitDocsPage.loadUnits()">
                <option value="">— All Projects —</option>
              </select>
            </div>
            <div class="fg" style="margin-bottom:14px"><label class="fl">Tower</label>
              <select class="fc" id="ud-tower" onchange="UnitDocsPage.filterUnits()">
                <option value="">— All Towers —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Unit</label>
              <select class="fc" id="ud-unit" onchange="UnitDocsPage.loadUnitDocs(this.value)">
                <option value="">— Select Unit —</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Documents panel -->
      <div>
        <div id="ud-docs-panel">
          <div class="empty-state">
            <h3>Select a unit</h3>
            <p>Choose a project and unit from the left panel to view its documents.</p>
          </div>
        </div>
      </div>
    </div>
    </div>
  `;

  await UnitDocsPage.init();
};

const UnitDocsPage = {
  _units: [],

  async init() {
    const sel = document.getElementById('ud-project');
    if (sel) sel.innerHTML = await Utils.projectOptions('— Select Project —');
    this.filterUnits();
  },

  // the units of the chosen project (it used to hold the first 500 units of everything, so a project with many units lost some)
  async loadUnits() {
    const projectId = document.getElementById('ud-project')?.value;
    try {
      this._units = projectId ? ((await Api.get('/units', { params: { projectId, pageSize: 1000 } })).data || []) : [];
    } catch (err) { this._units = []; Utils.error(err.message); }
    const towerSel = document.getElementById('ud-tower'); if (towerSel) towerSel.value = '';
    this.filterUnits();
  },

  filterUnits() {
    const projectId = document.getElementById('ud-project')?.value;
    const tower = document.getElementById('ud-tower')?.value;

    let filtered = this._units;
    if (projectId) filtered = filtered.filter(u => (u.project_id||u.projectId) === projectId);

    const towers = [...new Set(filtered.map(u => u.tower).filter(Boolean))].sort();
    const towerSel = document.getElementById('ud-tower');
    if (towerSel) {
      const prev = towerSel.value;
      towerSel.innerHTML = '<option value="">— All Towers —</option>' +
        towers.map(t => `<option value="${t}" ${t===prev?'selected':''}>${t}</option>`).join('');
    }

    if (tower) filtered = filtered.filter(u => u.tower === tower);

    const unitSel = document.getElementById('ud-unit');
    if (unitSel) unitSel.innerHTML = '<option value="">— Select Unit —</option>' +
      filtered.map(u => `<option value="${u.id}">${u.unit_number||u.unitNumber||'—'} · Floor ${u.floor||'—'} · ${u.bhk_type||u.bhkType||'—'} · ${Utils.chip(u.status||'available').replace(/<[^>]+>/g, '').trim()}</option>`).join('');
  },

  async loadUnitDocs(unitId) {
    const el = document.getElementById('ud-docs-panel');
    if (!el || !unitId) return;

    const unit = this._units.find(u => u.id === unitId);

    el.innerHTML = `
      <div class="sp" style="margin-bottom:16px">
        <div class="sp-hdr">
          <div>
            <div class="sp-title">Unit ${unit?.unit_number||unit?.unitNumber||'—'}</div>
            <div class="udn-sub">${unit?.project_name||unit?.projectName||'—'} · Tower ${unit?.tower||'—'} · Floor ${unit?.floor||'—'} · ${unit?.bhk_type||unit?.bhkType||'—'}</div>
          </div>
          ${Utils.chip(unit?.status||'available')}
        </div>
        <div class="sp-body">
          ${unit ? `
            <div class="udn-stats">
              <div class="udn-stat"><div class="udn-stat-l">Carpet Area</div><div class="udn-stat-v">${unit.carpet_area_sqft||unit.carpetAreaSqft||'—'} sqft</div></div>
              <div class="udn-stat"><div class="udn-stat-l">Super Area</div><div class="udn-stat-v">${unit.super_area_sqft||unit.superAreaSqft||'—'} sqft</div></div>
              <div class="udn-stat"><div class="udn-stat-l">Base Price</div><div class="udn-stat-v">${Utils.currency(unit.base_price||unit.basePrice||0)}</div></div>
              <div class="udn-stat"><div class="udn-stat-l">Total Price</div><div class="udn-stat-v">${Utils.currency(unit.total_price||unit.totalPrice||0)}</div></div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Upload section -->
      <div class="sp" style="margin-bottom:16px">
        <div class="sp-hdr"><div class="sp-title">Upload Document</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">Document Category</label>
              <select class="fc" id="ud-upload-category">
                <option value="Floor Plan">Floor Plan</option>
                <option value="RERA Certificate">RERA Certificate</option>
                <option value="TCP Licence">TCP Licence</option>
                <option value="Completion Certificate">Completion Certificate</option>
                <option value="OC">Occupancy Certificate</option>
                <option value="Unit Photo">Unit Photo</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="fg"><label class="fl">File</label>
              <input type="file" class="fc" id="ud-upload-file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
            </div>
            <div class="fg"><label class="fl">Remarks</label>
              <input class="fc" id="ud-upload-remarks" placeholder="Optional remarks">
            </div>
          </div>
          <button class="btn btn-teal" style="margin-top:14px" onclick="UnitDocsPage.uploadDoc('${unitId}')">Upload</button>
        </div>
      </div>

      <!-- Documents list -->
      <div class="tbl-wrap">
        <div class="tbl-hdr">
          <div class="tbl-title">Documents</div>
          <div class="tbl-actions">
            <button class="btn btn-ghost btn-sm" onclick="UnitDocsPage.loadUnitDocs('${unitId}')">Refresh</button>
          </div>
        </div>
        <div id="ud-docs-list"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    `;

    // Load documents
    try {
      const res = await Api.get('/documents/vault', { params: { unitId, pageSize: 100 } });
      const docs = res.data || res || [];
      const docsEl = document.getElementById('ud-docs-list');
      if (!docsEl) return;
      docsEl.innerHTML = docs.length === 0
        ? '<div class="empty-state" style="padding:20px"><h3>No documents uploaded for this unit</h3></div>'
        : `<table>
            <thead><tr><th>File Name</th><th>Category</th><th>Uploaded</th><th>Action</th></tr></thead>
            <tbody>
              ${docs.map(d => `<tr>
                <td class="td-bold">${d.file_name||d.fileName||d.name||'—'}</td>
                <td><span class="chip ch-blue">${d.doc_category||d.docCategory||'General'}</span></td>
                <td style="font-size:10.5px">${Utils.date(d.created_at||d.createdAt)}</td>
                <td><button class="btn btn-ghost btn-sm" onclick="window.open('/api/documents/vault/${d.id}/download','_blank')">Download</button></td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) {
      const docsEl = document.getElementById('ud-docs-list');
      if (docsEl) docsEl.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  async uploadDoc(unitId) {
    const file = document.getElementById('ud-upload-file')?.files[0];
    if (!file) { Utils.warn('Please select a file'); return; }
    const category = document.getElementById('ud-upload-category')?.value;
    const remarks = document.getElementById('ud-upload-remarks')?.value;

    const fd = new FormData();
    fd.append('file', file);
    fd.append('unitId', unitId);
    fd.append('docCategory', category);
    if (remarks) fd.append('remarks', remarks);

    try {
      await Api.uploadFile('/documents/vault', fd);
      Utils.success('Document uploaded');
      await this.loadUnitDocs(unitId);
    } catch (err) { Utils.error(err.message); }
  },
};
