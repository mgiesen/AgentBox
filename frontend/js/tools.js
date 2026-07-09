// Werkzeuge-Modal: zeigt die zum Image-Build erzeugte Übersicht der
// eingebackenen Agents und Skills. Die Daten kommen aus dem statischen
// Manifest /agent-toolkit.json (siehe scripts/build-toolkit-manifest.py
// und der Build-Step im Dockerfile). Kein /api/-Roundtrip — die Liste
// ändert sich nur mit dem Image, daher reicht ein einmaliger fetch().

const SPRITE = '/icons/sprite.svg';

let cachedManifest = null;

async function loadManifest() {
  if (cachedManifest) return cachedManifest;
  const r = await fetch('/agent-toolkit.json', { credentials: 'same-origin' });
  if (!r.ok) throw new Error('Manifest nicht erreichbar (HTTP ' + r.status + ')');
  cachedManifest = await r.json();
  return cachedManifest;
}

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderCard(entry, { showFeatures }) {
  const features = showFeatures && Array.isArray(entry.features) && entry.features.length
    ? `<ul class="toolkit-card-features">
         ${entry.features.map(f => `<li>${escapeHTML(f)}</li>`).join('')}
       </ul>`
    : '';
  const version = entry.version
    ? `<span class="toolkit-card-version">v${escapeHTML(entry.version)}</span>`
    : '';
  return `
    <article class="toolkit-card">
      <div class="toolkit-card-head">
        <span class="toolkit-card-name">${escapeHTML(entry.name)}</span>
        ${version}
      </div>
      <p class="toolkit-card-desc">${escapeHTML(entry.description)}</p>
      ${features}
    </article>`;
}

function renderEmpty(label) {
  return `<div class="toolkit-empty">Keine ${label} im aktuellen Image.</div>`;
}

function buildModal() {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `
    <div class="modal modal--lg toolkit-modal" role="dialog" aria-modal="true" aria-labelledby="toolkit-modal-title">
      <div class="modal-head">
        <h3 id="toolkit-modal-title">Werkzeugübersicht</h3>
      </div>
      <div class="modal-body">
        <div class="toolkit-tabs" role="tablist" aria-label="Werkzeug-Typ">
          <button class="toolkit-tab is-active" type="button" role="tab" aria-selected="true" data-tab="skills">
            <svg width="14" height="14" aria-hidden="true"><use href="${SPRITE}#wrench"/></svg>
            <span>Skills</span>
          </button>
          <button class="toolkit-tab" type="button" role="tab" aria-selected="false" data-tab="agents">
            <svg width="14" height="14" aria-hidden="true"><use href="${SPRITE}#book-open"/></svg>
            <span>Agenten</span>
          </button>
        </div>
        <div class="toolkit-panel" id="toolkit-panel-skills" role="tabpanel"></div>
        <div class="toolkit-panel" id="toolkit-panel-agents" role="tabpanel" hidden></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-primary" data-act="close">Schließen</button>
      </div>
    </div>`;
  document.body.appendChild(back);
  return back;
}

function activateTab(back, tab) {
  for (const btn of back.querySelectorAll('.toolkit-tab')) {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  back.querySelector('#toolkit-panel-skills').hidden = tab !== 'skills';
  back.querySelector('#toolkit-panel-agents').hidden = tab !== 'agents';
}

function attachClose(back) {
  const close = () => {
    document.removeEventListener('keydown', esc);
    back.remove();
  };
  function esc(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', esc);
  back.querySelector('[data-act="close"]').addEventListener('click', close);
  back.addEventListener('click', e => { if (e.target === back) close(); });
}

async function openModal() {
  const back = buildModal();
  attachClose(back);

  for (const btn of back.querySelectorAll('.toolkit-tab')) {
    btn.addEventListener('click', () => activateTab(back, btn.dataset.tab));
  }

  const skillsPanel = back.querySelector('#toolkit-panel-skills');
  const agentsPanel = back.querySelector('#toolkit-panel-agents');
  skillsPanel.innerHTML = `<div class="toolkit-empty">Lade …</div>`;
  agentsPanel.innerHTML = `<div class="toolkit-empty">Lade …</div>`;

  let manifest;
  try {
    manifest = await loadManifest();
  } catch (e) {
    const msg = `<div class="toolkit-empty">Manifest konnte nicht geladen werden: ${escapeHTML(e.message)}</div>`;
    skillsPanel.innerHTML = msg;
    agentsPanel.innerHTML = msg;
    return;
  }

  const skills = manifest.skills || [];
  const agents = manifest.agents || [];
  skillsPanel.innerHTML = skills.length
    ? skills.map(s => renderCard(s, { showFeatures: true })).join('')
    : renderEmpty('Skills');
  agentsPanel.innerHTML = agents.length
    ? agents.map(a => renderCard(a, { showFeatures: false })).join('')
    : renderEmpty('Agenten');
}

export function init() {
  const btn = document.getElementById('tools-btn');
  if (!btn) return;
  btn.addEventListener('click', openModal);
}
