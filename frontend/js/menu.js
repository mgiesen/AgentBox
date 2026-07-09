// Kontextmenüs: pro Zeile (Drei-Punkt + Rechtsklick) und pro Auswahl (Bulk).
// Ankerpunkt ist entweder ein Button (positionAtButton) oder Cursor-Position
// (positionAt). Schließen einheitlich via closeMenu.

import * as files from './files.js';
import * as selection from './selection.js';

const SPRITE = '/icons/sprite.svg';
const ico = id => `<svg class="icon" width="14" height="14" aria-hidden="true"><use href="${SPRITE}#${id}"/></svg>`;

let menuEl = null;
let menuOwner = null;

export function closeMenu() {
  if (menuEl) { menuEl.remove(); menuEl = null; }
  if (menuOwner) {
    menuOwner.setAttribute('aria-expanded', 'false');
    const ownerRow = menuOwner.closest('.file-row');
    if (ownerRow) ownerRow.classList.remove('menu-open');
    menuOwner = null;
  }
}

function positionAtButton(button) {
  const r = button.getBoundingClientRect();
  positionAt(r.right, r.bottom + 4, { preferLeft: true, fallbackTop: r.top - 4 });
}

function positionAt(x, y, opts = {}) {
  const mw = menuEl.offsetWidth;
  const mh = menuEl.offsetHeight;
  let left = opts.preferLeft ? x - mw : x;
  let top = y;
  if (left + mw > window.innerWidth - 4) left = window.innerWidth - mw - 4;
  if (left < 4) left = 4;
  if (top + mh > window.innerHeight - 4) {
    top = opts.fallbackTop !== undefined ? opts.fallbackTop - mh : Math.max(4, y - mh);
  }
  if (top < 4) top = 4;
  menuEl.style.left = left + 'px';
  menuEl.style.top  = top + 'px';
}

function rowMenuHTML(entry) {
  const dlLabel = entry.type === 'dir' ? 'Als ZIP herunterladen' : 'Herunterladen';
  if (entry.type === 'dir') {
    return `
      <button data-act="new-folder">${ico('folder-plus')}Unterordner erstellen</button>
      <button data-act="upload-to">${ico('upload')}Datei(en) hochladen</button>
      <div class="sep"></div>
      <button data-act="download">${ico('download')}${dlLabel}</button>
      <button data-act="copy-path">${ico('copy')}Pfad kopieren</button>
      <button data-act="rename">${ico('pencil')}Umbenennen</button>
      <div class="sep"></div>
      <button data-act="delete" class="danger">${ico('trash')}Löschen</button>
    `;
  }
  return `
    <button data-act="download">${ico('download')}${dlLabel}</button>
    <button data-act="copy-path">${ico('copy')}Pfad kopieren</button>
    <button data-act="rename">${ico('pencil')}Umbenennen</button>
    <div class="sep"></div>
    <button data-act="delete" class="danger">${ico('trash')}Löschen</button>
  `;
}

function bindRowMenu(entry) {
  const newFolder = menuEl.querySelector('[data-act="new-folder"]');
  if (newFolder) newFolder.addEventListener('click', () => { closeMenu(); files.createFolder(entry.path); });
  
  const uploadTo = menuEl.querySelector('[data-act="upload-to"]');
  if (uploadTo) uploadTo.addEventListener('click', () => {
    closeMenu();
    const input = document.getElementById('file-input');
    if (!input) return;
    // Wir hängen einen Einmal-Listener an das Hidden-Input, um den Zielpfad zu setzen
    const onFileChange = () => {
      if (input.files.length) {
        window.dispatchEvent(new CustomEvent('agentbox:upload-to', {
          detail: { dir: entry.path, files: input.files },
        }));
      }
      input.removeEventListener('change', onFileChange);
    };
    input.addEventListener('change', onFileChange);
    input.click();
  });

  menuEl.querySelector('[data-act="download"]').addEventListener('click', () => { closeMenu(); files.downloadEntry(entry); });
  menuEl.querySelector('[data-act="copy-path"]').addEventListener('click', () => { closeMenu(); files.copyPaths([entry.path]); });
  menuEl.querySelector('[data-act="rename"]').addEventListener('click', () => { closeMenu(); files.rename(entry.path); });
  menuEl.querySelector('[data-act="delete"]').addEventListener('click', () => { closeMenu(); files.remove(entry); });
}

