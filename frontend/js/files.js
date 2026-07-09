// Tree-Liste, Single-/Bulk-Aktionen, Inline-Rename, Suche, Keyboard,
// Cut/Paste-Move, internes Drag-Drop, "Pfad kopieren". refresh() ist der
// zentrale Re-Render-Einstieg, von SSE, Sidebar-Toggle, Upload, Rename
// und Delete aufgerufen.

import * as api from './api.js';
import { fmtSize, fmtTime } from './format.js';
import { iconFor } from './icons.js';
import { confirmModal, promptModal } from './modals.js';
import * as selection from './selection.js';
import { openMenu, openContextMenu, openBulkContextMenu, openEmptyContextMenu } from './menu.js';
import { toast } from './toast.js';

const SPRITE = '/icons/sprite.svg';
const ico = (id, size = 14) =>
  `<svg class="icon" width="${size}" height="${size}" aria-hidden="true"><use href="${SPRITE}#${id}"/></svg>`;

const DRAG_MIME = 'application/x-agentbox-paths';

let listEl, statusEl, searchInput, searchClearBtn;
let entries = [];
const expanded = new Set();
let searchQuery = '';
let visibleItems = [];   // [{ item, depth, hint? }, ...]
let activeIndex = -1;    // Index in visibleItems, Keyboard-Fokus
let editingPath = null;  // Pfad mit aktiver Inline-Rename
let cutPaths = [];       // Pfade, die per Cut markiert wurden (für Paste)

// ---- Tree-Walking ---------------------------------------------------------

function flattenAll(items, out = []) {
  for (const item of items) {
    out.push(item);
    if (item.type === 'dir') flattenAll(item.children || [], out);
  }
  return out;
}

function findEntry(path) {
  return flattenAll(entries).find(e => e.path === path) || null;
}

