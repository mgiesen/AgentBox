# Persistenz

AgentBox nutzt **zwei Docker-Volumes**, die im Container an unterschiedliche Pfade gemountet werden und verschiedene Konsumenten haben.

| Volume | Mount | Zugriff durch | Inhalt |
|---|---|---|---|
| `workspace` | `/workspace` | Anwender (Files-Tab) und Agent (cwd) | Arbeitsdateien |
| `agent-home` | `/home/agent` | Nur Agent | OpenCode-Konfiguration, Auth-Tokens, Sessions, Caches |

Die Files-API kennt strukturell nur `/workspace`. Auth-Tokens und persönliche Konfiguration liegen außerhalb ihrer Reichweite. Anwenderdateien und Agent-State sind dadurch sauber getrennt: die Sidebar ist für Arbeitsdateien zuständig, HOME für Modellzugang, Sessions, Caches und OpenCode-Einstellungen.

## Was wo persistiert

```
/workspace                                ← Volume "workspace"
└─ Forschungsprojekt/01_Antraege/Foerderantrag.docx, …  ← Arbeitsdateien

/home/agent                               ← Volume "agent-home"
├─ .bashrc, .bash_history, …              ← Shell-State
├─ .config/
│   └─ opencode/opencode.json             ← OpenCode-Konfig (mit API-Key)
└─ .local/share/
    └─ opencode/                          ← OpenCode-Sessions, Auth, Cache
```

Beide Volumes überleben:

- `docker restart`
- `docker compose down && up`
- `docker compose build && up` (Image-Update)

Erst `docker compose down -v` (Volume-Wipe) oder `opencode auth logout` etc. löscht den jeweiligen State.

## Warum HOME als Volume

OpenCode legt seinen State an XDG-Standardorten ab: `~/.config/opencode/opencode.json`, `~/.local/share/opencode/` (Sessions, Auth, Cache). Mit HOME selbst als Volume schreibt OpenCode genau dort, wo es seine offizielle Doku vorsieht, ohne XDG-Variablen umzubiegen oder Symlinks ins `entrypoint.sh` einzubauen.

Der Preis: Im Volume landet auch Shell-State (`.bash_history`, `.npm/`-Caches usw.). Akzeptabel — isoliert pro Container, unkritisch für die Trennung vom Host.

## Konsequenzen für das Image

Damit der HOME-Volume-Mount die Binary nicht verschattet, liegt OpenCode unter `/opt/`, nicht in `/home/agent/`:

```
/opt/opencode/bin/opencode             ← OpenCode-Binary
/opt/agentbox/seed/opencode/...        ← Default-Config (Seed)
/opt/agentbox/agent-toolkit/           ← read-only Agents/Skills (Toolkit)
```

Der `entrypoint.sh` initialisiert ein leeres HOME-Volume idempotent: Skel-Files aus `/etc/skel` reinkopieren, Default-Config aus dem Seed nach `~/.config/opencode/` legen, Toolkit-Skills nach `~/.config/opencode/skills/` symlinken. Bei späteren Starts greift jeder Block nur, wenn die Zieldatei fehlt oder der Symlink-Stand veraltet ist — Anwenderänderungen werden nicht überschrieben.

## Volume-Namen auf dem Host

Compose präfixt benannte Volumes mit dem Projektnamen. Beim Default-Projekt `agentbox`:

| Volume | Pfad bei OrbStack |
|---|---|
| `agentbox_workspace` | `~/OrbStack/docker/volumes/agentbox_workspace/` |
| `agentbox_agent-home` | `~/OrbStack/docker/volumes/agentbox_agent-home/` |

Bei `COMPOSE_PROJECT_NAME=agentbox-alice` heißen die Volumes entsprechend `agentbox-alice_workspace` und `agentbox-alice_agent-home`. Inhalte sind direkt aus Finder/Terminal lesbar.

Hinweis: Der Volume-Name ist nicht identisch mit dem Mount-Pfad — der Volume **ist** `/workspace` bzw. `/home/agent`, es gibt keinen Unterordner mit dem Namen.
