// ROF CRM — Facebook Inbox Page

Pages.facebookInbox = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Facebook Inbox</h1>
      <div class="breadcrumb">CRM / <b>Facebook</b></div>
    </div>
    <div style="display:grid;grid-template-columns:300px 1fr;gap:0;height:calc(100vh - 200px);border:1px solid var(--border);border-radius:8px;overflow:hidden">
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
