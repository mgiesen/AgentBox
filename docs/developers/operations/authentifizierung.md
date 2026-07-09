# Authentifizierung und TLS

AgentBox hat ab Werk eine einfache Anmeldung — ein einziges Passwort, das der Sysadmin beim Containerstart festlegt. Wer die Web-UI aufruft, sieht eine Login-Seite, gibt das Passwort ein und bekommt anschließend ein Session-Cookie. Caddy prüft den Cookie bei jeder Anfrage; Frontend, Files-API, Agent-API und Web-Terminal werden gleichermaßen geschützt.

## Single-User-Modell

- Genau ein Passwort. Kein User-Management, keine Registrierung, keine Rollen.
- Eine AgentBox wird typischerweise von einer Person bedient. Der Sysadmin gibt das Passwort heraus.
- Session-Cookie hat eine Lebensdauer von 30 Tagen. Ein Logout-Endpoint (`POST /api/logout`) löscht es serverseitig.

Das Passwort liegt während der Containerlaufzeit als Klartext in der Umgebung der Agent-API (Python-Prozess). Vorgelegte Login-Versuche werden in konstanter Zeit dagegen verglichen. Bei erfolgreichem Login erzeugt der Server ein Cookie der Form `<expiry>.<hmac-sha256>`, signiert mit einem 32-Byte-Secret, das einmal beim ersten Containerstart unter `/home/agent/.config/agentbox/cookie-secret` erzeugt und persistiert wird.

!!! warning "APP_PASSWORD ist Pflicht"
    `compose.yaml` erzwingt die Variable per `${APP_PASSWORD:?…}` — wer sie nicht setzt, kann den Container nicht starten. Damit gibt es strukturell keinen „offenen" Default-Zustand.

## Warum Cookie statt HTTP Basic Auth

Basic Auth wäre eine Zeile Caddy-Konfiguration und bräuchte kein Login-Formular. Verworfen, weil Safari Basic-Auth-Credentials gegen `127.0.0.1`/`localhost` notorisch unzuverlässig zwischen Reloads behält und gerne den Auth-Cache „verbrennt", sobald eine Subresource (z.B. der SSE-Stream `/api/events`) einen 401 verursacht. Das Session-Cookie ist robust in allen aktuellen Browsern, ermöglicht echten Logout und macht den Auth-Zustand sichtbar (Cookie in DevTools statt unsichtbarer Header).

## TLS-Modi

Über `APP_DOMAIN` und optional `APP_TLS_CERT` / `APP_TLS_KEY` wählt der Sysadmin einen von drei Modi:

| Modus | ENV-Kombination | Container lauscht | Cert | Browser |
|---|---|---|---|---|
| **HTTP** (Default) | nur `APP_PASSWORD` | `:8080` | — | klar |
| **HTTPS lokal** | `+ APP_DOMAIN` | `:8443` | Caddys lokale CA (`tls internal`) | Warnung bis Root-CA importiert |
| **HTTPS produktiv** | `+ APP_DOMAIN + APP_TLS_CERT + APP_TLS_KEY` | `:8443` | gemountetes Cert | vertrauenswürdig, sofern Cert von bekannter CA |

### Modus 1 – HTTP (Loopback)

Der Default. Sinnvoll auf der eigenen Maschine über `127.0.0.1`:

```bash
APP_PASSWORD='changeme' docker compose up --build -d
```

Caddy lauscht intern auf `:8080`, die Web-UI ist unter `http://127.0.0.1/` erreichbar. Beim Aufruf zeigt der Server die Login-Seite; nach erfolgreichem Login bekommt der Browser das Session-Cookie. Im HTTP-Modus geht das Cookie ohne `Secure`-Flag über die Leitung — über Loopback unproblematisch.

!!! tip "Passwort sicher erzeugen und ablegen"
    `APP_PASSWORD='changeme'` inline auf der Kommandozeile ist nur fürs ad-hoc-Starten gedacht. Für laufenden Betrieb das Passwort in eine `.env`-Datei neben der `compose.yaml` schreiben (Compose liest sie automatisch). Ein starkes Zufallspasswort generiert z.B. `openssl rand -base64 24`.

### Modus 2 – HTTPS mit Caddys lokaler CA

Caddy ist seine eigene Zertifizierungsstelle. Geeignet für lokale Tests im Heimnetz oder als Übergang, solange noch kein „richtiges" Cert verfügbar ist:

