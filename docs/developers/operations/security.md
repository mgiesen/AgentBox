# Sicherheitsmodell

AgentBox ist keine Vertrauensgrenze gegenüber dem KI-Agenten selbst. Sie ist eine technische Schutzschicht zwischen Agent und Host-System. Der Agent darf innerhalb seiner Umgebung arbeiten, aber er soll nicht unkontrolliert auf den Laptop, Netzlaufwerke oder Daten anderer Anwender zugreifen.

## Was AgentBox tut

- Isoliert den KI-Agenten vom Host: kein `docker.sock`, keine Host-Mounts außer dem deklarierten Volume.
- Lässt den Agenten nur an Dateien, die der Anwender explizit ins `/workspace` legt.
- Trennt Arbeitsdateien (Files-API auf `/workspace`) strukturell von Agent-State (HOME mit Auth-Tokens) per zweitem Volume `agent-home` auf `/home/agent`.
- Bietet Secret-Mount via BuildKit für Sysadmin-Pre-Bake-Modus, sodass Tokens nicht in `docker history` landen.
- Ermöglicht zentrale Updates von Image, Agenten, Skills und Default-Konfigurationen, ohne persönliche Workspace-Inhalte zu überschreiben.

## Was AgentBox **nicht** tut

- **Keine Egress-Filter.** Der Agent kann jeden Endpunkt im Internet erreichen, den der Host-Network-Stack zulässt. Wer das einschränken muss, macht es auf Docker-Network- oder Host-Firewall-Ebene.
- **Keine Trennung verschiedener Nutzer in einem Container.** Ein Container = ein Workspace für eine Person oder ein Projektteam. Multi-Tenancy erfolgt über mehrere Container. ttyd erlaubt zwar bis zu 10 parallele PTY-Sessions auf demselben Container — alle teilen sich aber denselben Workspace, dieselben Agent-Auth-Tokens und denselben Login-Cookie. Parallelnutzung ist Konvenienz, keine Mandantentrennung.
- **Kein Schutz gegen den Agenten selbst.** Der Agent läuft als `agent`-User mit Schreibrechten auf `/workspace` und `/home/agent`. Was er dort tut, ist sein Job — er kann beliebig editieren, herunterladen, Code ausführen.

## Datenfluss-Klassifikation

!!! warning "Modellumgebung bestimmt die Datenklasse"
    Inhalte aus `/workspace` können vom Agenten an das konfigurierte LLM-Backend weitergeleitet werden. Bei externen Cloud-Anbieter-Modellen dürfen nur entsprechend freigegebene Daten verarbeitet werden. Selbst-gehostete/On-Prem-Modelle können andere Datenklassen erlauben, sofern die jeweilige Instanz und der konkrete Anwendungsfall dafür freigegeben sind.

Die Anleitung im Browser (Buch-Icon) macht diesen Punkt prominent. Beim zentralen Hosting sollte der Reverse Proxy oder ein vorgelagertes Login-Banner zusätzlich deutlich machen, welche Datenklasse für die jeweilige Instanz zulässig ist.

## Auth-Tokens

| Quelle | Wo persistiert | Sichtbar via Files-API? |
|---|---|---|
| `opencode.json` | `/home/agent/.config/opencode/opencode.json` | Nein — strukturell außerhalb der Files-API; einzig der `/api/config`-Editor-Endpunkt liest sie direkt für die UI |
| `opencode auth login <provider>` | `/home/agent/.local/share/opencode/auth.json` | Nein |
| SMB-Passwort (Klartext, für die Web-UI) | `/home/agent/.config/agentbox/smb-passwd` (mode 600) | Nein — bedient durch das Agent-API |
| SMB-Passdb (Hash) | `/home/agent/.local/share/samba/private/passdb.tdb` | Nein |
| Session-Cookie-Secret (32 Bytes, HMAC-Key) | `/home/agent/.config/agentbox/cookie-secret` (mode 600) | Nein |
| Web-UI-Passwort (Klartext im Prozessumfeld der Agent-API) | nicht persistiert — nur `APP_PASSWORD` der Container-Env | Nein |

Auth-Material liegt im `agent-home`-Volume und ist über `GET /api/files/...` nicht erreichbar — die Files-API kennt nur `/workspace`. Der `/api/config`-Endpunkt ist die einzige Ausnahme: er liest und schreibt `opencode.json` direkt für den Browser-Editor (Zahnrad-Icon).

## Web-UI-Auth-Modell

