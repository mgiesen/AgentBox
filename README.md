# AgentBox

AgentBox stellt einem KI-Agenten einen eigenen Workspace, Internetzugriff und ausgewählte Werkzeuge bereit, ohne ihm Zugriff auf den persönlichen Arbeitsrechner zu geben.

Kern der Lösung ist ein Docker-Container, eine OpenCode-TUI in einem Web-Terminal und ein Workspace-Volume. Anwender laden Dateien in die AgentBox, der Agent verarbeitet sie innerhalb dieser Umgebung, und fertige Ergebnisse werden wieder aus der AgentBox heruntergeladen oder per SMB-Netzlaufwerk geöffnet.

AgentBox ist **provider-agnostisch**: Welches Sprachmodell verwendet wird, entscheidet allein die OpenCode-Konfiguration, die Du über das Zahnrad-Icon in der Web-UI setzt. Damit läuft die AgentBox mit jedem OpenAI-kompatiblen Endpoint (OpenAI, OpenRouter, Groq, lokales Ollama/vLLM u.v.m.) oder einem OpenCode-nativen Provider.

## Die Grundidee: agentisches Arbeiten zentral bereitstellen

AgentBox ist mehr als ein lokales Werkzeug — die eigentliche strategische Idee liegt auf der **Bereitstellungsebene**. Eine Organisation kann ihren Mitarbeitenden fertige, isolierte Agenten-Umgebungen zur Verfügung stellen, die bereits **vorkonfiguriert** sind: mit passenden Skills und Agenten, hinterlegten Werkzeugen und voreingestellter OpenCode-Konfiguration (Provider, Modell, Berechtigungen).

Für die Anwender heißt das: Sie öffnen eine **einfache Browser-Adresse** und arbeiten sofort agentisch — ohne lokale Installation, ohne Modellkonfiguration, ohne große Vorerfahrung. Die gesamte Komplexität (Provider-Anbindung, Werkzeuge, Skills) liegt einmalig bei der bereitstellenden Stelle, nicht bei jeder einzelnen Person.

Gleichzeitig löst dieser Ansatz ein zentrales **Compliance- und Datenschutzproblem**: Ein KI-Agent, der direkt auf dem Arbeitsrechner läuft, besitzt faktisch die Zugriffsrechte des angemeldeten Benutzers — auf Desktop, Netzlaufwerke, Postfach und persönliche Dateien. Ein solches unkontrolliertes Access-Management ist in vielen Organisationen nicht tragbar. AgentBox kapselt den Agenten in einer isolierten Umgebung mit eigenem Workspace: Er sieht ausschließlich die bewusst hineingegebenen Dateien, niemals den Arbeitsrechner dahinter. Agentische Fähigkeiten werden so kontrolliert und überprüfbar bereitgestellt.

## Instanz starten

```bash
APP_PASSWORD='changeme' docker compose up --build -d
```

`APP_PASSWORD` ist Pflicht — der Container startet ohne nicht. Beim Aufruf der Web-UI erscheint eine Login-Seite; nach erfolgreichem Login setzt der Server ein signiertes Session-Cookie (Lebensdauer 30 Tage), das von Caddy via `forward_auth` bei jeder Anfrage geprüft wird. Geschützt sind damit Frontend, Files-API, Agent-API und Web-Terminal gleichermaßen. Details: [Authentifizierung und TLS](docs/developers/operations/authentifizierung.md).

Für ein persistentes Setup das Passwort in eine `.env`-Datei neben der `compose.yaml` legen — Compose liest sie automatisch:

```bash
echo "APP_PASSWORD=$(openssl rand -base64 24)" > .env
docker compose up --build -d
```

Compose baut das Image und startet eine AgentBox-Instanz mit eigenem Workspace-Volume. AgentBox veröffentlicht drei Eingangspunkte: HTTP, HTTPS (nur aktiv im HTTPS-Modus) und den Workspace als SMB-Netzlaufwerk.

