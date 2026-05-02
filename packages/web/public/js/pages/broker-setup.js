// ROF CRM — Broker Setup (Tax Masters) Page

Pages.brokerSetup = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Broker Setup</h1>
      <div class="breadcrumb">Compliance / <b>Broker Setup</b></div>
    </div>

    <div class="sp">
      <div class="sp-hdr">
        <div class="sp-title">Broker Tax Configuration (TDS & GST)</div>
      </div>
      <div class="sp-body">
        <div class="alert alert-info">Configure default Tax levels. Brokers without specific config will use defaults.</div>
        
        <div class="tbl-wrap" style="margin-top:16px;">
          <table id="broker-tax-table">
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3)">No configurations found. Configure from Broker Management.</td></tr>';
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
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--red);text-align:center">${err.message}</td></tr>`;
    }
  },

  editConfig(brokerId) {
    Utils.info('Edit Tax Config logic coming soon');
  }
};