function bulkMenuHTML() {
  const n = selection.size();
  const dlLabel = n > 1 ? `Als ZIP herunterladen (${n})` : 'Herunterladen';
  const delLabel = n > 1 ? `Löschen (${n})` : 'Löschen';
  const cpLabel = n > 1 ? `Pfade kopieren (${n})` : 'Pfad kopieren';
  return `
    <button data-act="download">${ico('download')}${dlLabel}</button>
    <button data-act="copy-path">${ico('copy')}${cpLabel}</button>
    <div class="sep"></div>
    <button data-act="delete" class="danger">${ico('trash')}${delLabel}</button>
  `;
}

function bindBulkMenu() {
  menuEl.querySelector('[data-act="download"]').addEventListener('click', () => { closeMenu(); files.downloadSelection(); });
  menuEl.querySelector('[data-act="copy-path"]').addEventListener('click', () => { closeMenu(); files.copyPaths(selection.names()); });
  menuEl.querySelector('[data-act="delete"]').addEventListener('click', () => { closeMenu(); files.deleteSelection(); });
}

function emptyMenuHTML() {
  return `
    <button data-act="new-folder">${ico('folder-plus')}Ordner erstellen</button>
    <button data-act="upload">${ico('upload')}Datei(en) hochladen</button>
  `;
}

function bindEmptyMenu() {
  menuEl.querySelector('[data-act="new-folder"]').addEventListener('click', () => { closeMenu(); files.createFolder(''); });
  menuEl.querySelector('[data-act="upload"]').addEventListener('click', () => {
    closeMenu();
    document.getElementById('upload-btn')?.click();
  });
}

// Drei-Punkt-Klick: anchored am Button.
export function openMenu(button, entry) {
  closeMenu();
  menuOwner = button;
  button.setAttribute('aria-expanded', 'true');
  const ownerRow = button.closest('.file-row');
  if (ownerRow) ownerRow.classList.add('menu-open');

  menuEl = document.createElement('div');
  menuEl.className = 'ctx-menu';
  menuEl.innerHTML = rowMenuHTML(entry);
  document.body.appendChild(menuEl);
  positionAtButton(button);
  bindRowMenu(entry);
}

// Rechtsklick auf eine einzelne Zeile (oder eine, die nicht in Multi-Selektion ist).
export function openContextMenu(entry, x, y) {
  closeMenu();
  menuEl = document.createElement('div');
  menuEl.className = 'ctx-menu';
  menuEl.innerHTML = rowMenuHTML(entry);
  document.body.appendChild(menuEl);
  positionAt(x, y);
  bindRowMenu(entry);
}

// Rechtsklick auf eine Zeile, wenn Multi-Selektion aktiv ist.
export function openBulkContextMenu(x, y) {
  closeMenu();
  menuEl = document.createElement('div');
  menuEl.className = 'ctx-menu';
  menuEl.innerHTML = bulkMenuHTML();
  document.body.appendChild(menuEl);
  positionAt(x, y);
  bindBulkMenu();
}

// Rechtsklick auf leere Fläche.
export function openEmptyContextMenu(x, y) {
  closeMenu();
  menuEl = document.createElement('div');
  menuEl.className = 'ctx-menu';
  menuEl.innerHTML = emptyMenuHTML();
  document.body.appendChild(menuEl);
  positionAt(x, y);
  bindEmptyMenu();
}

export function init() {
  document.addEventListener('click', e => {
    if (!menuEl) return;
    if (e.target.closest('.ctx-menu') || e.target.closest('.row-menu-btn')) return;
    closeMenu();
  });
  window.addEventListener('blur', closeMenu);
  window.addEventListener('resize', closeMenu);
  document.addEventListener('scroll', closeMenu, true);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.querySelector('.modal-backdrop')) return;
    if (menuEl) { closeMenu(); return; }
    // Esc auf File-List wird dort behandelt (Suche / Selection); nur als
    // letzter Fallback Selektion clearen.
    if (!e.target.closest('.files-list, .search-field') && selection.size()) {
      selection.clear();
    }
  });
}
