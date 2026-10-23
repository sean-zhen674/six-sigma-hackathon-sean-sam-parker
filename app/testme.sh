#!/bin/bash
# testme.sh
# Start the AeroPrint API on port 8000. Run from anywhere: bash app/testme.sh
# Then open http://localhost:8000/docs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"   # the app is started from the repo root as app.main:app

# Use the project's virtual environment if there is one, else whatever `python` is on the PATH.
if [ -x ".venv/Scripts/python.exe" ]; then
  PY=".venv/Scripts/python.exe"
elif [ -x ".venv/bin/python" ]; then
  PY=".venv/bin/python"
else
  PY="python"
fi

"$PY" -m uvicorn app.main:app --host 0.0.0.0 --port 8000
