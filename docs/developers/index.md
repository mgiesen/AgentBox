# Entwicklung

Diese Sektion baut auf dem [Anwender-Teil](../index.md) auf. Sie dokumentiert nicht erneut, warum AgentBox aus Nutzersicht sinnvoll ist, sondern wie die Umgebung technisch zusammengesetzt ist: Architektur, Container-Setup, Agenten-Integration, Betrieb und Sicherheitsgrenzen.

Leitidee der Implementierung: AgentBox ist ein gerichteter Arbeitsraum für KI-Agenten. Die IT kann Fähigkeiten, Agenten, Skills und Modellzugänge zentral vorkonfigurieren und aktualisieren; persönliche Arbeitsdateien und Einstellungen bleiben in den jeweiligen Volumes der Instanzen.

## Instanz starten

Voraussetzung: Docker mit Compose v2. Kein Node, kein Python jenseits des Containers.

```bash
git clone https://github.com/mgiesen/AgentBox.git && cd AgentBox
docker compose up --build -d
```

Standard-Binding ist `127.0.0.1:80` auf dem Docker-Host. Verifikation:

```bash
curl -I http://127.0.0.1/                      # 200, HTML
curl -s http://127.0.0.1/api/files | head      # JSON-Liste, initial leer
docker compose ps                              # Service "agentbox" ist Up
```

Stoppen mit `docker compose down`. Workspace und Agent-Home bleiben in den Volumes `agentbox_workspace` und `agentbox_agent-home` erhalten — `docker compose down -v` wirft beide Volumes weg.

## Mehrere Instanzen parallel

Pro Person oder Projektteam ein eigenes Compose-Projekt, eigenes Workspace-Volume und eigener externer Host-Port:

```bash
COMPOSE_PROJECT_NAME=agentbox-alice HOST_PORT=18001 docker compose up --build -d
COMPOSE_PROJECT_NAME=agentbox-bob   HOST_PORT=18002 docker compose up --build -d
```

`compose.yaml` veröffentlicht nur Caddy nach außen:

```yaml
ports:
  - "${HOST_BIND:-127.0.0.1}:${HOST_PORT:-80}:8080"
```

`COMPOSE_PROJECT_NAME` separiert Container, Netzwerk und Volume (`agentbox-alice_workspace`, `agentbox-bob_workspace`). `HOST_PORT` separiert das externe Binding. Der interne Container-Port bleibt immer `8080`; Files-API (`8000`) und ttyd (`7681`) bleiben container-intern. `HOST_BIND=127.0.0.1` ist der sichere Default, solange kein Reverse Proxy mit Authentifizierung davorsitzt — Details: [Hosting](operations/hosting.md).

## Doku lokal bearbeiten

```bash
python3 -m venv .mkdocs-venv
.mkdocs-venv/bin/pip install -r docs/requirements.txt
.mkdocs-venv/bin/mkdocs serve            # http://127.0.0.1:8000, Live-Reload
```

CI-äquivalenter Build (bricht bei kaputten internen Links ab):

```bash
.mkdocs-venv/bin/mkdocs build --strict
```

Output landet in `public/`, vorgegeben durch `mkdocs.yml`.

!!! note "Click-Pin"
    `requirements.txt` pinnt `click==8.2.1`. Mit Click 8.3.x verliert mkdocs 1.6.1 das Filewatching, Live-Reload bricht. Pin nicht ohne bewussten Test entfernen.

## Repository-Layout

```
.
├── Dockerfile / compose.yaml / Caddyfile     Container-Setup
├── entrypoint.sh / start-agent.sh            Init-Scripts
├── api/files-api.py                          Files-API (Python-Stdlib)
├── config/opencode-default.json              Default-Provider-Config
├── frontend/                                 Statisches Frontend, ES-Module
├── docs/ + mkdocs.yml                        Dokumentation
└── CLAUDE.md                                 Konventionen für Coding-Agenten
```

## Wo es weitergeht

| Thema | Lies |
|---|---|
| Komponenten und Routing | [Architektur · Komponenten](architecture/overview.md) |
| Persistenz und Volume-Layout | [Architektur · Persistenz](architecture/volumes.md) |
| HTTP-API-Endpunkte | [Architektur · Files-API](architecture/files-api.md) |
| Frontend-Module, Sprite, Modale | [Architektur · Frontend](architecture/frontend.md) |
| OpenCode-Integration | [Agent](agents.md) |
| Zentrales Hosting | [Betrieb · Hosting](operations/hosting.md) |
| Sicherheitsmodell | [Betrieb · Sicherheit](operations/security.md) |

## Konventionen

- **Zentrale Quelle:** Architektur-Entscheidungen leben hier in `docs/developers/`. Code-Kommentare und Commit-Messages dokumentieren *was*, nicht *warum* auf Architektur-Ebene.
- **Sprache:** Deutsch in Doku, Anwendertexten und Code-Kommentaren. Echte UTF-8-Umlaute.
- **Tech-Stack:** Frontend ohne npm/Bundler. Files-API ausschließlich Python-Stdlib. Doku via mkdocs-Material, gepinnt.

Vor dem Commit relevante Checks aus `CLAUDE.md` im Repo-Root.
