// ROF CRM — WhatsApp Inbox Page

Pages.whatsappInbox = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <style>
      .wai { --bg2:var(--surface2); --text1:var(--text); max-width:1360px; margin-left:auto; margin-right:auto }
      .wai .tabs-line { display:flex; gap:8px; flex-wrap:wrap; border-bottom:none; margin-bottom:16px }
      .wai .tab-line { padding:7px 16px; font-size:12.5px; border:1px solid var(--border2); border-radius:999px; background:var(--surface); color:var(--text2); cursor:pointer; transition:.15s }
      .wai .tab-line:hover { border-color:var(--teal); color:var(--teal) }
      .wai .tab-line.active { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600 }
      .wai .sp { border-radius:10px; overflow:hidden }
      .wai .sp-hdr { padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      .wai .sp-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .wai .sp-body { padding:18px }
      .wai .fg { gap:6px }
      .wai .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      .wai .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .wai .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .wai .btn-teal, .wai .btn-fetch { background:var(--teal) !important; color:#fff !important; border:none; padding:9px 22px; border-radius:8px; font-size:12.5px; font-weight:600; min-height:38px; cursor:pointer }
      .wai .btn-teal:hover, .wai .btn-fetch:hover { filter:brightness(.92) }
      .wai .btn-teal.btn-sm { min-height:30px; padding:5px 14px; font-size:12px; border-radius:6px }
      .wai .btn-ghost { border-radius:8px; min-height:38px; padding:9px 18px; font-size:12.5px }
      .wai .btn-ghost.btn-sm { min-height:30px; padding:5px 12px; font-size:12px; border-radius:6px }
      .wai .btn-ghost.active { background:var(--teal-bg); color:var(--teal); border-color:var(--teal) }
      .wai .tbl-hdr { background:var(--teal-bg); border:1px solid var(--border2); border-radius:10px; padding:12px 18px; flex-wrap:wrap }
      .wai .tbl-wrap > .tbl-hdr { border:none; border-bottom:1px solid var(--border); border-radius:0 }
      .wai .tbl-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .wai .tbl-actions { margin-left:auto; display:flex; gap:8px; flex-wrap:wrap }
      .wai .tbl-wrap { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:auto }
      .wai table { width:100%; border-collapse:collapse; font-size:12.5px }
      .wai table th { background:var(--surface2); color:var(--text3); font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; padding:10px 14px; text-align:left; white-space:nowrap; border-bottom:1px solid var(--border2) }
      .wai table td { padding:9px 14px; border-bottom:1px solid var(--border); color:var(--text) }
      .wai table tbody tr:hover td { background:var(--surface2) }
      .wai .kpi { border:1px solid var(--border2); border-left:3px solid var(--teal); border-radius:10px }
      .wai .empty-state { padding:36px 18px; text-align:center; color:var(--text3) }
      .wai .empty-state h3 { font-size:14px; font-weight:600; color:var(--text2); margin:0 0 4px }
      .wai .btg-item { border-radius:8px }
    </style>
    <style>
      .wai .inb { display:grid; grid-template-columns:300px 1fr; gap:0; height:calc(100vh - 200px); min-height:420px; border:1px solid var(--border2); border-radius:10px; overflow:hidden; background:var(--surface) }
      @media (max-width:800px) { .wai .inb { grid-template-columns:minmax(0,1fr); height:auto } }
    </style>
    <div class="wai">
    <div class="page-hdr">
      <h1>WhatsApp Inbox</h1>
      <div class="breadcrumb">CRM / <b>WhatsApp</b></div>
    </div>

    <div class="inb">
      <!-- Thread list -->
      <div style="border-right:1px solid var(--border);overflow-y:auto;background:var(--bg)">
        <div style="padding:10px;border-bottom:1px solid var(--border);background:var(--bg2)">
          <input class="fc" id="wa-search" placeholder="Search conversations…" oninput="WAPage.filterThreads()" style="font-size:12px">
        </div>
        <div id="wa-threads"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>

      <!-- Chat view -->
      <div style="display:flex;flex-direction:column;background:var(--bg)">
        <div id="wa-chat-header" style="padding:12px 16px;border-bottom:1px solid var(--border);background:var(--bg2);font-weight:600;font-size:13px">
          Select a conversation
        </div>
        <div id="wa-messages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px">
          <div style="text-align:center;color:var(--text3);font-size:12px;margin-top:40px">Select a conversation to start messaging</div>
        </div>
        <div id="wa-reply-area" style="padding:10px;border-top:1px solid var(--border);display:none">
          <div style="display:flex;gap:8px">
            <textarea class="fc" id="wa-reply-input" rows="2" placeholder="Type a message…" style="resize:none;flex:1;font-size:12px"></textarea>
            <div style="display:flex;flex-direction:column;gap:4px">
              <button class="btn btn-teal btn-sm" onclick="WAPage.sendReply()">Send</button>
              <button class="btn btn-ghost btn-sm" onclick="WAPage.aiSuggest()">AI</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  `;

  await WAPage.init();
};

const WAPage = {
  _threads: [],
  _activeConsumerId: null,

  async init() {
    try {
      const res = await Api.get('/communications/tickets', { params: { channel: 'whatsapp', pageSize: 100 } });
      const msgs = res.data || res || [];

      // Group by consumer
      const threadMap = new Map();
      for (const m of msgs) {
        const cid = m.consumer_id || m.consumerId || 'unknown';
        if (!threadMap.has(cid)) {
          threadMap.set(cid, {
            consumerId: cid,
            name: m.consumer_name || m.consumerName || 'Unknown',
            phone: m.phone_recipient || m.phoneRecipient || '',
            messages: [],
            lastMsg: m,
          });
        }
        threadMap.get(cid).messages.push(m);
      }
      this._threads = [...threadMap.values()];
      this.renderThreads(this._threads);
    } catch (err) {
      document.getElementById('wa-threads').innerHTML = `<div style="padding:16px;color:var(--red);font-size:11px">${err.message}</div>`;
    }
  },

  renderThreads(threads) {
    const el = document.getElementById('wa-threads');
    if (!el) return;
    if (threads.length === 0) {
      el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);font-size:12px">No WhatsApp conversations yet</div>';
      return;
    }
    el.innerHTML = threads.map(t => {
      const last = t.lastMsg;
      const preview = last.message || last.subject || '—';
      return `
        <div style="padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;${t.consumerId===this._activeConsumerId?'background:var(--bg2);border-left:3px solid var(--teal)':''}"
          onclick="WAPage.openThread('${t.consumerId}')">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div style="font-weight:600;font-size:12px">${t.name}</div>
            <div style="font-size:9px;color:var(--text3)">${Utils.date(last.created_at||last.createdAt)}</div>
          </div>
          <div style="font-size:10.5px;color:var(--text3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px">${preview}</div>
          ${t.phone ? `<div style="font-size:9.5px;color:var(--teal);margin-top:2px">${t.phone}</div>` : ''}
        </div>
      `;
    }).join('');
  },

  filterThreads() {
    const search = document.getElementById('wa-search')?.value?.toLowerCase() || '';
    const filtered = search ? this._threads.filter(t => t.name.toLowerCase().includes(search) || t.phone.includes(search)) : this._threads;
    this.renderThreads(filtered);
  },

  async openThread(consumerId) {
    this._activeConsumerId = consumerId;
    const thread = this._threads.find(t => t.consumerId === consumerId);
    if (!thread) return;

    document.getElementById('wa-chat-header').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div>${thread.name}</div>
          <div style="font-size:10px;color:var(--text3)">${thread.phone}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/consumer',{id:'${consumerId}'})">View Profile</button>
      </div>
    `;

    const msgEl = document.getElementById('wa-messages');
    msgEl.innerHTML = thread.messages.map(m => {
      const isOut = m.direction !== 'inbound';
      return `
        <div style="display:flex;justify-content:${isOut?'flex-end':'flex-start'}">
          <div style="max-width:70%;padding:8px 12px;border-radius:${isOut?'12px 12px 2px 12px':'12px 12px 12px 2px'};background:${isOut?'var(--teal)':'var(--bg2)'};color:${isOut?'#fff':'var(--text)'};font-size:12px">
            <div>${m.message||m.subject||'—'}</div>
            <div style="font-size:9px;opacity:0.7;margin-top:4px;text-align:right">${Utils.date(m.created_at||m.createdAt)} · ${m.delivery_status||'sent'}</div>
          </div>
        </div>
      `;
    }).join('');
    msgEl.scrollTop = msgEl.scrollHeight;

    document.getElementById('wa-reply-area').style.display = 'block';
    this.renderThreads(this._threads);
  },

  async sendReply() {
    if (!this._activeConsumerId) return;
    const msg = document.getElementById('wa-reply-input')?.value?.trim();
    if (!msg) { Utils.warn('Please type a message'); return; }
    try {
      await Api.post(`/communications/${this._activeConsumerId}/send`, { channel: 'whatsapp', message: msg });
      Utils.success('Message sent');
      document.getElementById('wa-reply-input').value = '';
      await this.init();
      await this.openThread(this._activeConsumerId);
    } catch (err) { Utils.error(err.message); }
  },

  async aiSuggest() {
    if (!this._activeConsumerId) return;
    try {
      const res = await Api.post(`/communications/${this._activeConsumerId}/ai-draft`, { channel: 'whatsapp' });
      const draft = res.data?.draft || res.draft || '';
      if (draft) document.getElementById('wa-reply-input').value = draft;
    } catch { Utils.info('AI suggestion not available'); }
  },
};
