# Files-API und Agent-API

Zwei Python-Services in `api/`, beide reine Stdlib (`http.server`), keine externen Abhängigkeiten:

| Service | Bind | Caddy-Mapping | Aufgabe |
|---|---|---|---|
| `files-api.py` | `127.0.0.1:8000` | `/api/*` | Workspace-Operationen (`/workspace`) |
| `agent-api.py` | `127.0.0.1:8001` | `/api/smb-info` | Agent-State und Geheimnisse (aktuell SMB-Verbindungsinfo) |

**Strukturelle Trennung:** Die Files-API darf strukturell nicht an Auth-Tokens oder SMB-Passwörter herankommen. Endpunkte, die das müssten, leben im `agent-api`. Der `/api/config`-Endpunkt für die OpenCode-Config ist die historische Ausnahme in der Files-API; perspektivisch zieht er ebenfalls ins Agent-API um — der saubere Migrationsschritt: Routen aus `files-api.py` entfernen, in `agent-api.py` aufnehmen, Caddy-Mapping `/api/config` auf `127.0.0.1:8001` ergänzen.

Die Files-API ist bewusst klein, weil sie nur eine Aufgabe hat: den Workspace als sichere Übergabestelle zwischen Browser und Agenten verfügbar machen. Sie ist kein allgemeiner Dateimanager für den Container.

Workspace-Pfade sind **relative Pfade** unter `/workspace`. Absolute Pfade, leere Segmente, Backslashes, Nullbytes, `.` und `..` sind verboten. Symlinks werden nicht verfolgt. Der Root `.config` ist reserviert.

## HTTP-Endpunkte

### Dateien

| Methode | Pfad | Wirkung |
|---|---|---|
| GET | `/api/files` | JSON-Baum aller Dateien und Ordner |
| PUT | `/api/files/<path>` | Body = Inhalt (raw); Datei anlegen/überschreiben |
| GET | `/api/files/<path>` | Datei-Download (`application/octet-stream`) |
| DELETE | `/api/files/<path>` | Datei oder Ordner löschen; Ordner rekursiv |
| POST | `/api/files/<path>/rename` | Body = `{"to": "<neuer-name>"}`; Umbenennen im selben Ordner |

### Ordner und Verschieben

| Methode | Pfad | Body | Wirkung |
|---|---|---|---|
| POST | `/api/dirs` | `{"path": "<ordner>"}` | Ordner erstellen |
| POST | `/api/move` | `{"from": "<alt>", "to": "<neu>"}` | Datei oder Ordner verschieben |

### Bulk-Operationen

| Methode | Pfad | Body | Wirkung |
|---|---|---|---|
| POST | `/api/files/zip` | `{"names": [...]}` | ZIP-Stream mit den genannten Dateien und Ordnerinhalten |
| POST | `/api/files/delete` | `{"names": [...]}` | mehrfaches Löschen, liefert `{"deleted": [...], "failed": [...]}` |

### Live-Sync

| Methode | Pfad | Wirkung |
|---|---|---|
| GET | `/api/events` | Server-Sent-Events. Events: `hello` initial, `refresh` bei Workspace-Änderung, `: ping`-Heartbeat alle 15 s |

Der Watcher nutzt Polling (Default 0.5 s, via `WATCH_INTERVAL` änderbar). Snapshot ist `(path, type, size, mtime)` pro Datei oder Ordner; Änderung → Broadcast.

### OpenCode-Konfiguration

| Methode | Pfad | Wirkung |
|---|---|---|
| GET | `/api/config` | `{"path": "...", "content": "..."}` — liest aktuelle `opencode.json` |
| PUT | `/api/config` | Body = `{"content": "..."}` — schreibt `opencode.json` (Validierung clientseitig) |

### Agent-Neustart

| Methode | Pfad | Wirkung |
|---|---|---|
| POST | `/api/restart-agent` | Beendet alle laufenden OpenCode-Prozesse — `SIGTERM`, nach 0,5 s `SIGKILL` für hängende TUIs. ttyd startet OpenCode bei der nächsten WS-Verbindung neu. |

## Konfiguration via Env-Vars

| Variable | Default | Bedeutung |
|---|---|---|
| `WORKSPACE` | `/workspace` | Wurzel des Workspace |
| `OPENCODE_CONFIG_PATH` | `/home/agent/.config/opencode/opencode.json` | Pfad zur OpenCode-Config (für die Editor-Endpunkte) |
| `FILES_API_PORT` | `8000` | TCP-Port |
| `FILES_API_HOST` | `127.0.0.1` | Bind-Adresse |
| `WATCH_INTERVAL` | `0.5` (Sekunden) | Watcher-Polling |

## Agent-API-Endpunkte

| Methode | Pfad | Wirkung |
|---|---|---|
| GET | `/api/smb-info` | Liefert `{port, share, user, password}` für die Verbindungsanleitung im Browser. Den Hostnamen bestimmt das Frontend selbst aus `window.location.hostname` (mit Override-Eingabefeld bei loopback) — der Container kann nicht zuverlässig wissen, welche Adresse vom Browser-Host aus erreichbar ist (Container-Bridge-IP ist auf Docker Desktop unter macOS und Windows unbrauchbar). |

Konfiguration via Env-Vars:

| Variable | Default | Bedeutung |
|---|---|---|
| `AGENT_API_PORT` | `8001` | TCP-Port |
| `AGENT_API_HOST` | `127.0.0.1` | Bind-Adresse |
| `SMB_PASSWORD_FILE` / `SMB_PASSWD_FILE` | `/home/agent/.config/agentbox/smb-passwd` | Pfad zur Klartext-Passwort-Datei |
| `SMB_SHARE` | `workspace` | Name des SMB-Shares |
| `SMB_PORT` | `445` | extern sichtbarer SMB-Port für die UI |

## Sicherheitsmodell der API

- **Keine eigene Authentifizierung in der Files-API.** Files-API lauscht auf `127.0.0.1` und beantwortet jede Anfrage, die sie erreicht. Caddy prüft vor jeder Weiterleitung via `forward_auth` gegen den `/api/auth-check`-Endpoint der Agent-API (siehe [Authentifizierung und TLS](../operations/authentifizierung.md)) — alle externen Anfragen an `/api/*` werden also nur dann an die Files-API weitergereicht, wenn das Session-Cookie gültig ist. Die Agent-API selbst hostet den Login-/Logout-/Auth-Check-Flow und ist die einzige Komponente, die `APP_PASSWORD` und das Cookie-Secret kennt.
- **Kein Path-Traversal.** Pfade werden segmentweise validiert; `..`, absolute Pfade, Backslashes und Nullbytes sind verboten.
- **Kein Zugriff auf HOME** — mit einer expliziten Ausnahme. Der allgemeine `/api/files/*`-Endpunkt liest und schreibt ausschließlich unter `WORKSPACE`. Lediglich `/api/config` liest und schreibt direkt `OPENCODE_CONFIG_PATH` (Default: `/home/agent/.config/opencode/opencode.json`), damit der Zahnrad-Editor im Browser den API-Key setzen kann.
- **Keine Symlink-Verfolgung.** Symlinks werden im Listing, Download und ZIP-Export ignoriert oder abgelehnt.

## Agent-Prozess-Discovery

`POST /api/restart-agent` liest `/proc` direkt, schickt `SIGTERM` an alle Prozesse mit `comm == "opencode"` und eskaliert nach 0,5 s mit `SIGKILL` für Prozesse, die noch leben. Bewusst kein `pkill`-Aufruf — keine zusätzliche Paket-Abhängigkeit, deterministisches Verhalten.
