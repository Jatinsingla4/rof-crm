// ROF CRM — Customer Wise Interest Page (4 tabs)

{
  const CWI_STYLES = `
<style id="cwi-styles">
.cwi-page { padding:0; font-size:13px; background:transparent; max-width:1180px; margin:0 auto }
.cwi-tabs { display:flex; gap:8px; margin-bottom:18px; flex-wrap:wrap; background:transparent; border:none }
.cwi-tab { padding:7px 16px; border:1px solid var(--border2); background:var(--surface); color:var(--text2); cursor:pointer; border-radius:999px; font-size:12px; font-weight:500; margin:0; transition:.15s }
.cwi-tab:hover:not(.active) { border-color:var(--teal); color:var(--teal); background:var(--surface) }
.cwi-tab.active { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600 }
.cwi-filter-card { margin-bottom:16px; background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
.cwi-filter-body { padding:18px; background:transparent }
.cwi-filter-row { display:flex; gap:16px 18px; align-items:flex-end; flex-wrap:wrap }
.cwi-fg { display:flex; flex-direction:column; gap:6px }
.cwi-lbl { font-size:11px; color:var(--text2); font-weight:500; letter-spacing:.3px }
.cwi-req { color:var(--red) }
.cwi-filter-body select, .cwi-filter-body input[type="text"] { padding:9px 12px; border:1px solid var(--border2); border-radius:8px; font-size:13px; background:var(--surface); color:var(--text); min-height:38px; box-sizing:border-box }
.cwi-filter-body select, .cwi-filter-body input[type="text"]:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
.cwi-filter-body select, .cwi-filter-body input[type="text"] { min-width:170px }
.cwi-btn-fetch { background:var(--teal); color:#fff; border:none; padding:9px 24px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; min-height:38px }
.cwi-btn-fetch:hover { filter:brightness(.92) }
.cwi-btn-fetch:disabled { opacity:.65; cursor:default }
.cwi-fmsg { margin-top:12px }
.cwi-fmsg { padding:8px 12px; border-radius:8px; font-size:12px }
.cwi-fmsg-ok { background:var(--teal-bg); color:var(--teal); border:1px solid var(--teal) }
.cwi-fmsg-err { background:var(--red-bg); color:var(--red); border:1px solid var(--red) }
.cwi-results-card { margin-bottom:16px; background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
.cwi-res-hdr { background:var(--teal-bg); padding:14px 18px; color:var(--text); font-size:12px; font-weight:600; letter-spacing:.6px; text-transform:uppercase; border-bottom:1px solid var(--border) }
.cwi-tbl-wrap { overflow-x:auto }
.cwi-tbl { width:100%; border-collapse:collapse; font-size:12.5px }
.cwi-tbl th { background:var(--surface2); color:var(--text3); padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; text-align:left; border-bottom:1px solid var(--border2); white-space:nowrap }
.cwi-tbl td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text); text-align:center; }
.cwi-tbl tr:last-child td { border-bottom:none }
.cwi-tbl tbody tr:hover td { background:var(--surface2) }
.cwi-tbl th { text-align:center }
.cwi-tbl tr.cwi-row-first td { background:var(--teal-bg) }
.cwi-link-blue { color:var(--teal); cursor:pointer; text-decoration:none; font-size:12.5px; font-weight:500 }
.cwi-link-red { color:var(--red); cursor:pointer; text-decoration:none; font-size:12.5px; font-weight:500 }
.cwi-link-blue:hover, .cwi-link-red:hover { text-decoration:underline }
.cwi-date-input { padding:6px 10px; border:1px solid var(--border2); border-radius:8px; font-size:12.5px; background:var(--surface); color:var(--text); width:140px;  }
.cwi-date-input:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
.cwi-num-input { padding:6px 10px; border:1px solid var(--border2); border-radius:8px; font-size:12.5px; background:var(--surface); color:var(--text); width:100px; text-align:right; }
.cwi-num-input:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
.cwi-inst-sel { padding:6px 10px; border:1px solid var(--border2); border-radius:8px; font-size:12.5px; background:var(--surface); color:var(--text);  min-width:130px; }
.cwi-inst-sel:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
.cwi-inline-msg { font-size:11px; padding:2px 8px; border-radius:999px; display:inline-block; margin-left:4px }
.cwi-inline-ok { background:var(--teal-bg); color:var(--teal) }
.cwi-inline-err { background:var(--red-bg); color:var(--red) }
.cwi-im-note { padding:30px 18px; color:var(--text3); font-size:13px; background:var(--surface); border:1px solid var(--border2); border-radius:10px; text-align:center }
</style>`;

  const CustomerWiseInterest = {
    _activeTab: 'particular-date',
    _rows: [],
    _installmentMap: {},
    _projectId: null,

    render() {
      const tabs = [
        { key: 'particular-date', label: 'Particular Date Interest' },
        { key: 'interest-master', label: 'Interest Master' },
        { key: 'delete-interest', label: 'Delete Interest' },
        { key: 'manual-interest', label: 'Manual Interest' },
      ];
      const tabHtml = tabs.map(t =>
        `<div class="cwi-tab${this._activeTab === t.key ? ' active' : ''}" onclick="CustomerWiseInterest.switchTab('${t.key}')">${t.label}</div>`
      ).join('');
      return CWI_STYLES + `
<div class="cwi-page">
  <div class="cwi-tabs">${tabHtml}</div>
  <div id="cwi-tab-content"></div>
</div>`;
    },

    init(tab) {
      tab = tab || 'particular-date';
      this._activeTab = tab;
      this._rows = [];
      this._projectId = null;
      const container = document.getElementById('content') || document.body;
      container.innerHTML = this.render();
      this.renderTab();
    },

    switchTab(tab) {
      this._activeTab = tab;
      this._rows = [];
      this._projectId = null;
      document.querySelectorAll('.cwi-tab').forEach(function(el) { el.classList.remove('active'); });
      var tabKeys = ['particular-date', 'interest-master', 'delete-interest', 'manual-interest'];
      var allTabs = document.querySelectorAll('.cwi-tab');
      allTabs.forEach(function(el, i) { if (tabKeys[i] === tab) el.classList.add('active'); });
      this.renderTab();
    },

    renderTab() {
      var content = document.getElementById('cwi-tab-content');
      if (!content) return;
      if (this._activeTab === 'particular-date') {
        content.innerHTML = this.renderFilterCard('particular-date') + '<div id="cwi-results"></div>';
        this.loadProjects('cwi-proj-pd');
      } else if (this._activeTab === 'interest-master') {
        content.innerHTML = '<div class="cwi-im-note">Use <b>Project Wise &rarr; Interest Master</b> to configure per-project interest rates, or <a class="cwi-link-blue" onclick="Router.navigate(\'/interest-master\')">click here</a> to go there now.</div>';
      } else if (this._activeTab === 'delete-interest') {
        content.innerHTML = this.renderFilterCard('delete-interest') + '<div id="cwi-results"></div>';
        this.loadProjects('cwi-proj-di');
      } else if (this._activeTab === 'manual-interest') {
        content.innerHTML = this.renderFilterCard('manual-interest') + '<div id="cwi-results"></div>';
        this.loadProjects('cwi-proj-mi');
      }
    },

    renderFilterCard(tabKey) {
      var sfx = tabKey === 'particular-date' ? 'pd' : tabKey === 'delete-interest' ? 'di' : 'mi';
      var projId   = 'cwi-proj-' + sfx;
      var regId    = 'cwi-reg-' + tabKey;
      var fnId     = 'cwi-fn-' + tabKey;
      var unitId   = 'cwi-unit-' + tabKey;
      var msgId    = 'cwi-fmsg-' + tabKey;
      var fetchId  = 'cwi-fetch-' + tabKey;
      return `
<div class="cwi-filter-card">
  <div class="cwi-filter-body">
    <div class="cwi-filter-row">
      <div class="cwi-fg">
        <span class="cwi-lbl"><span class="cwi-req">*</span>Project:</span>
        <select id="${projId}">
          <option value="">&lt;--Select--&gt;</option>
        </select>
      </div>
      <div class="cwi-fg">
        <span class="cwi-lbl">Registration No.:</span>
        <input type="text" id="${regId}" placeholder="Registration No.">
      </div>
      <div class="cwi-fg">
        <span class="cwi-lbl">First Name:</span>
        <input type="text" id="${fnId}" placeholder="First Name">
      </div>
      <div class="cwi-fg">
        <span class="cwi-lbl">Unit No.:</span>
        <input type="text" id="${unitId}" placeholder="Registration No.">
      </div>
      <div class="cwi-fg" style="justify-content:flex-end">
        <span class="cwi-lbl">&nbsp;</span>
        <button class="cwi-btn-fetch" id="${fetchId}" onclick="CustomerWiseInterest.fetchConsumers('${tabKey}')">FETCH</button>
      </div>
    </div>
    <div id="${msgId}"></div>
  </div>
</div>`;
    },

    async loadProjects(selectId) {
      var token = localStorage.getItem('rof-jwt') || '';
      try {
        var res = await fetch('/api/projects', { headers: { Authorization: 'Bearer ' + token } });
        var data = await res.json();
        var sel = document.getElementById(selectId);
        if (!sel) return;
        var list = data.projects || data.data || data;
        (Array.isArray(list) ? list : []).forEach(function(p) {
          var o = document.createElement('option');
          o.value = p.id;
          o.textContent = p.name;
          sel.appendChild(o);
        });
      } catch (e) { console.error('Failed to load projects', e); }
    },

    getTabIds(tabKey) {
      var sfx = tabKey === 'particular-date' ? 'pd' : tabKey === 'delete-interest' ? 'di' : 'mi';
      return {
        projId:     'cwi-proj-' + sfx,
        regId:      'cwi-reg-' + tabKey,
        fnId:       'cwi-fn-' + tabKey,
        unitId:     'cwi-unit-' + tabKey,
        msgId:      'cwi-fmsg-' + tabKey,
        fetchBtnId: 'cwi-fetch-' + tabKey,
      };
    },

    showFMsg(msgId, text, isErr) {
      var el = document.getElementById(msgId);
      if (!el) return;
      el.innerHTML = '<div class="cwi-fmsg' + (isErr ? ' cwi-fmsg-err' : '') + '">' + text + '</div>';
      setTimeout(function() { el.innerHTML = ''; }, 4000);
    },

    async fetchConsumers(tabKey) {
      var ids = this.getTabIds(tabKey);
      var projEl = document.getElementById(ids.projId);
      var projectId = projEl ? projEl.value : '';
      if (!projectId) { this.showFMsg(ids.msgId, 'Please select a project.', true); return; }
      var regEl   = document.getElementById(ids.regId);
      var fnEl    = document.getElementById(ids.fnId);
      var unitEl  = document.getElementById(ids.unitId);
      var regNo     = regEl   ? (regEl.value   || '').trim() : '';
      var firstName = fnEl    ? (fnEl.value    || '').trim() : '';
      var unitNo    = unitEl  ? (unitEl.value  || '').trim() : '';

      this._projectId = projectId;

      var btn = document.getElementById(ids.fetchBtnId);
      if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }
      var token = localStorage.getItem('rof-jwt') || '';

      try {
        var params = new URLSearchParams({ project_id: projectId });
        if (regNo)     params.set('registration_no', regNo);
        if (firstName) params.set('first_name', firstName);
        if (unitNo)    params.set('unit_address', unitNo);

        var res = await fetch('/api/payments/customer-wise-consumers?' + params.toString(), {
          headers: { Authorization: 'Bearer ' + token },
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Fetch failed');

        this._rows = data.data || [];

        if (tabKey === 'manual-interest' && this._rows.length > 0) {
          await this.loadInstallments(projectId);
        }

        this.renderResults(tabKey);
      } catch (err) {
        this.showFMsg(ids.msgId, 'Error: ' + err.message, true);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'FETCH'; }
      }
    },

    async loadInstallments(projectId) {
      if (this._installmentMap[projectId]) return;
      var token = localStorage.getItem('rof-jwt') || '';
      try {
        var plansRes = await fetch('/api/payments/plan-names/' + projectId, {
          headers: { Authorization: 'Bearer ' + token },
        });
        var plansData = await plansRes.json();
        var planNames = plansData.data || [];
        if (planNames.length === 0) { this._installmentMap[projectId] = []; return; }
        var instRes = await fetch(
          '/api/payments/installment-interest/' + encodeURIComponent(projectId) + '/' + encodeURIComponent(planNames[0]),
          { headers: { Authorization: 'Bearer ' + token } }
        );
        var instData = await instRes.json();
        this._installmentMap[projectId] = instData.data || [];
      } catch (e) { this._installmentMap[projectId] = []; }
    },

    renderResults(tabKey) {
      var resDiv = document.getElementById('cwi-results');
      if (!resDiv) return;
      if (this._rows.length === 0) {
        resDiv.innerHTML = '<div style="padding:30px 18px;color:var(--text3);font-size:13px;text-align:center;">No consumers found for the selected project.</div>';
        return;
      }
      if (tabKey === 'particular-date')  this.renderParticularDate(resDiv);
      else if (tabKey === 'delete-interest')  this.renderDeleteInterest(resDiv);
      else if (tabKey === 'manual-interest')  this.renderManualInterest(resDiv);
    },

    renderParticularDate(container) {
      var rows = '';
      this._rows.forEach(function(r, i) {
        var firstCls = i === 0 ? ' cwi-row-first' : '';
        var existingDate = r.interest_start_date ? r.interest_start_date.toString().split('T')[0] : '';
        rows += '<tr class="' + firstCls + '">' +
          '<td>' + (i + 1) + '</td>' +
          '<td>' + (r.registration_no || '&mdash;') + '</td>' +
          '<td><a href="/api/consumers/' + r.consumer_id + '/applicant-file?token=' + (Auth.getToken()||'') + '" target="_blank" onclick="event.stopPropagation()" style="color:var(--teal);text-decoration:none;font-weight:500;cursor:pointer" title="View Applicant File">' + (r.name || '') + '</a></td>' +
          '<td>' + (r.unit_address || '') + '</td>' +
          '<td>' + (r.payment_plan || 'Payment Plan') + '</td>' +
          '<td><input type="date" class="cwi-date-input" id="cwi-date-' + i + '" value="' + existingDate + '"></td>' +
          '<td><a class="cwi-link-blue" onclick="CustomerWiseInterest.resetInterest(' + i + ')">Reset Interest</a>' +
          ' <span id="cwi-rst-msg-' + i + '" class="cwi-inline-msg"></span></td>' +
          '</tr>';
      });
      container.innerHTML = '<div class="cwi-results-card">' +
        '<div class="cwi-res-hdr">RESET INTEREST</div>' +
        '<div class="cwi-tbl-wrap"><table class="cwi-tbl">' +
        '<thead><tr>' +
        '<th style="width:5%">S.NO.</th>' +
        '<th style="width:13%">REGISTRATION NO.</th>' +
        '<th style="width:20%">NAME</th>' +
        '<th style="width:13%">UNIT ADDRESS</th>' +
        '<th style="width:14%">PAYMENT PLAN</th>' +
        '<th style="width:16%">DATE</th>' +
        '<th style="width:19%">RESET INTEREST</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
        '</table></div></div>';
    },

    renderDeleteInterest(container) {
      var rows = '';
      this._rows.forEach(function(r, i) {
        var firstCls = i === 0 ? ' cwi-row-first' : '';
        var intAmt = parseFloat(r.total_penal_interest_inr || '0').toFixed(2);
        rows += '<tr class="' + firstCls + '" id="cwi-del-row-' + i + '">' +
          '<td>' + (i + 1) + '</td>' +
          '<td>' + (r.registration_no || '&mdash;') + '</td>' +
          '<td><a href="/api/consumers/' + r.consumer_id + '/applicant-file?token=' + (Auth.getToken()||'') + '" target="_blank" onclick="event.stopPropagation()" style="color:var(--teal);text-decoration:none;font-weight:500;cursor:pointer" title="View Applicant File">' + (r.name || '') + '</a></td>' +
          '<td>' + (r.unit_address || '') + '</td>' +
          '<td>' + (r.payment_plan || 'Payment Plan') + '</td>' +
          '<td style="text-align:right">₹' + intAmt + '</td>' +
          '<td><a class="cwi-link-red" onclick="CustomerWiseInterest.deleteInterest(' + i + ')">Delete</a>' +
          ' <span id="cwi-del-msg-' + i + '" class="cwi-inline-msg"></span></td>' +
          '</tr>';
      });
      container.innerHTML = '<div class="cwi-results-card">' +
        '<div class="cwi-res-hdr">DELETE INTEREST</div>' +
        '<div class="cwi-tbl-wrap"><table class="cwi-tbl">' +
        '<thead><tr>' +
        '<th style="width:5%">S.NO.</th>' +
        '<th style="width:13%">REGISTRATION NO.</th>' +
        '<th style="width:20%">NAME</th>' +
        '<th style="width:13%">UNIT ADDRESS</th>' +
        '<th style="width:14%">PAYMENT PLAN</th>' +
        '<th style="width:16%">INTEREST AMOUNT</th>' +
        '<th style="width:19%">DELETE</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
        '</table></div></div>';
    },

    renderManualInterest(container) {
      var installments = this._installmentMap[this._projectId] || [];
      var instOptions = installments.length > 0
        ? installments.map(function(inst) {
            return '<option value="' + inst.installment_index + '">' + inst.installment_name + '</option>';
          }).join('')
        : '<option value="">No installments</option>';

      var rows = '';
      this._rows.forEach(function(r, i) {
        var firstCls = i === 0 ? ' cwi-row-first' : '';
        rows += '<tr class="' + firstCls + '">' +
          '<td>' + (i + 1) + '</td>' +
          '<td>' + (r.registration_no || '&mdash;') + '</td>' +
          '<td><a href="/api/consumers/' + r.consumer_id + '/applicant-file?token=' + (Auth.getToken()||'') + '" target="_blank" onclick="event.stopPropagation()" style="color:var(--teal);text-decoration:none;font-weight:500;cursor:pointer" title="View Applicant File">' + (r.name || '') + '</a></td>' +
          '<td>' + (r.unit_address || '') + '</td>' +
          '<td>' + (r.payment_plan || 'Payment Plan') + '</td>' +
          '<td><select class="cwi-inst-sel" id="cwi-inst-' + i + '">' +
          '<option value="">--Select--</option>' + instOptions + '</select></td>' +
          '<td><input type="number" class="cwi-num-input" id="cwi-amt-' + i + '" min="0" step="1" placeholder="0"></td>' +
          '<td><a class="cwi-link-blue" onclick="CustomerWiseInterest.addManualInterest(' + i + ')">Add</a>' +
          ' <span id="cwi-mi-msg-' + i + '" class="cwi-inline-msg"></span></td>' +
          '</tr>';
      });
      container.innerHTML = '<div class="cwi-results-card">' +
        '<div class="cwi-res-hdr">MANUAL INTEREST</div>' +
        '<div class="cwi-tbl-wrap"><table class="cwi-tbl">' +
        '<thead><tr>' +
        '<th style="width:5%">S.NO.</th>' +
        '<th style="width:12%">REGISTRATION NO.</th>' +
        '<th style="width:17%">NAME</th>' +
        '<th style="width:12%">UNIT ADDRESS</th>' +
        '<th style="width:13%">PAYMENT PLAN</th>' +
        '<th style="width:18%">INSTALLMENT</th>' +
        '<th style="width:11%">AMOUNT</th>' +
        '<th style="width:12%">ADD INTEREST</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
        '</table></div></div>';
    },

    async resetInterest(rowIdx) {
      var row = this._rows[rowIdx];
      if (!row) return;
      var dateEl = document.getElementById('cwi-date-' + rowIdx);
      var dateVal = dateEl ? dateEl.value : '';
      var msgEl = document.getElementById('cwi-rst-msg-' + rowIdx);
      if (!dateVal) {
        if (msgEl) { msgEl.className = 'cwi-inline-msg cwi-inline-err'; msgEl.textContent = 'Select a date'; }
        return;
      }
      var token = localStorage.getItem('rof-jwt') || '';
      try {
        var res = await fetch('/api/payments/consumer-interest-date/' + row.consumer_id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ interest_start_date: dateVal }),
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        this._rows[rowIdx].interest_start_date = dateVal;
        if (msgEl) {
          msgEl.className = 'cwi-inline-msg cwi-inline-ok';
          msgEl.textContent = 'Reset done';
          setTimeout(function() { msgEl.textContent = ''; msgEl.className = 'cwi-inline-msg'; }, 4000);
        }
      } catch (err) {
        if (msgEl) { msgEl.className = 'cwi-inline-msg cwi-inline-err'; msgEl.textContent = err.message; }
      }
    },

    async deleteInterest(rowIdx) {
      var row = this._rows[rowIdx];
      if (!row) return;
      if (!confirm('Delete all interest for ' + row.name + '?')) return;
      var token = localStorage.getItem('rof-jwt') || '';
      var msgEl = document.getElementById('cwi-del-msg-' + rowIdx);
      try {
        var res = await fetch('/api/payments/consumer-interest/' + row.consumer_id, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + token },
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        var rowEl = document.getElementById('cwi-del-row-' + rowIdx);
        if (rowEl) rowEl.remove();
        this._rows[rowIdx] = null;
      } catch (err) {
        if (msgEl) { msgEl.className = 'cwi-inline-msg cwi-inline-err'; msgEl.textContent = err.message; }
      }
    },

    async addManualInterest(rowIdx) {
      var row = this._rows[rowIdx];
      if (!row) return;
      var instEl = document.getElementById('cwi-inst-' + rowIdx);
      var amtEl  = document.getElementById('cwi-amt-' + rowIdx);
      var msgEl  = document.getElementById('cwi-mi-msg-' + rowIdx);
      var installmentIndex = instEl && instEl.value ? parseInt(instEl.value) : null;
      var amountInr = amtEl && amtEl.value ? parseFloat(amtEl.value) : 0;
      if (!amountInr || amountInr <= 0) {
        if (msgEl) { msgEl.className = 'cwi-inline-msg cwi-inline-err'; msgEl.textContent = 'Enter amount'; }
        return;
      }
      var token = localStorage.getItem('rof-jwt') || '';
      try {
        var res = await fetch('/api/payments/manual-interest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({
            consumer_id:       row.consumer_id,
            payment_plan_id:   row.payment_plan_id || null,
            installment_index: installmentIndex,
            amount_inr:        Math.round(amountInr),
          }),
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        if (msgEl) {
          msgEl.className = 'cwi-inline-msg cwi-inline-ok';
          msgEl.textContent = 'Added';
          setTimeout(function() { msgEl.textContent = ''; msgEl.className = 'cwi-inline-msg'; }, 4000);
        }
        if (amtEl) amtEl.value = '';
      } catch (err) {
        if (msgEl) { msgEl.className = 'cwi-inline-msg cwi-inline-err'; msgEl.textContent = err.message; }
      }
    },
  };

  window.CustomerWiseInterest = CustomerWiseInterest;

  Pages.customerWiseInterest = function(params) {
    params = params || {};
    CustomerWiseInterest._installmentMap = {};
    CustomerWiseInterest.init(params.tab || 'particular-date');
  };
}
