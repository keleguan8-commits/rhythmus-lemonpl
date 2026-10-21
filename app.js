/* ============================================================
 * 工作台 · 节奏
 * 纯前端单页：任务组(2层) + 任务 + 子任务 + 番茄钟 + 时间统计
 * 数据全部存在 localStorage，键名 "pace.workbench.v1"
 * ============================================================ */

(() => {
  'use strict';

  // ---------- 工具 ----------
  const $ = (id) => document.getElementById(id);
  const todayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const RHYTHM_STORAGE_KEY = 'pace.workbench.rhythm.v1';
  const LEMON_STORAGE_KEY = 'pace.workbench.lemon.v1';
  const RHYTHM_BLOCKS = [
    { id: 'morning-start', time: '10:00–10:15', title: '进入状态', detail: '整理桌面、确认今日三件最重要的事', type: 'simple' },
    { id: 'morning-deep', time: '10:15–11:15', title: '攻克困难工作', detail: '处理最需要判断力和创造力的核心任务', type: 'deep' },
    { id: 'morning-simple', time: '11:15–11:50', title: '推进简单工作', detail: '回复、整理、资料准备或可批量处理事项', type: 'simple' },
    { id: 'morning-review', time: '11:50–12:00', title: '收束与记录', detail: '记录进展，写下下午的第一步', type: 'reading' },
    { id: 'afternoon-deep', time: '14:00–15:30', title: '第二段深度工作', detail: '集中处理当天最重要的交付或复杂问题', type: 'deep' },
    { id: 'afternoon-simple', time: '15:30–16:00', title: '低负荷推进', detail: '整理、沟通、测试或执行性工作', type: 'simple' },
    { id: 'study', time: '16:00–16:30', title: '专业学习', detail: '学习一个专业主题，只记录关键概念和疑问', type: 'study' },
    { id: 'afternoon-focus', time: '16:30–18:30', title: '工作交付', detail: '回到工作主线，完成、验证并提交阶段成果', type: 'deep' },
    { id: 'reading', time: '18:30–18:45', title: '短阅读蓄力', detail: '阅读专业文章或书籍，控制在 15 分钟内', type: 'reading' },
    { id: 'close', time: '18:45–19:00', title: '复盘与明日准备', detail: '完成收尾，写三行复盘和明日首要任务', type: 'simple' },
  ];

  function loadRhythm() {
    try {
      const raw = localStorage.getItem(RHYTHM_STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      return {
        morningStart: saved.morningStart === '09:40' ? '09:40' : '10:00',
        completed: Array.isArray(saved.completed) ? saved.completed : [],
      };
    } catch { return { morningStart: '10:00', completed: [] }; }
  }

  let rhythm = loadRhythm();

  function localDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function loadLemon() {
    try {
      const saved = JSON.parse(localStorage.getItem(LEMON_STORAGE_KEY) || '{}');
      const now = new Date();
      return {
        selectedDate: saved.selectedDate || localDateKey(now),
        viewYear: Number.isInteger(saved.viewYear) ? saved.viewYear : now.getFullYear(),
        viewMonth: Number.isInteger(saved.viewMonth) ? saved.viewMonth : now.getMonth(),
        activePage: ['lemon', 'library'].includes(saved.activePage) ? saved.activePage : 'rhythm',
        days: saved.days && typeof saved.days === 'object' ? saved.days : {},
        actionBars: Array.isArray(saved.actionBars) ? saved.actionBars : [],
      };
    } catch {
      const now = new Date();
      return { selectedDate: localDateKey(now), viewYear: now.getFullYear(), viewMonth: now.getMonth(), activePage: 'rhythm', days: {}, actionBars: [] };
    }
  }

  let lemon = loadLemon();
  function saveLemon() {
    try { localStorage.setItem(LEMON_STORAGE_KEY, JSON.stringify(lemon)); } catch {}
  }

  function saveRhythm() {
    try { localStorage.setItem(RHYTHM_STORAGE_KEY, JSON.stringify(rhythm)); } catch {}
  }

  function renderRhythm() {
    const grid = $('rhythmGrid');
    if (!grid) return;
    const morningStart = rhythm.morningStart;
    const blocks = RHYTHM_BLOCKS.map(block => {
      if (morningStart === '09:40' && block.id === 'morning-start') return { ...block, time: '09:40–09:55' };
      if (morningStart === '09:40' && block.id === 'morning-deep') return { ...block, time: '09:55–10:55' };
      if (morningStart === '09:40' && block.id === 'morning-simple') return { ...block, time: '10:55–11:30' };
      if (morningStart === '09:40' && block.id === 'morning-review') return { ...block, time: '11:30–11:40' };
      return block;
    });
    grid.innerHTML = blocks.map(block => {
      const checked = rhythm.completed.includes(block.id);
      return `<label class="rhythm-block ${block.type} ${checked ? 'completed' : ''}">
        <input class="rhythm-check" type="checkbox" data-rhythm-id="${block.id}" ${checked ? 'checked' : ''}>
        <span><span class="rhythm-time">${block.time}</span><span class="rhythm-title">${block.title}</span><span class="rhythm-detail">${block.detail}</span></span>
      </label>`;
    }).join('');
    $('rhythmProgress').textContent = `${rhythm.completed.length}/${blocks.length} 完成`;
  }

  function fmtMin(m) {
    m = Math.round(m);
    if (m < 60) return m + 'm';
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h}h${r}m` : `${h}h`;
  }
  function fmtClock(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // ---------- 状态 ----------
  const STORAGE_KEY = 'pace.workbench.v1';
  const DEFAULTS = {
    settings: { work: 25, brk: 5, longBreak: 15, longEvery: 4 },
    lists: [],
    archives: {},            // { "2026-08": { label, tasks: [] } }
    selectedArchive: null,   // 当前查看的归档月份 key
    archivePanelOpen: false, // 整个归档区默认收起，避免挤占任务组
    selectedListId: null,
    filter: 'all',
    today: { date: todayKey(), focusMin: 0, doneCount: 0, pomodoroCount: 0, dist: { work: 0, study: 0, other: 0 } },
    pomo: {
      phase: 'work',           // work | brk | longBreak
      remaining: 25 * 60,
      running: false,
      taskId: null,
      completed: 0,            // 今日已完成的专注番茄数
      lastTick: 0,
    },
  };

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return seed();
      const s = JSON.parse(raw);
      // 跨天重置今日统计
      if (!s.today || s.today.date !== todayKey()) {
        s.today = { date: todayKey(), focusMin: 0, doneCount: 0, pomodoroCount: 0, dist: { work: 0, study: 0, other: 0 } };
        if (s.pomo) s.pomo.completed = 0;
      }
      return { ...structuredClone(DEFAULTS), ...s,
        settings: { ...DEFAULTS.settings, ...(s.settings || {}) },
        archives: { ...(s.archives || {}) },
        today: { ...DEFAULTS.today, ...(s.today || {}) },
        pomo: { ...DEFAULTS.pomo, ...(s.pomo || {}) },
      };
    } catch { return seed(); }
  }

  function seed() {
    const s = structuredClone(DEFAULTS);
    const work = { id: uid(), title: 'Arbeit', category: 'work', tasks: [] };
    const study = { id: uid(), title: 'Lernen', category: 'study', tasks: [] };
    s.lists = [work, study];
    s.selectedListId = work.id;
    // 示例任务，让首屏不空
    work.tasks.push({ id: uid(), title: '整理本周工作计划', done: false, priority: 'high', estimate: 25, spent: 0, due: '', subs: [] });
    study.tasks.push({ id: uid(), title: '阅读一篇专业论文并做笔记', done: false, priority: 'mid', estimate: 50, spent: 0, due: '', subs: [
      { id: uid(), title: '通读摘要与结论', done: false },
      { id: uid(), title: '记录关键方法', done: false },
    ]});
    return s;
  }

  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    }, 120);
  }

  // ---------- 选择器 ----------
  const currentList = () => state.lists.find(l => l.id === state.selectedListId);
  const filteredLists = () => state.filter === 'all'
    ? state.lists
    : state.lists.filter(l => l.category === state.filter);
  const findTask = (id) => {
    for (const l of state.lists) {
      const t = l.tasks.find(t => t.id === id);
      if (t) return { list: l, task: t };
    }
    return null;
  };

  // ---------- 归档：按月分组 ----------
  // 归档任务的归属月份：优先完成月份，其次截止月份，最后当前月份
  const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  function monthKeyOfTask(t) {
    const src = t.doneAt || t.due || todayKey();
    return String(src).slice(0, 7); // YYYY-MM
  }
  function monthLabel(key) {
    const [y, m] = key.split('-');
    return `${y}年${MONTH_LABELS[Number(m) - 1] || m}`;
  }
  function sortedArchiveKeys() {
    return Object.keys(state.archives).sort().reverse();
  }
  function archiveTask(task, list) {
    const key = monthKeyOfTask(task);
    if (!state.archives[key]) state.archives[key] = { label: monthLabel(key), tasks: [] };
    state.archives[key].tasks.push({
      ...structuredClone(task),
      fromList: list.title,
      fromCategory: list.category,
      archivedAt: new Date().toISOString().slice(0, 10),
    });
  }
  function countArchived() {
    return sortedArchiveKeys().reduce((n, k) => n + state.archives[k].tasks.length, 0);
  }

  // ---------- 渲染：任务组 ----------
  function renderLists() {
    const ul = $('lists');
    ul.innerHTML = '';
    const lists = filteredLists();
    if (!lists.length) {
      ul.innerHTML = '<li style="color:var(--text-faint);padding:16px;text-align:center;font-size:13px">该分类下没有任务组</li>';
      return;
    }
    for (const l of lists) {
      const done = l.tasks.filter(t => t.done).length;
      const li = document.createElement('li');
      li.className = 'list-item' + (l.id === state.selectedListId ? ' active' : '');
      li.dataset.id = l.id;
      li.innerHTML = `
        <span class="list-dot ${l.category}"></span>
        <span class="list-title">${escapeHtml(l.title)}</span>
        <span class="list-count">${done}/${l.tasks.length}</span>
        <button class="list-del" title="删除任务组">×</button>`;
      li.addEventListener('click', (e) => {
        if (e.target.classList.contains('list-del')) return;
        state.selectedListId = l.id;
        save(); renderAll();
      });
      li.querySelector('.list-del').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`删除任务组「${l.title}」及其下 ${l.tasks.length} 个任务？`)) {
          state.lists = state.lists.filter(x => x.id !== l.id);
          if (state.selectedListId === l.id) state.selectedListId = state.lists[0]?.id || null;
          save(); renderAll();
        }
      });
      ul.appendChild(li);
    }
  }

  // ---------- 渲染：按月归档文件夹 ----------
  function renderArchive() {
    const box = $('archiveMonths');
    if (!box) return;
    const keys = sortedArchiveKeys();
    const total = countArchived();
    $('archiveTotal').textContent = total;
    $('archiveBody').hidden = !state.archivePanelOpen;
    $('archivePanelCaret').textContent = state.archivePanelOpen ? '▾' : '▸';
    $('archivePanelToggle').setAttribute('aria-expanded', String(state.archivePanelOpen));
    $('archivePanel').classList.toggle('open', state.archivePanelOpen);
    if (!keys.length) {
      box.innerHTML = '<p class="archive-empty">还没有归档，点“归档已完成”把已完成任务收进对应月份。</p>';
      return;
    }
    box.innerHTML = keys.map(key => {
      const a = state.archives[key];
      const active = state.selectedArchive === key ? ' active' : '';
      const isOpen = a.open === true;
      const open = isOpen ? ' open' : '';
      const groups = new Map();
      for (const task of (a.tasks || [])) {
        const groupName = task.fromList || '未分类';
        if (!groups.has(groupName)) groups.set(groupName, []);
        groups.get(groupName).push(task);
      }
      const groupHtml = [...groups.entries()].map(([groupName, tasks]) => `
        <li class="archive-group">
          <div class="archive-group-head">
            <span class="archive-group-icon">▾</span>
            <span class="archive-group-name">${escapeHtml(groupName)}</span>
            <span class="archive-group-count">${tasks.length}</span>
          </div>
          <ul class="archive-group-tasks">
            ${tasks.map(t => `<li class="archive-task" data-task="${t.id}" data-month="${key}" title="点击查看详情">
              <span class="archive-task-title">${escapeHtml(t.title)}</span>
              <span class="archive-task-meta">${t.spent ? `已用 ${fmtMin(t.spent)}` : '未记录用时'}</span>
            </li>`).join('')}
          </ul>
        </li>`).join('');
      return `<div class="archive-month${active}${open}" data-month="${key}">
        <div class="archive-month-head">
          <span class="archive-caret">${isOpen ? '▾' : '▸'}</span>
          <span class="archive-folder">📁</span>
          <span class="archive-month-label">${escapeHtml(a.label || monthLabel(key))}</span>
          <span class="archive-month-count">${(a.tasks || []).length}</span>
          <button class="archive-month-del" title="删除该月归档">×</button>
        </div>
        <ul class="archive-tasks">${groupHtml}</ul>
      </div>`;
    }).join('');
  }

  // ---------- 渲染：任务项 ----------
  function renderTasks() {
    const ul = $('tasks');
    const head = $('currentListTitle');
    const form = $('addTaskForm');
    const empty = $('tasksEmpty');
    ul.innerHTML = '';
    const l = currentList();
    if (!l) {
      head.textContent = '选择或新建一个任务组';
      form.hidden = true;
      empty.hidden = true;
      $('tasksProgress').textContent = '';
      return;
    }
    head.textContent = l.title;
    form.hidden = false;
    const total = l.tasks.length;
    const done = l.tasks.filter(t => t.done).length;
    $('tasksProgress').textContent = total ? `${done}/${total} 完成` : '';
    if (!total) { empty.hidden = false; return; }
    empty.hidden = true;

    // 排序：未完成在前，按优先级 high>mid>low>none
    const order = { high: 0, mid: 1, low: 2, none: 3 };
    const sorted = [...l.tasks].sort((a, b) =>
      Number(a.done) - Number(b.done) || order[a.priority] - order[b.priority]);

    for (const t of sorted) {
      const li = document.createElement('li');
      li.className = `task-item prio-${t.priority} ${t.done ? 'done' : ''} ${state.pomo.taskId === t.id && state.pomo.running ? 'focusing' : ''}`;
      li.dataset.id = t.id;
      const subDone = t.subs.filter(s => s.done).length;
      const meta = [];
      if (t.estimate) meta.push(`<span class="task-tag time">⏱ ${fmtMin(t.estimate)}</span>`);
      if (t.spent) meta.push(`<span class="task-tag time">已用 ${fmtMin(t.spent)}</span>`);
      if (t.due) meta.push(`<span class="task-tag due ${isOverdue(t.due, t.done) ? 'overdue' : ''}">📅 ${t.due}</span>`);
      if (t.subs.length) meta.push(`<span class="task-tag subs">☐ ${subDone}/${t.subs.length}</span>`);
      li.innerHTML = `
        <button class="task-check ${t.done ? 'checked' : ''}" title="完成">${t.done ? '✓' : ''}</button>
        <div class="task-body">
          <div class="task-title">${escapeHtml(t.title)}</div>
          ${meta.length ? `<div class="task-meta">${meta.join('')}</div>` : ''}
        </div>
        ${!t.done ? `<button class="task-focus-btn" title="用番茄钟专注此项">专注</button>` : ''}`;
      li.querySelector('.task-check').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDone(t);
      });
      const focusBtn = li.querySelector('.task-focus-btn');
      if (focusBtn) focusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startFocusOn(t.id);
      });
      li.addEventListener('click', () => openModal(t.id));
      ul.appendChild(li);
    }
  }

  function isOverdue(due, done) {
    if (done || !due) return false;
    return due < todayKey();
  }

  // ---------- 渲染：顶栏统计 ----------
  function renderSummary() {
    $('statFocus').textContent = fmtMin(state.today.focusMin);
    $('statDone').textContent = state.today.doneCount;
    $('statPomodoro').textContent = state.today.pomodoroCount;
    const d = new Date();
    $('statDate').textContent = `${d.getMonth() + 1}/${d.getDate()}`;
    $('statWeekday').textContent = WEEKDAYS[d.getDay()];
  }

  // ---------- 渲染：时间分布 ----------
  function renderDist() {
    const box = $('distBars');
    const dist = state.today.dist;
    const total = dist.work + dist.study + dist.other;
    if (!total) {
      box.innerHTML = '<div class="dist-empty">今天还没有专注记录，开始一个番茄钟吧。</div>';
      return;
    }
    const rows = [
      { key: 'work', label: '工作' },
      { key: 'study', label: '学习' },
      { key: 'other', label: '其他' },
    ];
    box.innerHTML = rows.map(r => {
      const v = dist[r.key] || 0;
      const pct = total ? Math.round(v / total * 100) : 0;
      return `<div class="dist-row">
        <div class="dist-row-head"><span>${r.label}</span><span>${fmtMin(v)} · ${pct}%</span></div>
        <div class="dist-bar"><div class="dist-bar-fill ${r.key}" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');
  }

  // ---------- 渲染：番茄钟 ----------
  function renderPomo() {
    const p = state.pomo;
    const phaseEl = $('pomoPhase');
    const isBreak = p.phase !== 'work';
    phaseEl.textContent = p.phase === 'work' ? '专注' : (p.phase === 'longBreak' ? '长休' : '短休');
    phaseEl.classList.toggle('break', isBreak);
    $('pomoClock').textContent = fmtClock(p.remaining);
    $('pomoCount').textContent = `今日 ${state.today.pomodoroCount} 个番茄`;
    $('pomoStart').textContent = p.running ? '暂停' : '开始';
    const t = p.taskId && findTask(p.taskId);
    $('pomoTask').textContent = t ? `正在专注：${t.task.title}` : '未选择任务';
  }

  function renderAll() {
    renderLists();
    renderArchive();
    renderTasks();
    renderSummary();
    renderDist();
    renderPomo();
    renderRhythm();
  }

  // ---------- LemonPL：页面切换、日历与日期列表 ----------
  function switchPage(page) {
    lemon.activePage = ['lemon', 'library'].includes(page) ? page : 'rhythm';
    document.querySelectorAll('.rhythm-only').forEach(el => { el.hidden = lemon.activePage !== 'rhythm'; });
    $('lemonPage').hidden = lemon.activePage !== 'lemon';
    $('libraryPage').hidden = lemon.activePage !== 'library';
    document.querySelectorAll('.page-switch').forEach(btn => btn.classList.toggle('active', btn.dataset.page === lemon.activePage));
    if (lemon.activePage === 'lemon') renderLemon();
    if (lemon.activePage === 'library') window.dispatchEvent(new Event('library:open'));
    saveLemon();
  }

  function lemonListsFor(dateKey, create = false) {
    if (!lemon.days[dateKey] && create) lemon.days[dateKey] = { lists: [] };
    const day = lemon.days[dateKey];
    if (!day) return [];
    if (!Array.isArray(day.lists)) day.lists = [];
    return day.lists;
  }

  function hasLemonContent(dateKey) {
    return lemonListsFor(dateKey).some(list => list.title || (list.items && list.items.length));
  }

  function renderCalendar() {
    const y = lemon.viewYear, m = lemon.viewMonth;
    $('calendarTitle').textContent = `${y}年${m + 1}月`;
    const firstDay = new Date(y, m, 1);
    const leading = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const prevMonthDays = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < 42; i++) {
      let dayNum, cellDate, muted = false;
      if (i < leading) {
        dayNum = prevMonthDays - leading + i + 1;
        cellDate = new Date(y, m - 1, dayNum);
        muted = true;
      } else if (i >= leading + daysInMonth) {
        dayNum = i - leading - daysInMonth + 1;
        cellDate = new Date(y, m + 1, dayNum);
        muted = true;
      } else {
        dayNum = i - leading + 1;
        cellDate = new Date(y, m, dayNum);
      }
      const key = localDateKey(cellDate);
      const classes = ['calendar-day'];
      if (muted) classes.push('muted');
      if (key === lemon.selectedDate) classes.push('selected');
      if (key === localDateKey()) classes.push('today');
      if (hasLemonContent(key)) classes.push('has-plan');
      cells.push(`<button type="button" class="${classes.join(' ')}" data-date="${key}"><span>${dayNum}</span></button>`);
    }
    $('calendarGrid').innerHTML = cells.join('');
  }

  function formatLemonDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return `${y}年${m}月${d}日 · ${WEEKDAYS[date.getDay()]}`;
  }

  function renderLemonBoard() {
    const lists = lemonListsFor(lemon.selectedDate);
    const itemCount = lists.reduce((n, list) => n + (list.items || []).length, 0);
    const doneCount = lists.reduce((n, list) => n + (list.items || []).filter(item => item.done).length, 0);
    $('lemonDateTitle').textContent = formatLemonDate(lemon.selectedDate);
    $('lemonDateSummary').textContent = lists.length ? `${lists.length} 个列表 · ${doneCount}/${itemCount} 项完成` : '选择左侧日期，为当天创建列表。';
    $('lemonEmpty').hidden = lists.length > 0;
    $('lemonLists').innerHTML = lists.map(list => {
      const items = Array.isArray(list.items) ? list.items : [];
      const complete = items.filter(item => item.done).length;
      return `<section class="lemon-list" data-list-id="${list.id}">
        <div class="lemon-list-head">
          <h3>${escapeHtml(list.title)}</h3>
          <span>${complete}/${items.length}</span>
          <button type="button" class="lemon-list-delete" title="删除列表">×</button>
        </div>
        <ul class="lemon-items">
          ${items.map(item => `<li class="lemon-item ${item.done ? 'done' : ''}" data-item-id="${item.id}">
            <button type="button" class="lemon-item-check" aria-label="标记完成">${item.done ? '✓' : ''}</button>
            <input class="lemon-item-title" type="text" value="${escapeHtml(item.title)}" maxlength="120" aria-label="编辑事项文字">
            <button type="button" class="lemon-item-delete" title="删除事项">×</button>
          </li>`).join('')}
        </ul>
        <form class="lemon-add-item">
          <input type="text" placeholder="添加事项…" maxlength="120" autocomplete="off">
          <button type="submit">＋</button>
        </form>
      </section>`;
    }).join('');
    renderActionBars();
  }

  function formatRange(start, end) { return start === end ? start : `${start} → ${end}`; }
  function renderActionBars() {
    const box = $('actionBars');
    if (!box) return;
    const bars = Array.isArray(lemon.actionBars) ? lemon.actionBars : [];
    box.innerHTML = bars.length ? bars.map(bar => `
      <article class="action-bar" data-bar-id="${bar.id}">
        <div class="action-bar-heading"><div><h4>${escapeHtml(bar.title)}</h4><span>${formatRange(bar.start, bar.end)}</span></div><button type="button" class="action-bar-delete" title="删除行动栏">×</button></div>
        <ul>${(bar.items || []).map(item => `<li class="action-bar-item ${item.done ? 'done' : ''}" data-item-id="${item.id}"><button type="button" class="action-bar-check">${item.done ? '✓' : ''}</button><input class="action-bar-item-title" type="text" value="${escapeHtml(item.title)}" maxlength="120"><button type="button" class="action-bar-item-delete">×</button></li>`).join('')}</ul>
        <form class="action-bar-add"><input type="text" placeholder="添加周期行动…" maxlength="120"><button type="submit">＋</button></form>
      </article>`).join('') : '<p class="action-bars-empty">还没有周期行动栏。你可以按任意日期范围创建。</p>';
  }

  function renderLemon() {
    renderCalendar();
    renderLemonBoard();
  }

  document.querySelector('.page-switcher').addEventListener('click', (e) => {
    const btn = e.target.closest('.page-switch');
    if (btn) switchPage(btn.dataset.page);
  });

  $('calendarGrid').addEventListener('click', (e) => {
    const day = e.target.closest('.calendar-day');
    if (!day) return;
    lemon.selectedDate = day.dataset.date;
    const [y, m] = lemon.selectedDate.split('-').map(Number);
    lemon.viewYear = y; lemon.viewMonth = m - 1;
    saveLemon(); renderLemon();
  });

  function moveCalendar(delta) {
    const next = new Date(lemon.viewYear, lemon.viewMonth + delta, 1);
    lemon.viewYear = next.getFullYear(); lemon.viewMonth = next.getMonth();
    saveLemon(); renderCalendar();
  }
  $('calendarPrev').addEventListener('click', () => moveCalendar(-1));
  $('calendarNext').addEventListener('click', () => moveCalendar(1));
  $('calendarToday').addEventListener('click', () => {
    const now = new Date();
    lemon.selectedDate = localDateKey(now); lemon.viewYear = now.getFullYear(); lemon.viewMonth = now.getMonth();
    saveLemon(); renderLemon();
  });

  $('lemonAddListForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('lemonNewListTitle').value.trim();
    if (!title) return;
    lemonListsFor(lemon.selectedDate, true).push({ id: uid(), title, items: [] });
    $('lemonNewListTitle').value = '';
    saveLemon(); renderLemon();
  });

  $('lemonLists').addEventListener('submit', (e) => {
    const form = e.target.closest('.lemon-add-item');
    if (!form) return;
    e.preventDefault();
    const listId = form.closest('.lemon-list').dataset.listId;
    const list = lemonListsFor(lemon.selectedDate).find(item => item.id === listId);
    const input = form.querySelector('input');
    const title = input.value.trim();
    if (!list || !title) return;
    if (!Array.isArray(list.items)) list.items = [];
    list.items.push({ id: uid(), title, done: false });
    saveLemon(); renderLemon();
  });

  $('lemonLists').addEventListener('click', (e) => {
    const listEl = e.target.closest('.lemon-list');
    if (!listEl) return;
    const lists = lemonListsFor(lemon.selectedDate);
    const list = lists.find(item => item.id === listEl.dataset.listId);
    if (!list) return;
    if (e.target.closest('.lemon-list-delete')) {
      if (confirm(`删除列表「${list.title}」及其中的 ${(list.items || []).length} 个事项？`)) {
        lemon.days[lemon.selectedDate].lists = lists.filter(item => item.id !== list.id);
        if (!lemon.days[lemon.selectedDate].lists.length) delete lemon.days[lemon.selectedDate];
        saveLemon(); renderLemon();
      }
      return;
    }
    const itemEl = e.target.closest('.lemon-item');
    if (!itemEl) return;
    if (e.target.closest('.lemon-item-title')) return;
    const item = (list.items || []).find(value => value.id === itemEl.dataset.itemId);
    if (!item) return;
    if (e.target.closest('.lemon-item-check')) item.done = !item.done;
    if (e.target.closest('.lemon-item-delete')) list.items = list.items.filter(value => value.id !== item.id);
    saveLemon(); renderLemon();
  });

  $('lemonLists').addEventListener('change', (e) => {
    const input = e.target.closest('.lemon-item-title');
    if (!input) return;
    const itemEl = input.closest('.lemon-item');
    const listEl = input.closest('.lemon-list');
    const list = lemonListsFor(lemon.selectedDate).find(value => value.id === listEl.dataset.listId);
    const item = list && (list.items || []).find(value => value.id === itemEl.dataset.itemId);
    if (item && input.value.trim()) { item.title = input.value.trim(); saveLemon(); renderLemon(); }
  });

  $('actionBarForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('actionBarTitleInput').value.trim();
    const start = $('actionBarStart').value;
    const end = $('actionBarEnd').value;
    if (!title || !start || !end || start > end) { alert('请填写名称，并确保结束日期不早于开始日期。'); return; }
    lemon.actionBars.push({ id: uid(), title, start, end, items: [] });
    e.target.reset(); saveLemon(); renderLemonBoard();
  });

  $('actionBars').addEventListener('submit', (e) => {
    const form = e.target.closest('.action-bar-add');
    if (!form) return;
    e.preventDefault();
    const bar = lemon.actionBars.find(value => value.id === form.closest('.action-bar').dataset.barId);
    const input = form.querySelector('input');
    if (bar && input.value.trim()) { bar.items.push({ id: uid(), title: input.value.trim(), done: false }); input.value = ''; saveLemon(); renderActionBars(); }
  });

  $('actionBars').addEventListener('click', (e) => {
    const barEl = e.target.closest('.action-bar'); if (!barEl) return;
    const bar = lemon.actionBars.find(value => value.id === barEl.dataset.barId); if (!bar) return;
    if (e.target.closest('.action-bar-delete')) { if (confirm(`删除行动栏「${bar.title}」？`)) { lemon.actionBars = lemon.actionBars.filter(value => value.id !== bar.id); saveLemon(); renderActionBars(); } return; }
    const itemEl = e.target.closest('.action-bar-item'); if (!itemEl) return;
    const item = (bar.items || []).find(value => value.id === itemEl.dataset.itemId); if (!item) return;
    if (e.target.closest('.action-bar-check')) { item.done = !item.done; saveLemon(); renderActionBars(); }
    if (e.target.closest('.action-bar-item-delete')) { bar.items = bar.items.filter(value => value.id !== item.id); saveLemon(); renderActionBars(); }
  });

  $('actionBars').addEventListener('change', (e) => {
    const input = e.target.closest('.action-bar-item-title'); if (!input) return;
    const bar = lemon.actionBars.find(value => value.id === input.closest('.action-bar').dataset.barId);
    const item = bar && bar.items.find(value => value.id === input.closest('.action-bar-item').dataset.itemId);
    if (item && input.value.trim()) { item.title = input.value.trim(); saveLemon(); }
  });

  // ---------- 今日节奏 ----------
  $('rhythmGrid').addEventListener('change', (e) => {
    const input = e.target.closest('.rhythm-check');
    if (!input) return;
    const id = input.dataset.rhythmId;
    rhythm.completed = input.checked
      ? [...new Set([...rhythm.completed, id])]
      : rhythm.completed.filter(item => item !== id);
    saveRhythm();
    renderRhythm();
  });

  $('morningStart').value = rhythm.morningStart;
  $('morningStart').addEventListener('change', (e) => {
    rhythm.morningStart = e.target.value;
    saveRhythm();
    renderRhythm();
  });

  $('rhythmToggle').addEventListener('click', () => {
    const panel = $('rhythmPanel');
    panel.classList.toggle('collapsed');
    $('rhythmToggle').textContent = panel.classList.contains('collapsed') ? '显示今日节奏' : '隐藏今日节奏';
  });

  // ---------- 操作：任务组 ----------
  // ---------- 操作：按月归档 ----------
  $('archivePanelToggle').addEventListener('click', () => {
    state.archivePanelOpen = !state.archivePanelOpen;
    save(); renderArchive();
  });

  $('archiveDoneBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const targets = [];
    for (const l of state.lists) {
      for (const t of l.tasks) {
        if (t.done) targets.push({ list: l, task: t });
      }
    }
    if (!targets.length) { alert('当前没有已完成的任务可以归档。'); return; }
    if (!confirm(`把 ${targets.length} 个已完成任务归档到对应月份文件夹？`)) return;
    for (const { list, task } of targets) archiveTask(task, list);
    for (const l of state.lists) l.tasks = l.tasks.filter(t => !t.done);
    state.archivePanelOpen = true;
    save(); renderAll();
  });

  $('archiveMonths').addEventListener('click', (e) => {
    const delBtn = e.target.closest('.archive-month-del');
    if (delBtn) {
      e.stopPropagation();
      const monthEl = delBtn.closest('.archive-month');
      const key = monthEl.dataset.month;
      const a = state.archives[key];
      if (!a) return;
      if (confirm(`删除「${a.label || monthLabel(key)}」归档及其 ${a.tasks.length} 条记录？`)) {
        delete state.archives[key];
        if (state.selectedArchive === key) state.selectedArchive = null;
        save(); renderAll();
      }
      return;
    }
    const taskEl = e.target.closest('.archive-task');
    if (taskEl) {
      e.stopPropagation();
      openArchiveModal(taskEl.dataset.month, taskEl.dataset.task);
      return;
    }
    const groupHead = e.target.closest('.archive-group-head');
    if (groupHead) {
      e.stopPropagation();
      const group = groupHead.closest('.archive-group');
      group.classList.toggle('open');
      groupHead.querySelector('.archive-group-icon').textContent = group.classList.contains('open') ? '▾' : '▸';
      return;
    }
    const head = e.target.closest('.archive-month-head');
    if (head) {
      const key = head.closest('.archive-month').dataset.month;
      const willOpen = state.archives[key] && state.archives[key].open !== true;
      for (const k of Object.keys(state.archives)) state.archives[k].open = false;
      if (state.archives[key]) state.archives[key].open = willOpen;
      state.selectedArchive = willOpen ? key : null;
      save(); renderArchive();
    }
  });

  // 归档任务详情（只读 + 恢复）
  let archiveModal = null; // { month, taskId }
  function openArchiveModal(month, taskId) {
    const a = state.archives[month];
    if (!a) return;
    const t = a.tasks.find(x => x.id === taskId);
    if (!t) return;
    archiveModal = { month, taskId };
    $('archiveModalTitle').textContent = t.title;
    const meta = [];
    meta.push(`归档月份：${a.label || monthLabel(month)}`);
    if (t.fromList) meta.push(`原任务组：${t.fromList}`);
    if (t.priority && t.priority !== 'none') meta.push(`优先级：${{ high: '高', mid: '中', low: '低' }[t.priority] || t.priority}`);
    if (t.spent) meta.push(`用时：${fmtMin(t.spent)}`);
    if (t.doneAt) meta.push(`完成于：${t.doneAt}`);
    if (t.archivedAt) meta.push(`归档于：${t.archivedAt}`);
    $('archiveModalMeta').innerHTML = meta.map(m => `<span>${escapeHtml(m)}</span>`).join('');
    const subs = t.subs || [];
    $('archiveModalSubs').innerHTML = subs.length
      ? `<h4>子任务</h4><ul>${subs.map(s => `<li class="${s.done ? 'done' : ''}">${escapeHtml(s.title)}</li>`).join('')}</ul>`
      : '';
    $('archiveModalOverlay').hidden = false;
  }

  function closeArchiveModal() {
    $('archiveModalOverlay').hidden = true;
    archiveModal = null;
  }

  $('archiveModalClose').addEventListener('click', closeArchiveModal);
  $('archiveModalOverlay').addEventListener('click', (e) => {
    if (e.target === $('archiveModalOverlay')) closeArchiveModal();
  });
  $('archiveRestoreBtn').addEventListener('click', () => {
    if (!archiveModal) return;
    const { month, taskId } = archiveModal;
    const a = state.archives[month];
    const t = a && a.tasks.find(x => x.id === taskId);
    if (!t) { closeArchiveModal(); return; }
    let target = state.lists.find(l => l.title === t.fromList) || state.lists[0];
    if (!target) {
      target = { id: uid(), title: t.fromList || 'Arbeit', category: t.fromCategory || 'work', tasks: [] };
      state.lists.push(target);
    }
    const restored = { ...structuredClone(t), done: false };
    delete restored.fromList; delete restored.fromCategory;
    delete restored.archivedAt; delete restored.doneAt;
    target.tasks.push(restored);
    a.tasks = a.tasks.filter(x => x.id !== taskId);
    if (!a.tasks.length) {
      delete state.archives[month];
      state.selectedArchive = null;
    }
    state.selectedListId = target.id;
    closeArchiveModal();
    save(); renderAll();
  });

  $('archiveDeleteBtn').addEventListener('click', () => {
    if (!archiveModal) return;
    const { month, taskId } = archiveModal;
    const a = state.archives[month];
    const t = a && a.tasks.find(x => x.id === taskId);
    if (!t) { closeArchiveModal(); return; }
    if (confirm(`彻底删除归档任务「${t.title}」？`)) {
      a.tasks = a.tasks.filter(x => x.id !== taskId);
      if (!a.tasks.length) {
        delete state.archives[month];
        state.selectedArchive = null;
      }
      closeArchiveModal();
      save(); renderAll();
    }
  });

  $('addListForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('newListTitle').value.trim();
    if (!title) return;
    const cat = $('newListCategory').value;
    const l = { id: uid(), title, category: cat, tasks: [] };
    state.lists.push(l);
    state.selectedListId = l.id;
    $('newListTitle').value = '';
    save(); renderAll();
  });

  $('filterTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-tab');
    if (!btn) return;
    state.filter = btn.dataset.filter;
    [...$('filterTabs').children].forEach(b => b.classList.toggle('active', b === btn));
    // 若当前选中不在筛选范围内，切到第一个
    const visible = filteredLists();
    if (!visible.find(l => l.id === state.selectedListId)) {
      state.selectedListId = visible[0]?.id || null;
    }
    save(); renderAll();
  });

  // ---------- 操作：任务 ----------
  $('addTaskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const l = currentList();
    if (!l) return;
    const title = $('newTaskTitle').value.trim();
    if (!title) return;
    l.tasks.push({
      id: uid(), title, done: false,
      priority: $('newTaskPriority').value,
      estimate: parseInt($('newTaskEstimate').value) || 0,
      spent: 0, due: '', subs: [],
    });
    $('newTaskTitle').value = '';
    $('newTaskEstimate').value = '';
    save(); renderAll();
  });

  function toggleDone(t) {
    t.done = !t.done;
    if (t.done) {
      t.doneAt = todayKey();
      // 子任务全部标记完成
      t.subs.forEach(s => s.done = true);
      state.today.doneCount++;
    } else {
      delete t.doneAt;
      state.today.doneCount = Math.max(0, state.today.doneCount - 1);
    }
    save(); renderAll();
  }

  // ---------- 弹层：任务详情 ----------
  let modalTaskId = null;

  function openModal(taskId) {
    const found = findTask(taskId);
    if (!found) return;
    modalTaskId = taskId;
    const t = found.task;
    $('modalTitle').value = t.title;
    $('modalPriority').value = t.priority;
    $('modalEstimate').value = t.estimate || '';
    $('modalDue').value = t.due || '';
    $('modalSpent').textContent = fmtMin(t.spent);
    const tbtn = $('modalTimerToggle');
    tbtn.classList.remove('timing');
    tbtn.textContent = '▶ 计时';
    renderSubtasks(t);
    $('modalOverlay').hidden = false;
    $('modalTitle').focus();
  }

  function renderSubtasks(t) {
    const ul = $('modalSubtasks');
    ul.innerHTML = '';
    t.subs.forEach(s => {
      const li = document.createElement('li');
      li.className = 'subtask-item' + (s.done ? ' done' : '');
      li.innerHTML = `
        <input type="checkbox" class="subtask-check" ${s.done ? 'checked' : ''}>
        <span>${escapeHtml(s.title)}</span>
        <button class="subtask-del" title="删除">×</button>`;
      li.querySelector('.subtask-check').addEventListener('change', () => {
        s.done = !s.done; save(); renderSubtasks(t); renderTasks();
      });
      li.querySelector('.subtask-del').addEventListener('click', () => {
        t.subs = t.subs.filter(x => x.id !== s.id); save(); renderSubtasks(t); renderTasks();
      });
      ul.appendChild(li);
    });
  }

  $('addSubtaskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const found = findTask(modalTaskId);
    if (!found) return;
    const title = $('newSubtaskTitle').value.trim();
    if (!title) return;
    found.task.subs.push({ id: uid(), title, done: false });
    $('newSubtaskTitle').value = '';
    save(); renderSubtasks(found.task); renderTasks();
  });

  $('modalSave').addEventListener('click', () => {
    const found = findTask(modalTaskId);
    if (!found) return;
    const t = found.task;
    t.title = $('modalTitle').value.trim() || t.title;
    t.priority = $('modalPriority').value;
    t.estimate = parseInt($('modalEstimate').value) || 0;
    t.due = $('modalDue').value;
    save(); closeModal(); renderAll();
  });

  $('modalDelete').addEventListener('click', () => {
    const found = findTask(modalTaskId);
    if (!found) return;
    if (confirm(`删除任务「${found.task.title}」？`)) {
      found.list.tasks = found.list.tasks.filter(x => x.id !== modalTaskId);
      if (state.pomo.taskId === modalTaskId) stopTimer(true);
      save(); closeModal(); renderAll();
    }
  });

  // 单个任务手动归档：默认归档到完成月份（未完成则归档到当前月）
  $('modalArchive').addEventListener('click', () => {
    const found = findTask(modalTaskId);
    if (!found) return;
    const { list, task } = found;
    if (!task.doneAt) task.doneAt = todayKey();
    const key = monthKeyOfTask(task);
    if (!confirm(`把「${task.title}」归档到「${monthLabel(key)}」文件夹？`)) return;
    archiveTask(task, list);
    list.tasks = list.tasks.filter(x => x.id !== task.id);
    state.archivePanelOpen = true;
    if (state.pomo.taskId === task.id) stopTimer(true);
    closeModal(); save(); renderAll();
  });

  $('modalClose').addEventListener('click', closeModal);
  $('modalOverlay').addEventListener('click', (e) => {
    if (e.target === $('modalOverlay')) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('modalOverlay').hidden) closeModal();
    if (e.key === 'Escape' && !$('archiveModalOverlay').hidden) closeArchiveModal();
  });

  function closeModal() {
    stopTaskTimer();
    $('modalOverlay').hidden = true;
    modalTaskId = null;
  }

  // ---------- 手动记录任务用时 ----------
  // 给某个任务累加分钟数，并同步计入今日专注与分类分布（与番茄钟口径一致）
  function addSpent(task, list, mins) {
    if (!mins) return;
    task.spent = Math.max(0, (task.spent || 0) + mins);
    if (mins > 0) {
      state.today.focusMin += mins;
      const cat = list.category;
      if (cat) state.today.dist[cat] = (state.today.dist[cat] || 0) + mins;
    }
  }

  // 快捷按钮 +5 / +15 / +30 分钟
  $('modalOverlay').addEventListener('click', (e) => {
    const btn = e.target.closest('.time-btn[data-add]');
    if (!btn) return;
    const found = findTask(modalTaskId);
    if (!found) return;
    addSpent(found.task, found.list, parseInt(btn.dataset.add) || 0);
    $('modalSpent').textContent = fmtMin(found.task.spent);
    save(); renderTasks(); renderSummary(); renderDist();
  });

  // 实时计时开关：按下开始累计，再次按下把用时写入任务
  let taskTimer = null;      // setInterval 句柄
  let taskTimerStart = 0;    // 开始时间戳
  let taskTimerId = null;    // 正在计时的任务 id

  function startTaskTimer() {
    if (!modalTaskId) return;
    taskTimerId = modalTaskId;
    taskTimerStart = Date.now();
    const baseSpent = (findTask(modalTaskId)?.task.spent) || 0;
    const btn = $('modalTimerToggle');
    btn.classList.add('timing');
    taskTimer = setInterval(() => {
      const elapsed = (Date.now() - taskTimerStart) / 60000; // 分钟
      btn.textContent = `⏹ 停止 ${fmtMin(baseSpent + elapsed)}`;
      $('modalSpent').textContent = fmtMin(baseSpent + elapsed);
    }, 1000);
    btn.textContent = '⏹ 停止 ' + fmtMin(baseSpent);
  }

  function stopTaskTimer() {
    if (!taskTimer) return;
    clearInterval(taskTimer);
    taskTimer = null;
    const found = taskTimerId && findTask(taskTimerId);
    const elapsedMin = Math.round((Date.now() - taskTimerStart) / 60000);
    if (found && elapsedMin > 0) {
      addSpent(found.task, found.list, elapsedMin);
    }
    taskTimerId = null;
    const btn = $('modalTimerToggle');
    if (btn) { btn.classList.remove('timing'); btn.textContent = '▶ 计时'; }
    save(); renderTasks(); renderSummary(); renderDist();
    const cur = findTask(modalTaskId);
    if (cur) $('modalSpent').textContent = fmtMin(cur.task.spent);
  }

  $('modalTimerToggle').addEventListener('click', () => {
    if (taskTimer) stopTaskTimer();
    else startTaskTimer();
  });

  // ---------- 番茄钟 ----------
  let ticker = null;

  function phaseSeconds(phase) {
    const s = state.settings;
    if (phase === 'work') return s.work * 60;
    if (phase === 'longBreak') return s.longBreak * 60;
    return s.brk * 60;
  }

  function startFocusOn(taskId) {
    state.pomo.taskId = taskId;
    if (state.pomo.phase !== 'work') {
      state.pomo.phase = 'work';
      state.pomo.remaining = phaseSeconds('work');
    }
    if (!state.pomo.running) toggleRun();
    else renderAll();
  }

  function toggleRun() {
    const p = state.pomo;
    if (p.running) {
      stopTimer(false);
    } else {
      p.running = true;
      p.lastTick = Date.now();
      ticker = setInterval(tick, 250);
      document.title = '▶ 工作台 · 节奏';
    }
    save(); renderAll();
  }

  function stopTimer(resetTitle) {
    state.pomo.running = false;
    if (ticker) { clearInterval(ticker); ticker = null; }
    if (resetTitle !== false) document.title = '工作台 · 节奏';
  }

  function tick() {
    const p = state.pomo;
    const now = Date.now();
    const delta = (now - p.lastTick) / 1000;
    p.lastTick = now;
    p.remaining -= delta;
    if (p.remaining <= 0) {
      p.remaining = 0;
      finishPhase();
    }
    renderPomo();
  }

  function finishPhase() {
    stopTimer(true);
    playDing();
    if (pomo_phase_isWork()) {
      // 专注完成：计入统计
      const mins = state.settings.work;
      state.today.focusMin += mins;
      state.today.pomodoroCount++;
      state.pomo.completed++;
      const cat = currentTaskCategory();
      if (cat) state.today.dist[cat] = (state.today.dist[cat] || 0) + mins;
      const found = state.pomo.taskId && findTask(state.pomo.taskId);
      if (found) found.task.spent += mins;
      // 决定下一个休息类型
      state.pomo.phase = (state.pomo.completed % state.settings.longEvery === 0) ? 'longBreak' : 'brk';
    } else {
      state.pomo.phase = 'work';
    }
    state.pomo.remaining = phaseSeconds(state.pomo.phase);
    state.pomo.running = false;
    notifyPhase();
    save(); renderAll();
  }

  function pomo_phase_isWork() { return state.pomo.phase === 'work'; }
  function currentTaskCategory() {
    const found = state.pomo.taskId && findTask(state.pomo.taskId);
    return found ? found.list.category : null;
  }

  function notifyPhase() {
    const isBreak = state.pomo.phase !== 'work';
    const msg = isBreak ? '专注完成，休息一下！' : '休息结束，继续专注吧。';
    if (Notification && Notification.permission === 'granted') {
      try { new Notification('工作台 · 节奏', { body: msg }); } catch {}
    }
  }

  function playDing() {
    // 用 Web Audio 合成一声轻提示音，不依赖外部音频文件
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      o.start(); o.stop(ctx.currentTime + 0.6);
    } catch {}
  }

  $('pomoStart').addEventListener('click', toggleRun);
  $('pomoReset').addEventListener('click', () => {
    stopTimer(true);
    state.pomo.remaining = phaseSeconds(state.pomo.phase);
    save(); renderAll();
  });
  $('pomoSkip').addEventListener('click', () => {
    stopTimer(true);
    state.pomo.remaining = 0;
    finishPhase();
  });

  // ---------- 设置 ----------
  function bindSetting(id, key, lo, hi) {
    const el = $(id);
    el.value = state.settings[key];
    el.addEventListener('change', () => {
      let v = parseInt(el.value) || lo;
      v = clamp(v, lo, hi);
      state.settings[key] = v;
      el.value = v;
      // 若当前阶段时长被改且未运行，刷新倒计时
      if (!state.pomo.running) {
        state.pomo.remaining = phaseSeconds(state.pomo.phase);
      }
      save(); renderPomo();
    });
  }
  bindSetting('setWork', 'work', 1, 90);
  bindSetting('setBreak', 'brk', 1, 30);
  bindSetting('setLongBreak', 'longBreak', 1, 60);
  bindSetting('setLongEvery', 'longEvery', 2, 8);

  // ---------- 通知授权 ----------
  if (window.Notification && Notification.permission === 'default') {
    // 不强制弹窗，用户首次开始番茄钟时再静默请求
    $('pomoStart').addEventListener('click', () => {
      if (Notification.permission === 'default') Notification.requestPermission();
    }, { once: true });
  }

  // ---------- HTML 转义 ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  // ---------- 跨天自动重置（页面常开时） ----------
  setInterval(() => {
    if (state.today.date !== todayKey()) {
      state.today = { date: todayKey(), focusMin: 0, doneCount: 0, pomodoroCount: 0, dist: { work: 0, study: 0, other: 0 } };
      state.pomo.completed = 0;
      save(); renderAll();
    }
  }, 60000);

  // ---------- 启动 ----------
  $('morningStart').value = rhythm.morningStart;
  renderAll();
  switchPage(lemon.activePage);
})();
