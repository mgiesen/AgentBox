// SMB-Verbindungs-Modal. Daten kommen vom agent-api unter /api/smb-info.
//
// Beim Page-Load wird `/api/features` abgefragt — wenn SMB deaktiviert
// ist, schaltet `init()` den Button per `disabled` hart aus (CSS killt
// Hover/Pointer) und setzt einen Erklär-Tooltip. Ist SMB aktiv, bleibt
// der Button visuell unauffällig — kein Statusbadge, weil der reine
// Vorhandenseins-Hinweis im Sidebar-Header genügt.
//
// Eine einzige Modal-Variante: OS-Switch + Schritt-Anleitung + Zugangsdaten.
// Die Adresse kommt aus `window.location.hostname` — der Browser kennt die
// URL, über die er die UI gerade geladen hat.
//
// Bei Loopback-Origin (`localhost`, `127.0.0.1`, `::1`) wird zusätzlich ein
// Hinweis-Banner oben eingeblendet: Mount auf demselben Host scheitert
// systemseitig (Finder-Auflösung, Port-445-Konflikt mit `LanmanServer`,
// Standard-Dialog ohne Port-Override). Der Banner erklärt das, die
// Anleitung darunter bleibt sichtbar, damit der Anwender sieht, wie das
// Vorgehen aussehen würde, sobald die UI über LAN-IP/Hostname/Domain
// erreicht wird. OS-Auswahl wird im localStorage persistiert.

import * as api from './api.js';
import { toast } from './toast.js';

const SPRITE = '/icons/sprite.svg';
const OS_STORAGE_KEY = 'agentbox.smbOs';

function isLoopback(host) {
  if (!host) return true;
  const h = host.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
}

function detectOS() {
  const ua = (navigator.userAgent || '').toLowerCase();
  if (ua.includes('mac')) return 'mac';
  if (ua.includes('win')) return 'win';
  return 'mac';
}

function loadOS() {
  try {
    const v = localStorage.getItem(OS_STORAGE_KEY);
    if (v === 'mac' || v === 'win') return v;
  } catch { /* private mode */ }
  return detectOS();
}

function saveOS(os) {
  try { localStorage.setItem(OS_STORAGE_KEY, os); } catch { /* ignore */ }
}

function browserHost() {
  return window.location.hostname || 'localhost';
}

function macUrl(host, info) {
  const portSuffix = info.port === 445 ? '' : ':' + info.port;
  return `smb://${info.user}@${host}${portSuffix}/${info.share}`;
}

function windowsUnc(host, info) {
  return `\\\\${host}\\${info.share}`;
}

async function copy(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast.success('In Zwischenablage kopiert');
  } catch {
    toast.error('Kopieren fehlgeschlagen');
  }
}