```bash
APP_PASSWORD='changeme' APP_DOMAIN=agentbox.local docker compose up --build -d
```

Caddy generiert beim ersten Start ein selbstsigniertes Cert für `agentbox.local`. Es liegt im `agent-home`-Volume und überlebt Restarts. Browser meldet beim ersten Aufruf „nicht vertrauenswürdig" — zwei Wege damit umzugehen:

1. Einmal „trotzdem fortfahren" pro Browser.
2. Sauberer: Caddys Root-CA exportieren und auf jedem Client-Gerät als vertrauenswürdig markieren. Pfad im Container:

    ```text
    /home/agent/.local/share/caddy/pki/authorities/local/root.crt
    ```

    Mit `docker compose cp` aus dem Container holen und per OS-Tool auf den Clients importieren.

### Modus 3 – HTTPS mit eigenem Cert

Die produktive Variante für ein Firmennetz. Die IT stellt ein Server-Cert von der internen Zertifizierungsstelle aus (deren Root-Cert auf allen Firmen-Geräten bereits installiert ist) und stellt Cert + Key auf dem Docker-Host bereit. Der Container mountet sie schreibgeschützt.

```yaml
# compose.yaml (Auszug)
environment:
  APP_PASSWORD: ${APP_PASSWORD:?…}
  APP_DOMAIN: agentbox.intern.example.de
  APP_TLS_CERT: /certs/fullchain.pem
  APP_TLS_KEY: /certs/privkey.pem
volumes:
  - /etc/agentbox/certs:/certs:ro
```

Browser zeigen direkt das grüne Schloss; keine Warnung, kein Cert-Import auf den Clients. Das Cookie wird in diesem Modus mit `Secure`-Flag gesetzt — Caddy reicht den Original-Schemes per `X-Forwarded-Proto` an die Agent-API durch.

!!! info "Wenn die IT lieber einen Reverse Proxy davorsetzt"
    Genauso valide: Container im HTTP-Modus betreiben (`APP_DOMAIN` leer), und ein zentraler Reverse Proxy (nginx/Caddy/Traefik) terminiert TLS und reicht HTTP an `127.0.0.1:HOST_PORT` durch. Die Session-Auth bleibt im Container aktiv und schützt zusätzlich gegen den Fall, dass jemand am Proxy vorbei direkt auf den HTTP-Port zugreift. Damit Cookies in dieser Konstellation als `Secure` gesetzt werden, muss der externe Proxy `X-Forwarded-Proto: https` mitgeben.

## Umgebungsvariablen

| Variable | Default | Bedeutung |
|---|---|---|
| `APP_PASSWORD` | — (Pflicht) | Klartext-Passwort. Bleibt während der Containerlaufzeit in der Umgebung der Agent-API. |
| `APP_DOMAIN` | leer | Hostname für HTTPS. Leer → HTTP-Modus. |
| `APP_TLS_CERT` | leer | Pfad zum Cert im Container. Nur in Verbindung mit `APP_TLS_KEY`. |
| `APP_TLS_KEY` | leer | Pfad zum Private Key im Container. |
| `HOST_BIND` | `127.0.0.1` | Adresse, auf der der Docker-Host für die Web-UI lauscht. |
| `HOST_PORT` | `80` | externer HTTP-Port (genutzt im HTTP-Modus). |
| `HTTPS_BIND` | `127.0.0.1` | externe Adresse für HTTPS (Modus 2/3). |
| `HTTPS_PORT` | `443` | externer HTTPS-Port (Modus 2/3). |

`HTTPS_BIND` / `HTTPS_PORT` sind auch im HTTP-Modus gemappt; das schadet nichts, weil dann im Container kein Listener auf `:8443` läuft.

## Architektur

```
Browser ── GET / ────────────────► Caddy ── forward_auth ──► agent-api /api/auth-check
                                                              │
                                  ◄── 302 /login ─────────────┘  (kein Cookie)
Browser ── GET /login ───────────► Caddy ─────────────────────► /srv/login.html
Browser ── POST /api/login ──────► Caddy ─────────────────────► agent-api /api/login
                                  ◄── 204 + Set-Cookie ────────  (Passwort ok)
Browser ── GET / ────────────────► Caddy ── forward_auth ──► agent-api /api/auth-check
                                  ◄── 204 ──────────────────────  (Cookie ok)
                                       │
                                       └──► weiter zum eigentlichen Backend
```

