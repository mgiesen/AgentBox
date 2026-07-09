// OpenCode-Konfiguration: voller JSON-Editor, erreichbar über das
// Zahnrad-Icon im Header (#settings-btn). Lädt die aktuelle Config per
// GET /api/config, schreibt sie per PUT /api/config zurück und startet
// OpenCode neu. Die AgentBox ist provider-agnostisch — welcher
// LLM-Provider verwendet wird, entscheidet allein diese Config.

import * as api from './api.js';
import { toast } from './toast.js';

let settingsBtn;

function stripJsonComments(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '"') {
      const start = i;
      i++;
      while (i < n) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === '"') { i++; break; }
        i++;
      }
      out += text.slice(start, i);
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      i += 2;
      while (i < n && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function reloadTerminalIframe() {
  const f = document.querySelector('.terminal iframe');
  // Re-Assign desselben src triggert Reload — ttyd öffnet neue Session.
  f.src = f.src;
}

async function openSettings() {
  let path = '';
  let content = '';
  try {
    const data = await api.getConfig();
    path = data.path;
    content = data.content;
  } catch (e) {
    toast.error('Konfiguration konnte nicht geladen werden: ' + e.message);
    return;
  }

  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `
    <div class="modal modal--lg" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h3>OpenCode-Konfiguration</h3>
        <div class="modal-meta">${path}</div>
      </div>
      <div class="modal-body">
        <textarea class="editor" id="cfg-editor" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"></textarea>
      </div>
      <div class="modal-foot">
        <button class="btn" data-act="cancel">Abbrechen</button>
        <button class="btn btn-primary" data-act="save">Speichern und OpenCode neu starten</button>
      </div>
    </div>`;
  document.body.appendChild(back);
  const editor = back.querySelector('#cfg-editor');
  editor.value = content;
  editor.focus();

  editor.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = editor.selectionStart, en = editor.selectionEnd;
      editor.value = editor.value.slice(0, s) + '  ' + editor.value.slice(en);
      editor.selectionStart = editor.selectionEnd = s + 2;
    }
    if (e.key === 'Escape') close();
  });

  const close = () => back.remove();
  back.querySelector('[data-act="cancel"]').addEventListener('click', close);
  back.addEventListener('click', e => { if (e.target === back) close(); });

  const saveBtn = back.querySelector('[data-act="save"]');
  const saveLabel = saveBtn.textContent;
  saveBtn.addEventListener('click', async () => {
    const text = editor.value;
    const stripped = stripJsonComments(text).trim();
    if (stripped) {
      try { JSON.parse(stripped); }
      catch (e) {
        if (!confirm('Die Konfiguration ist kein gültiges JSON:\n\n' + e.message + '\n\nTrotzdem speichern?')) return;
      }
    }
    saveBtn.disabled = true;
    saveBtn.textContent = 'Speichere …';
    try {
      await api.saveConfig(text);
      await api.restartAgent();
      reloadTerminalIframe();
      close();
    } catch (e) {
      toast.error(e.message);
      saveBtn.disabled = false;
      saveBtn.textContent = saveLabel;
    }
  });
}

export function init() {
  settingsBtn = document.getElementById('settings-btn');
  settingsBtn.addEventListener('click', () => openSettings());
}
