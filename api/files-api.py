#!/usr/bin/env python3
"""Minimaler HTTP-Service für /workspace mit Live-Sync.

Routen (alle relativ zur API-Basis, vom Reverse Proxy auf /api/* gemappt):
  GET    /api/files                 → JSON-Baum
  PUT    /api/files/<path>          → Body = Inhalt, legt Datei an oder ersetzt sie
  GET    /api/files/<path>          → Download
  DELETE /api/files/<path>          → Datei/Ordner löschen
  POST   /api/files/<path>/rename   → Body = {"to": "<neuer name>"}
  POST   /api/dirs                  → Body = {"path": "<ordner>"}
  POST   /api/move                  → Body = {"from": "<alt>", "to": "<neu>"}
  GET    /api/events                → Server-Sent-Events-Stream (refresh-Notifications)

Alle Pfade sind relative Workspace-Pfade. Absolute Pfade, leere Segmente,
Backslashes, Nullbytes, ".." und der reservierte Root ".config" sind verboten.
"""

import http.server
import io
import json
import os
import queue
import shutil
import signal
import socketserver
import threading
import time
import zipfile
from pathlib import Path
from urllib.parse import unquote, urlparse

WORKSPACE = Path(os.environ.get("WORKSPACE", "/workspace"))
RESERVED_ROOTS = {".config"}
CONFIG_PATH = Path(os.environ.get(
    "OPENCODE_CONFIG_PATH",
    "/home/agent/.config/opencode/opencode.json",
))
PORT = int(os.environ.get("FILES_API_PORT", "8000"))
HOST = os.environ.get("FILES_API_HOST", "127.0.0.1")
WATCH_INTERVAL = float(os.environ.get("WATCH_INTERVAL", "0.5"))
HEARTBEAT_INTERVAL = 15.0
AGENT_PROCESS_NAME = "opencode"


def safe_rel_path(raw: str, *, allow_root: bool = False) -> Path:
    decoded = unquote(raw or "")
    if decoded.startswith("/") or "\\" in decoded or "\x00" in decoded:
        raise ValueError("ungültiger Pfad")
    cleaned = decoded.strip("/")
    if cleaned == "":
        if allow_root:
            return Path()
        raise ValueError("Pfad darf nicht leer sein")

    parts = cleaned.split("/")
    if any(part in ("", ".", "..") for part in parts):
        raise ValueError("ungültiger Pfad")
    if any(part in RESERVED_ROOTS for part in parts):
        raise ValueError("reservierter Pfad")
    return Path(*parts)


def safe_leaf_name(name: str) -> str:
    rel = safe_rel_path(name)
    if len(rel.parts) != 1:
        raise ValueError("Name darf keinen Pfad enthalten")
    return rel.name


def workspace_path(raw: str, *, allow_root: bool = False) -> Path:
    rel = safe_rel_path(raw, allow_root=allow_root)
    candidate = WORKSPACE / rel
    root = WORKSPACE.resolve()

    # Für existierende Pfade prüfen wir den vollständigen realen Pfad. Für neue
    # Dateien/Ordner reicht der existierende Parent; so bleiben neue Namen möglich.
    check = candidate if candidate.exists() else candidate.parent
    try:
        resolved = check.resolve()
    except FileNotFoundError:
        raise ValueError("Zielordner existiert nicht")
    if resolved != root and root not in resolved.parents:
        raise ValueError("Pfad verlässt den Workspace")
    return candidate


def rel_str(path: Path) -> str:
    return path.as_posix()


def entry_dict(path: Path) -> dict:
    rel = path.relative_to(WORKSPACE)
    st = path.stat()
    if path.is_dir():
        return {
            "type": "dir",
            "name": path.name,
            "path": rel_str(rel),
            "mtime": int(st.st_mtime),
            "children": list_entries(path),
        }
    return {
        "type": "file",
        "name": path.name,
        "path": rel_str(rel),
        "size": st.st_size,
        "mtime": int(st.st_mtime),
    }


def list_entries(base: Path) -> list[dict]:
    entries = []
    try:
        children = sorted(base.iterdir(), key=lambda p: p.name.lower())
    except FileNotFoundError:
        return entries

    for child in children:
        if child.name in RESERVED_ROOTS:
            continue
        if child.is_symlink():
            continue
        if child.is_dir() or child.is_file():
            entries.append(entry_dict(child))
    return sorted(entries, key=lambda e: (e["type"] != "dir", e["name"].lower()))


def flatten_files(entries: list[dict]) -> list[dict]:
    files = []
    for entry in entries:
        if entry["type"] == "file":
            files.append(entry)
        else:
            files.extend(flatten_files(entry["children"]))
    return files


