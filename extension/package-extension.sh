#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
OUT="${1:-$ROOT/kosh-extension}"
mkdir -p "$OUT"
cp "$ROOT/extension/manifest.json" "$OUT/manifest.json"
cp "$ROOT/extension/background.js" "$ROOT/extension/content.js" "$ROOT/extension/sidepanel.html" "$ROOT/extension/sidepanel.css" "$ROOT/extension/sidepanel.js" "$OUT/"
printf 'Chrome extension package is ready at %s\nLoad that directory using chrome://extensions → Developer mode → Load unpacked.\n' "$OUT"
