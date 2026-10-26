#!/bin/bash
# manifestme.sh
#
# Write manifest.json for Posit Connect. Run from anywhere: bash app/manifestme.sh
# Needs rsconnect-python (pip install rsconnect-python); this script does not install it.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# PYTHON=<path> overrides the choice: the manifest records the Python it is written with, and it
# must match app/.python-version (3.12). Example: PYTHON=.venv312/Scripts/python.exe bash app/manifestme.sh
if [ -n "${PYTHON:-}" ]; then
  PY="$PYTHON"
elif [ -x "$ROOT/.venv/Scripts/python.exe" ]; then
  PY="$ROOT/.venv/Scripts/python.exe"
elif [ -x "$ROOT/.venv/bin/python" ]; then
  PY="$ROOT/.venv/bin/python"
else
  PY="python"
fi

if ! "$PY" -m rsconnect.main --help >/dev/null 2>&1; then
  echo "ERROR: rsconnect-python is not installed. Run: $PY -m pip install rsconnect-python" >&2
  echo "No manifest.json was written." >&2
  exit 1
fi

# The deployed bundle is the app/ folder only, so it needs its own copy of the datasets.
# app/data/ is committed (CI deploys exactly what is in git); tests/test_bundle.py checks it matches data/.
mkdir -p "$SCRIPT_DIR/data"
cp "$ROOT"/data/*.csv "$SCRIPT_DIR/data/"

# Write the manifest from a clean staging folder holding ONLY what the API needs, so it never lists
# the React project (app/frontend, deployed separately), scripts, docs or dev-only files. CI uploads
# exactly the files the manifest lists, and the paths are the same as in app/.
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/data"
# The checksums must equal the md5 of the files AS COMMITTED in git (LF line endings), because CI deploys
# from the git checkout on Linux. A Windows working copy can hold CRLF (for example after an editor saved
# the file), which gave qc.py a different checksum. So every file is copied through `tr -d ''`, which
# removes carriage returns: the staged bytes are the LF bytes that git stores. tests/test_bundle.py checks it.
copy_lf() { tr -d '' < "$1" > "$2"; }
for f in main.py qc.py requirements.txt .python-version; do
  copy_lf "$SCRIPT_DIR/$f" "$STAGE/$f"
done
for f in "$SCRIPT_DIR"/data/*.csv; do
  copy_lf "$f" "$STAGE/data/$(basename "$f")"
done

cd "$STAGE"
echo "Writing manifest.json for the AeroPrint FastAPI app..."
# Entry point is main.py with the ASGI object `app` (FastAPI is ASGI, mode `fastapi`).
"$PY" -m rsconnect.main write-manifest fastapi . --entrypoint main:app
copy_lf manifest.json "$SCRIPT_DIR/manifest.json"  # LF, like git stores it

echo "Done. manifest.json created in: $SCRIPT_DIR"
