// ROF CRM — Facebook Inbox Page

Pages.facebookInbox = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <style>
      .fbi { --bg2:var(--surface2); --text1:var(--text); max-width:1360px; margin-left:auto; margin-right:auto }
      .fbi .tabs-line { display:flex; gap:8px; flex-wrap:wrap; border-bottom:none; margin-bottom:16px }
      .fbi .tab-line { padding:7px 16px; font-size:12.5px; border:1px solid var(--border2); border-radius:999px; background:var(--surface); color:var(--text2); cursor:pointer; transition:.15s }
      .fbi .tab-line:hover { border-color:var(--teal); color:var(--teal) }
      .fbi .tab-line.active { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600 }
      .fbi .sp { border-radius:10px; overflow:hidden }
      .fbi .sp-hdr { padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      .fbi .sp-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .fbi .sp-body { padding:18px }
      .fbi .fg { gap:6px }
      .fbi .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      .fbi .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .fbi .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .fbi .btn-teal, .fbi .btn-fetch { background:var(--teal) !important; color:#fff !important; border:none; padding:9px 22px; border-radius:8px; font-size:12.5px; font-weight:600; min-height:38px; cursor:pointer }
      .fbi .btn-teal:hover, .fbi .btn-fetch:hover { filter:brightness(.92) }
      .fbi .btn-teal.btn-sm { min-height:30px; padding:5px 14px; font-size:12px; border-radius:6px }
      .fbi .btn-ghost { border-radius:8px; min-height:38px; padding:9px 18px; font-size:12.5px }
      .fbi .btn-ghost.btn-sm { min-height:30px; padding:5px 12px; font-size:12px; border-radius:6px }
      .fbi .btn-ghost.active { background:var(--teal-bg); color:var(--teal); border-color:var(--teal) }
      .fbi .tbl-hdr { background:var(--teal-bg); border:1px solid var(--border2); border-radius:10px; padding:12px 18px; flex-wrap:wrap }
      .fbi .tbl-wrap > .tbl-hdr { border:none; border-bottom:1px solid var(--border); border-radius:0 }
      .fbi .tbl-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .fbi .tbl-actions { margin-left:auto; display:flex; gap:8px; flex-wrap:wrap }
      .fbi .tbl-wrap { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:auto }
      .fbi table { width:100%; border-collapse:collapse; font-size:12.5px }
      .fbi table th { background:var(--surface2); color:var(--text3); font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; padding:10px 14px; text-align:left; white-space:nowrap; border-bottom:1px solid var(--border2) }
      .fbi table td { padding:9px 14px; border-bottom:1px solid var(--border); color:var(--text) }
      .fbi table tbody tr:hover td { background:var(--surface2) }
      .fbi .kpi { border:1px solid var(--border2); border-left:3px solid var(--teal); border-radius:10px }
      .fbi .empty-state { padding:36px 18px; text-align:center; color:var(--text3) }
      .fbi .empty-state h3 { font-size:14px; font-weight:600; color:var(--text2); margin:0 0 4px }
      .fbi .btg-item { border-radius:8px }
    </style>
    <style>
      .fbi .inb { display:grid; grid-template-columns:300px 1fr; gap:0; height:calc(100vh - 200px); min-height:420px; border:1px solid var(--border2); border-radius:10px; overflow:hidden; background:var(--surface) }
      @media (max-width:800px) { .fbi .inb { grid-template-columns:minmax(0,1fr); height:auto } }
    </style>
    <div class="fbi">
    <div class="page-hdr">
      <h1>Facebook Inbox</h1>
      <div class="breadcrumb">CRM / <b>Facebook</b></div>
    </div>
    <div class="inb">
      <div style="border-right:1px solid var(--border);overflow-y:auto;background:var(--bg)">
        <div style="padding:10px;border-bottom:1px solid var(--border);background:var(--bg2)">
          <input class="fc" id="fb-search" placeholder="Search messages…" style="font-size:12px">
        </div>
        <div id="fb-threads"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
      <div style="display:flex;flex-direction:column">
        <div id="fb-chat-header" style="padding:12px 16px;border-bottom:1px solid var(--border);background:var(--bg2);font-weight:600;font-size:13px">Facebook Messages</div>
        <div id="fb-messages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px">
          <div style="text-align:center;color:var(--text3);font-size:12px;margin-top:40px">Select a conversation</div>
        </div>
        <div id="fb-reply-area" style="padding:10px;border-top:1px solid var(--border);display:none">
          <div style="display:flex;gap:8px">
            <textarea class="fc" id="fb-reply-input" rows="2" placeholder="Reply…" style="resize:none;flex:1;font-size:12px"></textarea>
            <button class="btn btn-teal btn-sm" onclick="FBPage.sendReply()">Send</button>
          </div>
        </div>
      </div>
    </div>
    </div>
  `;
  await FBPage.init();
};

const FBPage = {
  _threads: [], _activeConsumerId: null,

  async init() {
    try {
      const res = await Api.get('/communications/tickets', { params: { channel: 'facebook', pageSize: 100 } });
      const msgs = res.data || res || [];
      const threadMap = new Map();
      for (const m of msgs) {
        const cid = m.consumer_id || m.consumerId || m.id;
        if (!threadMap.has(cid)) threadMap.set(cid, { consumerId: cid, name: m.consumer_name || m.consumerName || 'Facebook User', messages: [] });
        threadMap.get(cid).messages.push(m);
      }
      this._threads = [...threadMap.values()];
      const el = document.getElementById('fb-threads');
      if (!el) return;
      if (this._threads.length === 0) {
        el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);font-size:12px">No Facebook messages yet<br><span style="font-size:10px">Connect your Facebook Page in Settings</span></div>';
      } else {
        el.innerHTML = this._threads.map(t => `
          <div style="padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer" onclick="FBPage.open('${t.consumerId}')">
            <div style="font-weight:600;font-size:12px">${t.name}</div>
            <div style="font-size:10.5px;color:var(--text3);margin-top:2px">${t.messages.length} message${t.messages.length!==1?'s':''}</div>
          </div>`).join('');
      }
    } catch (err) {
      document.getElementById('fb-threads').innerHTML = `<div style="padding:16px;color:var(--red);font-size:11px">${err.message}</div>`;
    }
  },

  open(consumerId) {
    this._activeConsumerId = consumerId;
    const thread = this._threads.find(t => t.consumerId === consumerId);
    if (!thread) return;
    document.getElementById('fb-chat-header').textContent = thread.name;
    const msgEl = document.getElementById('fb-messages');
    msgEl.innerHTML = thread.messages.map(m => {
      const isOut = m.direction !== 'inbound';
      return `<div style="display:flex;justify-content:${isOut?'flex-end':'flex-start'}">
        <div style="max-width:70%;padding:8px 12px;border-radius:${isOut?'12px 12px 2px 12px':'12px 12px 12px 2px'};background:${isOut?'#1877f2':'var(--bg2)'};color:${isOut?'#fff':'var(--text)'};font-size:12px">
          ${m.message||m.subject||'—'}
        </div>
      </div>`;
    }).join('');
    msgEl.scrollTop = msgEl.scrollHeight;
    document.getElementById('fb-reply-area').style.display = 'block';
  },

  async sendReply() {
    if (!this._activeConsumerId) return;
    const msg = document.getElementById('fb-reply-input')?.value?.trim();
    if (!msg) return;
    try {
      await Api.post(`/communications/${this._activeConsumerId}/send`, { channel: 'facebook', message: msg });
      Utils.success('Message sent');
      document.getElementById('fb-reply-input').value = '';
      await this.init();
    } catch (err) { Utils.error(err.message); }
  },
};
