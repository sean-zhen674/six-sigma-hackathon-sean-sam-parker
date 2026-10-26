# AeroPrint API

A REST API (FastAPI) that checks whether a titanium-bracket 3D-printing process is in control and capable of meeting the client's limits. **Input:** one CSV with one row per coupon (exactly 5 coupons per build; 5 required columns, optional print-setting columns, optional `machine_id` and `material_lot`, anything else ignored). **Output:** X-bar/R and I-MR control charts, Nelson rule flags, capability indices (Cpl, Cpu, Cp, Cpk), a verdict per build (**QUARANTINE**, **NOT RELEASED** or **RELEASE**), the print setting to investigate first, and a machine and material-lot analysis.

All statistics are in [`qc.py`](qc.py). [`main.py`](main.py) only reads a CSV, calls `qc.analyze()` and returns the result.

**The full documentation** (every function, every endpoint, the method and the formulas, the demo on the three datasets, assumptions and limits) is the **[root README](../README.md)**. This page is the short service README: how to run it, what it serves, and how it is deployed.

- Live API docs: <https://connect.systems-apps.com/content/8ec33f65-f84a-4323-a51d-b2d9a70e08da/docs>
- File format and templates: [`../docs/csv-format.md`](../docs/csv-format.md)
- Codebook of the sample files: [`../data/README.md`](../data/README.md)

## Run it

From the repo root, after the one-time setup (a virtual environment and `pip install -r app/requirements.txt -r app/requirements-dev.txt`, see [root README section 3](../README.md#3-run-it-yourself)):

```bash
bash app/testme.sh        # API on http://localhost:8000, interactive docs at /docs
```

The same thing by hand (Windows PowerShell):

```powershell
.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

## Endpoints

| Endpoint | What it does |
|---|---|
| `GET /` | `{"message": "AeroPrint API is running", "docs": "/docs"}` |
| `GET /health` | `{"status": "ok"}` |
| `GET /datasets` | the 3 bundled test datasets (`capable_baseline`, `oxygen_drift`, `marginal_spread`) with a description each |
| `GET /spec-limits` | the default allowed values (tensile strength lower limit 900 MPa, porosity upper limit 0.5 %, dimensional deviation -0.10 to +0.10 mm) with targets |
| `GET /analyze/{dataset}` | full analysis of a bundled dataset; 404 if the name is unknown |
| `POST /analyze` | full analysis of an uploaded CSV (form file `file`); a file the tool cannot use gets a 422 whose text says what to fix |

Both analyze routes take the same optional query parameters:

| Parameter | Default | Meaning |
|---|---|---|
| `baseline_n` | 20 (integer, **3 or more**) | how many of the first builds set the control limits |
| `uts_lsl` | 900 | tensile strength lower limit, MPa |
| `porosity_usl` | 0.5 | porosity upper limit, % |
| `dim_lsl` | -0.10 | dimensional deviation lower limit, mm |
| `dim_usl` | 0.10 | dimensional deviation upper limit, mm |

Examples (on Windows PowerShell use `curl.exe`):

```bash
curl http://localhost:8000/health
curl http://localhost:8000/analyze/oxygen_drift
curl -F file=@data/marginal_spread.csv http://localhost:8000/analyze
curl -F file=@data/oxygen_drift.csv "http://localhost:8000/analyze?baseline_n=20&uts_lsl=920&porosity_usl=0.4"
curl "http://localhost:8000/analyze/oxygen_drift?uts_lsl=990"   # same answer as POSTing the file with uts_lsl=990 (tensile strength Cpl -1.04)
```

GET and POST share one helper (`_build_specs` in `main.py`) that turns the parameters into the limits passed to `qc.analyze`, so they cannot differ.

**Errors.** Unknown dataset: HTTP 404 `{"detail":"unknown dataset 'nope'; see GET /datasets"}`. Bad input gives HTTP 422: a limit that is not a finite number (`{"detail":"uts_lsl must be a finite number, got nan"}`), a lowest value not below the highest (`{"detail":"usl must be greater than lsl"}`), a missing column, a build without 5 coupons, an unreadable file (each as `{"detail":"<what is wrong>"}`), or `baseline_n` below 3 (FastAPI's own list-style message). More in [root README section 8.2](../README.md#82-errors).

**CORS.** Any origin may call the API (`allow_origins=["*"]`), so the React dashboard can run on another address.

## Scripts

| Script | Job | Use |
|---|---|---|
| `testme.sh` | run the API locally on port 8000; finds `.venv` by itself | `bash app/testme.sh` |
| `manifestme.sh` | copy `data/*.csv` into `app/data/` and write `manifest.json` for Posit Connect (needs `rsconnect-python`: `python -m pip install rsconnect-python`) | `PYTHON=.venv312/Scripts/python.exe bash app/manifestme.sh` |
| `deployme.sh` | deploy the API to Posit Connect from your machine | `bash app/deployme.sh` (needs `CONNECT_SERVER` and `CONNECT_API_KEY` in the environment or a gitignored `.env`) |

Never put the server address or API key in a file that is committed.

## Files

| File | What it is |
|---|---|
| `qc.py` | all the statistics (plain functions, no web framework) |
| `main.py` | the FastAPI routes |
| `requirements.txt` | pinned packages the API needs (numpy, pandas, scipy, fastapi, uvicorn, python-multipart) |
| `requirements-dev.txt` | adds pytest and httpx for the tests |
| `.python-version` | 3.12, the Python the deployed API uses |
| `manifest.json` | the Posit Connect manifest (committed; its checksums must match the files) |
| `data/` | a committed copy of `../data/*.csv` that ships inside the bundle |
| `testme.sh`, `manifestme.sh`, `deployme.sh` | the three scripts above |
| `frontend/` | the React dashboard, deployed as a second piece of content ([`frontend/README.md`](frontend/README.md)) |

## Tests

```bash
python -m pytest tests -q     # from the repo root; use .venv/Scripts/python.exe if the environment is not active
```

Expected: 138 passed. The tests cover the known answers, the zero-spread case, the API routes and the bundle checks (`tests/test_bundle.py`).

## How it is bundled for Posit Connect

On Posit Connect the `app/` folder is the bundle root, so there is no `app` package. Two things make that work:

- **Import fallback.** `main.py` tries `from app.qc import ...` (repo root, tests) and, only if that module is not found, falls back to `from qc import ...` (bundle root). Any other error inside `qc.py` still shows up.
- **Copied data folder.** The bundle cannot see `../data`, so `manifestme.sh` copies `data/*.csv` into `app/data/` (committed, so the deploy ships it) and `main.py` looks in `app/data/` first, then `../data/`. `tests/test_bundle.py` fails if the copy drifts from `data/`.

**Regenerate the manifest after changing `app/*.py`, a requirements file or the data**, and commit it. The GitHub Actions workflow (`.github/workflows/deploy-fastapi.yml`) only checks the manifest, it never rewrites it. The manifest records the Python version, so write it with a Python 3.12 environment (`PYTHON=...`) so that it matches `.python-version`.
