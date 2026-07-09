#!/bin/bash
# Container läuft als 'agent'. Keine Privilege-Drops zur Laufzeit.
set -eu

# ── HOME-Volume-Init ───────────────────────────────────────────────────
# /home/agent ist als persistentes Volume gemountet (siehe
# docs/developers/architecture/volumes.md). Beim ersten Start eines neuen
# Volumes ist HOME leer, daher Skel-Files und Default-Configs einspielen.
# Idempotent — bei späteren Starts „Datei existiert" → nichts tun.

# 1. Skel-Files (.bashrc, .profile, .bash_logout) ins leere Volume.
if [ ! -f /home/agent/.bashrc ]; then
	cp -a /etc/skel/. /home/agent/
fi

# 2. Seed: Default-Config einspielen, wenn keine eigene vorhanden.
#    Anwenderänderungen werden so nicht überschrieben.
if [ ! -f /home/agent/.config/opencode/opencode.json ]; then
	mkdir -p /home/agent/.config/opencode
	cp /opt/agentbox/seed/opencode/opencode.json \
	   /home/agent/.config/opencode/opencode.json
fi

# 3. Toolkit-Skills sichtbar machen: OpenCode kennt für Skills keine
#    System-Schicht (nur ~/.config/opencode/skills und .opencode/skills).
#    Wir verlinken jeden Skill aus /opt/agentbox/agent-toolkit/skills/<name>
#    nach /home/agent/.config/opencode/skills/<name>. Symlinks werden bei
#    jedem Start neu gesetzt (idempotent), kaputte Symlinks aus früheren
#    Image-Versionen oder umbenannten Skills werden vorab bereinigt.
TOOLKIT_SKILLS_DIR=/opt/agentbox/agent-toolkit/skills
USER_SKILLS_DIR=/home/agent/.config/opencode/skills
if [ -d "$TOOLKIT_SKILLS_DIR" ]; then
	mkdir -p "$USER_SKILLS_DIR"
	# Defekte Symlinks ins Toolkit-Verzeichnis aufräumen.
	# Process substitution statt Pipe, damit der finale read-EOF (Exit 1)
	# nicht über set -e das gesamte Entrypoint-Skript abbricht.
	while IFS= read -r link; do
		target="$(readlink "$link" 2>/dev/null || true)"
		case "$target" in
			/opt/agentbox/*)
				[ ! -e "$link" ] && rm -f "$link"
				;;
		esac
	done < <(find "$USER_SKILLS_DIR" -maxdepth 1 -mindepth 1 -type l 2>/dev/null)
	# Aktuelle Toolkit-Skills (re-)verlinken.
	for skill in "$TOOLKIT_SKILLS_DIR"/*/; do
		[ -d "$skill" ] || continue
		name="$(basename "$skill")"
		ln -sfn "$skill" "$USER_SKILLS_DIR/$name"
	done
fi

# ── SMB-State ──────────────────────────────────────────────────────────
# Samba läuft als unprivilegierter User. Darum liegen Passdb, Locks und Logs
# im persistenten agent-home-Volume statt unter /var/lib/samba.
SMB_ENABLED=${SMB_ENABLED:-1}
SMB_STATE_DIR=/home/agent/.local/share/samba
SMB_PASSWORD_FILE=${SMB_PASSWORD_FILE:-/home/agent/.config/agentbox/smb-passwd}
SMB_USER=agent

if [ "$SMB_ENABLED" != "0" ] && [ "$SMB_ENABLED" != "false" ] \
   && [ "$SMB_ENABLED" != "no" ] && [ "$SMB_ENABLED" != "off" ]; then
	mkdir -p \
		"$SMB_STATE_DIR/private" \
		"$SMB_STATE_DIR/state" \
		"$SMB_STATE_DIR/cache" \
		"$SMB_STATE_DIR/lock" \
		"$SMB_STATE_DIR/run" \
		"$SMB_STATE_DIR/log" \
		"$SMB_STATE_DIR/ncalrpc"
	chmod 700 "$SMB_STATE_DIR/private"

	if [ -n "${SMB_PASSWORD:-}" ]; then
		SMB_EFFECTIVE_PASSWORD="$SMB_PASSWORD"
	elif [ -s "$SMB_PASSWORD_FILE" ]; then
		IFS= read -r SMB_EFFECTIVE_PASSWORD < "$SMB_PASSWORD_FILE" || true
	else
		SMB_EFFECTIVE_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_urlsafe(18)[:24])')"
	fi

	mkdir -p "$(dirname "$SMB_PASSWORD_FILE")"
	printf '%s\n' "$SMB_EFFECTIVE_PASSWORD" > "$SMB_PASSWORD_FILE"
	chmod 600 "$SMB_PASSWORD_FILE"

	if pdbedit -s /etc/samba/smb.conf -L 2>/dev/null | cut -d: -f1 | grep -Fxq "$SMB_USER"; then
		printf '%s\n%s\n' "$SMB_EFFECTIVE_PASSWORD" "$SMB_EFFECTIVE_PASSWORD" \
			| pdbedit -s /etc/samba/smb.conf -t -u "$SMB_USER" >/dev/null
	else
		printf '%s\n%s\n' "$SMB_EFFECTIVE_PASSWORD" "$SMB_EFFECTIVE_PASSWORD" \
			| pdbedit -s /etc/samba/smb.conf -a -t -u "$SMB_USER" >/dev/null
	fi
