#!/usr/bin/env bash
set -euo pipefail

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

agentbox-chart bar \
    --data '{"labels":["A","B"],"values":[1,2]}' \
    --output "$tmpdir/chart.svg"

magick -size 16x16 xc:white "$tmpdir/image.png"
agentbox-image info "$tmpdir/image.png" >/dev/null

printf '# Smoke\n\nEin kurzer Test.\n' > "$tmpdir/input.md"
agentbox-pandoc-pdf \
    --input "$tmpdir/input.md" \
    --output "$tmpdir/output.pdf" \
    --no-optimize

test -s "$tmpdir/chart.svg"
test -s "$tmpdir/output.pdf"
