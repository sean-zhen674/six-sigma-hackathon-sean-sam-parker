#!/bin/bash
# deployme.sh
#
# Deploy the AeroPrint API to Posit Connect (not Connect Cloud).
# CONNECT_SERVER and CONNECT_API_KEY come from the environment or a gitignored .env file.
# Never write them into this file.

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
  exit 1
fi

# Optional: load CONNECT_SERVER and CONNECT_API_KEY from a .env file (app/.env or repo root .env)
for envfile in "$SCRIPT_DIR/.env" "$ROOT/.env"; do
  if [ -f "$envfile" ]; then
    # shellcheck disable=SC1090
    source "$envfile"
  fi
done

# Same as manifestme.sh: the bundle needs its own copy of the datasets.
mkdir -p "$SCRIPT_DIR/data"
cp "$ROOT"/data/*.csv "$SCRIPT_DIR/data/"

cd "$SCRIPT_DIR"
# If the two variables are set, use explicit auth; otherwise rsconnect uses your saved account.
"$PY" -m rsconnect deploy fastapi \
  ${CONNECT_SERVER:+--server "$CONNECT_SERVER"} \
  ${CONNECT_API_KEY:+--api-key "$CONNECT_API_KEY"} \
  --entrypoint main:app \
  .