function parentPath(path) {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

function countEntries(items) {
  let files = 0, dirs = 0, size = 0;
  for (const item of items) {
    if (item.type === 'dir') {
      dirs++;
      const c = countEntries(item.children || []);
      files += c.files;
      dirs += c.dirs;
      size += c.size;
    } else {
      files++;
      size += item.size || 0;
    }
  }
  return { files, dirs, size };
}

// ---- Sichtbare-Items-Aufbau ----------------------------------------------

function buildTreeVisible(items, depth, out) {
  for (const item of items) {
    out.push({ item, depth });
    if (item.type === 'dir' && expanded.has(item.path)) {
      buildTreeVisible(item.children || [], depth + 1, out);
    }
  }
  return out;
}

// Bei aktiver Suche zeigen wir eine flache, sortierte Treffer-Liste mit Pfad-
// Hint. Verzeichnisse zählen ebenfalls als Treffer.
function buildSearchResults(query, items, out, parentDir) {
  const q = query.toLowerCase();
  for (const item of items) {
    const dir = parentDir || '';
    if (item.name.toLowerCase().includes(q)) {
      out.push({ item, depth: 0, hint: dir });
    }
    if (item.type === 'dir') {
      const childParent = dir ? `${dir}/${item.name}` : item.name;
      buildSearchResults(query, item.children || [], out, childParent);
    }
  }
  return out;
}

function rebuildVisible() {
  visibleItems = searchQuery
    ? buildSearchResults(searchQuery, entries, [], '')
    : buildTreeVisible(entries, 0, []);
  if (activeIndex >= visibleItems.length) activeIndex = visibleItems.length - 1;
}

function visiblePaths() {
  return visibleItems.map(v => v.item.path);
}

// ---- Highlight für Such-Treffer -------------------------------------------

function escapeHTML(s) {
  return s.replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function highlightName(name, query) {
  if (!query) return escapeHTML(name);
  const lower = name.toLowerCase();
  const q = query.toLowerCase();
  const i = lower.indexOf(q);
  if (i < 0) return escapeHTML(name);
  return (
    escapeHTML(name.slice(0, i)) +
    '<mark>' + escapeHTML(name.slice(i, i + q.length)) + '</mark>' +
    escapeHTML(name.slice(i + q.length))
  );
}

// ---- Row-Render -----------------------------------------------------------

function renderRow(entry, index, depth, hint) {
  const item = entry;
  const row = document.createElement('div');
  row.className = 'file-row';
  row.style.setProperty('--depth', depth);
  row.dataset.path = item.path;
  row.dataset.type = item.type;
  row.dataset.index = String(index);
  row.setAttribute('role', 'treeitem');
  row.setAttribute('aria-level', String(depth + 1));
  if (item.type === 'dir') row.setAttribute('aria-expanded', expanded.has(item.path) ? 'true' : 'false');
  if (selection.has(item.path)) row.classList.add('selected');
  if (cutPaths.includes(item.path)) row.classList.add('cut');
  if (index === activeIndex) {
    row.classList.add('active');
    row.setAttribute('aria-selected', 'true');
  }
  row.draggable = true;

  // Twist (Chevron für Folder, unsichtbarer Spacer für Files)
  const twist = document.createElement('button');
  twist.className = 'row-twist' + (item.type === 'file' ? ' is-leaf' : '');
  twist.tabIndex = -1;
  twist.type = 'button';
  twist.innerHTML = ico('chevron-right', 12);
  if (item.type === 'dir' && expanded.has(item.path)) twist.classList.add('open');
  twist.addEventListener('click', e => {
    e.stopPropagation();
    if (item.type === 'dir') toggleDir(item.path);
  });

  // Datei-/Ordner-Icon links neben dem Namen
  const iconEl = document.createElement('div');
  iconEl.className = 'row-icon';
  iconEl.innerHTML = item.type === 'dir'
    ? ico(expanded.has(item.path) ? 'folder-open' : 'folder', 16)
    : iconFor(item.name);

  // Name + Meta
  const info = document.createElement('div');
  info.className = 'row-info';
  const name = document.createElement('span');
  name.className = 'row-name';
  name.innerHTML = highlightName(item.name, searchQuery);
  name.title = item.path;
  const meta = document.createElement('span');
  meta.className = 'row-meta';
  meta.textContent = metaText(item, hint);
  info.append(name, meta);

  // Drei-Punkt-Menü ganz rechts, nur bei Hover sichtbar
  const actions = document.createElement('div');
  actions.className = 'row-actions';
  const menuBtn = document.createElement('button');
  menuBtn.className = 'row-menu-btn';
  menuBtn.type = 'button';
  menuBtn.tabIndex = -1;
  menuBtn.setAttribute('aria-label', 'Aktionen für ' + item.name);
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.innerHTML = ico('more-vertical', 14);
  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    openMenu(menuBtn, item);
  });
  actions.append(menuBtn);

  row.append(twist, iconEl, info, actions);
  attachRowEvents(row, item, index);
  return row;
}

function metaText(item, hint) {
  if (hint !== undefined) {
    const where = hint ? `in ${hint}` : 'im Workspace';
    if (item.type === 'dir') {
      const c = countEntries(item.children || []);
      return c.files
        ? `Ordner · ${where} · ${c.files} Datei${c.files === 1 ? '' : 'en'}`
        : `Ordner · ${where}`;
    }
    return `${fmtSize(item.size)} · ${where}`;
  }
  if (item.type === 'dir') {
    const c = countEntries(item.children || []);
    const parts = [];
    if (c.dirs) parts.push(c.dirs + ' Ordner');
    parts.push(c.files + ' Datei' + (c.files === 1 ? '' : 'en'));
    return parts.join(' · ');
  }
  return `${fmtSize(item.size)} · ${fmtTime(item.mtime)}`;
}

function attachRowEvents(row, item, index) {
  row.addEventListener('click', e => onRowClick(e, item, index));
  row.addEventListener('dblclick', e => onRowDblClick(e, item));
  row.addEventListener('contextmenu', e => onRowContextMenu(e, item, index));
  row.addEventListener('dragstart', e => onRowDragStart(e, item));
  row.addEventListener('dragend', () => row.classList.remove('dragging'));
  if (item.type === 'dir') {
    row.addEventListener('dragover', e => onDirDragOver(e, row));
    row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
    row.addEventListener('drop', e => onDirDrop(e, row, item));
  }
}

