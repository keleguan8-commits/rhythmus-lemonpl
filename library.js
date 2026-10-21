/* 资料库：资料与学习要点由同源 API 持久保存，不写入 localStorage。 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const kindNames = { article: '文章', book: '书籍', course: '课程', note: '笔记' };
  const sections = {
    study: { eyebrow: 'LEARNING LIBRARY', title: '从资料，到自己的理解。', text: '收录原文 · 提炼重点 · 定期回看', create: '＋ 收录资料', empty: '从一篇值得记住的资料开始', blank: '选择左侧的资料，或者新建一份资料。', body: '资料正文 / 摘录', points: '我的学习要点' },
    ideas: { eyebrow: 'SPARK LIBRARY', title: '灵感稍纵即逝，把它留下。', text: '随手捕捉 · 慢慢延展 · 等待连接', create: '＋ 记下闪念', empty: '记下第一个闪念', blank: '一个问题、一个联想，或一个突然冒出的念头。', body: '闪念内容', points: '后续延展' },
    methods: { eyebrow: 'METHOD LIBRARY', title: '把做过的事，变成下一次的办法。', text: '记录场景 · 梳理步骤 · 复盘迭代', create: '＋ 沉淀方法', empty: '写下第一套做事方法', blank: '把有效的流程、判断原则和复盘记录整理起来。', body: '适用场景 / 方法步骤', points: '实践反馈 / 改进点' },
  };
  let entries = [], selectedId = null, section = 'study', filter = 'all', query = '', loaded = false, page = 1, total = 0, generation = 0;
  const pageSize = 30;

  function notice(message, error = false) {
    const el = $('libraryNotice');
    el.textContent = message; el.hidden = false; el.classList.toggle('is-error', error);
  }
  async function request(path, options = {}) {
    const response = await fetch('/api/library' + path, {
      ...options, headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '服务暂时不可用，请稍后重试');
    return data;
  }
  function renderList() {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    $('libraryCount').textContent = `${total} 条记录`;
    $('libraryPageLabel').textContent = `${page} / ${pages}`;
    $('libraryPrev').disabled = page <= 1;
    $('libraryNext').disabled = page >= pages;
    const box = $('libraryList'); box.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('p'); empty.className = 'library-list-empty';
      empty.textContent = query || total ? '没有找到匹配内容' : '这里还是空的，点击上方添加。';
      box.appendChild(empty); return;
    }
    for (const entry of entries) {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'library-item' + (selectedId === entry.id ? ' active' : '');
      const type = document.createElement('span'); type.className = 'library-item-type'; type.textContent = section === 'study' ? kindNames[entry.kind] || '资料' : section === 'ideas' ? '闪念' : '方法';
      const title = document.createElement('strong'); title.textContent = entry.title;
      const meta = document.createElement('small'); meta.textContent = [entry.tags, entry.updated_at?.slice(0, 10)].filter(Boolean).join(' · ');
      button.append(type, title, meta); button.addEventListener('click', async () => {
        try { const data = await request('/' + entry.id); show(data.item); }
        catch (error) { notice(error.message, true); }
      }); box.appendChild(button);
    }
  }
  function show(entry) {
    selectedId = entry?.id || null;
    $('libraryBlank').hidden = true; $('libraryForm').hidden = false;
    $('libraryFormEyebrow').textContent = entry ? 'STUDY MATERIAL' : 'NEW MATERIAL';
    $('libraryFormHeading').textContent = entry ? (section === 'study' ? '阅读与整理' : section === 'ideas' ? '回看闪念' : '实践与复盘') : (section === 'study' ? '新资料' : section === 'ideas' ? '新闪念' : '新方法');
    $('libraryDelete').hidden = !entry;
    $('libraryTitle').value = entry?.title || '';
    $('libraryKind').value = entry?.kind || 'article';
    $('libraryUrl').value = entry?.source_url || '';
    $('libraryTags').value = entry?.tags || '';
    $('libraryBody').value = entry?.body || '';
    $('libraryHighlights').value = entry?.highlights || '';
    $('libraryUpdated').textContent = entry ? `最近更新：${new Date(entry.updated_at).toLocaleString('zh-CN')}` : '创建后可随时回来补充。';
    renderList();
  }
  function switchSection(next) {
    if (!sections[next]) return;
    section = next; selectedId = null; page = 1;
    const info = sections[next];
    $('librarySections').querySelectorAll('[data-section]').forEach(button => {
      const active = button.dataset.section === next;
      button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active));
    });
    $('libraryHeroEyebrow').textContent = info.eyebrow;
    $('libraryHeroTitle').textContent = info.title;
    $('libraryHeroText').textContent = info.text;
    $('libraryCreate').textContent = info.create;
    $('libraryBlankTitle').textContent = info.empty;
    $('libraryBlankText').textContent = info.blank;
    $('libraryForm').hidden = true; $('libraryBlank').hidden = false;
    $('libraryFilter').hidden = next !== 'study';
    $('libraryKindField').hidden = next !== 'study';
    $('libraryUrlField').hidden = next !== 'study';
    $('libraryAi').hidden = next !== 'study';
    document.querySelector('.library-body-label').textContent = info.body;
    document.querySelector('.library-points-label').textContent = info.points;
    $('libraryBodyHint').textContent = next === 'study' ? '保留重要原文，方便核对' : next === 'ideas' ? '一句话也值得收藏' : '写清场景、步骤与判断条件';
    $('libraryPointsHint').textContent = next === 'study' ? '总结、疑问、实践线索' : next === 'ideas' ? '相关线索与下一步' : '哪里奏效，哪里需要调整';
    $('libraryBody').placeholder = next === 'study' ? '粘贴文章、书摘或课程文字；此版本暂不上传文件。' : next === 'ideas' ? '刚刚想到什么？' : '这套方法解决什么问题？具体怎么做？';
    $('libraryHighlights').placeholder = next === 'study' ? '写下关键概念、结论和想继续追问的问题…' : next === 'ideas' ? '后续想到的新线索、待验证的问题…' : '实践结果、局限和下一次怎么改进…';
    reload();
  }
  async function reload() {
    const current = ++generation;
    try {
      const params = new URLSearchParams({ section, kind: filter, q: query, page: String(page) });
      const data = await request('?' + params); if (current !== generation) return;
      entries = data.items; total = data.total; loaded = true;
      renderList();
    } catch (error) { notice(`资料库暂不可用：${error.message}`, true); $('libraryCount').textContent = '加载失败'; }
  }
  window.addEventListener('library:open', () => { if (!loaded) reload(); });
  $('librarySections').addEventListener('click', event => {
    const button = event.target.closest('[data-section]');
    if (button) switchSection(button.dataset.section);
  });
  $('libraryCreate').addEventListener('click', () => { show(null); $('libraryTitle').focus(); });
  let searchTimer;
  $('librarySearch').addEventListener('input', event => { query = event.target.value.trim(); page = 1; clearTimeout(searchTimer); searchTimer = setTimeout(reload, 250); });
  $('libraryPrev').addEventListener('click', () => { page--; reload(); });
  $('libraryNext').addEventListener('click', () => { page++; reload(); });
  $('libraryFilter').addEventListener('click', event => {
    const button = event.target.closest('[data-kind]'); if (!button) return;
    filter = button.dataset.kind; page = 1;
    $('libraryFilter').querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
    reload();
  });
  $('libraryForm').addEventListener('submit', async event => {
    event.preventDefault();
    const payload = { title: $('libraryTitle').value.trim(), kind: section === 'study' ? $('libraryKind').value : 'note', section,
      source_url: $('libraryUrl').value.trim(), tags: $('libraryTags').value.trim(),
      body: $('libraryBody').value, highlights: $('libraryHighlights').value };
    if (!payload.title) return;
    const save = $('libraryForm').querySelector('[type="submit"]'); save.disabled = true;
    try {
      const data = await request(selectedId ? '/' + selectedId : '', { method: selectedId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      selectedId = data.item.id; show(data.item); await reload(); notice('内容已保存到数据库。');
    } catch (error) { notice(error.message, true); } finally { save.disabled = false; }
  });
  $('libraryDelete').addEventListener('click', async () => {
    if (!selectedId || !confirm(`确定删除「${$('libraryTitle').value}」？删除后无法恢复。`)) return;
    try { await request('/' + selectedId, { method: 'DELETE' }); selectedId = null;
      $('libraryForm').hidden = true; $('libraryBlank').hidden = false; await reload(); notice('资料已删除。');
    } catch (error) { notice(error.message, true); }
  });
  $('libraryCopyPrompt').addEventListener('click', async () => {
    const body = $('libraryBody').value.trim();
    if (!body) { notice('请先粘贴资料正文，再复制提炼指令。', true); return; }
    const prompt = `请仅依据以下资料提炼学习要点，不补造事实。按“核心观点、关键概念、重要依据或例子、待核实问题、我的行动”五部分输出；每条要点尽量附对应原文短句以便核验。如资料不足，请明确指出。\n\n标题：${$('libraryTitle').value.trim()}\n\n资料：\n${body}`;
    try { await navigator.clipboard.writeText(prompt); notice('提炼指令已复制，可粘贴到 AI 助手，核对结果后保存到学习要点。'); }
    catch { notice('复制失败；请检查浏览器剪贴板权限。', true); }
  });
})();
