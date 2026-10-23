#!/bin/bash
# manifestme.sh
#
# Write manifest.json for Posit Connect. Run from anywhere: bash app/manifestme.sh
# Needs rsconnect-python (pip install rsconnect-python); this script does not install it.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -x "$ROOT/.venv/Scripts/python.exe" ]; then
  PY="$ROOT/.venv/Scripts/python.exe"
elif [ -x "$ROOT/.venv/bin/python" ]; then
  PY="$ROOT/.venv/bin/python"
else
  PY="python"
fi

if ! "$PY" -m rsconnect --help >/dev/null 2>&1; then
  echo "ERROR: rsconnect-python is not installed. Run: $PY -m pip install rsconnect-python" >&2
  echo "No manifest.json was written." >&2
  exit 1
fi

# The deployed bundle is the app/ folder only, so it needs its own copy of the datasets.
# app/data/ is gitignored: it is made here, not committed.
mkdir -p "$SCRIPT_DIR/data"
cp "$ROOT"/data/*.csv "$SCRIPT_DIR/data/"

cd "$SCRIPT_DIR"
echo "Writing manifest.json for the AeroPrint FastAPI app..."
# Entry point is main.py with the ASGI object `app` (FastAPI is ASGI, mode `fastapi`).
"$PY" -m rsconnect write-manifest fastapi . --entrypoint main:app

echo "Done. manifest.json created in: $SCRIPT_DIR"
