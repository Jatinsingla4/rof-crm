// ROF CRM — Customer-Wise Demand Raise Page (Legacy 1:1 Replica)

Pages.demandRaise = async function(params = {}) {
  const content = document.getElementById('content');
  
  // Load initial data for filters
  let projects = []; // [{id, name}]
  let towers = [];
  try {
    const pRes = await Api.get('/units', { params: { page: 1, pageSize: 300 } });
    const units = pRes.data || pRes || [];
    const seen = new Set();
    projects = units.reduce((acc, u) => {
      const id = u.project_id || u.projectId;
      const name = u.project_name || u.projectName;
      if (id && name && !seen.has(id)) { seen.add(id); acc.push({ id, name }); }
      return acc;
    }, []);
    towers = [...new Set(units.map(u => u.tower_name || u.towerName).filter(Boolean))];
  } catch {}

  content.innerHTML = `
    <div class="page-hdr">
      <h1>Customer-Wise Demand Raise</h1>
      <div class="breadcrumb">Application / Demand Raise / <b>Customer wise</b></div>
    </div>

    <!-- LEGACY FILTER PANEL -->
    <div class="sp legacy-search">
      <div class="sp-hdr"><div class="sp-title">CUSTOMER WISE DEMAND RAISE</div></div>
      <div class="sp-body">
        <div class="sp-grid" style="grid-template-columns: repeat(6, 1fr);">
          <div class="fg">
            <label class="fl"><span class="r">*</span>Project:</label>
            <select class="fc" id="f-project">
              <option value="">— Select —</option>
              ${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="fg">
            <label class="fl"><span class="r">*</span>Payment Plan:</label>
            <select class="fc" id="f-plan">
              <option>Payment Plan</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl"><span class="r">*</span>Installment:</label>
            <select class="fc" id="f-installment">
              <option value="">— Select —</option>
              <option value="allotment">At the time of Allotment (20.00%)</option>
              <option value="installment_1">Within 6 months (12.50%)</option>
              <option value="installment_2">Within 12 months (12.50%)</option>
              <option value="installment_3">Within 18 months (12.50%)</option>
              <option value="installment_4">Within 24 months (12.50%)</option>
              <option value="installment_5">Within 30 months (12.50%)</option>
              <option value="installment_6">Within 36 months (12.50%)</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Tower:</label>
            <select class="fc" id="f-tower">
              <option value="">— Select —</option>
              ${towers.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
          </div>
          <div class="fg">
            <label class="fl">Floor:</label>
            <select class="fc" id="f-floor">
              <option value="">— All —</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Registration No.:</label>
            <input class="fc" id="f-reg-no" placeholder="Registration No">
          </div>
          <div class="fg">
            <label class="fl">First Name:</label>
            <input class="fc" id="f-name" placeholder="First Name">
          </div>
          <div class="fg" style="grid-column: span 2;">
            <label class="fl">Unit Address :</label>
            <input class="fc" id="f-unit-addr" placeholder="Unit Address">
          </div>
        </div>
        <div style="margin-top:15px">
          <button class="btn btn-fetch" onclick="DemandRaisePage.fetch()" style="width:100px; background:#0056b3; font-weight:bold;">FETCH</button>
        </div>
      </div>
    </div>

    <!-- RESULTS TABLE -->
    <div class="tbl-wrap legacy-table" id="dr-results-wrap" style="display:none; margin-top:20px;">
      <div class="tbl-hdr" style="background:#0056b3; color:white">
        <div class="tbl-title" style="color:white">CUSTOMER WISE DEMAND RAISE</div>
      </div>
      <div class="horizontal-scroll">
        <table id="dr-table">
          <thead>
            <tr>
              <th>S.NO.</th>
              <th>REGISTRATION NO.</th>
              <th>NAME</th>
              <th>UNIT TYPE</th>
              <th>UNIT ADDRESS</th>
              <th>DUE AMOUNT</th>
              <th>TOTAL PAID AMOUNT</th>
              <th>BALANCE AMOUNT</th>
              <th>INSTALLMENT DATE</th>
              <th style="width:40px"><input type="checkbox" onclick="DemandRaisePage.toggleAll(this.checked)"></th>
            </tr>
          </thead>
          <tbody id="dr-table-body"></tbody>
        </table>
      </div>
      <div style="padding:15px; background:#f8f9fa; border-top:1px solid #ddd">
        <button class="btn btn-proceed" onclick="DemandRaisePage.openModal()" style="background:#dc3545; color:white; font-weight:bold; border-radius:2px;">PROCEED</button>
      </div>
    </div>

    <!-- MODAL -->
    <div id="dr-modal" class="modal">
      <div class="modal-content" style="max-width:400px; padding:0">
        <div class="modal-hdr" style="background:#0056b3; color:white; padding:10px 15px; display:flex; justify-content:space-between; align-items:center">
          <div style="font-weight:bold; font-size:12px">RAISE/EDIT DEMAND</div>
          <span class="close" onclick="DemandRaisePage.closeModal()">&times;</span>
        </div>
        <div class="modal-body" style="padding:20px">
          <div class="fg">
            <label class="fl">Installment Date</label>
            <input type="date" id="m-inst-date" class="fc" value="${Utils.today()}">
          </div>
          <div style="margin-top:20px; display:flex; gap:10px">
            <button class="btn" style="background:#0056b3; color:white; font-weight:bold; flex:1" onclick="DemandRaisePage.submit()">UPDATE</button>
            <button class="btn" style="background:#0056b3; color:white; font-weight:bold; flex:1" onclick="DemandRaisePage.closeModal()">BACK</button>
          </div>
        </div>
      </div>
    </div>

    <style>
      .legacy-search .fl { font-weight:600; font-size:11px; color:#333; margin-bottom:4px; }
      .legacy-table table { font-size:11px; border-collapse: collapse; width:100%; min-width:1200px; }
      .legacy-table th { background:#f2f2f2; border:1px solid #ddd; padding:8px; text-align:left; color:#333; font-weight:600; text-transform:uppercase; }
      .legacy-table td { border:1px solid #ddd; padding:8px; background:white; }
      .horizontal-scroll { overflow-x: auto; border:1px solid #ddd; }
      .modal { display:none; position:fixed; z-index:1000; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.4); }
      .modal-content { position:relative; margin:10% auto; background:white; border-radius:4px; box-shadow:0 5px 15px rgba(0,0,0,0.3); }
      .close { color:white; font-size:24px; font-weight:bold; cursor:pointer; }
    </style>
  `;
};

