// ROF CRM — Set Projects (Project & Unit Configuration)

// Same rule as the server: only super_admin can delete here, so other roles do not see the delete button
const spjCanDelete = () => (Auth.getUser() || {}).role === 'super_admin';

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

    <div class="tabs-line" style="flex-wrap:wrap">
      ${tabBtn('new-project',      'New Project',         tab==='new-project')}
      ${tabBtn('edit-project',     'Edit Project',        tab==='edit-project')}
      ${tabBtn('add-tower',        'Add Tower/Plot',      tab==='add-tower')}
      ${tabBtn('add-unit',         'Add Unit',            tab==='add-unit')}
      ${tabBtn('unit-address',     'Unit Address',        tab==='unit-address')}
      ${tabBtn('unit-location',    'Unit Location',       tab==='unit-location')}
      ${tabBtn('reminder-master',  'Reminder Master',     tab==='reminder-master')}
      ${tabBtn('rate-report',      'Rate Report',         tab==='rate-report')}
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
        .spjn-plan { margin:14px 18px; background:var(--surface2); border:1px solid var(--border); border-radius:10px; overflow:hidden }
        .spjn-plan-h { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 14px; font-weight:600; font-size:13px; color:var(--text) }
        .spjn-edit-row { padding:14px; background:var(--surface2); border-radius:8px; display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:12px; align-items:end }
        .spjn-edit-row .fc { padding:8px 10px; font-size:12.5px; border-radius:8px }
        .spjn-mo { background:var(--surface); color:var(--text); border:1px solid var(--border2); border-radius:14px; width:min(92vw,520px); max-height:85vh; overflow:auto; box-shadow:0 20px 60px rgba(0,0,0,.4) }
        .spjn-mo-h { display:flex; align-items:center; gap:12px; padding:16px 20px; border-bottom:1px solid var(--border) }
        .spjn-mo-ico { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0 }
        .spjn-mo-t { font-size:15px; font-weight:600; color:var(--text) }
        .spjn-mo-s { font-size:12px; color:var(--text2); margin-top:2px; line-height:1.5 }
        .spjn-mo-x { margin-left:auto; background:none; border:none; font-size:18px; cursor:pointer; color:var(--text2); width:30px; height:30px; border-radius:8px; line-height:1 }
        .spjn-mo-x:hover { background:var(--surface2); color:var(--text) }
        .spjn-mo-b { padding:18px 20px; font-size:13px; color:var(--text2); line-height:1.7 }
        .spjn-mo-b b { color:var(--text) }
        .spjn-mo-f { display:flex; justify-content:flex-end; gap:8px; padding:14px 20px; background:var(--surface2); border-top:1px solid var(--border) }
        .spjn-mo-f .btn { padding:8px 20px; font-size:12.5px; border-radius:8px }
        .spjn-mo .fc { padding:8px 10px; font-size:13px; border-radius:8px }
        .spjn-mo .fc:focus { box-shadow:0 0 0 3px var(--teal-bg) }
        .spjn-mo-stat { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:0 0 14px }
        .spjn-mo-stat > div { background:var(--surface2); border:1px solid var(--border); border-radius:10px; padding:10px 12px; text-align:center }
        .spjn-mo-stat span { display:block; font-size:10.5px; color:var(--text3); text-transform:uppercase; letter-spacing:.4px }
        .spjn-mo-stat strong { font-size:16px; color:var(--text) }
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

          <div class="spjn-foot">
            <div class="spjn-note"><b>*</b> Required fields</div>
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
                </div>
              </div>

              <!-- LEGAL DETAILS SECTION -->
              <div class="spjn-sec">
                <div class="spjn-sec-h"><span class="spjn-num">2</span><span class="spjn-sec-t">Legal &amp; Registration Details</span><span class="spjn-sec-s">Used in ATS and Conveyance Deed documents</span></div>

                <!-- GROUP 1: Basic Legal -->
                <div class="spjn-sec-sub">Project Approvals</div>
                <div class="spjn-grid">
                  <div class="fg"><label class="fl">Village Name</label><input class="fc" id="spj-edit-village-name" placeholder="e.g. Village Dharampur"></div>
                  <div class="fg"><label class="fl">Sector Name</label><input class="fc" id="spj-edit-sector-name" placeholder="e.g. Sector-108"></div>
                  <div class="fg"><label class="fl">License Date</label><input type="date" class="fc" id="spj-edit-license-date"></div>
                  <div class="fg"><label class="fl">Env. Clearance No.</label><input class="fc" id="spj-edit-env-clearance-no" placeholder="e.g. SEIAA/HR/2020/72"></div>
                  <div class="fg"><label class="fl">Env. Clearance Date</label><input type="date" class="fc" id="spj-edit-env-clearance-date"></div>
                  <div class="fg"><label class="fl">Building Plan Memo No.</label><input class="fc" id="spj-edit-building-plan-memo" placeholder="e.g. ZP1348/AD(RA)/2019/28186"></div>
                  <div class="fg"><label class="fl">Building Plan Date</label><input type="date" class="fc" id="spj-edit-building-plan-date"></div>
                  <div class="fg"><label class="fl">Khasra Details</label><textarea class="fc" id="spj-edit-khasra-details" rows="3" placeholder="e.g. Rect. No. 1 Killa No. 16/1..."></textarea></div>
                </div>

                <!-- GROUP 2: Land Owner -->
                <div class="spjn-sec-sub">Land Owner Details</div>
                <div class="spjn-grid">
                  <div class="fg"><label class="fl">Land Owner Name</label><input class="fc" id="spj-edit-land-owner-name" placeholder="e.g. M/s MRA Infrastructure..."></div>
                  <div class="fg"><label class="fl">Land Owner LLPIN</label><input class="fc" id="spj-edit-land-owner-llpin" placeholder="e.g. AAO-7853"></div>
                  <div class="fg"><label class="fl">Land Owner PAN</label><input class="fc" id="spj-edit-land-owner-pan" placeholder="e.g. ABLFM2142D"></div>
                  <div class="fg"><label class="fl">Land Owner Address</label><input class="fc" id="spj-edit-land-owner-address" placeholder="e.g. M-18, Greater Kailash-II..."></div>
                  <div class="fg"><label class="fl">GPA/Vasika No.</label><input class="fc" id="spj-edit-gpa-vasika-no" placeholder="e.g. 29"></div>
                  <div class="fg"><label class="fl">GPA Date</label><input type="date" class="fc" id="spj-edit-gpa-date"></div>
                  <div class="fg"><label class="fl">Collab. Agreement Date</label><input type="date" class="fc" id="spj-edit-collab-date"></div>
                </div>

                <!-- GROUP 3: Sale Deed -->
                <div class="spjn-sec-sub">Sale Deed &amp; Registration</div>
                <div class="spjn-grid">
                  <div class="fg"><label class="fl">Sale Deed No.</label><input class="fc" id="spj-edit-sale-deed-no" placeholder="e.g. 4969"></div>
                  <div class="fg"><label class="fl">Sale Deed Date</label><input type="date" class="fc" id="spj-edit-sale-deed-date"></div>
                  <div class="fg"><label class="fl">Sub-Registrar Office</label><input class="fc" id="spj-edit-sub-registrar" placeholder="e.g. Sub-Registrar, Kadipur"></div>
                </div>

                <!-- GROUP 4: OC Details -->
                <div class="spjn-sec-sub">Occupation Certificate Details <span style="font-size:10px;color:var(--text3);font-weight:normal;text-transform:none">(Fill after OC received)</span></div>
                <div class="spjn-grid">
                  <div class="fg"><label class="fl">OC Memo No.</label><input class="fc" id="spj-edit-oc-memo-no" placeholder="e.g. ZP-1348/JD(RD)/2024/29912"></div>
                  <div class="fg"><label class="fl">OC Date</label><input type="date" class="fc" id="spj-edit-oc-date"></div>
                  <div class="fg"><label class="fl">Deed of Declaration Vasika No.</label><input class="fc" id="spj-edit-dod-vasika-no" placeholder="e.g. 9045"></div>
                  <div class="fg"><label class="fl">Deed of Declaration Date</label><input type="date" class="fc" id="spj-edit-dod-date"></div>
                </div>

                <!-- GROUP 5: Authorised Signatory -->
                <div class="spjn-sec-sub">Authorised Signatory</div>
                <div class="spjn-grid">
                  <div class="fg"><label class="fl">Authorised Signatory Name</label><input class="fc" id="spj-edit-auth-signatory-name" placeholder="e.g. Mr. John Smith"></div>
                  <div class="fg"><label class="fl">Authorised Signatory Aadhaar</label><input class="fc" id="spj-edit-auth-signatory-aadhaar" placeholder="e.g. 1234 5678 9012"></div>
                  <div class="fg"><label class="fl">Board Resolution Date</label><input type="date" class="fc" id="spj-edit-board-resolution-date"></div>
                </div>
              </div>

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
            </div>
            <div class="spjn-foot">
              <div class="spjn-note"><b>*</b> Required fields</div>
              <button type="submit" class="btn btn-teal">Add Tower</button>
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
      <div class="sp spjn">
        <div class="spjn-intro">
          <div class="spjn-intro-ico">🏠</div>
          <div>
            <div class="spjn-intro-t">Add Unit</div>
            <div class="spjn-intro-s">Add a single unit to a project tower. Use the CSV upload below to add many units at once.</div>
          </div>
        </div>
          <form id="spj-unit-form" onsubmit="SPJPage.addUnit(event)">
            <div class="spjn-sec">
            <div class="spjn-sec-h"><span class="spjn-num">1</span><span class="spjn-sec-t">Location</span><span class="spjn-sec-s">Project and tower</span></div>
            <div class="spjn-grid">
              <div class="fg">
                <label class="fl"><span class="r">*</span> Project</label>
                <select class="fc" id="spj-unit-project" required onchange="SPJPage.onUnitProjectChange()">
                  <option value="">Select Project</option>
                </select>
              </div>
              <div class="fg">
                <label class="fl">Tower</label>
                <select class="fc" id="spj-unit-tower">
                  <option value="">Select Tower</option>
                </select>
              </div>
            </div>
            </div>
            <div class="spjn-sec">
            <div class="spjn-sec-h"><span class="spjn-num">2</span><span class="spjn-sec-t">Unit Details</span><span class="spjn-sec-s">Number, floor and type</span></div>
            <div class="spjn-grid">
              <div class="fg">
                <label class="fl"><span class="r">*</span> Unit Number</label>
                <input class="fc" name="unit_number" placeholder="e.g. A-101" required>
              </div>
              <div class="fg">
                <label class="fl">Floor</label>
                <input type="number" class="fc" name="floor" placeholder="1">
              </div>
              <div class="fg">
                <label class="fl">BHK Type</label>
                <select class="fc" name="bhk_type">
                  <option value="">Select</option>
                  ${ROF.BHK_TYPES.map(b=>`<option>${b}</option>`).join('')}
                </select>
              </div>
              <div class="fg">
                <label class="fl">Facing</label>
                <select class="fc" name="facing">
                  <option value="">Select</option>
                  ${ROF.FACINGS.map(f=>`<option>${f}</option>`).join('')}
                </select>
              </div>
            </div>
            </div>
            <div class="spjn-sec">
            <div class="spjn-sec-h"><span class="spjn-num">3</span><span class="spjn-sec-t">Area</span><span class="spjn-sec-s">Super area is calculated automatically</span></div>
            <div class="spjn-grid-3">
              <div class="fg">
                <label class="fl">Carpet Area</label>
                <div class="spjn-suf"><input type="number" step="0.001" class="fc" id="spj-unit-carpet" name="carpet_area_sqft" oninput="SPJPage.calcSuperArea()"><span>sqft</span></div>
              </div>
              <div class="fg">
                <label class="fl">Balcony Area</label>
                <div class="spjn-suf"><input type="number" step="0.001" class="fc" name="balcony_area_sqft" id="spj-unit-balcony" oninput="SPJPage.calcSuperArea()"><span>sqft</span></div>
              </div>
              <div class="fg">
                <label class="fl">Super Area</label>
                <div class="spjn-suf"><input type="number" step="0.001" class="fc" id="spj-unit-super" name="super_area_sqft" placeholder="Auto-calculated" readonly><span>sqft</span></div>
              </div>
            </div>
            </div>
            <div class="spjn-sec">
            <div class="spjn-sec-h"><span class="spjn-num">4</span><span class="spjn-sec-t">Type and price</span></div>
            <div class="spjn-grid">
              <div class="fg">
                <label class="fl">Unit Type</label>
                <select class="fc" id="spj-unit-type" name="unit_type_id">
                  <option value="">None</option>
                </select>
              </div>
              <div class="fg">
                <label class="fl">Base Price (₹)</label>
                <input type="number" min="0" step="1" class="fc" name="base_price_inr">
              </div>
              <div class="fg">
                <label class="fl">Total Price (₹)</label>
                <input type="number" min="0" step="1" class="fc" name="total_price_inr">
              </div>
            </div>
            </div>
            <div class="spjn-foot">
              <div class="spjn-note"><b>*</b> Required fields</div>
              <div style="display:flex;gap:8px">
                <button type="reset" class="btn btn-ghost">Clear</button>
                <button type="submit" class="btn btn-teal">Add Unit</button>
              </div>
            </div>
          </form>
      </div>

      <div class="sp spjn">
        <div class="spjn-list-h">
          <div class="spjn-list-t">Bulk Add via CSV</div>
          <button class="btn btn-ghost btn-sm" onclick="window.open('/api/import/template/units','_blank')">Download Template</button>
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
        <div id="spj-bulk-result" style="padding:0 18px 14px"></div>
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
        <form id="spj-unit-type-form" onsubmit="SPJPage.createUnitType(event)">
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
              <div class="fg spjn-full">
                <label class="fl">Description</label>
                <input class="fc" name="description" placeholder="Optional details">
              </div>
            </div>
          </div>
          <div class="spjn-sec">
            <div class="spjn-sec-h"><span class="spjn-num">2</span><span class="spjn-sec-t">Area &amp; Rate</span><span class="spjn-sec-s">Optional</span></div>
            <div class="spjn-grid-3">
              <div class="fg">
                <label class="fl">Carpet Area</label>
                <div class="spjn-suf"><input type="number" class="fc" name="carpet_area_sqft" placeholder="0"><span>sqft</span></div>
              </div>
              <div class="fg">
                <label class="fl">Balcony Area</label>
                <div class="spjn-suf"><input type="number" step="0.001" class="fc" name="balcony_area_sqft" placeholder="0"><span>sqft</span></div>
              </div>
              <div class="fg">
                <label class="fl">Base Rate</label>
                <div class="spjn-suf"><input type="number" class="fc" name="base_rate_sqft" placeholder="0"><span>₹/sqft</span></div>
              </div>
            </div>
          </div>
          <div class="spjn-foot">
            <div class="spjn-note"><b>*</b> Required fields</div>
            <button type="submit" class="btn btn-teal">Add Unit Type</button>
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
              <div class="spjn-intro-s">Set how many days before the due date, and on which channel.</div>
            </div>
          </div>
          <form id="spj-reminder-form" onsubmit="SPJPage.addReminder(event)">
            <div class="spjn-split-body">
              <div class="fg">
                <label class="fl"><span class="r">*</span> Reminder Name</label>
                <input class="fc" name="name" placeholder="e.g. 15-Day Demand Reminder" required>
              </div>
              <div class="fg">
                <label class="fl"><span class="r">*</span> Days Before Due Date</label>
                <div class="spjn-suf"><input type="number" class="fc" name="days_before" min="0" placeholder="e.g. 15" required><span>days</span></div>
              </div>
              <div class="fg">
                <label class="fl">Channel</label>
                <select class="fc" name="channel">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="all">All Channels</option>
                </select>
              </div>
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

    <!-- PAYMENT PLAN SETUP -->
    <div data-panel-group="spj" data-panel="plan-setup" ${(!tab.startsWith('plan-') || tab === 'plan-view') ? 'style="display:none"' : ''}>
      <!-- Sub-tabs use group "plan-sub" (NOT "spj") so they never hide this parent panel -->
      <div class="tabs-line" style="margin-bottom:14px">
        <button class="tab-line${tab.startsWith('plan-new') || tab==='plan-setup' ? ' active' : ''}" data-group="plan-sub" data-tab="plan-new"
          onclick="switchTab('plan-sub','plan-new')">New</button>
        <button class="tab-line${tab.startsWith('plan-edit') || tab==='plan-personalise' ? ' active' : ''}" data-group="plan-sub" data-tab="plan-edit"
          onclick="switchTab('plan-sub','plan-edit');SPJPage.loadPlanTemplates()">Edit</button>
      </div>

      <!-- ── NEW sub-panel ────────────────────────────────────── -->
      <div data-panel-group="plan-sub" data-panel="plan-new" ${(tab.startsWith('plan-edit') || tab==='plan-personalise') ? 'style="display:none"' : ''}>
        <div class="sp spjn">
          <div class="spjn-intro" style="justify-content:space-between;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:12px">
              <div class="spjn-intro-ico">💳</div>
              <div>
                <div class="spjn-intro-t">Add Installment to Schedule</div>
                <div class="spjn-intro-s">Build a payment plan one installment at a time.</div>
              </div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" onclick="SPJPage.loadAHPTemplate()">↻ Load AHP Template</button>
          </div>
            <form id="spj-plan-form" onsubmit="SPJPage.addInstallment(event)">
              <div class="spjn-sec">
              <div class="spjn-sec-h"><span class="spjn-num">1</span><span class="spjn-sec-t">Plan</span><span class="spjn-sec-s">Project and plan name</span></div>
              <div class="spjn-grid">
                <div class="fg">
                  <label class="fl"><span class="r">*</span> Project</label>
                  <select class="fc" id="spj-plan-project" required onchange="SPJPage.onPlanProjectChange()">
                    <option value="">Select Project</option>
                  </select>
                </div>
                <div class="fg">
                  <label class="fl"><span class="r">*</span> Plan Name</label>
                  <input class="fc" id="spj-plan-name" name="plan_name" value="Standard AHP Plan" placeholder="e.g. Standard AHP Plan" required>
                </div>
              </div>
              </div>
              <div class="spjn-sec">
              <div class="spjn-sec-h"><span class="spjn-num">2</span><span class="spjn-sec-t">Installment</span><span class="spjn-sec-s">Type, amount and due date</span></div>
              <div class="spjn-grid">
                <div class="fg">
                  <label class="fl"><span class="r">*</span> Installment Type</label>
                  <select class="fc" id="spj-plan-type" name="installment_type" onchange="SPJPage.onTypeChange(this.value)">
                    <option value="installment">Installment</option>
                    <option value="plc">PLC Charge</option>
                    <option value="other_charge">Other Charge</option>
                    <option value="booking">Booking Amount</option>
                    <option value="possession">On Possession</option>
                  </select>
                </div>
                <div class="fg">
                  <label class="fl"><span class="r">*</span> Installment Name</label>
                  <input class="fc" name="installment_name" id="spj-plan-iname" placeholder="e.g. On Allotment" required>
                </div>
                <div class="fg">
                  <label class="fl">Index (order)</label>
                  <input type="number" class="fc" name="installment_index" id="spj-plan-idx" min="1" value="1" placeholder="1">
                </div>
                <!-- Percentage: shown for installment, plc, booking, possession -->
                <div class="fg" id="spj-plan-pct-wrap">
                  <label class="fl">Percentage (%)</label>
                  <input type="number" step="0.001" class="fc" name="percentage" id="spj-plan-pct" placeholder="20.000">
                </div>
                <!-- Flat amount: shown for other_charge only -->
                <div class="fg" id="spj-plan-amt-wrap" style="display:none">
                  <label class="fl">Flat Amount (₹)</label>
                  <input type="number" class="fc" name="flat_amount_inr" id="spj-plan-amt" placeholder="0">
                </div>
                <div class="fg">
                  <label class="fl">Due Offset (days after allotment)</label>
                  <input type="number" class="fc" name="due_date_offset_days" id="spj-plan-offset" placeholder="0" value="0">
                </div>
                <div class="fg">
                  <label class="fl">Notes / Description</label>
                  <input class="fc" name="notes" placeholder="Optional notes">
                </div>
              </div>
              </div>
              <div id="spj-plan-addon-section" class="spjn-sec" style="display:none">
                <div class="spjn-sec-h"><span class="spjn-num">3</span><span class="spjn-sec-t">Addon Charge Percentages</span></div>
                <div id="spj-plan-addon-inputs" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:18px">
                  <!-- populated dynamically when project is selected -->
                </div>
              </div>
              <div class="spjn-foot">
                <div class="spjn-note"><b>*</b> Required fields</div>
                <div style="display:flex;gap:8px">
                  <button type="button" class="btn btn-ghost" onclick="SPJPage.clearPlanForm()">Clear Form</button>
                  <button type="submit" class="btn btn-teal">Add Installment</button>
                </div>
              </div>
            </form>
        </div>
        <div class="alert alert-info" style="margin:12px auto 0;max-width:980px">
          <b>AHP Standard Schedule:</b> 5% Booking → 20% On Allotment (within 15 days) → 6 × 12.5% half-yearly → 0% On Possession milestone = 100%
          &nbsp;<button class="btn btn-ghost btn-sm" onclick="SPJPage.loadAHPTemplate()">↻ Auto-fill this template</button>
        </div>
        <!-- Live schedule preview for selected project/plan -->
        <div id="spj-plan-preview" style="margin-top:16px"></div>
      </div>

      <!-- ── EDIT sub-panel ───────────────────────────────────── -->
      <div data-panel-group="plan-sub" data-panel="plan-edit" ${(!tab.startsWith('plan-edit') && tab!=='plan-personalise') ? 'style="display:none"' : ''}>
        <div class="sp spjn">
          <div class="spjn-bar">
            <div class="fg">
              <label class="fl">Project</label>
              <select class="fc" id="spj-plan-edit-project" onchange="SPJPage.loadPlanTemplates()">
                <option value="">All Projects</option>
              </select>
            </div>
            <button class="btn btn-fetch" onclick="SPJPage.loadPlanTemplates()">FETCH</button>
          </div>
        </div>
        <div id="spj-plan-edit-body"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- PLAN VIEW -->
    <div data-panel-group="spj" data-panel="plan-view" ${tab!=='plan-view'?'style="display:none"':''}>
      <div class="sp spjn">
        <div class="spjn-bar">
          <div class="fg">
            <label class="fl">Project</label>
            <select class="fc" id="spj-planview-project" onchange="SPJPage.onPlanviewProjectChange()">
              <option value="">All Projects</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Plan</label>
            <select class="fc" id="spj-planview-plan">
              <option value="">-- All Plans --</option>
            </select>
          </div>
          <button class="btn btn-fetch" onclick="SPJPage.loadPaymentPlans()">FETCH</button>
        </div>
      </div>
      <div id="spj-plans-body"><div class="page-loading"><div class="spinner"></div></div></div>
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
  await SPJPage.load(tab);
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
    const opts = this._projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    ['spj-tower-project','spj-tower-list-project','spj-unit-project','spj-bulk-project',
     'spj-ut-project','spj-uloc-project','spj-uloc-list-project','spj-plan-project',
     'spj-plan-edit-project','spj-planview-project','spj-edit-project-sel'].forEach(id => {
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
    const map = {
      'edit-project':   () => this.loadProjectsList(),
      'add-tower':      () => this.loadTowers(),
      'unit-address':   () => this.loadUnitTypes(),
      'unit-location':  () => this.loadUnitLocations(),
      'reminder-master':() => this.loadReminders(),
      'plan-setup':     () => { },
      'plan-view':      () => this.loadPaymentPlans(),
      'rate-report':    () => this.loadRateReport(),

      // Sub-tabs for Payment Plan Setup (New)
      'plan-new-installment': () => { SPJPage.setInstallmentType('installment'); },
      'plan-new-plc':         () => { SPJPage.setInstallmentType('plc'); },
      'plan-new-other':       () => { SPJPage.setInstallmentType('other_charge'); },
      'plan-new-personal':    () => { },

      // Sub-tabs for Payment Plan Setup (Edit)
      'plan-edit-installment':() => { SPJPage.loadPlanTemplates(); },
      'plan-edit-plc':        () => { SPJPage.loadPlanTemplates(); },
      'plan-edit-other':      () => { SPJPage.loadPlanTemplates(); },
      'plan-edit-personal':   () => { SPJPage.loadPlanTemplates(); },
      'plan-personalise':     () => { SPJPage.loadPlanTemplates(); },
    };
    if (map[tab]) await map[tab]();
    else if (tab.startsWith('plan-edit') || tab==='plan-personalise') { await this.loadPlanTemplates(); }
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

    // Helper to format dates
    const fmtDate = (d) => {
      if (!d) return '';
      return new Date(d).toISOString().slice(0,10);
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

    const villageName = document.getElementById('spj-edit-village-name').value.trim();
    const sectorName = document.getElementById('spj-edit-sector-name').value.trim();
    const licenseDate = document.getElementById('spj-edit-license-date').value || null;
    const envClearanceNo = document.getElementById('spj-edit-env-clearance-no').value.trim();
    const envClearanceDate = document.getElementById('spj-edit-env-clearance-date').value || null;
    const buildingPlanMemoNo = document.getElementById('spj-edit-building-plan-memo').value.trim();
    const buildingPlanDate = document.getElementById('spj-edit-building-plan-date').value || null;
    const khasraDetails = document.getElementById('spj-edit-khasra-details').value.trim();
    const landOwnerName = document.getElementById('spj-edit-land-owner-name').value.trim();
    const landOwnerLlpin = document.getElementById('spj-edit-land-owner-llpin').value.trim();
    const landOwnerPan = document.getElementById('spj-edit-land-owner-pan').value.trim();
    const landOwnerAddress = document.getElementById('spj-edit-land-owner-address').value.trim();
    const landOwnerGpaVasikaNo = document.getElementById('spj-edit-gpa-vasika-no').value.trim();
    const landOwnerGpaDate = document.getElementById('spj-edit-gpa-date').value || null;
    const collaborationAgreementDate = document.getElementById('spj-edit-collab-date').value || null;
    const saleDeedNo = document.getElementById('spj-edit-sale-deed-no').value.trim();
    const saleDeedDate = document.getElementById('spj-edit-sale-deed-date').value || null;
    const subRegistrarOffice = document.getElementById('spj-edit-sub-registrar').value.trim();
    const occupationCertMemoNo = document.getElementById('spj-edit-oc-memo-no').value.trim();
    const occupationCertDate = document.getElementById('spj-edit-oc-date').value || null;
    const deedOfDeclarationVasikaNo = document.getElementById('spj-edit-dod-vasika-no').value.trim();
    const deedOfDeclarationDate = document.getElementById('spj-edit-dod-date').value || null;
    const authorisedSignatoryName = document.getElementById('spj-edit-auth-signatory-name').value.trim();
    const authorisedSignatoryAadhaar = document.getElementById('spj-edit-auth-signatory-aadhaar').value.trim();
    const boardResolutionDate = document.getElementById('spj-edit-board-resolution-date').value || null;
    const companyId = document.getElementById('spj-edit-proj-company').value || null;

    try {
      await Api.patch(`/projects/${id}`, {
        name,
        location: loc,
        totalUnits: parseInt(units)||null,
        licenseDate,
        envClearanceNo,
        envClearanceDate,
        buildingPlanMemoNo,
        buildingPlanDate,
        collaborationAgreementDate,
        landOwnerName,
        landOwnerLlpin,
        landOwnerPan,
        landOwnerAddress,
        landOwnerGpaVasikaNo,
        landOwnerGpaDate,
        saleDeedNo,
        saleDeedDate,
        subRegistrarOffice,
        occupationCertMemoNo,
        occupationCertDate,
        deedOfDeclarationVasikaNo,
        deedOfDeclarationDate,
        khasraDetails,
        villageName,
        sectorName,
        authorisedSignatoryName,
        authorisedSignatoryAadhaar,
        boardResolutionDate,
        companyId,
      });
      Utils.success('Project updated');
      await this.initProjectDropdowns(true);
      await this.loadProjectsList();
    } catch (err) { Utils.error(err.message); }
  },

  async createProject(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    try {
      await Api.post('/projects', body);
      Utils.success(`Project "${body.name}" created`);
      form.reset();
      await this.initProjectDropdowns(true);
    } catch (err) { Utils.error(err.message); }
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
      for (const p of projects) {
        const res = await Api.get(`/projects/${p.id}/towers`);
        (res.data||[]).forEach(t => rows.push({ ...t, project_name: this._projects.find(pr=>pr.id===p.id)?.name || '' }));
      }
      el.innerHTML = rows.length === 0
        ? `<div class="empty-state"><div class="empty-icon">🏢</div><div>No towers found</div></div>`
        : `<table class="dash-tbl spjn-tbl">
            <thead><tr><th>Project</th><th>Tower/Plot</th><th class="txt-right">Units</th><th>Action</th></tr></thead>
            <tbody>
              ${rows.map(r=>`<tr>
                <td>${Utils.esc(r.project_name)||'—'}</td>
                <td class="td-bold">${Utils.esc(r.tower_name)||'—'}</td>
                <td class="txt-right">${r.unit_count||0}</td>
                <td>${spjCanDelete() ? `<button class="btn btn-ghost btn-xs spjn-del" onclick="SPJPage.deleteTower(this,'${r.id}','${r.project_id}')">✕</button>` : ''}</td>
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
      await Api.post(`/projects/${projectId}/towers`, { towerName });
      Utils.success(`Tower "${towerName}" added`);
      form.reset();
      document.getElementById('spj-tower-project').value = projectId;
      await this.loadTowers();
    } catch (err) { Utils.error(err.message); }
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
  async onUnitProjectChange() {
    const projectId = document.getElementById('spj-unit-project')?.value;
    const towSel = document.getElementById('spj-unit-tower');
    if (!towSel || !projectId) return;
    try {
      const res = await Api.get(`/projects/${projectId}/towers`);
      const towers = res.data || [];
      towSel.innerHTML = `<option value="">No Tower</option>` + towers.map(t=>`<option value="${t.id}">${Utils.esc(t.tower_name)}</option>`).join('');
    } catch { towSel.innerHTML = `<option value="">No towers</option>`; }
    const typeSel = document.getElementById('spj-unit-type');
    if (typeSel) {
      try {
        const res = await Api.get(`/master/unit-types?project_id=${encodeURIComponent(projectId)}`);
        typeSel.innerHTML = `<option value="">None</option>` + (res.data || []).map(t=>`<option value="${t.id}">${Utils.esc(t.name)}</option>`).join('');
      } catch { typeSel.innerHTML = `<option value="">None</option>`; }
    }
  },

  calcSuperArea() {
    const carpet = parseFloat(document.getElementById('spj-unit-carpet')?.value || 0);
    const balcony = parseFloat(document.getElementById('spj-unit-balcony')?.value || 0);
    const superEl = document.getElementById('spj-unit-super');
    if (superEl) {
      superEl.value = carpet + balcony ? (carpet + balcony).toFixed(3) : '';
      superEl.readOnly = true;
    }
  },

  async addUnit(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const formData = Object.fromEntries(fd.entries());

    const projectId = document.getElementById('spj-unit-project')?.value;
    const towerId = document.getElementById('spj-unit-tower')?.value;
    // Map form fields to API expected camelCase field names
    const body = {
      projectId: projectId,
      towerId: towerId || undefined,
      unitNumber: formData.unit_number,
      floor: formData.floor ? parseInt(formData.floor) : null,
      bhkType: formData.bhk_type,
      carpetAreaSqft: formData.carpet_area_sqft ? parseFloat(formData.carpet_area_sqft) : null,
      superAreaSqft: formData.super_area_sqft ? parseFloat(formData.super_area_sqft) : null,
      balconyAreaSqft: formData.balcony_area_sqft ? parseFloat(formData.balcony_area_sqft) : null,
      facing: formData.facing || undefined,
      basePriceInr: formData.base_price_inr ? parseFloat(formData.base_price_inr) : undefined,
      totalPriceInr: formData.total_price_inr ? parseFloat(formData.total_price_inr) : undefined,
      unitTypeId: formData.unit_type_id || undefined
    };

    if (!projectId) { Utils.warn('Please select a project'); return; }
    if (!towerId) { Utils.warn('Please select a tower'); return; }

    try {
      await Api.post('/units', body);
      Utils.success(`Unit ${body.unitNumber} added`);
      form.reset();
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
      const res = await Api.get('/master/reminder-master');
      const rows = res.data || [];
      el.innerHTML = rows.length === 0
        ? `<div class="empty-state"><div class="empty-icon">⏰</div><div>No reminders configured</div></div>`
        : `<table class="dash-tbl spjn-tbl">
            <thead><tr><th>Reminder Name</th><th class="txt-right">Days Before</th><th>Channel</th><th>Action</th></tr></thead>
            <tbody>
              ${rows.map(r=>`<tr>
                <td class="td-bold">${Utils.esc(r.name)}</td>
                <td class="txt-right" style="color:var(--warn);font-weight:700">${Utils.esc(r.days_before)}</td>
                <td><span class="chip chip-blue">${Utils.esc(r.channel)||'all'}</span></td>
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
    const body = Object.fromEntries(fd.entries());
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

  // ── Payment Plan Templates

  onTypeChange(type) {
    const pctWrap = document.getElementById('spj-plan-pct-wrap');
    const amtWrap = document.getElementById('spj-plan-amt-wrap');
    const nameField = document.getElementById('spj-plan-iname');
    if (!pctWrap || !amtWrap) return;
    if (type === 'other_charge') {
      pctWrap.style.display = 'none';
      amtWrap.style.display = '';
    } else {
      pctWrap.style.display = '';
      amtWrap.style.display = 'none';
    }
    const autoNames = { booking: 'Booking Amount', possession: 'On Possession', plc: 'PLC Charge' };
    if (autoNames[type] && nameField && !nameField.value.trim()) nameField.value = autoNames[type];
  },

  async onPlanProjectChange() {
    const projectId = document.getElementById('spj-plan-project')?.value;
    const planName  = document.getElementById('spj-plan-name')?.value || 'Standard AHP Plan';
    if (projectId) {
      await this.loadPlanPreview(projectId, planName);
      await this.loadAddonInputs(projectId);
    } else {
      const sec = document.getElementById('spj-plan-addon-section');
      if (sec) sec.style.display = 'none';
    }
  },

  async loadAddonInputs(projectId) {
    const section = document.getElementById('spj-plan-addon-section');
    const container = document.getElementById('spj-plan-addon-inputs');
    if (!section || !container) return;
    try {
      const res = await Api.get(`/addon-charges/master?projectId=${projectId}`);
      const masters = res.data || [];
      if (!masters.length) { section.style.display = 'none'; return; }
      container.innerHTML = masters.map(m => `
        <div class="fg">
          <label class="fl">${Utils.esc(m.charge_name)}<small style="color:var(--text3)"> (GST ${(parseFloat(m.cgst_pct||0)+parseFloat(m.sgst_pct||0)).toFixed(0)}%)</small></label>
          <div style="display:flex;align-items:center;gap:4px">
            <input type="number" min="0" max="100" step="0.1" class="fc" id="spj-addon-${m.id}" data-charge-master-id="${m.id}" data-charge-name="${Utils.esc(m.charge_name)}" value="0" style="width:80px;text-align:right" />
            <span style="color:var(--text2)">%</span>
          </div>
        </div>`).join('');
      section.style.display = 'block';
    } catch(e) {
      console.error('Failed to load addon masters', e);
      section.style.display = 'none';
    }
  },

  showPercentageWarning(currentTotal, adding, newTotal) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;';
    modal.innerHTML = `
      <div class="spjn-mo">
        <div class="spjn-mo-h">
          <div class="spjn-mo-ico" style="background:var(--red-bg);color:var(--red)">⚠</div>
          <div>
            <div class="spjn-mo-t">Payment Plan Limit Exceeded</div>
            <div class="spjn-mo-s">Total installment percentage cannot exceed 100%.</div>
          </div>
        </div>
        <div class="spjn-mo-b">
          <div class="spjn-mo-stat">
            <div><span>Current</span><strong>${currentTotal}%</strong></div>
            <div><span>Adding</span><strong>${adding}%</strong></div>
            <div><span>Result</span><strong style="color:var(--red)">${newTotal}%</strong></div>
          </div>
          Please reduce the percentage to <b>${(100 - currentTotal).toFixed(3)}%</b> or less to complete this plan at exactly 100%.
        </div>
        <div class="spjn-mo-f">
          <button class="btn btn-teal" onclick="this.closest('[style*=fixed]').remove()">OK, I Understand</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  },

  async addInstallment(e) {
    e.preventDefault();
    const form = e.target;
    const projectId = document.getElementById('spj-plan-project')?.value;
    if (!projectId) { Utils.warn('Please select a project first'); return; }
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());

    // Enforce 100% cap before sending to backend
    const newPercentage = parseFloat(body.percentage) || 0;
    if (newPercentage > 0) {
      try {
        const planName = body.plan_name || 'Standard AHP Plan';
        const existing = await Api.get(`/projects/${projectId}/plan-templates?planName=${encodeURIComponent(planName)}`);
        const rows = existing.data || existing || [];
        const currentTotal = rows.reduce((s, r) => s + (parseFloat(r.percentage) || 0), 0);
        const newTotal = currentTotal + newPercentage;
        if (currentTotal >= 100) {
          this.showPercentageWarning(parseFloat(currentTotal.toFixed(3)), newPercentage, parseFloat((currentTotal + newPercentage).toFixed(3)));
          return;
        }
        if (newTotal > 100) {
          this.showPercentageWarning(parseFloat(currentTotal.toFixed(3)), newPercentage, parseFloat(newTotal.toFixed(3)));
          return;
        }
      } catch { /* if pre-check fails, let backend validate */ }
    }

    try {
      const created = await Api.post(`/projects/${projectId}/plan-templates`, body);
      const newTemplateId = created?.data?.id;
      Utils.success(`"${body.installment_name}" added`);
      // Auto-increment index
      const idxEl = document.getElementById('spj-plan-idx');
      if (idxEl) idxEl.value = (parseInt(idxEl.value) || 1) + 1;
      // Reset volatile fields; keep project, plan name, type, index
      form.querySelector('[name="installment_name"]').value = '';
      const pct = form.querySelector('[name="percentage"]');
      if (pct) pct.value = '';
      const amt = form.querySelector('[name="flat_amount_inr"]');
      if (amt) amt.value = '';
      const notes = form.querySelector('[name="notes"]');
      if (notes) notes.value = '';
      // Save addon charge percentages if any are configured
      if (newTemplateId) {
        const addonInputs = document.querySelectorAll('#spj-plan-addon-inputs input[data-charge-master-id]');
        const addonSaves = [];
        addonInputs.forEach(inp => {
          const addonPct = parseFloat(inp.value || 0);
          if (addonPct > 0) {
            addonSaves.push(Api.post(`/projects/${projectId}/plan-templates/${newTemplateId}/addon-charges`, { charge_master_id: inp.getAttribute('data-charge-master-id'), pct: addonPct }));
          }
        });
        if (addonSaves.length) {
          try { await Promise.all(addonSaves); }
          catch(e) { Utils.warn('Installment saved but some addon percentages failed to save. Use the Addon % button to retry.'); }
        }
        // Reset addon inputs to 0
        addonInputs.forEach(inp => { inp.value = 0; });
      }
      // Refresh live preview
      await this.loadPlanPreview(projectId, body.plan_name);
    } catch (err) { Utils.error(err.message); }
  },

  async loadPlanPreview(projectId, planName) {
    const el = document.getElementById('spj-plan-preview');
    if (!el || !projectId) return;
    try {
      const params = planName ? `?planName=${encodeURIComponent(planName)}` : '';
      const [res, addonRes] = await Promise.all([
        Api.get(`/projects/${projectId}/plan-templates${params}`),
        planName ? Api.get(`/projects/${projectId}/plan-addon-pcts?planName=${encodeURIComponent(planName)}`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      const rows = res.data || [];
      if (!rows.length) { el.innerHTML = ''; return; }
      // Build map: installment_index → [{charge_name, pct}]
      const addonMap = new Map();
      (addonRes.data || []).forEach(a => {
        if (!addonMap.has(a.installment_index)) addonMap.set(a.installment_index, []);
        addonMap.get(a.installment_index).push(a);
      });
      const total = rows.reduce((s, r) => s + (parseFloat(r.percentage) || 0), 0);
      const totalOk = Math.abs(total - 100) < 0.1;
      const rowsHtml = rows.map(r => {
        const entries = addonMap.get(r.installment_index) || [];
        const nonZero = entries.filter(e => parseFloat(e.pct) > 0);
        const addonCell = nonZero.length
          ? nonZero.map(e => `<span class="spjn-pill">${Utils.esc(e.charge_name.split(' ')[0])}:${parseFloat(e.pct).toFixed(0)}%</span>`).join('') + `<button class="btn btn-ghost btn-xs" style="margin-left:4px" onclick="SPJPage.openAddonPctModal('${r.id}','${projectId}')">Edit</button>`
          : `<button class="btn btn-ghost btn-xs" onclick="SPJPage.openAddonPctModal('${r.id}','${projectId}')">Set Addon %</button>`;
        return `<tr>
                  <td>${r.installment_index}</td>
                  <td class="td-bold">${Utils.esc(r.installment_name)}</td>
                  <td>${Utils.chip(r.installment_type || 'installment')}</td>
                  <td class="txt-right">${r.percentage ? parseFloat(r.percentage).toFixed(1) + '%' : '—'}</td>
                  <td class="txt-right">${r.flat_amount_inr ? Utils.currency(r.flat_amount_inr) : '—'}</td>
                  <td class="txt-right">${r.due_date_offset_days || 0}d</td>
                  <td>${addonCell}</td>
                  <td><button class="btn btn-ghost btn-xs spjn-del" onclick="SPJPage.deleteTemplate(this,'${r.id}','${projectId}')">✕</button></td>
                </tr>`;
      }).join('');
      el.innerHTML = `
        <div class="spjn-list" style="max-width:980px;margin:0 auto">
          <div class="spjn-list-h">
            <div class="spjn-list-t">Current Schedule: ${Utils.esc(planName || 'Plan')}</div>
            <span class="chip ${totalOk ? 'chip-teal' : 'chip-warn'}">${total.toFixed(1)}% total${totalOk ? ' ✓' : ' — needs 100%'}</span>
          </div>
          <div class="spjn-tscroll">
            <table class="dash-tbl spjn-tbl">
              <thead><tr><th>#</th><th>Name</th><th>Type</th><th class="txt-right">%</th><th class="txt-right">Flat ₹</th><th class="txt-right">Due (days)</th><th>Addon %</th><th>Remove</th></tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>`;
    } catch (err) {
      el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  async openAddonPctModal(templateId, projectId) {
    const [mastersRes, existingRes] = await Promise.all([
      Api.get(`/addon-charges/master?projectId=${projectId}`),
      Api.get(`/projects/${projectId}/plan-templates/${templateId}/addon-charges`),
    ]);
    const masters  = mastersRes.data  || [];
    const existing = existingRes.data || [];

    const pctMap = {};
    existing.forEach(e => { pctMap[e.charge_master_id] = parseFloat(e.pct || 0); });

    if (!masters.length) {
      Utils.warn('No addon charge types configured for this project.');
      return;
    }

    const rows = masters.map(m => `
      <tr>
        <td>${Utils.esc(m.charge_name)}<small style="color:var(--text3);margin-left:6px">(GST ${(parseFloat(m.cgst_pct||0)+parseFloat(m.sgst_pct||0)).toFixed(0)}%)</small></td>
        <td class="txt-right">
          <span class="spjn-suf" style="display:inline-block;width:110px">
            <input type="number" min="0" max="100" step="0.1" class="fc" style="text-align:right"
              data-charge-master-id="${m.id}" value="${pctMap[m.id] !== undefined ? pctMap[m.id] : 0}" /><span>%</span>
          </span>
        </td>
      </tr>`).join('');

    document.body.insertAdjacentHTML('beforeend', `
      <div id="addon-pct-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px">
        <div class="spjn-mo">
          <div class="spjn-mo-h">
            <div class="spjn-mo-ico" style="background:var(--teal-bg);color:var(--teal)">%</div>
            <div>
              <div class="spjn-mo-t">Addon Charge %</div>
              <div class="spjn-mo-s">Set the % of each addon charge due in this installment. Each charge type must total 100% across all installments.</div>
            </div>
            <button class="spjn-mo-x" onclick="document.getElementById('addon-pct-modal')?.remove()">✕</button>
          </div>
          <div style="padding:6px 6px 0">
            <table class="spjn-tbl">
              <thead><tr>
                <th>Charge Type</th>
                <th class="txt-right">Percentage</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <div class="spjn-mo-f">
            <button class="btn btn-ghost" onclick="document.getElementById('addon-pct-modal').remove()">Cancel</button>
            <button class="btn btn-teal" onclick="SPJPage.saveAddonPcts('${templateId}','${projectId}')">Save</button>
          </div>
        </div>
      </div>`);
    const modal = document.getElementById('addon-pct-modal');
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    const escHandler = e => { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
  },

  async saveAddonPcts(templateId, projectId) {
    const inputs = document.querySelectorAll('#addon-pct-modal input[data-charge-master-id]');
    let hasError = false;
    inputs.forEach(inp => {
      const v = parseFloat(inp.value || 0);
      if (v < 0 || v > 100) hasError = true;
    });
    if (hasError) { Utils.warn('Each percentage must be between 0 and 100.'); return; }

    const saves = [];
    inputs.forEach(inp => {
      const chargeMasterId = inp.getAttribute('data-charge-master-id');
      const pct = parseFloat(inp.value || 0);
      saves.push(Api.post(`/projects/${projectId}/plan-templates/${templateId}/addon-charges`, { charge_master_id: chargeMasterId, pct }));
    });

    try {
      await Promise.all(saves);
      document.getElementById('addon-pct-modal')?.remove();
      Utils.toast('Addon percentages saved ✅');
      const pid = document.getElementById('spj-plan-project')?.value;
      const pname = document.getElementById('spj-plan-name')?.value;
      if (pid && pname) await this.loadPlanPreview(pid, pname);
    } catch (err) {
      Utils.error('Save failed: ' + (err.message || 'Unknown error'));
    }
  },

  clearPlanForm() {
    const form = document.getElementById('spj-plan-form');
    if (!form) return;
    form.querySelector('[name="installment_name"]').value = '';
    const pct = form.querySelector('[name="percentage"]'); if (pct) pct.value = '';
    const amt = form.querySelector('[name="flat_amount_inr"]'); if (amt) amt.value = '';
    const notes = form.querySelector('[name="notes"]'); if (notes) notes.value = '';
    document.getElementById('spj-plan-idx').value = '1';
    document.getElementById('spj-plan-type').value = 'installment';
    this.onTypeChange('installment');
    document.getElementById('spj-plan-preview').innerHTML = '';
  },

  async loadAHPTemplate() {
    const projectId = document.getElementById('spj-plan-project')?.value;
    if (!projectId) { Utils.warn('Please select a project first'); return; }
    const planName = document.getElementById('spj-plan-name')?.value?.trim() || 'Standard AHP Plan';
    const schedule = [
      { installment_name: 'Booking Amount',   installment_type: 'booking',     percentage: '5',    installment_index: 1, due_date_offset_days: 0 },
      { installment_name: 'On Allotment',      installment_type: 'installment', percentage: '20',   installment_index: 2, due_date_offset_days: 15 },
      { installment_name: '1st Half-Yearly',   installment_type: 'installment', percentage: '12.5', installment_index: 3, due_date_offset_days: 180 },
      { installment_name: '2nd Half-Yearly',   installment_type: 'installment', percentage: '12.5', installment_index: 4, due_date_offset_days: 360 },
      { installment_name: '3rd Half-Yearly',   installment_type: 'installment', percentage: '12.5', installment_index: 5, due_date_offset_days: 540 },
      { installment_name: '4th Half-Yearly',   installment_type: 'installment', percentage: '12.5', installment_index: 6, due_date_offset_days: 720 },
      { installment_name: '5th Half-Yearly',   installment_type: 'installment', percentage: '12.5', installment_index: 7, due_date_offset_days: 900 },
      { installment_name: '6th Half-Yearly',   installment_type: 'installment', percentage: '12.5', installment_index: 8, due_date_offset_days: 1080 },
      { installment_name: 'On Possession',     installment_type: 'possession',  percentage: '0',    installment_index: 9, due_date_offset_days: 0 },
    ];
    if (!confirm(`Load standard AHP schedule (9 items, 100%) for "${planName}"? Existing items with same plan name will coexist.`)) return;
    try {
      for (const item of schedule) {
        await Api.post(`/projects/${projectId}/plan-templates`, { ...item, plan_name: planName });
      }
      Utils.success('AHP template loaded (9 installments, 100%)');
      await this.loadPlanPreview(projectId, planName);
    } catch (err) { Utils.error(`Load failed: ${err.message}`); }
  },

  // ── Edit sub-tab
  async loadPlanTemplates() {
    const el = document.getElementById('spj-plan-edit-body');
    if (!el) return;
    const projectId = document.getElementById('spj-plan-edit-project')?.value;
    el.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;
    try {
      const projects = projectId
        ? [this._projects.find(p => p.id === projectId) || { id: projectId, name: '' }]
        : this._projects;
      if (!projects.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div>No projects found</div></div>`;
        return;
      }
      let html = '';
      for (const proj of projects) {
        const res = await Api.get(`/projects/${proj.id}/plan-templates`);
        const rows = res.data || [];
        if (!rows.length) continue;
        const plans = {};
        rows.forEach(r => { if (!plans[r.plan_name]) plans[r.plan_name] = []; plans[r.plan_name].push(r); });
        for (const [planName, items] of Object.entries(plans)) {
          const total = items.reduce((s, r) => s + (parseFloat(r.percentage) || 0), 0);
          const ok = Math.abs(total - 100) < 0.1;
          html += `
            <div class="spjn-list" style="max-width:980px;margin:0 auto 18px">
              <div class="spjn-list-h">
                <div class="spjn-list-t">${Utils.esc(proj.name || proj.id)} — ${Utils.esc(planName)}</div>
                <span class="chip ${ok ? 'chip-teal' : 'chip-warn'}">${total.toFixed(1)}% total</span>
              </div>
              <div class="spjn-tscroll">
                <table class="dash-tbl spjn-tbl">
                  <thead><tr><th>#</th><th>Name</th><th>Type</th><th class="txt-right">%</th><th class="txt-right">Flat ₹</th><th class="txt-right">Due (days)</th><th>Notes</th><th>Actions</th></tr></thead>
                  <tbody>
                    ${items.map(r => `<tr id="ptrow-${r.id}">
                      <td>${r.installment_index}</td>
                      <td class="td-bold">${Utils.esc(r.installment_name)}</td>
                      <td>${Utils.chip(r.installment_type || 'installment')}</td>
                      <td class="txt-right">${r.percentage ? parseFloat(r.percentage).toFixed(1) + '%' : '—'}</td>
                      <td class="txt-right">${r.flat_amount_inr ? Utils.currency(r.flat_amount_inr) : '—'}</td>
                      <td class="txt-right">${r.due_date_offset_days || 0}d</td>
                      <td style="color:var(--text3);font-size:12px">${Utils.esc(r.notes || '')}</td>
                      <td><div style="display:flex;gap:4px">
                        <button class="btn btn-ghost btn-xs" onclick="SPJPage.inlineEditTemplate('${r.id}','${proj.id}')">✎ Edit</button>
                        <button class="btn btn-ghost btn-xs spjn-del" onclick="SPJPage.deleteTemplate(this,'${r.id}','${proj.id}')">✕</button>
                      </div></td>
                    </tr>
                    <tr id="ptrow-edit-${r.id}" style="display:none">
                      <td colspan="8">
                        <div class="spjn-edit-row">
                          <div class="fg"><label class="fl">Name</label><input class="fc" id="pt-name-${r.id}" value="${Utils.esc(r.installment_name)}"></div>
                          <div class="fg"><label class="fl">Type</label>
                            <select class="fc" id="pt-type-${r.id}">
                              ${['installment','plc','other_charge','booking','possession'].map(t=>`<option value="${t}"${r.installment_type===t?' selected':''}>${t}</option>`).join('')}
                            </select>
                          </div>
                          <div class="fg"><label class="fl">% / Amount</label><input type="number" step="0.001" class="fc" id="pt-pct-${r.id}" value="${r.percentage||''}"></div>
                          <div class="fg"><label class="fl">Due (days)</label><input type="number" class="fc" id="pt-off-${r.id}" value="${r.due_date_offset_days||0}"></div>
                          <div class="fg"><label class="fl">Index</label><input type="number" class="fc" id="pt-idx-${r.id}" value="${r.installment_index||1}"></div>
                          <div class="fg"><label class="fl">Notes</label><input class="fc" id="pt-notes-${r.id}" value="${Utils.esc(r.notes||'')}"></div>
                          <div class="fg" style="display:flex;flex-direction:row;align-items:flex-end;gap:8px">
                            <button class="btn btn-teal btn-sm" onclick="SPJPage.saveEditTemplate('${r.id}','${proj.id}')">Save</button>
                            <button class="btn btn-ghost btn-sm" onclick="SPJPage.cancelEditTemplate('${r.id}')">Cancel</button>
                          </div>
                        </div>
                      </td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>`;
        }
      }
      el.innerHTML = html || `<div class="empty-state"><div class="empty-icon">📋</div><div>No payment plan schedules found. Use the New tab to create one.</div></div>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  },

  inlineEditTemplate(id, projectId) {
    document.getElementById(`ptrow-${id}`).style.display = 'none';
    document.getElementById(`ptrow-edit-${id}`).style.display = '';
  },

  cancelEditTemplate(id) {
    document.getElementById(`ptrow-${id}`).style.display = '';
    document.getElementById(`ptrow-edit-${id}`).style.display = 'none';
  },

  async saveEditTemplate(id, projectId) {
    const body = {
      installment_name:     document.getElementById(`pt-name-${id}`)?.value?.trim(),
      installment_type:     document.getElementById(`pt-type-${id}`)?.value,
      percentage:           parseFloat(document.getElementById(`pt-pct-${id}`)?.value) || null,
      due_date_offset_days: parseInt(document.getElementById(`pt-off-${id}`)?.value) || 0,
      installment_index:    parseInt(document.getElementById(`pt-idx-${id}`)?.value) || 1,
      notes:                document.getElementById(`pt-notes-${id}`)?.value?.trim() || null,
    };
    try {
      await Api.patch(`/projects/${projectId}/plan-templates/${id}`, body);
      Utils.success('Updated');
      await this.loadPlanTemplates();
    } catch (err) { Utils.error(err.message); }
  },

  async deleteTemplate(btn, id, projectId) {
    if (!confirm('Delete this installment?')) return;
    try {
      await Api.delete(`/projects/${projectId}/plan-templates/${id}`);
      // Remove both the display row and any edit row
      document.getElementById(`ptrow-${id}`)?.remove();
      document.getElementById(`ptrow-edit-${id}`)?.remove();
      btn.closest('tr')?.remove();
      Utils.success('Deleted');
      // Refresh preview if visible
      const previewEl = document.getElementById('spj-plan-preview');
      if (previewEl && previewEl.innerHTML) {
        const pid = document.getElementById('spj-plan-project')?.value;
        const pname = document.getElementById('spj-plan-name')?.value;
        if (pid) await this.loadPlanPreview(pid, pname);
      }
    } catch (err) { Utils.error(err.message); }
  },

  async onPlanviewProjectChange() {
    const projectId = document.getElementById('spj-planview-project')?.value;
    const planSel = document.getElementById('spj-planview-plan');
    if (!planSel) return;

    planSel.innerHTML = '<option value="">-- All Plans --</option>';

    if (!projectId) return;

    try {
      const res = await Api.get(`/payments/plan-names/${projectId}`);
      const names = res.data || res || [];
      names.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        planSel.appendChild(opt);
      });
    } catch (e) {
      console.error('Failed to load plan names', e);
    }
  },

  async loadPaymentPlans() {
    const el = document.getElementById('spj-plans-body');
    if (!el) return;
    const projectId = document.getElementById('spj-planview-project')?.value;
    try {
      const projects = projectId ? [{ id: projectId, name: this._projects.find(p=>p.id===projectId)?.name||'' }] : this._projects;
      let html = '';
      for (const proj of projects) {
        const selectedPlan = document.getElementById('spj-planview-plan')?.value || '';
        const url = selectedPlan
          ? `/projects/${proj.id}/plan-templates?planName=${encodeURIComponent(selectedPlan)}`
          : `/projects/${proj.id}/plan-templates`;
        const res = await Api.get(url);
        const templates = res.data || [];

        // Group by plan_name
        const planMap = {};
        templates.forEach(t => {
          if (!planMap[t.plan_name]) planMap[t.plan_name] = [];
          planMap[t.plan_name].push(t);
        });
        const uniquePlans = Object.keys(planMap);

        html += `
          <div class="spjn-list" style="max-width:980px;margin:0 auto 18px">
            <div class="spjn-list-h">
              <div class="spjn-list-t">${proj.name||'Project'}</div>
              <span class="chip chip-blue">${uniquePlans.length} plans</span>
            </div>
            ${uniquePlans.length === 0
              ? `<div style="padding:18px;color:var(--text3);font-size:12.5px">No payment plans created yet</div>`
              : `<div style="padding:4px 0">
                  ${uniquePlans.map(planName => {
                    const installments = planMap[planName];
                    const total = installments.reduce((s, i) => s + (parseFloat(i.percentage) || 0), 0);
                    const totalOk = Math.abs(total - 100) < 0.1;
                    return `
                      <div class="spjn-plan">
                        <div class="spjn-plan-h">
                          <span>${Utils.esc(planName)}</span>
                          <span class="chip ${totalOk ? 'chip-teal' : 'chip-warn'}">${total.toFixed(1)}%</span>
                        </div>
                        <table class="dash-tbl spjn-tbl" style="margin:0">
                          <thead><tr><th>#</th><th>Installment</th><th class="txt-right">%</th><th class="txt-right">Due (days)</th></tr></thead>
                          <tbody>
                            ${installments.map(i => `<tr>
                              <td>${i.installment_index}</td>
                              <td>${Utils.esc(i.installment_name)}</td>
                              <td class="txt-right">${i.percentage}</td>
                              <td class="txt-right">${i.due_date_offset_days}</td>
                            </tr>`).join('')}
                          </tbody>
                        </table>
                      </div>
                    `;
                  }).join('')}
                </div>`}
          </div>`;
      }
      el.innerHTML = html || `<div class="empty-state"><div class="empty-icon">📋</div><div>No payment plans found</div></div>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  },

  // ── Rate Report
  async loadRateReport() {
    const el = document.getElementById('spj-rate-report');
    if (!el) return;
    try {
      const res = await Api.get('/projects/reports/rates');
      const rows = res.data || [];
      el.innerHTML = rows.length === 0
        ? `<div class="empty-state"><div class="empty-icon">💰</div><div>No rate data available — add units with base prices to see the rate report</div></div>`
        : `<table class="dash-tbl spjn-tbl">
            <thead><tr>
              <th>Project</th><th>BHK</th><th>Tower</th>
              <th class="txt-right">Units</th>
              <th class="txt-right">Min Price</th><th class="txt-right">Max Price</th><th class="txt-right">Avg Price</th>
              <th class="txt-right">Min Carpet</th><th class="txt-right">Max Carpet</th>
            </tr></thead>
            <tbody>
              ${rows.map(r=>`<tr>
                <td class="td-bold">${r.project_name}</td>
                <td>${r.bhk_type||'—'}</td>
                <td>${r.tower||'—'}</td>
                <td class="txt-right">${r.unit_count}</td>
                <td class="txt-right">${Utils.currency(r.min_price)}</td>
                <td class="txt-right">${Utils.currency(r.max_price)}</td>
                <td class="txt-right" style="font-weight:600;color:var(--teal)">${Utils.currency(r.avg_price)}</td>
                <td class="txt-right">${r.min_carpet||0} sqft</td>
                <td class="txt-right">${r.max_carpet||0} sqft</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  },

  setInstallmentType(type) {
    const el = document.getElementById('spj-plan-type');
    if (el) {
      el.value = type;
      this.onTypeChange(type);
    }
  },

  // ── Unit Address (Unit Types) ────────────────
  async loadUnitTypes() {
    const projectId = document.getElementById('spj-ut-project')?.value;
    const el = document.getElementById('spj-unit-types-list');
    if (!el) return;
    el.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;
    try {
      const res = await Api.get('/master/unit-types', projectId ? { project_id: projectId } : {});
      const rows = res.data || [];
      el.innerHTML = `
        <div class="spjn-list">
          <div class="spjn-list-h"><div class="spjn-list-t">Existing Unit Types</div><span class="chip chip-blue">${rows.length} types</span></div>
          <div class="spjn-tscroll">
            <table class="dash-tbl spjn-tbl">
              <thead><tr><th>Project</th><th>Name</th><th>Carpet</th><th>Balcony</th><th>Base Rate</th><th>Actions</th></tr></thead>
              <tbody>
                ${rows.map(r => `<tr>
                  <td>${Utils.esc(r.project_name)}</td>
                  <td class="td-bold">${Utils.esc(r.name)}</td>
                  <td>${r.carpet_area_sqft || 0} sqft</td>
                  <td>${r.balcony_area_sqft || 0} sqft</td>
                  <td>₹${r.base_rate_sqft || 0}/sqft</td>
                  <td>${spjCanDelete() ? `<button class="btn btn-ghost btn-xs spjn-del" onclick="SPJPage.deleteUnitType('${r.id}')">✕</button>` : ''}</td>
                </tr>`).join('')}
              </tbody>
            </table>
            ${rows.length === 0 ? '<div style="padding:20px;text-align:center;color:var(--text3)">No unit types defined yet</div>' : ''}
          </div>
        </div>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  },

  async createUnitType(e) {
    e.preventDefault();
    const data = Utils.formData(e.target);
    try {
      await Api.post('/master/unit-types', data);
      Utils.success('Unit type added');
      e.target.reset();
      await this.loadUnitTypes();
    } catch (err) { Utils.error(err.message); }
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
