#!/bin/bash
# Start-Wrapper, den ttyd pro Verbindung aufruft. Startet OpenCode als
# PTY-Vordergrundprozess im Workspace. Die Konfiguration liegt unter
# $XDG_CONFIG_HOME/opencode/ — getragen vom persistenten agent-home-Volume.
set -eu

cd /workspace
export PATH="/opt/opencode/bin:${PATH}"
# AgentBox-Toolkit: Agents/Commands/Modes/Plugins aus
# /opt/agentbox/agent-toolkit (root-owned, read-only). User-Global
# (~/.config/opencode) und Projekt (.opencode) bleiben unverändert
# aktiv; OPENCODE_CONFIG_DIR lädt zusätzlich. Skills werden separat
# über Symlinks im entrypoint.sh eingebunden.
export OPENCODE_CONFIG_DIR=/opt/agentbox/agent-toolkit

exec opencode "$@"
