"""The deployed bundle is the app/ folder only, so app/data/ must be an exact copy of data/."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_app_data_is_an_exact_copy_of_data():
    sources = sorted((ROOT / "data").glob("*.csv"))
    assert len(sources) == 3
    for src in sources:
        copy = ROOT / "app" / "data" / src.name
        assert copy.is_file(), f"missing {copy}; run: bash app/manifestme.sh"
        assert copy.read_bytes() == src.read_bytes(), f"{copy} differs from {src}; run: bash app/manifestme.sh"


def test_template_copies_served_by_the_dashboard_are_exact_copies():
    """The static site serves app/frontend/public/*.csv; they must equal data/template/*.csv."""
    sources = sorted((ROOT / "data" / "template").glob("*.csv"))
    assert [p.name for p in sources] == ["aeroprint_template.csv", "aeroprint_template_with_parameters.csv"]
    for src in sources:
        copy = ROOT / "app" / "frontend" / "public" / src.name
        assert copy.is_file(), f"missing {copy}; copy it from {src}"
        assert copy.read_bytes() == src.read_bytes(), f"{copy} differs from {src}; copy it again"


def test_manifest_checksums_equal_the_md5_of_the_committed_lf_files():
    """CI deploys from the git checkout (LF). Every manifest checksum must equal the md5 of that file with
    CRLF changed to LF, and the manifest must list exactly 7 files for Python 3.12."""
    manifest = json.loads((ROOT / "app" / "manifest.json").read_text(encoding="utf-8"))
    assert sorted(manifest["files"]) == sorted([
        ".python-version", "data/capable_baseline.csv", "data/marginal_spread.csv", "data/oxygen_drift.csv",
        "main.py", "qc.py", "requirements.txt",
    ])
    assert manifest["python"]["version"].startswith("3.12.")
    for name, info in manifest["files"].items():
        content = (ROOT / "app" / name).read_bytes().replace(b"\r\n", b"\n")
        assert hashlib.md5(content).hexdigest() == info["checksum"], (
            f"{name}: the manifest is stale or was written from CRLF; run: bash app/manifestme.sh"
        )
