// Auswahl-Status der Sidebar.
// Browse-First-Modell: Klick = single, Cmd/Ctrl-Klick = toggle,
// Shift-Klick = range, Klick auf Hover-Checkbox = toggle.
// Die Selection-Bar (sticky Footer) erscheint, sobald >0 Einträge gewählt sind.

const _selected = new Set();
let _anchorIndex = -1;

let selBarEl, selCountEl, clearBtn;

export function has(name) { return _selected.has(name); }
export function size() { return _selected.size; }
export function names() { return [..._selected]; }
export function anchor() { return _anchorIndex; }

// Auswahl auf real existierende Pfade beschneiden (nach Refresh).
export function intersect(presentNames) {
  for (const n of [..._selected]) if (!presentNames.has(n)) _selected.delete(n);
}

export function clear() {
  _selected.clear();
  _anchorIndex = -1;
  updateUI();
}

export function single(path, index) {
  _selected.clear();
  _selected.add(path);
  _anchorIndex = index;
  updateUI();
}

export function toggle(path, index) {
  if (_selected.has(path)) _selected.delete(path);
  else _selected.add(path);
  _anchorIndex = index;
  updateUI();
}

export function add(paths) {
  for (const p of paths) _selected.add(p);
  updateUI();
}

export function replace(paths) {
  _selected.clear();
  for (const p of paths) _selected.add(p);
  updateUI();
}

// Erweitert die Auswahl von _anchorIndex bis toIndex inklusive.
// visiblePaths ist die aktuell sichtbare flache Pfadliste.
export function range(visiblePaths, toIndex) {
  if (!visiblePaths.length) return;
  const from = _anchorIndex >= 0 ? _anchorIndex : toIndex;
  const [a, b] = from <= toIndex ? [from, toIndex] : [toIndex, from];
  for (let i = a; i <= b; i++) {
    const p = visiblePaths[i];
    if (p) _selected.add(p);
  }
  updateUI();
}

export function updateUI() {
  const n = _selected.size;

  // Row-Highlight
  document.querySelectorAll('.file-row').forEach(r => {
    r.classList.toggle('selected', _selected.has(r.dataset.path));
  });

  const footer = document.getElementById('sidebar-footer');
  if (!selBarEl) return;
  if (n === 0) {
    selBarEl.setAttribute('hidden', '');
    if (footer) footer.removeAttribute('hidden');
  } else {
    selBarEl.removeAttribute('hidden');
    if (footer) footer.setAttribute('hidden', '');
    selCountEl.textContent = n === 1 ? '1 ausgewählt' : `${n} ausgewählt`;
  }
}

export function init() {
  selBarEl   = document.getElementById('selection-bar');
  selCountEl = document.getElementById('sel-count');
  clearBtn   = document.getElementById('sel-clear-btn');

  clearBtn.addEventListener('click', () => clear());
}