// ---- Click/Selection-Handling --------------------------------------------

function onRowClick(e, item, index) {
  if (editingPath) return;
  setActive(index, false);

  if (e.shiftKey && selection.size() > 0) {
    selection.range(visiblePaths(), index);
    return;
  }
  if (e.metaKey || e.ctrlKey) {
    selection.toggle(item.path, index);
    return;
  }
  if (item.type === 'dir') {
    toggleDir(item.path);
    selection.single(item.path, index);
    return;
  }
  selection.single(item.path, index);
}

function onRowDblClick(e, item) {
  if (editingPath) return;
  if (item.type === 'file') {
    e.preventDefault();
    download(item.path);
  }
}

function onRowContextMenu(e, item, index) {
  e.preventDefault();
  e.stopPropagation(); // Verhindert, dass das Empty-ContextMenu getriggert wird
  if (selection.has(item.path) && selection.size() > 1) {
    openBulkContextMenu(e.clientX, e.clientY);
  } else {
    selection.single(item.path, index);
    setActive(index, false);
    openContextMenu(item, e.clientX, e.clientY);
  }
}

// ---- Drag/Drop ------------------------------------------------------------
// Intern: Zeile auf Zielordner ziehen → Verschieben (oder auf leeren Listen-
// Bereich = Workspace-Root). Extern: Datei vom Desktop auf einen Ordner
// ziehen → Upload dorthin (oder auf leeren Bereich = Root, läuft über
// upload.js).

function onRowDragStart(e, item) {
  // Wenn die Zeile selektiert ist, ziehen wir die ganze Auswahl mit; sonst
  // nur diese Zeile.
  const paths = selection.has(item.path) && selection.size() > 1
    ? selection.names()
    : [item.path];
  e.dataTransfer.setData(DRAG_MIME, JSON.stringify(paths));
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
}

function onDirDragOver(e, row) {
  const types = [...e.dataTransfer.types];
  const internal = types.includes(DRAG_MIME);
  const external = types.includes('Files');
  if (!internal && !external) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = internal ? 'move' : 'copy';
  row.classList.add('drop-target');
}

function onDirDrop(e, row, item) {
  row.classList.remove('drop-target');
  const internal = e.dataTransfer.getData(DRAG_MIME);
  if (internal) {
    e.preventDefault();
    e.stopPropagation();
    try { moveMany(JSON.parse(internal), item.path); } catch (_) {}
  } else if (e.dataTransfer.files?.length) {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('agentbox:upload-to', {
      detail: { dir: item.path, files: e.dataTransfer.files },
    }));
  }
}

// ---- Cut/Paste-Move -------------------------------------------------------

function effectivePaths() {
  if (selection.size() > 0) return selection.names();
  const cur = visibleItems[activeIndex]?.item;
  return cur ? [cur.path] : [];
}

function pasteTarget() {
  const cur = visibleItems[activeIndex]?.item;
  if (!cur) return '';
  return cur.type === 'dir' ? cur.path : parentPath(cur.path);
}

function markCut(paths) {
  cutPaths = [...paths];
  document.querySelectorAll('.file-row').forEach(r => {
    r.classList.toggle('cut', cutPaths.includes(r.dataset.path));
  });
  updateStatus();
}

function clearCut() {
  if (!cutPaths.length) return;
  cutPaths = [];
  document.querySelectorAll('.file-row.cut').forEach(r => r.classList.remove('cut'));
  updateStatus();
}

async function pasteCut() {
  if (!cutPaths.length) return;
  const target = pasteTarget();
  const paths = cutPaths;
  cutPaths = [];
  const moved = await moveMany(paths, target);
  if (moved > 0) {
    const where = target ? `nach „${target}"` : 'in den Workspace-Root';
    toast.success(moved === 1 ? `1 Eintrag ${where} verschoben` : `${moved} Einträge ${where} verschoben`);
  }
}

