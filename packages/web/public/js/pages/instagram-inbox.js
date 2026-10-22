// ROF CRM — Instagram Inbox Page

Pages.instagramInbox = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <style>
      .igi { --bg2:var(--surface2); --text1:var(--text); max-width:1360px; margin-left:auto; margin-right:auto }
      .igi .tabs-line { display:flex; gap:8px; flex-wrap:wrap; border-bottom:none; margin-bottom:16px }
      .igi .tab-line { padding:7px 16px; font-size:12.5px; border:1px solid var(--border2); border-radius:999px; background:var(--surface); color:var(--text2); cursor:pointer; transition:.15s }
      .igi .tab-line:hover { border-color:var(--teal); color:var(--teal) }
      .igi .tab-line.active { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600 }
      .igi .sp { border-radius:10px; overflow:hidden }
      .igi .sp-hdr { padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      .igi .sp-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .igi .sp-body { padding:18px }
      .igi .fg { gap:6px }
      .igi .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      .igi .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .igi .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .igi .btn-teal, .igi .btn-fetch { background:var(--teal) !important; color:#fff !important; border:none; padding:9px 22px; border-radius:8px; font-size:12.5px; font-weight:600; min-height:38px; cursor:pointer }
      .igi .btn-teal:hover, .igi .btn-fetch:hover { filter:brightness(.92) }
      .igi .btn-teal.btn-sm { min-height:30px; padding:5px 14px; font-size:12px; border-radius:6px }
      .igi .btn-ghost { border-radius:8px; min-height:38px; padding:9px 18px; font-size:12.5px }
      .igi .btn-ghost.btn-sm { min-height:30px; padding:5px 12px; font-size:12px; border-radius:6px }
      .igi .btn-ghost.active { background:var(--teal-bg); color:var(--teal); border-color:var(--teal) }
      .igi .tbl-hdr { background:var(--teal-bg); border:1px solid var(--border2); border-radius:10px; padding:12px 18px; flex-wrap:wrap }
      .igi .tbl-wrap > .tbl-hdr { border:none; border-bottom:1px solid var(--border); border-radius:0 }
      .igi .tbl-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .igi .tbl-actions { margin-left:auto; display:flex; gap:8px; flex-wrap:wrap }
      .igi .tbl-wrap { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:auto }
      .igi table { width:100%; border-collapse:collapse; font-size:12.5px }
      .igi table th { background:var(--surface2); color:var(--text3); font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; padding:10px 14px; text-align:left; white-space:nowrap; border-bottom:1px solid var(--border2) }
      .igi table td { padding:9px 14px; border-bottom:1px solid var(--border); color:var(--text) }
      .igi table tbody tr:hover td { background:var(--surface2) }
      .igi .kpi { border:1px solid var(--border2); border-left:3px solid var(--teal); border-radius:10px }
      .igi .empty-state { padding:36px 18px; text-align:center; color:var(--text3) }
      .igi .empty-state h3 { font-size:14px; font-weight:600; color:var(--text2); margin:0 0 4px }
      .igi .btg-item { border-radius:8px }
    </style>
    <style>
      .igi .inb { display:grid; grid-template-columns:300px 1fr; gap:0; height:calc(100vh - 200px); min-height:420px; border:1px solid var(--border2); border-radius:10px; overflow:hidden; background:var(--surface) }
      @media (max-width:800px) { .igi .inb { grid-template-columns:minmax(0,1fr); height:auto } }
    </style>
    <div class="igi">
    <div class="page-hdr">
      <h1>Instagram Inbox</h1>
      <div class="breadcrumb">CRM / <b>Instagram</b></div>
    </div>
    <div class="inb">
      <div style="border-right:1px solid var(--border);overflow-y:auto;background:var(--bg)">
        <div style="padding:10px;border-bottom:1px solid var(--border);background:var(--bg2)">
          <input class="fc" placeholder="Search messages…" style="font-size:12px;width:100%">
        </div>
        <div id="ig-threads"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
      <div style="display:flex;flex-direction:column">
        <div id="ig-chat-header" style="padding:12px 16px;border-bottom:1px solid var(--border);background:var(--bg2);font-weight:600;font-size:13px">Instagram DMs</div>
        <div id="ig-messages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px">
          <div style="text-align:center;color:var(--text3);font-size:12px;margin-top:40px">Select a conversation</div>
        </div>
        <div id="ig-reply-area" style="padding:10px;border-top:1px solid var(--border);display:none">
          <div style="display:flex;gap:8px">
            <textarea class="fc" id="ig-reply-input" rows="2" placeholder="Reply via Instagram DM…" style="resize:none;flex:1;font-size:12px"></textarea>
            <button class="btn btn-teal btn-sm" onclick="IGPage.sendReply()">Send</button>
          </div>
        </div>
      </div>
    </div>
    </div>
  `;
  await IGPage.init();
};

const IGPage = {
  _threads: [], _activeConsumerId: null,

  async init() {
    try {
      const res = await Api.get('/communications/messages', { params: { channel: 'instagram', pageSize: 100 } });
      const msgs = res.data || res || [];
      const threadMap = new Map();
      for (const m of msgs) {
        const cid = m.consumer_id || m.consumerId || m.id;
        if (!threadMap.has(cid)) threadMap.set(cid, { consumerId: cid, name: m.consumer_name || m.consumerName || 'Instagram User', messages: [] });
        threadMap.get(cid).messages.push(m);
      }
      this._threads = [...threadMap.values()];
      const el = document.getElementById('ig-threads');
      if (!el) return;
      if (this._threads.length === 0) {
        el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);font-size:12px">No Instagram DMs yet<br><span style="font-size:10px">Connect Instagram Business in Settings</span></div>';
      } else {
        el.innerHTML = this._threads.map(t => `
          <div style="padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer" onclick="IGPage.open('${t.consumerId}')">
            <div style="font-weight:600;font-size:12px">${Utils.esc(t.name)}</div>
            <div style="font-size:10.5px;color:var(--text3);margin-top:2px">${t.messages.length} DM${t.messages.length!==1?'s':''}</div>
          </div>`).join('');
      }
    } catch (err) {
      document.getElementById('ig-threads').innerHTML = `<div style="padding:16px;color:var(--red);font-size:11px">${err.message}</div>`;
    }
  },

  open(consumerId) {
    this._activeConsumerId = consumerId;
    const thread = this._threads.find(t => t.consumerId === consumerId);
    if (!thread) return;
    document.getElementById('ig-chat-header').textContent = `@${thread.name}`;
    const msgEl = document.getElementById('ig-messages');
    const gradient = 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)';
    msgEl.innerHTML = thread.messages.map(m => {
      const isOut = m.direction !== 'inbound';
      return `<div style="display:flex;justify-content:${isOut?'flex-end':'flex-start'}">
        <div style="max-width:70%;padding:8px 12px;border-radius:${isOut?'12px 12px 2px 12px':'12px 12px 12px 2px'};background:${isOut?gradient:'var(--bg2)'};color:${isOut?'#fff':'var(--text)'};font-size:12px">
          ${Utils.esc(m.message||m.subject||'—')}
        </div>
      </div>`;
    }).join('');
    msgEl.scrollTop = msgEl.scrollHeight;
    document.getElementById('ig-reply-area').style.display = 'block';
  },

  async sendReply() {
    if (!this._activeConsumerId) return;
    const msg = document.getElementById('ig-reply-input')?.value?.trim();
    if (!msg) return;
    try {
      await Api.post(`/communications/${this._activeConsumerId}/send`, { channel: 'instagram', message: msg });
      Utils.success('DM sent');
      document.getElementById('ig-reply-input').value = '';
      await this.init();
    } catch (err) { Utils.error(err.message); }
  },
};
