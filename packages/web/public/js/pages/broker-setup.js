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
        <div class="bsn-intro-ico">🧾</div>
        <div>
          <div class="bsn-intro-t">Broker Tax Configuration (TDS &amp; GST)</div>
          <div class="bsn-intro-s">Configure default tax levels. Brokers without a specific configuration use the defaults.</div>
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
  async loadConfigs() {
    const tbody = document.getElementById('broker-tax-body');
    if (!tbody) return;
    try {
      const res = await Api.get('/broker-setup');
      const configs = res.data || [];
      if (configs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="bsn-msg">No configurations found. Configure from Broker Management.</td></tr>';
        return;
      }

      tbody.innerHTML = configs.map(c => `
        <tr>
          <td class="td-bold">${c.firm_name || '—'}</td>
          <td>${c.broker_name || '—'}</td>
          <td>${c.tds_rate_pct}%</td>
          <td>${c.gst_rate_pct}%</td>
          <td>${c.is_gst_exempt ? '<span class="chip ch-green">Yes</span>' : '<span class="chip ch-gray">No</span>'}</td>
          <td><button class="btn btn-sm btn-ghost" onclick="BrokerSetupPage.editConfig('${c.broker_id}')">Edit</button></td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="bsn-msg" style="color:var(--red)">${err.message}</td></tr>`;
    }
  },

  editConfig(brokerId) {
    Utils.info('Edit Tax Config logic coming soon');
  }
};
