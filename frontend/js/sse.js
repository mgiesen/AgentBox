// Live-Sync mit der Files-API: refresh() bei jedem 'refresh'-Event und
// initial bei 'hello' (für den Fall, dass die Verbindung neu aufgebaut
// wurde, während die Datei-Liste schon im DOM stand).

import { refresh } from './files.js';

export function start() {
  try {
    const sse = new EventSource('/api/events');
    sse.addEventListener('hello',   () => refresh());
    sse.addEventListener('refresh', () => refresh());
  } catch (e) {
    console.warn('EventSource nicht verfügbar:', e);
  }
}
