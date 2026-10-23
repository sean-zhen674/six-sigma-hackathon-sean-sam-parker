# AeroPrint API

A REST API (FastAPI) that checks whether a titanium-bracket 3D-printing process is in control
and capable. Input: a CSV with one row per coupon (5 coupons per build; 5 required columns, 8 optional print-parameter columns, anything else ignored, see [`../docs/csv-format.md`](../docs/csv-format.md)). Output: X-bar/R and
I-MR charts, Nelson rule flags, capability indices, and RELEASE / QUARANTINE per build.

All statistics are in `app/qc.py`; `app/main.py` only reads a CSV, calls `qc.analyze()` and returns
the result. For the full explanation (formulas, assumptions, every function, inputs and the
fresh-clone setup) read the **[root README](../README.md)**. Upload format and templates: [`../docs/csv-format.md`](../docs/csv-format.md); the sample files' codebook: [`../data/README.md`](../data/README.md).

## Run it

From the repo root, after the one-time setup in the root README (virtual environment and
`pip install -r app/requirements.txt -r app/requirements-dev.txt`):

```bash
bash app/testme.sh        # API on http://localhost:8000, docs at /docs
```

## Endpoints

| Endpoint | What it does |
|---|---|
| `GET /` | message and link to `/docs` |
| `GET /health` | `{"status": "ok"}` |
| `GET /datasets` | the 3 bundled test datasets |
| `GET /spec-limits` | default spec limits (UTS LSL 900, porosity USL 0.5, dimensional +-0.10) |
| `GET /analyze/{dataset}` | full analysis of a bundled dataset; the same optional `baseline_n`, `uts_lsl`, `porosity_usl`, `dim_lsl`, `dim_usl` as `POST /analyze`; 404 if unknown |
| `POST /analyze` | full analysis of an uploaded CSV (`file`; required columns `build_id`, `build_timestamp`, `uts_MPa`, `porosity_pct`, `dimensional_dev_mm`; the 8 print parameters are optional; other columns are ignored; bad data gives a 422 that names the problem); optional `baseline_n` (>= 5, default 20), `uts_lsl`, `porosity_usl`, `dim_lsl`, `dim_usl` |

```bash
curl http://localhost:8000/health
curl http://localhost:8000/analyze/oxygen_drift
curl -F file=@data/marginal_spread.csv http://localhost:8000/analyze
curl -F file=@data/oxygen_drift.csv "http://localhost:8000/analyze?baseline_n=20&uts_lsl=920&porosity_usl=0.4"
curl "http://localhost:8000/analyze/oxygen_drift?uts_lsl=990"   # same answer as POSTing the file with uts_lsl=990 (UTS Cpl -1.04)
```

GET and POST share one helper (`_build_specs` in `main.py`) that turns the spec parameters into
the limits passed to `qc.analyze`, so they cannot differ. A limit that is not a finite number, or
`dim_lsl` not below `dim_usl`, returns HTTP 422 with a message.

Bad input (missing column, a build without 5 coupons, an unreadable file) returns HTTP 422 with
`{"detail": "<what is wrong>"}`.

## Tests

```bash
python -m pytest tests -q     # from the repo root; use .venv/Scripts/python.exe on Windows if the venv is not active
```

## How it is bundled for Posit Connect

On Posit Connect the `app/` folder is the bundle root, so there is no `app` package. Two things
make that work:

- **Import fallback.** `main.py` tries `from app.qc import ...` (repo root, tests) and, only if
  that module is not found, falls back to `from qc import ...` (bundle root). Any other error
  inside `qc.py` still shows up.
- **Copied data folder.** `bash app/manifestme.sh` copies `data/*.csv` into `app/data/` (committed, so the
  deploy ships it; `tests/test_bundle.py` fails if it drifts from `data/`) and writes `manifest.json`, because the bundle cannot see `../data`. `main.py`
  looks in `app/data/` first, then `../data/`. The script needs `rsconnect-python`
  (`python -m pip install rsconnect-python`).

```bash
bash app/manifestme.sh    # copies data/*.csv into app/data/, writes manifest.json
bash app/deployme.sh      # needs CONNECT_SERVER and CONNECT_API_KEY in the environment or a gitignored .env
```

Never put the server address or API key in a file that is committed.
