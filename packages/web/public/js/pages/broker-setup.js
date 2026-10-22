// ROF CRM — Broker Setup (Tax Masters) Page

Pages.brokerSetup = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Broker Setup</h1>
      <div class="breadcrumb">Compliance / <b>Broker Setup</b></div>
    </div>

    <style>
      .bsn { max-width:1100px; margin-left:auto; margin-right:auto }
      .bsn-intro { display:flex; align-items:center; gap:12px; padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      .bsn-intro-ico { width:36px; height:36px; border-radius:10px; background:var(--teal); color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0 }
      .bsn-intro-t { font-size:14px; font-weight:600; color:var(--text) }
      .bsn-intro-s { font-size:12px; color:var(--text2); margin-top:2px }
      .bsn-body { overflow-x:auto }
      .bsn-tbl { width:100%; border-collapse:collapse; font-size:12.5px }
      .bsn-tbl th { text-align:left; padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; color:var(--text3); background:var(--surface2); border-bottom:1px solid var(--border2); white-space:nowrap }
      .bsn-tbl td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text); vertical-align:middle }
      .bsn-tbl tbody tr:hover td { background:var(--surface2) }
      .bsn-tbl tbody tr:last-child td { border-bottom:none }
      .bsn-tbl .td-bold { font-weight:600 }
      .bsn-tbl .btn { padding:4px 11px; border-radius:6px }
      .bsn-msg { padding:40px 18px; text-align:center; color:var(--text3); font-size:13px }
    </style>

    <div class="sp bsn">
      <div class="bsn-intro">
        <div class="bsn-intro-ico">%</div>
        <div>
          <div class="bsn-intro-t">Broker Tax Configuration (TDS &amp; GST)</div>
          <div class="bsn-intro-s">TDS is cut from the commission and GST is added to it when a commission is paid. There are no default rates: a broker needs its own setup before a commission can be paid to it (a broker without a PAN is cut at least 20%).</div>
        </div>
      </div>
      <div class="bsn-body">
        <table class="bsn-tbl" id="broker-tax-table">
          <thead>
            <tr>
              <th>Broker Firm</th>
              <th>Broker Name</th>
              <th>TDS Rate (%)</th>
              <th>GST Rate (%)</th>
              <th>GST Exempt?</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="broker-tax-body">
            <tr><td colspan="6" style="text-align:center"><div class="spinner"></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  BrokerSetupPage.loadConfigs();
};

const BrokerSetupPage = {
  _rows: [],

  async loadConfigs() {
    const tbody = document.getElementById('broker-tax-body');
    if (!tbody) return;
    try {
      const res = await Api.get('/broker-setup');
      this._rows = res.data || [];
      this.render();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="bsn-msg" style="color:var(--red)">${Utils.esc(err.message)}</td></tr>`;
    }
  },

  render(editId) {
    const tbody = document.getElementById('broker-tax-body');
    if (!tbody) return;
    if (this._rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="bsn-msg">No brokers yet. Register a broker first.</td></tr>';
      return;
    }
    const e = Utils.esc;
    tbody.innerHTML = this._rows.map(c => c.broker_id === editId ? `
        <tr data-broker="${c.broker_id}">
          <td class="td-bold">${e(c.firm_name || '—')}</td>
          <td>${e(c.broker_name || '—')}</td>
          <td><input class="fc" id="bs-tds" type="number" min="0" max="100" step="0.01" value="${c.tds_rate_pct == null ? '' : Number(c.tds_rate_pct)}" placeholder="rate %" style="width:90px"></td>
          <td><input class="fc" id="bs-gst" type="number" min="0" max="100" step="0.01" value="${c.gst_rate_pct == null ? '' : Number(c.gst_rate_pct)}" placeholder="rate %" style="width:90px"></td>
          <td><select class="fc" id="bs-exempt"><option value="no" ${c.is_gst_exempt ? '' : 'selected'}>No</option><option value="yes" ${c.is_gst_exempt ? 'selected' : ''}>Yes</option></select></td>
          <td><button class="btn btn-sm btn-teal" onclick="BrokerSetupPage.save('${c.broker_id}')">Save</button>
              <button class="btn btn-sm btn-ghost" onclick="BrokerSetupPage.render()">Cancel</button></td>
        </tr>` : `
        <tr data-broker="${c.broker_id}">
          <td class="td-bold">${e(c.firm_name || '—')}</td>
          <td>${e(c.broker_name || '—')}</td>
          <td>${c.tds_rate_pct == null ? '<span class="chip ch-red">Not set</span>' : Number(c.tds_rate_pct) + '%'}</td>
          <td>${c.gst_rate_pct == null ? '<span class="chip ch-red">Not set</span>' : Number(c.gst_rate_pct) + '%'}</td>
          <td>${c.is_gst_exempt ? '<span class="chip ch-green">Yes</span>' : '<span class="chip ch-gray">No</span>'}${c.configured ? '' : ' <small style="color:var(--text3)">commission cannot be paid until set</small>'}</td>
          <td><button class="btn btn-sm btn-ghost" onclick="BrokerSetupPage.editConfig('${c.broker_id}')">Edit</button></td>
        </tr>`).join('');
  },

  editConfig(brokerId) { this.render(brokerId); },

  async save(brokerId) {
    const tds = document.getElementById('bs-tds').value, gst = document.getElementById('bs-gst').value;
    if (tds === '' || gst === '') { Utils.warn('Enter both rates'); return; }
    try {
      await Api.post(`/broker-setup/${brokerId}`, { tdsRatePct: tds, gstRatePct: gst, isGstExempt: document.getElementById('bs-exempt').value === 'yes' });
      Utils.success('Tax setup saved');
      await this.loadConfigs();
    } catch (err) { Utils.error(err.message); }
  }
};