Caddy verlangt vor allen Backends (Frontend, Files-API, Agent-API, Web-Terminal) einen gültigen Session-Cookie. Der Cookie wird von der Agent-API nach erfolgreichem Login (Passwort aus `APP_PASSWORD`) gesetzt und ist HMAC-SHA256-signiert mit einem 32-Byte-Secret, das beim ersten Containerstart unter `/home/agent/.config/agentbox/cookie-secret` erzeugt und persistiert wird. Optional terminiert Caddy zusätzlich TLS (siehe [Authentifizierung und TLS](authentifizierung.md)).

Konsequenzen für das Bedrohungsmodell:

- Wer den Web-UI-Port erreicht, kommt **nicht** automatisch in die Sandbox — er sieht erst eine Login-Seite.
- Direkte `curl`-Aufrufe auf `/api/...` ohne gültigen `agentbox_session`-Cookie werden mit 401 abgewiesen.
- Im HTTP-Modus geht das Cookie ohne `Secure`-Flag über die Leitung; deshalb bleibt der Default-Bind auf `127.0.0.1`. Für nicht-Loopback-Deployments einen der HTTPS-Modi nutzen oder TLS extern davorsetzen — Caddy markiert den Cookie automatisch als `Secure`, sobald `X-Forwarded-Proto: https` anliegt.
- Wer alle Sessions invalidieren will, löscht `cookie-secret` und startet den Container neu.

## SMB-Auth-Modell

SMB ist von Web-UI strukturell getrennt — eigener Port, eigene Anmeldung:

- **Web-UI** (siehe oben): Session-Cookie nach Login mit `APP_PASSWORD`, geprüft via Caddy `forward_auth` gegen die Agent-API.
- **SMB** (`agent` + zufällig generiertes 24-Zeichen-Passwort, persistiert im `agent-home`-Volume): Sysadmin-Override per `SMB_PASSWORD`-Env-Var möglich; der Entrypoint schreibt diesen Wert beim Start in die Samba-Passdb.

Die Trennung ergibt sich aus den unterschiedlichen Protokollen und Bedrohungsmodellen: Web-UI ist HTTP über Loopback oder TLS, SMB geht direkt aufs LAN. Das SMB-Passwort schützt nicht gegen den Web-UI-Nutzer (der es über die UI sieht), sondern gegen andere Geräte im selben Netz.

Bei lokalem Betrieb (Web-UI über `localhost` aufgerufen) hat SMB keinen Einsatzzweck — Mount auf demselben Host scheitert systemseitig. Das Modal erkennt diesen Fall an `window.location.hostname` und zeigt statt einer Anleitung einen Hinweis. Der smbd-Prozess läuft trotzdem im Container, ohne erreichbares Ziel; wer die Ressourcen sparen will, setzt im Compose `SMB_BIND` auf eine ungenutzte Adresse oder kommentiert das SMB-Port-Mapping aus.

**Empfehlung:** SMB nur in vertrauenswürdigen Netzsegmenten (VPN, internes LAN) erreichbar machen. Das Docker-Host-Binding lässt sich über `SMB_BIND` einschränken; smbd selbst wird immer gestartet.

## Image-Distribution

Das Image bringt **keine** vorgebackenen Provider-Credentials mit — Auth-Material entsteht erst zur Laufzeit im `agent-home`-Volume. Konsequenzen:

- Image grundsätzlich nur intern hosten (Compliance-Sicht), aber kein zwingender Token-Leak im Layer.
- Wenn künftig vorgebackene Tokens nötig werden, ausschliesslich über BuildKit-Secrets (`--mount=type=secret`) einbinden — Secret-Mounts erscheinen nicht in `docker history` und bleiben nicht im Build-Cache.

## Path-Traversal

Die Files-API akzeptiert nur relative Pfade unter `/workspace`. Absolute Pfade, Backslashes, Nullbytes, leere Segmente, `.` und `..` sind verboten. Symlinks werden nicht verfolgt. Damit ist Traversal nach oben strukturell ausgeschlossen, obwohl Ordner im Workspace erlaubt sind.

## SSE und Resource-Verbrauch

Der Watcher pollt im Default alle 0.5 s `/workspace`. Bei sehr großen Workspaces (zehntausende Dateien) kann das CPU-Last erzeugen. Für solche Fälle: `WATCH_INTERVAL` hochsetzen oder auf `inotify` (z.B. via `inotify-simple`) umstellen — nicht aktuell implementiert.
