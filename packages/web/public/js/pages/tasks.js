// ROF CRM — Tasks Page

Pages.tasks = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Tasks</h1>
      <div class="breadcrumb">CRM / <b>Tasks</b></div>
    </div>

    <div style="display:grid;grid-template-columns:340px 1fr;gap:16px;margin-top:4px">
      <!-- Create Task Panel -->
      <div>
        <div class="sp">
          <div class="sp-hdr"><div class="sp-title">Create Task</div></div>
          <div class="sp-body">
            <div class="fg" style="margin-bottom:8px"><label class="fl"><span class="r">*</span>Task Title</label>
              <input class="fc" id="task-title" placeholder="What needs to be done?">
            </div>
            <div class="fg" style="margin-bottom:8px"><label class="fl">Description</label>
              <textarea class="fc" id="task-desc" rows="2" placeholder="Details…"></textarea>
            </div>
            <div class="fg" style="margin-bottom:8px"><label class="fl">Assign To</label>
              <select class="fc" id="task-assign">
                <option value="">— Self —</option>
              </select>
            </div>
            <div class="fg" style="margin-bottom:8px"><label class="fl">Consumer (Optional)</label>
              <select class="fc" id="task-consumer">
                <option value="">— No Consumer —</option>
              </select>
            </div>
            <div class="fg" style="margin-bottom:8px"><label class="fl">Due Date</label>
              <input type="date" class="fc" id="task-due" value="${Utils.today()}">
            </div>
            <div class="fg" style="margin-bottom:12px"><label class="fl">Priority</label>
              <div class="btg">
                <button type="button" class="btg-item on" onclick="btgSelect(this)">Normal</button>
                <button type="button" class="btg-item" onclick="btgSelect(this)">High</button>
                <button type="button" class="btg-item" onclick="btgSelect(this)">Urgent</button>
              </div>
            </div>
            <button class="btn btn-teal" style="width:100%" onclick="TasksPage.create()">Create Task</button>
          </div>
        </div>
      </div>

      <!-- Task List -->
      <div>
        <!-- Filter tabs -->
        <div class="tabs-line" style="margin-bottom:12px">
          <button class="tab-line active" data-group="tasks" data-tab="all" onclick="switchTab('tasks','all');TasksPage.load('all')">All</button>
          <button class="tab-line" data-group="tasks" data-tab="today" onclick="switchTab('tasks','today');TasksPage.load('today')">Due Today</button>
          <button class="tab-line" data-group="tasks" data-tab="pending" onclick="switchTab('tasks','pending');TasksPage.load('pending')">Pending</button>
          <button class="tab-line" data-group="tasks" data-tab="completed" onclick="switchTab('tasks','completed');TasksPage.load('completed')">Completed</button>
        </div>

        <div data-panel-group="tasks" data-panel="all">
          <div id="tasks-list-all"><div class="page-loading"><div class="spinner"></div> Loading…</div></div>
        </div>
        <div data-panel-group="tasks" data-panel="today" style="display:none">
          <div id="tasks-list-today"></div>
        </div>
        <div data-panel-group="tasks" data-panel="pending" style="display:none">
          <div id="tasks-list-pending"></div>
        </div>
        <div data-panel-group="tasks" data-panel="completed" style="display:none">
          <div id="tasks-list-completed"></div>
        </div>
      </div>
    </div>
  `;

  await TasksPage.init();
};

const TasksPage = {
  _list: [],

  async init() {
    await Promise.allSettled([
      this.loadUsers(),
      this.loadConsumers(),
      this.load('all'),
    ]);
  },

  async loadUsers() {
    try {
      const res = await Api.get('/users/directory');
      const list = res.data || res || [];
      const sel = document.getElementById('task-assign');
      if (sel) sel.innerHTML = '<option value="">— Self —</option>' +
        list.map(u => `<option value="${u.id}">${u.name||u.email}</option>`).join('');
    } catch {}
  },

  async loadConsumers() {
    try {
      const res = await Api.get('/consumers', { params: { pageSize: 200 } });
      const list = res.data || res || [];
      const sel = document.getElementById('task-consumer');
      if (sel) sel.innerHTML = '<option value="">— No Consumer —</option>' +
        list.map(c => `<option value="${c.id}">${c.first_name||''} ${c.last_name||c.name||'—'} · ${c.mobile||''}</option>`).join('');
    } catch {}
  },

  async load(filter = 'all') {
    const elId = `tasks-list-${filter}`;
    const el = document.getElementById(elId);
    if (!el) return;

    try {
      const params = { pageSize: 200 };
      if (filter === 'today') { params.dueDate = Utils.today(); }
      else if (filter === 'pending') { params.status = 'pending'; }
      else if (filter === 'completed') { params.status = 'completed'; }

      const res = await Api.get('/tasks', { params });
      const list = res.data || res || [];
      this._list = list;
      this.renderList(list, el);
    } catch (err) {
      el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  renderList(list, el) {
    if (list.length === 0) {
      el.innerHTML = '<div class="empty-state"><h3>No tasks found</h3></div>';
      return;
    }
    const today = Utils.today();
    el.innerHTML = list.map(t => {
      const dueDate = t.due_date || t.dueDate;
      const isOverdue = dueDate && dueDate < today && t.status !== 'completed';
      const isDueToday = dueDate === today;
      return `
        <div class="sp" style="margin-bottom:8px;padding:12px;${t.status==='completed'?'opacity:0.6':''}">
          <div style="display:flex;align-items:flex-start;gap:10px">
            <input type="checkbox" style="margin-top:3px;width:16px;height:16px;cursor:pointer"
              ${t.status==='completed'?'checked':''}
              onchange="TasksPage.toggle('${t.id}',this.checked)">
            <div style="flex:1">
              <div style="font-weight:600;font-size:13px;${t.status==='completed'?'text-decoration:line-through':''}">${t.title||'Untitled'}</div>
              ${t.description||t.desc ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">${t.description||t.desc}</div>` : ''}
              <div style="display:flex;gap:8px;margin-top:6px;align-items:center;flex-wrap:wrap">
                ${dueDate ? `<span style="font-size:10.5px;${isOverdue?'color:var(--red);font-weight:600':isDueToday?'color:var(--warn)':'color:var(--text3)'}">
                  ${isOverdue?'⚠ Overdue: ':isDueToday?'Today: ':'Due: '}${Utils.date(dueDate)}
                </span>` : ''}
                ${t.assigned_to_name||t.assignedToName ? `<span style="font-size:10.5px;color:var(--teal)">→ ${t.assigned_to_name||t.assignedToName}</span>` : ''}
                ${t.consumer_name||t.consumerName ? `<span style="font-size:10.5px;color:var(--text3)">· ${t.consumer_name||t.consumerName}</span>` : ''}
                ${Utils.chip(t.status||'pending')}
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="TasksPage.delete('${t.id}')" style="color:var(--red);font-size:11px">✕</button>
          </div>
        </div>
      `;
    }).join('');
  },

  async create() {
    const title = document.getElementById('task-title')?.value?.trim();
    if (!title) { Utils.warn('Please enter a task title'); return; }

    const body = {
      title,
      description: document.getElementById('task-desc')?.value?.trim(),
      assignedTo: document.getElementById('task-assign')?.value || undefined,
      consumerId: document.getElementById('task-consumer')?.value || undefined,
      dueDate: document.getElementById('task-due')?.value,
    };

    try {
      await Api.post('/tasks', body);
      Utils.success('Task created');
      document.getElementById('task-title').value = '';
      document.getElementById('task-desc').value = '';
      await this.load('all');
    } catch (err) { Utils.error(err.message); }
  },

  async toggle(taskId, completed) {
    try {
      await Api.patch(`/tasks/${taskId}`, { status: completed ? 'completed' : 'pending' });
      Utils.success(completed ? 'Task completed' : 'Task re-opened');
      await this.load('all');
    } catch (err) { Utils.error(err.message); }
  },

  async delete(taskId) {
    Utils.confirm('Delete this task?', async () => {
      try {
        await Api.delete(`/tasks/${taskId}`);
        Utils.success('Task deleted');
        await Promise.all([
          this.load('all'),
          this.load('pending'),
          this.load('completed'),
        ]);
      } catch (err) { Utils.error(err.message); }
    });
  },
};
