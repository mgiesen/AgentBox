# Hosting

AgentBox läuft als eine oder mehrere getrennte Docker-Compose-Instanzen. Jede Instanz hat einen HTTP- und einen optionalen HTTPS-Einstiegspunkt, eigene benannte Volumes für Workspace und Agent-Home und eine eingebaute Session-Auth (siehe [Authentifizierung und TLS](authentifizierung.md)). Die Zugriffsgrenze entsteht über das Login-Cookie, das Host-Binding und — bei geteilten Umgebungen — optional einen vorgeschalteten Reverse Proxy.

## Port-Modell

`compose.yaml` bindet drei Host-Ports an Container-interne Ports — HTTP, HTTPS und SMB:

```yaml
ports:
  - "${HOST_BIND:-127.0.0.1}:${HOST_PORT:-80}:8080"
  - "${HTTPS_BIND:-127.0.0.1}:${HTTPS_PORT:-443}:8443"
  - "${SMB_BIND:-0.0.0.0}:${SMB_PORT:-445}:445"
```

| Variable | Default | Bedeutung |
|---|---|---|
| `APP_PASSWORD` | — (Pflicht) | Passwort für die Session-Auth. Ohne diese Variable startet der Container nicht. |
| `APP_DOMAIN` | (leer) | Hostname für HTTPS. Leer → HTTP-Modus (Caddy lauscht auf `:8080`). Gesetzt → HTTPS-Modus (`:8443`). |
| `APP_TLS_CERT` / `APP_TLS_KEY` | (leer) | Pfade im Container zu Cert/Key. Beide gesetzt → Caddy nutzt dieses Cert. Beide leer (aber `APP_DOMAIN` gesetzt) → Caddy nutzt seine lokale CA (`tls internal`). |
| `HOST_BIND` | `127.0.0.1` | Adresse, auf der der Docker-Host für die Web-UI (HTTP) lauscht |
| `HOST_PORT` | `80` | externer HTTP-Port der Instanz |
| `HTTPS_BIND` | `127.0.0.1` | Adresse für HTTPS-Mapping |
| `HTTPS_PORT` | `443` | externer HTTPS-Port der Instanz |
| `SMB_BIND` | `0.0.0.0` | Adresse, auf der der Docker-Host für SMB lauscht |
| `SMB_PORT` | `445` | externer SMB-Port (Standard für Finder/Explorer) |
| `SMB_HOST` | (leer) | optionaler Hostname, den die UI für SMB anzeigen soll |
| `SMB_PASSWORD` | (leer) | wenn gesetzt, wird dieses Passwort beim Start in die Samba-Passdb geschrieben — sonst zufällig generiert und persistiert |
| Container-Port HTTP | `8080` | interner Caddy-Port im HTTP-Modus |
| Container-Port HTTPS | `8443` | interner Caddy-Port im HTTPS-Modus |
| Container-Port SMB | `445` | interner smbd-Port; erlaubt über `CAP_NET_BIND_SERVICE` |

Nur Caddy und smbd werden veröffentlicht. Files-API (`127.0.0.1:8000`), agent-api (`127.0.0.1:8001`) und ttyd (`127.0.0.1:7681`) sind nur im Container erreichbar und werden durch Caddy unter `/api/*`, `/api/smb-info`, `/api/events` und `/terminal/*` geroutet. Der Cookie-Check via `forward_auth` liegt vor allen geschützten Routen; nur `/login`, `/api/login`, `/api/logout` und `/api/auth-check` sind ohne Cookie erreichbar.

Der HTTP-Default `127.0.0.1:80` ist für eine direkt auf dem Host genutzte Einzelinstanz gedacht. Für einen anderen externen Port reicht:

```bash
HOST_PORT=18001 docker compose up --build -d
```

`HOST_BIND=0.0.0.0` oder eine konkrete Netzwerkadresse macht die Web-UI direkt im jeweiligen Netz erreichbar. Im HTTP-Modus ist das nur sinnvoll, wenn ein vorgeschalteter Reverse Proxy TLS terminiert — beim Login geht das Passwort sonst im Klartext-POST-Body über das Netz, und das Session-Cookie wird ohne `Secure`-Flag gesetzt. Wer keinen externen Proxy hat, setzt stattdessen `APP_DOMAIN` und nutzt einen der eingebauten HTTPS-Modi.

Die SMB-Asymmetrie (`SMB_BIND=0.0.0.0`) ist gewollt: ein Netzlaufwerk-Mount aus dem LAN ist genau der Use-Case. Bei lokalem Docker-Betrieb über `localhost` ist dieser Pfad ohne Wert — `smb://localhost/` wird vom macOS-Finder unzuverlässig aufgelöst, Port 445 kollidiert auf Windows mit dem System-`LanmanServer`, und der Standard-Dialog „Netzlaufwerk verbinden" kennt keinen Port-Override. Das SMB-Modal blendet die Anleitung deshalb bei Loopback-Origin (`localhost`, `127.0.0.1`, `::1`) aus und zeigt stattdessen einen Hinweis. Der lokale Workspace bleibt über den eingebauten Datei-Manager im Browser erreichbar; SMB greift erst beim Server-Profil.