async function moveMany(paths, targetDir) {
  const errors = [];
  let moved = 0;
  for (const src of paths) {
    if (src === targetDir || targetDir.startsWith(src + '/')) continue;
    const target = api.joinPath(targetDir, api.basename(src));
    if (target === src) continue;
    try {
      await api.movePath(src, target);
      moved++;
    } catch (e) {
      errors.push(`${src}: ${e.message}`);
    }
  }
  if (errors.length) {
    if (errors.length === 1) {
      toast.error('Verschieben fehlgeschlagen: ' + errors[0]);
    } else {
      toast.error(`${errors.length} Verschiebe-Fehler — Details in der Konsole`);
      console.error('Verschieben fehlgeschlagen:\n' + errors.join('\n'));
    }
  }
  selection.clear();
  if (targetDir) expanded.add(targetDir);
  await refresh();
  return moved;
}

export async function copyPaths(paths) {
  if (!paths.length) return;
  const text = paths.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    toast.success(paths.length === 1 ? 'Pfad kopiert' : `${paths.length} Pfade kopiert`);
  } catch (e) {
    toast.error('Kopieren fehlgeschlagen: ' + e.message);
  }
}

// ---- Tree-State -----------------------------------------------------------

function toggleDir(path) {
  if (expanded.has(path)) expanded.delete(path);
  else expanded.add(path);
  render();
}

// ---- Active-Row (Keyboard-Fokus) ------------------------------------------

function setActive(idx, scroll = true) {
  activeIndex = idx;
  document.querySelectorAll('.file-row').forEach(r => {
    r.classList.toggle('active', Number(r.dataset.index) === activeIndex);
  });
  if (scroll && activeIndex >= 0) {
    const row = listEl.querySelector(`.file-row[data-index="${activeIndex}"]`);
    if (row) row.scrollIntoView({ block: 'nearest' });
  }
}

// ---- Render-Top-Level -----------------------------------------------------

function render() {
  rebuildVisible();
  listEl.innerHTML = '';
  ensureDropOverlay();

  if (!entries.length) {
    listEl.appendChild(emptyState('start'));
  } else if (!visibleItems.length) {
    listEl.appendChild(emptyState('search'));
  } else {
    visibleItems.forEach(({ item, depth, hint }, i) =>
      listEl.appendChild(renderRow(item, i, depth, hint))
    );
  }

  updateStatus();
  selection.updateUI();
}

function updateStatus() {
  if (!entries.length) {
    statusEl.textContent = cutPaths.length ? `0 Dateien · ${cutPaths.length} ausgeschnitten` : '0 Dateien';
    updateClearWorkspaceBtn(false);
    return;
  }
  const c = countEntries(entries);
  let text = `${c.files} Datei${c.files === 1 ? '' : 'en'} · ${c.dirs} Ordner · ${fmtSize(c.size)}`;
  if (cutPaths.length) text += ` · ${cutPaths.length} ausgeschnitten`;
  statusEl.textContent = text;
  updateClearWorkspaceBtn(true);
}

function updateClearWorkspaceBtn(enabled) {
  const btn = document.getElementById('clear-workspace-btn');
  if (!btn) return;
  btn.disabled = !enabled;
  if (enabled) {
    btn.removeAttribute('aria-disabled');
    btn.title = 'Workspace leeren – alle Dateien und Ordner löschen';
  } else {
    btn.setAttribute('aria-disabled', 'true');
    btn.title = 'Workspace ist bereits leer';
  }
}

function ensureDropOverlay() {
  if (!listEl.querySelector('.drop-overlay')) {
    const d = document.createElement('div');
    d.className = 'drop-overlay';
    d.textContent = 'Dateien hier ablegen';
    listEl.prepend(d);
  }
}

function emptyState(kind) {
  const e = document.createElement('div');
  e.className = 'empty';
  if (kind === 'search') {
    e.innerHTML = `Keine Treffer für „${escapeHTML(searchQuery)}".<span class="hint"><kbd>Esc</kbd> leert das Filterfeld.</span>`;
  } else {
    e.innerHTML = `Keine Dateien.<span class="hint">Dateien hier ablegen oder unten einen Ordner erstellen.</span>`;
  }
  return e;
}

// ---- Inline-Rename --------------------------------------------------------

