#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || realpath "$0")")" && pwd)"

exec python3 "$SCRIPT_DIR/chart.py" "$@"