## Deployment-Profile

| Profil | Setup | APP_DOMAIN | TLS | Reverse Proxy |
|---|---|---|---|---|
| **Solo-Lokal** | Eine Instanz auf dem eigenen Laptop, Zugriff über `http://127.0.0.1/` | leer | — | — |
| **Heimnetz** | Instanz auf Linux-Server, Zugriff aus LAN/VPN, kein Public DNS | gesetzt (z.B. `agentbox.local`) | `tls internal` (selbstsigniert) | — |
| **Firmennetz mit interner CA** | Instanz im Unternehmensnetz, Cert von IT-Zertifizierungsstelle | gesetzt (z.B. `agentbox.intern.example.de`) | gemountetes Cert (`APP_TLS_CERT` + `APP_TLS_KEY`) | optional |
| **Hinter externem Reverse Proxy** | Mehrere Instanzen, TLS am Edge-Proxy | leer (Container HTTP-only) | am Proxy | Pflicht |

## Hinter einem Reverse Proxy oder Orchestrator

AgentBox veröffentlicht HTTP (und optional HTTPS via Caddy) auf einem Container-Port. Damit lässt sie sich sowohl direkt betreiben als auch hinter einen beliebigen Reverse Proxy oder Orchestrator stellen (nginx, Traefik, Caddy, HAProxy, eine Cloud-LB o.ä.). Das Prinzip ist immer dasselbe: **TLS wird am Proxy terminiert, HTTP wird auf den Container geroutet.**

Grundmuster für ein Deployment hinter einem externen Proxy:

1. AgentBox im **HTTP-Modus** betreiben (`APP_DOMAIN` leer). Caddy lauscht dann intern auf `:8080`.
2. Den Container-HTTP-Port nur lokal exponieren (`HOST_BIND=127.0.0.1` bzw. ein internes Netz), damit niemand am Proxy vorbei direkt auf den unverschlüsselten Port zugreift.
3. Den Proxy TLS terminieren lassen und HTTP an das Host-Binding der Instanz (z.B. `127.0.0.1:HOST_PORT`) weiterreichen.
4. Der Proxy muss `X-Forwarded-Proto: https` mitgeben — nur dann setzt die Agent-API das Session-Cookie als `Secure`.

```bash
# HTTP-only-Instanz, nur lokal gebunden — TLS macht der vorgelagerte Proxy
HOST_BIND=127.0.0.1 HOST_PORT=18001 docker compose up --build -d
```

Manche Orchestrator (z.B. solche, die Docker-Compose-Domains ohne Port-Suffix routen) erwarten den Ziel-Container auf **Port `80`** statt `8080`. Falls Dein Proxy keinen abweichenden Upstream-Port zulässt, kann AgentBox den internen Caddy-Port über `APP_HTTP_PORT=80` umstellen; `CAP_NET_BIND_SERVICE` ist dafür im Compose bereits gesetzt.

Alternativ terminiert AgentBox TLS selbst — dann `APP_DOMAIN` setzen und einen der eingebauten HTTPS-Modi nutzen (lokale CA via `tls internal` oder gemountetes Cert, siehe [Authentifizierung und TLS](authentifizierung.md)). Ein vorgeschalteter Proxy ist dann optional.

### SMB hinter einem Proxy

SMB läuft **nicht** über den HTTP-Proxy — es ist ein eigenes Protokoll auf einem eigenen TCP-Port und wird direkt gebunden (`${SMB_BIND}:${SMB_PORT}:445`). Konsequenzen:

- Wer SMB nutzen will, muss den SMB-Port zusätzlich zum Web-Port durch Firewall/VPN und ggf. am Host erreichbar machen. Erlaubt die Infrastruktur nur den Web-Port, ist SMB extern nicht nutzbar — der Workspace bleibt dann über die Web-UI erreichbar.
- Für Windows-Explorer und macOS-Finder ist außen idealerweise Port `445` nötig. Ein abweichender Port funktioniert nicht im normalen Windows-Dialog; auf macOS geht es mit `smb://host:PORT/workspace`, Windows braucht Spezialsyntax wie `net use /TCPPORT` (Win 11 24H2+).
- Ein auf Loopback beschränktes `SMB_BIND` macht SMB nur vom Host selbst erreichbar. Für Clients im Netz braucht es eine erreichbare Host-IP oder `0.0.0.0` plus Firewall/VPN.
- SMB ist nicht durch die Web-Session geschützt. Deshalb nur in vertrauenswürdigen Netzen freigeben und ein starkes `SMB_PASSWORD` setzen.