fi

# ── Auth + TLS-Konfiguration ───────────────────────────────────────────
# Session-Cookie-Auth: APP_PASSWORD wird von agent-api gelesen und gegen
# vorgelegte Login-Versuche verglichen. Hier nur Pflicht-Check, kein
# Hashing — siehe docs/developers/operations/authentifizierung.md.
#
# TLS-Modus wird durch APP_DOMAIN + optional APP_TLS_CERT/APP_TLS_KEY
# ausgewählt. Drei Modi:
#   1. APP_DOMAIN leer                                  → HTTP auf :${APP_HTTP_PORT:-8080}
#   2. APP_DOMAIN gesetzt, keine Cert-Pfade             → HTTPS mit Caddys
#                                                          lokaler CA (tls internal)
#   3. APP_DOMAIN gesetzt + APP_TLS_CERT + APP_TLS_KEY  → HTTPS mit gemountetem Cert
if [ -z "${APP_PASSWORD:-}" ]; then
	echo "FEHLER: APP_PASSWORD nicht gesetzt – Login ist Pflicht." >&2
	exit 1
fi

APP_HTTP_PORT=${APP_HTTP_PORT:-8080}

if [ -z "${APP_DOMAIN:-}" ]; then
	SITE_ADDRESS=":${APP_HTTP_PORT}"
	TLS_BLOCK=""
	AUTO_HTTPS="auto_https off"
	TLS_MODE_LABEL="HTTP (kein TLS)"
	UI_PORT_LINE="${APP_HTTP_PORT}  HTTP UI"
elif [ -n "${APP_TLS_CERT:-}" ] && [ -n "${APP_TLS_KEY:-}" ]; then
	if [ ! -r "$APP_TLS_CERT" ] || [ ! -r "$APP_TLS_KEY" ]; then
		echo "FEHLER: APP_TLS_CERT ($APP_TLS_CERT) oder APP_TLS_KEY ($APP_TLS_KEY) nicht lesbar." >&2
		exit 1
	fi
	SITE_ADDRESS="https://${APP_DOMAIN}:8443"
	TLS_BLOCK="tls ${APP_TLS_CERT} ${APP_TLS_KEY}"
	AUTO_HTTPS="auto_https disable_redirects"
	TLS_MODE_LABEL="HTTPS mit gemountetem Cert ($APP_TLS_CERT)"
	UI_PORT_LINE="8443  HTTPS UI"
else
	SITE_ADDRESS="https://${APP_DOMAIN}:8443"
	TLS_BLOCK="tls internal"
	AUTO_HTTPS="auto_https disable_redirects"
	TLS_MODE_LABEL="HTTPS mit lokaler CA (tls internal, selbstsigniert)"
	UI_PORT_LINE="8443  HTTPS UI"
fi

# Template → finale Caddyfile in $HOME, weil agent-User keine
# Schreibrechte auf /etc/caddy hat. sed-Delimiter "|" vermeidet
# Konflikte mit Pfaden im TLS_BLOCK.
CADDYFILE_RUNTIME=/home/agent/.config/caddy/Caddyfile
mkdir -p "$(dirname "$CADDYFILE_RUNTIME")"
sed \
	-e "s|__AUTO_HTTPS__|${AUTO_HTTPS}|" \
	-e "s|__SITE_ADDRESS__|${SITE_ADDRESS}|" \
	-e "s|__TLS_BLOCK__|${TLS_BLOCK}|" \
	/etc/caddy/Caddyfile.template > "$CADDYFILE_RUNTIME"

