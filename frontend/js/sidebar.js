// Header-Toggle für die Sidebar; löst Refresh aus, wenn die Sidebar
// geöffnet wird (Inhalt könnte während des Geschlossen-Seins veraltet
// sein, falls SSE-Verbindung kurzzeitig wegbrach).

import { refresh } from './files.js';
import { closeMenu } from './menu.js';

export function init() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle');

  function setOpen(open) {
    if (open) {
      sidebar.setAttribute('data-open', '');
      toggleBtn.setAttribute('aria-pressed', 'true');
      refresh();
    } else {
      sidebar.removeAttribute('data-open');
      toggleBtn.setAttribute('aria-pressed', 'false');
      closeMenu();
    }
  }

  toggleBtn.addEventListener('click', () => setOpen(!sidebar.hasAttribute('data-open')));
}
