// Kompakte Toast-Notifications. Lazy initialisiert; einfach
// `toast.success("…")` oder `toast.error("…")` aus jedem Modul aufrufen.
// Auto-dismiss nach 3 s, pausiert solange der Cursor draufsteht, beim Klick
// sofort weg. Multi-Stack unten rechts.

const SPRITE = '/icons/sprite.svg';
const DEFAULT_DURATION = 3000;

const ICONS = {
  success: 'check-bold',
  error: 'x',
};

let containerEl = null;

function ensureContainer() {
  if (containerEl) return containerEl;
  containerEl = document.createElement('div');
  containerEl.className = 'toast-container';
  containerEl.setAttribute('role', 'status');
  containerEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(containerEl);
  return containerEl;
}

function show(type, message, duration = DEFAULT_DURATION) {
  const root = ensureContainer();
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  const iconId = ICONS[type];
  const iconHTML = iconId
    ? `<span class="toast-icon"><svg width="12" height="12" aria-hidden="true"><use href="${SPRITE}#${iconId}"/></svg></span>`
    : '';
  el.innerHTML = `${iconHTML}<span class="toast-msg"></span>`;
  el.querySelector('.toast-msg').textContent = message;
  root.appendChild(el);

  let timer = setTimeout(() => dismiss(el), duration);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { timer = setTimeout(() => dismiss(el), 1500); });
  el.addEventListener('click', () => { clearTimeout(timer); dismiss(el); });
  return el;
}

function dismiss(el) {
  if (!el.parentNode) return;
  el.classList.add('toast--out');
  setTimeout(() => el.remove(), 180);
}

export const toast = {
  success: (msg, duration) => show('success', msg, duration),
  error:   (msg, duration) => show('error',   msg, duration ?? 5000),
};