In allen Profilen bleibt die Session-Auth im Container aktiv — auch hinter einem Reverse Proxy. Das schützt zusätzlich gegen den Fall, dass jemand am Proxy vorbei direkt auf den HTTP-Port zugreift (z.B. ein anderer Prozess im selben Docker-Host-Netz).

SMB ist nicht durch den Web-UI-Auth abgesichert — eigener Port, eigene Anmeldung. Wer ihn frei ins Internet exponiert, riskiert Workspace-Zugriff per SMB-Login. Empfehlung: Firewall-Regel auf vertrauenswürdige Netze, VPN oder eigene Host-IP pro Instanz. Für Windows sollte der erreichbare SMB-Endpunkt auf Port 445 liegen — der Standard-Dialog „Netzlaufwerk verbinden" akzeptiert keinen Port-Override; abweichende Ports klappen nur über `net use /TCPPORT` (Win 11 24H2+) oder den macOS-Finder mit `smb://host:port/`.

## Mehrere Nutzer

Empfohlenes Modell: **eine Compose-Instanz pro Person oder Projektteam auf eigenem externen Host-Port**. Jede Instanz hat ihr eigenes `APP_PASSWORD`. Davor kann ein Reverse Proxy (Caddy/Traefik/nginx) stehen, der TLS zentral terminiert, Single-Sign-On durchsetzt oder auf die jeweilige Instanz routet — Pflicht ist er nicht mehr, weil jede Instanz selbst HTTPS sprechen kann.

### Routing-Skizze

```
                                 ┌─── alice.agentbox.intern  ──┐
                                 │      → :18001              │
internet ──TLS── reverse proxy ──┤                            │
                  + auth         ├─── bob.agentbox.intern    ──┤
                                 │      → :18002              │
                                 │                            │
                                 └─── carol.agentbox.intern ──┘
                                        → :18003
```

- Routing typischerweise per Subdomain pro Person oder Team (saubere Cookie-/Storage-Isolation im Browser).
- Pro Instanz ein eigenes Compose-Projekt mit eigenen benannten Volumes: `agentbox-alice_workspace`/`agentbox-alice_agent-home`, `agentbox-bob_workspace`/`agentbox-bob_agent-home`, …
- Authentifizierung im Container (eingebaute Session-Auth) reicht für viele Setups. Wer SSO/OIDC braucht, terminiert das im Reverse Proxy und kann zusätzlich zur Container-Auth fungieren — der Cookie-Check bleibt aktiv als zweite Schranke.
- Updates werden über neue Images ausgerollt; beide Volumes bleiben dabei erhalten.

Beispiel:

```bash
COMPOSE_PROJECT_NAME=agentbox-alice HOST_PORT=18001 docker compose up --build -d
COMPOSE_PROJECT_NAME=agentbox-bob   HOST_PORT=18002 docker compose up --build -d
```

Der Reverse Proxy auf demselben Host kann anschließend gegen `127.0.0.1:18001` und `127.0.0.1:18002` routen. Läuft der Reverse Proxy nicht auf demselben Host, muss `HOST_BIND` passend zur erreichbaren, geschützten Netzwerkadresse gesetzt werden.

### Container-Härtung (zentral)

- Kein `--privileged`, kein `docker.sock`, keine Host-Mounts außer den deklarierten Volumes.
- `--cap-drop=ALL` (im aktuellen Compose schon gesetzt).
- Empfohlen zusätzlich:
    - Read-only Rootfs (`read_only: true` in compose), `tmpfs` für `/tmp` und `/run`.
    - Memory- und CPU-Limits pro Container.
    - Egress-Beschränkung auf das LLM-Backend (z.B. via Docker-Network-Policy oder Host-Firewall).
- OpenCode läuft als unprivilegierter `agent`-User, kein `sudo` im Image.

### Image-Lifecycle

- Image nur intern hosten — siehe [Sicherheitsmodell](security.md#image-distribution).
- Falls künftig vorgebackene Credentials nötig werden, ausschliesslich über BuildKit-Secrets einbinden; `COPY` von Token-Dateien hinterlässt Layer im Build-Cache und in `docker history`.

## Status der Härtung

- [x] `--cap-drop=ALL` per compose
- [x] Default-Bind nur an `127.0.0.1`
- [x] Session-Cookie-Auth über Agent-API + Caddy `forward_auth`, HMAC-signiert
- [x] HTTPS-Modi im Container (lokale CA via `tls internal` oder gemountetes Cert)
- [ ] Read-only-Rootfs, `tmpfs` für `/tmp`
- [ ] Egress-Beschränkung auf LLM-Backend
- [ ] Veröffentlichung als `ghcr.io`-Image (intern)
- [ ] Beispiel-Setup für zentrales Hosting mit externem Auth-Layer (z.B. SSO)