| Ebene              | Port / Adresse                                | Zweck                                             |
| ------------------ | --------------------------------------------- | ------------------------------------------------- |
| Host-Binding HTTP  | `${HOST_BIND:-127.0.0.1}:${HOST_PORT:-80}`    | Web-UI im HTTP-Modus                              |
| Host-Binding HTTPS | `${HTTPS_BIND:-127.0.0.1}:${HTTPS_PORT:-443}` | Web-UI im HTTPS-Modus (wenn `APP_DOMAIN` gesetzt) |
| Host-Binding SMB   | `${SMB_BIND:-0.0.0.0}:${SMB_PORT:-445}`       | Workspace als Netzlaufwerk (Finder, Explorer)     |
| Container          | `:8080`                                       | Caddy HTTP-Listener                               |
| Container          | `:8443`                                       | Caddy HTTPS-Listener                              |
| Container          | `:445`                                        | smbd                                              |
| Container-intern   | `127.0.0.1:8000`                              | Files-API, nicht direkt veröffentlicht            |
| Container-intern   | `127.0.0.1:8001`                              | Agent-API (SMB-Info), nicht direkt veröffentlicht |
| Container-intern   | `127.0.0.1:7681`                              | ttyd/Web-Terminal, nicht direkt veröffentlicht    |

Mit den Defaults ist die Web-UI unter <http://127.0.0.1/> erreichbar (Login-Seite mit Passwort-Feld); der Workspace zusätzlich unter `smb://agent@<host>/workspace`. Beim ersten Start würfelt der Container ein 24-Zeichen-SMB-Passwort und legt es ins persistente Volume — die Web-UI zeigt es im Netzlaufwerk-Modal. Sysadmin-Override per `SMB_PASSWORD`-Env-Var möglich. Details: [Workspace als Netzlaufwerk verbinden](docs/workspace.md).

Für HTTPS reicht das Setzen von `APP_DOMAIN`:

```bash
APP_PASSWORD='changeme' APP_DOMAIN=agentbox.local docker compose up --build -d
```

Caddy generiert beim ersten Start ein selbstsigniertes Cert. Für ein vertrauenswürdiges Cert (eigene CA) zusätzlich `APP_TLS_CERT` und `APP_TLS_KEY` setzen und das Cert-Verzeichnis per Volume mounten. Details: [Authentifizierung und TLS](docs/developers/operations/authentifizierung.md).

`HOST_BIND` legt fest, auf welcher Adresse der Docker-Host die Web-UI publiziert. Der Default `127.0.0.1` ist bewusst restriktiv. Im HTTP-Modus geht das Passwort als Base64-Header über das Netz — für nicht-Loopback-Deployments deshalb entweder einen HTTPS-Modus aktivieren oder einen Reverse Proxy mit TLS davorsetzen.

### Deployment-Strategie

AgentBox liefert bewusst nur den Container und ein generisches `compose.yaml` mit — wie eine Instanz produktiv betrieben wird (Reverse Proxy, TLS-Terminierung, Orchestrator, Skalierung über mehrere Instanzen), entscheidet jede Organisation selbst. Hinweise für den Betrieb hinter einem Reverse Proxy oder Orchestrator: [Hosting](docs/developers/operations/hosting.md).

### Mehrere Instanzen

Pro Person oder Projektteam sollte eine eigene Instanz mit eigenem Compose-Projekt, eigenem Workspace-Volume und eigenem externen Host-Port laufen:

```bash
COMPOSE_PROJECT_NAME=agentbox-alice HOST_PORT=18001 docker compose up --build -d
COMPOSE_PROJECT_NAME=agentbox-bob   HOST_PORT=18002 docker compose up --build -d
```

`COMPOSE_PROJECT_NAME` trennt Container, Netzwerk und Volume-Namen. `HOST_PORT` trennt die extern erreichbaren HTTP-Ports. Für SMB kann Port 445 auf einer Host-IP nur einmal belegt werden; mehrere Windows-taugliche SMB-Instanzen brauchen deshalb unterschiedliche Host-IPs oder getrennte Server.

Stoppen mit `docker compose down`. Das Workspace-Volume bleibt erhalten; `docker compose down -v` löscht auch die Arbeitsdaten der Instanz.

## Modelle konfigurieren

AgentBox bringt keinen vorkonfigurierten Anbieter mit. Nach dem ersten Start öffnest Du das Zahnrad-Icon in der Web-UI und trägst Deinen Provider in die OpenCode-Konfiguration ein. Beispiele und Details: [Modelle](docs/modelle.md) sowie die [OpenCode-Provider-Doku](https://opencode.ai/docs/). Anschließend muss OpenCode neugestartet werden.

## Dokumentation

Die technische Dokumentation lebt unter [`docs/`](docs/) als mkdocs-Material-Site.

```bash
pip install mkdocs-material
mkdocs serve   # oder: mkdocs build --strict
```
