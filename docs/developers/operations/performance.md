# Performance

Ressourcenverbrauch einer AgentBox-Instanz im Leerlauf — keine aktive Agenten-Session, kein laufender LLM-Aufruf.

## Baseline: Windows, ohne SMB

Gemessen am 09.05.2026 auf Windows 11 / Docker Desktop (AMD64), Image-Version `main`.

### Image

| Kennzahl | Wert |
|---|---|
| Image (unkomprimiert) | 1,43 GB |
| Build-Cache | ~1,8 GB |

### Container

| Kennzahl | Wert |
|---|---|
| CPU | ~2 % |
| RAM | ~361 MB |
| PIDs | ~40 |

### Prozesse nach RAM

| Prozess | RSS | Funktion |
|---|---|---|
| `opencode` | ~400 MB | Agent-TUI |
| `caddy` | ~45 MB | Reverse Proxy |
| `python3 files-api.py` | ~21 MB | Files-API |
| `ttyd` | ~17 MB | Web-Terminal |
| `entrypoint.sh` | ~3 MB | Init-Prozess |

### Volumes

| Volume | Größe |
|---|---|
| `agent-home` | 126 MB |
| `workspace` | 0 MB |

## Baseline: Windows, mit SMB

*Noch nicht gemessen — wird nach Integration von Samba ergänzt.*