def add_to_zip(zf: zipfile.ZipFile, path: Path, arcname: str):
    if path.is_symlink():
        return
    if path.is_file():
        zf.write(str(path), arcname=arcname)
        return
    if path.is_dir():
        for child in sorted(path.iterdir(), key=lambda p: p.name.lower()):
            add_to_zip(zf, child, f"{arcname}/{child.name}")


# ---------------------------------------------------------------------------
# Workspace-Watcher: hält Snapshot, benachrichtigt Subscriber bei Änderung.
# ---------------------------------------------------------------------------

class Watcher:
    def __init__(self, path: Path, interval: float):
        self.path = path
        self.interval = interval
        self._subscribers: list[queue.Queue] = []
        self._lock = threading.Lock()
        self._snapshot = self._take_snapshot()
        t = threading.Thread(target=self._loop, name="ws-watcher", daemon=True)
        t.start()

    def _take_snapshot(self) -> tuple:
        try:
            entries = []
            for root, dirs, files in os.walk(self.path):
                root_path = Path(root)
                dirs[:] = [
                    d for d in dirs
                    if d not in RESERVED_ROOTS and not (root_path / d).is_symlink()
                ]
                for d in dirs:
                    p = root_path / d
                    st = p.stat()
                    entries.append((rel_str(p.relative_to(self.path)), "dir", 0, int(st.st_mtime)))
                for f in files:
                    p = root_path / f
                    if p.is_symlink():
                        continue
                    st = p.stat()
                    entries.append((rel_str(p.relative_to(self.path)), "file", st.st_size, int(st.st_mtime)))
            return tuple(sorted(entries))
        except FileNotFoundError:
            return ()
        except Exception as e:
            print(f"watcher: snapshot error: {e}", flush=True)
            return self._snapshot if hasattr(self, "_snapshot") else ()

    def _loop(self):
        while True:
            time.sleep(self.interval)
            try:
                current = self._take_snapshot()
                if current != self._snapshot:
                    self._snapshot = current
                    self._broadcast("refresh")
            except Exception as e:
                print(f"watcher: loop error: {e}", flush=True)

    def _broadcast(self, event: str):
        with self._lock:
            for q in self._subscribers:
                try:
                    q.put_nowait(event)
                except queue.Full:
                    pass  # Subscriber hängt — Event verwerfen, der nächste kommt

    def subscribe(self) -> queue.Queue:
        q = queue.Queue(maxsize=8)
        with self._lock:
            self._subscribers.append(q)
        return q

    def unsubscribe(self, q: queue.Queue):
        with self._lock:
            try:
                self._subscribers.remove(q)
            except ValueError:
                pass


WATCHER: Watcher | None = None


# ---------------------------------------------------------------------------
# HTTP-Handler
# ---------------------------------------------------------------------------

