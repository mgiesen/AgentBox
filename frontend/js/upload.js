// Upload-UI: Button, Drag & Drop auf die Liste, Progress-Bar.

import * as api from './api.js';
import { confirmModal } from './modals.js';
import { refresh } from './files.js';
import { toast } from './toast.js';

let listEl, fileInput, uploadBtn;
let progressEl, progressTxt, progressPct, progressBar;

function showProgress(text, pct) {
  progressEl.classList.add('active');
  progressTxt.textContent = text;
  progressTxt.title = text;
  const p = Math.round(pct * 100);
  progressPct.textContent = p + ' %';
  progressBar.style.width = p + '%';
}

function hideProgress() {
  progressEl.classList.remove('active');
  progressBar.style.width = '0%';
}

function childrenForDir(entries, dir) {
  if (!dir) return entries;
  for (const entry of entries) {
    if (entry.type !== 'dir') continue;
    if (entry.path === dir) return entry.children || [];
    const nested = childrenForDir(entry.children || [], dir);
    if (nested) return nested;
  }
  return null;
}

async function getExistingNames(dir = '') {
  try {
    const data = await api.listFiles();
    const children = childrenForDir(data.entries || [], dir) || [];
    return new Set(children.map(f => f.name));
  } catch { return new Set(); }
}

async function uploadFiles(fileList, dir = '') {
  const files = Array.from(fileList);
  if (!files.length) return;

  const existing = await getExistingNames(dir);
  const errors = [];
  let done = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];

    if (existing.has(f.name)) {
      const ok = await confirmModal(
        'Datei überschreiben?',
        `"${f.name}" existiert bereits ${dir ? 'in "' + dir + '"' : 'im Agent-Dateisystem'}. Soll die vorhandene Datei ersetzt werden?`,
        'Überschreiben',
        'primary',
      );
      if (!ok) continue;
    }

    const prefix = files.length > 1 ? `(${i + 1}/${files.length}) ` : '';
    try {
      const label = dir ? `${dir}/${f.name}` : f.name;
      showProgress(prefix + label, 0);
      await api.uploadFile(f, dir, p => showProgress(prefix + label, p));
      existing.add(f.name);
      done++;
    } catch (e) {
      errors.push(`${f.name}: ${e.message}`);
    }
  }

  hideProgress();
  if (errors.length) {
    if (errors.length === 1) {
      toast.error('Upload fehlgeschlagen: ' + errors[0]);
    } else {
      toast.error(`${errors.length} Upload-Fehler — Details in der Konsole`);
      console.error('Upload fehlgeschlagen:\n' + errors.join('\n'));
    }
  }
  await refresh();
}

export function init() {
  listEl     = document.getElementById('files-list');
  fileInput  = document.getElementById('file-input');
  uploadBtn  = document.getElementById('upload-btn');
  progressEl = document.getElementById('upload-progress');
  progressTxt = progressEl.querySelector('.upload-progress-text');
  progressPct = progressEl.querySelector('.upload-progress-pct');
  progressBar = progressEl.querySelector('.upload-progress-bar > div');

  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) uploadFiles(fileInput.files);
    fileInput.value = '';
  });

  window.addEventListener('agentbox:upload-to', e => {
    if (e.detail?.files) uploadFiles(e.detail.files, e.detail.dir || '');
  });

  // Drag & Drop auf die Files-Liste
  let dragCounter = 0;
  listEl.addEventListener('dragenter', e => {
    if (![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault();
    dragCounter++;
    listEl.classList.add('dragover');
  });
  listEl.addEventListener('dragover', e => e.preventDefault());
  listEl.addEventListener('dragleave', () => {
    dragCounter--;
    if (dragCounter <= 0) { dragCounter = 0; listEl.classList.remove('dragover'); }
  });
  listEl.addEventListener('drop', e => {
    e.preventDefault();
    dragCounter = 0;
    listEl.classList.remove('dragover');
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  });
}