function buildModal(info, loopback) {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `
    <div class="modal modal--info smb-modal" role="dialog" aria-modal="true" aria-labelledby="smb-modal-title">
      <div class="modal-head">
        <h3 id="smb-modal-title">Workspace als Netzlaufwerk</h3>
      </div>
      <div class="modal-body">
        <div class="smb-os-switch" role="radiogroup" aria-label="Betriebssystem">
          <label class="smb-os-opt">
            <input type="radio" name="smb-os" value="mac">
            <span class="smb-os-pill">
              <svg width="16" height="16" aria-hidden="true"><use href="${SPRITE}#brand-apple"/></svg>
              <span>macOS</span>
            </span>
          </label>
          <label class="smb-os-opt">
            <input type="radio" name="smb-os" value="win">
            <span class="smb-os-pill">
              <svg width="14" height="14" aria-hidden="true"><use href="${SPRITE}#brand-windows"/></svg>
              <span>Windows</span>
            </span>
          </label>
        </div>

        <div class="smb-warning" id="smb-loopback-notice"${loopback ? '' : ' hidden'}>
          <div class="smb-warning-head">
            <svg width="16" height="16" aria-hidden="true"><use href="${SPRITE}#alert-triangle"/></svg>
            <span>Nur im Netzwerkbetrieb verfügbar</span>
          </div>
          <p class="smb-warning-text">
            Die Einbindung des Workspaces als Netzlaufwerk ist für den Remote-Zugriff auf einen AgentBox-Server konzipiert. Da du aktuell über <code>localhost</code> zugreifst, befinden sich Client und Server auf demselben System. Eine SMB-Verbindung über die Loopback-Adresse wird von macOS und Windows technisch eingeschränkt. Nutze diese Funktion, sobald die AgentBox über eine Netzwerk-IP oder einen Hostnamen erreichbar ist.
          </p>
        </div>

        <ol class="smb-steps" id="smb-mac-steps" hidden>
          <li class="smb-step">
            <div class="smb-step-num">1</div>
            <div class="smb-step-body">
              <div class="smb-step-title">Server-Adresse öffnen</div>
              <div class="smb-row smb-row-action">
                <a class="smb-link" id="smb-mac-link" href="" target="_self">
                  <svg width="14" height="14" aria-hidden="true"><use href="${SPRITE}#external-link"/></svg>
                  <span class="smb-mono" id="smb-mac-url">—</span>
                </a>
                <button class="smb-iconbtn" id="smb-mac-copy" type="button" title="URL kopieren" aria-label="URL kopieren">
                  <svg width="14" height="14" aria-hidden="true"><use href="${SPRITE}#copy"/></svg>
                </button>
              </div>
              <div class="smb-step-hint">Klick öffnet den Finder direkt. Alternativ <kbd>Cmd</kbd>+<kbd>K</kbd> im Finder und URL einfügen.</div>
            </div>
          </li>
          <li class="smb-step">
            <div class="smb-step-num">2</div>
            <div class="smb-step-body">
              <div class="smb-step-title">Anmelden</div>
              <div class="smb-step-hint">Beim ersten Verbinden fragt der Finder nach Benutzer und Passwort — siehe unten. Häkchen <em>im Schlüsselbund sichern</em> macht den Mount dauerhaft.</div>
            </div>
          </li>
        </ol>

        <ol class="smb-steps" id="smb-win-steps" hidden>
          <li class="smb-step">
            <div class="smb-step-num">1</div>
            <div class="smb-step-body">
              <div class="smb-step-title">Adresse kopieren</div>
              <div class="smb-row smb-row-action">
                <span class="smb-mono" id="smb-win-url">—</span>
                <button class="smb-iconbtn" id="smb-win-copy" type="button" title="Adresse kopieren" aria-label="Adresse kopieren">
                  <svg width="14" height="14" aria-hidden="true"><use href="${SPRITE}#copy"/></svg>
                </button>
              </div>
            </div>
          </li>
          <li class="smb-step">
            <div class="smb-step-num">2</div>
            <div class="smb-step-body">
              <div class="smb-step-title">Im Explorer als Netzlaufwerk verbinden</div>
              <div class="smb-step-hint"><em>Dieser PC → Netzlaufwerk verbinden</em>, Adresse einfügen, Laufwerksbuchstabe wählen, <em>Fertig stellen</em>. Alternativ direkt in die Explorer-Adresszeile einfügen.</div>
            </div>
          </li>
          <li class="smb-step">
            <div class="smb-step-num">3</div>
            <div class="smb-step-body">
              <div class="smb-step-title">Anmelden</div>
              <div class="smb-step-hint">Beim ersten Verbinden fragt Windows nach Benutzer und Passwort — siehe unten. Häkchen <em>Anmeldedaten speichern</em> macht den Mount dauerhaft.</div>
            </div>
          </li>
        </ol>

        <div class="smb-creds-head">Zugangsdaten</div>
        <div class="smb-grid">
          <div class="smb-section">
            <div class="smb-label">Benutzer</div>
            <div class="smb-row">
              <span class="smb-mono" id="smb-user"></span>
              <button class="smb-iconbtn" id="smb-user-copy" type="button" title="Benutzer kopieren" aria-label="Benutzer kopieren">
                <svg width="14" height="14" aria-hidden="true"><use href="${SPRITE}#copy"/></svg>
              </button>
            </div>
          </div>
          <div class="smb-section">
            <div class="smb-label">Passwort</div>
            <div class="smb-row">
              <span class="smb-mono smb-pw" id="smb-pw"></span>
              <button class="smb-iconbtn" id="smb-pw-toggle" type="button" title="Passwort anzeigen" aria-label="Passwort anzeigen" aria-pressed="false">
                <svg width="14" height="14" aria-hidden="true"><use href="${SPRITE}#eye"/></svg>
              </button>
              <button class="smb-iconbtn" id="smb-pw-copy" type="button" title="Passwort kopieren" aria-label="Passwort kopieren">
                <svg width="14" height="14" aria-hidden="true"><use href="${SPRITE}#copy"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-primary" data-act="close">Schließen</button>
      </div>
    </div>`;
  document.body.appendChild(back);
  return back;
}

function applyOSSelection(back, os) {
  back.querySelectorAll('input[name="smb-os"]').forEach(el => {
    el.checked = el.value === os;
  });
  back.querySelectorAll('.smb-os-opt').forEach(el => {
    const radio = el.querySelector('input');
    el.classList.toggle('is-active', radio.checked);
  });
  back.querySelector('#smb-mac-steps').hidden = os !== 'mac';
  back.querySelector('#smb-win-steps').hidden = os !== 'win';
}

