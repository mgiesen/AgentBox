// fetch-Wrapper für /api/*. Eine Stelle pro Endpunkt; UI-Module sehen
// keine URLs, keine Header, keine Status-Code-Behandlung jenseits von
// "ok / Fehler".

export async function listFiles() {
  const r = await fetch('/api/files');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

const encPath = path => encodeURIComponent(path);

export function joinPath(dir, name) {
  return dir ? dir.replace(/\/+$/, '') + '/' + name : name;
}

export function basename(path) {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(i + 1) : path;
}

export function dirname(path) {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(0, i) : '';
}

export function uploadFile(file, dir = '', onProgress) {
  const target = joinPath(dir, file.name);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', '/api/files/' + encPath(target));
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(1);
        resolve();
      } else {
        let msg = 'HTTP ' + xhr.status;
        try { const j = JSON.parse(xhr.responseText); if (j.error) msg = j.error; } catch (_) {}
        reject(new Error(msg));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Netzwerkfehler')));
    xhr.addEventListener('abort', () => reject(new Error('Upload abgebrochen')));
    xhr.send(file);
  });
}

export async function createDir(path) {
  const r = await fetch('/api/dirs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || r.statusText);
  }
}

export async function movePath(from, to) {
  const r = await fetch('/api/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || r.statusText);
  }
}

export async function renameFile(oldPath, newName) {
  const r = await fetch('/api/files/' + encPath(oldPath) + '/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: newName }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || r.statusText);
  }
}

export async function deleteFile(name) {
  const r = await fetch('/api/files/' + encPath(name), { method: 'DELETE' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
}

export async function bulkDelete(names) {
  const r = await fetch('/api/files/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ names }),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

export async function bulkZip(names) {
  const r = await fetch('/api/files/zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ names }),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.blob();
}

export function fileDownloadURL(name) {
  return '/api/files/' + encPath(name);
}

export async function getConfig() {
  const r = await fetch('/api/config');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

export async function saveConfig(content) {
  const r = await fetch('/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!r.ok) throw new Error('Speichern fehlgeschlagen (HTTP ' + r.status + ')');
}

export async function restartAgent() {
  const r = await fetch('/api/restart-agent', { method: 'POST' });
  if (!r.ok) throw new Error('Neustart fehlgeschlagen (HTTP ' + r.status + ')');
}

export async function getSmbInfo() {
  const r = await fetch('/api/smb-info');
  if (!r.ok) throw new Error('SMB-Info konnte nicht geladen werden (HTTP ' + r.status + ')');
  return r.json();
}

export async function getFeatures() {
  const r = await fetch('/api/features');
  if (!r.ok) throw new Error('Features konnten nicht geladen werden (HTTP ' + r.status + ')');
  return r.json();
}
