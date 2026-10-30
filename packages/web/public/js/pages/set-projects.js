// ROF CRM — Set Projects (Project & Unit Configuration)

// Same rule as the server: only super_admin can delete here, so other roles do not see the delete button
const spjCanDelete = () => (Auth.getUser() || {}).role === 'super_admin';

// The Legal & Registration Details block, shared by New Project and Edit Project (ids start with the given prefix)
const spjLegalHtml = (pfx) => `
              <!-- LEGAL DETAILS SECTION -->
              <div class="spjn-sec">
                <div class="spjn-sec-h"><span class="spjn-num">2</span><span class="spjn-sec-t">Legal &amp; Registration Details</span><span class="spjn-sec-s">Used in ATS and Conveyance Deed documents</span></div>

                <!-- GROUP 1: Basic Legal -->
                <div class="spjn-sec-sub">Project Approvals</div>
                <div class="spjn-grid">
                  <div class="fg"><label class="fl">Village Name</label><input class="fc" id="${pfx}-village-name" placeholder="e.g. Village Dharampur"></div>
                  <div class="fg"><label class="fl">Sector Name</label><input class="fc" id="${pfx}-sector-name" placeholder="e.g. Sector-108"></div>
                  <div class="fg"><label class="fl">License Date</label><input type="date" class="fc" id="${pfx}-license-date"></div>
                  <div class="fg"><label class="fl">Env. Clearance No.</label><input class="fc" id="${pfx}-env-clearance-no" placeholder="e.g. SEIAA/HR/2020/72"></div>
                  <div class="fg"><label class="fl">Env. Clearance Date</label><input type="date" class="fc" id="${pfx}-env-clearance-date"></div>
                  <div class="fg"><label class="fl">Building Plan Memo No.</label><input class="fc" id="${pfx}-building-plan-memo" placeholder="e.g. ZP1348/AD(RA)/2019/28186"></div>
                  <div class="fg"><label class="fl">Building Plan Date</label><input type="date" class="fc" id="${pfx}-building-plan-date"></div>
                  <div class="fg"><label class="fl">Khasra Details</label><textarea class="fc" id="${pfx}-khasra-details" rows="3" placeholder="e.g. Rect. No. 1 Killa No. 16/1..."></textarea></div>
                </div>

                <!-- GROUP 2: Land Owner -->
                <div class="spjn-sec-sub">Land Owner Details</div>
                <div class="spjn-grid">
                  <div class="fg"><label class="fl">Land Owner Name</label><input class="fc" id="${pfx}-land-owner-name" placeholder="e.g. M/s MRA Infrastructure..."></div>
                  <div class="fg"><label class="fl">Land Owner LLPIN</label><input class="fc" id="${pfx}-land-owner-llpin" placeholder="e.g. AAO-7853"></div>
                  <div class="fg"><label class="fl">Land Owner PAN</label><input class="fc" id="${pfx}-land-owner-pan" placeholder="e.g. ABLFM2142D"></div>
                  <div class="fg"><label class="fl">Land Owner Address</label><input class="fc" id="${pfx}-land-owner-address" placeholder="e.g. M-18, Greater Kailash-II..."></div>
                  <div class="fg"><label class="fl">GPA/Vasika No.</label><input class="fc" id="${pfx}-gpa-vasika-no" placeholder="e.g. 29"></div>
                  <div class="fg"><label class="fl">GPA Date</label><input type="date" class="fc" id="${pfx}-gpa-date"></div>
                  <div class="fg"><label class="fl">Collab. Agreement Date</label><input type="date" class="fc" id="${pfx}-collab-date"></div>
                </div>

                <!-- GROUP 3: Sale Deed -->
                <div class="spjn-sec-sub">Sale Deed &amp; Registration</div>
                <div class="spjn-grid">
                  <div class="fg"><label class="fl">Sale Deed No.</label><input class="fc" id="${pfx}-sale-deed-no" placeholder="e.g. 4969"></div>
                  <div class="fg"><label class="fl">Sale Deed Date</label><input type="date" class="fc" id="${pfx}-sale-deed-date"></div>
                  <div class="fg"><label class="fl">Sub-Registrar Office</label><input class="fc" id="${pfx}-sub-registrar" placeholder="e.g. Sub-Registrar, Kadipur"></div>
                </div>

                <!-- GROUP 4: OC Details -->
                <div class="spjn-sec-sub">Occupation Certificate Details <span style="font-size:10px;color:var(--text3);font-weight:normal;text-transform:none">(Fill after OC received)</span></div>
                <div class="spjn-grid">
                  <div class="fg"><label class="fl">OC Memo No.</label><input class="fc" id="${pfx}-oc-memo-no" placeholder="e.g. ZP-1348/JD(RD)/2024/29912"></div>
                  <div class="fg"><label class="fl">OC Date</label><input type="date" class="fc" id="${pfx}-oc-date"></div>
                  <div class="fg"><label class="fl">Deed of Declaration Vasika No.</label><input class="fc" id="${pfx}-dod-vasika-no" placeholder="e.g. 9045"></div>
                  <div class="fg"><label class="fl">Deed of Declaration Date</label><input type="date" class="fc" id="${pfx}-dod-date"></div>
                </div>

                <!-- GROUP 5: Authorised Signatory -->
                <div class="spjn-sec-sub">Authorised Signatory</div>
                <div class="spjn-grid">
                  <div class="fg"><label class="fl">Authorised Signatory Name</label><input class="fc" id="${pfx}-auth-signatory-name" placeholder="e.g. Mr. John Smith"></div>
                  <div class="fg"><label class="fl">Authorised Signatory Aadhaar</label><input class="fc" id="${pfx}-auth-signatory-aadhaar" placeholder="e.g. 1234 5678 9012"></div>
                  <div class="fg"><label class="fl">Board Resolution Date</label><input type="date" class="fc" id="${pfx}-board-resolution-date"></div>
                </div>
              </div>

`;
// field id suffix -> name the API takes
const SPJ_LEGAL = { 'village-name': 'villageName', 'sector-name': 'sectorName', 'license-date': 'licenseDate', 'env-clearance-no': 'envClearanceNo', 'env-clearance-date': 'envClearanceDate', 'building-plan-memo': 'buildingPlanMemoNo', 'building-plan-date': 'buildingPlanDate', 'khasra-details': 'khasraDetails', 'land-owner-name': 'landOwnerName', 'land-owner-llpin': 'landOwnerLlpin', 'land-owner-pan': 'landOwnerPan', 'land-owner-address': 'landOwnerAddress', 'gpa-vasika-no': 'landOwnerGpaVasikaNo', 'gpa-date': 'landOwnerGpaDate', 'collab-date': 'collaborationAgreementDate', 'sale-deed-no': 'saleDeedNo', 'sale-deed-date': 'saleDeedDate', 'sub-registrar': 'subRegistrarOffice', 'oc-memo-no': 'occupationCertMemoNo', 'oc-date': 'occupationCertDate', 'dod-vasika-no': 'deedOfDeclarationVasikaNo', 'dod-date': 'deedOfDeclarationDate', 'auth-signatory-name': 'authorisedSignatoryName', 'auth-signatory-aadhaar': 'authorisedSignatoryAadhaar', 'board-resolution-date': 'boardResolutionDate' };
const spjReadLegal = (pfx) => Object.fromEntries(Object.entries(SPJ_LEGAL).map(([id, key]) => [key, (document.getElementById(`${pfx}-${id}`)?.value || '').trim() || null]));

