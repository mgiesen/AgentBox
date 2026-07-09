# syntax=docker/dockerfile:1.7

# ── Stage 1: mkdocs-Build ─────────────────────────────────────────────
# Erzeugt die Anleitung als statisches site/-Verzeichnis. Identische
# mkdocs.yml wie der Pages-CI-Job; relative Asset-Pfade funktionieren
# unter /docs/ im Container ebenso wie im Pages-Root.
FROM python:3.12-slim AS docs-build
WORKDIR /build
COPY docs/requirements.txt /build/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY mkdocs.yml /build/mkdocs.yml
COPY overrides /build/overrides
COPY docs /build/docs
RUN mkdocs build --strict --site-dir /out

# ── Stage 2: Laufzeit-Image ───────────────────────────────────────────
FROM ubuntu:24.04

ARG DEBIAN_FRONTEND=noninteractive
ARG TARGETARCH

# Basis-Pakete + Caddy aus offiziellem Repo + ttyd aus GitHub Release
# + Open Props (Design-Tokens) als statisches CSS
RUN apt-get update && apt-get install -y --no-install-recommends \
		ca-certificates curl gnupg debian-keyring debian-archive-keyring apt-transport-https \
		git python3 unzip \
		samba samba-common-bin samba-vfs-modules \
	&& curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
		| gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
	&& echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" \
		> /etc/apt/sources.list.d/caddy-stable.list \
	&& apt-get update && apt-get install -y --no-install-recommends caddy \
	&& case "${TARGETARCH:-$(dpkg --print-architecture)}" in \
		amd64) TTYD_ARCH=x86_64 ;; \
		arm64) TTYD_ARCH=aarch64 ;; \
		*) echo "unsupported arch: ${TARGETARCH}" >&2; exit 1 ;; \
	   esac \
	&& curl -fL -o /usr/local/bin/ttyd \
		"https://github.com/tsl0922/ttyd/releases/latest/download/ttyd.${TTYD_ARCH}" \
	&& chmod +x /usr/local/bin/ttyd \
	&& mkdir -p /srv/assets \
	&& curl -fL -o /srv/assets/open-props.min.css \
		"https://unpkg.com/open-props@1.7.15/open-props.min.css" \
	&& rm -rf /var/lib/apt/lists/*

# Unprivilegierter User mit fixierter UID — verhindert Permission-Drift
# zwischen Image-Generationen und mountendem agent-home-Volume.
RUN useradd -u 1001 -m -s /bin/bash agent

# OpenCode wird als 'agent' installiert, danach aus HOME nach /opt umgelagert.
# Begründung: HOME wird zur Laufzeit als persistentes Volume gemountet
# (siehe docs/developers/architecture/volumes.md) und würde Binaries unter
# /home/agent verschatten.
USER agent
WORKDIR /home/agent
RUN curl -fsSL https://opencode.ai/install | bash

USER root
RUN mv /home/agent/.opencode /opt/opencode \
    && chown -R agent:agent /opt/opencode \
    && rm -rf /home/agent/.opencode /home/agent/.local \
              /home/agent/.bashrc /home/agent/.bash_logout /home/agent/.profile
ENV PATH="/opt/opencode/bin:${PATH}"

# App-Dateien
COPY api/files-api.py            /opt/agentbox/files-api.py
COPY api/agent-api.py            /opt/agentbox/agent-api.py
COPY start-agent.sh              /opt/agentbox/start-agent.sh
COPY config/opencode-default.json /opt/agentbox/seed/opencode/opencode.json
# AgentBox-Toolkit: read-only Agents/Skills/Commands, die zentral mit dem
# Image ausgerollt werden. Anbindung an OpenCode zur Laufzeit:
#   - Agents/Commands/Modes/Plugins → ENV OPENCODE_CONFIG_DIR (start-agent.sh)
#   - Skills → Symlinks aus /home/agent/.config/opencode/skills/ ins
#     read-only-Verzeichnis (entrypoint.sh), weil OpenCode für Skills
#     keine System-Schicht kennt.
COPY --chown=root:root agent-toolkit/ /opt/agentbox/agent-toolkit/
# Agents leben als agents/<name>.md (OpenCode-Konvention). Optionale
# Assets (Templates, Logos, Scripts) liegen im gleichnamigen Subordner
# agents/<name>/, der von OpenCode ignoriert wird, weil er keine .md
# auf erster Ebene enthält.
RUN chmod -R a-w /opt/agentbox/agent-toolkit

# AgentBox-native Skill-Runtime aus agent-toolkit/skills/*/install.yaml
# installieren, Wrapper erzeugen und direkt verifizieren. Die
# Installationsanweisungen bleiben bei den Skills; das Dockerfile
# orchestriert nur.
COPY scripts/install-agentbox-toolkit.py /tmp/install-agentbox-toolkit.py
COPY scripts/smoke-agentbox-toolkit.sh /tmp/smoke-agentbox-toolkit.sh
RUN python3 /tmp/install-agentbox-toolkit.py \
		--toolkit /opt/agentbox/agent-toolkit \
	&& bash /tmp/smoke-agentbox-toolkit.sh \
	&& rm /tmp/install-agentbox-toolkit.py /tmp/smoke-agentbox-toolkit.sh