function startRename(path) {
  const entry = findEntry(path);
  if (!entry) return;
  const idx = visibleItems.findIndex(v => v.item.path === path);
  if (idx < 0) {
    // Eintrag nicht sichtbar: Vorgänger expandieren und neu rendern
    const segments = path.split('/');
    segments.pop();
    let acc = '';
    for (const s of segments) {
      acc = acc ? `${acc}/${s}` : s;
      expanded.add(acc);
    }
    searchQuery = '';
    if (searchInput) { searchInput.value = ''; searchClearBtn.hidden = true; }
    render();
  }
  const row = listEl.querySelector(`.file-row[data-path="${cssEscape(path)}"]`);
  if (!row) return;
  const nameEl = row.querySelector('.row-name');
  if (!nameEl) return;

  editingPath = path;
  const original = entry.name;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'row-name-input';
  input.value = original;
  nameEl.replaceWith(input);
  input.focus();
  // Bei Dateien Endung von der Selektion ausnehmen.
  const dot = entry.type === 'file' ? original.lastIndexOf('.') : -1;
  if (dot > 0) input.setSelectionRange(0, dot);
  else input.select();

  let done = false;
  const finish = (commit) => {
    if (done) return;
    done = true;
    editingPath = null;
    const newName = input.value.trim();
    if (commit && newName && newName !== original) {
      api.renameFile(path, newName)
        .catch(e => toast.error('Umbenennen fehlgeschlagen: ' + e.message))
        .finally(() => refresh());
    } else {
      render();
    }
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    e.stopPropagation();
  });
  input.addEventListener('blur', () => finish(true));
}

