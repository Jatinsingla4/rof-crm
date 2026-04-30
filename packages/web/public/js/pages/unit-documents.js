// ROF CRM — Unit Documents (Two-panel: unit picker + doc viewer)

Pages.unitDocuments = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Unit Documents</h1>
      <div class="breadcrumb">Documents / <b>Unit Documents</b></div>
    </div>

    <div style="display:grid;grid-template-columns:300px 1fr;gap:16px">
      <!-- Unit selector panel -->
      <div>
        <div class="sp">
          <div class="sp-hdr"><div class="sp-title">Select Unit</div></div>
          <div class="sp-body">
            <div class="fg" style="margin-bottom:8px"><label class="fl">Project</label>
              <select class="fc" id="ud-project" onchange="UnitDocsPage.loadUnits()">
                <option value="">— All Projects —</option>
              </select>
            </div>
            <div class="fg" style="margin-bottom:8px"><label class="fl">Tower</label>
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
  `;

  await UnitDocsPage.init();
};

const UnitDocsPage = {
  _units: [],

  async init() {
    try {
      const res = await Api.get('/units', { params: { pageSize: 500 } });
      this._units = res.data || res || [];

      const projects = [...new Map(
        this._units.filter(u => u.project_id||u.projectId)
                   .map(u => [u.project_id||u.projectId, { id: u.project_id||u.projectId, name: u.project_name||u.projectName }])
      ).values()];

      const sel = document.getElementById('ud-project');
      if (sel) sel.innerHTML = '<option value="">— All Projects —</option>' +
        projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

      this.filterUnits();
    } catch {}
  },

  async loadUnits() {
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
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr">
          <div>
            <div class="sp-title">Unit ${unit?.unit_number||unit?.unitNumber||'—'}</div>
            <div style="font-size:11px;color:var(--text3)">${unit?.project_name||unit?.projectName||'—'} · Tower ${unit?.tower||'—'} · Floor ${unit?.floor||'—'} · ${unit?.bhk_type||unit?.bhkType||'—'}</div>
          </div>
          ${Utils.chip(unit?.status||'available')}
        </div>
        <div class="sp-body">
          ${unit ? `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;font-size:11px">
              <div><div style="color:var(--text3)">Carpet Area</div><div style="font-weight:600">${unit.carpet_area_sqft||unit.carpetAreaSqft||'—'} sqft</div></div>
              <div><div style="color:var(--text3)">Super Area</div><div style="font-weight:600">${unit.super_area_sqft||unit.superAreaSqft||'—'} sqft</div></div>
              <div><div style="color:var(--text3)">Base Price</div><div style="font-weight:600">${Utils.currency(unit.base_price||unit.basePrice||0)}</div></div>
              <div><div style="color:var(--text3)">Total Price</div><div style="font-weight:600">${Utils.currency(unit.total_price||unit.totalPrice||0)}</div></div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Upload section -->
      <div class="sp" style="margin-bottom:12px">
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
          <button class="btn btn-teal btn-sm" style="margin-top:8px" onclick="UnitDocsPage.uploadDoc('${unitId}')">Upload</button>
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
