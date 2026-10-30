/* 资料库：资料与学习要点由同源 API 持久保存，不写入 localStorage。 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const kindNames = { article: '文章', book: '书籍', course: '课程', note: '笔记' };
  const heroNames = { study: '学习库', ideas: '闪念库', methods: '做事方法库' };
  let entries = [], selectedId = null, section = 'study', filter = 'all', query = '', loaded = false, page = 1, total = 0, generation = 0;
  let pendingFile = null;
  let noteBlocks = '', noteAnnotations = [], penColor = '#f03e3e', drawing = false;
  const sections = {
    study: { title: '学习库' },
    ideas: { title: '闪念库' },
    methods: { title: '做事方法库' },
  };
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
    $('libraryDelete').hidden = !entry;
    $('libraryTitle').value = entry?.title || '';
    $('libraryKind').value = entry?.kind || 'article';
    $('libraryUrl').value = entry?.source_url || '';
    $('libraryTags').value = entry?.tags || '';
    $('libraryBody').value = entry?.body || '';
    $('libraryHighlights').value = entry?.highlights || '';
    $('libraryUpdated').textContent = entry ? `最近更新：${new Date(entry.updated_at).toLocaleString('zh-CN')}` : '';
    pendingFile = null; $('libraryFile').value = '';
    $('libraryAttachmentName').dataset.existing = entry?.file_name || '';
    $('libraryAttachmentName').textContent = entry?.file_name || '未选择文件';
    $('libraryDownload').hidden = !entry?.file_id;
    $('libraryCanvasDownload').hidden = !entry?.file_id;
    $('libraryPreview').hidden = !entry?.file_id;
    if (entry?.file_id) {
      const url = `/api/library/${entry.id}/file`, type = (entry.file_name || '').toLowerCase();
      const image = /\.(png|jpe?g|webp)$/.test(type), supported = /\.(pdf|png|jpe?g|webp|txt|md)$/.test(type);
      $('libraryPreviewFrame').hidden = image || !supported; $('libraryPreviewImage').hidden = !image; $('libraryPreviewEmpty').hidden = supported;
      $('libraryPreviewEmpty').textContent = '此格式暂不支持站内预览，可下载原文件。';
      if (image) $('libraryPreviewImage').src = url; else if (supported) $('libraryPreviewFrame').src = url;
    } else { $('libraryPreviewFrame').removeAttribute('src'); $('libraryPreviewImage').removeAttribute('src'); $('libraryPreviewEmpty').hidden = false; }
    loadNotes(entry?.id);
    renderList();
  }
  async function loadNotes(id) {
    noteBlocks = ''; noteAnnotations = [];
    const editor = $('libraryBlockEditor'); if (!editor) return;
    if (!id) { editor.innerHTML = ''; return; }
    try { const data = await request('/' + id + '/notes'); noteBlocks = data.note?.blocks_json || ''; noteAnnotations = JSON.parse(data.note?.annotations_json || '[]'); editor.innerHTML = noteBlocks || escapeHtml($('libraryBody').value || ''); $('libraryCanvasEditor').innerHTML = editor.innerHTML; restoreCanvas(); }
    catch { editor.innerHTML = escapeHtml($('libraryBody').value || ''); }
  }
  function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML.replace(/\n/g, '<br>'); }
  async function saveNotes() {
    if (!selectedId) return; noteBlocks = $('libraryBlockEditor').innerHTML; $('libraryBody').value = $('libraryBlockEditor').innerText;
    await request('/' + selectedId + '/notes', { method: 'PUT', body: JSON.stringify({ blocks_json: noteBlocks, annotations_json: JSON.stringify(noteAnnotations) }) });
  }
  function switchSection(next) {
    if (!sections[next]) return;
    section = next; selectedId = null; page = 1;
    const info = sections[next];
    $('librarySections').querySelectorAll('[data-section]').forEach(button => {
      const active = button.dataset.section === next;
      button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active));
    });
    $('libraryHeroTitle').textContent = info.title;
    $('libraryForm').hidden = true; $('libraryBlank').hidden = false;
    $('libraryFilter').hidden = next !== 'study';
    $('libraryKindField').hidden = next !== 'study';
    $('libraryUrlField').hidden = next !== 'study';
    $('libraryAi').hidden = next !== 'study';
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
  $('libraryFile').addEventListener('change', event => {
    pendingFile = event.target.files?.[0] || null;
    $('libraryAttachmentName').textContent = pendingFile ? pendingFile.name : $('libraryAttachmentName').dataset.existing || '未选择文件';
  });
  function openFileModal() {
    if (!selectedId) return;
    const name = ($('libraryAttachmentName').textContent || '').toLowerCase();
    const url = `/api/library/${selectedId}/file`;
    const image = /\.(png|jpe?g|webp)$/.test(name);
    const text = /\.(txt|md)$/.test(name);
    const supported = /\.(pdf|png|jpe?g|webp|txt|md)$/.test(name);
    $('libraryCanvasTitle').textContent = $('libraryAttachmentName').textContent || '资料展开';
    $('libraryCanvasFileFrame').hidden = image || text || !supported; $('libraryCanvasFileImage').hidden = !image; $('libraryCanvasFileText').hidden = !text; $('libraryFileStatus').hidden = supported;
    $('libraryFileStatus').textContent = '此格式暂不支持站内预览，请下载原文件。PDF、图片、TXT 和 Markdown 可直接展开。';
    if (image) $('libraryCanvasFileImage').src = url; else if (text) {
      const id = selectedId; $('libraryCanvasFileText').textContent = '正在加载…';
      fetch(url).then(async r => { if (!r.ok) throw new Error('读取附件失败'); return r.text(); }).then(value => { if (selectedId === id) $('libraryCanvasFileText').textContent = value; }).catch(error => { if (selectedId === id) $('libraryCanvasFileText').textContent = error.message; });
    } else if (supported) $('libraryCanvasFileFrame').src = url;
    $('libraryFileModal').hidden = false;
  }
  $('libraryDownload').addEventListener('click', () => { if (selectedId) window.open(`/api/library/${selectedId}/file?download=1`, '_blank'); });
  $('libraryCanvasDownload').addEventListener('click', () => { if (selectedId) window.open(`/api/library/${selectedId}/file?download=1`, '_blank'); });
  $('libraryExpandPreview').addEventListener('click', openFileModal);
  $('libraryFileClose').addEventListener('click', () => { $('libraryFileModal').hidden = true; });
  function addWindowControls(modal, button) {
    const dialog = modal.querySelector('.library-canvas-dialog');
    button.title = '最大化或还原窗口；可拖动窗口右下角调整大小';
    function toggleSize() {
      const maximize = !modal.classList.contains('is-maximized');
      if (maximize) { dialog.dataset.width = dialog.style.width; dialog.dataset.height = dialog.style.height; dialog.style.width = ''; dialog.style.height = ''; }
      else { dialog.style.width = dialog.dataset.width || ''; dialog.style.height = dialog.dataset.height || ''; }
      modal.classList.toggle('is-maximized', maximize);
      button.textContent = maximize ? '还原窗口' : '最大化'; button.setAttribute('aria-pressed', String(maximize));
    }
    button.setAttribute('aria-pressed', 'false'); button.addEventListener('click', toggleSize);
    modal.querySelector('.library-canvas-head').addEventListener('dblclick', event => { if (!event.target.closest('button,input,a')) toggleSize(); });
  }
  addWindowControls($('libraryFileModal'), $('libraryCanvasMaximize'));
  const textMaximize = document.createElement('button'); textMaximize.type = 'button'; textMaximize.textContent = '最大化';
  $('libraryCanvasClose').before(textMaximize); addWindowControls($('libraryCanvasModal'), textMaximize);
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
      body: $('libraryBlockEditor').innerText, highlights: $('libraryHighlights').value };
    if (!payload.title) return;
    const save = $('libraryForm').querySelector('[type="submit"]'); save.disabled = true;
    try {
      const data = await request(selectedId ? '/' + selectedId : '', { method: selectedId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      selectedId = data.item.id; await uploadAttachment(data.item.id); await saveNotes();
      const saved = await request('/' + data.item.id); show(saved.item); await reload(); notice('已保存。');
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
  async function uploadAttachment(id) {
    if (!pendingFile) return;
    const response = await fetch(`/api/library/${id}/file`, { method: 'POST', body: pendingFile, headers: {
      'Content-Type': pendingFile.type || 'application/octet-stream',
      'X-File-Name': btoa(unescape(encodeURIComponent(pendingFile.name))),
    } });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || '附件保存失败'); }
  }
  $('libraryBlockEditor').addEventListener('input', () => { $('libraryBody').value = $('libraryBlockEditor').innerText; });
  document.querySelector('.library-editor-toolbar')?.addEventListener('click', event => { const button = event.target.closest('[data-block]'); if (!button) return; document.execCommand('formatBlock', false, button.dataset.block === 'p' ? 'P' : button.dataset.block === 'h2' ? 'H2' : button.dataset.block === 'blockquote' ? 'BLOCKQUOTE' : button.dataset.block === 'pre' ? 'PRE' : button.dataset.block === 'ul' ? 'UL' : 'OL'); $('libraryBlockEditor').focus(); });
  $('libraryInsertTable')?.addEventListener('click', () => { document.execCommand('insertHTML', false, '<table><tbody><tr><td>单元格</td><td>单元格</td></tr><tr><td>单元格</td><td>单元格</td></tr></tbody></table><p><br></p>'); });
  $('libraryInsertTodo')?.addEventListener('click', () => { document.execCommand('insertHTML', false, '<p>☐ 待办事项</p>'); });
  const expandText = document.createElement('button'); expandText.type = 'button'; expandText.textContent = '展开正文';
  document.querySelector('.library-editor-toolbar').appendChild(expandText);
  expandText.addEventListener('click', () => { if (!selectedId) return; $('libraryCanvasEditor').innerHTML = $('libraryBlockEditor').innerHTML; $('libraryCanvasModal').hidden = false; $('libraryCanvasEditor').focus(); });
  $('libraryCanvasClose')?.addEventListener('click', () => { $('libraryCanvasModal').hidden = true; });
  document.querySelectorAll('[data-highlight]').forEach(button => button.addEventListener('click', () => { document.execCommand('hiliteColor', false, button.dataset.highlight); $('libraryCanvasEditor').focus(); }));
  document.querySelectorAll('[data-ink]').forEach(button => button.addEventListener('click', () => { document.execCommand('foreColor', false, button.dataset.ink); $('libraryCanvasEditor').focus(); }));
  $('libraryLinkInsert')?.addEventListener('click', () => { const url = prompt('输入链接地址（https://…）'); if (!url) return; document.execCommand('createLink', false, url); $('libraryCanvasEditor').focus(); });
  $('libraryCanvasEditor')?.addEventListener('input', async () => { $('libraryBlockEditor').innerHTML = $('libraryCanvasEditor').innerHTML; $('libraryBody').value = $('libraryCanvasEditor').innerText; try { await saveNotes(); } catch {} });
  const canvas = $('libraryCanvas'), ctx = canvas?.getContext('2d');
  function resizeCanvas() { if (!canvas) return; const box = canvas.getBoundingClientRect(); canvas.width = box.width * devicePixelRatio; canvas.height = box.height * devicePixelRatio; ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); }
  function point(event) { const box = canvas.getBoundingClientRect(); return { x: event.clientX - box.left, y: event.clientY - box.top }; }
  function restoreCanvas() { if (!canvas || !ctx) return; ctx.clearRect(0, 0, canvas.width, canvas.height); for (const stroke of noteAnnotations) { ctx.beginPath(); ctx.strokeStyle = stroke.color; ctx.lineWidth = stroke.size; ctx.lineCap = 'round'; stroke.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); } }
  canvas?.addEventListener('pointerdown', event => { drawing = true; const p = point(event); noteAnnotations.push({ color: penColor, size: Number($('libraryPenSize').value), points: [p] }); canvas.setPointerCapture(event.pointerId); });
  canvas?.addEventListener('pointermove', event => { if (!drawing) return; const stroke = noteAnnotations.at(-1), p = point(event); stroke.points.push(p); restoreCanvas(); });
  canvas?.addEventListener('pointerup', async () => { if (!drawing) return; drawing = false; try { await saveNotes(); } catch { notice('标记已保留在当前页面，网络恢复后可再次保存。', true); } });
  $('libraryCanvasClear')?.addEventListener('click', async () => { $('libraryCanvasEditor').innerHTML = ''; $('libraryBlockEditor').innerHTML = ''; try { await saveNotes(); } catch {} });
})();