`forward_auth` schickt vor jeder geschützten Anfrage einen Subrequest mit dem Cookie an `/api/auth-check`. Bei 2xx-Antwort läuft Caddy normal weiter; bei 4xx-Antwort wird die Auth-Check-Response 1:1 an den Browser zurückgegeben — entweder ein 302 nach `/login` (wenn der Original-Request HTML wollte) oder ein 401 mit JSON-Body (für `fetch`/XHR/SSE, damit JavaScript sauber reagieren kann).

Beim Login prüft die Agent-API das vorgelegte Passwort in konstanter Zeit gegen `APP_PASSWORD`, generiert einen Token aus Ablaufzeitstempel und HMAC-SHA256-Signatur und setzt das Cookie mit `HttpOnly; SameSite=Strict; Path=/`, plus `Secure` wenn `X-Forwarded-Proto: https` anliegt.

## Geschützte vs. ungeschützte Routen

Caddy verlangt für alle Routen einen gültigen `agentbox_session`-Cookie — mit folgenden Ausnahmen:

| Pfad | Zweck | Weshalb ungeschützt |
|---|---|---|
| `/login`, `/login.html` | Login-Formular | Damit der nicht-eingeloggte Browser die Seite rendern kann |
| `/api/login` | Passwortprüfung, Cookie setzen | Login-Flow selbst |
| `/api/logout` | Cookie löschen | Logout-Flow; ohne Auth-Schutz, da Funktion idempotent und ohne Cookie kein Effekt |
| `/api/auth-check` | Caddy `forward_auth`-Subrequest | Caddy ruft den Endpoint intern auf; der Endpoint entscheidet selbst über Auth-Status |
| `/assets/*` | Logo, Favicon, Open-Props-CSS | Branding-Assets, von der Login-Seite gebraucht; kein Informationswert |
| `/icons/*` | SVG-Sprite | Wie Assets, nur Symbole |

Alle anderen Routen (Frontend-JS, Files-API, Agent-API für SMB, Web-Terminal, SSE-Stream) sitzen hinter `forward_auth`.

## Logout

Der Header der Web-UI hat einen Logout-Button (Tür-mit-Pfeil-Symbol) links vom Sidebar-Toggle. Klick löst `POST /api/logout` aus, das Cookie wird mit `Max-Age=0` überschrieben, anschließend leitet der Browser auf `/login` um. Auch ohne aktiven Logout läuft das Cookie nach 30 Tagen automatisch ab.

## Wo Auth strukturell **nicht** greift

- **SMB** läuft auf einem getrennten Port und hat eine eigene User/Passwort-Anmeldung (`agent` + automatisch generiertes 24-Zeichen-Passwort). Details: [Sicherheitsmodell · SMB-Auth-Modell](security.md#smb-auth-modell).
- **Innerhalb des Containers** schützt die Session-Auth nichts. Wer dort eine Shell hat (z.B. der Agent selbst, oder ein Sysadmin per `docker exec`), umgeht Caddy komplett und sieht `APP_PASSWORD` im Prozessumfeld. Das ist gewollt; das Bedrohungsmodell liegt am Netzwerk-Eingang.

## Bezug zur Caddy-Konfiguration

`Caddyfile.template` enthält Platzhalter (`__SITE_ADDRESS__`, `__TLS_BLOCK__`, `__AUTO_HTTPS__`), die `entrypoint.sh` beim Start auf Basis der ENV-Variablen ersetzt. Das gerenderte Caddyfile landet unter `/home/agent/.config/caddy/Caddyfile`. Auth-Logik wohnt vollständig in der Agent-API (`api/agent-api.py`), Caddy macht nur `forward_auth` als Gate. Caddys Cert-Speicher liegt unter `/home/agent/.local/share/caddy/` und persistiert über das `agent-home`-Volume — `tls internal` regeneriert seine Certs deshalb nicht bei jedem Restart.

## Persistenz im agent-home-Volume

| Datei | Inhalt | Mode |
|---|---|---|
| `/home/agent/.config/agentbox/cookie-secret` | 32 Random-Bytes für HMAC-Signierung der Session-Tokens | 600 |
| `/home/agent/.config/agentbox/smb-passwd` | SMB-Passwort (Klartext, von Agent-API gelesen) | 600 |
| `/home/agent/.local/share/caddy/...` | Caddys Cert-Storage inkl. lokaler CA | 600 |

Wer Sessions aller Browser invalidieren will, löscht `cookie-secret` und startet den Container neu — alle existierenden Cookies sind dann automatisch ungültig.
