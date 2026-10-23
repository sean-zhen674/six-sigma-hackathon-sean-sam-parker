"""AeroPrint REST API (task H-04).

Thin routes only: every number comes from qc.analyze(). This file reads a CSV, calls analyze(),
and returns the result. There are no statistics here.
"""
import io
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# Two ways this file is started:
#   1. From the repo root (testme.sh, pytest): the package `app` exists, so `app.qc` works.
#   2. On Posit Connect: app/ itself is the bundle root, so there is no package `app`;
#      qc.py sits next to this file and is imported as plain `qc`.
# Only a missing module triggers the fallback; any other error in qc.py still shows up.
try:
    from app.qc import DEFAULT_SPECS, analyze
except ModuleNotFoundError:
    from qc import DEFAULT_SPECS, analyze

HERE = Path(__file__).resolve().parent


def _find_data_dir() -> Path:
    """./data next to this file (a deployed bundle) if it has CSVs, else ../data (repo root)."""
    for candidate in (HERE / "data", HERE.parent / "data"):
        if candidate.is_dir() and any(candidate.glob("*.csv")):
            return candidate
    return HERE.parent / "data"


DATA_DIR = _find_data_dir()

DATASET_DESCRIPTIONS = {
    "capable_baseline": "30 builds, process in control; the capable case (every index at least 1.33).",
    "oxygen_drift": "Chamber oxygen creeps up from build 21, so UTS falls and porosity rises.",
    "laser_power_excursion": "Laser power drops about 15 % on builds 24-26, so porosity spikes.",
}

app = FastAPI(
    title="AeroPrint API",
    description=(
        "Monitors a titanium-bracket 3D-printing process with X-bar/R and I-MR control charts, "
        "Nelson rules, capability indices (within-build sigma = R-bar/d2) and a build disposition "
        "(RELEASE / RETEST / QUARANTINE). All statistics live in qc.py."
    ),
    version="1.0.0",
)

# Let a browser front end on another address (the React dashboard) call this API.
# Fine for a hackathon demo; list the real front-end URL in allow_origins for anything private.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _datasets() -> dict:
    """Bundled datasets that exist on disk: {name: path}."""
    return {name: DATA_DIR / f"{name}.csv" for name in DATASET_DESCRIPTIONS if (DATA_DIR / f"{name}.csv").is_file()}


def _run(df: pd.DataFrame, specs=None, baseline_n: int = 20) -> dict:
    """Call qc.analyze and turn its ValueError (bad user data) into HTTP 422."""
    try:
        return analyze(df, specs=specs, baseline_n=baseline_n)
    except ValueError as err:
        raise HTTPException(status_code=422, detail=str(err))


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "AeroPrint API is running", "docs": "/docs"}


@app.get("/health")
async def health():
    """Liveness check."""
    return {"status": "ok"}


@app.get("/datasets")
async def list_datasets():
    """The bundled test datasets: name and one-line description."""
    return {"datasets": [{"name": n, "description": DATASET_DESCRIPTIONS[n]} for n in _datasets()]}


@app.get("/spec-limits")
async def spec_limits():
    """The default specification limits (lsl, usl, target) per quality characteristic."""
    return {"specs": DEFAULT_SPECS}


@app.get("/analyze/{dataset}")
async def analyze_dataset(dataset: str, baseline_n: int = Query(20, ge=5)):
    """Analyze one bundled dataset (see GET /datasets)."""
    path = _datasets().get(dataset)  # lookup by name, never build a path from user text
    if path is None:
        raise HTTPException(status_code=404, detail=f"unknown dataset '{dataset}'; see GET /datasets")
    return _run(pd.read_csv(path), baseline_n=baseline_n)


@app.post("/analyze")
async def analyze_upload(
    file: UploadFile = File(..., description="CSV, one row per coupon, 5 coupons per build"),
    baseline_n: int = Query(20, ge=5, description="number of first builds used for the control limits"),
    uts_lsl: Optional[float] = Query(None, description="UTS lower spec limit, MPa (default 900)"),
    porosity_usl: Optional[float] = Query(None, description="porosity upper spec limit, % (default 0.5)"),
    dim_lsl: Optional[float] = Query(None, description="dimensional deviation lower limit, mm (default -0.10)"),
    dim_usl: Optional[float] = Query(None, description="dimensional deviation upper limit, mm (default 0.10)"),
):
    """Analyze an uploaded CSV. Spec limits you do not give keep their defaults."""
    raw = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except (ValueError, UnicodeDecodeError, pd.errors.ParserError) as err:  # EmptyDataError is a ValueError
        raise HTTPException(status_code=422, detail=f"could not read the upload as a CSV file: {err}")
    overrides = {
        "uts_MPa": {"lsl": uts_lsl},
        "porosity_pct": {"usl": porosity_usl},
        "dimensional_dev_mm": {"lsl": dim_lsl, "usl": dim_usl},
    }
    specs = {col: {k: v for k, v in lim.items() if v is not None} for col, lim in overrides.items()}
    specs = {col: lim for col, lim in specs.items() if lim}
    return _run(df, specs=specs or None, baseline_n=baseline_n)