# Statisches Toolkit-Manifest für das Werkzeuge-Modal im Frontend.
# Wird einmal zur Build-Zeit erzeugt und unter /srv/agent-toolkit.json
# ausgeliefert; Frontend lädt es per fetch() und rendert die Übersicht.
COPY scripts/build-toolkit-manifest.py /tmp/build-toolkit-manifest.py
RUN python3 /tmp/build-toolkit-manifest.py \
        --toolkit /opt/agentbox/agent-toolkit \
        --output /srv/agent-toolkit.json \
    && rm /tmp/build-toolkit-manifest.py
COPY config/smb.conf             /etc/samba/smb.conf
COPY frontend/                   /srv/
# Statische mkdocs-Doku unter /docs/ — exakt zum Container-Stand.
COPY --from=docs-build /out      /srv/docs/
COPY Caddyfile.template      /etc/caddy/Caddyfile.template
COPY entrypoint.sh           /usr/local/bin/entrypoint.sh

RUN chmod +x \
		/usr/local/bin/entrypoint.sh \
		/opt/agentbox/start-agent.sh \
		/opt/agentbox/files-api.py \
		/opt/agentbox/agent-api.py

# Build-Metadaten neben den statischen Frontend-Assets ablegen.
# Das About-Modal zeigt bewusst nur den Image-Build-Zeitpunkt, weil
# lokale Builds auch uncommitted Änderungen enthalten können.
RUN BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
	&& printf '{"date":"%s"}\n' "$BUILD_DATE" > /srv/version.json

# Mount-Punkte: workspace (Anwenderdateien) und agent-home (OpenCode-Config,
# Auth-Token, Sessions). Beide als Volume deklariert, damit nichts
# versehentlich in den Image-Layer geschrieben wird.
RUN mkdir -p /workspace /home/agent /var/log/samba /var/lib/samba/usershares \
	&& chown agent:agent /workspace /home/agent /var/log/samba /var/lib/samba/usershares
VOLUME ["/workspace", "/home/agent"]

# Container läuft komplett unprivilegiert. Caddy auf :8080 (HTTP, default)
# bzw. :8443 (HTTPS, wenn APP_DOMAIN gesetzt), Daten/Config in $HOME.
# Damit funktioniert auch das eingebaute "tls internal" ohne Schreibrechte
# auf /var/lib/caddy — die generierten Certs landen im agent-home-Volume.
USER agent
WORKDIR /home/agent
ENV HOME=/home/agent \
    XDG_CONFIG_HOME=/home/agent/.config \
    XDG_DATA_HOME=/home/agent/.local/share

EXPOSE 8080 8443 445

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