function applyPwMask(back) {
  const pw = back.querySelector('#smb-pw');
  const toggle = back.querySelector('#smb-pw-toggle');
  const revealed = toggle.getAttribute('aria-pressed') === 'true';
  const value = pw.dataset.value || '';
  pw.textContent = revealed
    ? value
    : (value ? '•'.repeat(Math.min(24, Math.max(8, value.length))) : '—');
  const useEl = toggle.querySelector('use');
  useEl.setAttribute('href', SPRITE + (revealed ? '#eye-off' : '#eye'));
  toggle.title = revealed ? 'Passwort verbergen' : 'Passwort anzeigen';
  toggle.setAttribute('aria-label', toggle.title);
}

function attachModalCloseHandlers(back) {
  const close = () => back.remove();
  back.querySelector('[data-act="close"]').addEventListener('click', close);
  back.addEventListener('click', e => { if (e.target === back) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', esc);
      close();
    }
  });
}

async function openModal() {
  let info;
  try {
    info = await api.getSmbInfo();
  } catch (e) {
    toast.error(e.message);
    return;
  }

  const host = browserHost();
  const loopback = isLoopback(host);
  const back = buildModal(info, loopback);
  let os = loadOS();

  const macVal = macUrl(host, info);
  const winVal = windowsUnc(host, info);

  const macLink = back.querySelector('#smb-mac-link');
  macLink.href = macVal;
  back.querySelector('#smb-mac-url').textContent = macVal;
  back.querySelector('#smb-win-url').textContent = winVal;
  back.querySelector('#smb-user').textContent = info.user;

  // Loopback: Mac-Link und Copy-Buttons stilllegen, weil ein Mount auf
  // localhost auf beiden OS scheitert. Adresse bleibt sichtbar, damit
  // klar ist, was hinter dem Hinweis-Banner steckt.
  if (loopback) {
    macLink.classList.add('is-disabled');
    macLink.removeAttribute('href');
    back.querySelector('#smb-mac-copy').disabled = true;
    back.querySelector('#smb-win-copy').disabled = true;
  }

  const pw = back.querySelector('#smb-pw');
  pw.dataset.value = info.password || '';
  applyPwMask(back);
  applyOSSelection(back, os);

  attachModalCloseHandlers(back);

  back.querySelectorAll('input[name="smb-os"]').forEach(el => {
    el.addEventListener('change', () => {
      if (el.checked) {
        os = el.value;
        saveOS(os);
        applyOSSelection(back, os);
      }
    });
  });

  back.querySelector('#smb-mac-copy').addEventListener('click', () => copy(macVal));
  back.querySelector('#smb-win-copy').addEventListener('click', () => copy(winVal));
  back.querySelector('#smb-user-copy').addEventListener('click', () => copy(info.user));
  back.querySelector('#smb-pw-copy').addEventListener('click', () => {
    const value = pw.dataset.value || '';
    if (!value) { toast.error('Kein Passwort verfügbar'); return; }
    copy(value);
  });

  const toggle = back.querySelector('#smb-pw-toggle');
  toggle.addEventListener('click', () => {
    const revealed = toggle.getAttribute('aria-pressed') === 'true';
    toggle.setAttribute('aria-pressed', revealed ? 'false' : 'true');
    applyPwMask(back);
  });
}

export function init() {
  const btn = document.getElementById('smb-btn');
  if (!btn) return;
  btn.addEventListener('click', openModal);
  applyFeatureState(btn);
}

async function applyFeatureState(btn) {
  // Default-Annahme bis zur Antwort: deaktiviert. So bleibt der Button
  // nicht versehentlich klickbar, falls die Features-Antwort hängt oder
  // fehlschlägt.
  const disabledTooltip = 'Die SMB-Funktion zur Einbindung des Dateisystems als Netzlaufwerk ist deaktiviert.';
  btn.disabled = true;
  btn.setAttribute('aria-disabled', 'true');
  btn.title = disabledTooltip;

  try {
    const features = await api.getFeatures();
    const enabled = features?.smb?.enabled === true;
    if (enabled) {
      btn.disabled = false;
      btn.removeAttribute('aria-disabled');
      btn.title = 'Workspace als Netzlaufwerk verbinden';
    }
  } catch {
    // Endpoint nicht erreichbar → Button bleibt im sicheren Default
    // (disabled). Kein Toast: stilles Degradieren reicht für ein
    // optionales Feature.
  }
}