Pages.setProjects = async function(params = {}) {
  // Payment plans have a page of their own now; old bookmarks and links still land there
  if ((params.tab || '').startsWith('plan-')) return Router.navigate('/payment-plans', params.tab === 'plan-new-installment' || params.tab === 'plan-new-plc' || params.tab === 'plan-new-other' ? { new: 1 } : {});
  const tab = params.tab || 'new-project';
  const content = document.getElementById('content');

  const tabBtn = (key, label, active) =>
    `<button class="tab-line${active?' active':''}" data-group="spj" data-tab="${key}"
       onclick="switchTab('spj','${key}');SPJPage.load('${key}')">${label}</button>`;
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Set Projects</h1>
      <div class="breadcrumb">Settings / <b>Project Configuration</b></div>
    </div>

    <div id="spj-guide" class="sp spjn" style="max-width:none;margin-bottom:12px"></div>

    <div style="display:flex;flex-wrap:wrap;gap:8px 26px;border-bottom:1px solid var(--border);margin-bottom:14px;padding-bottom:6px">
      ${[
        ['1 · Project', [['new-project', 'New Project'], ['edit-project', 'Project Details']]],
        ['2 · Structure', [['add-tower', 'Towers'], ['unit-address', 'Unit Types'], ['unit-location', 'Locations']]],
        ['3 · Units', [['add-unit', 'Add Units'], ['edit-unit', 'Edit Unit']]],
      ].map(([cap, items]) => `<div><div style="font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);margin-bottom:2px">${cap}</div><div class="tabs-line" style="border:0;margin:0;padding:0">${items.map(([k, l]) => tabBtn(k, l, tab === k)).join('')}</div></div>`).join('')}
      <div><div style="font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);margin-bottom:2px">4 · Money (opens its own page)</div>
        <div class="tabs-line" style="border:0;margin:0;padding:0">
          <button class="tab-line" onclick="Router.navigate('/payment-plans', { project: SPJPage._guideProject })">Payment Plans ↗</button>
          <button class="tab-line" onclick="Router.navigate('/addon-charge-master')">Other Charges ↗</button>
          <button class="tab-line" onclick="Router.navigate('/interest-master')">Interest ↗</button></div></div>
      ${[
        ['5 · Rules', [['numbering', 'Numbering'], ['customer-class', 'Classification'], ['reminder-master', 'Reminders']]],
        ['Reports', [['rate-report', 'Rate Report']]],
      ].map(([cap, items]) => `<div><div style="font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);margin-bottom:2px">${cap}</div><div class="tabs-line" style="border:0;margin:0;padding:0">${items.map(([k, l]) => tabBtn(k, l, tab === k)).join('')}</div></div>`).join('')}
    </div>

    <!-- NEW PROJECT -->
    <div data-panel-group="spj" data-panel="new-project" ${tab!=='new-project'?'style="display:none"':''}>
      <style>
        .spjn { max-width:980px; margin-left:auto; margin-right:auto }
        .spjn-intro { display:flex; align-items:center; gap:12px; padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
        .spjn-intro-ico { width:36px; height:36px; border-radius:10px; background:var(--teal); color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0 }
        .spjn-intro-t { font-size:14px; font-weight:600; color:var(--text) }
        .spjn-intro-s { font-size:12px; color:var(--text2); margin-top:2px }
        .spjn-sec { padding:18px 18px 4px; border-bottom:1px solid var(--border) }
        .spjn-sec:last-of-type { border-bottom:none }
        .spjn-sec-h { display:flex; align-items:center; gap:10px; margin-bottom:14px }
        .spjn-num { width:22px; height:22px; border-radius:50%; background:var(--teal-bg); color:var(--teal); font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0 }
        .spjn-sec-t { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
        .spjn-sec-s { font-size:11px; color:var(--text3); margin-left:2px }
        .spjn-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px 18px; margin-bottom:18px }
        @media (max-width:640px) { .spjn-grid { grid-template-columns:minmax(0,1fr) } }
        .spjn-full { grid-column:1/-1 }
        .spjn .fg { gap:6px }
        .spjn .fl { font-size:11px; letter-spacing:.3px; color:var(--text2) }
        .spjn .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
        .spjn .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
        .spjn-hint { font-size:11px; color:var(--text3) }
        .spjn-suf { position:relative }
        .spjn-suf .fc { padding-right:48px }
        .spjn-suf > span { position:absolute; right:12px; top:50%; transform:translateY(-50%); font-size:11px; color:var(--text3); pointer-events:none }
        .spjn-foot { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:14px 18px; background:var(--surface2); border-top:1px solid var(--border2) }
        .spjn-note { font-size:11.5px; color:var(--text3) }
        .spjn-note b { color:var(--red) }
        .spjn-foot .btn { padding:8px 20px; font-size:12.5px; border-radius:8px }
        .spjn-wrap { max-width:980px; margin-left:auto; margin-right:auto }
        .spjn-bar { display:flex; align-items:flex-end; flex-wrap:wrap; gap:14px; padding:14px 18px }
        .spjn-bar .fg { flex:1 1 220px; max-width:320px }
        .spjn-bar .btn { padding:9px 20px; font-size:12.5px; border-radius:8px; min-height:38px }
        .spjn-split { display:grid; grid-template-columns:minmax(280px,380px) minmax(0,1fr); gap:18px; align-items:start; max-width:1100px; margin-left:auto; margin-right:auto }
        .spjn-split .spjn { max-width:none; margin:0 }
        .spjn-split-body { padding:18px; display:flex; flex-direction:column; gap:16px }
        .spjn-list { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
        .spjn-list-h { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:12px 18px; background:var(--surface2); border-bottom:1px solid var(--border) }
        .spjn-list-t { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
        .spjn-list-b { padding:6px 4px; overflow-x:auto }
        .spjn-list-h .fc { width:auto; min-width:200px }
        .spjn-sec-sub { font-size:11px; font-weight:600; color:var(--text2); text-transform:uppercase; letter-spacing:.5px; margin:2px 0 12px }
        .spjn-grid-3 { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px 18px; margin-bottom:18px }
        .spjn-grid-1 { display:grid; grid-template-columns:minmax(0,1fr); gap:16px; margin-bottom:18px }
        .spjn-tbl { width:100%; border-collapse:collapse; font-size:12.5px }
        .spjn-tbl th { text-align:left; padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; color:var(--text3); background:var(--surface2); border-bottom:1px solid var(--border2); white-space:nowrap }
        .spjn-tbl td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text); vertical-align:middle }
        .spjn-tbl th.txt-right, .spjn-tbl td.txt-right { text-align:right }
        .spjn-tbl tbody tr:hover td { background:var(--surface2) }
        .spjn-tbl tbody tr:last-child td { border-bottom:none }
        .spjn-tbl .td-bold { font-weight:600 }
        .spjn-del { color:var(--red); border-radius:6px; padding:3px 9px }
        .spjn-del:hover { background:var(--red-bg) }
        .spjn-pill { display:inline-block; background:var(--teal-bg); color:var(--teal); border-radius:999px; padding:2px 8px; margin:1px 2px 1px 0; font-size:10.5px; font-weight:600 }
        .spjn-tscroll { overflow-x:auto }
        .spjn-edit-row { padding:14px; background:var(--surface2); border-radius:8px; display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:12px; align-items:end }
        .spjn-edit-row .fc { padding:8px 10px; font-size:12.5px; border-radius:8px }
        @media (max-width:900px) { .spjn-split { grid-template-columns:minmax(0,1fr) } .spjn-grid-3 { grid-template-columns:repeat(2,minmax(0,1fr)) } }
        @media (max-width:640px) { .spjn-grid-3 { grid-template-columns:minmax(0,1fr) } }
      </style>
      <div class="sp spjn">
        <div class="spjn-intro">
          <div class="spjn-intro-ico">🏗️</div>
          <div>
            <div class="spjn-intro-t">Create New Project</div>
            <div class="spjn-intro-s">Add the project's registration details, location and company. Towers and units can be added afterwards.</div>
          </div>
        </div>
        <form id="spj-new-project-form" onsubmit="SPJPage.createProject(event)">

          <div class="spjn-sec">
            <div class="spjn-sec-h"><span class="spjn-num">1</span><span class="spjn-sec-t">Project Details</span><span class="spjn-sec-s">Name and owning company</span></div>
            <div class="spjn-grid">
              <div class="fg">
                <label class="fl"><span class="r">*</span> Project Name</label>
                <input class="fc" name="name" placeholder="e.g. ROF AALAYAS" required>
              </div>
              <div class="fg">
                <label class="fl"><span class="r">*</span> Company</label>
                <select class="fc" id="spj-new-proj-company" name="companyId" required>
                  <option value="">— Select Company —</option>
                </select>
              </div>
            </div>
          </div>

          <div class="spjn-sec">
            <div class="spjn-sec-h"><span class="spjn-num">2</span><span class="spjn-sec-t">Registration</span><span class="spjn-sec-s">RERA and licence information</span></div>
            <div class="spjn-grid">
              <div class="fg">
                <label class="fl"><span class="r">*</span> RERA Number</label>
                <input class="fc" name="reraNumber" placeholder="RERA/GGM/2024/XXXX" required>
                <span class="spjn-hint">Must be unique for each project</span>
              </div>
              <div class="fg">
                <label class="fl"><span class="r">*</span> TCP Licence No.</label>
                <input class="fc" name="tcpLicence" placeholder="Licence number" required>
              </div>
            </div>
          </div>

          <div class="spjn-sec">
            <div class="spjn-sec-h"><span class="spjn-num">3</span><span class="spjn-sec-t">Location &amp; Scale</span><span class="spjn-sec-s">Where it is and how big it is</span></div>
            <div class="spjn-grid">
              <div class="fg spjn-full">
                <label class="fl">Location / Sector</label>
                <input class="fc" name="location" placeholder="e.g. Sector 93, Gurugram">
              </div>
              <div class="fg">
                <label class="fl">Land Area</label>
                <div class="spjn-suf"><input type="number" class="fc" name="landAreaSqft" placeholder="0" min="0"><span>sqft</span></div>
              </div>
              <div class="fg">
                <label class="fl">Total Units (Planned)</label>
                <div class="spjn-suf"><input type="number" class="fc" name="totalUnits" placeholder="0" min="0"><span>units</span></div>
              </div>
              <div class="fg"><label class="fl">Project Type</label><select class="fc" name="projectType"><option value="">Not set</option>${['Commercial','Residential','Plotting','Group Housing','SCO'].map(x=>`<option>${x}</option>`).join('')}</select></div>
              <div class="fg"><label class="fl">Land Area Unit</label><select class="fc" name="landAreaUnit" id="spj-new-land-unit" data-area-select><option value="">Sq. Ft. (default)</option></select></div>
            </div>
          </div>

          <div class="spjn-sec">
            <div class="spjn-sec-h"><span class="spjn-num">4</span><span class="spjn-sec-t">Schedule &amp; Category</span><span class="spjn-sec-s">Optional</span></div>
            <div class="spjn-grid">
              <div class="fg">
                <label class="fl">Possession Date</label>
                <input type="date" class="fc" name="possessionDate">
              </div>
              <div class="fg">
                <label class="fl">Income Category</label>
                <select class="fc" name="incomeCategory">
                  <option value="">All</option>
                  <option>EWS</option><option>LIG</option><option>MIG</option>
                </select>
              </div>
            </div>
          </div>

          ${spjLegalHtml('spj-new')}

          <div class="spjn-foot">
            <div class="spjn-note"><b>*</b> Required fields. Legal details are optional and can be filled later; they are used in ATS and conveyance deed documents.</div>
            <div style="display:flex;gap:8px">
              <button type="reset" class="btn btn-ghost">Clear</button>
              <button type="submit" class="btn btn-teal">Save Project</button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <!-- EDIT PROJECT -->
    <div data-panel-group="spj" data-panel="edit-project" ${tab!=='edit-project'?'style="display:none"':''}>
      <div class="sp spjn">
        <div class="spjn-bar">
          <div class="fg">
            <label class="fl">Select Project</label>
            <select class="fc" id="spj-edit-project-sel" onchange="SPJPage.loadEditProject()">
              <option value="">— Select Project to Edit —</option>
            </select>
          </div>
        </div>
      </div>
      <div id="spj-edit-project-form-wrap" style="display:none">
        <div class="sp spjn">
          <div class="spjn-intro">
            <div class="spjn-intro-ico">✏️</div>
            <div>
              <div class="spjn-intro-t" id="spj-edit-project-title">Edit Project</div>
              <div class="spjn-intro-s">Update project details and the legal information used in ATS and Conveyance Deed documents.</div>
            </div>
          </div>
          <form id="spj-edit-project-form" onsubmit="SPJPage.updateProject(event)">
              <input type="hidden" id="spj-edit-proj-id">
              <div class="spjn-sec">
                <div class="spjn-sec-h"><span class="spjn-num">1</span><span class="spjn-sec-t">Project Details</span><span class="spjn-sec-s">Name, location and company</span></div>
                <div class="spjn-grid">
                  <div class="fg"><label class="fl">Project Name</label><input class="fc" id="spj-edit-proj-name"></div>
                  <div class="fg"><label class="fl">Company</label><select class="fc" id="spj-edit-proj-company"><option value="">— Select Company —</option></select></div>
                  <div class="fg"><label class="fl">Location</label><input class="fc" id="spj-edit-proj-location"></div>
                  <div class="fg"><label class="fl">Total Units</label><input type="number" class="fc" id="spj-edit-proj-units"></div>
                  <div class="fg"><label class="fl">Project Type</label><select class="fc" id="spj-edit-proj-type"><option value="">Not set</option>${['Commercial','Residential','Plotting','Group Housing','SCO'].map(x=>`<option>${x}</option>`).join('')}</select></div>
                  <div class="fg"><label class="fl">Land Area Unit</label><select class="fc" id="spj-edit-land-unit"><option value="">Not set</option></select></div>
                </div>
              </div>

              ${spjLegalHtml('spj-edit')}

              <div class="spjn-foot">
                <div class="spjn-note">Fields left blank keep their current value</div>
                <button type="submit" class="btn btn-teal">Update Project</button>
              </div>
            </form>
        </div>
      </div>
      <div id="spj-projects-list"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- ADD TOWER/PLOT -->
    <div data-panel-group="spj" data-panel="add-tower" ${tab!=='add-tower'?'style="display:none"':''}>
      <div class="spjn-split">
        <div class="sp spjn">
          <div class="spjn-intro">
            <div class="spjn-intro-ico">🏢</div>
            <div>
              <div class="spjn-intro-t">Add Tower / Plot</div>
              <div class="spjn-intro-s">Add a tower or plot to a project.</div>
            </div>
          </div>
          <form id="spj-tower-form" onsubmit="SPJPage.addTower(event)">
            <div class="spjn-split-body">
              <div class="fg">
                <label class="fl"><span class="r">*</span> Project</label>
                <select class="fc" id="spj-tower-project" required>
                  <option value="">Select Project</option>
                </select>
              </div>
              <div class="fg">
                <label class="fl"><span class="r">*</span> Tower / Plot Name</label>
                <input class="fc" name="towerName" placeholder="e.g. Tower A" required>
              </div>
              <div class="fg"><label class="fl">Prefix for unit address</label><input class="fc" name="addressPrefix" maxlength="20" placeholder="e.g. A-"></div>
              <div class="fg"><label class="fl">Sort order</label><input type="number" class="fc" name="sortOrder" min="0" step="1"></div>
              <div class="fg"><label class="fl">Completion certificate date</label><input type="date" class="fc" name="completionDate"></div>
              <input type="hidden" id="spj-tower-edit-id">
            </div>
            <div class="spjn-foot">
              <div class="spjn-note"><b>*</b> Required fields</div>
              <button type="button" class="btn btn-ghost" id="spj-tower-cancel" style="display:none" onclick="SPJPage.cancelTowerEdit()">Cancel edit</button>
              <button type="submit" class="btn btn-teal" id="spj-tower-save">Add Tower</button>
            </div>
          </form>
        </div>
        <div class="spjn-list">
          <div class="spjn-list-h">
            <div class="spjn-list-t">Tower List</div>
            <select class="fc" id="spj-tower-list-project" onchange="SPJPage.loadTowers()">
              <option value="">All Projects</option>
            </select>
          </div>
          <div class="spjn-list-b" id="spj-towers-list"><div class="page-loading"><div class="spinner"></div></div></div>
        </div>
      </div>
    </div>

    <!-- ADD UNIT -->
    <div data-panel-group="spj" data-panel="add-unit" ${tab!=='add-unit'?'style="display:none"':''}>
      <div class="sp spjn" style="padding:12px 18px">
        <div style="font-size:12px;color:var(--text3);margin-bottom:6px">How many units do you have to add?</div>
        <div id="spj-add-mode" style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn btn-ghost btn-sm" data-mode="one" onclick="SPJPage.addMode('one')">One unit</button>
          <button type="button" class="btn btn-ghost btn-sm" data-mode="many" onclick="SPJPage.addMode('many')">Many: floors and units per floor</button>
          <button type="button" class="btn btn-ghost btn-sm" data-mode="csv" onclick="SPJPage.addMode('csv')">From a CSV file</button>
        </div>
      </div>
      <div id="spj-add-one"><div class="sp spjn">
        <div class="spjn-intro">
          <div class="spjn-intro-ico">🏠</div>
          <div>
            <div class="spjn-intro-t">Add Unit</div>
            <div class="spjn-intro-s">Add a single unit to a project tower. Use the CSV upload below to add many units at once.</div>
          </div>
        </div>
          <form id="spj-unit-form" onsubmit="SPJPage.addUnit(event)">
            <div class="spjn-sec">
              <div class="spjn-sec-h"><span class="spjn-num">1</span><span class="spjn-sec-t">Where and what</span><span class="spjn-sec-s">Pick the unit type first; its areas and price fill in below</span></div>
              <div class="spjn-grid-3">
                <div class="fg"><label class="fl"><span class="r">*</span> Project</label><select class="fc" id="spj-unit-project" required onchange="SPJPage.onUnitProjectChange()"><option value="">Select Project</option></select></div>
                <div class="fg"><label class="fl"><span class="r">*</span> Tower</label><select class="fc" id="spj-unit-tower" required><option value="">Select Tower</option></select></div>
                <div class="fg"><label class="fl"><span class="r">*</span> Unit Type</label><select class="fc" id="spj-unit-type" name="unit_type_id" required onchange="SPJPage.onUnitTypeChange()"><option value="">Select unit type</option></select></div>
              </div>
              <div id="spj-unit-hint" class="spjn-hint" style="margin-top:8px"></div>
            </div>
            <div class="spjn-sec">
              <div class="spjn-sec-h"><span class="spjn-num">2</span><span class="spjn-sec-t">The unit</span></div>
              <div class="spjn-grid-3">
                <div class="fg"><label class="fl"><span class="r">*</span> Unit Number</label><input class="fc" name="unit_number" id="spj-unit-number" placeholder="e.g. A-101" maxlength="50" required></div>
                <div class="fg"><label class="fl"><span class="r">*</span> Floor</label><input type="number" class="fc" name="floor" value="1" min="-5" max="300" step="1" required></div>
                <div class="fg"><label class="fl">Facing</label><select class="fc" name="facing"><option value="">Select</option>${ROF.FACINGS.map(f=>`<option>${f}</option>`).join('')}</select></div>
                <div class="fg"><label class="fl">Location</label><select class="fc" name="unit_location_id" id="spj-unit-location"><option value="">None</option></select></div>
              </div>
            </div>
            <div class="spjn-sec">
              <div class="spjn-sec-h"><span class="spjn-num">3</span><span class="spjn-sec-t">Area and price</span><span class="spjn-sec-s">Filled from the unit type. Change only if this unit is different.</span></div>
              <div class="spjn-grid-3">
                <div class="fg"><label class="fl">Super Area</label><div class="spjn-suf"><input type="number" step="0.0001" min="0" class="fc" id="spj-unit-super" name="super_area_sqft"><span>sqft</span></div></div>
                <div class="fg"><label class="fl">Carpet Area</label><div class="spjn-suf"><input type="number" step="0.0001" min="0" class="fc" id="spj-unit-carpet" name="carpet_area_sqft"><span>sqft</span></div></div>
                <div class="fg"><label class="fl">Balcony Area</label><div class="spjn-suf"><input type="number" step="0.0001" min="0" class="fc" id="spj-unit-balcony" name="balcony_area_sqft"><span>sqft</span></div></div>
                <div class="fg"><label class="fl">Base Price (₹)</label><input type="number" min="0" step="1" class="fc" name="base_price_inr" id="spj-unit-base"></div>
                <div class="fg"><label class="fl">Total Price (₹)</label><input type="number" min="0" step="1" class="fc" name="total_price_inr" id="spj-unit-total"></div>
              </div>
            </div>
            <div class="spjn-sec">
              <div class="spjn-sec-h"><span class="spjn-num">4</span><span class="spjn-sec-t">Charges on this unit</span><span class="spjn-sec-s">Other charges the buyer of this unit pays, like parking</span></div>
              <div id="spj-unit-charges" style="padding:4px 0"></div>
            </div>
            <div class="spjn-foot">
              <div class="spjn-note"><b>*</b> Required. After Add Unit the project, tower and type stay selected, so the next unit is only a number.</div>
              <button type="submit" class="btn btn-teal">Add Unit</button>
            </div>
          </form>
      </div>

      </div>

      <div id="spj-add-csv" style="display:none"><div class="sp spjn">
        <div class="spjn-list-h">
          <div class="spjn-list-t">Bulk Add via CSV</div>
          <button class="btn btn-ghost btn-sm" onclick="Utils.downloadUnitTemplate()">Download Template</button>
        </div>
        <div class="spjn-bar">
          <div class="fg">
            <label class="fl">Project</label>
            <select class="fc" id="spj-bulk-project">
              <option value="">Select Project</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">CSV File</label>
            <input type="file" class="fc" id="spj-bulk-file" accept=".csv,.xlsx">
          </div>
          <button class="btn btn-teal" onclick="SPJPage.bulkAddUnits()">Upload</button>
        </div>
        <div class="spjn-hint" style="padding:0 18px 8px">Enough columns: <b>unitNumber, tower, floor, unitType</b>. The unit type must be one of this project's unit types; it gives the areas and the price. Optional: location (a project location), facing, areas and prices if a unit differs. One wrong row stops the whole file and nothing is saved.</div>
        <div id="spj-bulk-result" style="padding:0 18px 14px"></div>
      </div></div>

      <div id="spj-add-many" style="display:none"><div class="sp spjn">
        <div class="spjn-list-h"><div class="spjn-list-t">Create floors and units for a tower</div></div>
        <form id="spj-gen-form" onsubmit="SPJPage.generateUnits(event)" oninput="SPJPage.genPreview()">
          <div class="spjn-sec"><div class="spjn-grid-3">
            <div class="fg"><label class="fl"><span class="r">*</span> Project</label><select class="fc" id="spj-gen-project" onchange="SPJPage.genProject()" required><option value="">Select Project</option></select></div>
            <div class="fg"><label class="fl"><span class="r">*</span> Tower</label><select class="fc" name="tower" id="spj-gen-tower" required><option value="">Select tower</option></select></div>
            <div class="fg"><label class="fl"><span class="r">*</span> Unit type</label><select class="fc" name="unitType" id="spj-gen-type" required><option value="">Select unit type</option></select></div>
            <div class="fg"><label class="fl">From floor</label><input type="number" class="fc" name="from" value="1" min="-5" max="300" step="1"></div>
            <div class="fg"><label class="fl">To floor</label><input type="number" class="fc" name="to" value="10" min="-5" max="300" step="1"></div>
            <div class="fg"><label class="fl">Units on each floor</label><input type="number" class="fc" name="per" value="4" min="1" max="50" step="1"></div>
            <div class="fg"><label class="fl">Number style</label><select class="fc" name="style"><option value="plain">Floor + 2 digits (101, 102 ... 1001)</option><option value="prefix">Tower prefix + floor + 2 digits (A-101)</option></select></div>
            <div class="fg spjn-full"><div id="spj-gen-preview" style="font-family:monospace"></div></div>
          </div></div>
          <div class="spjn-foot"><div class="spjn-note">Area and price come from the unit type (rate on its rate basis). Numbers that already exist in the tower are skipped. To copy a layout to another tower, run this again for that tower.</div><button class="btn btn-teal" type="submit">Create units</button></div>
        </form>
        <div id="spj-gen-result" style="padding:0 18px 14px"></div>
      </div></div>
    </div>

    <!-- EDIT UNIT -->
    <div data-panel-group="spj" data-panel="edit-unit" ${tab!=='edit-unit'?'style="display:none"':''}>
      <div class="sp spjn">
        <div class="spjn-intro"><div class="spjn-intro-ico">✏️</div><div><div class="spjn-intro-t">Edit Unit</div><div class="spjn-intro-s">Fix a unit's number, floor, facing, location, type, areas or price. A unit that is already booked keeps its number, type, areas and price.</div></div></div>
        <div class="spjn-bar">
          <div class="fg"><label class="fl">Project</label><select class="fc" id="spj-eu-project" onchange="SPJPage.editUnitProject()"><option value="">Select Project</option></select></div>
          <div class="fg"><label class="fl">Tower</label><select class="fc" id="spj-eu-tower" onchange="SPJPage.editUnitTower()"><option value="">Select Tower</option></select></div>
          <div class="fg"><label class="fl">Unit</label><select class="fc" id="spj-eu-unit" onchange="SPJPage.editUnitPick()"><option value="">Select a tower first</option></select></div>
        </div>
        <form id="spj-eu-form" onsubmit="SPJPage.saveUnit(event)" style="display:none">
          <div class="spjn-sec"><div class="spjn-grid-3">
            <div class="fg"><label class="fl"><span class="r">*</span> Unit Number</label><input class="fc" name="unit_number" maxlength="50" required></div>
            <div class="fg"><label class="fl"><span class="r">*</span> Floor</label><input type="number" class="fc" name="floor" min="-5" max="300" step="1" required></div>
            <div class="fg"><label class="fl">Facing</label><select class="fc" name="facing"><option value="">Select</option>${ROF.FACINGS.map(f=>`<option>${f}</option>`).join('')}</select></div>
            <div class="fg"><label class="fl">Unit Type</label><select class="fc" name="unit_type_id" id="spj-eu-type"><option value="">None</option></select></div>
            <div class="fg"><label class="fl">Location</label><select class="fc" name="unit_location_id" id="spj-eu-location"><option value="">None</option></select></div>
          </div></div>
          <div class="spjn-sec"><div class="spjn-grid-3">
            <div class="fg"><label class="fl">Super Area</label><div class="spjn-suf"><input type="number" step="0.0001" min="0" class="fc" name="super_area_sqft"><span>sqft</span></div></div>
            <div class="fg"><label class="fl">Carpet Area</label><div class="spjn-suf"><input type="number" step="0.0001" min="0" class="fc" name="carpet_area_sqft"><span>sqft</span></div></div>
            <div class="fg"><label class="fl">Balcony Area</label><div class="spjn-suf"><input type="number" step="0.0001" min="0" class="fc" name="balcony_area_sqft"><span>sqft</span></div></div>
            <div class="fg"><label class="fl">Base Price (₹)</label><input type="number" min="0" step="1" class="fc" name="base_price_inr"></div>
            <div class="fg"><label class="fl">Total Price (₹)</label><input type="number" min="0" step="1" class="fc" name="total_price_inr"></div>
          </div></div>
          <div class="spjn-sec"><div class="spjn-sec-h"><span class="spjn-sec-t">Charges on this unit</span></div><div id="spj-eu-charges" style="padding:4px 0"></div></div>
          <div class="spjn-foot"><div class="spjn-note" id="spj-eu-note"></div><button type="submit" class="btn btn-teal">Save Unit</button></div>
        </form>
      </div>
      <div class="sp spjn">
        <div class="spjn-intro"><div class="spjn-intro-ico">%</div><div><div class="spjn-intro-t">Change the price of many units</div><div class="spjn-intro-s">For a new phase or a discount: raise or lower the price of the units that are not booked yet, for the project chosen above (and the tower, if one is chosen). Booked units never change.</div></div></div>
        <div class="spjn-sec"><div class="spjn-grid-3">
          <div class="fg"><label class="fl">Only this unit type</label><select class="fc" id="spj-bp-type"><option value="">All types</option></select></div>
          <div class="fg"><label class="fl">Change by</label><select class="fc" id="spj-bp-mode"><option value="percent">Percent (%)</option><option value="amount">Amount (₹)</option></select></div>
          <div class="fg"><label class="fl">Value (minus lowers the price)</label><input type="number" step="0.01" class="fc" id="spj-bp-value" placeholder="e.g. 5 or -2.5"></div>
        </div><div id="spj-bp-result" style="margin-top:10px"></div></div>
        <div class="spjn-foot"><div class="spjn-note">Look at the effect first, then apply.</div><div style="display:flex;gap:8px"><button type="button" class="btn btn-ghost" onclick="SPJPage.bulkPrice(true)">Show the effect</button><button type="button" class="btn btn-teal" onclick="SPJPage.bulkPrice(false)">Apply</button></div></div>
      </div>
    </div>

    <!-- UNIT ADDRESS (UNIT TYPES) -->
    <div data-panel-group="spj" data-panel="unit-address" ${tab!=='unit-address'?'style="display:none"':''}>
      <div class="sp spjn">
        <div class="spjn-intro">
          <div class="spjn-intro-ico">📐</div>
          <div>
            <div class="spjn-intro-t">Define Unit Types (Addresses)</div>
            <div class="spjn-intro-s">Create unit types with their areas and base rate for a project.</div>
          </div>
        </div>
        <form id="spj-unit-type-form" onsubmit="SPJPage.createUnitType(event)" oninput="SPJPage.utAuto(event)">
          <div class="spjn-sec">
            <div class="spjn-sec-h"><span class="spjn-num">1</span><span class="spjn-sec-t">Type Details</span><span class="spjn-sec-s">Project and name</span></div>
            <div class="spjn-grid">
              <div class="fg">
                <label class="fl"><span class="r">*</span> Project</label>
                <select class="fc" id="spj-ut-project" name="project_id" required onchange="SPJPage.loadUnitTypes()">
                  <option value="">Select Project</option>
                </select>
              </div>
              <div class="fg">
                <label class="fl"><span class="r">*</span> Type Name</label>
                <input class="fc" name="name" placeholder="e.g. 2BHK Type-A" required>
              </div>
              <div class="fg"><label class="fl">Group</label><input class="fc" name="group_name" maxlength="100" placeholder="e.g. Shop, Type 4 (2BHK)"></div>
              <div class="fg"><label class="fl">Type</label><select class="fc" name="rate_type"><option>Per Area</option><option>In Fix</option></select></div>
              <div class="fg"><label class="fl">Area type</label><select class="fc" name="area_type"><option>Salable</option><option>Non Salable</option></select></div>
              <div class="fg spjn-full">
                <label class="fl">Description</label>
                <input class="fc" name="description" placeholder="Optional details">
              </div>
            </div>
          </div>
          <div class="spjn-sec">
            <div class="spjn-sec-h"><span class="spjn-num">2</span><span class="spjn-sec-t">Areas</span><span class="spjn-sec-s">Up to 4 decimals</span></div>
            <div class="spjn-grid-3">
              ${[['super_area_sqft','Super Area'],['carpet_area_sqft','Carpet Area'],['balcony_area_sqft','Balcony Area']].map(([n,l])=>`<div class="fg"><label class="fl">${l}</label><div class="spjn-suf"><input type="number" step="0.0001" min="0" class="fc" name="${n}" placeholder="0"><span>${n==='plot_area'?'':'sqft'}</span></div></div>`).join('')}
            </div>
          </div>
          <div class="spjn-sec">
            <div class="spjn-sec-h"><span class="spjn-num">3</span><span class="spjn-sec-t">Rate &amp; payment file</span><span class="spjn-sec-s">Optional</span></div>
            <div class="spjn-grid-3">
              <div class="fg"><label class="fl">Rate</label><div class="spjn-suf"><input type="number" step="0.01" min="0" class="fc" name="base_rate_sqft" placeholder="0"><span>₹</span></div></div>
              <div class="fg"><label class="fl">Effective rate on</label><select class="fc" name="rate_basis"><option>Carpet Area</option><option>Super Area</option><option>Built Up Area</option><option>Plot Area</option></select></div>
              <div class="fg spjn-full"><details id="spj-ut-more"><summary style="cursor:pointer;color:var(--teal);font-weight:600">More options (built-up, UDSL, plot, costs, rate date)</summary>
                <div class="spjn-grid-3" style="margin-top:10px">
                  <div class="fg"><label class="fl">Built-up Area</label><div class="spjn-suf"><input type="number" step="0.0001" min="0" class="fc" name="built_up_area_sqft"><span>sqft</span></div></div>
                  <div class="fg"><label class="fl">UDSL Area</label><div class="spjn-suf"><input type="number" step="0.0001" min="0" class="fc" name="udsl_area_sqft"><span>sqft</span></div></div>
                  <div class="fg"><label class="fl">Plot Area</label><input type="number" step="0.0001" min="0" class="fc" name="plot_area"></div>
                  <div class="fg"><label class="fl">Plot area unit</label><select class="fc" name="plot_area_unit" data-area-select><option value="">Not set</option></select></div>
                  <div class="fg"><label class="fl">Unit of measurement</label><select class="fc" name="unit_of_measurement" data-area-select><option value="">Not set</option></select></div>
                  <div class="fg"><label class="fl">Rate date</label><input type="date" class="fc" name="rate_date"></div>
                  <div class="fg"><label class="fl">Construction cost</label><input type="number" step="0.01" min="0" class="fc" name="construction_cost"></div>
                  <div class="fg"><label class="fl">UDSL cost</label><input type="number" step="0.01" min="0" class="fc" name="udsl_cost"></div>
                </div></details></div>
              <div class="fg spjn-full"><label class="fl">Areas shown on the payment file</label>
                <div id="spj-ut-shown">${['Super Area','Carpet Area','Built Up Area','UDSL Area','Plot Area','Balcony Area'].map(x=>`<label style="margin-right:14px"><input type="checkbox" value="${x}"> ${x}</label>`).join('')}</div></div>
            </div>
          </div>
          <div class="spjn-foot">
            <div class="spjn-note"><b>*</b> Required fields</div>
            <input type="hidden" id="spj-ut-edit-id"><button type="button" class="btn btn-ghost" id="spj-ut-cancel" style="display:none" onclick="SPJPage.cancelUnitTypeEdit()">Cancel edit</button> <button type="submit" class="btn btn-teal" id="spj-ut-save">Add Unit Type</button>
          </div>
        </form>
      </div>
      <div id="spj-unit-types-list" class="spjn-wrap"></div>
    </div>

    <!-- UNIT LOCATION MASTER -->
    <div data-panel-group="spj" data-panel="unit-location" ${tab!=='unit-location'?'style="display:none"':''}>
      <div class="spjn-split">
        <div class="sp spjn">
          <div class="spjn-intro">
            <div class="spjn-intro-ico">📍</div>
            <div>
              <div class="spjn-intro-t">Unit Location Master</div>
              <div class="spjn-intro-s">Define location tags for units, e.g. Corner Flat.</div>
            </div>
          </div>
          <form id="spj-uloc-form" onsubmit="SPJPage.addUnitLocation(event)">
            <div class="spjn-split-body">
              <div class="fg">
                <label class="fl"><span class="r">*</span> Project</label>
                <select class="fc" id="spj-uloc-project" required>
                  <option value="">Select Project</option>
                </select>
              </div>
              <div class="fg">
                <label class="fl"><span class="r">*</span> Location Name</label>
                <input class="fc" name="name" placeholder="e.g. Corner Flat, Park Facing" required>
              </div>
              <div class="fg">
                <label class="fl">Description</label>
                <textarea class="fc" name="description" rows="2" placeholder="Optional"></textarea>
              </div>
            </div>
            <div class="spjn-foot">
              <div class="spjn-note"><b>*</b> Required fields</div>
              <button type="submit" class="btn btn-teal">Add Location</button>
            </div>
          </form>
        </div>
        <div class="spjn-list">
          <div class="spjn-list-h">
            <div class="spjn-list-t">Unit Locations</div>
            <select class="fc" id="spj-uloc-list-project" onchange="SPJPage.loadUnitLocations()">
              <option value="">All Projects</option>
            </select>
          </div>
          <div class="spjn-list-b" id="spj-uloc-list"><div class="page-loading"><div class="spinner"></div></div></div>
        </div>
      </div>
    </div>

    <!-- REMINDER MASTER -->
    <div data-panel-group="spj" data-panel="reminder-master" ${tab!=='reminder-master'?'style="display:none"':''}>
      <div class="spjn-split">
        <div class="sp spjn">
          <div class="spjn-intro">
            <div class="spjn-intro-ico">🔔</div>
            <div>
              <div class="spjn-intro-t">Add Reminder Rule</div>
              <div class="spjn-intro-s">Set the letter name, its prefix, its rank and how many days after the due date it goes out.</div>
            </div>
          </div>
          <form id="spj-reminder-form" onsubmit="SPJPage.addReminder(event)">
            <div class="spjn-split-body">
              <div class="fg">
                <label class="fl">Project</label>
                <select class="fc" id="spj-rem-project" name="project_id" onchange="SPJPage.loadReminders()"><option value="">All projects (general)</option></select>
              </div>
              <div class="fg">
                <label class="fl"><span class="r">*</span> Reminder Name</label>
                <input class="fc" name="name" placeholder="e.g. 15-Day Demand Reminder" required>
              </div>
              <div class="fg">
                <label class="fl"><span class="r">*</span> Days after due date</label>
                <div class="spjn-suf"><input type="number" class="fc" name="days_before" min="0" placeholder="e.g. 15" required><span>days</span></div>
              </div>
              <div class="fg"><label class="fl">Prefix</label><input class="fc" name="prefix_name" maxlength="10" placeholder="e.g. R1"></div>
              <div class="fg"><label class="fl">Rank</label><input type="number" class="fc" name="rank" min="1" step="1" placeholder="1 = first letter"></div>
            </div>
            <div class="spjn-foot">
              <div class="spjn-note"><b>*</b> Required fields</div>
              <button type="submit" class="btn btn-teal">Add Reminder</button>
            </div>
          </form>
        </div>
        <div class="spjn-list">
          <div class="spjn-list-h"><div class="spjn-list-t">Reminder Rules</div></div>
          <div class="spjn-list-b" id="spj-reminder-list"><div class="page-loading"><div class="spinner"></div></div></div>
        </div>
      </div>
    </div>

    <!-- NUMBERING -->
    <div data-panel-group="spj" data-panel="numbering" ${tab!=='numbering'?'style="display:none"':''}>
      <div class="sp spjn">
        <div class="spjn-intro"><div class="spjn-intro-ico">#</div><div><div class="spjn-intro-t">Receipt and registration numbers</div><div class="spjn-intro-s">Automatic numbers itself; Manual asks for the number on the receipt or booking form. Applies to new receipts and bookings only.</div></div></div>
        <div class="spjn-bar"><div class="fg"><label class="fl">Project</label><select class="fc" id="spj-num-project" onchange="SPJPage.loadNumbering()"><option value="">Select Project</option></select></div></div>
        <form id="spj-num-form" onsubmit="SPJPage.saveNumbering(event)" style="display:none">
          <div class="spjn-sec"><div class="spjn-grid">
            <div class="fg"><label class="fl">Receipt numbers</label><select class="fc" name="receipt_number_mode"><option>Automatic</option><option>Manual</option></select></div>
            <div class="fg"><label class="fl">Receipt prefix</label><input class="fc" name="receipt_prefix" maxlength="10" placeholder="REC" oninput="SPJPage.numPreview()"></div>
            <div class="fg"><label class="fl">Registration numbers</label><select class="fc" name="registration_number_mode"><option>Automatic</option><option>Manual</option></select></div>
            <div class="fg"><label class="fl">Registration prefix</label><input class="fc" name="registration_prefix" maxlength="10" placeholder="First 4 letters of the project name" oninput="SPJPage.numPreview()"></div>
            <div class="fg"><label class="fl">Registration number digits</label><input type="number" class="fc" name="registration_number_size" min="3" max="8" step="1" oninput="SPJPage.numPreview()"></div>
            <div class="fg"><label class="fl">Next numbers will look like</label><div id="spj-num-preview" style="padding-top:8px;font-family:monospace"></div></div>
          </div></div>
          <div class="spjn-foot"><div class="spjn-note">Receipt prefix and registration prefix are letters, digits and a dash.</div><button type="submit" class="btn btn-teal">Save</button></div>
        </form>
      </div>
    </div>

    <!-- CUSTOMER CLASSIFICATION -->
    <div data-panel-group="spj" data-panel="customer-class" ${tab!=='customer-class'?'style="display:none"':''}>
      <div class="sp spjn">
        <div class="spjn-intro"><div class="spjn-intro-ico">🏷️</div><div><div class="spjn-intro-t">Customer Classification</div><div class="spjn-intro-s">The list shown on the booking form for this project. A project without its own list uses EWS, LIG and MIG.</div></div></div>
        <div class="spjn-bar"><div class="fg"><label class="fl">Project</label><select class="fc" id="spj-cc-project" onchange="SPJPage.loadClasses()"><option value="">Select Project</option></select></div></div>
        <div id="spj-cc-body" style="padding:14px 18px"></div>
      </div>
    </div>

    <!-- RATE REPORT -->
    <div data-panel-group="spj" data-panel="rate-report" ${tab!=='rate-report'?'style="display:none"':''}>
      <div class="spjn-list spjn-wrap" style="max-width:1100px">
        <div class="spjn-list-h">
          <div class="spjn-list-t">Rate Report — Unit Pricing by Project</div>
          <button class="btn btn-ghost btn-sm" onclick="SPJPage.load('rate-report')">↻ Refresh</button>
        </div>
        <div class="spjn-list-b" id="spj-rate-report"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>
  `;

  // Initialize project dropdowns and load current tab
  await SPJPage.initProjectDropdowns();
  for (const el of document.querySelectorAll('[data-area-select]')) { el.id = el.id || 'spj-as-' + el.name; SPJPage.fillAreaSelect(el.id); }
  await SPJPage.load(tab);
  SPJPage.renderGuide();
};

// ─────────────────────────────────────────────────────────────────────────────
Object.assign(SPJPage, {
  _projects: [],
  _companies: [],

  async initProjectDropdowns(force = false) {
    try {
      this._projects = await window.ProjectCache.load(force);
      this.populateAllDropdowns();
      const cRes = await Api.get('/companies');
      this._companies = (cRes && cRes.data) ? cRes.data : [];
      this._populateCompanyDropdown();
    } catch (err) {
      console.error('[SPJ] initProjectDropdowns failed:', err);
    }
  },

  _populateCompanyDropdown() {
    ['spj-edit-proj-company', 'spj-new-proj-company'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const current = el.value;
      el.innerHTML = `<option value="">— Select Company —</option>` +
        this._companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      if (current) el.value = current;
    });
  },

  populateAllDropdowns() {
    if (!this._projects || this._projects.length === 0) return;
    const opts = this._projects.map(p => `<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');
    ['spj-tower-project','spj-tower-list-project','spj-unit-project','spj-bulk-project',
     'spj-ut-project','spj-eu-project','spj-cc-project','spj-num-project','spj-gen-project','spj-uloc-project','spj-uloc-list-project','spj-edit-project-sel'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const hasBlank = el.options.length > 0 && el.options[0].value === '';
        const blankText = hasBlank ? el.options[0].text : 'Select Project';
        el.innerHTML = (hasBlank || el.options.length === 0 ? `<option value="">${blankText}</option>` : '') + opts;
      }
    });
  },

  async load(tab) {
    this.populateAllDropdowns(); // Ensure dropdowns are populated for the current tab
    this.renderGuide();
    const map = {
      'edit-project':   () => this.loadProjectsList(),
      'add-tower':      () => this.loadTowers(),
      'add-unit':       () => this.addMode(this._addMode || (this._guideUnits === 0 ? 'many' : 'one')),
      'unit-address':   () => this.loadUnitTypes(),
      'unit-location':  () => this.loadUnitLocations(),
      'reminder-master':() => this.loadReminders(),
      'customer-class': () => this.loadClasses(),
      'numbering':      () => this.loadNumbering(),
      'rate-report':    () => this.loadRateReport(),
    };
    if (map[tab]) await map[tab]();
  },

  // ── Projects list for edit tab
  async loadProjectsList() {
    const el = document.getElementById('spj-projects-list');
    if (!el) return;
    el.innerHTML = this._projects.length === 0
      ? `<div class="empty-state"><div class="empty-icon">🏗</div><div>No projects found</div></div>`
      : `<div class="spjn-list" style="max-width:980px;margin:0 auto"><div class="spjn-list-h"><div class="spjn-list-t">All Projects</div><span class="chip chip-blue">${this._projects.length} total</span></div><div class="spjn-tscroll"><table class="dash-tbl spjn-tbl">
          <thead><tr><th>Project</th><th>RERA No.</th><th>Location</th><th>Company</th><th class="txt-right">Units</th><th class="txt-right">Available</th><th class="txt-right">Allotted</th><th>Action</th></tr></thead>
          <tbody>
            ${this._projects.map(p => `<tr>
              <td class="td-bold">${p.name}</td>
              <td class="td-mono">${p.rera_number||'—'}</td>
              <td>${p.location||'—'}</td>
              <td>${p.company_name||'—'}</td>
              <td class="txt-right">${p.unit_count||0}</td>
              <td class="txt-right" style="color:var(--green)">${p.available_units||0}</td>
              <td class="txt-right" style="color:var(--blue)">${p.allotted_units||0}</td>
              <td><button class="btn btn-ghost btn-sm" onclick="SPJPage.prepareEditProject('${p.id}')">Edit</button></td>
            </tr>`).join('')}
          </tbody>
        </table></div></div>`;
  },

  async prepareEditProject(id) {
    try {
      const res = await Api.get(`/projects/${id}`);
      if (res && res.data) {
        this.selectProjectForEdit(id, res.data);
        document.getElementById('spj-edit-project-sel').value = id;
      }
    } catch (err) {
      Utils.error('Failed to load project: ' + err.message);
    }
  },

  selectProjectForEdit(id, projectData) {
    const p = projectData;
    document.getElementById('spj-edit-project-sel').value = id;
    document.getElementById('spj-edit-proj-id').value = id;
    document.getElementById('spj-edit-proj-name').value = p.name || '';
    document.getElementById('spj-edit-proj-location').value = p.location || '';
    document.getElementById('spj-edit-proj-units').value = p.total_units || 0;
    document.getElementById('spj-edit-proj-type').value = p.project_type || '';
    this.fillAreaSelect('spj-edit-land-unit', p.land_area_unit);

    // Helper to format dates
    const fmtDate = (d) => {
      if (!d) return '';
      return /^\d{4}-\d{2}-\d{2}/.test(d) ? String(d).slice(0,10) : new Date(d).toISOString().slice(0,10);
    };

    // Load legal fields
    document.getElementById('spj-edit-village-name').value = p.village_name || '';
    document.getElementById('spj-edit-sector-name').value = p.sector_name || '';
    document.getElementById('spj-edit-license-date').value = fmtDate(p.license_date);
    document.getElementById('spj-edit-env-clearance-no').value = p.env_clearance_no || '';
    document.getElementById('spj-edit-env-clearance-date').value = fmtDate(p.env_clearance_date);
    document.getElementById('spj-edit-building-plan-memo').value = p.building_plan_memo_no || '';
    document.getElementById('spj-edit-building-plan-date').value = fmtDate(p.building_plan_date);
    document.getElementById('spj-edit-khasra-details').value = p.khasra_details || '';
    document.getElementById('spj-edit-land-owner-name').value = p.land_owner_name || '';
    document.getElementById('spj-edit-land-owner-llpin').value = p.land_owner_llpin || '';
    document.getElementById('spj-edit-land-owner-pan').value = p.land_owner_pan || '';
    document.getElementById('spj-edit-land-owner-address').value = p.land_owner_address || '';
    document.getElementById('spj-edit-gpa-vasika-no').value = p.land_owner_gpa_vasika_no || '';
    document.getElementById('spj-edit-gpa-date').value = fmtDate(p.land_owner_gpa_date);
    document.getElementById('spj-edit-collab-date').value = fmtDate(p.collaboration_agreement_date);
    document.getElementById('spj-edit-sale-deed-no').value = p.sale_deed_no || '';
    document.getElementById('spj-edit-sale-deed-date').value = fmtDate(p.sale_deed_date);
    document.getElementById('spj-edit-sub-registrar').value = p.sub_registrar_office || '';
    document.getElementById('spj-edit-oc-memo-no').value = p.occupation_cert_memo_no || '';
    document.getElementById('spj-edit-oc-date').value = fmtDate(p.occupation_cert_date);
    document.getElementById('spj-edit-dod-vasika-no').value = p.deed_of_declaration_vasika_no || '';
    document.getElementById('spj-edit-dod-date').value = fmtDate(p.deed_of_declaration_date);
    document.getElementById('spj-edit-auth-signatory-name').value = p.authorised_signatory_name || '';
    document.getElementById('spj-edit-auth-signatory-aadhaar').value = p.authorised_signatory_aadhaar || '';
    document.getElementById('spj-edit-board-resolution-date').value = fmtDate(p.board_resolution_date);
    this._populateCompanyDropdown();
    document.getElementById('spj-edit-proj-company').value = p.company_id || '';

    document.getElementById('spj-edit-project-title').textContent = `Edit: ${p.name}`;
    document.getElementById('spj-edit-project-form-wrap').style.display = '';
  },

  async loadEditProject() {
    const id = document.getElementById('spj-edit-project-sel')?.value;
    if (!id) return;
    try {
      const res = await Api.get(`/projects/${id}`);
      if (res && res.data) {
        this.selectProjectForEdit(id, res.data);
      }
    } catch (err) {
      Utils.error('Failed to load project: ' + err.message);
    }
  },

  async updateProject(e) {
    e.preventDefault();
    const id   = document.getElementById('spj-edit-proj-id').value;
    const name = document.getElementById('spj-edit-proj-name').value.trim();
    const loc  = document.getElementById('spj-edit-proj-location').value.trim();
    const units = document.getElementById('spj-edit-proj-units').value;

    const companyId = document.getElementById('spj-edit-proj-company').value || null;

    try {
      await Api.patch(`/projects/${id}`, {
        name,
        location: loc,
        totalUnits: parseInt(units)||null,
        ...spjReadLegal('spj-edit'),
        companyId,
      });
      await Api.patch(`/projects/${id}/card`, { projectType: document.getElementById('spj-edit-proj-type').value || null, landAreaUnit: document.getElementById('spj-edit-land-unit').value || null });
      Utils.success('Project updated');
      await this.initProjectDropdowns(true);
      await this.loadProjectsList();
    } catch (err) { Utils.error(err.message); }
  },

  async createProject(e) {
    e.preventDefault();
    const form = e.target;
    const body = Object.fromEntries([...new FormData(form).entries()].filter(([k, v]) => v !== '' && !k.startsWith('spj-new-') && k !== 'projectType' && k !== 'landAreaUnit'));
    let made;
    try {
      made = (await Api.post('/projects', body)).data;
    } catch (err) { Utils.error(err.message); return; }
    // The rest of the form (project type, land area unit, legal details) is saved on the new project in the same click
    const legal = Object.fromEntries(Object.entries(spjReadLegal('spj-new')).filter(([, v]) => v));
    const card = { projectType: form.elements.projectType.value || null, landAreaUnit: form.elements.landAreaUnit.value || null };
    try {
      if (Object.keys(legal).length) await Api.patch(`/projects/${made.id}`, legal);
      if (card.projectType || card.landAreaUnit) await Api.patch(`/projects/${made.id}/card`, card);
      Utils.success(`Project "${body.name}" created`);
    } catch (err) { Utils.warn(`Project "${body.name}" was created, but some details were not saved (${err.message}). Open Edit Project to fix them.`); }
    form.reset();
    await this.initProjectDropdowns(true);
  },

  // ── Towers
  async loadTowers() {
    const el = document.getElementById('spj-towers-list');
    if (!el) return;
    const projectId = document.getElementById('spj-tower-list-project')?.value;
    try {
      const projects = projectId ? [{ id: projectId }] : this._projects;
      if (!projects.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">🏢</div><div>No projects</div></div>`; return; }
      const rows = [];
      this._towerRows = {};
      for (const p of projects) {
        const res = await Api.get(`/projects/${p.id}/towers`);
        (res.data||[]).forEach(t => { this._towerRows[t.id] = t; rows.push({ ...t, project_name: this._projects.find(pr=>pr.id===p.id)?.name || '' }); });
      }
      el.innerHTML = rows.length === 0
        ? `<div class="empty-state"><div class="empty-icon">🏢</div><div>No tower yet. Add the first one with the form on the left; a plot project uses one "tower" per block.</div></div>`
        : `<table class="dash-tbl spjn-tbl">
            <thead><tr><th>Project</th><th>Tower/Plot</th><th>Prefix</th><th class="txt-right">Sort</th><th>Completion</th><th class="txt-right">Units</th><th>Action</th></tr></thead>
            <tbody>
              ${rows.map(r=>`<tr>
                <td>${Utils.esc(r.project_name)||'—'}</td>
                <td class="td-bold">${Utils.esc(r.tower_name)||'—'}</td>
                <td>${Utils.esc(r.address_prefix)||'—'}</td>
                <td class="txt-right">${r.sort_order ?? '—'}</td>
                <td>${Utils.esc(r.completion_date)||'—'}</td>
                <td class="txt-right">${r.unit_count||0}</td>
                <td><button class="btn btn-ghost btn-xs" onclick="SPJPage.editTower('${r.id}')">Edit</button> ${spjCanDelete() ? `<button class="btn btn-ghost btn-xs spjn-del" onclick="SPJPage.deleteTower(this,'${r.id}','${r.project_id}')">✕</button>` : ''}</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  },

  async addTower(e) {
    e.preventDefault();
    const form = e.target;
    const projectId = document.getElementById('spj-tower-project').value;
    const towerName = form.querySelector('[name="towerName"]').value.trim();
    if (!projectId || !towerName) { Utils.warn('Project and tower name are required'); return; }
    try {
      const f = form.elements, extra = { addressPrefix: f.addressPrefix.value.trim() || null, sortOrder: f.sortOrder.value === '' ? null : Number(f.sortOrder.value), completionDate: f.completionDate.value || null };
      const editId = document.getElementById('spj-tower-edit-id').value;
      if (editId) await Api.patch(`/projects/${projectId}/towers/${editId}`, { towerName, ...extra });
      else {
        const r = await Api.post(`/projects/${projectId}/towers`, { towerName });
        if (extra.addressPrefix || extra.sortOrder != null || extra.completionDate) await Api.patch(`/projects/${projectId}/towers/${r.data?.id}`, extra);
      }
      Utils.success(editId ? `Tower "${towerName}" saved` : `Tower "${towerName}" added`);
      this.cancelTowerEdit();
      document.getElementById('spj-tower-project').value = projectId;
      await this.loadTowers();
    } catch (err) { Utils.error(err.message); }
  },

  editTower(id) {
    const t = this._towerRows?.[id]; if (!t) return;
    const f = document.getElementById('spj-tower-form').elements;
    document.getElementById('spj-tower-project').value = t.project_id;
    f.towerName.value = t.tower_name || ''; f.addressPrefix.value = t.address_prefix || ''; f.sortOrder.value = t.sort_order ?? ''; f.completionDate.value = t.completion_date || '';
    document.getElementById('spj-tower-edit-id').value = id;
    document.getElementById('spj-tower-save').textContent = 'Save Tower';
    document.getElementById('spj-tower-cancel').style.display = '';
  },

  cancelTowerEdit() {
    const form = document.getElementById('spj-tower-form'), pid = document.getElementById('spj-tower-project').value;
    form.reset(); document.getElementById('spj-tower-project').value = pid;
    document.getElementById('spj-tower-edit-id').value = '';
    document.getElementById('spj-tower-save').textContent = 'Add Tower';
    document.getElementById('spj-tower-cancel').style.display = 'none';
  },

  async deleteTower(btn, towerId, projectId) {
    if (!confirm('Delete this tower?')) return;
    try {
      await Api.delete(`/projects/${projectId}/towers/${towerId}`);
      btn.closest('tr').remove();
      Utils.success('Tower deleted');
    } catch (err) { Utils.error(err.message); }
  },

  // ── Units
  // Add Unit and Edit Unit share these: towers, unit types and locations of a project
  async unitLookups(projectId, sel) {
    const [tw, ty, lc] = await Promise.all([
      Api.get(`/projects/${projectId}/towers`).catch(() => ({ data: [] })),
      Api.get(`/master/unit-types?project_id=${encodeURIComponent(projectId)}`).catch(() => ({ data: [] })),
      Api.get(`/projects/${projectId}/unit-locations`).catch(() => ({ data: [] })),
    ]);
    this._unitTypes = Object.fromEntries((ty.data || []).map(x => [x.id, x]));
    try { this._unitMasters = (await Api.get(`/addon-charges/master?projectId=${projectId}`)).data || []; } catch { this._unitMasters = []; }
    if (sel.charges) this.renderUnitCharges(sel.charges, [], false);
    const fill = (id, rows, label, nameOf) => { const el = document.getElementById(id); if (el) el.innerHTML = `<option value="">${label}</option>` + rows.map(x => `<option value="${x.id}">${Utils.esc(nameOf(x))}</option>`).join(''); };
    fill(sel.tower, tw.data || [], 'Select Tower', x => x.tower_name);
    fill(sel.type, ty.data || [], 'Select unit type', x => x.name);
    fill(sel.location, lc.data || [], 'None', x => x.name);
    return { towers: tw.data || [], types: ty.data || [] };
  },

  // The project's other charges as rows: tick to attach, quantity where the charge allows more than one; Mandatory ones are shown ticked and fixed
  renderUnitCharges(boxId, attached = [], locked = false) {
    const box = document.getElementById(boxId), ms = this._unitMasters || [], qty = Object.fromEntries(attached.map(a => [a.charge_master_id, a.quantity]));
    if (!box) return;
    box.innerHTML = ms.length ? ms.map(m => {
      const price = m.rate_type === 'per_sqft' ? `₹${Number(m.rate_per_sqft_inr).toLocaleString('en-IN')}/sqft` : `₹${Number(m.default_amount).toLocaleString('en-IN')}`;
      const on = m.is_mandatory || m.id in qty;
      return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)"><label style="display:flex;align-items:center;gap:8px;flex:1;margin:0"><input type="checkbox" data-charge="${m.id}" ${on ? 'checked' : ''} ${m.is_mandatory || locked ? 'disabled' : ''}> <b>${Utils.esc(m.charge_name)}</b> <span style="color:var(--text3)">${price}</span>${m.is_mandatory ? ' <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:var(--teal-bg);color:var(--teal)">Mandatory: on every booking</span>' : ''}${m.plan_pct_rows ? '' : ' <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:#fff3cd;color:#8a6d00" title="Set its % in Payment Plans, otherwise no installment bills it">not in any plan yet</span>'}</label>${m.multiple_booking && !m.is_mandatory ? `<label style="margin:0">Qty <input type="number" class="fc" data-qty="${m.id}" min="1" max="20" step="1" value="${qty[m.id] || 1}" style="width:70px;display:inline-block" ${locked ? 'disabled' : ''}></label>` : ''}</div>`;
    }).join('') : '<div class="spjn-hint">This project has no other charges yet. Add them in Add-on Charge Master.</div>';
  },
  readUnitCharges(boxId) {
    return [...document.querySelectorAll(`#${boxId} input[data-charge]:checked:not(:disabled)`)].map(c => ({ chargeMasterId: c.dataset.charge, quantity: Number(document.querySelector(`#${boxId} input[data-qty="${c.dataset.charge}"]`)?.value || 1) }));
  },

  async onUnitProjectChange() {
    const projectId = document.getElementById('spj-unit-project')?.value, hint = document.getElementById('spj-unit-hint');
    if (!projectId) return;
    const r = await this.unitLookups(projectId, { tower: 'spj-unit-tower', type: 'spj-unit-type', location: 'spj-unit-location', charges: 'spj-unit-charges' });
    hint.innerHTML = !r.towers.length ? 'This project has no tower yet. <a href="javascript:void 0" onclick="switchTab(\'spj\',\'add-tower\');SPJPage.load(\'add-tower\')">Add a tower</a> first.'
      : !r.types.length ? 'This project has no unit type yet. <a href="javascript:void 0" onclick="switchTab(\'spj\',\'unit-address\');SPJPage.load(\'unit-address\')">Create a unit type</a> first; units take their areas and price from it.' : '';
    if (r.towers.length === 1) document.getElementById('spj-unit-tower').value = r.towers[0].id;
  },

  // The unit type fills areas and the price (rate x the area it is charged on); the person only changes what is different
  onUnitTypeChange(pfx = 'spj-unit') {
    const t = this._unitTypes?.[document.getElementById(`${pfx}-type`).value]; if (!t) return;
    const set = (id, v) => { document.getElementById(`${pfx}-${id}`).value = v == null || v === '' ? '' : v; };
    set('super', t.super_area_sqft); set('carpet', t.carpet_area_sqft); set('balcony', t.balcony_area_sqft);
    const area = { 'Super Area': t.super_area_sqft, 'Carpet Area': t.carpet_area_sqft, 'Built Up Area': t.built_up_area_sqft, 'Plot Area': t.plot_area }[t.rate_basis];
    const price = t.base_rate_sqft && area ? Math.round(Number(t.base_rate_sqft) * Number(area)) : '';
    set('base', price); set('total', price);
  },

  async addUnit(e) {
    e.preventDefault();
    const form = e.target, f = form.elements, projectId = document.getElementById('spj-unit-project').value, num = (v) => v === '' ? undefined : Number(v);
    const body = {
      projectId, towerId: document.getElementById('spj-unit-tower').value, unitTypeId: f.unit_type_id.value, unitNumber: f.unit_number.value.trim(), floor: Number(f.floor.value),
      facing: f.facing.value || undefined, unitLocationId: f.unit_location_id.value || undefined,
      superAreaSqft: num(f.super_area_sqft.value), carpetAreaSqft: num(f.carpet_area_sqft.value), balconyAreaSqft: num(f.balcony_area_sqft.value),
      basePriceInr: num(f.base_price_inr.value), totalPriceInr: num(f.total_price_inr.value), charges: this.readUnitCharges('spj-unit-charges'),
    };
    if (!body.towerId || !body.unitTypeId) { Utils.warn('Choose the tower and the unit type'); return; }
    try {
      await Api.post('/units', body);
      Utils.success(`Unit ${body.unitNumber} added`);
      // keep the place and the type; suggest the next number (A-101 -> A-102)
      const next = body.unitNumber.replace(/(\d+)(\D*)$/, (_, d, rest) => String(Number(d) + 1).padStart(d.length, '0') + rest);
      f.unit_number.value = next === body.unitNumber ? '' : next; f.unit_number.focus(); f.unit_number.select();
    } catch (err) { Utils.error(err.message); }
  },

  // ── Setup guide: what a project still needs, and one click to the screen that does it
  async renderGuide() {
    const el = document.getElementById('spj-guide'); if (!el) return;
    const projects = this._projects || [];
    if (!projects.length) { el.innerHTML = '<div class="spjn-intro"><div class="spjn-intro-ico">1</div><div><div class="spjn-intro-t">Start here</div><div class="spjn-intro-s">Create the project in the New Project tab. This guide then shows what is left to set up.</div></div></div>'; return; }
    let pid = this._guideProject;
    if (!projects.some(p => p.id === pid)) pid = projects[0].id;
    this._guideProject = pid;
    const count = async (path, pick = (r) => (r.data || []).length) => { try { return pick(await Api.get(path)); } catch { return null; } };
    const [towers, types, units, plans, rates, st] = await Promise.all([
      count(`/projects/${pid}/towers`), count(`/master/unit-types?project_id=${pid}`), count(`/units?projectId=${pid}&pageSize=1000`),
      count(`/projects/${pid}/plans`, (r) => (r.data || []).filter(x => x.complete).length), count(`/payments/interest-master/${pid}`), count(`/projects/${pid}/settings`, (r) => r.data),
    ]);
    const go = (tab) => `switchTab('spj','${tab}');SPJPage.load('${tab}')`, nav = (route) => `Router.navigate('${route}', { project: '${pid}' })`;
    const steps = [
      ['Towers', towers, go('add-tower'), true], ['Unit types', types, go('unit-address'), true], ['Units', units, go('add-unit'), true],
      ['Payment plans (complete)', plans, nav('/payment-plans'), true], ['Interest rate', rates, nav('/interest-master'), true], ['Numbering (optional)', null, go('numbering'), false],
    ];
    this._guideUnits = units;
    if (!this._addMode && document.querySelector('[data-panel="add-unit"]')?.style.display !== 'none') this.addMode(units === 0 ? 'many' : 'one');
    const next = steps.find(x => x[3] && !x[1]);
    const tile = ([label, n, action, need], i) => {
      const done = !!n, isNext = next && next[0] === label;
      return `<button type="button" onclick="${action}" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;padding:9px 12px;border-radius:10px;cursor:pointer;background:var(--surface);border:1.5px solid ${isNext ? 'var(--teal)' : 'var(--border2)'};${isNext ? 'box-shadow:0 0 0 3px var(--teal-bg);' : ''}color:var(--text);font:inherit">
        <span style="font-size:11px;color:var(--text3);display:flex;align-items:center;gap:6px"><span style="width:16px;height:16px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;${done ? 'background:var(--teal);color:#fff' : 'background:var(--surface2);color:var(--text3)'}">${done ? '✓' : i + 1}</span>${need ? 'Step ' + (i + 1) : 'Optional'}</span>
        <span style="font-weight:600;font-size:13px">${label.replace(' (complete)', '').replace(' (optional)', '')}</span>
        <span style="font-size:12px;color:${done ? 'var(--teal)' : 'var(--text3)'}">${done ? n + (label.startsWith('Payment') ? ' complete' : '') : need ? 'Not done yet' : 'Prefixes, manual numbers'}</span>
      </button>`;
    };
    el.innerHTML = `<div style="padding:14px 18px;display:grid;grid-template-columns:minmax(220px,260px) 1fr;gap:16px;align-items:end">
        <div class="fg" style="margin:0"><label class="fl">Setting up</label><select class="fc" onchange="SPJPage._guideProject=this.value;SPJPage.renderGuide()">${projects.map(p => `<option value="${p.id}"${p.id === pid ? ' selected' : ''}>${Utils.esc(p.name)}</option>`).join('')}</select></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px">${steps.map(tile).join('')}</div>
      </div>
      <div class="spjn-hint" style="padding:0 18px 14px">${next ? `Next: <b>${next[0].replace(' (complete)', '')}</b>. ` : 'Everything needed to start booking is set up. '}Order: towers, unit types, units (or generate them), a complete payment plan, the interest rate.</div>`;
  },

  // ── Edit Unit
  async editUnitProject() {
    const projectId = document.getElementById('spj-eu-project').value;
    document.getElementById('spj-eu-form').style.display = 'none';
    if (!projectId) return;
    await this.unitLookups(projectId, { tower: 'spj-eu-tower', type: 'spj-eu-type', location: 'spj-eu-location', charges: 'spj-eu-charges' });
    document.getElementById('spj-bp-type').innerHTML = '<option value="">All types</option>' + Object.values(this._unitTypes || {}).map(t => `<option value="${t.id}">${Utils.esc(t.name)}</option>`).join('');
    document.getElementById('spj-eu-unit').innerHTML = '<option value="">Select a tower first</option>';
  },
  async bulkPrice(preview) {
    const f = (id) => document.getElementById(id), projectId = f('spj-eu-project').value, value = Number(f('spj-bp-value').value), box = f('spj-bp-result');
    if (!projectId) { Utils.warn('Choose the project at the top of this tab'); return; }
    if (!value) { Utils.warn('Enter a value, for example 5 or -2.5'); return; }
    const body = { projectId, towerId: f('spj-eu-tower').value || undefined, unitTypeId: f('spj-bp-type').value || undefined, mode: f('spj-bp-mode').value, value, preview };
    if (!preview && !confirm('Change the price of these units now?')) return;
    try {
      const r = (await Api.post('/units/bulk-price', body)).data, inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
      box.innerHTML = `<div class="alert ${preview ? '' : 'alert-success'}">${preview ? '' : '✓ '}${r.units} unit(s) ${preview ? 'would change' : 'changed'}${r.sample ? `, for example ${inr(r.sample.before)} becomes ${inr(r.sample.after)}` : ''}.</div>`;
    } catch (err) { box.innerHTML = `<div class="alert alert-danger">${Utils.esc(err.message)}</div>`; }
  },
  async editUnitTower() {
    const pid = document.getElementById('spj-eu-project').value, tid = document.getElementById('spj-eu-tower').value, el = document.getElementById('spj-eu-unit');
    document.getElementById('spj-eu-form').style.display = 'none';
    if (!tid) { el.innerHTML = '<option value="">Select a tower first</option>'; return; }
    try {
      const rows = (await Api.get(`/units?projectId=${pid}&towerId=${tid}&pageSize=1000`)).data || [];
      el.innerHTML = '<option value="">Select a unit</option>' + rows.map(u => `<option value="${u.id}">${Utils.esc(u.unit_number)} · floor ${u.floor ?? '-'} · ${Utils.esc(u.status)}</option>`).join('');
    } catch (err) { Utils.error(err.message); }
  },
  async editUnitPick() {
    const id = document.getElementById('spj-eu-unit').value, form = document.getElementById('spj-eu-form');
    form.style.display = id ? '' : 'none';
    if (!id) return;
    try {
      const u = (await Api.get(`/units/${id}`)).data, f = form.elements;
      this._euUnit = u;
      f.unit_number.value = u.unit_number; f.floor.value = u.floor ?? ''; f.facing.value = u.facing || ''; f.unit_type_id.value = u.unit_type_id || ''; f.unit_location_id.value = u.unit_location_id || '';
      const v = (x) => x == null ? '' : Number(x);
      f.super_area_sqft.value = v(u.super_area_sqft); f.carpet_area_sqft.value = v(u.carpet_area_sqft); f.balcony_area_sqft.value = v(u.balcony_area_sqft); f.base_price_inr.value = v(u.base_price_inr); f.total_price_inr.value = v(u.total_price_inr);
      const sold = !['available', 'locked', 'held'].includes(u.status);
      const ch = (await Api.get(`/units/${id}/charges`)).data; this.renderUnitCharges('spj-eu-charges', ch.attached, sold);
      for (const k of ['unit_number', 'unit_type_id', 'super_area_sqft', 'carpet_area_sqft', 'balcony_area_sqft', 'base_price_inr', 'total_price_inr']) f[k].disabled = sold;
      document.getElementById('spj-eu-note').textContent = sold ? `This unit is ${u.status}: its number, type, areas and price are fixed because the booking was made from them. Floor, facing and location can still change.` : '';
    } catch (err) { Utils.error(err.message); }
  },
  async saveUnit(e) {
    e.preventDefault();
    const f = e.target.elements, u = this._euUnit, num = (v) => v === '' ? undefined : Number(v), body = { floor: Number(f.floor.value), facing: f.facing.value || null, unitLocationId: f.unit_location_id.value || null };
    if (!f.unit_number.disabled) Object.assign(body, { unitNumber: f.unit_number.value.trim(), unitTypeId: f.unit_type_id.value || null, superAreaSqft: num(f.super_area_sqft.value), carpetAreaSqft: num(f.carpet_area_sqft.value), balconyAreaSqft: num(f.balcony_area_sqft.value), basePriceInr: num(f.base_price_inr.value), totalPriceInr: num(f.total_price_inr.value) });
    try {
      await Api.patch(`/units/${u.id}`, body);
      if (['available', 'locked', 'held'].includes(u.status)) await Api.put(`/units/${u.id}/charges`, { charges: this.readUnitCharges('spj-eu-charges') });
      Utils.success('Unit saved');
      const tower = document.getElementById('spj-eu-tower').value; await this.editUnitTower(); document.getElementById('spj-eu-tower').value = tower; document.getElementById('spj-eu-unit').value = u.id; await this.editUnitPick();
    } catch (err) { Utils.error(err.message); }
  },

  async bulkAddUnits() {
    const file      = document.getElementById('spj-bulk-file')?.files[0];
    const projectId = document.getElementById('spj-bulk-project')?.value;
    const result    = document.getElementById('spj-bulk-result');
    if (!file) { Utils.warn('Please select a CSV file'); return; }
    if (!projectId) { Utils.warn('Please select a project'); return; }
    result.innerHTML = '<div class="page-loading"><div class="spinner"></div>Importing...</div>';
    try {
      // Read CSV file as text
      const csvText = await file.text();
      // Send to import endpoint
      const res = await Api.post('/import', {
        csvText,
        projectId,
        importType: 'units',
        fileName: file.name
      });
      const data = res.data || res;
      result.innerHTML = `<div class="alert alert-success">✓ ${data.created||0} units added · ${data.skipped||0} skipped · ${data.errors?.length||0} errors</div>`;
      // Reset file input
      document.getElementById('spj-bulk-file').value = '';
    } catch (err) {
      result.innerHTML = `<div class="alert alert-error">Import failed: ${err.message}</div>`;
    }
  },

  // ── Unit Locations
  async loadUnitLocations() {
    const el = document.getElementById('spj-uloc-list');
    if (!el) return;
    const projectId = document.getElementById('spj-uloc-list-project')?.value;
    try {
      const projects = projectId ? [{ id: projectId }] : this._projects;
      const rows = [];
      for (const p of projects) {
        const res = await Api.get(`/projects/${p.id}/unit-locations`);
        (res.data||[]).forEach(loc => rows.push({ ...loc, project_name: this._projects.find(pr=>pr.id===p.id)?.name||'' }));
      }
      el.innerHTML = rows.length === 0
        ? `<div class="empty-state"><div class="empty-icon">📍</div><div>No unit locations</div></div>`
        : `<table class="dash-tbl spjn-tbl">
            <thead><tr><th>Project</th><th>Location Name</th><th>Description</th><th>Action</th></tr></thead>
            <tbody>
              ${rows.map(r=>`<tr>
                <td>${Utils.esc(r.project_name)||'—'}</td>
                <td class="td-bold">${Utils.esc(r.name)}</td>
                <td>${Utils.esc(r.description)||'—'}</td>
                <td>${spjCanDelete() ? `<button class="btn btn-ghost btn-xs spjn-del" onclick="SPJPage.deleteUnitLocation(this,'${r.id}','${r.project_id}')">✕</button>` : ''}</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  },

  async addUnitLocation(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    const projectId = document.getElementById('spj-uloc-project')?.value;
    if (!projectId) { Utils.warn('Select a project'); return; }
    try {
      await Api.post(`/projects/${projectId}/unit-locations`, body);
      Utils.success('Location added');
      form.reset();
      await this.loadUnitLocations();
    } catch (err) { Utils.error(err.message); }
  },

  async deleteUnitLocation(btn, locId, projectId) {
    if (!confirm('Delete this location?')) return;
    try {
      await Api.delete(`/projects/${projectId}/unit-locations/${locId}`);
      btn.closest('tr').remove();
      Utils.success('Deleted');
    } catch (err) { Utils.error(err.message); }
  },

  // ── Reminders
  async loadReminders() {
    const el = document.getElementById('spj-reminder-list');
    if (!el) return;
    try {
      const rp = document.getElementById('spj-rem-project');
      if (rp && rp.options.length === 1) rp.innerHTML += (this._projects || []).map(p => `<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');
      const res = await Api.get('/master/reminder-master' + (rp?.value ? `?projectId=${rp.value}` : ''));
      const rows = res.data || [];
      el.innerHTML = rows.length === 0
        ? `<div class="empty-state"><div class="empty-icon">⏰</div><div>No reminders configured</div></div>`
        : `<table class="dash-tbl spjn-tbl">
            <thead><tr><th>Project</th><th>Reminder Name</th><th>Prefix</th><th class="txt-right">Rank</th><th class="txt-right">Days after due</th><th>Action</th></tr></thead>
            <tbody>
              ${rows.map(r=>`<tr>
                <td>${Utils.esc((this._projects || []).find(p => p.id === r.project_id)?.name) || 'All'}</td>
                <td class="td-bold">${Utils.esc(r.name)}</td>
                <td>${Utils.esc(r.prefix_name) || '—'}</td>
                <td class="txt-right">${r.rank ?? '—'}</td>
                <td class="txt-right" style="color:var(--warn);font-weight:700">${Utils.esc(r.days_before)}</td>
                <td>${spjCanDelete() ? `<button class="btn btn-ghost btn-xs spjn-del" onclick="SPJPage.deleteReminder(this,'${r.id}')">✕</button>` : ''}</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  },

  async addReminder(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const body = Object.fromEntries([...fd.entries()].filter(([, v]) => v !== ''));
    try {
      await Api.post('/master/reminder-master', body);
      Utils.success('Reminder rule added');
      form.reset();
      await this.loadReminders();
    } catch (err) { Utils.error(err.message); }
  },

  async deleteReminder(btn, id) {
    if (!confirm('Delete?')) return;
    try {
      await Api.delete(`/master/reminder-master/${id}`);
      btn.closest('tr').remove();
      Utils.success('Deleted');
    } catch (err) { Utils.error(err.message); }
  },


  // ── Rate Report
  async loadRateReport(filterProject) {
    const el = document.getElementById('spj-rate-report');
    if (!el) return;
    try {
      const res = await Api.get('/projects/reports/rates');
      const all = res.data || [];
      const projects = [...new Map(all.map(r => [r.project_id, r.project_name])).entries()];
      const rows = filterProject ? all.filter(r => r.project_id === filterProject) : all;
      const money = v => v == null ? '—' : Utils.currency(v);
      el.innerHTML = all.length === 0
        ? `<div class="empty-state"><div class="empty-icon">💰</div><div>No units yet — add units to see the rate report</div></div>`
        : `<div style="margin-bottom:10px"><select class="fc" style="max-width:260px" onchange="SPJPage.loadRateReport(this.value)">
              <option value="">All projects</option>${projects.map(([id, n]) => `<option value="${Utils.esc(id)}"${id === filterProject ? ' selected' : ''}>${Utils.esc(n)}</option>`).join('')}
            </select></div>
          <table class="dash-tbl spjn-tbl">
            <thead><tr>
              <th>Project</th><th>BHK</th><th>Tower</th>
              <th class="txt-right">Units</th><th class="txt-right">Available</th><th class="txt-right">Sold</th><th class="txt-right">No price</th>
              <th class="txt-right">Min Price</th><th class="txt-right">Max Price</th><th class="txt-right">Avg Price</th><th class="txt-right">Avg ₹/sqft</th>
              <th class="txt-right">Min Carpet</th><th class="txt-right">Max Carpet</th>
            </tr></thead>
            <tbody>
              ${rows.map(r=>`<tr>
                <td class="td-bold">${Utils.esc(r.project_name)}</td>
                <td>${Utils.esc(r.bhk_type||'—')}</td>
                <td>${Utils.esc(r.tower||'—')}</td>
                <td class="txt-right">${r.unit_count}</td>
                <td class="txt-right">${r.available_count}</td>
                <td class="txt-right">${r.sold_count}</td>
                <td class="txt-right"${r.no_price_count ? ' style="color:var(--red,#c0392b);font-weight:600"' : ''}>${r.no_price_count}</td>
                <td class="txt-right">${money(r.min_price)}</td>
                <td class="txt-right">${money(r.max_price)}</td>
                <td class="txt-right" style="font-weight:600;color:var(--teal)">${money(r.avg_price)}</td>
                <td class="txt-right">${money(r.avg_rate_per_sqft)}</td>
                <td class="txt-right">${r.min_carpet||0} sqft</td>
                <td class="txt-right">${r.max_carpet||0} sqft</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${Utils.esc(err.message)}</div>`; }
  },

  // One unit, many at once, or a CSV file: the choice is a row of buttons; a project with no units starts on "many"
  addMode(mode) {
    this._addMode = mode;
    for (const m of ['one', 'many', 'csv']) { const box = document.getElementById(`spj-add-${m}`); if (box) box.style.display = m === mode ? '' : 'none'; }
    for (const b of document.querySelectorAll('#spj-add-mode button')) { const on = b.dataset.mode === mode; b.classList.toggle('btn-teal', on); b.classList.toggle('btn-ghost', !on); }
  },

  // ── Create floors and units (uses the same checked import as the CSV)
  async genProject() {
    const pid = document.getElementById('spj-gen-project').value, tw = document.getElementById('spj-gen-tower'), ty = document.getElementById('spj-gen-type');
    tw.innerHTML = '<option value="">Select tower</option>'; ty.innerHTML = '<option value="">Select unit type</option>'; this._genTowers = {}; this._genTypes = {};
    if (!pid) return;
    try {
      const [t, u] = await Promise.all([Api.get(`/projects/${pid}/towers`), Api.get(`/master/unit-types?project_id=${pid}`)]);
      for (const x of t.data || []) this._genTowers[x.id] = x; for (const x of u.data || []) this._genTypes[x.id] = x;
      tw.innerHTML += (t.data || []).map(x => `<option value="${x.id}">${Utils.esc(x.tower_name)}</option>`).join('');
      ty.innerHTML += (u.data || []).map(x => `<option value="${x.id}">${Utils.esc(x.name)}</option>`).join('');
    } catch (err) { Utils.error(err.message); }
  },
  genNumbers() {
    const f = document.getElementById('spj-gen-form').elements, from = Number(f.from.value), to = Number(f.to.value), per = Number(f.per.value), tw = this._genTowers?.[f.tower.value], out = [];
    if (![from, to, per].every(Number.isInteger) || to < from || per < 1) return out;
    for (let fl = from; fl <= to; fl++) for (let i = 1; i <= per; i++) out.push({ floor: fl, no: (f.style.value === 'prefix' ? (tw?.address_prefix || '') : '') + (fl === 0 ? '0' : String(fl)) + String(i).padStart(2, '0') });
    return out;
  },
  genPreview() {
    const list = this.genNumbers(), el = document.getElementById('spj-gen-preview');
    el.textContent = list.length ? `${list.length} units: ${list.slice(0, 4).map(x => x.no).join(', ')} ... ${list[list.length - 1].no}` : 'Check the floors and units per floor';
  },
  async generateUnits(e) {
    e.preventDefault();
    const f = e.target.elements, pid = document.getElementById('spj-gen-project').value, ty = this._genTypes?.[f.unitType.value], list = this.genNumbers(), res = document.getElementById('spj-gen-result');
    if (!ty || !list.length) { Utils.warn('Choose the tower, the unit type and a valid floor range'); return; }
    if (list.length > 2000) { Utils.warn('At most 2000 units at a time'); return; }
    const area = { 'Super Area': ty.super_area_sqft, 'Carpet Area': ty.carpet_area_sqft, 'Built Up Area': ty.built_up_area_sqft, 'Plot Area': ty.plot_area }[ty.rate_basis];
    const base = ty.base_rate_sqft && area ? Math.round(Number(ty.base_rate_sqft) * Number(area)) : null;
    const rows = list.map(x => ({ towerId: f.tower.value, unitNumber: x.no, floor: x.floor, bhkType: ty.name, carpetAreaSqft: ty.carpet_area_sqft || undefined, superAreaSqft: ty.super_area_sqft || undefined, basePriceInr: base ?? undefined, totalPriceInr: base ?? undefined }));
    res.innerHTML = '<div class="page-loading"><div class="spinner"></div>Creating...</div>';
    try {
      const r = (await Api.post('/units/bulk-import', { projectId: pid, rows })).data;
      res.innerHTML = `<div class="alert alert-success">✓ ${r.created} units created · ${r.skipped} skipped${r.errors?.length ? '<br>' + r.errors.slice(0, 5).map(x => Utils.esc(x.unitNumber + ': ' + x.reason)).join('<br>') : ''}</div>`;
    } catch (err) { res.innerHTML = `<div class="alert alert-danger">${Utils.esc(err.message)}</div>`; }
  },

  // ── Numbering
  async loadNumbering() {
    const pid = document.getElementById('spj-num-project')?.value, form = document.getElementById('spj-num-form');
    if (!form) return;
    form.style.display = pid ? '' : 'none';
    if (!pid) return;
    try {
      const st = (await Api.get(`/projects/${pid}/settings`)).data;
      for (const k of ['receipt_number_mode', 'receipt_prefix', 'registration_number_mode', 'registration_prefix', 'registration_number_size']) form.elements[k].value = st[k] ?? '';
      this.numPreview();
    } catch (err) { Utils.error(err.message); }
  },
  numPreview() {
    const f = document.getElementById('spj-num-form').elements, y = new Date().getFullYear(), pj = document.getElementById('spj-num-project');
    const reg = (f.registration_prefix.value || pj.selectedOptions[0].text.replace(/^ROF\s+/i, '').replace(/[^A-Z]/gi, '').toUpperCase().slice(0, 4).padEnd(4, 'X')).toUpperCase();
    document.getElementById('spj-num-preview').textContent = `${(f.receipt_prefix.value || 'REC').toUpperCase()}-${y}-00001   ${reg}-${y}-${'1'.padStart(Number(f.registration_number_size.value) || 4, '0')}`;
  },
  async saveNumbering(e) {
    e.preventDefault();
    const f = e.target.elements, pid = document.getElementById('spj-num-project').value;
    try {
      await Api.put(`/projects/${pid}/settings`, { receipt_number_mode: f.receipt_number_mode.value, receipt_prefix: f.receipt_prefix.value || null, registration_number_mode: f.registration_number_mode.value, registration_prefix: f.registration_prefix.value || null, registration_number_size: Number(f.registration_number_size.value) });
      Utils.success('Saved'); await this.loadNumbering();
    } catch (err) { Utils.error(err.message); }
  },

  // ── Customer Classification
  async loadClasses() {
    const pid = document.getElementById('spj-cc-project')?.value, el = document.getElementById('spj-cc-body');
    if (!el) return;
    if (!pid) { el.innerHTML = '<div class="empty-state"><div>Select a project</div></div>'; return; }
    try {
      const r = await Api.get(`/master/customer-classifications?projectId=${pid}`), rows = r.data || [], can = typeof spjCanDelete === 'function';
      el.innerHTML = (r.using_defaults
        ? `<p>This project uses the standard list: <b>${r.defaults.map(Utils.esc).join(', ')}</b>.</p><button class="btn btn-ghost btn-sm" onclick="SPJPage.classDefaults()">Make my own list from these</button>`
        : `<table class="dash-tbl spjn-tbl"><thead><tr><th>Name</th><th>Action</th></tr></thead><tbody>${rows.map(x => `<tr><td class="td-bold">${Utils.esc(x.name)}</td><td><button class="btn btn-ghost btn-xs" onclick="SPJPage.renameClass('${x.id}','${Utils.esc(x.name).replace(/'/g, '')}')">Rename</button> ${spjCanDelete() ? `<button class="btn btn-ghost btn-xs spjn-del" onclick="SPJPage.deleteClass('${x.id}')">✕</button>` : ''}</td></tr>`).join('')}</tbody></table>`)
        + `<form onsubmit="SPJPage.addClass(event)" style="display:flex;gap:8px;margin-top:12px"><input class="fc" id="spj-cc-name" maxlength="50" placeholder="New classification, e.g. Staff" required><button class="btn btn-teal" type="submit">Add</button></form>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${Utils.esc(err.message)}</div>`; }
  },
  async classDefaults() { try { await Api.post('/master/customer-classifications/defaults', { project_id: document.getElementById('spj-cc-project').value }); await this.loadClasses(); } catch (err) { Utils.error(err.message); } },
  async addClass(e) { e.preventDefault(); try { await Api.post('/master/customer-classifications', { project_id: document.getElementById('spj-cc-project').value, name: document.getElementById('spj-cc-name').value }); Utils.success('Added'); await this.loadClasses(); } catch (err) { Utils.error(err.message); } },
  async renameClass(id, old) { const n = prompt('New name', old); if (!n || n === old) return; try { const r = await Api.put(`/master/customer-classifications/${id}`, { name: n }); Utils.success(r.customers_updated ? `Renamed; ${r.customers_updated} customer(s) updated` : 'Renamed'); await this.loadClasses(); } catch (err) { Utils.error(err.message); } },
  async deleteClass(id) { if (!confirm('Delete this classification?')) return; try { await Api.delete(`/master/customer-classifications/${id}`); await this.loadClasses(); } catch (err) { Utils.error(err.message); } },

  // ── Unit Address (Unit Types) ────────────────
  async loadUnitTypes() {
    const projectId = document.getElementById('spj-ut-project')?.value;
    const el = document.getElementById('spj-unit-types-list');
    if (!el) return;
    el.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;
    try {
      const res = await Api.get('/master/unit-types', projectId ? { params: { project_id: projectId } } : {});
      const rows = res.data || [];
      this._utRows = Object.fromEntries(rows.map(r => [r.id, r]));
      el.innerHTML = `
        <div class="spjn-list">
          <div class="spjn-list-h"><div class="spjn-list-t">Existing Unit Types</div><span class="chip chip-blue">${rows.length} types</span></div>
          <div class="spjn-tscroll">
            <table class="dash-tbl spjn-tbl">
              <thead><tr><th>Project</th><th>Name</th><th>Group</th><th>Super</th><th>Carpet</th><th>Balcony</th><th>Rate</th><th>On</th><th>Actions</th></tr></thead>
              <tbody>
                ${rows.map(r => `<tr>
                  <td>${Utils.esc(r.project_name)}</td>
                  <td class="td-bold">${Utils.esc(r.name)}</td>
                  <td>${Utils.esc(r.group_name) || '—'}</td>
                  <td>${r.super_area_sqft || '—'}</td>
                  <td>${r.carpet_area_sqft || 0} sqft</td>
                  <td>${r.balcony_area_sqft || 0} sqft</td>
                  <td>₹${r.base_rate_sqft || 0}${r.rate_type === 'In Fix' ? ' fixed' : '/sqft'}</td>
                  <td>${Utils.esc(r.rate_basis) || '—'}</td>
                  <td><button class="btn btn-ghost btn-xs" onclick="SPJPage.editUnitType('${r.id}')">Edit</button> <button class="btn btn-ghost btn-xs" onclick="SPJPage.rateHistory('${r.id}')">Rate history</button> <button class="btn btn-ghost btn-xs" onclick="SPJPage.applyTypeToUnits('${r.id}', true)">Update units</button> ${spjCanDelete() ? `<button class="btn btn-ghost btn-xs spjn-del" onclick="SPJPage.deleteUnitType('${r.id}')">✕</button>` : ''}</td>
                </tr>`).join('')}
              </tbody>
            </table>
            ${rows.length === 0 ? '<div style="padding:20px;text-align:center;color:var(--text3)">No unit type yet. A unit type is one layout (for example "2BHK Type A" or "510 Sq. Ft.") with its areas and rate. Fill the form above; units are then created from it.</div>' : ''}
          </div>
        </div>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  },

  async createUnitType(e) {
    e.preventDefault();
    const form = e.target, data = {};
    for (const [k, v] of new FormData(form).entries()) if (v !== '' || document.getElementById('spj-ut-edit-id').value) data[k] = v === '' ? null : v;
    data.show_on_payment_file = [...document.querySelectorAll('#spj-ut-shown input:checked')].map(x => x.value);
    const editId = document.getElementById('spj-ut-edit-id').value;
    try {
      if (editId) { delete data.project_id; await Api.put(`/master/unit-types/${editId}`, data); }
      else await Api.post('/master/unit-types', data);
      Utils.success(editId ? 'Unit type saved' : 'Unit type added');
      this.cancelUnitTypeEdit();
      await this.loadUnitTypes();
      if (editId) await this.applyTypeToUnits(editId);
    } catch (err) { Utils.error(err.message); }
  },

  // Simple help while typing: if only one area is filled it is the one the rate is charged on and shown on the payment file
  utAuto(e) {
    if (!/_area_sqft$/.test(e.target.name || '') || document.getElementById('spj-ut-edit-id').value) return;
    const f = e.currentTarget.elements, map = { super_area_sqft: ['Super Area'], carpet_area_sqft: ['Carpet Area'], built_up_area_sqft: ['Built Up Area'] };
    const filled = Object.keys(map).filter(k => Number(f[k].value) > 0);
    if (filled.length === 1) f.rate_basis.value = map[filled[0]][0];
    else if (filled.includes('super_area_sqft')) f.rate_basis.value = 'Super Area';
    for (const c of document.querySelectorAll('#spj-ut-shown input')) { const k = Object.keys(map).find(x => map[x][0] === c.value) || (c.value === 'Balcony Area' ? 'balcony_area_sqft' : c.value === 'UDSL Area' ? 'udsl_area_sqft' : null); if (k) c.checked = Number(f[k].value) > 0; }
  },

  // After a unit type changes, offer to carry its areas and price to the units of that type that are not booked yet
  async applyTypeToUnits(id) {
    try {
      const p = (await Api.post(`/master/unit-types/${id}/apply-to-units`, { preview: true })).data;
      if (!p.matching) { if (arguments[1]) Utils.info?.('No unit uses this type yet'); return; }
      if (!p.updatable) { Utils.warn(`${p.matching} unit(s) use this type, but all are booked, so nothing can change.`); return; }
      const price = p.price != null ? ` and the price to ₹${Number(p.price).toLocaleString('en-IN')}` : '';
      if (!confirm(`${p.updatable} unit(s) of this type are not booked yet. Set their areas${price} from the unit type?${p.booked ? `\n${p.booked} booked unit(s) stay as they are.` : ''}`)) return;
      const r = (await Api.post(`/master/unit-types/${id}/apply-to-units`, {})).data;
      Utils.success(`${r.updated} unit(s) updated`);
    } catch (err) { Utils.error(err.message); }
  },

  async rateHistory(id) {
    try {
      const rows = (await Api.get(`/master/unit-types/${id}/rate-history`)).data || [], t = this._utRows?.[id]?.name || '';
      alert(`Rate history of ${t}\n\n` + (rows.length ? rows.map(x => `${String(x.changed_at).slice(0, 10)}  Rs. ${Number(x.base_rate).toLocaleString('en-IN')} on ${x.rate_basis || '-'}${x.rate_date ? '  (rate date ' + x.rate_date + ')' : ''}${x.changed_by_name ? '  by ' + x.changed_by_name : ''}`).join('\n') : 'No rate has been set yet'));
    } catch (err) { Utils.error(err.message); }
  },

  editUnitType(id) {
    const r = this._utRows?.[id]; if (!r) return;
    const form = document.getElementById('spj-unit-type-form');
    for (const el of form.elements) if (el.name && r[el.name] !== undefined) el.value = el.name === 'rate_date' ? String(r[el.name] || '').slice(0, 10) : r[el.name] ?? '';
    for (const c of document.querySelectorAll('#spj-ut-shown input')) c.checked = (r.show_on_payment_file || []).includes(c.value);
    form.elements.project_id.value = r.project_id;
    document.getElementById('spj-ut-more').open = !!(r.built_up_area_sqft || r.udsl_area_sqft || r.plot_area || r.construction_cost || r.udsl_cost || r.rate_date || r.unit_of_measurement);
    document.getElementById('spj-ut-edit-id').value = id;
    document.getElementById('spj-ut-save').textContent = 'Save Unit Type';
    document.getElementById('spj-ut-cancel').style.display = '';
    form.scrollIntoView({ behavior: 'smooth' });
  },

  cancelUnitTypeEdit() {
    const form = document.getElementById('spj-unit-type-form'), pid = form.elements.project_id.value;
    form.reset(); form.elements.project_id.value = pid;
    for (const c of document.querySelectorAll('#spj-ut-shown input')) c.checked = false;
    document.getElementById('spj-ut-edit-id').value = '';
    document.getElementById('spj-ut-save').textContent = 'Add Unit Type';
    document.getElementById('spj-ut-cancel').style.display = 'none';
  },

  // Area Types (Set Master) as the units of land / plot / measurement; selected is kept even if it is no longer in the list
  async fillAreaSelect(id, selected) {
    const el = document.getElementById(id); if (!el) return;
    if (!this._areaTypes) try { this._areaTypes = ((await Api.get('/master/area-types')).data || []).map(x => x.name); } catch { this._areaTypes = []; }
    const names = [...new Set([...(this._areaTypes), ...(selected ? [selected] : [])])];
    el.innerHTML = '<option value="">Not set</option>' + names.map(n => `<option>${Utils.esc(n)}</option>`).join('');
    el.value = selected || '';
  },

  async deleteUnitType(id) {
    if (!confirm('Delete this unit type?')) return;
    try {
      await Api.delete(`/master/unit-types/${id}`);
      Utils.success('Deleted');
      await this.loadUnitTypes();
    } catch (err) { Utils.error(err.message); }
  },
});