const DemandRaisePage = {
  _data: [],

  async fetch() {
    const filters = {
      projectId: document.getElementById('f-project').value || undefined,
      installmentType: document.getElementById('f-installment').value || undefined,
      tower: document.getElementById('f-tower').value || undefined,
      registrationNo: document.getElementById('f-reg-no').value || undefined,
      name: document.getElementById('f-name').value || undefined,
      unitAddress: document.getElementById('f-unit-addr').value || undefined,
      status: 'pending' // Only show pending demands for raising
    };

    if (!filters.installmentType) return Utils.warn('Please select an Installment stage');

    Utils.showTable('dr-results-wrap');
    document.getElementById('dr-table-body').innerHTML = `<tr><td colspan="10" style="text-align:center; padding:20px"><div class="spinner"></div> Fetching data…</td></tr>`;

    try {
      const res = await Api.get('/payments/demands', { params: filters });
      this._data = res.data || res || [];
      this.renderTable(this._data);
    } catch (err) {
      document.getElementById('dr-table-body').innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:#dc3545">Error: ${err.message}</td></tr>`;
      Utils.error(err.message);
    }
  },

  renderTable(list) {
    if (list.length === 0) {
      document.getElementById('dr-table-body').innerHTML = `<tr><td colspan="10" style="text-align:center; padding:20px; color:var(--red)">No pending installments found for selected criteria</td></tr>`;
      return;
    }

    const rows = list.map((d, i) => `
      <tr>
        <td>${i+1}</td>
        <td class="td-mono">${d.registration_no || '—'}</td>
        <td class="td-bold">${d.consumer_name || '—'}</td>
        <td>${d.unit_type || '—'}</td>
        <td class="td-bold">${d.unit_address || '—'}</td>
        <td class="td-bold">${Utils.currency(parseFloat(d.amount_due_inr) + parseFloat(d.cgst_amount) + parseFloat(d.sgst_amount))}</td>
        <td>${Utils.currency(d.total_paid || 0)}</td>
        <td class="td-bold" style="color:#dc3545">${Utils.currency(d.balance || 0)}</td>
        <td>${d.status === 'demanded' ? Utils.date(d.due_date) : 'N/A'}</td>
        <td><input type="checkbox" class="row-sel" value="${d.id}"></td>
      </tr>
    `).join('');

    document.getElementById('dr-table-body').innerHTML = rows;
  },

  toggleAll(checked) {
    document.querySelectorAll('.row-sel').forEach(cb => cb.checked = checked);
  },

  openModal() {
    const selected = Array.from(document.querySelectorAll('.row-sel:checked')).map(cb => cb.value);
    if (selected.length === 0) return Utils.warn('Please select at least one record');
    document.getElementById('dr-modal').style.display = 'block';
  },

  closeModal() {
    document.getElementById('dr-modal').style.display = 'none';
  },

  async submit() {
    const selected = Array.from(document.querySelectorAll('.row-sel:checked')).map(cb => cb.value);
    const instDate = document.getElementById('m-inst-date').value;

    if (!instDate) return Utils.error('Please select an Installment Date');

    try {
      const res = await Api.patch('/payments/demands/activate', {
        demandIds: selected,
        installmentDate: instDate
      });
      Utils.success(`Successfully raised ${res.activatedCount} demands`);
      this.closeModal();
      this.fetch();
    } catch (err) {
      Utils.error(err.message);
    }
  }
};
