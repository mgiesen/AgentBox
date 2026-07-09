// Generische Prompt- und Confirm-Dialoge. Feature-spezifische Modale
// (z.B. der Konfigurations-Editor in config.js) bauen ihren eigenen
// Backdrop direkt — hier nur die zwei Standardfälle.

export function promptModal(title, label, defaultValue) {
  return new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${title}</h3>
          <p>${label}</p>
        </div>
        <div class="modal-body">
          <input type="text" id="modal-input" value="">
        </div>
        <div class="modal-foot">
          <button class="btn" data-act="cancel">Abbrechen</button>
          <button class="btn btn-primary" data-act="ok">Übernehmen</button>
        </div>
      </div>`;
    document.body.appendChild(back);
    const input = back.querySelector('#modal-input');
    input.value = defaultValue || '';
    input.focus();
    input.select();
    const close = v => { back.remove(); resolve(v); };
    back.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    back.querySelector('[data-act="ok"]').addEventListener('click', () => close(input.value.trim()));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') close(input.value.trim());
      if (e.key === 'Escape') close(null);
    });
    back.addEventListener('click', e => { if (e.target === back) close(null); });
  });
}

export function confirmModal(title, msg, okLabel, variant = 'danger') {
  return new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${title}</h3>
          <p>${msg}</p>
        </div>
        <div class="modal-foot">
          <button class="btn" data-act="cancel">Abbrechen</button>
          <button class="btn btn-${variant}" data-act="ok">${okLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(back);
    back.querySelector('[data-act="ok"]').focus();
    const close = v => { back.remove(); resolve(v); };
    back.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
    back.querySelector('[data-act="ok"]').addEventListener('click', () => close(true));
    back.addEventListener('click', e => { if (e.target === back) close(false); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', esc); close(false); }
    });
  });
}
