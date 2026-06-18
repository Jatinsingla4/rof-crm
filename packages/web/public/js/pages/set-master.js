// ROF CRM — Set Master (Master Data Management)

Pages.setMaster = async function(params = {}) {
  const tab = params.tab || 'country';
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Set Master</h1>
      <div class="breadcrumb">Settings / <b>Master Data</b></div>
    </div>

    <div class="tabs-line" id="sm-tabs">
      <button class="tab-line${tab==='country'  ?' active':''}" data-group="sm" data-tab="country"   onclick="switchTab('sm','country');  SMPage.load('country')">Country</button>
      <button class="tab-line${tab==='state'    ?' active':''}" data-group="sm" data-tab="state"     onclick="switchTab('sm','state');    SMPage.load('state')">State</button>
      <button class="tab-line${tab==='city'     ?' active':''}" data-group="sm" data-tab="city"      onclick="switchTab('sm','city');     SMPage.load('city')">City</button>
      <button class="tab-line${tab==='salutation'?' active':''}" data-group="sm" data-tab="salutation" onclick="switchTab('sm','salutation');SMPage.load('salutation')">Salutation</button>
      <button class="tab-line${tab==='profession'?' active':''}" data-group="sm" data-tab="profession" onclick="switchTab('sm','profession');SMPage.load('profession')">Profession</button>
      <button class="tab-line${tab==='nationality'?' active':''}" data-group="sm" data-tab="nationality" onclick="switchTab('sm','nationality');SMPage.load('nationality')">Nationality</button>
      <button class="tab-line${tab==='bank'     ?' active':''}" data-group="sm" data-tab="bank"      onclick="switchTab('sm','bank');     SMPage.load('bank')">Bank Master</button>
      <button class="tab-line${tab==='source'   ?' active':''}" data-group="sm" data-tab="source"    onclick="switchTab('sm','source');   SMPage.load('source')">Source of Enquiry</button>
      <button class="tab-line${tab==='doctype'  ?' active':''}" data-group="sm" data-tab="doctype"   onclick="switchTab('sm','doctype');  SMPage.load('doctype')">Document Type</button>
      <button class="tab-line${tab==='dispatch' ?' active':''}" data-group="sm" data-tab="dispatch"  onclick="switchTab('sm','dispatch'); SMPage.load('dispatch')">Doc Dispatch</button>
      <button class="tab-line${tab==='company'  ?' active':''}" data-group="sm" data-tab="company"   onclick="switchTab('sm','company');  SMPage.loadCompanyMaster()">Company Master</button>
    </div>

    <!-- COUNTRY -->
    <div data-panel-group="sm" data-panel="country" ${tab!=='country'?'style="display:none"':''}>
      ${SMPage._geoPanel('country','Country','Country Name','e.g. India',[
        {key:'name',label:'Country Name',type:'text',required:true},
        {key:'code',label:'ISO Code',type:'text',placeholder:'e.g. IN'}
      ],'country')}
    </div>

    <!-- STATE -->
    <div data-panel-group="sm" data-panel="state" ${tab!=='state'?'style="display:none"':''}>
      <div class="form-row mb12">
        <label class="form-label">Filter by Country</label>
        <select class="form-control" id="state-country-filter" onchange="SMPage.load('state')" style="max-width:260px">
          <option value="">All Countries</option>
        </select>
      </div>
      ${SMPage._geoPanel('state','State','State Name','e.g. Haryana',[
        {key:'name',label:'State Name',type:'text',required:true},
        {key:'country_id',label:'Country',type:'select',options:'countries',required:true},
        {key:'code',label:'State Code',type:'text',placeholder:'e.g. HR'}
      ],'state')}
    </div>

    <!-- CITY -->
    <div data-panel-group="sm" data-panel="city" ${tab!=='city'?'style="display:none"':''}>
      <div class="g2 mb12">
        <div>
          <label class="form-label">Filter by Country</label>
          <select class="form-control" id="city-country-filter" onchange="SMPage.onCityCountryChange()" style="width:100%">
            <option value="">All Countries</option>
          </select>
        </div>
        <div>
          <label class="form-label">Filter by State</label>
          <select class="form-control" id="city-state-filter" onchange="SMPage.load('city')" style="width:100%">
            <option value="">All States</option>
          </select>
        </div>
      </div>
      ${SMPage._geoPanel('city','City','City Name','e.g. Gurugram',[
        {key:'name',label:'City Name',type:'text',required:true},
        {key:'state_id',label:'State',type:'select',options:'states',required:true}
      ],'city')}
    </div>

    <!-- SALUTATION -->
    <div data-panel-group="sm" data-panel="salutation" ${tab!=='salutation'?'style="display:none"':''}>
      ${SMPage._simplePanel('salutation','Salutation','Salutation','e.g. Dr.')}
    </div>

    <!-- PROFESSION -->
    <div data-panel-group="sm" data-panel="profession" ${tab!=='profession'?'style="display:none"':''}>
      ${SMPage._simplePanel('profession','Profession','Profession Name','e.g. Engineer')}
    </div>

    <!-- NATIONALITY -->
    <div data-panel-group="sm" data-panel="nationality" ${tab!=='nationality'?'style="display:none"':''}>
      ${SMPage._simplePanel('nationality','Nationality','Nationality','e.g. Indian')}
    </div>

    <!-- BANK -->
    <div data-panel-group="sm" data-panel="bank" ${tab!=='bank'?'style="display:none"':''}>
      ${SMPage._bankPanel()}
    </div>

    <!-- SOURCE OF ENQUIRY -->
    <div data-panel-group="sm" data-panel="source" ${tab!=='source'?'style="display:none"':''}>
      ${SMPage._sourcePanel()}
    </div>

    <!-- DOCUMENT TYPE -->
    <div data-panel-group="sm" data-panel="doctype" ${tab!=='doctype'?'style="display:none"':''}>
      <div id="sm-doctype-container">${SMPage._doctypePanel()}</div>
    </div>

    <!-- DOCUMENT DISPATCH -->
    <div data-panel-group="sm" data-panel="dispatch" ${tab!=='dispatch'?'style="display:none"':''}>
      ${SMPage._dispatchPanel()}
    </div>

    <!-- COMPANY MASTER -->
    <div data-panel-group="sm" data-panel="company" ${tab!=='company'?'style="display:none"':''}>
      <div id="sm-company-body"><div class="page-loading"><div class="spinner"></div> Loading…</div></div>
    </div>
  `;

  // Load country dropdowns for filters
  await SMPage._loadCountryDropdowns();
  if (tab === 'company') await SMPage.loadCompanyMaster();
  else await SMPage.load(tab);
};

// ─────────────────────────────────────────────────────────────────────────────
// HTML PANEL BUILDERS
// ─────────────────────────────────────────────────────────────────────────────
SMPage._geoPanel = (key, title, fieldLabel, placeholder, fields, endpoint) => `
  <div class="g2" style="gap:16px;align-items:start">
    <div class="sp">
      <div class="sp-hdr">
        <div class="sp-title">Add ${title}</div>
      </div>
      <div class="sp-body">
        <form id="sm-${key}-form" onsubmit="SMPage.submit(event,'${key}')">
          ${fields.map(f => `
            <div class="form-group">
              <label class="form-label">${f.label}${f.required?' <span style="color:var(--red)">*</span>':''}</label>
              ${f.type==='select'
                ? `<select class="form-control" name="${f.key}" id="sm-${key}-${f.key}" ${f.required?'required':''}><option value="">Select ${f.label}</option></select>`
                : `<input class="form-control" type="text" name="${f.key}" placeholder="${f.placeholder||''}" ${f.required?'required':''}>`}
            </div>
          `).join('')}
          <button type="submit" class="btn btn-teal" style="margin-top:8px">Save ${title}</button>
        </form>
      </div>
    </div>
    <div>
      <div class="tbl-hdr mb8">
        <div class="tbl-title">${title} List</div>
        <div class="tbl-actions">
          <input class="form-control form-control-sm" placeholder="Search..." oninput="SMPage.filterTable('sm-${key}-tbl',this.value)" style="width:160px">
        </div>
      </div>
      <div id="sm-${key}-list"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  </div>
`;

SMPage._simplePanel = (key, title, fieldLabel, placeholder) => `
  <div class="g2" style="gap:16px;align-items:start">
    <div class="sp" style="max-width:320px">
      <div class="sp-hdr"><div class="sp-title">Add ${title}</div></div>
      <div class="sp-body">
        <form id="sm-${key}-form" onsubmit="SMPage.submitSimple(event,'${key}')">
          <div class="form-group">
            <label class="form-label">${fieldLabel} <span style="color:var(--red)">*</span></label>
            <input class="form-control" type="text" name="name" placeholder="${placeholder}" required>
          </div>
          <button type="submit" class="btn btn-teal" style="margin-top:8px">Add ${title}</button>
        </form>
      </div>
    </div>
    <div style="flex:1">
      <div class="tbl-hdr mb8">
        <div class="tbl-title">${title} List</div>
        <div class="tbl-actions">
          <input class="form-control form-control-sm" placeholder="Search..." oninput="SMPage.filterTable('sm-${key}-tbl',this.value)" style="width:160px">
        </div>
      </div>
      <div id="sm-${key}-list"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  </div>
`;

SMPage._bankPanel = () => `
  <div class="g2" style="gap:16px;align-items:start">
    <div class="sp" style="max-width:360px">
      <div class="sp-hdr"><div class="sp-title">Add Bank</div></div>
      <div class="sp-body">
        <form id="sm-bank-form" onsubmit="SMPage.submitBank(event)">
          <div class="form-group">
            <label class="form-label">Bank Name <span style="color:var(--red)">*</span></label>
            <input class="form-control" type="text" name="name" placeholder="e.g. HDFC Bank" required>
          </div>
          <div class="form-group">
            <label class="form-label">IFSC Prefix</label>
            <input class="form-control" type="text" name="ifsc_prefix" placeholder="e.g. HDFC" maxlength="10">
          </div>
          <div class="form-group">
            <label class="form-label">Branch</label>
            <input class="form-control" type="text" name="branch" placeholder="Branch name (optional)">
          </div>
          <button type="submit" class="btn btn-teal" style="margin-top:8px">Add Bank</button>
        </form>
      </div>
    </div>
    <div style="flex:1">
      <div class="tbl-hdr mb8">
        <div class="tbl-title">Bank List</div>
        <div class="tbl-actions">
          <input class="form-control form-control-sm" placeholder="Search..." oninput="SMPage.filterTable('sm-bank-tbl',this.value)" style="width:160px">
        </div>
      </div>
      <div id="sm-bank-list"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  </div>
`;

SMPage._sourcePanel = () => `
  <div class="g2" style="gap:16px;align-items:start">
    <div class="sp" style="max-width:360px">
      <div class="sp-hdr"><div class="sp-title">Add Source of Enquiry</div></div>
      <div class="sp-body">
        <form id="sm-source-form" onsubmit="SMPage.submitSource(event)">
          <div class="form-group">
            <label class="form-label">Source Name <span style="color:var(--red)">*</span></label>
            <input class="form-control" type="text" name="name" placeholder="e.g. Walk-in" required>
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-control" name="description" placeholder="Optional description" rows="2"></textarea>
          </div>
          <button type="submit" class="btn btn-teal" style="margin-top:8px">Add Source</button>
        </form>
      </div>
    </div>
    <div style="flex:1">
      <div class="tbl-hdr mb8">
        <div class="tbl-title">Sources of Enquiry</div>
        <div class="tbl-actions">
          <input class="form-control form-control-sm" placeholder="Search..." oninput="SMPage.filterTable('sm-source-tbl',this.value)" style="width:160px">
        </div>
      </div>
      <div id="sm-source-list"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  </div>
`;

SMPage._doctypePanel = () => `
  <div style="background:white;border:1px solid #e0e0e0;border-radius:4px;font-family:Arial,sans-serif;font-size:13px;">

    <!-- Title bar -->
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;background:#0d9488;border-left:4px solid #065f46;border-bottom:1px solid #ddd;">
      <span style="font-weight:bold;color:white;font-size:14px;letter-spacing:0.5px;">DOCUMENT MASTER</span>
      <span style="color:#ffe0e0;font-size:12px;">*Denotes mandatory fields</span>
    </div>

    <div style="padding:0 20px;">

      <!-- Project -->
      <div style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0;">
        <label style="min-width:200px;font-size:13px;color:#333;">* Project:</label>
        <select id="dm-project" style="min-width:300px;padding:5px 8px;border:1px solid #999;border-radius:2px;font-size:12px;">
          <option value="">&lt;--Select--&gt;</option>
        </select>
      </div>

      <!-- Document Name -->
      <div style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0;">
        <label style="min-width:200px;font-size:13px;color:#333;">* Document:</label>
        <input type="text" id="dm-name" placeholder="Document" style="min-width:300px;padding:5px 8px;border:1px solid #999;border-radius:2px;font-size:12px;">
      </div>

      <!-- Document From -->
      <div style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0;">
        <label style="min-width:200px;font-size:13px;color:#333;">* Document From:</label>
        <div style="display:flex;border:1px solid #0d9488;border-radius:4px;overflow:hidden;">
          <button id="dm-from-ind" onclick="SMPage.setDocFrom('Individual')" style="padding:6px 20px;background:#0d9488;color:white;border:none;cursor:pointer;font-size:12px;font-weight:bold;">Individual</button>
          <button id="dm-from-firm" onclick="SMPage.setDocFrom('Firm or Company')" style="padding:6px 20px;background:white;color:#0d9488;border:none;border-left:1px solid #0d9488;cursor:pointer;font-size:12px;">Firm or Company</button>
        </div>
        <input type="hidden" id="dm-from-val" value="Individual">
      </div>

      <!-- Mandatory -->
      <div style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0;">
        <label style="min-width:200px;font-size:13px;color:#333;">* Mandatory:</label>
        <div style="display:flex;border:1px solid #0d9488;border-radius:4px;overflow:hidden;">
          <button id="dm-mand-yes" onclick="SMPage.setMandatory(true)" style="padding:6px 20px;background:white;color:#0d9488;border:none;cursor:pointer;font-size:12px;">yes</button>
          <button id="dm-mand-no" onclick="SMPage.setMandatory(false)" style="padding:6px 20px;background:#0d9488;color:white;border:none;border-left:1px solid #0d9488;cursor:pointer;font-size:12px;font-weight:bold;">No</button>
        </div>
        <input type="hidden" id="dm-mand-val" value="false">
      </div>

      <!-- Document Type (required_at) -->
      <div style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0;">
        <label style="min-width:200px;font-size:13px;color:#333;">* Document Type</label>
        <select id="dm-required-at" style="min-width:300px;padding:5px 8px;border:1px solid #999;border-radius:2px;font-size:12px;">
          <option value="">&lt;--Select--&gt;</option>
          <option value="On Booking">On Booking</option>
          <option value="On Allotment">On Allotment</option>
          <option value="On Agreement">On Agreement</option>
          <option value="On Possession">On Possession</option>
          <option value="On Demand">On Demand</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <!-- Description -->
      <div style="display:flex;align-items:flex-start;padding:12px 0;border-bottom:1px solid #f0f0f0;">
        <label style="min-width:200px;font-size:13px;color:#333;padding-top:4px;">Description(150 Ch.)</label>
        <textarea id="dm-description" placeholder="Description" maxlength="150" rows="3"
          style="min-width:300px;padding:5px 8px;border:1px solid #999;border-radius:2px;font-size:12px;resize:vertical;box-sizing:border-box;"></textarea>
      </div>

    </div>

    <input type="hidden" id="dm-editing-id" value="">
    <div id="dm-error" style="color:red;font-size:12px;margin:4px 20px;display:none;"></div>

    <!-- SAVE + VIEW -->
    <div style="background:#f5f5f5;padding:12px 20px;display:flex;justify-content:center;gap:8px;border-top:1px solid #e0e0e0;">
      <button onclick="SMPage.saveDocumentMaster()" style="background:#1976D2;color:white;border:none;padding:6px 24px;border-radius:2px;cursor:pointer;font-size:13px;font-weight:bold;min-width:80px;">SAVE</button>
      <button onclick="SMPage.viewDocumentMaster()" style="background:#1976D2;color:white;border:none;padding:6px 24px;border-radius:2px;cursor:pointer;font-size:13px;font-weight:bold;min-width:80px;">VIEW</button>
    </div>

    <div id="dm-view-section" style="display:none;"></div>
  </div>
`;

SMPage._dispatchPanel = () => `
  <div class="g2" style="gap:16px;align-items:start">
    <div class="sp" style="max-width:360px">
      <div class="sp-hdr"><div class="sp-title">Log Document Dispatch</div></div>
      <div class="sp-body">
        <form id="sm-dispatch-form" onsubmit="SMPage.submitDispatch(event)">
          <div class="form-group">
            <label class="form-label">Document Type <span style="color:var(--red)">*</span></label>
            <input class="form-control" type="text" name="document_type" placeholder="e.g. Allotment Letter" required>
          </div>
          <div class="form-group">
            <label class="form-label">Dispatch Mode <span style="color:var(--red)">*</span></label>
            <select class="form-control" name="dispatch_mode" required>
              <option value="">Select mode</option>
              <option>Courier</option>
              <option>Hand Delivery</option>
              <option>Email</option>
              <option>WhatsApp</option>
              <option>Speed Post</option>
              <option>Registered Post</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Tracking No.</label>
            <input class="form-control" type="text" name="tracking_no" placeholder="Optional">
          </div>
          <div class="form-group">
            <label class="form-label">Consumer Name</label>
            <input class="form-control" type="text" id="dispatch-consumer-search" placeholder="Search consumer..." oninput="SMPage.searchConsumer(this.value)">
            <input type="hidden" name="consumer_id" id="dispatch-consumer-id">
            <div id="dispatch-consumer-suggestions" class="autocomplete-list"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Dispatched At</label>
            <input class="form-control" type="datetime-local" name="dispatched_at">
          </div>
          <button type="submit" class="btn btn-teal" style="margin-top:8px">Log Dispatch</button>
        </form>
      </div>
    </div>
    <div style="flex:1">
      <div class="tbl-hdr mb8">
        <div class="tbl-title">Dispatch History</div>
      </div>
      <div id="sm-dispatch-list"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  </div>
`;

// ─────────────────────────────────────────────────────────────────────────────
// DATA LOADER
// ─────────────────────────────────────────────────────────────────────────────
SMPage._cache = {};

SMPage.load = async function(tab) {
  const handlers = {
    country:     () => SMPage._loadSimple('country',    '/master/countries',          ['name','code'],                       ['Country','Code']),
    state:       () => SMPage._loadStates(),
    city:        () => SMPage._loadCities(),
    salutation:  () => SMPage._loadSimple('salutation', '/master/salutations',        ['name'],                              ['Salutation']),
    profession:  () => SMPage._loadSimple('profession', '/master/professions',        ['name'],                              ['Profession']),
    nationality: () => SMPage._loadSimple('nationality','/master/nationalities',      ['name'],                              ['Nationality']),
    bank:        () => SMPage._loadSimple('bank',       '/master/banks',              ['name','ifsc_prefix','branch'],       ['Bank Name','IFSC Prefix','Branch']),
    source:      () => SMPage._loadSimple('source',     '/master/sources-of-enquiry', ['name','description'],                ['Source','Description']),
    doctype:     () => SMPage.initDoctypeTab(),
    dispatch:    () => SMPage._loadDispatch(),
  };
  if (handlers[tab]) await handlers[tab]();
};

SMPage._loadSimple = async function(key, endpoint, cols, headers) {
  const el = document.getElementById(`sm-${key}-list`);
  if (!el) return;
  try {
    const res = await Api.get(endpoint);
    const rows = res.data || [];
    SMPage._cache[key] = rows;
    el.innerHTML = SMPage._renderTable(key, rows, cols, headers);
  } catch (err) {
    el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
};

SMPage._renderTable = function(key, rows, cols, headers) {
  if (!rows.length) return `<div class="empty-state"><div class="empty-icon">📋</div><div>No records found</div></div>`;
  return `<table class="dash-tbl" id="sm-${key}-tbl">
    <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}<th style="width:70px">Action</th></tr></thead>
    <tbody>
      ${rows.map(r => `<tr>
        ${cols.map(c=>`<td>${r[c]||'—'}</td>`).join('')}
        <td><button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="SMPage.remove('${key}','${r.id}',this)">✕</button></td>
      </tr>`).join('')}
    </tbody>
  </table>`;
};

SMPage._loadStates = async function() {
  const el = document.getElementById('sm-state-list');
  if (!el) return;
  const countryId = document.getElementById('state-country-filter')?.value || '';
  try {
    const res = await Api.get('/master/states', { params: countryId ? { country_id: countryId } : {} });
    const rows = res.data || [];
    el.innerHTML = rows.length === 0
      ? `<div class="empty-state"><div class="empty-icon">🗺</div><div>No states found</div></div>`
      : `<table class="dash-tbl" id="sm-state-tbl">
          <thead><tr><th>State</th><th>Country</th><th>Code</th><th style="width:70px">Action</th></tr></thead>
          <tbody>
            ${rows.map(r=>`<tr>
              <td class="td-bold">${r.name}</td>
              <td>${r.country_name||'—'}</td>
              <td>${r.code||'—'}</td>
              <td><button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="SMPage.remove('state','${r.id}',this)">✕</button></td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    // Populate state filter selects with countries
    await SMPage._populateSelect('sm-state-country_id', '/master/countries', 'id', 'name');
  } catch (err) {
    el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
};

SMPage._loadCities = async function() {
  const el = document.getElementById('sm-city-list');
  if (!el) return;
  const stateId = document.getElementById('city-state-filter')?.value || '';
  try {
    const res = await Api.get('/master/cities', { params: stateId ? { state_id: stateId } : {} });
    const rows = res.data || [];
    el.innerHTML = rows.length === 0
      ? `<div class="empty-state"><div class="empty-icon">🏙</div><div>No cities found</div></div>`
      : `<table class="dash-tbl" id="sm-city-tbl">
          <thead><tr><th>City</th><th>State</th><th>Country</th><th style="width:70px">Action</th></tr></thead>
          <tbody>
            ${rows.map(r=>`<tr>
              <td class="td-bold">${r.name}</td>
              <td>${r.state_name||'—'}</td>
              <td>${r.country_name||'—'}</td>
              <td><button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="SMPage.remove('city','${r.id}',this)">✕</button></td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    await SMPage._populateSelect('sm-city-state_id', '/master/states', 'id', 'name');
  } catch (err) {
    el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
};

SMPage._loadDispatch = async function() {
  const el = document.getElementById('sm-dispatch-list');
  if (!el) return;
  try {
    const res = await Api.get('/master/document-dispatch');
    const rows = res.data || [];
    el.innerHTML = rows.length === 0
      ? `<div class="empty-state"><div class="empty-icon">📮</div><div>No dispatch records</div></div>`
      : `<table class="dash-tbl">
          <thead><tr><th>Document Type</th><th>Mode</th><th>Consumer</th><th>Tracking No.</th><th>Dispatched At</th><th style="width:70px">Action</th></tr></thead>
          <tbody>
            ${rows.map(r=>`<tr>
              <td class="td-bold">${r.document_type||'—'}</td>
              <td><span class="chip chip-blue">${r.dispatch_mode||'—'}</span></td>
              <td>${r.consumer_name||'—'}</td>
              <td class="td-mono">${r.tracking_no||'—'}</td>
              <td style="font-size:10.5px">${Utils.date(r.dispatched_at||r.created_at)}</td>
              <td><button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="SMPage.remove('dispatch','${r.id}',this)">✕</button></td>
            </tr>`).join('')}
          </tbody>
        </table>`;
  } catch (err) {
    el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
};

SMPage._loadCountryDropdowns = async function() {
  await SMPage._populateSelect('state-country-filter', '/master/countries', 'id', 'name', true);
  await SMPage._populateSelect('city-country-filter',  '/master/countries', 'id', 'name', true);
};

SMPage._populateSelect = async function(selectId, endpoint, valKey, labelKey, addBlank = false) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  try {
    const res = await Api.get(endpoint);
    const rows = res.data || [];
    const cur  = sel.value;
    const blankOpt = addBlank ? `<option value="">All</option>` : `<option value="">Select</option>`;
    sel.innerHTML = blankOpt + rows.map(r => `<option value="${r[valKey]}"${r[valKey]===cur?' selected':''}>${r[labelKey]}</option>`).join('');
  } catch {}
};

SMPage.onCityCountryChange = async function() {
  const countryId = document.getElementById('city-country-filter')?.value;
  const stateFilter = document.getElementById('city-state-filter');
  if (!stateFilter) return;
  if (!countryId) {
    await SMPage._populateSelect('city-state-filter', '/master/states', 'id', 'name', true);
  } else {
    const res = await Api.get('/master/states', { params: { country_id: countryId } });
    const rows = res.data || [];
    stateFilter.innerHTML = `<option value="">All States</option>` + rows.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  }
  await SMPage.load('city');
};

// ─────────────────────────────────────────────────────────────────────────────
// FORM SUBMISSIONS
// ─────────────────────────────────────────────────────────────────────────────
SMPage.submit = async function(e, key) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());
  const endpoints = {
    country: '/master/countries', state: '/master/states', city: '/master/cities',
  };
  try {
    await Api.post(endpoints[key], body);
    Utils.success('Saved successfully');
    form.reset();
    await SMPage.load(key);
  } catch (err) { Utils.error(err.message); }
};

SMPage.submitSimple = async function(e, key) {
  e.preventDefault();
  const form = e.target;
  const name = form.querySelector('[name="name"]').value.trim();
  if (!name) return;
  const endpoints = {
    salutation: '/master/salutations', profession: '/master/professions', nationality: '/master/nationalities',
  };
  try {
    await Api.post(endpoints[key], { name });
    Utils.success('Added successfully');
    form.reset();
    await SMPage.load(key);
  } catch (err) { Utils.error(err.message); }
};

SMPage.submitBank = async function(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());
  try {
    await Api.post('/master/banks', body);
    Utils.success('Bank added');
    form.reset();
    await SMPage.load('bank');
  } catch (err) { Utils.error(err.message); }
};

SMPage.submitSource = async function(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());
  try {
    await Api.post('/master/sources-of-enquiry', body);
    Utils.success('Source added');
    form.reset();
    await SMPage.load('source');
  } catch (err) { Utils.error(err.message); }
};

// ── DOCUMENT MASTER ──────────────────────────────────────────────────────────

SMPage.initDoctypeTab = async function() {
  // Panel already rendered by _doctypePanel() in the page HTML.
  // Just populate project dropdown.
  const sel = document.getElementById('dm-project');
  if (!sel || sel.options.length > 1) return;
  try {
    const res = await Api.get('/projects');
    const projects = res.data || res || [];
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
  } catch (e) { console.error('Failed to load projects:', e); }
};

SMPage.setDocFrom = function(val) {
  document.getElementById('dm-from-val').value = val;
  const ind  = document.getElementById('dm-from-ind');
  const firm = document.getElementById('dm-from-firm');
  if (!ind || !firm) return;
  if (val === 'Individual') {
    ind.style.background  = '#0d9488'; ind.style.color  = 'white'; ind.style.fontWeight  = 'bold';
    firm.style.background = 'white';   firm.style.color = '#0d9488'; firm.style.fontWeight = 'normal';
  } else {
    firm.style.background = '#0d9488'; firm.style.color  = 'white'; firm.style.fontWeight  = 'bold';
    ind.style.background  = 'white';   ind.style.color  = '#0d9488'; ind.style.fontWeight  = 'normal';
  }
};

SMPage.setMandatory = function(val) {
  document.getElementById('dm-mand-val').value = String(val);
  const yes = document.getElementById('dm-mand-yes');
  const no  = document.getElementById('dm-mand-no');
  if (!yes || !no) return;
  if (val) {
    yes.style.background = '#0d9488'; yes.style.color = 'white'; yes.style.fontWeight = 'bold';
    no.style.background  = 'white';   no.style.color  = '#0d9488'; no.style.fontWeight  = 'normal';
  } else {
    no.style.background  = '#0d9488'; no.style.color  = 'white'; no.style.fontWeight  = 'bold';
    yes.style.background = 'white';   yes.style.color = '#0d9488'; yes.style.fontWeight = 'normal';
  }
};

SMPage.saveDocumentMaster = async function() {
  const editingId   = document.getElementById('dm-editing-id')?.value || '';
  const project_id  = document.getElementById('dm-project')?.value || '';
  const name        = (document.getElementById('dm-name')?.value || '').trim();
  const document_from = document.getElementById('dm-from-val')?.value || 'Individual';
  const is_mandatory  = document.getElementById('dm-mand-val')?.value === 'true';
  const required_at   = document.getElementById('dm-required-at')?.value || '';
  const description   = (document.getElementById('dm-description')?.value || '').trim();
  const errEl = document.getElementById('dm-error');

  if (!name)        { errEl.textContent = 'Document name is required';  errEl.style.display = 'block'; return; }
  if (!required_at) { errEl.textContent = 'Document Type is required';  errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  try {
    const token = Auth.getToken();
    const method = editingId ? 'PUT' : 'POST';
    const url = `${ROF.API_BASE}/master/document-types${editingId ? '/' + editingId : ''}`;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, project_id: project_id || null, document_from, is_mandatory, required_at, description: description || null }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) { errEl.textContent = json.error || 'Save failed'; errEl.style.display = 'block'; return; }

    this.resetDocumentMasterForm();
    Utils.success(editingId ? 'Document updated!' : 'Document saved!');
    const vs = document.getElementById('dm-view-section');
    if (vs && vs.style.display !== 'none') this.viewDocumentMaster();
  } catch { errEl.textContent = 'Network error'; errEl.style.display = 'block'; }
};

SMPage.viewDocumentMaster = async function() {
  const section = document.getElementById('dm-view-section');
  if (!section) return;
  section.style.display = 'block';
  section.innerHTML = '<div style="padding:10px 20px;color:#666;font-size:13px;">Loading...</div>';
  try {
    const token = Auth.getToken();
    const res = await fetch(`${ROF.API_BASE}/master/document-types`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    const docs = json.data || [];

    if (!docs.length) { section.innerHTML = '<div style="padding:20px;text-align:center;color:#999;font-size:13px;">No documents found.</div>'; return; }

    // Group by project
    const groups = {};
    docs.forEach(d => {
      const key = d.project_name || 'Global (All Projects)';
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });

    section.innerHTML = Object.entries(groups).map(([pName, rows]) => `
      <div style="margin-top:14px;border:1px solid #e0e0e0;border-radius:4px;overflow:hidden;">
        <div style="background:#e8f5e9;padding:8px 14px;border-bottom:1px solid #c8e6c9;">
          <span style="font-weight:bold;color:#1a237e;font-size:13px;letter-spacing:0.5px;">PROJECT : ${pName.toUpperCase()}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#1a237e;color:white;">
            <th style="padding:7px 10px;text-align:center;width:55px;">S. NO.</th>
            <th style="padding:7px 10px;text-align:left;">NAME</th>
            <th style="padding:7px 10px;text-align:left;width:140px;">DESCRIPTION</th>
            <th style="padding:7px 10px;text-align:left;width:115px;">DOCUMENT TYPE</th>
            <th style="padding:7px 10px;text-align:left;width:115px;">DOCUMENT FROM</th>
            <th style="padding:7px 10px;text-align:center;width:85px;">MANDATORY</th>
            <th style="padding:7px 10px;text-align:center;width:55px;">EDIT</th>
            <th style="padding:7px 10px;text-align:center;width:65px;">DELETE</th>
          </tr></thead>
          <tbody>
            ${rows.map((d, i) => `<tr style="background:${i%2===0?'white':'#f9f9f9'};border-bottom:1px solid #e8e8e8;">
              <td style="padding:7px 10px;text-align:center;">${i+1}</td>
              <td style="padding:7px 10px;font-weight:500;">${d.name}</td>
              <td style="padding:7px 10px;color:#666;font-size:11px;">${d.description||''}</td>
              <td style="padding:7px 10px;">${d.required_at||'—'}</td>
              <td style="padding:7px 10px;">${d.document_from||'—'}</td>
              <td style="padding:7px 10px;text-align:center;">${d.is_mandatory?'Yes':'No'}</td>
              <td style="padding:7px 10px;text-align:center;"><span onclick="SMPage.editDocumentType('${d.id}')" style="color:#1976D2;cursor:pointer;font-weight:bold;">Edit</span></td>
              <td style="padding:7px 10px;text-align:center;"><span onclick="SMPage.deleteDocumentType('${d.id}','${d.name.replace(/'/g,"\\'")}') " style="color:#c62828;cursor:pointer;font-weight:bold;">Delete</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('');
  } catch { section.innerHTML = '<div style="padding:20px;color:red;font-size:13px;">Failed to load documents</div>'; }
};

SMPage.editDocumentType = async function(id) {
  try {
    const token = Auth.getToken();
    const res = await fetch(`${ROF.API_BASE}/master/document-types`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    const d = (json.data || []).find(x => x.id === id);
    if (!d) return;

    const s = (fid, val) => { const el = document.getElementById(fid); if (el) el.value = val || ''; };
    s('dm-editing-id', d.id);
    s('dm-project',    d.project_id);
    s('dm-name',       d.name);
    s('dm-required-at', d.required_at);
    s('dm-description', d.description);
    this.setDocFrom(d.document_from || 'Individual');
    this.setMandatory(d.is_mandatory || false);
    document.getElementById('dm-project')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch { Utils.error('Failed to load document data'); }
};

SMPage.deleteDocumentType = async function(id, name) {
  if (!confirm(`Delete "${name}"?\nThis cannot be undone.`)) return;
  try {
    const token = Auth.getToken();
    const res = await fetch(`${ROF.API_BASE}/master/document-types/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (json.success) this.viewDocumentMaster();
    else Utils.error(json.error || 'Delete failed');
  } catch { Utils.error('Network error'); }
};

SMPage.resetDocumentMasterForm = function() {
  ['dm-editing-id','dm-project','dm-name','dm-required-at','dm-description'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  this.setDocFrom('Individual');
  this.setMandatory(false);
};

SMPage.submitDispatch = async function(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());
  try {
    await Api.post('/master/document-dispatch', body);
    Utils.success('Dispatch logged');
    form.reset();
    document.getElementById('dispatch-consumer-search').value = '';
    document.getElementById('dispatch-consumer-id').value = '';
    await SMPage.load('dispatch');
  } catch (err) { Utils.error(err.message); }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────
SMPage.remove = async function(key, id, btn) {
  if (!confirm('Delete this record?')) return;
  const endpoints = {
    country: '/master/countries', state: '/master/states', city: '/master/cities',
    salutation: '/master/salutations', profession: '/master/professions',
    nationality: '/master/nationalities', bank: '/master/banks',
    source: '/master/sources-of-enquiry', doctype: '/master/document-types',
    dispatch: '/master/document-dispatch',
  };
  try {
    await Api.delete(`${endpoints[key]}/${id}`);
    btn.closest('tr').remove();
    Utils.success('Deleted');
  } catch (err) { Utils.error(err.message); }
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
SMPage.filterTable = function(tableId, query) {
  const tbl = document.getElementById(tableId);
  if (!tbl) return;
  const q = query.toLowerCase();
  tbl.querySelectorAll('tbody tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
};

SMPage._searchConsumerTimer = null;
SMPage.searchConsumer = async function(q) {
  clearTimeout(SMPage._searchConsumerTimer);
  const box = document.getElementById('dispatch-consumer-suggestions');
  if (!box) return;
  if (q.length < 2) { box.innerHTML = ''; return; }
  SMPage._searchConsumerTimer = setTimeout(async () => {
    try {
      const res = await Api.get('/consumers', { params: { search: q, pageSize: 8 } });
      const rows = res.data || [];
      box.innerHTML = rows.map(c =>
        `<div class="autocomplete-item" onclick="SMPage.selectConsumer('${c.id}','${(c.name||'').replace(/'/g,"\\'")}')">
          ${c.name} <span style="color:var(--text3);font-size:10.5px">${c.mobile||''}</span>
        </div>`
      ).join('') || '<div class="autocomplete-item" style="color:var(--text3)">No results</div>';
    } catch {}
  }, 300);
};

SMPage.selectConsumer = function(id, name) {
  document.getElementById('dispatch-consumer-search').value = name;
  document.getElementById('dispatch-consumer-id').value = id;
  document.getElementById('dispatch-consumer-suggestions').innerHTML = '';
};

// ── COMPANY MASTER ────────────────────────────────────────────────────────────

SMPage.loadCompanyMaster = async function() {
  const el = document.getElementById('sm-company-body');
  if (!el) return;

  const inp = (id, ph) => `<input type="text" id="${id}" placeholder="${ph}" style="width:100%;padding:5px 8px;border:1px solid #999;border-radius:2px;font-size:12px;box-sizing:border-box">`;
  const lbl = (text) => `<label style="display:block;margin-bottom:3px;font-size:12px">${text}</label>`;
  const fld = (id, label, ph) => `<div>${lbl(label)}${inp(id, ph)}</div>`;

  el.innerHTML = `
    <div style="background:white;border:1px solid #e0e0e0;border-radius:3px;font-size:13px">

      <!-- Title bar -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;background:#0d9488;border-bottom:2px solid #0d9488;border-left:4px solid #0d9488">
        <span style="font-weight:bold;color:white;font-size:14px;letter-spacing:0.5px">COMPANY MASTER</span>
        <span style="color:#ffe0e0;font-size:12px">*Denotes mandatory field</span>
      </div>

      <div style="padding:16px">

        <!-- ROW 1: Code | Group | Name -->
        <div style="display:grid;grid-template-columns:1fr 1fr 2fr;gap:14px;margin-bottom:12px">
          ${fld('cm-code','*Code:','Code')}
          ${fld('cm-group','Group:','Company Group')}
          <div>${lbl('*Company Name (200 Ch.):')}
            <input type="text" id="cm-name" placeholder="Company Name" maxlength="200" style="width:100%;padding:5px 8px;border:1px solid #999;border-radius:2px;font-size:12px;box-sizing:border-box">
          </div>
        </div>

        <!-- ROW 2: Address1 | Address2 | Address3 -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:12px">
          <div>${lbl('*Company Address1:(200 Ch.)')}
            <textarea id="cm-addr1" placeholder="Company Address1" maxlength="200" rows="4" style="width:100%;padding:5px 8px;border:1px solid #999;border-radius:2px;font-size:12px;box-sizing:border-box;resize:vertical"></textarea>
          </div>
          <div>${lbl('Company Address2:(200 Ch.)')}
            <textarea id="cm-addr2" placeholder="Company Address2" maxlength="200" rows="4" style="width:100%;padding:5px 8px;border:1px solid #999;border-radius:2px;font-size:12px;box-sizing:border-box;resize:vertical"></textarea>
          </div>
          <div>${lbl('Company Address3:(200 Ch.)')}
            <textarea id="cm-addr3" placeholder="Company Address3" maxlength="200" rows="4" style="width:100%;padding:5px 8px;border:1px solid #999;border-radius:2px;font-size:12px;box-sizing:border-box;resize:vertical"></textarea>
          </div>
        </div>

        <!-- ROW 3: City | State | Country | Pin | Phone | Fax -->
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:12px">
          ${fld('cm-city','City:','City')}
          ${fld('cm-state','State:','State')}
          ${fld('cm-country','Country:','Country')}
          ${fld('cm-pin','Pin Code:','Pin Code')}
          ${fld('cm-phone','Phone No.:','Phone No.')}
          ${fld('cm-fax','Fax No.:','Fax No.')}
        </div>

        <!-- ROW 4: Email | Website | CIN | ServiceTax | PAN | VAT -->
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:12px">
          ${fld('cm-email','E-Mail:','Email Id')}
          ${fld('cm-website','Website:','www.rof.co.in')}
          ${fld('cm-cin','C.I.No.:','C.I.No.')}
          ${fld('cm-svc','Service Tax No.:','Service Tax No.')}
          ${fld('cm-pan','PAN No.:','Pan No.')}
          ${fld('cm-vat','VAT No.:','Vat No.')}
        </div>

        <!-- ROW 5: GSTIN | Registered Address -->
        <div style="display:grid;grid-template-columns:1fr 2fr;gap:14px;margin-bottom:12px">
          ${fld('cm-gstin','GSTIN:','GSTIN')}
          ${fld('cm-regaddr','Registered Office Address:','Registered Office Address')}
        </div>

        <!-- BANK ACCOUNTS -->
        <div style="margin-bottom:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;padding-bottom:4px;border-bottom:1px solid #ddd">
            <div style="font-size:12px;font-weight:bold;color:#333">Bank Accounts:</div>
            <button type="button" onclick="SMPage.showAddBankForm()" style="background:#1976D2;color:white;border:none;padding:3px 10px;border-radius:2px;cursor:pointer;font-size:11px">+ Add Bank</button>
          </div>
          <div id="cm-bank-list"><div style="font-size:12px;color:#999;padding:6px 0">Save company first to add bank accounts.</div></div>
          <input type="hidden" id="cm-bank-edit-id">
          <div id="cm-bank-form" style="display:none;background:#f8f9fa;border:1px solid #ddd;border-radius:3px;padding:10px;margin-top:8px">
            <div style="font-size:12px;font-weight:bold;color:#333;margin-bottom:8px" id="cm-bank-form-title">Add Bank Account</div>
            <div style="display:grid;grid-template-columns:2fr 2fr 1fr 1fr;gap:8px;margin-bottom:8px">
              ${fld('cm-bf-bank','Bank Name:','e.g. HDFC Bank')}
              ${fld('cm-bf-acc','Account No.:','Account Number')}
              ${fld('cm-bf-ifsc','IFSC Code:','e.g. HDFC0001234')}
              ${fld('cm-bf-branch','Branch:','Branch Name')}
            </div>
            <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:8px">
              ${fld('cm-bf-acname','Account Name:','Account Holder Name')}
              ${fld('cm-bf-payable','Payable At:','City')}
            </div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
              <label style="font-size:12px;color:#333;display:flex;align-items:center;gap:4px;cursor:pointer">
                <input type="checkbox" id="cm-bf-primary"> Primary account
              </label>
            </div>
            <div style="display:flex;gap:6px">
              <button type="button" onclick="SMPage.saveBankAccount()" style="background:#4CAF50;color:white;border:none;padding:4px 14px;border-radius:2px;cursor:pointer;font-size:12px">Save</button>
              <button type="button" onclick="SMPage.cancelBankForm()" style="background:#9E9E9E;color:white;border:none;padding:4px 14px;border-radius:2px;cursor:pointer;font-size:12px">Cancel</button>
            </div>
          </div>
        </div>

        <!-- ROW 6: Place of Supply | Payable At | Logo -->
        <div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap">
          <div style="min-width:175px">
            ${lbl('State:')}
            <select id="cm-pos" style="padding:5px 8px;border:1px solid #999;border-radius:2px;font-size:12px;min-width:160px">
              <option value="">&lt;-Select-&gt;</option>
              <option value="Haryana">Haryana</option>
              <option value="Delhi">Delhi</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Uttar Pradesh">Uttar Pradesh</option>
              <option value="Rajasthan">Rajasthan</option>
              <option value="Punjab">Punjab</option>
            </select>
          </div>
          <div style="min-width:175px">
            ${lbl('Payable At:')}
            <input type="text" id="cm-payable" placeholder="Payable At" style="padding:5px 8px;border:1px solid #999;border-radius:2px;font-size:12px;min-width:160px">
          </div>
          <div>
            ${lbl('Company Logo:(width=145px and height=72px)')}
            <div style="display:flex;align-items:center;gap:8px">
              <input type="file" id="cm-logo" accept="image/*" style="font-size:12px">
              <button id="cm-attach-btn" onclick="SMPage.attachLogo()" style="background:#2196F3;color:white;border:none;padding:5px 14px;border-radius:2px;cursor:pointer;font-size:12px;font-weight:bold">ATTACH</button>
            </div>
            <div id="cm-logo-preview" style="margin-top:5px"></div>
          </div>
        </div>

        <!-- Hidden editing ID -->
        <input type="hidden" id="cm-editing-id" value="">

        <!-- Error -->
        <div id="cm-error" style="color:red;font-size:12px;margin-bottom:8px;display:none"></div>

        <!-- SAVE | VIEW -->
        <div style="display:flex;gap:8px;padding-top:10px;border-top:1px solid #e0e0e0">
          <button onclick="SMPage.saveCompanyInline()" style="background:#4CAF50;color:white;border:none;padding:6px 20px;border-radius:2px;cursor:pointer;font-size:13px;font-weight:bold;min-width:70px">SAVE</button>
          <button onclick="SMPage.viewCompanies()" style="background:#2196F3;color:white;border:none;padding:6px 20px;border-radius:2px;cursor:pointer;font-size:13px;font-weight:bold;min-width:70px">VIEW</button>
        </div>

      </div>
    </div>

    <!-- VIEW section -->
    <div id="cm-view-section" style="margin-top:18px;display:none"></div>
  `;
};

SMPage.saveCompanyInline = async function() {
  const g = id => (document.getElementById(id)?.value || '').trim() || null;
  const name = g('cm-name');
  const errEl = document.getElementById('cm-error');
  if (!name) { errEl.textContent = 'Company Name is required'; errEl.style.display = 'block'; return; }

  const editingId = g('cm-editing-id');
  const body = {
    name, code: g('cm-code'), group_name: g('cm-group'),
    address1: g('cm-addr1'), address2: g('cm-addr2'), address3: g('cm-addr3'),
    city: g('cm-city'), state: g('cm-state'), country: g('cm-country'),
    pin_code: g('cm-pin'), phone: g('cm-phone'), fax: g('cm-fax'),
    email: g('cm-email'), website: g('cm-website'), cin: g('cm-cin'),
    service_tax_no: g('cm-svc'), pan_no: g('cm-pan'), vat_no: g('cm-vat'),
    gstin: g('cm-gstin'), reg_address: g('cm-regaddr'),
    place_of_supply: g('cm-pos'), payable_at: g('cm-payable'),
  };

  try {
    const token = Auth.getToken();
    const method = editingId ? 'PUT' : 'POST';
    const url = `${ROF.API_BASE}/companies${editingId ? '/' + editingId : ''}`;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.success) { errEl.textContent = json.error || 'Save failed'; errEl.style.display = 'block'; return; }

    // Clear form
    ['cm-code','cm-group','cm-name','cm-addr1','cm-addr2','cm-addr3',
     'cm-city','cm-state','cm-country','cm-pin','cm-phone','cm-fax',
     'cm-email','cm-website','cm-cin','cm-svc','cm-pan','cm-vat',
     'cm-gstin','cm-regaddr','cm-payable','cm-editing-id'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const pos = document.getElementById('cm-pos'); if (pos) pos.value = '';
    errEl.style.display = 'none';
    document.getElementById('cm-logo-preview').innerHTML = '';
    window._cmEditingId = null;
    window._cmBankCompanyId = json.data.id;
    if (window._pendingBanks && window._pendingBanks.length) {
      const tok = Auth.getToken();
      for (const bank of window._pendingBanks) {
        try {
          await fetch(`${ROF.API_BASE}/companies/${json.data.id}/bank-accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
            body: JSON.stringify(bank),
          });
        } catch(e) { console.error('Failed to save pending bank:', e); }
      }
      window._pendingBanks = [];
    }
    await SMPage._loadCompanyBanks(json.data.id);

    Utils.success(editingId ? 'Company updated successfully!' : 'Company saved successfully!');
    const vs = document.getElementById('cm-view-section');
    if (vs && vs.style.display !== 'none') SMPage.viewCompanies();
  } catch (err) { errEl.textContent = 'Network error'; errEl.style.display = 'block'; }
};

window._pendingBanks = [];

SMPage._loadCompanyBanks = async function(companyId) {
  window._cmBankCompanyId = companyId;
  const list = document.getElementById('cm-bank-list');
  if (!list) return;
  list.innerHTML = '<div style="font-size:12px;color:#666">Loading...</div>';
  try {
    const token = Auth.getToken();
    const res = await fetch(`${ROF.API_BASE}/companies/${companyId}/bank-accounts`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    SMPage._renderBankList(json.data || []);
  } catch { list.innerHTML = '<div style="font-size:12px;color:red">Failed to load bank accounts</div>'; }
};

SMPage._renderBankList = function(banks) {
  const list = document.getElementById('cm-bank-list');
  if (!list) return;
  if (!banks.length) {
    list.innerHTML = '<div style="font-size:12px;color:#999;padding:6px 0">No bank accounts. Click "+ Add Bank" to add one.</div>';
    return;
  }
  const esc = v => (v||'').replace(/'/g, "\\'");
  list.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead><tr style="background:#e8eaf6">
      <th style="padding:5px 8px;text-align:left">Bank</th>
      <th style="padding:5px 8px;text-align:left">Account No.</th>
      <th style="padding:5px 8px;text-align:left">IFSC</th>
      <th style="padding:5px 8px;text-align:left">Branch</th>
      <th style="padding:5px 8px;text-align:center">Primary</th>
      <th style="padding:5px 8px;text-align:center">Action</th>
    </tr></thead>
    <tbody>${banks.map(b => `<tr style="border-bottom:1px solid #e0e0e0">
      <td style="padding:5px 8px">${b.bank_name}</td>
      <td style="padding:5px 8px;font-family:monospace">${b.account_number}</td>
      <td style="padding:5px 8px">${b.ifsc_code||'—'}</td>
      <td style="padding:5px 8px">${b.branch||'—'}</td>
      <td style="padding:5px 8px;text-align:center">${b.is_primary?'★':''}</td>
      <td style="padding:5px 8px;text-align:center">
        <button onclick="SMPage.editBank('${b.id}','${esc(b.bank_name)}','${esc(b.account_number)}','${esc(b.ifsc_code||'')}','${esc(b.branch||'')}','${esc(b.account_name||'')}','${esc(b.payable_at||'')}',${b.is_primary})" style="background:#1976D2;color:white;border:none;padding:2px 8px;border-radius:2px;cursor:pointer;font-size:11px;margin-right:3px">Edit</button>
        <button onclick="SMPage.deleteBank('${b.id}')" style="background:#e53935;color:white;border:none;padding:2px 8px;border-radius:2px;cursor:pointer;font-size:11px">Del</button>
      </td>
    </tr>`).join('')}</tbody>
  </table>`;
};

SMPage._renderPendingBankList = function() {
  const list = document.getElementById('cm-bank-list');
  if (!list) return;
  const banks = window._pendingBanks || [];
  if (!banks.length) {
    list.innerHTML = '<div style="font-size:12px;color:#999;padding:6px 0">No bank accounts added yet.</div>';
    return;
  }
  list.innerHTML = '<div style="font-size:11px;color:#e65100;margin-bottom:4px;font-style:italic">⚠ Pending — will save when company is saved</div>' +
    banks.map((b, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border:1px solid #ffe0b2;border-radius:3px;margin-bottom:4px;background:#fff8f0">
      <span style="font-size:12px"><strong>${b.bankName}</strong> — ${b.accountNumber}${b.isPrimary ? ' ★ Primary' : ''}</span>
      <button type="button" onclick="window._pendingBanks.splice(${i},1);SMPage._renderPendingBankList()" style="background:#e53935;color:#fff;border:none;padding:2px 8px;border-radius:2px;font-size:11px;cursor:pointer">Remove</button>
    </div>`).join('');
};

SMPage.showAddBankForm = function() {
  ['cm-bank-edit-id','cm-bf-bank','cm-bf-acc','cm-bf-ifsc','cm-bf-branch','cm-bf-acname','cm-bf-payable'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const chk = document.getElementById('cm-bf-primary'); if (chk) chk.checked = false;
  document.getElementById('cm-bank-form-title').textContent = 'Add Bank Account';
  document.getElementById('cm-bank-form').style.display = 'block';
};

SMPage.cancelBankForm = function() {
  document.getElementById('cm-bank-form').style.display = 'none';
};

SMPage.editBank = function(id, bankName, accNo, ifsc, branch, acName, payable, isPrimary) {
  document.getElementById('cm-bank-edit-id').value = id;
  document.getElementById('cm-bf-bank').value = bankName;
  document.getElementById('cm-bf-acc').value = accNo;
  document.getElementById('cm-bf-ifsc').value = ifsc;
  document.getElementById('cm-bf-branch').value = branch;
  document.getElementById('cm-bf-acname').value = acName;
  document.getElementById('cm-bf-payable').value = payable;
  const chk = document.getElementById('cm-bf-primary'); if (chk) chk.checked = isPrimary;
  document.getElementById('cm-bank-form-title').textContent = 'Edit Bank Account';
  document.getElementById('cm-bank-form').style.display = 'block';
};

SMPage.saveBankAccount = async function() {
  const companyId = window._cmBankCompanyId || (document.getElementById('cm-editing-id')?.value||'').trim();
  const editId = (document.getElementById('cm-bank-edit-id')?.value||'').trim();
  const body = {
    bankName: (document.getElementById('cm-bf-bank')?.value||'').trim(),
    accountNumber: (document.getElementById('cm-bf-acc')?.value||'').trim(),
    ifscCode: (document.getElementById('cm-bf-ifsc')?.value||'').trim() || null,
    branch: (document.getElementById('cm-bf-branch')?.value||'').trim() || null,
    accountName: (document.getElementById('cm-bf-acname')?.value||'').trim() || null,
    payableAt: (document.getElementById('cm-bf-payable')?.value||'').trim() || null,
    isPrimary: document.getElementById('cm-bf-primary')?.checked || false,
    _editId: editId || null,
  };
  if (!body.bankName || !body.accountNumber) { Utils.warn('Bank name and account number are required'); return; }

  if (!companyId) {
    window._pendingBanks.push(body);
    SMPage.cancelBankForm();
    SMPage._renderPendingBankList();
    Utils.success('Bank account queued — will save with company');
    return;
  }

  try {
    const token = Auth.getToken();
    const method = editId ? 'PATCH' : 'POST';
    const url = editId
      ? `${ROF.API_BASE}/companies/${companyId}/bank-accounts/${editId}`
      : `${ROF.API_BASE}/companies/${companyId}/bank-accounts`;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.success) { Utils.error(json.error || 'Save failed'); return; }
    SMPage.cancelBankForm();
    await SMPage._loadCompanyBanks(companyId);
    Utils.success('Bank account saved');
  } catch (err) { Utils.error(err.message); }
};

SMPage.deleteBank = async function(bankId) {
  if (!confirm('Delete this bank account?')) return;
  const companyId = window._cmBankCompanyId || (document.getElementById('cm-editing-id')?.value||'').trim();
  if (!companyId) return;
  try {
    const token = Auth.getToken();
    const res = await fetch(`${ROF.API_BASE}/companies/${companyId}/bank-accounts/${bankId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok || !json.success) { Utils.error(json.error || 'Delete failed'); return; }
    await SMPage._loadCompanyBanks(companyId);
    Utils.success('Bank account removed');
  } catch (err) { Utils.error(err.message); }
};

SMPage.viewCompanies = async function() {
  const section = document.getElementById('cm-view-section');
  if (!section) return;
  section.style.display = 'block';
  section.innerHTML = '<div style="color:#666;font-size:13px;padding:10px">Loading...</div>';
  try {
    const token = Auth.getToken();
    const res = await fetch(`${ROF.API_BASE}/companies`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    const companies = json.data || [];
    section.innerHTML = `
      <div style="background:white;border:1px solid #e0e0e0;border-radius:3px;overflow:hidden">
        <div style="background:#1a237e;color:white;padding:8px 14px;font-size:13px;font-weight:bold">Company List</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#e8eaf6">
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #1a237e">S.No</th>
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #1a237e">Code</th>
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #1a237e">Company Name</th>
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #1a237e">GSTIN</th>
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #1a237e">Phone</th>
            <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #1a237e">Projects</th>
            <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #1a237e">Action</th>
          </tr></thead>
          <tbody>
            ${companies.map((c, i) => `<tr style="background:${i%2===0?'white':'#f5f5f5'};border-bottom:1px solid #e0e0e0">
              <td style="padding:7px 10px">${i+1}</td>
              <td style="padding:7px 10px">${c.code||'—'}</td>
              <td style="padding:7px 10px;font-weight:500">${c.name}</td>
              <td style="padding:7px 10px;font-size:11px;color:#555">${c.gstin||'—'}</td>
              <td style="padding:7px 10px">${c.phone||'—'}</td>
              <td style="padding:7px 10px;text-align:center">${c.project_count||0}</td>
              <td style="padding:7px 10px;text-align:center">
                <button onclick="SMPage.editCompanyInline('${c.id}')" style="background:#1976D2;color:white;border:none;padding:3px 10px;border-radius:2px;cursor:pointer;font-size:11px;margin-right:4px">Edit</button>
                <button onclick="SMPage.setActiveCompany('${c.id}','${c.name.replace(/'/g,"\\'")}') " style="background:#388E3C;color:white;border:none;padding:3px 10px;border-radius:2px;cursor:pointer;font-size:11px">Set Active</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) { section.innerHTML = '<p style="color:red;padding:10px">Failed to load companies</p>'; }
};

SMPage.editCompanyInline = async function(id) {
  try {
    const token = Auth.getToken();
    const res = await fetch(`${ROF.API_BASE}/companies/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    const c = json.data || {};
    const s = (fId, val) => { const el = document.getElementById(fId); if (el) el.value = val || ''; };

    s('cm-editing-id', c.id);  s('cm-code', c.code);        s('cm-group', c.group_name);
    s('cm-name', c.name);      s('cm-addr1', c.address1);   s('cm-addr2', c.address2);
    s('cm-addr3', c.address3); s('cm-city', c.city);         s('cm-state', c.state);
    s('cm-country', c.country);s('cm-pin', c.pin_code);      s('cm-phone', c.phone);
    s('cm-fax', c.fax);        s('cm-email', c.email);       s('cm-website', c.website);
    s('cm-cin', c.cin);        s('cm-svc', c.service_tax_no);s('cm-pan', c.pan_no);
    s('cm-vat', c.vat_no);     s('cm-gstin', c.gstin);       s('cm-regaddr', c.reg_address);
    s('cm-pos', c.place_of_supply);
    s('cm-payable', c.payable_at);
    window._cmEditingId = c.id;
    window._pendingBanks = [];
    await SMPage._loadCompanyBanks(c.id);

    if (c.logo_url) {
      const prev = document.getElementById('cm-logo-preview');
      if (prev) prev.innerHTML = `<img src="${c.logo_url}" style="height:36px;object-fit:contain;border:1px solid #ddd;padding:3px;border-radius:2px">`;
    }
    document.getElementById('sm-company-body').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch { Utils.error('Failed to load company data'); }
};

SMPage.setActiveCompany = async function(id, name) {
  if (!confirm(`Set "${name}" as the active company for all documents?\nThis updates demand letters, receipts, and allotment letters.`)) return;
  try {
    const token = Auth.getToken();
    const res = await fetch(`${ROF.API_BASE}/companies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ write_to_global_settings: true }),
    });
    const json = await res.json();
    if (json.success) Utils.success(`"${name}" is now the active company for all documents`);
    else throw new Error(json.error || 'Failed');
  } catch (err) { Utils.error(err.message); }
};

SMPage.attachLogo = async function() {
  const editingId = (document.getElementById('cm-editing-id')?.value || '').trim() || window._cmEditingId;
  if (!editingId) { Utils.warn('Save the company first before uploading a logo'); return; }
  const fileInput = document.getElementById('cm-logo');
  if (!fileInput?.files[0]) { Utils.warn('Please choose a file first'); return; }
  if (fileInput.files[0].size > 500 * 1024) { Utils.warn('File too large. Max 500KB'); return; }

  const formData = new FormData();
  formData.append('logo', fileInput.files[0]);
  const btn = document.getElementById('cm-attach-btn');
  if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
  try {
    const token = Auth.getToken();
    const res = await fetch(`${ROF.API_BASE}/companies/${editingId}/logo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const json = await res.json();
    if (btn) { btn.textContent = 'ATTACH'; btn.disabled = false; }
    if (json.success) {
      const prev = document.getElementById('cm-logo-preview');
      if (prev) prev.innerHTML = `<img src="${json.logo_url}" style="height:36px;object-fit:contain;border:1px solid #ddd;padding:3px;border-radius:2px;margin-top:4px"> <span style="font-size:11px;color:green;margin-left:6px">✓ Logo attached</span>`;
      Utils.success('Logo uploaded successfully!');
    } else throw new Error(json.error || 'Upload failed');
  } catch (err) {
    if (btn) { btn.textContent = 'ATTACH'; btn.disabled = false; }
    Utils.error(err.message);
  }
};

