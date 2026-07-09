// Logout-Button im Header. Bestätigt vorher per Modal, dann ruft den
// Logout-Endpoint der Agent-API auf — der setzt das Session-Cookie auf
// Max-Age=0 — und leitet zur Login-Seite weiter. Auch wenn der
// Server-Call fehlschlägt: zur Login-Seite gehen, das nächste
// Auth-Check führt sowieso dorthin.

import { confirmModal } from './modals.js';

export function init() {
  const btn = document.getElementById('logout-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const ok = await confirmModal(
      'Aus aktueller Session ausloggen?',
      'Möchtest du dich wirklich aus der aktuellen Session ausloggen?',
      'Ausloggen',
      'primary',
    );
    if (!ok) return;
    btn.disabled = true;
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      // ignore — wir gehen so oder so zur Login-Seite
    }
    window.location.replace('/login');
  });
}