# Boot-Banner: zeigt die effektive Konfiguration aus Sicht des Containers.
# Hilft beim Debuggen, wenn ENV-Variablen anders ankommen als gedacht
# (z.B. wenn ein vorgelagerter Reverse Proxy oder Orchestrator andere Werte
# überschreibt) oder wenn die externe Erreichbarkeit nicht klar ist und man
# wissen will, was der Container intern für sich selbst sieht.
HOSTNAME_VAL="$(hostname 2>/dev/null || echo '?')"
CONTAINER_IPS="$(hostname -I 2>/dev/null | tr -s ' ' | sed -e 's/^ *//' -e 's/ *$//')"
[ -z "$CONTAINER_IPS" ] && CONTAINER_IPS="(unbekannt)"
BUILD_DATE="$(grep -oE '"date":"[^"]+"' /srv/version.json 2>/dev/null | cut -d'"' -f4 || echo '?')"

if [ -n "${APP_PASSWORD:-}" ]; then
	ENV_APP_PASSWORD="gesetzt (${#APP_PASSWORD} Zeichen)"
else
	ENV_APP_PASSWORD="LEER (Container würde im Auth-Check scheitern)"
fi
ENV_APP_DOMAIN="${APP_DOMAIN:-(leer → HTTP-Modus)}"
ENV_APP_HTTP_PORT="$APP_HTTP_PORT"
ENV_APP_TLS_CERT="${APP_TLS_CERT:-(leer)}"
ENV_APP_TLS_KEY="${APP_TLS_KEY:-(leer)}"
ENV_SMB_PORT="${SMB_PORT:-445}"
if [ "$SMB_ENABLED" = "0" ] || [ "$SMB_ENABLED" = "false" ] \
   || [ "$SMB_ENABLED" = "no" ] || [ "$SMB_ENABLED" = "off" ]; then
	ENV_SMB_ENABLED="deaktiviert"
else
	ENV_SMB_ENABLED="aktiv"
fi
if [ -n "${SMB_PASSWORD:-}" ]; then
	ENV_SMB_PASSWORD="gesetzt (Sysadmin-Override, ${#SMB_PASSWORD} Zeichen)"
else
	ENV_SMB_PASSWORD="leer (Auto-Generierung oder persistierter Wert aus dem Volume)"
fi

COOKIE_SECRET_PATH="/home/agent/.config/agentbox/cookie-secret"
if [ -f "$COOKIE_SECRET_PATH" ]; then
	COOKIE_SECRET_STATUS="vorhanden in $COOKIE_SECRET_PATH"
else
	COOKIE_SECRET_STATUS="wird beim Start der Agent-API neu generiert"
fi

cat <<EOF

========================================
AgentBox – aktive Konfiguration
========================================
Container-Identität
  Hostname:        $HOSTNAME_VAL
  IP-Adressen:     $CONTAINER_IPS
  Image-Build:     $BUILD_DATE
  HOME:            /home/agent  (Volume: agent-home)
  Workspace:       /workspace   (Volume: workspace)

ENV-Variablen (effektiv beim Start)
  APP_PASSWORD:    $ENV_APP_PASSWORD
  APP_DOMAIN:      $ENV_APP_DOMAIN
  APP_HTTP_PORT:   $ENV_APP_HTTP_PORT
  APP_TLS_CERT:    $ENV_APP_TLS_CERT
  APP_TLS_KEY:     $ENV_APP_TLS_KEY
  SMB_ENABLED:     $ENV_SMB_ENABLED
  SMB_PORT:        $ENV_SMB_PORT
  SMB_PASSWORD:    $ENV_SMB_PASSWORD

Auth-Modell
  Mechanismus:     Session-Cookie via Caddy forward_auth → Agent-API
  Cookie-Name:     agentbox_session (HMAC-SHA256, 30 Tage)
  Cookie-Secret:   $COOKIE_SECRET_STATUS
  Login-Seite:     /login (ohne Auth erreichbar)

TLS / Caddy
  TLS-Modus:       ${TLS_MODE_LABEL}
  Caddy-Listener:  ${SITE_ADDRESS}
  Caddyfile:       /home/agent/.config/caddy/Caddyfile (entrypoint-gerendert)

Container-Ports (extern erreichbar je nach Host-Port-Mapping)
  ${UI_PORT_LINE}
  $([ "$ENV_SMB_ENABLED" = "aktiv" ] && printf '445   SMB' || printf '(SMB deaktiviert)')

Container-Ports (nur Loopback, hinter Caddy)
  8000  Files-API
  8001  Agent-API (Login / Logout / Auth-Check / SMB-Info)
  7681  Web-Terminal (ttyd)
========================================

EOF

# Selbsttest: nach dem Caddy-Start ein paar Sekunden warten und intern
# gegen die wichtigsten Endpunkte curlen. So sieht man im Log direkt, ob
# die Stack-interne Auth-Logik funktioniert — getrennt von Routing-Fragen
# weiter draußen (Docker-Port-Mapping, Reverse Proxy, Firewall).
(
	sleep 4
	echo ""
	echo "── Selbsttest (intern, gegen 127.0.0.1) ──────────────"
	check() {
		local url="$1" expected="$2" descr="$3"
		local code
		code=$(curl -s -o /dev/null -m 3 -w '%{http_code}' "$url" 2>/dev/null || echo "ERR")
		if [ "$code" = "$expected" ]; then
			printf "  [OK]  %3s  %-35s  %s\n" "$code" "$url" "$descr"
		else
			printf "  [!!]  %3s  %-35s  %s (erwartet %s)\n" "$code" "$url" "$descr" "$expected"
		fi
	}
	# Caddy-Frontdoor: Login-Seite ist öffentlich, Backend-Routen geschützt.
	if [ -n "${APP_DOMAIN:-}" ]; then
		FRONTDOOR="https://127.0.0.1:8443"
		CURL_K="-k"
	else
		FRONTDOOR="http://127.0.0.1:${APP_HTTP_PORT}"
		CURL_K=""
	fi
	check_caddy() {
		local path="$1" expected="$2" descr="$3" accept="${4:-*/*}"
		local code
		code=$(curl -s $CURL_K -o /dev/null -m 3 -w '%{http_code}' -H "Accept: $accept" "${FRONTDOOR}${path}" 2>/dev/null || echo "ERR")
		if [ "$code" = "$expected" ]; then
			printf "  [OK]  %3s  %-35s  %s\n" "$code" "${FRONTDOOR}${path}" "$descr"
		else
			printf "  [!!]  %3s  %-35s  %s (erwartet %s)\n" "$code" "${FRONTDOOR}${path}" "$descr" "$expected"
		fi
	}
	check_caddy /login    200 "Login-Seite (öffentlich)"
	check_caddy /         302 "Browser ohne Cookie → Redirect /login" "text/html"
	check_caddy /api/files 401 "API ohne Cookie → 401"
	# Direkt-Calls an die Backends, am Caddy vorbei — bestätigt, dass die
	# Backends überhaupt antworten und nicht aus anderem Grund 502 liefern.
	if [ "$ENV_SMB_ENABLED" = "aktiv" ]; then
		check "http://127.0.0.1:8001/api/smb-info" 200 "Agent-API direkt"
	else
		check "http://127.0.0.1:8001/api/smb-info" 404 "Agent-API direkt (SMB deaktiviert)"
	fi
	check "http://127.0.0.1:8000/api/files"    200 "Files-API direkt"
	echo "──────────────────────────────────────────────────────"
	echo ""
) &

# files-api auf 127.0.0.1:8000
python3 /opt/agentbox/files-api.py &
FILES_PID=$!

# agent-api auf 127.0.0.1:8001 — bedient SMB-Verbindungsinfo.
python3 /opt/agentbox/agent-api.py &
AGENT_API_PID=$!

PIDS="$FILES_PID $AGENT_API_PID"

if [ "$ENV_SMB_ENABLED" = "aktiv" ]; then
	# smbd im Vordergrund. --no-process-group: STRG-C-Forwarding aus dem trap;
	# --debug-stdout: keine syslog-Schleife im Container.
	smbd --foreground --no-process-group --debug-stdout &
	SMBD_PID=$!
	PIDS="$PIDS $SMBD_PID"
fi

# ttyd auf 127.0.0.1:7681 mit base-path /terminal
# Theme an die App angeglichen, damit der xterm.js-Hintergrund nahtlos in
# die dunkle Body-Fläche übergeht (sonst sichtbarer grauer Rand außen).
# --max-clients 10: bis zu 10 gleichzeitige PTY-Sessions, damit mehrere
# Browser parallel arbeiten können. Achtung: jede Session startet einen
# eigenen Agent-Prozess auf demselben Workspace — Race-Conditions möglich.
/usr/local/bin/ttyd \
	--port 7681 \
	--interface 127.0.0.1 \
	--base-path /terminal \
	--max-clients 10 \
	--writable \
	-t 'theme={"background":"#080808","foreground":"#e8eaed","cursor":"#179c7d","cursorAccent":"#080808","selectionBackground":"#1f1f22"}' \
	-t 'fontSize=14' \
	-t 'fontFamily=ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace' \
	-t 'cursorBlink=true' \
	-t 'rendererType=canvas' \
	/opt/agentbox/start-agent.sh &
TTYD_PID=$!
PIDS="$PIDS $TTYD_PID"

# Caddy: HTTP-Mode → :8080, HTTPS-Mode → :8443. Konkrete Site-Adresse
# wurde oben aus APP_DOMAIN/APP_TLS_* abgeleitet und in $CADDYFILE_RUNTIME
# gerendert.
caddy run --config "$CADDYFILE_RUNTIME" --adapter caddyfile &
CADDY_PID=$!
PIDS="$PIDS $CADDY_PID"

trap 'kill -TERM $PIDS 2>/dev/null || true' EXIT INT TERM

wait -n $PIDS
EXIT_CODE=$?
kill -TERM $PIDS 2>/dev/null || true
exit $EXIT_CODE