class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "agentbox-files/1.1"

    def _json(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _err(self, status, msg):
        self._json(status, {"error": msg})

    def _resolve(self, path, *, allow_root=False):
        return workspace_path(path, allow_root=allow_root)

    # ---- SSE -----------------------------------------------------------------

    def _serve_events(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        q = WATCHER.subscribe()
        try:
            self.wfile.write(b"retry: 2000\n")
            self.wfile.write(b"event: hello\ndata: connected\n\n")
            self.wfile.flush()

            while True:
                try:
                    event = q.get(timeout=HEARTBEAT_INTERVAL)
                    self.wfile.write(f"event: {event}\ndata: ok\n\n".encode())
                    self.wfile.flush()
                except queue.Empty:
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass
        finally:
            WATCHER.unsubscribe(q)

    # ---- Standardrouten ------------------------------------------------------

    # ---- Agent-Helpers ------------------------------------------------------

    def _find_opencode_pids(self) -> list[int]:
        pids: list[int] = []
        try:
            entries = os.listdir("/proc")
        except OSError:
            return pids
        for entry in entries:
            if not entry.isdigit():
                continue
            pid = int(entry)
            try:
                with open(f"/proc/{pid}/comm", "r") as f:
                    comm = f.read().strip()
            except (FileNotFoundError, PermissionError, ProcessLookupError):
                continue
            if comm == AGENT_PROCESS_NAME:
                pids.append(pid)
        return pids

    def _kill_opencode(self) -> list[int]:
        """Beendet alle laufenden OpenCode-Prozesse. Die TUI ignoriert
        SIGTERM teils; daher zweistufig — erst SIGTERM für sauberes
        Shutdown, nach kurzer Wartezeit SIGKILL für hängende Prozesse.
        ttyd startet OpenCode bei der nächsten PTY-Verbindung neu
        (siehe start-agent.sh)."""
        targets = self._find_opencode_pids()
        killed: list[int] = []
        for pid in targets:
            try:
                os.kill(pid, signal.SIGTERM)
                killed.append(pid)
            except (ProcessLookupError, PermissionError):
                pass
        if targets:
            time.sleep(0.5)
            for pid in targets:
                try:
                    os.kill(pid, 0)  # existiert noch?
                except (ProcessLookupError, PermissionError):
                    continue
                try:
                    os.kill(pid, signal.SIGKILL)
                except (ProcessLookupError, PermissionError):
                    pass
        return killed

    # ---- Standardrouten ------------------------------------------------------

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/api/events":
            return self._serve_events()

        if path == "/api/config":
            try:
                content = CONFIG_PATH.read_text(encoding="utf-8")
            except FileNotFoundError:
                content = ""
            return self._json(200, {"path": str(CONFIG_PATH), "content": content})

        if path == "/api/files":
            entries = list_entries(WORKSPACE)
            return self._json(200, {"entries": entries, "files": flatten_files(entries)})

        if path.startswith("/api/files/"):
            item_path = path[len("/api/files/"):]
            try:
                fp = self._resolve(item_path)
            except ValueError as e:
                return self._err(400, str(e))
            if fp.is_symlink() or not fp.is_file():
                return self._err(404, "nicht gefunden")
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(fp.stat().st_size))
            self.send_header("Content-Disposition", f'attachment; filename="{fp.name}"')
            self.end_headers()
            with fp.open("rb") as f:
                shutil.copyfileobj(f, self.wfile)
            return

        self._err(404, "unbekannte Route")

    def do_PUT(self):
        path = urlparse(self.path).path

        if path == "/api/config":
            length = int(self.headers.get("Content-Length", "0"))
            try:
                body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
                content = body.get("content", "")
                if not isinstance(content, str):
                    raise ValueError("content muss ein String sein")
            except (ValueError, json.JSONDecodeError) as e:
                return self._err(400, f"ungültige Anfrage: {e}")
            CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
            # Atomar schreiben (erst *.tmp, dann rename), damit ein Crash mitten
            # im Schreiben nicht zu einer leeren/halben Datei führt.
            tmp_path = CONFIG_PATH.with_suffix(CONFIG_PATH.suffix + ".tmp")
            tmp_path.write_text(content, encoding="utf-8")
            tmp_path.replace(CONFIG_PATH)
            return self._json(200, {"saved": True, "path": str(CONFIG_PATH)})

        if not path.startswith("/api/files/"):
            return self._err(404, "unbekannte Route")
        item_path = path[len("/api/files/"):]
        try:
            fp = self._resolve(item_path)
        except ValueError as e:
            return self._err(400, str(e))
        if fp.exists() and (fp.is_dir() or fp.is_symlink()):
            return self._err(409, "Ziel ist keine Datei")
        if not fp.parent.is_dir() or fp.parent.is_symlink():
            return self._err(400, "Zielordner existiert nicht")
        length = int(self.headers.get("Content-Length", "0"))
        with fp.open("wb") as f:
            remaining = length
            while remaining > 0:
                chunk = self.rfile.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                f.write(chunk)
                remaining -= len(chunk)
        st = fp.stat()
        return self._json(201, {"path": rel_str(fp.relative_to(WORKSPACE)), "name": fp.name, "size": st.st_size})

    def do_DELETE(self):
        path = urlparse(self.path).path
        if not path.startswith("/api/files/"):
            return self._err(404, "unbekannte Route")
        item_path = path[len("/api/files/"):]
        try:
            fp = self._resolve(item_path)
        except ValueError as e:
            return self._err(400, str(e))
        if fp.is_symlink() or not fp.exists():
            return self._err(404, "nicht gefunden")
        if fp.is_dir():
            shutil.rmtree(fp)
        elif fp.is_file():
            fp.unlink()
        else:
            return self._err(400, "nicht unterstützter Eintrag")
        return self._json(200, {"deleted": item_path})

    def do_POST(self):
        path = urlparse(self.path).path

        if path == "/api/restart-agent":
            killed = self._kill_opencode()
            # ttyd startet den konfigurierten Agent bei der nächsten
            # WS-Verbindung wieder. Frontend reloadet das iframe nach
            # diesem Call.
            return self._json(200, {"killed": killed})

        if path == "/api/dirs":
            length = int(self.headers.get("Content-Length", "0"))
            try:
                body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
                dir_path = body.get("path", "")
                if not isinstance(dir_path, str):
                    raise ValueError("path muss ein String sein")
                target = self._resolve(dir_path)
            except (ValueError, json.JSONDecodeError) as e:
                return self._err(400, f"ungültige Anfrage: {e}")
            if target.exists():
                return self._err(409, "Ziel existiert bereits")
            if not target.parent.is_dir() or target.parent.is_symlink():
                return self._err(400, "Zielordner existiert nicht")
            target.mkdir()
            return self._json(201, {"path": rel_str(target.relative_to(WORKSPACE))})

        if path == "/api/move":
            length = int(self.headers.get("Content-Length", "0"))
            try:
                body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
                src_raw = body["from"]
                dst_raw = body["to"]
                if not isinstance(src_raw, str) or not isinstance(dst_raw, str):
                    raise ValueError("from und to müssen Strings sein")
                src = self._resolve(src_raw)
                dst = self._resolve(dst_raw)
            except (KeyError, ValueError, json.JSONDecodeError) as e:
                return self._err(400, f"ungültige Anfrage: {e}")
            if src.is_symlink() or not src.exists():
                return self._err(404, "Quelle nicht gefunden")
            if dst.exists():
                return self._err(409, "Ziel existiert bereits")
            if not dst.parent.is_dir() or dst.parent.is_symlink():
                return self._err(400, "Zielordner existiert nicht")
            if src.is_dir() and (dst == src or src in dst.parents):
                return self._err(400, "Ordner kann nicht in sich selbst verschoben werden")
            src.rename(dst)
            return self._json(200, {
                "moved": {
                    "from": rel_str(src.relative_to(WORKSPACE)),
                    "to": rel_str(dst.relative_to(WORKSPACE)),
                }
            })

        if path == "/api/files/zip":
            length = int(self.headers.get("Content-Length", "0"))
            try:
                body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
                names = body.get("names", [])
                if not isinstance(names, list):
                    raise ValueError("names muss eine Liste sein")
            except (ValueError, json.JSONDecodeError) as e:
                return self._err(400, f"ungültige Anfrage: {e}")

            valid = []
            for n in names:
                if not isinstance(n, str):
                    continue
                try:
                    valid.append(self._resolve(n))
                except ValueError:
                    continue

            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
                for fp in valid:
                    if fp.exists() and not fp.is_symlink():
                        add_to_zip(zf, fp, rel_str(fp.relative_to(WORKSPACE)))
            data = buf.getvalue()

            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Content-Disposition", 'attachment; filename="agent-files.zip"')
            self.end_headers()
            self.wfile.write(data)
            return

        if path == "/api/files/delete":
            length = int(self.headers.get("Content-Length", "0"))
            try:
                body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
                names = body.get("names", [])
                if not isinstance(names, list):
                    raise ValueError("names muss eine Liste sein")
            except (ValueError, json.JSONDecodeError) as e:
                return self._err(400, f"ungültige Anfrage: {e}")

            deleted, failed = [], []
            for n in names:
                if not isinstance(n, str):
                    failed.append({"name": str(n), "error": "ungültiger Eintrag"})
                    continue
                try:
                    fp = self._resolve(n)
                except ValueError as e:
                    failed.append({"name": n, "error": str(e)})
                    continue
                if fp.is_symlink() or not fp.exists():
                    failed.append({"name": n, "error": "nicht gefunden"})
                    continue
                try:
                    if fp.is_dir():
                        shutil.rmtree(fp)
                    elif fp.is_file():
                        fp.unlink()
                    else:
                        raise OSError("nicht unterstützter Eintrag")
                    deleted.append(n)
                except OSError as e:
                    failed.append({"name": n, "error": str(e)})
            return self._json(200, {"deleted": deleted, "failed": failed})

        if path.startswith("/api/files/") and path.endswith("/rename"):
            old = path[len("/api/files/"):-len("/rename")]
            try:
                src = self._resolve(old)
            except ValueError as e:
                return self._err(400, str(e))
            if src.is_symlink() or not src.exists():
                return self._err(404, "nicht gefunden")
            length = int(self.headers.get("Content-Length", "0"))
            try:
                body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
                new = safe_leaf_name(body["to"])
            except (KeyError, ValueError, json.JSONDecodeError) as e:
                return self._err(400, f"ungültige Anfrage: {e}")
            dst = src.parent / new
            if dst.exists():
                return self._err(409, "Ziel existiert bereits")
            src.rename(dst)
            return self._json(200, {"renamed": {
                "from": rel_str(src.relative_to(WORKSPACE)),
                "to": rel_str(dst.relative_to(WORKSPACE)),
            }})

        self._err(404, "unbekannte Route")

    def log_message(self, fmt, *args):
        super().log_message(fmt, *args)


class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    global WATCHER
    WORKSPACE.mkdir(parents=True, exist_ok=True)
    WATCHER = Watcher(WORKSPACE, WATCH_INTERVAL)
    server = ThreadingServer((HOST, PORT), Handler)
    print(f"files-api on {HOST}:{PORT} → {WORKSPACE} (watch={WATCH_INTERVAL}s)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
