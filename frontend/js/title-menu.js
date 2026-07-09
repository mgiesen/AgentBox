// AgentBox-Titel als Dropdown-Trigger. Das Menü darunter trägt zwei
// App-weite Aktionen (OpenCode-Konfiguration, Handbuch); die Klick-Handler
// liegen weiterhin in config.js und docs.js — dieses Modul kümmert sich
// nur um Aufklappen, Schließen und das Caret im Trigger.

let trigger, list;

function open() {
  list.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  document.addEventListener('mousedown', onOutsideClick, true);
  document.addEventListener('keydown', onKeydown, true);
}

function close() {
  list.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  document.removeEventListener('mousedown', onOutsideClick, true);
  document.removeEventListener('keydown', onKeydown, true);
}

function toggle() {
  if (list.hidden) open(); else close();
}

function onOutsideClick(e) {
  if (!list.contains(e.target) && !trigger.contains(e.target)) close();
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    e.stopPropagation();
    close();
    trigger.focus();
  }
}

export function init() {
  trigger = document.getElementById('title-menu-trigger');
  list    = document.getElementById('title-menu-list');
  if (!trigger || !list) return;

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    toggle();
  });

  // Klick auf einen Eintrag schließt das Menü, bevor das Modal/Tab
  // aufgeht — sonst bleibt das Dropdown hinter dem Backdrop sichtbar.
  for (const item of list.querySelectorAll('.title-menu-item')) {
    item.addEventListener('click', () => close());
  }
}
