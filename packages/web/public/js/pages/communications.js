// ROF CRM — Communications Hub Page (6 channels)

Pages.communications = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <style>
      .com { --bg2:var(--surface2); --text1:var(--text); max-width:1360px; margin-left:auto; margin-right:auto }
      .com .tabs-line { display:flex; gap:8px; flex-wrap:wrap; border-bottom:none; margin-bottom:16px }
      .com .tab-line { padding:7px 16px; font-size:12.5px; border:1px solid var(--border2); border-radius:999px; background:var(--surface); color:var(--text2); cursor:pointer; transition:.15s }
      .com .tab-line:hover { border-color:var(--teal); color:var(--teal) }
      .com .tab-line.active { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600 }
      .com .sp { border-radius:10px; overflow:hidden }
      .com .sp-hdr { padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      .com .sp-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .com .sp-body { padding:18px }
      .com .fg { gap:6px }
      .com .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      .com .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .com .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .com .btn-teal, .com .btn-fetch { background:var(--teal) !important; color:#fff !important; border:none; padding:9px 22px; border-radius:8px; font-size:12.5px; font-weight:600; min-height:38px; cursor:pointer }
      .com .btn-teal:hover, .com .btn-fetch:hover { filter:brightness(.92) }
      .com .btn-teal.btn-sm { min-height:30px; padding:5px 14px; font-size:12px; border-radius:6px }
      .com .btn-ghost { border-radius:8px; min-height:38px; padding:9px 18px; font-size:12.5px }
      .com .btn-ghost.btn-sm { min-height:30px; padding:5px 12px; font-size:12px; border-radius:6px }
      .com .btn-ghost.active { background:var(--teal-bg); color:var(--teal); border-color:var(--teal) }
      .com .tbl-hdr { background:var(--teal-bg); border:1px solid var(--border2); border-radius:10px; padding:12px 18px; flex-wrap:wrap }
      .com .tbl-wrap > .tbl-hdr { border:none; border-bottom:1px solid var(--border); border-radius:0 }
      .com .tbl-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .com .tbl-actions { margin-left:auto; display:flex; gap:8px; flex-wrap:wrap }
      .com .tbl-wrap { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:auto }
      .com table { width:100%; border-collapse:collapse; font-size:12.5px }
      .com table th { background:var(--surface2); color:var(--text3); font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; padding:10px 14px; text-align:left; white-space:nowrap; border-bottom:1px solid var(--border2) }
      .com table td { padding:9px 14px; border-bottom:1px solid var(--border); color:var(--text) }
      .com table tbody tr:hover td { background:var(--surface2) }
      .com .kpi { border:1px solid var(--border2); border-left:3px solid var(--teal); border-radius:10px }
      .com .empty-state { padding:36px 18px; text-align:center; color:var(--text3) }
      .com .empty-state h3 { font-size:14px; font-weight:600; color:var(--text2); margin:0 0 4px }
      .com .btg-item { border-radius:8px }
    </style>
    <style>
      .com .kpi-row { margin-bottom:16px }
      .com #comm-recent, .com [id^="comm-"][id$="-body"] .tbl-wrap { overflow:auto }
    </style>
    <div class="com">
    <div class="page-hdr">
      <h1>Communications</h1>
      <div class="breadcrumb">CRM / <b>Communications Hub</b></div>
    </div>
    <div class="tabs-line">
      <button class="tab-line active" data-group="comm" data-tab="overview" onclick="switchTab('comm','overview');CommPage.loadOverview()">Overview</button>
      <button class="tab-line" data-group="comm" data-tab="whatsapp" onclick="switchTab('comm','whatsapp');CommPage.loadChannel('whatsapp')">WhatsApp</button>
      <button class="tab-line" data-group="comm" data-tab="email" onclick="switchTab('comm','email');CommPage.loadChannel('email')">Email</button>
      <button class="tab-line" data-group="comm" data-tab="sms" onclick="switchTab('comm','sms');CommPage.loadChannel('sms')">SMS</button>
      <button class="tab-line" data-group="comm" data-tab="instagram" onclick="switchTab('comm','instagram');CommPage.loadChannel('instagram')">Instagram</button>
      <button class="tab-line" data-group="comm" data-tab="facebook" onclick="switchTab('comm','facebook');CommPage.loadChannel('facebook')">Facebook</button>
    </div>

    <!-- Overview Tab -->
    <div data-panel-group="comm" data-panel="overview">
      <div class="kpi-row" id="comm-kpis">
        ${[...Array(4)].map(() => `<div class="kpi"><div class="page-loading"><div class="spinner"></div></div></div>`).join('')}
      </div>
      <!-- Compose -->
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Send Message</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">Consumer</label>
              <select class="fc" id="comm-consumer">
                <option value="">— Select Consumer —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Channel</label>
              <select class="fc" id="comm-channel">
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            <div class="fg" style="grid-column:span 2"><label class="fl">Message</label>
              <textarea class="fc" id="comm-message" rows="3" placeholder="Type your message…"></textarea>
            </div>
            <div class="fg"><label class="fl">Subject (Email only)</label>
              <input class="fc" id="comm-subject" placeholder="Email subject">
            </div>
          </div>
          <div style="margin-top:10px;display:flex;gap:8px">
            <button class="btn btn-teal btn-lg" onclick="CommPage.send()">Send Message</button>
            <button class="btn btn-ghost" onclick="CommPage.aiDraft()">AI Draft</button>
          </div>
        </div>
      </div>
      <!-- Recent activity -->
      <div class="tbl-wrap">
        <div class="tbl-hdr">
          <div class="tbl-title">Recent Communications</div>
          <div class="tbl-actions">
            <button class="btn btn-ghost btn-sm" onclick="CommPage.loadOverview()">Refresh</button>
          </div>
        </div>
        <div id="comm-recent"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- WhatsApp Tab -->
    <div data-panel-group="comm" data-panel="whatsapp" style="display:none">
      <div id="comm-whatsapp-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- Email Tab -->
    <div data-panel-group="comm" data-panel="email" style="display:none">
      <div id="comm-email-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- SMS Tab -->
    <div data-panel-group="comm" data-panel="sms" style="display:none">
      <div id="comm-sms-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- Instagram Tab -->
    <div data-panel-group="comm" data-panel="instagram" style="display:none">
      <div id="comm-instagram-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- Facebook Tab -->
    <div data-panel-group="comm" data-panel="facebook" style="display:none">
      <div id="comm-facebook-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
    </div>
  `;

  await CommPage.init();
};

const CommPage = {
  async init() {
    await Promise.allSettled([
      this.loadConsumers(),
      this.loadOverview(),
    ]);
  },

  async loadConsumers() {
    try {
      const res = await Api.get('/consumers', { params: { pageSize: 300 } });
      const list = res.data || res || [];
      const sel = document.getElementById('comm-consumer');
      if (sel) sel.innerHTML = '<option value="">— Select Consumer —</option>' +
        list.map(c => `<option value="${c.id}">${c.first_name||''} ${c.last_name||''} ${(!c.first_name&&c.name)?c.name:''} · ${c.mobile||''}</option>`).join('');
    } catch {}
  },

  async loadOverview() {
    try {
      const res = await Api.get('/communications/tickets', { params: { pageSize: 200 } });
      const msgs = res.data || res || [];

      const total = msgs.length;
      const byChannel = { whatsapp: 0, email: 0, sms: 0, other: 0 };
      for (const m of msgs) {
        const ch = m.channel || 'other';
        byChannel[ch] = (byChannel[ch] || 0) + 1;
      }
      const pending = msgs.filter(m => (m.status||'') === 'pending' || (m.delivery_status||'') === 'pending').length;

      const kpis = document.getElementById('comm-kpis');
      if (kpis) kpis.innerHTML = `
        <div class="kpi c-accent"><div class="kpi-lbl">Total Messages</div><div class="kpi-val">${total}</div><div class="kpi-sub">All channels</div></div>
        <div class="kpi c-green"><div class="kpi-lbl">WhatsApp</div><div class="kpi-val">${byChannel.whatsapp}</div><div class="kpi-sub">Messages sent</div></div>
        <div class="kpi c-blue"><div class="kpi-lbl">Email</div><div class="kpi-val">${byChannel.email}</div><div class="kpi-sub">Messages sent</div></div>
        <div class="kpi c-warn"><div class="kpi-lbl">Pending</div><div class="kpi-val">${pending}</div><div class="kpi-sub">Not delivered</div></div>
      `;

      const el = document.getElementById('comm-recent');
      if (!el) return;
      el.innerHTML = msgs.length === 0
        ? '<div class="empty-state"><h3>No communications yet</h3></div>'
        : `<table>
            <thead><tr><th>Consumer</th><th>Channel</th><th>Subject / Message</th><th>Status</th><th>Time</th></tr></thead>
            <tbody>
              ${msgs.slice(0,50).map(m => `<tr>
                <td class="td-bold">${m.consumer_name||m.consumerName||'—'}</td>
                <td><span class="chip ch-blue">${(m.channel||'—').toUpperCase()}</span></td>
                <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px">${m.subject||m.message||'—'}</td>
                <td>${Utils.chip(m.status||m.delivery_status||'sent')}</td>
                <td style="font-size:10.5px">${Utils.date(m.created_at||m.createdAt)}</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) {
      const el = document.getElementById('comm-recent');
      if (el) el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  async loadChannel(channel) {
    const elId = `comm-${channel}-body`;
    const el = document.getElementById(elId);
    if (!el) return;

    try {
      const res = await Api.get('/communications/tickets', { params: { channel, pageSize: 100 } });
      const msgs = res.data || res || [];

      el.innerHTML = msgs.length === 0
        ? `<div class="empty-state"><h3>No ${channel} messages yet</h3><p>Messages sent via ${channel} will appear here.</p></div>`
        : `<div class="tbl-wrap"><table>
            <thead><tr><th>Consumer</th><th>Direction</th><th>Subject / Message</th><th>Delivery</th><th>Time</th><th>Action</th></tr></thead>
            <tbody>
              ${msgs.map(m => `<tr>
                <td class="td-bold">${m.consumer_name||m.consumerName||'—'}</td>
                <td><span class="chip ${m.direction==='inbound'?'ch-warn':'ch-blue'}">${m.direction||'outbound'}</span></td>
                <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px">${m.subject||m.message||'—'}</td>
                <td>${Utils.chip(m.delivery_status||m.status||'sent')}</td>
                <td style="font-size:10.5px">${Utils.date(m.created_at||m.createdAt)}</td>
                <td><button class="btn btn-ghost btn-sm" onclick="CommPage.reply('${m.consumer_id||m.consumerId}','${channel}')">Reply</button></td>
              </tr>`).join('')}
            </tbody>
          </table></div>`;
    } catch (err) {
      el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  async send() {
    const consumerId = document.getElementById('comm-consumer')?.value;
    const channel = document.getElementById('comm-channel')?.value;
    const message = document.getElementById('comm-message')?.value?.trim();
    const subject = document.getElementById('comm-subject')?.value?.trim();

    if (!consumerId) { Utils.warn('Please select a consumer'); return; }
    if (!message) { Utils.warn('Please enter a message'); return; }

    try {
      await Api.post(`/communications/${consumerId}/send`, { channel, message, subject });
      Utils.success(`Message sent via ${channel}`);
      document.getElementById('comm-message').value = '';
      document.getElementById('comm-subject').value = '';
      await this.loadOverview();
    } catch (err) { Utils.error(err.message); }
  },

  async aiDraft() {
    const consumerId = document.getElementById('comm-consumer')?.value;
    if (!consumerId) { Utils.warn('Please select a consumer first'); return; }
    try {
      const res = await Api.post(`/communications/${consumerId}/ai-draft`, {});
      const draft = res.data?.draft || res.draft || '';
      const msgEl = document.getElementById('comm-message');
      if (msgEl && draft) { msgEl.value = draft; Utils.success('AI draft generated'); }
    } catch { Utils.info('AI drafting not available — please type your message manually'); }
  },

  reply(consumerId, channel) {
    Router.navigate('/consumer', { id: consumerId, tab: 'communications' });
  },
};
