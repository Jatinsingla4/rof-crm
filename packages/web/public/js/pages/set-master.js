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
      ${SMPage._doctypePanel()}
    </div>

    <!-- DOCUMENT DISPATCH -->
    <div data-panel-group="sm" data-panel="dispatch" ${tab!=='dispatch'?'style="display:none"':''}>
      ${SMPage._dispatchPanel()}
    </div>
  `;

  // Load country dropdowns for filters
  await SMPage._loadCountryDropdowns();
  await SMPage.load(tab);
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
  <div class="g2" style="gap:16px;align-items:start">
    <div class="sp" style="max-width:360px">
      <div class="sp-hdr"><div class="sp-title">Add Document Type</div></div>
      <div class="sp-body">
        <form id="sm-doctype-form" onsubmit="SMPage.submitDoctype(event)">
          <div class="form-group">
            <label class="form-label">Document Name <span style="color:var(--red)">*</span></label>
            <input class="form-control" type="text" name="name" placeholder="e.g. Allotment Letter" required>
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <select class="form-control" name="category">
              <option value="">Select category</option>
              <option>KYC</option>
              <option>Financial</option>
              <option>Legal</option>
              <option>Operational</option>
              <option>Communication</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-control" name="description" rows="2" placeholder="Optional"></textarea>
          </div>
          <button type="submit" class="btn btn-teal" style="margin-top:8px">Add Type</button>
        </form>
      </div>
    </div>
    <div style="flex:1">
      <div class="tbl-hdr mb8">
        <div class="tbl-title">Document Types</div>
        <div class="tbl-actions">
          <input class="form-control form-control-sm" placeholder="Search..." oninput="SMPage.filterTable('sm-doctype-tbl',this.value)" style="width:160px">
        </div>
      </div>
      <div id="sm-doctype-list"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
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
    doctype:     () => SMPage._loadSimple('doctype',    '/master/document-types',     ['name','category','description'],     ['Document Type','Category','Description']),
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

SMPage.submitDoctype = async function(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());
  try {
    await Api.post('/master/document-types', body);
    Utils.success('Document type added');
    form.reset();
    await SMPage.load('doctype');
  } catch (err) { Utils.error(err.message); }
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