function cssEscape(s) {
  if (window.CSS && CSS.escape) return CSS.escape(s);
  return s.replace(/(["\\])/g, '\\$1');
}

// ---- Suche ----------------------------------------------------------------

function setSearchQuery(q) {
  searchQuery = q.trim();
  searchClearBtn.hidden = !searchQuery;
  activeIndex = -1;
  render();
  if (searchQuery && visibleItems.length) setActive(0, false);
}

// ---- Public Aktionen ------------------------------------------------------

export async function refresh() {
  try {
    const data = await api.listFiles();
    entries = data.entries || [];
    selection.intersect(new Set(flattenAll(entries).map(item => item.path)));
    render();
  } catch (e) {
    statusEl.textContent = 'Fehler';
    console.error(e);
  }
}

export function download(path) {
  const a = document.createElement('a');
  a.href = api.fileDownloadURL(path);
  a.download = api.basename(path);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadZip(paths, filename = 'agent-files.zip') {
  return api.bulkZip(paths).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

export async function downloadEntry(entry) {
  try {
    if (entry.type === 'dir') await downloadZip([entry.path], api.basename(entry.path) + '.zip');
    else download(entry.path);
  } catch (e) {
    toast.error('Download fehlgeschlagen: ' + e.message);
  }
}

export async function createFolder(parent = '') {
  const title = parent ? 'Unterordner erstellen' : 'Neuer Ordner';
  const name = await promptModal(title, 'Wie soll der neue Ordner heißen?', '');
  if (!name) return;
  try {
    const path = api.joinPath(parent, name);
    await api.createDir(path);
    if (parent) expanded.add(parent);
    expanded.add(path);
  } catch (e) {
    toast.error('Ordner anlegen fehlgeschlagen: ' + e.message);
  }
  await refresh();
}

export function rename(path) {
  startRename(path);
}

export async function remove(entry) {
  const label = entry.type === 'dir' ? 'Ordner löschen' : 'Datei löschen';
  const msg = entry.type === 'dir'
    ? `"${entry.path}" und alle enthaltenen Dateien werden unwiderruflich gelöscht.`
    : `"${entry.path}" wird unwiderruflich gelöscht.`;
  if (!await confirmModal(label, msg, 'Löschen')) return;
  try {
    await api.deleteFile(entry.path);
  } catch (e) {
    toast.error('Löschen fehlgeschlagen: ' + (e.message || ''));
  }
  await refresh();
}

export async function downloadSelection() {
  const paths = selection.names();
  if (!paths.length) return;
  try {
    const item = findEntry(paths[0]);
    if (paths.length === 1 && item?.type === 'file') { download(paths[0]); return; }
    await downloadZip(paths);
  } catch (e) {
    toast.error('Download fehlgeschlagen: ' + e.message);
  }
}

export async function clearWorkspace() {
  if (!entries.length) return;
  const c = countEntries(entries);
  const parts = [];
  if (c.files) parts.push(`${c.files} ${c.files === 1 ? 'Datei' : 'Dateien'}`);
  if (c.dirs)  parts.push(`${c.dirs} ${c.dirs === 1 ? 'Ordner' : 'Ordner'}`);
  const summary = parts.join(' und ') || 'alle Einträge';
  const msg = `Es werden ${summary} (${fmtSize(c.size)}) im Workspace unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`;
  if (!await confirmModal('Workspace leeren', msg, 'Alles löschen')) return;
  try {
    // entries enthält nur Top-Level-Einträge; rmtree im Backend räumt
    // rekursiv auf. .config bleibt automatisch verschont, weil es in
    // RESERVED_ROOTS steht und vom API nicht gelistet/aufgelöst wird.
    const data = await api.bulkDelete(entries.map(e => e.path));
    if (data.failed?.length) {
      toast.error(`${data.failed.length} Löschfehler — Details in der Konsole`);
      console.error('Workspace-Leeren fehlgeschlagen:\n' +
        data.failed.map(f => `${f.name}: ${f.error}`).join('\n'));
    } else {
      toast.success('Workspace geleert');
    }
  } catch (e) {
    toast.error('Workspace-Leeren fehlgeschlagen: ' + e.message);
  }
  selection.clear();
  await refresh();
}

export async function deleteSelection() {
  const paths = selection.names();
  if (!paths.length) return;
  const msg = paths.length === 1
    ? `"${paths[0]}" wird unwiderruflich gelöscht.`
    : `${paths.length} Elemente werden unwiderruflich gelöscht.`;
  const okLabel = paths.length === 1 ? 'Löschen' : `${paths.length} löschen`;
  if (!await confirmModal('Auswahl löschen', msg, okLabel)) return;
  try {
    const data = await api.bulkDelete(paths);
    if (data.failed?.length) {
      toast.error(`${data.failed.length} Löschfehler — Details in der Konsole`);
      console.error('Löschen fehlgeschlagen:\n' +
        data.failed.map(f => `${f.name}: ${f.error}`).join('\n'));
    }
  } catch (e) {
    toast.error('Löschen fehlgeschlagen: ' + e.message);
  }
  selection.clear();
  await refresh();
}

// ---- Keyboard -------------------------------------------------------------

function onListKeyDown(e) {
  // Erlaubt sind nur Tasten innerhalb der Liste; Inline-Rename schluckt
  // seine eigenen Tasten weiter oben.
  if (editingPath) return;

  // Modifier-Combos zuerst
  if (e.metaKey || e.ctrlKey) {
    const k = e.key.toLowerCase();
    if (k === 'a') { e.preventDefault(); selection.replace(visiblePaths()); return; }
    if (k === 'c') { e.preventDefault(); copyPaths(effectivePaths()); return; }
    if (k === 'x') { e.preventDefault(); markCut(effectivePaths()); return; }
    if (k === 'v') { e.preventDefault(); pasteCut(); return; }
  }

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (visibleItems.length) setActive(Math.min(activeIndex + 1, visibleItems.length - 1));
      break;
    case 'ArrowUp':
      e.preventDefault();
      if (visibleItems.length) setActive(Math.max(activeIndex - 1, 0));
      break;
    case 'Home':
      e.preventDefault();
      if (visibleItems.length) setActive(0);
      break;
    case 'End':
      e.preventDefault();
      if (visibleItems.length) setActive(visibleItems.length - 1);
      break;
    case 'ArrowRight': {
      e.preventDefault();
      const cur = visibleItems[activeIndex]?.item;
      if (cur?.type === 'dir' && !expanded.has(cur.path)) {
        expanded.add(cur.path);
        render();
        setActive(activeIndex);
      } else if (cur?.type === 'dir' && expanded.has(cur.path)) {
        // schon offen → erstes Kind
        if (visibleItems[activeIndex + 1]?.depth > visibleItems[activeIndex].depth) {
          setActive(activeIndex + 1);
        }
      }
      break;
    }
    case 'ArrowLeft': {
      e.preventDefault();
      const cur = visibleItems[activeIndex];
      if (!cur) break;
      if (cur.item.type === 'dir' && expanded.has(cur.item.path)) {
        expanded.delete(cur.item.path);
        render();
        setActive(activeIndex);
      } else {
        // Eltern suchen: rückwärts gehen bis depth < cur.depth
        for (let i = activeIndex - 1; i >= 0; i--) {
          if (visibleItems[i].depth < cur.depth) { setActive(i); break; }
        }
      }
      break;
    }
    case 'Enter': {
      e.preventDefault();
      const cur = visibleItems[activeIndex]?.item;
      if (!cur) break;
      if (cur.type === 'dir') toggleDir(cur.path);
      else download(cur.path);
      break;
    }
    case ' ': {
      e.preventDefault();
      const cur = visibleItems[activeIndex]?.item;
      if (cur) selection.toggle(cur.path, activeIndex);
      break;
    }
    case 'F2': {
      e.preventDefault();
      const cur = visibleItems[activeIndex]?.item;
      if (cur) startRename(cur.path);
      break;
    }
    case 'Delete':
    case 'Backspace': {
      e.preventDefault();
      if (selection.size() > 1) deleteSelection();
      else {
        const cur = visibleItems[activeIndex]?.item;
        if (cur) remove(cur);
      }
      break;
    }
    case 'Escape': {
      if (cutPaths.length) {
        e.preventDefault();
        clearCut();
      } else if (searchQuery) {
        e.preventDefault();
        searchInput.value = '';
        setSearchQuery('');
      } else if (selection.size() > 0) {
        e.preventDefault();
        selection.clear();
      }
      break;
    }
  }
}

// ---- Init -----------------------------------------------------------------

export function init() {
  listEl   = document.getElementById('files-list');
  statusEl = document.getElementById('files-status');
  searchInput    = document.getElementById('files-search');
  searchClearBtn = document.getElementById('search-clear-btn');

  document.getElementById('new-folder-btn')?.addEventListener('click', () => createFolder(''));
  document.getElementById('bulk-download-btn').addEventListener('click', () => downloadSelection());
  document.getElementById('bulk-copy-paths-btn').addEventListener('click', () => copyPaths(selection.names()));
  document.getElementById('bulk-delete-btn').addEventListener('click', () => deleteSelection());
  document.getElementById('clear-workspace-btn')?.addEventListener('click', () => clearWorkspace());
  updateClearWorkspaceBtn(false);

  searchInput.addEventListener('input', () => setSearchQuery(searchInput.value));
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape' && searchInput.value) {
      e.preventDefault();
      e.stopPropagation();
      searchInput.value = '';
      setSearchQuery('');
    }
    if (e.key === 'ArrowDown' && visibleItems.length) {
      e.preventDefault();
      listEl.focus();
      setActive(0);
    }
  });
  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    setSearchQuery('');
    searchInput.focus();
  });

  listEl.addEventListener('keydown', onListKeyDown);
  listEl.addEventListener('click', e => {
    // Klick auf leeren Bereich der Liste → Auswahl aufheben
    if (e.target === listEl) selection.clear();
  });

  // Rechtsklick auf leere Fläche
  listEl.addEventListener('contextmenu', e => {
    if (e.target === listEl || e.target.classList.contains('empty')) {
      e.preventDefault();
      openEmptyContextMenu(e.clientX, e.clientY);
    }
  });

  // Internes Drop auf den leeren Listenbereich = Verschieben in den Root
  listEl.addEventListener('dragover', e => {
    if (![...e.dataTransfer.types].includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });
  listEl.addEventListener('drop', e => {
    const internal = e.dataTransfer.getData(DRAG_MIME);
    if (!internal) return;
    e.preventDefault();
    try { moveMany(JSON.parse(internal), ''); } catch (_) {}
  });
}
