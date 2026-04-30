// ROF CRM — Instagram Inbox Page

Pages.instagramInbox = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Instagram Inbox</h1>
      <div class="breadcrumb">CRM / <b>Instagram</b></div>
    </div>
    <div style="display:grid;grid-template-columns:300px 1fr;gap:0;height:calc(100vh - 200px);border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <div style="border-right:1px solid var(--border);overflow-y:auto;background:var(--bg)">
        <div style="padding:10px;border-bottom:1px solid var(--border);background:var(--bg2)">
          <input class="fc" placeholder="Search messages…" style="font-size:12px;width:100%;background:transparent;border:none;color:var(--text);outline:none">
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
  `;
  await IGPage.init();
};

const IGPage = {
  _threads: [], _activeConsumerId: null,

  async init() {
    try {
      const res = await Api.get('/communications/tickets', { params: { channel: 'instagram', pageSize: 100 } });
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
            <div style="font-weight:600;font-size:12px">${t.name}</div>
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
          ${m.message||m.subject||'—'}
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
